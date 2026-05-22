/**
 * PII redaction utilities.
 *
 * Two surfaces:
 *   1. initialsOf(name)  — collapse a full name to short initials for the
 *      judge dashboard ("Marko Marković" → "M.M.").
 *   2. redactText(text)  — pass court-decision body / summary through a
 *      regex pipeline that removes OIBs, citizen names, and street addresses
 *      before display. Designed for Croatian legal text. The function is
 *      idempotent: running it twice yields the same output.
 *
 * Scope: redact citizen PII only. Names of judges, state attorneys, expert
 * witnesses, attorneys, public notaries, and other licensed professionals
 * stay readable because Croatian law treats them as public-record figures.
 *
 * Strategy: detect by ROLE PREFIX rather than by name pattern. Croatian
 * decisions follow a consistent vocabulary: "tužitelj" (plaintiff),
 * "tuženik" (defendant), "ovršenik" (debtor) etc. each typically precedes
 * the party name. Names that follow those markers get initialed; names
 * that follow professional markers ("sudac", "vještak", "javni bilježnik"…)
 * stay intact.
 *
 * Limits: post-2018 decisions are already initialized by the courts
 * themselves (see "ĆU" / "Z. K." patterns in the corpus), so this matters
 * mostly for the pre-2018 backlog. Cases the heuristic can't reach are
 * surfaced via a banner on the detail page, not silently passed through.
 */

// ── initialsOf ───────────────────────────────────────────────────────────

// Titles + honorifics to strip before computing initials.
const TITLE_PATTERNS = [
  /^(mr\.?\s*sc\.?|dr\.?\s*sc\.?|doc\.?\s*dr\.?|prof\.?\s*dr\.?|mr\.?|dr\.?|prof\.?|doc\.?|spec\.?|gosp\.?|gđa\.?|gosp\.|gđa\.)\s+/i,
  /^(mr\.?sc\.?|dr\.?sc\.?|doc\.?dr\.?|prof\.?dr\.?)/i,
]

/**
 * Collapse a Croatian-style full name to initials.
 *
 *   "Marko Marković"            → "M.M."
 *   "Marija Ana Horvat-Kovač"   → "M.A.H."
 *   "mr.sc. Branislav Dimitrijević" → "B.D."
 *   ""                          → ""
 *
 * Hyphenated surnames keep their first letter (treated as one part for the
 * purposes of the initial; matches how legal style guides render them).
 */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return ''
  let cleaned = String(name).trim()
  for (const re of TITLE_PATTERNS) cleaned = cleaned.replace(re, '')
  if (!cleaned) return ''
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      // Take first non-hyphen alphabetic char of each part.
      const m = /[A-Za-zČĆŠĐŽčćšđž]/.exec(part)
      return m ? m[0].toUpperCase() + '.' : ''
    })
    .filter(Boolean)
    .join('')
}

// ── redactText ───────────────────────────────────────────────────────────

// 11-digit OIB (Croatian personal/business tax id). Matches both bare and
// after "OIB:" / "OIB :" labels.
const OIB_RE = /\b\d{11}\b/g

// Croatian role markers that introduce CITIZEN names. After the marker we
// expect 1-3 capitalized words forming the person's name. The regex
// captures the marker so we can keep it and rewrite only the name.
//
// Notes:
//  - we accept Croatian-case inflections (tužitelja, tužiteljici, …) by
//    matching the stem
//  - "tužitelja Zavoda" / "tuženika HEP-a" etc. naming an INSTITUTION rather
//    than a person — institutions tend to be one-word ALL-CAPS acronyms or
//    a single word; the post-process step keeps them intact.
const CITIZEN_ROLES = [
  'tužitelj', 'tužiteljic', 'tužiteljc',
  'tuženik', 'tuženic',
  'ovršenik', 'ovršenic',
  'ovrhovoditelj',                    // (often institutional but sometimes natural person)
  'okrivljenik', 'okrivljenic',
  'oštećenik', 'oštećenic',
  'predlagatelj', 'predlagateljic',
  'protustranka',
  'svjedok', 'svjedokinj',
  'maloljetn',
]
const CITIZEN_ROLE_PATTERN = CITIZEN_ROLES.map((r) => r + '[a-zčćšđž]*').join('|')

// "<role> <Name Surname>" — capture both halves.
//
// Role markers are matched case-insensitively (sentence-start capitalization
// happens), but the NAME parts MUST start uppercase. We can't share one regex
// with the `i` flag because that would also let lowercase Croatian function
// words ("za", "od", "u") leak in as name parts. Two-pass instead.
const CITIZEN_NAME_RE = new RegExp(
  // role + space + 1-3 capitalised name parts; subsequent parts must also
  // start uppercase so "Zavoda za zdravstveno osiguranje" isn't captured.
  `(${CITIZEN_ROLE_PATTERN})\\s+` +
    `([A-ZČĆŠĐŽ][a-zčćšđžA-ZČĆŠĐŽ-]+(?:\\s+[A-ZČĆŠĐŽ][a-zčćšđžA-ZČĆŠĐŽ-]+){1,2})\\b`,
  'g',  // case-sensitive on the name body; role stem stays Croatian-lowercase
)

// Address heuristic. Two Croatian word orders to handle:
//   1. <street-type> <Name> <number>      e.g. "Trg kralja Tomislava 36"
//   2. <Name-adj> <street-type> <number>  e.g. "Radnička cesta 82",
//                                              "Ilica 25" (single-word, no type)
// Stems intentionally truncated to handle case endings ("ulica" / "ulici" /
// "ulice" / "ulicu" / "ulicom" share the "ulic" stem).
const STREET_TYPES =
  '(?:ulic[aeiou]m?|cest[aeiou]m?|trg(?:u|om)?|aveni[ji]a|alej[aeiou]m?|' +
  'put(?:u|om|em)?|obal[aeiou]m?|šetališt[aeu]m?|prilaz(?:u|om)?|prolaz(?:u|om)?)'

// Order 1: <type> <Name parts> <number>
const ADDRESS_TYPE_FIRST_RE = new RegExp(
  `\\b${STREET_TYPES}\\s+[A-ZČĆŠĐŽ][\\wčćšđžČĆŠĐŽ\\s.-]{1,40}?\\s+\\d{1,4}[a-z]?\\b`,
  'gi',
)
// Order 2: <Name parts> <type> <number>
const ADDRESS_TYPE_LAST_RE = new RegExp(
  `\\b[A-ZČĆŠĐŽ][\\wčćšđžČĆŠĐŽ-]{2,}(?:\\s+[A-ZČĆŠĐŽ][\\wčćšđžČĆŠĐŽ-]{2,}){0,2}\\s+${STREET_TYPES}\\s+\\d{1,4}[a-z]?\\b`,
  'gi',
)
// IBAN (HR followed by 19 digits) is bank account; keep generic [IBAN] marker.
const IBAN_RE = /\bHR\d{19}\b/g

// E-mail (cheap detection — we don't want to over-redact technical strings)
const EMAIL_RE = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g

// Phone numbers: Croatian +385 / 0... patterns, 6+ digits clustered.
// Drop the leading \b — it doesn't match between whitespace and `+`. The
// leading non-word `+385` or the `\b0` covers the entry conditions instead.
const PHONE_RE = /(?:\+385[\s-]?|\b0)\d[\d\s-]{6,12}\d\b/g

/**
 * Redact citizen-level PII from free-text court-decision content.
 *
 * Idempotent; safe to call repeatedly.
 *
 * What it removes:
 *   - OIBs (11-digit national ID numbers) → [OIB]
 *   - Personal e-mails / phone numbers → [email] / [telefon]
 *   - IBANs → [IBAN]
 *   - Citizen names following Croatian role markers (tužitelj/tuženik/…) →
 *     initials ("Ivana Novaka" → "I.N.")
 *   - Street addresses → [adresa]
 *
 * What it KEEPS:
 *   - Names of judges, state attorneys, court personnel, expert witnesses,
 *     attorneys, public notaries (matched by their own role markers).
 *   - Court names, case numbers, monetary amounts, law citations.
 */
export function redactText(text: string | null | undefined): string {
  if (!text) return ''
  let out = String(text)

  // 1. OIBs (must come before name pass — sometimes embedded in name spans)
  out = out.replace(OIB_RE, '[OIB]')

  // 2. IBANs
  out = out.replace(IBAN_RE, '[IBAN]')

  // 3. Emails (citizen ones; we accept the small risk of redacting
  //    institutional addresses — institutional emails generally don't show
  //    up in dispositive text).
  out = out.replace(EMAIL_RE, '[email]')

  // 4. Phone numbers
  out = out.replace(PHONE_RE, '[telefon]')

  // 5. Citizen names following role markers.
  out = out.replace(CITIZEN_NAME_RE, (_, role: string, name: string) => {
    // Skip if the captured "name" is actually an ALL-CAPS or acronym-like
    // institution token (e.g. "HEP", "ZAGREBAČKA BANKA", "EOS Matrix").
    if (/^[A-ZČĆŠĐŽ.\s-]+$/.test(name)) return `${role} ${name}`
    return `${role} ${initialsOf(name)}`
  })

  // 6. Street addresses (after names so the city part of "Zagrebu, Ilica 25"
  //    doesn't get matched as a name). Both Croatian word orders.
  out = out.replace(ADDRESS_TYPE_FIRST_RE, '[adresa]')
  out = out.replace(ADDRESS_TYPE_LAST_RE, '[adresa]')

  return out
}

/**
 * Helper for the dashboard: lossless join of an array of judge initials
 * with " / " for cases where a decision has multiple judges on the panel.
 */
export function judgePanelLabel(names: string[]): string {
  return names.map((n) => initialsOf(n)).filter(Boolean).join(' / ')
}
