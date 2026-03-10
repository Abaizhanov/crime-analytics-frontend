'use client'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import {MapContainer, TileLayer, Marker, Popup, useMapEvents} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import {useState} from 'react'
import L from "leaflet"

const createClusterIcon = (cluster) => {

  const markers = cluster.getAllChildMarkers()

  let total = 0

  markers.forEach(marker => {
    total += marker.options.count || 1
  })

  return L.divIcon({
    html: `<div class="crime-cluster">${total}</div>`,
    className: "crime-cluster-wrapper",
    iconSize: L.point(40, 40)
  })
}

function MapEvents({setCrimes}) {

  const map = useMapEvents({

    load: fetchData,
    moveend: fetchData

  })

  function fetchData() {

    const bounds = map.getBounds()
    const zoom = map.getZoom()

    const north = bounds.getNorth()
    const south = bounds.getSouth()
    const east = bounds.getEast()
    const west = bounds.getWest()

    fetch(`http://127.0.0.1:8000/api/map?north=${north}&south=${south}&east=${east}&west=${west}&zoom=${zoom}`)
      .then(res => res.json())
      .then(data => setCrimes(data))
  }

  return null
}

export default function CrimeMap() {

  const [crimes, setCrimes] = useState([])
  console.log("CRIMES:", crimes.length)
  return (
    <MapContainer
      center={[43.238949, 76.889709]}
      zoom={12}
      style={{height: '100vh', width: '100%'}}
    >

      <TileLayer
        attribution='© OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapEvents setCrimes={setCrimes}/>


      <MarkerClusterGroup
        iconCreateFunction={createClusterIcon}
        disableClusteringAtZoom={17}
      >

        {crimes.map((cluster, index) => (
          <Marker
            key={`${cluster.lat}-${cluster.lng}-${cluster.count}`}
            position={[
              Number(cluster.lat),
              Number(cluster.lng)
            ]}
            options={{count: cluster.count}}
          >
            <Popup>
              {cluster.count
                ? `${cluster.count} преступлений`
                : `${cluster.crime_name} (${cluster.year})`}
            </Popup>
          </Marker>
        ))}

      </MarkerClusterGroup>


    </MapContainer>
  )
}