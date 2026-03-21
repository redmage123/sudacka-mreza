/**
 * GET /api/jurisdiction?lat=45.815&lng=15.981
 *
 * Given a geographic coordinate (WGS84 decimal degrees), returns the
 * jurisdiction name and responsible court for that location (FR-014).
 *
 * This endpoint depends on a GeoJSON file containing Croatian court jurisdiction
 * polygons. The file path is configurable via JURISDICTION_GEOJSON_PATH env var;
 * it defaults to `<cwd>/data/jurisdictions.geojson`.
 *
 * GeoJSON feature properties must include:
 *   jurisdictionName  – human-readable jurisdiction name (string)
 *   courtId           – Payload court document UUID (optional)
 *   courtSlug         – court slug for lookup if no courtId (optional)
 *
 * NOTE: The jurisdiction GeoJSON file is a client-provided dependency (D5 in
 * the spec). This endpoint returns 503 if the file is not present.
 *
 * Query params:
 *   lat   – latitude in decimal degrees (required)
 *   lng   – longitude in decimal degrees (required)
 */

import { Router, Request, Response } from 'express'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface JurisdictionProperties {
  jurisdictionName: string
  courtId?: string
  courtSlug?: string
}

interface JurisdictionFeature {
  type: 'Feature'
  properties: JurisdictionProperties
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

// ---------------------------------------------------------------------------
// Point-in-polygon: ray-casting algorithm
// point: [longitude, latitude] — GeoJSON uses [lng, lat] order
// ring:  outer ring of a Polygon as [[lng, lat], ...]
// ---------------------------------------------------------------------------
function pointInRing(point: [number, number], ring: number[][]): boolean {
  const [px, py] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const cross = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (cross) inside = !inside
  }
  return inside
}

function pointInFeature(lng: number, lat: number, feature: JurisdictionFeature): boolean {
  const point: [number, number] = [lng, lat]
  const { type, coordinates } = feature.geometry

  if (type === 'Polygon') {
    // coordinates[0] is the outer ring
    return pointInRing(point, (coordinates as number[][][])[0])
  }

  if (type === 'MultiPolygon') {
    // Each element is a polygon (array of rings); check outer ring of each
    return (coordinates as number[][][][]).some((polygon) =>
      pointInRing(point, polygon[0]),
    )
  }

  return false
}

// ---------------------------------------------------------------------------
// Router factory — receives the payload instance for court lookups
// ---------------------------------------------------------------------------
export function createJurisdictionRouter(payload: any) {
  const router = Router()

  // GeoJSON features cached after first successful load
  let features: JurisdictionFeature[] | null = null
  let loadError: string | null = null

  function ensureLoaded(): void {
    if (features !== null || loadError !== null) return

    const geojsonPath =
      process.env.JURISDICTION_GEOJSON_PATH ?? join(process.cwd(), 'data', 'jurisdictions.geojson')

    if (!existsSync(geojsonPath)) {
      loadError =
        `GeoJSON file not found at "${geojsonPath}". ` +
        'Set JURISDICTION_GEOJSON_PATH or place the file at data/jurisdictions.geojson. ' +
        'This file is a client-provided dependency (spec D5).'
      payload.logger.warn(loadError)
      return
    }

    try {
      const raw = readFileSync(geojsonPath, 'utf-8')
      const parsed = JSON.parse(raw) as { features: JurisdictionFeature[] }
      features = parsed.features
      payload.logger.info(`Jurisdiction: loaded ${features.length} polygons from ${geojsonPath}`)
    } catch (err) {
      loadError = `Failed to parse jurisdiction GeoJSON: ${err}`
      payload.logger.error(loadError)
    }
  }

  router.get('/jurisdiction', async (req: Request, res: Response) => {
    ensureLoaded()

    if (loadError) {
      return res.status(503).json({
        error: 'Jurisdiction data not available',
        detail: loadError,
      })
    }

    if (!features) {
      return res.status(503).json({ error: 'Jurisdiction data failed to load' })
    }

    const lat = parseFloat(String(req.query.lat ?? ''))
    const lng = parseFloat(String(req.query.lng ?? ''))

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(422).json({
        error: 'Query params lat and lng are required (decimal degrees, e.g. lat=45.815&lng=15.981)',
      })
    }

    // Rough bounding box for Croatia
    if (lat < 42.0 || lat > 47.0 || lng < 13.5 || lng > 19.5) {
      return res.status(422).json({
        error: 'Coordinates appear to be outside Croatian territory',
      })
    }

    const match = features.find((f) => pointInFeature(lng, lat, f))

    if (!match) {
      return res.status(404).json({
        error: 'No jurisdiction found for the given coordinates',
      })
    }

    const { jurisdictionName, courtId, courtSlug } = match.properties

    // Enrich with court data from Payload CMS
    let court: any = null
    if (courtId) {
      try {
        court = await payload.findByID({ collection: 'courts', id: courtId })
      } catch {
        // Court not found or deleted — continue with jurisdiction name only
      }
    } else if (courtSlug) {
      try {
        const result = await payload.find({
          collection: 'courts',
          where: { slug: { equals: courtSlug } },
          limit: 1,
        })
        court = result.docs[0] ?? null
      } catch {
        // Ignore
      }
    }

    return res.json({
      jurisdictionName,
      court: court
        ? {
            id: court.id,
            name: court.name_hr,
            slug: court.slug,
            address: court.address ?? null,
            phone: court.phone ?? null,
            website: court.website ?? null,
          }
        : null,
    })
  })

  return router
}
