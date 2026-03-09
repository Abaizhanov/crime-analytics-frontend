'use client'
import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { useEffect, useState } from 'react'

export default function CrimeMap() {

  const [crimes, setCrimes] = useState([])

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/map?north=43.30&south=43.20&east=76.95&west=76.85')
      .then(res => res.json())
      .then(data => setCrimes(data))
  }, [])

  return (
    <MapContainer
      center={[43.238949, 76.889709]}
      zoom={12}
      style={{ height: '100vh', width: '100%' }}
    >
      <TileLayer
        attribution='© OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MarkerClusterGroup>

        {crimes.map((crime, index) => (
          <Marker key={index} position={[crime.latitude, crime.longitude]}>
            <Popup>
              {crime.crime_name} ({crime.year})
            </Popup>
          </Marker>
        ))}

      </MarkerClusterGroup>

    </MapContainer>
  )
}