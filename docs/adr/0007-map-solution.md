# ADR-0007: Interactive Map Solution (Replacing Flash Jurisdiction Finder)

## Status: Accepted

## Context

The existing Jurisdiction Finder is implemented using Adobe Flash (via SWFObject.js).
Adobe Flash reached End of Life on 31 December 2020. All major browsers (Chrome,
Firefox, Safari, Edge) have removed Flash support entirely. The Jurisdiction Finder is
completely non-functional on every modern browser — identified as Critical issue #1 in
SPEC §1.6 (alongside the malicious ad injection and missing HTTPS).

The replacement must:
1. Be interactive — users click a Croatian county/region and see the responsible court
2. Work on all modern browsers including mobile (touch events)
3. Require no paid API key (pro-bono non-profit engagement)
4. Be accessible (keyboard navigable, screen reader compatible via ARIA)
5. Display Croatian administrative boundaries accurately
6. Also support single map pins on individual Court detail pages
7. Load entirely client-side; no server-side tile rendering dependency

## Decision

**Leaflet.js 1.9 + react-leaflet 4 + OpenStreetMap base tiles + GADM Level-2 GeoJSON**

- `leaflet@1.9` and `react-leaflet@4` provide the interactive map React component
- OpenStreetMap tile server provides the base map at zero cost, no API key required
- Croatian county boundaries sourced from GADM (Global Administrative Areas) — public
  domain data; Level 2 for Croatia yields 21 counties (županije)
- The GeoJSON file (`croatia-counties.geojson`) is committed to
  `web/src/assets/croatia-counties.geojson` — no runtime external dependency beyond tiles
- County polygons rendered as a choropleth layer; click on a county → popup with the
  responsible court's name, address, and phone number
- Court detail pages (`/sudovi/:id`) show a single Leaflet marker pin using the
  `{lat, lng}` geolocation stored in the `courts` Payload collection

The `JurisdictionMapPage` component at `/sudovi/nadleznost/` fills the viewport with the
map. A county-to-court mapping is maintained in a static JSON lookup table alongside the
GeoJSON file, updated by content editors if court jurisdiction boundaries change.

## Alternatives Considered

**Google Maps JavaScript API**
- Requires an API key with billing enabled. Free tier is limited and requires a credit card.
  Not appropriate for a Croatian non-profit legal platform. Also sends user location data
  to Google, which has GDPR implications. Rejected.

**Mapbox GL JS**
- Free tier exists but requires account creation and an access token managed as a secret.
  Token rotation adds operational complexity. Mapbox tiles are commercial. Rejected.

**HERE Maps / TomTom Maps API**
- Commercial products requiring API keys and billing. Same concerns as Google Maps. Rejected.

**OpenLayers**
- A valid open-source alternative to Leaflet. OpenLayers is more powerful for complex
  cartographic projections but has a steeper API surface. react-leaflet has more React
  integrations, examples, and a more natural API for the choropleth + popup pattern.
  Leaflet's bundle size (42 KB gzipped) is also smaller than OpenLayers (87 KB). Rejected.

**D3.js choropleth**
- D3 is powerful for custom data visualisations and could render a choropleth from
  GeoJSON. However, D3 (90 KB gzipped) is heavier than Leaflet, has a significantly
  steeper learning curve, and would require custom pan/zoom implementation. The
  court detail single-pin use case would also require a separate Leaflet instance anyway.
  Using a single map library for both use cases is cleaner. Rejected.

**SVG static map with click handlers**
- A static SVG of Croatia's 21 counties with click handlers would work without any
  library dependency, but provides no pan/zoom, no base tiles for geographic context,
  and is difficult to maintain when county boundaries or court assignments change.
  Accessibility would require extensive manual ARIA work that Leaflet handles
  automatically. Rejected.

**Maplibre GL JS (open-source Mapbox fork)**
- Technically capable and free. However, react-maplibre integration is less mature than
  react-leaflet, and WebGL rendering (used by Maplibre) has higher device requirements
  than Leaflet's Canvas/SVG rendering — a concern for older devices used by judges and
  court administrators. Rejected.

## Consequences

**Positive:**
- Leaflet + OpenStreetMap is completely free — zero ongoing cost for tiles at this
  traffic level (OSM fair-use policy permits the expected volume for a national legal
  information site)
- GeoJSON committed to the repository means the map polygon logic works in Docker dev
  even without internet (tiles won't load offline but polygon click handlers work)
- `react-leaflet`'s `<GeoJSON>` component renders all 21 county polygons with
  `onEachFeature` click handlers in ~50 lines of React code
- GADM data resolves the BLK-2 blocker immediately — no dependency on Dražen providing
  official boundary shapefiles (though official data can replace GADM post-launch)
- Leaflet is keyboard-accessible via Tab + Enter; popup content can be fully annotated
  with ARIA labels for screen readers
- Both choropleth (jurisdiction page) and single-pin (court detail) use the same
  library — one import, one bundle chunk

**Negative / Risks:**
- OpenStreetMap attribution (`© OpenStreetMap contributors`) is required by the OSM
  tile usage policy — handled automatically by Leaflet's built-in attribution control
- GADM Level-2 boundaries are administrative counties (županije), not legal court
  jurisdictions. The two mostly align but edge cases exist (split municipalities). If
  Dražen provides official GeoJSON (BLK-2), it should replace GADM data
- Leaflet has known SSR/hydration issues — not relevant here (pure Vite SPA,
  client-side only, no SSR)
- `react-leaflet` requires the Leaflet CSS to be imported manually; the engineer must
  add `import 'leaflet/dist/leaflet.css'` in the map component or globals to avoid
  missing map controls
- Mobile touch: polygon click can misfire on very small screen sizes with Leaflet.
  Must be tested on real iOS and Android devices in Sprint 7 (T7-9)
- The default Leaflet marker icon uses image URLs that break when bundled through Vite;
  the engineer must apply the standard Vite/webpack Leaflet icon fix
  (reassign `L.Icon.Default.prototype._getIconUrl`)
