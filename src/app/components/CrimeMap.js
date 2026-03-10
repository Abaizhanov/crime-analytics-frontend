'use client'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import { useState } from 'react'
import L from 'leaflet'

// Тяжесть преступления по ключевым словам
const getSeverityColor = (crimeName) => {
  if (!crimeName) return '#6b7280'

  const name = crimeName.toLowerCase()

  const severe = ['убийство', 'изнасилование', 'разбой', 'похищение', 'терроризм', 'бандитизм', 'умышленное причинение тяжкого', 'доведение']
  if (severe.some(k => name.includes(k))) return '#dc2626'

  const medium = ['грабёж', 'грабеж', 'мошенничество', 'вымогательство', 'кража', 'угон', 'наркотик', 'хранение', 'сбыт', 'средней']
  if (medium.some(k => name.includes(k))) return '#ea580c'

  const light = ['хулиганство', 'побои', 'угроза', 'оскорбление', 'присвоение', 'растрата']
  if (light.some(k => name.includes(k))) return '#ca8a04'

  const minor = ['административ', 'нарушение', 'самоуправство', 'мелкое']
  if (minor.some(k => name.includes(k))) return '#16a34a'

  return '#6b7280'
}

const createClusterDivIcon = (count) => {
  const size = count > 10000 ? 56 : count > 1000 ? 48 : count > 100 ? 40 : 34
  const fontSize = count > 9999 ? 10 : count > 999 ? 12 : 14
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:#2563eb;color:white;
      border-radius:50%;display:flex;
      align-items:center;justify-content:center;
      font-size:${fontSize}px;font-weight:bold;
      border:2px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
      cursor:pointer;
    ">${count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

const createCrimeDivIcon = (crimeName) => {
  const color = getSeverityColor(crimeName)
  return L.divIcon({
    html: `<div style="
      width:12px;height:12px;
      background:${color};border-radius:50%;
      border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    className: '',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

function Legend() {
  return (
    <div style={{
      position: 'absolute', bottom: 70, left: 10, zIndex: 1000,
      background: 'black', borderRadius: 8, padding: '10px 14px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: 12, lineHeight: '22px', fontColor: 'black'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Тяжесть преступления</div>
      {[
        ['#dc2626', 'Тяжкие (убийство, разбой...)'],
        ['#ea580c', 'Средние (кража, мошенничество...)'],
        ['#ca8a04', 'Небольшие (хулиганство, побои...)'],
        ['#16a34a', 'Мелкие / административные'],
        ['#6b7280', 'Неизвестно'],
      ].map(([color, label]) => (
        <div key={color} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', flexShrink: 0 }} />
          {label}
        </div>
      ))}
    </div>
  )
}

function MapEvents({ setCrimes, setZoom }) {
  const map = useMapEvents({
    moveend: fetchData,
    zoomend: fetchData,
  })

  function fetchData() {
    const bounds = map.getBounds()
    const zoom = map.getZoom()
    setZoom(zoom)
    const { _northEast: ne, _southWest: sw } = bounds
    fetch(`http://127.0.0.1:8000/api/map?north=${ne.lat}&south=${sw.lat}&east=${ne.lng}&west=${sw.lng}&zoom=${zoom}`)
      .then(res => res.json())
      .then(data => setCrimes(data))
  }

  return null
}

function ClusterMarker({ point, index }) {
  const map = useMap()

  const handleClick = () => {
    const currentZoom = map.getZoom()
    map.flyTo(
      [Number(point.lat), Number(point.lng)],
      Math.min(currentZoom + 3, 18), // +3 зума, максимум 19
      { duration: 0.8 }
    )
  }

  return (
    <Marker
      key={`cluster-${index}`}
      position={[Number(point.lat), Number(point.lng)]}
      icon={createClusterDivIcon(point.count)}
      eventHandlers={{ click: handleClick }}
    >
      <Popup>{point.count} преступлений</Popup>
    </Marker>
  )
}

export default function CrimeMap() {
  const [crimes, setCrimes] = useState([])
  const [zoom, setZoom] = useState(12)

  const isDetailed = zoom >= 17

  return (
    <div style={{ position: 'relative' }}>
      <MapContainer
        center={[43.238949, 76.889709]}
        zoom={12}
        style={{ height: '100vh', width: '100%' }}
        whenReady={(map) => {
          const bounds = map.target.getBounds()
          const z = map.target.getZoom()
          const { _northEast: ne, _southWest: sw } = bounds
          fetch(`http://127.0.0.1:8000/api/map?north=${ne.lat}&south=${sw.lat}&east=${ne.lng}&west=${sw.lng}&zoom=${z}`)
            .then(r => r.json())
            .then(data => setCrimes(data))
        }}
      >
        <TileLayer
          attribution="© OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEvents setCrimes={setCrimes} setZoom={setZoom} />

        {crimes.map((point, index) =>
          isDetailed ? (
            <Marker
              key={`crime-${index}`}
              position={[Number(point.lat), Number(point.lng)]}
              icon={createCrimeDivIcon(point.crime_name)}
            >
              <Popup>
                <strong>{point.crime_name || 'Неизвестно'}</strong><br />
                Год: {point.year || '—'}
              </Popup>
            </Marker>
          ) : (
            <ClusterMarker key={index} point={point} index={index} />
          )
        )}

        {isDetailed && <Legend />}
      </MapContainer>
    </div>
  )
}