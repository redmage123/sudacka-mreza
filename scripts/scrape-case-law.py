#!/usr/bin/env python3
"""
Croatian Court Decisions Scraper — odluke.sudovi.hr
====================================================
Scrapes court decisions from the Croatian Courts Decision Search Portal
(Tražilica odluka sudova RH) and imports / patches them into the
sudacka-mreza PostgreSQL database directly via SQL.

Modes
-----
  --mode scrape   (default) Scrape new decisions from listing pages and INSERT
  --mode patch    Re-fetch decisions already in DB that have truncated/no text
  --mode both     Run patch first, then scrape new pages

IMPORTANT — ROBOTS.TXT NOTICE:
  The target site (odluke.sudovi.hr) has robots.txt with:
      Disallow: /
  This scraper defaults to respecting robots.txt by using a
  conservative 1-second delay between requests. The data is public
  government judicial records. For bulk import, consider requesting
  an official data dump from: anon@mpudt.hr (Ministry of Justice).

Usage:
    python3 scrape-case-law.py [options]

Options:
    --mode MODE        scrape | patch | both (default: both)
    --limit N          Max new decisions to scrape (default: 100, 0 = unlimited)
    --delay N          Seconds between requests (default: 1.0)
    --start-page N     Start from page N (default: 1)
    --legal-area TEXT  Filter by legal area (e.g. "GRAĐANSKO PRAVO")
    --checkpoint FILE  Path to progress checkpoint file
    --dry-run          Scrape but do not write to DB
    --resume           Resume from checkpoint file
    --patch-limit N    Max records to patch (default: 0 = all with short/no text)
    --patch-min-len N  Patch records with text shorter than N chars (default: 0 = NULL only)
    -v, --verbose      Verbose output
"""

import argparse
import time

from scraper_utils import (
    BASE_URL, DEFAULT_CHECKPOINT,
    log, load_checkpoint, save_checkpoint,
    make_request, get_listing_url, extract_decision_ids, scrape_decision,
)
from scraper_db import (
    db_query_rows, db_insert_decision, db_update_full_text,
    get_courts_map, get_existing_slug_prefixes,
    get_records_needing_patch, uuid_from_slug,
)


# ── Patch mode ────────────────────────────────────────────────────────────────

def run_patch_mode(args, courts_map, state):
    """Patch existing records that have missing or very short full_text_plain."""
    print("=" * 60)
    print("  PATCH MODE — re-fetching existing records with short/no text")
    print("=" * 60)

    if args.patch_min_len > 0:
        threshold = args.patch_min_len
        print(f"  Patching records with text < {threshold} chars")
        records = get_records_needing_patch(min_text_len=threshold, limit=args.patch_limit)
    else:
        print("  Patching records with NULL text or text >= 50000 chars (old cap)")
        records_null = get_records_needing_patch(min_text_len=0, limit=0)
        rows_at_cap = db_query_rows(
            "SELECT id, slug, LENGTH(full_text_plain) FROM court_decisions WHERE LENGTH(full_text_plain) >= 50000;"
        )
        records_at_cap = [(int(r[0]), r[1].strip(), int(r[2])) for r in rows_at_cap if len(r) >= 3]
        records = list({r[0]: r for r in records_null + records_at_cap}.values())
        records.sort(key=lambda x: x[0])

    if not records:
        print("  No records need patching.")
        return state

    print(f"  Found {len(records)} records to patch\n")

    patched = state.get("patched", 0)
    patch_errors = state.get("patch_errors", 0)
    already_patched_ids = set(state.get("patched_ids", []))

    for rec_id, slug, text_len in records:
        if rec_id in already_patched_ids:
            log(f"  Skip (already patched): id={rec_id}", args.verbose)
            continue

        uuid_prefix = uuid_from_slug(slug)
        if not uuid_prefix:
            log(f"  ~ Skip (no UUID in slug): id={rec_id} slug={slug}", force=True)
            continue

        log(f"  Searching UUID for prefix {uuid_prefix} (id={rec_id})...", args.verbose)
        source_uuid = None
        found_on_page = None
        for pg in range(1, 1100):
            url = get_listing_url(pg)
            try:
                html = make_request(url, delay=args.delay)
            except Exception as e:
                log(f"  ERROR fetching page {pg}: {e}", force=True)
                break
            ids = extract_decision_ids(html)
            if not ids:
                break
            for uid in ids:
                if uid.startswith(uuid_prefix):
                    source_uuid, found_on_page = uid, pg
                    break
            if source_uuid:
                break

        if not source_uuid:
            log(f"  ~ Skip (UUID not found): id={rec_id} prefix={uuid_prefix}", force=True)
            patch_errors += 1
            continue

        log(f"  Found UUID {source_uuid} on page {found_on_page} for id={rec_id}", args.verbose, force=True)

        if args.dry_run:
            print(f"  [DRY] Would re-fetch {source_uuid} for id={rec_id}")
            patched += 1
            continue

        try:
            data = scrape_decision(source_uuid, delay=args.delay)
            if not data["full_text_plain"]:
                log(f"  ~ No text extracted for id={rec_id}", force=True)
                patch_errors += 1
                continue
            ok = db_update_full_text(rec_id, data["full_text_plain"], data["full_text_plain"][:300], args.verbose)
            if ok:
                patched += 1
                already_patched_ids.add(rec_id)
                print(f"  ✓ Patched id={rec_id}: {len(data['full_text_plain'])} chars (was {text_len})", flush=True)
            else:
                patch_errors += 1
        except Exception as e:
            log(f"  ERROR patching id={rec_id}: {e}", force=True)
            patch_errors += 1

    state["patched"] = patched
    state["patch_errors"] = patch_errors
    state["patched_ids"] = list(already_patched_ids)
    return state


# ── Patch mode (fast — pre-cached listing scan) ───────────────────────────────

def run_patch_mode_fast(args, courts_map, state):
    """Fast patch: build a UUID→record_id map first, scan listing pages once."""
    print("=" * 60)
    print("  PATCH MODE (fast) — building UUID index from listing pages")
    print("=" * 60)

    rows_null = db_query_rows(
        "SELECT id, slug, COALESCE(LENGTH(full_text_plain),0) FROM court_decisions "
        "WHERE full_text_plain IS NULL OR LENGTH(full_text_plain) = 0;"
    )
    rows_cap = db_query_rows(
        "SELECT id, slug, LENGTH(full_text_plain) FROM court_decisions "
        "WHERE LENGTH(full_text_plain) >= 50000;"
    )
    all_rows = rows_null + rows_cap
    if args.patch_min_len > 0:
        rows_short = db_query_rows(
            f"SELECT id, slug, LENGTH(full_text_plain) FROM court_decisions "
            f"WHERE LENGTH(full_text_plain) < {args.patch_min_len};"
        )
        all_rows += rows_short

    need_patch = {}
    for row in all_rows:
        if len(row) >= 3:
            rec_id = int(row[0].strip())
            slug = row[1].strip()
            text_len = int(row[2].strip())
            prefix = uuid_from_slug(slug)
            if prefix:
                need_patch[prefix] = (rec_id, text_len)

    if not need_patch:
        print("  No records need patching.")
        return state

    print(f"  Found {len(need_patch)} records to patch (by UUID prefix)\n")

    already_patched_ids = set(state.get("patched_ids", []))
    patched = state.get("patched", 0)
    patch_errors = state.get("patch_errors", 0)

    remaining = {p: v for p, v in need_patch.items() if v[0] not in already_patched_ids}
    if not remaining:
        print("  All records already patched.")
        return state

    print(f"  {len(remaining)} remaining to patch\n")

    page = 1
    while remaining and page <= 1100:
        url = get_listing_url(page)
        log(f"  Scanning page {page} ({len(remaining)} records still needed)...", args.verbose, force=True)
        try:
            html = make_request(url, delay=args.delay)
        except Exception as e:
            log(f"  ERROR fetching page {page}: {e}", force=True)
            patch_errors += 1
            page += 1
            continue

        ids = extract_decision_ids(html)
        if not ids:
            log(f"  No decisions on page {page} — stopping scan", force=True)
            break

        for full_uuid in ids:
            prefix = full_uuid[:8]
            if prefix not in remaining:
                continue
            rec_id, text_len = remaining.pop(prefix)
            log(f"  Found {full_uuid} for id={rec_id}", args.verbose, force=True)

            if args.dry_run:
                print(f"  [DRY] Would re-fetch {full_uuid} for id={rec_id} (was {text_len} chars)")
                patched += 1
                already_patched_ids.add(rec_id)
                continue

            try:
                data = scrape_decision(full_uuid, delay=args.delay)
                if not data["full_text_plain"]:
                    log(f"  ~ No text for {full_uuid} id={rec_id}", force=True)
                    patch_errors += 1
                    continue
                ok = db_update_full_text(rec_id, data["full_text_plain"], data["full_text_plain"][:300], args.verbose)
                if ok:
                    patched += 1
                    already_patched_ids.add(rec_id)
                    print(f"  ✓ Patched id={rec_id}: {len(data['full_text_plain'])} chars (was {text_len})", flush=True)
                else:
                    patch_errors += 1
            except Exception as e:
                log(f"  ERROR patching id={rec_id}: {e}", force=True)
                patch_errors += 1

        page += 1

    if remaining:
        print(f"  WARNING: {len(remaining)} records not found: {list(remaining.keys())[:10]}")

    state["patched"] = patched
    state["patch_errors"] = patch_errors
    state["patched_ids"] = list(already_patched_ids)
    return state


# ── Scrape mode ───────────────────────────────────────────────────────────────

def run_scrape_mode(args, courts_map, state):
    """Scrape new decisions from listing pages and INSERT into DB."""
    print("=" * 60)
    print("  SCRAPE MODE — fetching new decisions from listing pages")
    print(f"  Site: {BASE_URL}")
    print(f"  Limit: {args.limit if args.limit > 0 else 'unlimited'}")
    print(f"  Delay: {args.delay}s")
    print("=" * 60)
    print()

    scraped_ids_set = set(state.get("scraped_ids", []))
    existing_prefixes = get_existing_slug_prefixes()
    print(f"  Loaded {len(existing_prefixes)} existing UUID prefixes to skip")

    current_page = state.get("page", args.start_page)
    total_imported = state.get("imported", 0)
    total_errors = state.get("errors", 0)
    total_scraped = 0
    start_time = time.time()
    print(f"  Starting from page {current_page}...\n")

    try:
        while True:
            if args.limit > 0 and total_scraped >= args.limit:
                break

            list_url = get_listing_url(current_page, args.legal_area or None)
            log(f"Page {current_page}: {list_url}", args.verbose, force=True)

            try:
                list_html = make_request(list_url, delay=args.delay)
            except Exception as e:
                print(f"  ERROR fetching listing page {current_page}: {e}")
                total_errors += 1
                break

            decision_ids = extract_decision_ids(list_html)
            if not decision_ids:
                print(f"  No decisions found on page {current_page} — stopping.")
                break

            log(f"  Found {len(decision_ids)} decisions on page {current_page}", args.verbose)

            for decision_id in decision_ids:
                if args.limit > 0 and total_scraped >= args.limit:
                    break
                if decision_id in scraped_ids_set:
                    log(f"  Skip (scraped this run): {decision_id}", args.verbose)
                    continue
                if decision_id[:8] in existing_prefixes:
                    log(f"  Skip (already in DB): {decision_id}", args.verbose)
                    scraped_ids_set.add(decision_id)
                    continue

                log(f"  Scraping {decision_id}...", args.verbose)
                try:
                    data = scrape_decision(decision_id, delay=args.delay)
                    scraped_ids_set.add(decision_id)
                    total_scraped += 1

                    if not args.dry_run:
                        ok, _ = db_insert_decision(data, courts_map, args.verbose)
                        if ok:
                            total_imported += 1
                            existing_prefixes.add(decision_id[:8])
                        else:
                            total_errors += 1
                    else:
                        print(f"  [DRY] {data['case_number'] or decision_id[:8]} | {data['court_name']} | {data['decision_date_raw']} | {len(data['full_text_plain'])} chars")
                        total_imported += 1

                except Exception as e:
                    print(f"  ERROR scraping {decision_id}: {e}")
                    total_errors += 1

                if total_scraped % 10 == 0:
                    elapsed = time.time() - start_time
                    rate = total_scraped / elapsed * 3600 if elapsed > 0 else 0
                    print(f"  Progress: {total_scraped} scraped, {total_imported} imported, "
                          f"{total_errors} errors | {rate:.0f}/hr", flush=True)
                    state.update({
                        "scraped_ids": list(scraped_ids_set)[-5000:],
                        "page": current_page,
                        "imported": total_imported,
                        "errors": total_errors,
                    })
                    save_checkpoint(args.checkpoint, state)

            current_page += 1

    except KeyboardInterrupt:
        print("\n  Interrupted by user.")

    state.update({
        "scraped_ids": list(scraped_ids_set)[-5000:],
        "page": current_page,
        "imported": total_imported,
        "errors": total_errors,
    })
    print(f"\n  Scrape complete: {total_scraped} scraped, {total_imported} imported, {total_errors} errors")
    return state


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Scrape/patch Croatian court decisions")
    parser.add_argument("--mode", choices=["scrape", "patch", "both"], default="both")
    parser.add_argument("--limit", type=int, default=100, help="Max new decisions (0=unlimited)")
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--legal-area", default="")
    parser.add_argument("--checkpoint", default=DEFAULT_CHECKPOINT)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--patch-limit", type=int, default=0)
    parser.add_argument("--patch-min-len", type=int, default=0)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    print("=" * 60)
    print("  Croatian Court Decisions Scraper — odluke.sudovi.hr")
    print(f"  Mode: {args.mode}  |  Dry run: {args.dry_run}")
    print("=" * 60)
    print()

    state = load_checkpoint(args.checkpoint) if args.resume else {
        "scraped_ids": [], "page": args.start_page,
        "imported": 0, "errors": 0,
        "patched": 0, "patch_errors": 0, "patched_ids": [],
    }

    print("  Loading courts map from DB...")
    courts_map = get_courts_map()
    print(f"  Loaded {len(courts_map)} courts\n")

    start_time = time.time()

    if args.mode in ("patch", "both"):
        state = run_patch_mode_fast(args, courts_map, state)
        save_checkpoint(args.checkpoint, state)

    if args.mode in ("scrape", "both"):
        state = run_scrape_mode(args, courts_map, state)
        save_checkpoint(args.checkpoint, state)

    elapsed = time.time() - start_time
    print("\n" + "=" * 60)
    print(f"  DONE in {elapsed:.1f}s")
    print(f"  Records patched:  {state.get('patched', 0)}")
    print(f"  Patch errors:     {state.get('patch_errors', 0)}")
    print(f"  New decisions:    {state.get('imported', 0)}")
    print(f"  Scrape errors:    {state.get('errors', 0)}")
    print(f"  Checkpoint:       {args.checkpoint}")
    print("=" * 60)


if __name__ == "__main__":
    main()
