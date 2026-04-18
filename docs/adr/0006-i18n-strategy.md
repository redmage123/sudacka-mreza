# ADR-0006: Internationalisation (i18n) Strategy
## Status: Accepted
## Date: 2026-03-21

## Context

The platform must serve content in both Croatian (HR, primary) and English (EN). The current site uses a query parameter approach (`?Lng=hr` / `?Lng=en`). The new site must:
1. Show content in the correct language based on URL path
2. Fall back gracefully when English translations don't exist (show Croatian)
3. Allow content editors to enter bilingual content in Payload Admin
4. Be indexable by search engines in both languages

## Decision

**Two-layer i18n approach:**

**Layer 1 — UI strings (labels, buttons, navigation):**
`react-i18next` + `i18next` in the `web/` frontend. Translation files at `web/src/i18n/hr.json` and `web/src/i18n/en.json`. Language detection from URL path prefix: `/hr/*` defaults to Croatian (and is the default), `/en/*` switches to English. The `LanguageSwitch` component updates the URL prefix and persists the selection.

**Layer 2 — Content translations (CMS data):**
Payload CMS 3's built-in locale system. Collections with locale-aware fields use `?locale=hr` or `?locale=en` query parameters on the API. Croatian (`hr`) is `defaultLocale`. When `?locale=en` is requested and an English translation doesn't exist, Payload falls back to `hr`.

The frontend `api/client.ts` base fetch wrapper automatically appends `?locale=hr` or `?locale=en` based on the current i18next language.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **URL query parameter (`?lang=hr`)** | The current approach; not SEO-friendly (duplicate content on the same URL). Google recommends separate URLs per locale. URL path prefix (`/hr/`, `/en/`) is the standard SEO-recommended approach. |
| **Subdomain-based (`hr.sudacka-mreza.hr`)** | Requires separate DNS records and TLS certs per locale. More complex Caddy config. No benefit over path prefixes for a 2-locale site. |
| **Browser `Accept-Language` header only** | Not bookmarkable; URL does not reflect language; Google cannot crawl both versions. |
| **FormatJS / react-intl** | FormatJS is a solid choice but `react-i18next` has a larger ecosystem, better TypeScript support, and more examples specific to React Router setups. `i18next` is the industry standard for non-React code too. |
| **Next.js built-in i18n** | Only applicable if using Next.js (not chosen; see ADR-0003). |
| **Single language (Croatian only)** | The existing site has English translations for some content. The client has an international audience (foreign embassies, legal researchers). English is a must-have per SPEC §4.1. |

## Consequences

**Positive:**
- URL path prefixes (`/hr/sudska-praksa/`, `/en/case-law/`) are SEO-canonical — Google can index both language versions separately
- `react-i18next` lazy-loads the translation namespace only when needed — no performance cost for loading both `hr.json` and `en.json` on every page
- Payload locale fallback means the site remains fully functional even when English translations are incomplete (BLK-4 — translation status unknown)
- The `LanguageSwitch` component swaps the URL prefix, triggering a React Router navigation — no page reload; SPA language switch is instant

**Negative / Risks:**
- Croatian characters (č, ć, đ, š, ž) must be correctly encoded in all `hr.json` translation keys — translators must use UTF-8
- The URL structure means all routes need both `hr` and `en` variants in the React Router config — handled by a top-level `/:lang/*` wildcard route that resolves the locale and then renders the correct page
- If Dražen wants different URL slugs in English (e.g., `/en/case-law/` vs `/hr/sudska-praksa/`), that adds complexity; currently both locales use the Croatian path slugs for simplicity — can be revisited post-launch
