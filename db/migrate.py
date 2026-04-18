#!/usr/bin/env python3
"""
Sudacka Mreza — SQL Server to PostgreSQL migration
Uses docker exec + sqlcmd/psql (no extra library deps)
"""
import subprocess
import json
import re

MSSQL_CONTAINER = "mssql-migration"
MSSQL_USER = "miguser"
MSSQL_PASS = "MigPass123"

PG_CONTAINER = "sudacka-mreza-postgres-sudacka-1"
PG_USER = "sudacka"
PG_DB = "sudacka_mreza"

TABLES = [
    "Jezici",
    "Geo_drzave",
    "Geo_zupanije",
    "Geo_gradovi",
    "Geo_opcine",
    "Sudovi_vrste_def",
    "Sudovi",
    "Sudac_suda",
    "Sudovi_nadleznosti",
    "Suci",
    "Odvjetnistva_vrste_def",
    "Odvjetnistva",
    "Odvjetnici",
    "Odvjetnik_odvjetnistva",
    "Odvjetnistva_nadleznost",
    "CMS_kategorije",
    "CMS_galerije_sadrzaj",
    "CMS_dokumenti",
    "Korisnici",
]

MSSQL_TO_PG = {
    "int": "INTEGER",
    "smallint": "SMALLINT",
    "bigint": "BIGINT",
    "tinyint": "SMALLINT",
    "bit": "BOOLEAN",
    "float": "DOUBLE PRECISION",
    "real": "REAL",
    "decimal": "NUMERIC",
    "numeric": "NUMERIC",
    "money": "NUMERIC(19,4)",
    "smallmoney": "NUMERIC(10,4)",
    "datetime": "TIMESTAMP",
    "datetime2": "TIMESTAMP",
    "smalldatetime": "TIMESTAMP",
    "date": "DATE",
    "time": "TIME",
    "nvarchar": "TEXT",
    "varchar": "TEXT",
    "nchar": "TEXT",
    "char": "TEXT",
    "ntext": "TEXT",
    "text": "TEXT",
    "uniqueidentifier": "UUID",
    "image": "BYTEA",
    "varbinary": "BYTEA",
    "binary": "BYTEA",
    "xml": "XML",
}


def run_sqlcmd(query, database="sm2_master"):
    """Run sqlcmd inside Docker, return list of output lines.
    Uses -y 0 for unlimited variable-length column width (avoids row truncation).
    No -W or -h-1 (mutually exclusive with -y 0); headers are absent for
    single computed-column queries.
    """
    cmd = [
        "docker", "exec", MSSQL_CONTAINER,
        "/opt/mssql-tools18/bin/sqlcmd",
        "-S", "localhost",
        "-U", MSSQL_USER,
        "-P", MSSQL_PASS,
        "-C",
        "-d", database,
        "-s|", "-y", "0",
        "-Q", "SET NOCOUNT ON; " + query,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    lines = []
    for ln in r.stdout.splitlines():
        stripped = ln.strip()
        if not stripped:
            continue
        # Skip sqlcmd separator lines (e.g. "------" or "--- ---")
        if all(c in "-| " for c in stripped):
            continue
        lines.append(stripped)
    return lines


def run_pgexec(sql):
    """Execute SQL in PostgreSQL container."""
    r = subprocess.run(
        ["docker", "exec", "-i", PG_CONTAINER,
         "psql", "-U", PG_USER, "-d", PG_DB, "-c", sql],
        capture_output=True, text=True
    )
    return r.returncode, r.stdout, r.stderr


def run_pg_copy(table_name, csv_data):
    """Load CSV data into PostgreSQL via COPY stdin."""
    r = subprocess.run(
        ["docker", "exec", "-i", PG_CONTAINER,
         "psql", "-U", PG_USER, "-d", PG_DB,
         "-c", (
             "COPY \"" + table_name.lower() + "\" FROM STDIN "
             "WITH (FORMAT csv, DELIMITER '|', NULL '\\N')"
         )],
        input=csv_data, capture_output=True, text=True, encoding="utf-8"
    )
    return r.returncode, r.stdout, r.stderr


def get_table_columns(table_name):
    """Return list of (col_name, data_type, is_nullable) from SQL Server."""
    lines = run_sqlcmd(
        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE "
        "FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_NAME='" + table_name + "' "
        "ORDER BY ORDINAL_POSITION"
    )
    cols = []
    for line in lines:
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 3 and parts[0] and not parts[0].startswith("-"):
            cols.append((parts[0], parts[1], parts[2]))
    return cols


def build_ddl(table_name, columns):
    """Return PostgreSQL CREATE TABLE statement."""
    defs = []
    for col, dtype, nullable in columns:
        pg_type = MSSQL_TO_PG.get(dtype.lower(), "TEXT")
        null_clause = "" if nullable == "YES" else " NOT NULL"
        defs.append('    "' + col.lower() + '" ' + pg_type + null_clause)
    return (
        'CREATE TABLE IF NOT EXISTS "' + table_name.lower() + '" (\n'
        + ",\n".join(defs)
        + "\n);"
    )


_CTRL_CHARS = "+".join("CHAR(%d)" % i for i in range(1, 32))
_CTRL_REPL = "REPLICATE(' ',31)"


def safe_col(c):
    """Wrap a SQL Server column in control-char-safe, pipe-safe CAST.
    Uses TRANSLATE to strip all ASCII control chars (CHAR(1)-CHAR(31)),
    then REPLACE to remove any pipe chars from field values.
    """
    cast_expr = "CAST([" + c + "] AS NVARCHAR(MAX))"
    translate_expr = "TRANSLATE(" + cast_expr + "," + _CTRL_CHARS + "," + _CTRL_REPL + ")"
    nopipe_expr = "REPLACE(" + translate_expr + ",'|',' ')"
    return "ISNULL(" + nopipe_expr + ",'\\N')"


def export_data(table_name, col_names):
    """Export table rows as pipe-delimited text (NULL => \\N)."""
    exprs = [safe_col(c) for c in col_names]
    select_expr = ("+'|'+").join(exprs)
    query = "SELECT " + select_expr + " FROM [" + table_name + "]"
    return run_sqlcmd(query)


def main():
    print("=" * 62)
    print("  Sudacka Mreza — SQL Server to PostgreSQL Migration")
    print("=" * 62)

    # ── Step 1: Discover schemas ──────────────────────────────
    print("\n[1/3] Discovering schema from SQL Server...")
    schemas = {}
    for tbl in TABLES:
        cols = get_table_columns(tbl)
        if not cols:
            print("  WARN: No columns for", tbl)
        else:
            schemas[tbl] = cols
            print("  %-40s %d columns" % (tbl, len(cols)))

    # ── Step 2: Create/replace PostgreSQL tables ──────────────
    print("\n[2/3] Rebuilding PostgreSQL tables...")
    for tbl, cols in schemas.items():
        run_pgexec('DROP TABLE IF EXISTS "' + tbl.lower() + '" CASCADE;')
        ddl = build_ddl(tbl, cols)
        rc, out, err = run_pgexec(ddl)
        status = "OK" if rc == 0 else ("ERR: " + err[:60].strip())
        print("  %-40s %s" % (tbl, status))

    # ── Step 3: Migrate data ──────────────────────────────────
    print("\n[3/3] Migrating data...")
    results = {}
    for tbl in TABLES:
        if tbl not in schemas:
            continue
        col_names = [c[0] for c in schemas[tbl]]
        raw_lines = export_data(tbl, col_names)

        # Filter sqlcmd artefact rows (all dashes/underscores)
        data_lines = [
            ln for ln in raw_lines
            if ln.replace("-", "").replace("|", "").replace(" ", "")
        ]

        if not data_lines:
            print("  %-40s 0 rows" % tbl)
            results[tbl] = {"rows": 0, "status": "empty"}
            continue

        csv_data = "\n".join(data_lines) + "\n"
        rc, out, err = run_pg_copy(tbl, csv_data)
        if rc == 0:
            m = re.search(r"COPY (\d+)", out)
            n = int(m.group(1)) if m else len(data_lines)
            print("  OK %-38s %8d rows" % (tbl, n))
            results[tbl] = {"rows": n, "status": "ok"}
        else:
            print("  ERR %-37s COPY error: %s" % (tbl, err[:80].strip()))
            results[tbl] = {"rows": 0, "status": "error", "detail": err[:200]}

    # ── Summary ───────────────────────────────────────────────
    print("\n" + "=" * 62)
    print("  SUMMARY")
    print("=" * 62)
    total = sum(r["rows"] for r in results.values())
    for tbl, r in results.items():
        icon = "OK" if r["status"] == "ok" else ("--" if r["status"] == "empty" else "!!")
        print("  %s %-40s %8s rows" % (icon, tbl, f"{r['rows']:,}"))
    print("\n  Total rows migrated: %s" % f"{total:,}")

    with open("/tmp/migration_results.json", "w") as fh:
        json.dump(results, fh, indent=2)
    print("  Results: /tmp/migration_results.json")
    return results


if __name__ == "__main__":
    main()
