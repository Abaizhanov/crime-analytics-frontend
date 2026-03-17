'use client'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import {MapContainer, TileLayer, Marker, Popup, GeoJSON, useMapEvents, useMap} from 'react-leaflet'
import {useState, useEffect} from 'react'
import L from 'leaflet'
import proj4 from 'proj4'
import 'proj4leaflet'
import {mapCache} from '@/hooks/useMapCache'

const YANDEX_API_KEY = process.env.NEXT_PUBLIC_YANDEX_API_KEY

const SEVERITY_OPTIONS = [
  {value: 'heavy', label: 'Тяжкие', color: '#dc2626'},
  {value: 'medium', label: 'Средние', color: '#ea580c'},
  {value: 'light', label: 'Небольшие', color: '#16a34a'},
]

const crs = new L.Proj.CRS(
  'EPSG:3395',
  '+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
  {
    origin: [-20037508.342789, 20037508.342789],
    resolutions: [
      156543.03392804097, 78271.51696402048, 39135.75848201024,
      19567.87924100512, 9783.93962050256, 4891.96981025128,
      2445.98490512564, 1222.99245256282, 611.49622628141,
      305.748113140705, 152.8740565703525, 76.43702828517625,
      38.21851414258813, 19.109257071294063, 9.554628535647032,
      4.777314267823516, 2.388657133911758, 1.194328566955879,
      0.597164283477939, 0.298582141738970, 0.149291070869485,
    ],
  }
)

const getSeverityColor = (hardCode) => {
  if (!hardCode) return '#6b7280'
  const h = hardCode.toLowerCase()
  if (h.startsWith('тяжкие')) return '#dc2626'
  if (h.startsWith('средней тяжести')) return '#ea580c'
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

// SVG иконки
const Icons = {
  filter: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  close: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
         strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  calendar: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  shield: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  mapPin: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  reset: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
         strokeLinecap="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
  ),
}

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(0);
      return
    }
    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      setValue(Math.round(eased * target))
      if (progress >= 1) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [target])
  return value
}

function StatRow({label, color, count}) {
  const animated = useCountUp(count)
  // Форматируем вручную без toLocaleString
  const formatted = animated.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
        <div style={{width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0}}/>
        <span style={{fontSize: 13, color: '#334155', fontWeight: 500, fontFamily: 'system-ui, sans-serif'}}>
          {label}
        </span>
      </div>
      <span style={{
        fontSize: 20,
        fontWeight: 700,
        color,
        fontFamily: '"SF Pro Display", "Segoe UI", system-ui, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.5px',
        lineHeight: 1,
      }}>
        {formatted}
      </span>
    </div>
  )
}

function Legend({filters}) {
  const [stats, setStats] = useState({heavy: 0, medium: 0, light: 0})

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.years.length) params.set('years', filters.years.join(','))
    if (filters.districts.length) params.set('districts', filters.districts.join(','))
    fetch(`http://127.0.0.1:8000/api/map/stats?${params}`)
      .then(r => r.json())
      .then(data => setStats(data))
  }, [filters.years, filters.districts])

  const total = stats.heavy + stats.medium + stats.light

  return (
    <div style={{
      position: 'absolute', bottom: 24, right: 16, zIndex: 1000,
      width: 250,
      background: 'white',
      borderRadius: 14,
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      padding: '14px 16px',
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
        <span
          style={{fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase'}}>
          Статистика
        </span>
        <span style={{fontSize: 12, color: '#475569', fontFamily: 'system-ui, sans-serif'}}>
            Всего: <span style={{color: '#0f172a', fontWeight: 700}}>
           {total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
            </span>
          </span>
      </div>

      {/* Прогресс-бар */}
      {total > 0 && (
        <div style={{display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 2, gap: 2}}>
          <div style={{
            width: `${stats.heavy / total * 100}%`,
            background: '#dc2626',
            borderRadius: 3,
            transition: 'width 0.9s ease'
          }}/>
          <div style={{
            width: `${stats.medium / total * 100}%`,
            background: '#ea580c',
            borderRadius: 3,
            transition: 'width 0.9s ease'
          }}/>
          <div style={{
            width: `${stats.light / total * 100}%`,
            background: '#16a34a',
            borderRadius: 3,
            transition: 'width 0.9s ease'
          }}/>
        </div>
      )}

      <StatRow label="Тяжкие" color="#dc2626" count={stats.heavy}/>
      <StatRow label="Средней тяжести" color="#ea580c" count={stats.medium}/>
      <StatRow label="Небольшой тяжести" color="#16a34a" count={stats.light}/>
    </div>
  )
}

function Sidebar({filters, setFilters, options, isOpen, setIsOpen}) {
  const toggle = (key, value) => {
    setFilters(prev => {
      const arr = prev[key]
      return {...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]}
    })
  }
  const resetAll = () => setFilters({years: [], severity: [], districts: []})
  const activeCount = filters.years.length + filters.severity.length + filters.districts.length

  return (
    <>
      {/* Кнопка открытия/закрытия */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          position: 'absolute',
          top: 16,
          left: isOpen ? 316 : 16,
          zIndex: 1002,
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '9px 14px',
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontWeight: 600,
          fontSize: 13,
          color: '#1e293b',
          transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <span style={{color: '#64748b', display: 'flex'}}>
          {isOpen ? Icons.close : Icons.filter}
        </span>
        {!isOpen && 'Фильтры'}
        {activeCount > 0 && !isOpen && (
          <span style={{
            background: '#dc2626', color: 'white',
            borderRadius: 20, padding: '1px 7px',
            fontSize: 11, fontWeight: 700,
          }}>{activeCount}</span>
        )}
      </button>

      {/* Панель */}
      <div style={{
        position: 'absolute', top: 0, left: isOpen ? 0 : -300,
        width: 300, height: '100%',
        zIndex: 1001,
        background: 'white',
        borderRight: '1px solid #e2e8f0',
        boxShadow: '4px 0 20px rgba(0,0,0,0.08)',
        transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1)',
        overflowY: 'auto',
        padding: '24px 20px',
        boxSizing: 'border-box',
      }}>
        {/* Заголовок */}
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28}}>
          <div>
            <div style={{fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px'}}>
              Фильтры
            </div>
            <div style={{fontSize: 11, color: '#94a3b8', marginTop: 3}}>
              {activeCount > 0 ? `${activeCount} активных` : 'Показаны все данные'}
            </div>
          </div>
          {activeCount > 0 && (
            <button onClick={resetAll} style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}>
              {Icons.reset} Сброс
            </button>
          )}
        </div>

        {/* Год */}
        <Section icon={Icons.calendar} title="Год">
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
            {options.years.map(year => (
              <Chip key={year} label={year} active={filters.years.includes(String(year))}
                    onClick={() => toggle('years', String(year))}/>
            ))}
          </div>
        </Section>

        {/* Тяжесть */}
        <Section icon={Icons.shield} title="Тяжесть">
          <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
            {SEVERITY_OPTIONS.map(s => (
              <div
                key={s.value}
                onClick={() => toggle('severity', s.value)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                  background: filters.severity.includes(s.value) ? `${s.color}0d` : '#f8fafc',
                  border: `1px solid ${filters.severity.includes(s.value) ? `${s.color}40` : '#f1f5f9'}`,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: s.color, flexShrink: 0,
                    boxShadow: filters.severity.includes(s.value) ? `0 0 6px ${s.color}80` : 'none',
                  }}/>
                  <span style={{fontSize: 13, color: '#334155', fontWeight: 500}}>{s.label}</span>
                </div>
                {filters.severity.includes(s.value) && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="3"
                       strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Район */}
        <Section icon={Icons.mapPin} title="Район">
          {options.districts.length === 0 ? (
            <div style={{fontSize: 12, color: '#94a3b8'}}>Загрузка...</div>
          ) : (
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
              {options.districts.map(d => (
                <Chip key={d} label={d} active={filters.districts.includes(d)} onClick={() => toggle('districts', d)}/>
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  )
}

function Section({icon, title, children}) {
  return (
    <div style={{marginBottom: 26}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10}}>
        <span style={{color: '#94a3b8', display: 'flex'}}>{icon}</span>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.08em'
        }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function Chip({label, active, onClick}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '5px 11px',
        borderRadius: 20,
        fontSize: 12,
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        background: active ? '#265adc' : '#f8fafc',
        color: active ? 'white' : '#475569',
        border: `1px solid ${active ? '#265adc' : '#e2e8f0'}`,
        userSelect: 'none',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  )
}

function buildUrl(bounds, zoom, filters) {
  const {_northEast: ne, _southWest: sw} = bounds
  const params = new URLSearchParams({north: ne.lat, south: sw.lat, east: ne.lng, west: sw.lng, zoom})
  if (filters.years.length) params.set('years', filters.years.join(','))
  if (filters.severity.length) params.set('severity', filters.severity.join(','))
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

function MapEvents({setCrimes, setZoom, filters}) {
  const map = useMapEvents({moveend: fetchData, zoomend: fetchData})

  function fetchData() {
    const zoom = map.getZoom()
    setZoom(zoom)
    loadCrimes(map, zoom, filters, setCrimes)
  }

  return null
}

function MapInit({setCrimes, setZoom, filters}) {
  const map = useMap()
  useEffect(() => {
    const zoom = map.getZoom()
    setZoom(zoom)
    loadCrimes(map, zoom, filters, setCrimes)
  }, [])
  return null
}

function FilterWatcher({filters, setCrimes, setZoom}) {
  const map = useMap()
  useEffect(() => {
    const zoom = map.getZoom()
    setZoom(zoom)
    loadCrimes(map, zoom, filters, setCrimes)
  }, [filters])
  return null
}

function ClusterMarker({point}) {
  const map = useMap()
  const lat = Number(point.lat)
  const lng = Number(point.lng)
  if (!isFinite(lat) || !isFinite(lng)) return null
  const handleClick = () => {
    const z = map.getZoom()
    const step = z < 12 ? 4 : z < 14 ? 3 : z < 16 ? 2 : 1
    map.flyTo([lat, lng], Math.min(z + step, 17), {duration: 0.6})
  }
  return (
    <Marker position={[lat, lng]} icon={createClusterDivIcon(point.count)} eventHandlers={{click: handleClick}}>
      <Popup>{point.count} преступлений</Popup>
    </Marker>
  )
}

export default function CrimeMap() {
  const [crimes, setCrimes] = useState([])
  const [zoom, setZoom] = useState(12)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [filters, setFilters] = useState({years: [], severity: [], districts: []})
  const [options, setOptions] = useState({years: [], districts: []})
  const [districtGeo, setDistrictGeo] = useState(null)

  const isDetailed = zoom >= 17

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/map/filters')
      .then(r => r.json())
      .then(data => setOptions(data))
  }, [])

  useEffect(() => {
    fetch('/almaty-districts.geo.json')
      .then(r => r.json())
      .then(data => setDistrictGeo(data))
      .catch(err => console.warn('GeoJSON не загружен:', err))
  }, [])

  return (
    <div style={{position: 'relative', height: '100vh', overflow: 'hidden'}}>
      <Sidebar filters={filters} setFilters={setFilters} options={options} isOpen={sidebarOpen}
               setIsOpen={setSidebarOpen}/>

      <MapContainer
        center={[43.238949, 76.889709]}
        maxZoom={20}
        zoom={12}
        crs={crs}
        style={{height: '100vh', width: '100%'}}
      >
        <TileLayer
          attribution='© <a href="https://yandex.ru/maps" target="_blank">Яндекс Карты</a>'
          url={`https://tiles.api-maps.yandex.ru/v1/tiles/?x={x}&y={y}&z={z}&lang=ru_RU&l=map&apikey=${YANDEX_API_KEY}`}
          maxZoom={20}
          tileSize={256}
        />

        {districtGeo && (
          <GeoJSON
            key={filters.districts.join(',')}
            data={districtGeo}
            style={(feature) => getDistrictStyle(feature, filters.districts)}
          />
        )}

        <MapInit setCrimes={setCrimes} setZoom={setZoom} filters={filters}/>
        <MapEvents setCrimes={setCrimes} setZoom={setZoom} filters={filters}/>
        <FilterWatcher filters={filters} setCrimes={setCrimes} setZoom={setZoom}/>

        {crimes.map((point, index) => {
          const lat = Number(point.lat)
          const lng = Number(point.lng)
          if (!isFinite(lat) || !isFinite(lng)) return null
          return isDetailed ? (
            <Marker key={`crime-${index}`} position={[lat, lng]} icon={createCrimeDivIcon(point.hard_code)}>
              <Popup>
                <strong>{point.crime_name || 'Неизвестно'}</strong><br/>
                Тяжесть: {point.hard_code ? point.hard_code.replace(/\s*-\s*\d+$/, '') : '—'}<br/>
                Год: {point.year || '—'}
              </Popup>
            </Marker>
          ) : (
            <ClusterMarker key={index} point={point}/>
          )
        })}

        <Legend filters={filters}/>
      </MapContainer>
    </div>
  )
}