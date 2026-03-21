# ADR-0010: Styling — Tailwind CSS 4
## Status: Accepted
## Date: 2026-03-21
## Decider: Chris Novak (CTO)

---

## Context

The platform needs a design system and styling approach that:
- Enables rapid development of a mobile-first, responsive layout
- Supports a specific design language (navy/blue/gold palette, Inter + Source Serif 4 typography)
- Has first-class dark mode support
- Is maintainable by Croatian developers who may not be design-focused
- Is accessible by default (sufficient contrast, focus indicators)

The owner specified Tailwind CSS 4.

---

## Decision

**Tailwind CSS 4** with CSS-first configuration.

Tailwind 4 introduces a new CSS-first configuration approach: design tokens are defined in `web/src/styles/globals.css` using `@theme` directives instead of `tailwind.config.js`. This is strictly better for this project because:
- Design tokens are visible in a standard CSS file, readable by any developer
- No JavaScript configuration file to maintain
- CSS custom properties are automatically generated from `@theme` tokens and usable in raw CSS if needed

**Typography:** `@tailwindcss/typography` plugin provides the `prose` class for legal document body text (court decisions, laws). Critical: `prose` must be customised to use `Source Serif 4` and the project's colour tokens, not Tailwind's defaults.

**Dark mode:** Implemented via a `.dark` class on `<html>` (not `prefers-color-scheme` media query alone) so the `useDarkMode` hook can toggle it manually. `@theme` tokens are overridden in `.dark {}` blocks.

**Component abstractions:** A small set of reusable components (`Button`, `Card`, `Badge`, `Modal`, etc.) are built with Tailwind utility classes internally but exposed as React components with typed props. This prevents utility class sprawl in page components. No CSS-in-JS, no CSS modules.

---

## Alternatives Considered

**Tailwind CSS 3 (stable)**
- Pros: More stable; more Stack Overflow answers; all ecosystem plugins work
- Cons: Owner specified v4; v4's CSS-first config is the right approach for this project; v3 is now in maintenance mode
- Rejected: Owner specified v4

**CSS Modules**
- Each component has a `.module.css` file with local class names
- Pros: True CSS encapsulation; no utility class sprawl; standard
- Cons: Slow to write; requires context-switching between CSS and JSX files; dark mode requires CSS variables + complex specificity; harder to build consistent responsive design quickly
- Rejected: Tailwind is significantly faster for a project of this scope and timeline

**Styled-Components / Emotion (CSS-in-JS)**
- Pros: Colocated styles with components; dynamic styles based on props
- Cons: Runtime CSS generation (performance cost); SSR/SSG complications; large bundle size; the team is more familiar with Tailwind; TypeScript types for styled-components are verbose
- Rejected: Performance and SSG complexity concerns

**Material UI / Chakra UI / shadcn/ui (component library)**
- Pre-built component libraries
- Pros: Fast initial development; accessible components out of the box
- Cons: MUI/Chakra impose their own design language that would fight with the navy/gold design system; shadcn/ui is Tailwind-based but generates component files in the project (which is fine), however it adds Radix UI dependencies and a specific component API; the custom design requirements make a design system built on top of Tailwind more appropriate
- Partially adopted: Some patterns from shadcn/ui (accessible component patterns, Radix UI primitives for Modal/Dialog) can be used selectively, but the base UI components (`Button`, `Card`, etc.) are hand-built with Tailwind

---

## Consequences

**Positive:**
- Mobile-first responsive design is trivial with Tailwind's breakpoint utilities (`sm:`, `md:`, `lg:`)
- Dark mode is a CSS class toggle — no duplicate component trees needed
- Tailwind's JIT compiler only generates CSS for classes that are actually used — minimal CSS bundle size
- Consistent spacing/sizing scale prevents "magic numbers" in CSS

**Negative:**
- Tailwind 4 is newer — some community plugins have not yet updated to v4's CSS-first config
- Long utility class strings in JSX are hard to read without IDE extensions (Tailwind IntelliSense + Prettier Tailwind plugin are **mandatory** developer setup)
- The `prose` class requires careful customisation to match the navy/gold design system — default Tailwind typography colours will need overriding

**Risk:**
- Tailwind 4's `@theme` syntax is new and not all AI coding assistants or Stack Overflow answers reflect it yet. Engineers MUST use Tailwind v4 docs, not v3. Pay particular attention: `tailwind.config.js` does not exist in v4; `@apply` still works but is discouraged in v4 in favour of utility classes in JSX.
