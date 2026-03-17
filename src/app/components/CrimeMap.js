'use client'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMapEvents, useMap } from 'react-leaflet'
import { useState, useEffect } from 'react'
import L from 'leaflet'
import proj4 from 'proj4'
import 'proj4leaflet'
import { mapCache } from '@/hooks/useMapCache'

const YANDEX_API_KEY = process.env.NEXT_PUBLIC_YANDEX_API_KEY

const SEVERITY_OPTIONS = [
  { value: 'heavy',  label: 'Тяжкие',    color: '#dc2626' },
  { value: 'medium', label: 'Средние',   color: '#ea580c' },
  { value: 'light',  label: 'Небольшие', color: '#16a34a' },
]

const crs = new L.Proj.CRS(
  'EPSG:3395',
  '+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
  {
    origin: [-20037508.342789, 20037508.342789],
    resolutions: [
      156543.03392804097, 78271.51696402048, 39135.75848201024,
      19567.87924100512,  9783.93962050256,  4891.96981025128,
      2445.98490512564,   1222.99245256282,  611.49622628141,
      305.748113140705,   152.8740565703525, 76.43702828517625,
      38.21851414258813,  19.109257071294063,9.554628535647032,
      4.777314267823516,  2.388657133911758, 1.194328566955879,
      0.597164283477939,  0.298582141738970, 0.149291070869485,
    ],
  }
)

const getSeverityColor = (hardCode) => {
  if (!hardCode) return '#6b7280'
  const h = hardCode.toLowerCase()
  if (h.startsWith('тяжкие'))            return '#dc2626'
  if (h.startsWith('средней тяжести'))   return '#ea580c'
  if (h.startsWith('небольшой тяжести')) return '#16a34a'
  return '#6b7280'
}

const createClusterDivIcon = (count) => {
  const size = count > 10000 ? 56 : count > 1000 ? 48 : count > 100 ? 40 : 34
  const fontSize = count > 9999 ? 10 : count > 999 ? 12 : 14
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:#2563eb;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;">${count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

const createCrimeDivIcon = (hardCode) => {
  const color = getSeverityColor(hardCode)
  return L.divIcon({
    html: `<div style="width:12px;height:12px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    className: '',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

const getDistrictStyle = (feature, selectedDistricts) => {
  const nameRu = feature.properties?.nameRu || ''
  const isSelected = selectedDistricts.some(d =>
    nameRu.toLowerCase().includes(d.toLowerCase()) ||
    d.toLowerCase().includes(nameRu.toLowerCase())
  )
  return {
    color: isSelected ? '#dc2626' : '#9ca3af',
    weight: isSelected ? 3 : 1.5,
    opacity: isSelected ? 1 : 0.8,
    fillColor: isSelected ? '#dc2626' : 'transparent',
    fillOpacity: isSelected ? 0.08 : 0,
    interactive: false,
  }
}

function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (target === 0) { setValue(0); return }
    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      // easeOut
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress >= 1) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [target])
  return value
}

function StatCard({ label, color, count }) {
  const animated = useCountUp(count)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', borderRadius: 8, marginBottom: 6,
      background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: '#374151' }}>{label}</span>
      </div>
      <span style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
        {animated.toLocaleString('ru')}
      </span>
    </div>
  )
}

function Legend({ filters }) {
  const [stats, setStats] = useState({ heavy: 0, medium: 0, light: 0 })

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.years.length)     params.set('years',     filters.years.join(','))
    if (filters.districts.length) params.set('districts', filters.districts.join(','))
    fetch(`http://127.0.0.1:8000/api/map/stats?${params}`)
      .then(r => r.json())
      .then(data => setStats(data))
  }, [filters.years, filters.districts])

  return (
    <div style={{
      position: 'absolute', bottom: 24, right: 16, zIndex: 1000,
      width: 240, padding: '12px',
      background: 'rgba(255,255,255,0.95)', borderRadius: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Статистика преступлений
      </div>
      <StatCard label="Тяжкие"           color="#dc2626" count={stats.heavy}  />
      <StatCard label="Средней тяжести"  color="#ea580c" count={stats.medium} />
      <StatCard label="Небольшой тяжести" color="#16a34a" count={stats.light}  />
    </div>
  )
}

function Sidebar({ filters, setFilters, options, isOpen, setIsOpen }) {
  const toggle = (key, value) => {
    setFilters(prev => {
      const arr = prev[key]
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }
  const resetAll = () => setFilters({ years: [], severity: [], districts: [] })
  const activeCount = filters.years.length + filters.severity.length + filters.districts.length

  return (
    <>
      <button onClick={() => setIsOpen(o => !o)} style={{
        position: 'absolute', top: 16, left: isOpen ? 316 : 16, zIndex: 1002,
        background: 'white', border: 'none', borderRadius: 8, padding: '8px 14px',
        cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14,
        transition: 'left 0.3s ease',
      }}>
        ⚙️ Фильтры
        {activeCount > 0 && (
          <span style={{
            background: '#dc2626', color: 'white', borderRadius: '50%',
            width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
          }}>{activeCount}</span>
        )}
      </button>

      <div style={{
        position: 'absolute', top: 0, left: isOpen ? 0 : -300, width: 300, height: '100%',
        zIndex: 1001, background: 'white', color: '#111',
        boxShadow: '2px 0 12px rgba(0,0,0,0.15)', transition: 'left 0.3s ease',
        overflowY: 'auto', padding: 20, boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Фильтры</h2>
          {activeCount > 0 && (
            <button onClick={resetAll} style={{
              background: 'none', border: '1px solid #dc2626', color: '#dc2626',
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
            }}>Сбросить всё</button>
          )}
        </div>

        <Section title="📅 Год">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {options.years.map(year => (
              <Chip key={year} label={year} active={filters.years.includes(String(year))} onClick={() => toggle('years', String(year))} />
            ))}
          </div>
        </Section>

        <Section title="⚖️ Тяжесть">
          {SEVERITY_OPTIONS.map(s => (
            <div key={s.value} onClick={() => toggle('severity', s.value)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderRadius: 8, cursor: 'pointer', marginBottom: 4,
              background: filters.severity.includes(s.value) ? '#eff6ff' : 'transparent',
              border: `1px solid ${filters.severity.includes(s.value) ? '#2563eb' : 'transparent'}`,
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>{s.label}</span>
            </div>
          ))}
        </Section>

        <Section title="📍 Район">
          {options.districts.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Загрузка...</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {options.districts.map(d => (
                <Chip key={d} label={d} active={filters.districts.includes(d)} onClick={() => toggle('districts', d)} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Chip({ label, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
      background: active ? '#2563eb' : '#f3f4f6',
      color: active ? 'white' : '#111111',
      border: `1px solid ${active ? '#2563eb' : '#e5e7eb'}`,
      userSelect: 'none',
    }}>{label}</div>
  )
}

function buildUrl(bounds, zoom, filters) {
  const { _northEast: ne, _southWest: sw } = bounds
  const params = new URLSearchParams({ north: ne.lat, south: sw.lat, east: ne.lng, west: sw.lng, zoom })
  if (filters.years.length)     params.set('years',     filters.years.join(','))
  if (filters.severity.length)  params.set('severity',  filters.severity.join(','))
  if (filters.districts.length) params.set('districts', filters.districts.join(','))
  return `http://127.0.0.1:8000/api/map?${params}`
}

function loadCrimes(map, zoom, filters, setCrimes) {
  const bounds = map.getBounds()
  const cached = mapCache.get(bounds, zoom, filters)
  if (cached) {
    setCrimes(cached)
    return
  }
  fetch(buildUrl(bounds, zoom, filters))
    .then(r => r.json())
    .then(data => {
      mapCache.set(bounds, zoom, filters, data)
      setCrimes(data)
    })
}

function MapEvents({ setCrimes, setZoom, filters }) {
  const map = useMapEvents({
    moveend: fetchData,
    zoomend: fetchData,
  })
  function fetchData() {
    const zoom = map.getZoom()
    setZoom(zoom)
    loadCrimes(map, zoom, filters, setCrimes)
  }
  return null
}

function MapInit({ setCrimes, setZoom, filters }) {
  const map = useMap()
  useEffect(() => {
    const zoom = map.getZoom()
    setZoom(zoom)
    loadCrimes(map, zoom, filters, setCrimes)
  }, [])
  return null
}

function FilterWatcher({ filters, setCrimes, setZoom }) {
  const map = useMap()
  useEffect(() => {
    const zoom = map.getZoom()
    setZoom(zoom)
    loadCrimes(map, zoom, filters, setCrimes)
  }, [filters])
  return null
}

function ClusterMarker({ point }) {
  const map = useMap()
  const lat = Number(point.lat)
  const lng = Number(point.lng)
  if (!isFinite(lat) || !isFinite(lng)) return null
  const handleClick = () => {
    const z = map.getZoom()
    const step = z < 12 ? 4 : z < 14 ? 3 : z < 16 ? 2 : 1
    map.flyTo([lat, lng], Math.min(z + step, 17), { duration: 0.6 })
  }
  return (
    <Marker position={[lat, lng]} icon={createClusterDivIcon(point.count)} eventHandlers={{ click: handleClick }}>
      <Popup>{point.count} преступлений</Popup>
    </Marker>
  )
}

export default function CrimeMap() {
  const [crimes, setCrimes]         = useState([])
  const [zoom, setZoom]             = useState(12)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [filters, setFilters]       = useState({ years: [], severity: [], districts: [] })
  const [options, setOptions]       = useState({ years: [], districts: [] })
  const [districtGeo, setDistrictGeo] = useState(null)  // ← useState внутри компонента

  const isDetailed = zoom >= 17

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/map/filters')
      .then(r => r.json())
      .then(data => setOptions(data))
  }, [])

  // Загрузка GeoJSON границ районов
  useEffect(() => {
    fetch('/almaty-districts.geo.json')
      .then(r => r.json())
      .then(data => setDistrictGeo(data))
      .catch(err => console.warn('GeoJSON не загружен:', err))
  }, [])

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
      <Sidebar filters={filters} setFilters={setFilters} options={options} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <MapContainer
        center={[43.238949, 76.889709]}
        maxZoom={20}
        zoom={12}
        crs={crs}
        style={{ height: '100vh', width: '100%' }}
      >
        <TileLayer
          attribution='© <a href="https://yandex.ru/maps" target="_blank">Яндекс Карты</a>'
          url={`https://tiles.api-maps.yandex.ru/v1/tiles/?x={x}&y={y}&z={z}&lang=ru_RU&l=map&apikey=${YANDEX_API_KEY}`}
          maxZoom={20}
          tileSize={256}
        />

        {/* Границы районов — рендерим под маркерами */}
        {districtGeo && (
          <GeoJSON
            key={filters.districts.join(',')}
            data={districtGeo}
            style={(feature) => getDistrictStyle(feature, filters.districts)}
          />
        )}

        <MapInit setCrimes={setCrimes} setZoom={setZoom} filters={filters} />
        <MapEvents setCrimes={setCrimes} setZoom={setZoom} filters={filters} />
        <FilterWatcher filters={filters} setCrimes={setCrimes} setZoom={setZoom} />

        {crimes.map((point, index) => {
          const lat = Number(point.lat)
          const lng = Number(point.lng)
          if (!isFinite(lat) || !isFinite(lng)) return null
          return isDetailed ? (
            <Marker key={`crime-${index}`} position={[lat, lng]} icon={createCrimeDivIcon(point.hard_code)}>
              <Popup>
                <strong>{point.crime_name || 'Неизвестно'}</strong><br />
                Тяжесть: {point.hard_code ? point.hard_code.replace(/\s*-\s*\d+$/, '') : '—'}<br />
                Год: {point.year || '—'}
              </Popup>
            </Marker>
          ) : (
            <ClusterMarker key={index} point={point} />
          )
        })}

        <Legend filters={filters} />
      </MapContainer>
    </div>
  )
}