# ADR-0001: Backend Language — TypeScript
## Status: Accepted
## Date: 2026-03-21
## Decider: Chris Novak (CTO)

---

## Context

The project requires a backend language for the CMS server (Payload CMS), custom API endpoints (contact form, global search, sitemap generation), and data migration scripts. The owner specified TypeScript.

This is a long-lived civic platform that will be handed off to non-GigForge developers and maintained for years. The language choice affects onboarding time, the robustness of the integration between frontend and backend, and the long-term maintainability of the codebase.

---

## Decision

**TypeScript 5.4** for both the CMS service (`cms/`) and all tooling/migration scripts.

The frontend (`web/`) is also TypeScript. This means the entire codebase is TypeScript, enabling:
- Shared types between frontend and backend via Payload's `payload generate:types` command
- A single language to learn for any future developer
- Compile-time catching of integration bugs (wrong field names, missing required fields)

---

## Alternatives Considered

**Python (FastAPI)**
- Pros: Excellent for data science/migration scripts; fast to write; excellent for PostgreSQL work
- Cons: Requires context-switching between Python backend and TypeScript frontend; Payload CMS is Node.js/TypeScript — using Python would mean building the CMS replacement from scratch; migration scripts in Python are fine but the team would maintain two language runtimes
- Rejected: Would fragment the codebase; Payload CMS requirement makes Node.js the natural choice

**Plain JavaScript (no TypeScript)**
- Pros: Slightly less setup; no `tsc` step
- Cons: No type safety; Payload CMS is designed and documented for TypeScript; `payload generate:types` only makes sense with TypeScript; no IDE auto-complete for Payload collections
- Rejected: Type safety is non-negotiable for a multi-year civic platform

**Go**
- Pros: Fast, excellent HTTP performance, strong typing
- Cons: No Payload CMS equivalent in Go; would require building the entire CMS from scratch; no Go developer on the team; complete mismatch with the React frontend ecosystem
- Rejected: Incompatible with the Payload CMS requirement

---

## Consequences

**Positive:**
- Single language across the full stack — any developer can work in any part of the codebase
- `payload generate:types` keeps frontend and backend types in sync automatically
- TypeScript strict mode catches bugs at compile time rather than runtime
- Extensive ecosystem of TypeScript-native libraries (Zod, tRPC, etc.)

**Negative:**
- TypeScript compilation step required (mitigated by `tsx` for dev, compiled to JS for production)
- `tsconfig.json` maintenance overhead (mitigated by sharing config between web and cms)
- TypeScript strict mode can be verbose for simple scripts (mitigated by using `tsx` for quick one-off scripts)

**Risk:**
- Payload CMS TypeScript API has changed significantly between v2 and v3. Engineers must use v3 docs exclusively. No copy-pasting from v2 examples.
