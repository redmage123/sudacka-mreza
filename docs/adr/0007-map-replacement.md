# ADR-0007: Flash Map Replacement (Jurisdiction Finder)
## Status: Accepted
## Date: 2026-03-21

## Context

The existing Jurisdiction Finder is implemented using Adobe Flash (via SWFObject.js). Adobe Flash reached End of Life on 31 December 2020. All major browsers (Chrome, Firefox, Safari, Edge) have removed Flash support. The Jurisdiction Finder is completely non-functional on every modern browser — identified as Critical issue #1 in SPEC §1.6.

The replacement must:
1. Be interactive — users click a Croatian county/region and see the responsible court
2. Work on all modern browsers (including mobile)
3. Require no paid API key (this is a pro-bono engagement)
4. Be accessible (keyboard navigable, screen reader compatible)
5. Display Croatian administrative boundaries accurately
6. Optionally show single map pins on Court detail pages

## Decision

**Leaflet.js + react-leaflet + OpenStreetMap tiles + GADM GeoJSON boundaries.**

- `leaflet@1` and `react-leaflet@4` provide the interactive map component
- OpenStreetMap tile server (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) provides the base map with no API key
- Croatian county boundaries sourced from GADM (Global Administrative Areas database) — public domain, level-2 for Croatia gives 21 counties
- The GeoJSON file is committed to `web/src/assets/croatia-counties.geojson` — no runtime external dependency
- County polygons are rendered as a choropleth layer; click → popup with responsible court name, address, and phone
- Court detail pages use a single Leaflet map pin from the `lat`/`lng` stored in the `courts` Payload collection

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Google Maps JavaScript API** | Requires an API key with billing enabled. Any commercial use beyond the free tier incurs cost. Not appropriate for a non-profit pro-bono project. Also has GDPR implications (data sent to Google). |
| **Mapbox GL JS** | Free tier exists but requires account registration and an access token. Token management adds operational complexity. Mapbox tiles are commercial. |
| **HERE Maps** | Commercial; requires API key and billing. Same concerns as Google Maps. |
| **OpenLayers** | A valid open-source alternative to Leaflet. Rejected because react-leaflet has significantly more React integrations, examples, and a more intuitive API for the choropleth + popup pattern needed here. Learning curve for the team is lower with Leaflet. |
| **SVG-based static map** | A static SVG of Croatian counties with click handlers would work but provides no pan/zoom, no base map tiles, and is harder to maintain when county boundaries change. |
| **D3.js choropleth** | D3 is powerful for data visualisation but heavy (90 KB gzipped) relative to Leaflet (42 KB) for what is essentially an interactive map with popups. Overkill. |
| **Rebuilding Flash functionality** | Flash is dead. There is no path forward with Flash. |

## Consequences

**Positive:**
- Leaflet + OpenStreetMap is completely free and requires no API key — zero ongoing cost for the non-profit client
- GeoJSON committed to the repository means the map works offline and in Docker development without internet access to external tile servers (tiles won't load without internet but the polygon logic works)
- react-leaflet's `GeoJSON` component renders all 21 Croatian county polygons with click handlers in ~30 lines of code
- GADM data is freely available for non-commercial use — covers the BLK-2 blocker (client doesn't need to provide boundary data)
- Leaflet is keyboard-accessible via the Tab key + Enter to activate features; aria-label attributes can be added to popups for screen readers

**Negative / Risks:**
- OpenStreetMap usage policy requires attribution (`© OpenStreetMap contributors`) — this is handled by Leaflet's default attribution control
- GADM boundaries may not perfectly match the legal jurisdictions used by Croatian courts — if Dražen provides official GeoJSON (BLK-2 unblocked), it should replace the GADM data
- Leaflet has some known SSR/hydration issues in Next.js; not relevant here (pure client-side SPA with Vite)
- Mobile touch performance for polygon click is good in Leaflet but has been known to misfire on very small screen sizes — must be tested on real devices in Sprint 7
