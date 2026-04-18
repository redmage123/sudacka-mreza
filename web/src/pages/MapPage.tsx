import { useEffect, useRef, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, Link } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { apiFetch } from '@/api/client'
import { PayloadListSchema, CourtSchema, type Court } from '@/api/types'

// Fix Leaflet default icon
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

type CourtFilterType = 'all' | 'municipal' | 'county' | 'commercial' | 'misdemeanour' | 'administrative'

const COURT_COLORS: Record<string, string> = {
  municipal: '#3b82f6',
  county: '#8b5cf6',
  commercial: '#22c55e',
  misdemeanour: '#f97316',
  administrative: '#ef4444',
}

function makeIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  })
}

const FILTER_TYPES: Array<{ value: CourtFilterType; labelKey: string }> = [
  { value: 'all', labelKey: 'map.filterAll' },
  { value: 'municipal', labelKey: 'map.filterMunicipal' },
  { value: 'county', labelKey: 'map.filterCounty' },
  { value: 'commercial', labelKey: 'map.filterCommercial' },
  { value: 'misdemeanour', labelKey: 'map.filterMisdemeanour' },
  { value: 'administrative', labelKey: 'map.filterAdministrative' },
]

const LEGEND_KEYS: Record<string, string> = {
  municipal: 'map.filterMunicipal',
  county: 'map.filterCounty',
  commercial: 'map.filterCommercial',
  misdemeanour: 'map.filterMisdemeanour',
  administrative: 'map.filterAdministrative',
}

function InvalidateSize() {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100)
  }, [map])
  return null
}

export default function MapPage() {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('map')

  const [courts, setCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<CourtFilterType>('all')
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(false)
    apiFetch('/courts', PayloadListSchema(CourtSchema), {
      params: { limit: 400, depth: 0 },
    })
      .then((data) => {
        if (isMounted.current) {
          setCourts(data.docs)
          setLoading(false)
        }
      })
      .catch(() => {
        if (isMounted.current) {
          setError(true)
          setLoading(false)
        }
      })
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return courts
    return courts.filter((c) => c.type === filter)
  }, [courts, filter])

  const markersWithCoords = useMemo(
    () => filtered.filter((c) => c.geolocation?.lat && c.geolocation?.lng),
    [filtered],
  )

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('map.title') },
        ]}
        className="mb-6"
      />

      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] mb-2">
        {t('map.title')}
      </h1>

      {loading && (
        <div className="space-y-3 mt-6">
          <Skeleton height="h-[600px]" />
        </div>
      )}

      {!loading && error && (
        <Alert variant="error" className="mt-6">{t('map.error')}</Alert>
      )}

      {!loading && !error && (
        <>
          {/* Filter buttons */}
          <div className="flex flex-wrap gap-2 my-4">
            {FILTER_TYPES.map((ft) => (
              <button
                key={ft.value}
                onClick={() => setFilter(ft.value)}
                className={[
                  'px-3 py-1.5 text-sm rounded-full border transition-colors',
                  filter === ft.value
                    ? 'bg-[color:var(--color-primary)] text-white border-[color:var(--color-primary)]'
                    : 'border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]',
                ].join(' ')}
              >
                {ft.value !== 'all' && (
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
                    style={{ backgroundColor: COURT_COLORS[ft.value] }}
                  />
                )}
                {t(ft.labelKey)}
              </button>
            ))}
          </div>

          {/* Map */}
          <div className="rounded-lg overflow-hidden border border-[color:var(--color-border)]" style={{ minHeight: 600 }}>
            <MapContainer
              center={[45.1, 16.0]}
              zoom={7}
              style={{ height: 600, width: '100%' }}
              scrollWheelZoom={true}
            >
              <InvalidateSize />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {markersWithCoords.map((court) => {
                const color = COURT_COLORS[court.type ?? ''] ?? '#6b7280'
                return (
                  <Marker
                    key={court.id}
                    position={[court.geolocation!.lat, court.geolocation!.lng]}
                    icon={makeIcon(color)}
                  >
                    <Popup>
                      <div className="text-sm min-w-[180px]">
                        <p className="font-semibold mb-1">{court.name}</p>
                        {court.type && (
                          <p className="text-gray-500 text-xs mt-1 capitalize">
                            {t(LEGEND_KEYS[court.type] ?? `map.filter${court.type.charAt(0).toUpperCase()}${court.type.slice(1)}`)}
                          </p>
                        )}
                        {court.address && <p className="mt-1 text-xs text-gray-600">{court.address}</p>}
                        {court.phone && <p className="text-xs text-gray-600">{court.phone}</p>}
                        <Link
                          to={`/${locale}/sudovi/${court.id}`}
                          className="block mt-2 text-xs text-blue-600 hover:underline"
                        >
                          {t('map.viewDetails')} →
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-[color:var(--color-text-muted)]">
            <span className="font-medium text-[color:var(--color-heading)]">{t('map.legend')}:</span>
            {Object.entries(COURT_COLORS).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {t(`map.courtType.${type}`)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
