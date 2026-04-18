# Sprint 3 Handoff — Feature Pages + API Client
**Date:** 2026-03-21
**From:** gigforge-engineer (code review)
**To:** gigforge-qa / gigforge-advocate

## What Was Delivered

Sprint 3 is complete. All deliverables were implemented from scratch (the driver had not started).

### Files Created
- `web/src/api/client.ts` — base fetch wrapper with ApiError and Zod validation
- `web/src/api/types.ts` — Zod schemas for all 5 collection types
- `web/src/api/court-decisions.ts` — searchDecisions + getCourts_forFilter
- `web/src/api/expert-witnesses.ts` — getExpertWitnesses
- `web/src/api/interpreters.ts` — getInterpreters
- `web/src/api/courts.ts` — getCourts + getCourt
- `web/src/api/news.ts` — getNewsPosts
- `web/src/api/search.ts` — globalSearch (stub with early-return for empty query)
- `web/src/api/__tests__/` — 6 test files
- `web/src/utils/counties.ts` — 21 Croatian counties static list
- `web/src/utils/dates.ts` — formatDate utility
- `web/src/pages/__tests__/` — 5 page test files

### Files Replaced (stubs → implementations)
- `web/src/pages/HomePage.tsx`
- `web/src/pages/decisions/DecisionsSearchPage.tsx`
- `web/src/pages/experts/ExpertsPage.tsx`
- `web/src/pages/experts/InterpretersPage.tsx`
- `web/src/pages/courts/CourtsPage.tsx`

### Files Modified
- `web/src/i18n/locales/hr/common.json` — added all Sprint 3 keys
- `web/src/i18n/locales/en/common.json` — added all Sprint 3 keys
- `web/package.json` — added `zod` dependency (was missing)

## Critical Fix Applied (G-09)
The task brief listed Court type enum values as `opcinski/zupanijski/trgovacki/prekrsajni`.
The ACTUAL values in `cms/src/collections/Courts.ts` are `municipal/county/commercial/misdemeanour`.
The implementation uses the correct CMS values. Tabs display HR labels via i18n keys.

## Test Results
- `tsc --noEmit`: 0 errors
- `vitest run`: 193/193 passing
- Coverage on in-scope files: all ≥ 80% individually

## Blockers / Known Issues
- `web/src/api/search.ts` has 0% coverage (no test required per brief — stub only)
- `act()` warnings in HomePage test are non-fatal (React async state update warnings in test env)
- Playwright screenshots not taken (app not running in review environment)

## Next Sprint
Sprint 4: Detail pages (DecisionDetailPage, ExpertDetailPage, CourtDetailPage) + VTS/ESLJP filtered views
