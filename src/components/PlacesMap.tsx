"use client"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet"
import type { Person } from "@/models/Person"
import PlacePopup from "./PlacePopup"
import { PLACES_MAP_HEIGHT } from "@/config/constants"

export interface LivedEntry {
  person: Person
  label: string | null
  dateFrom: string | null
  dateTo: string | null
}

export interface PlacePin {
  placeKey: string
  latitude: number
  longitude: number
  displayName: string | null
  birthPeople: Person[]
  deathPeople: Person[]
  livedEntries: LivedEntry[]
}

function dotIcon(color: string) {
  return L.divIcon({
    className: "places-map-pin",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
    html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.45)"></span>`,
  })
}

const birthIcon = dotIcon("#14b8a6")
const deathIcon = dotIcon("#f59e0b")
const livedIcon = dotIcon("#3b82f6")

export default function PlacesMap({ pins }: { pins: PlacePin[] }) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      scrollWheelZoom
      style={{ height: PLACES_MAP_HEIGHT, width: "100%", borderRadius: "0.75rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pins.map((pin) => {
        const icon =
          pin.birthPeople.length > 0
            ? birthIcon
            : pin.deathPeople.length > 0
            ? deathIcon
            : livedIcon
        return (
          <Marker key={pin.placeKey} position={[pin.latitude, pin.longitude]} icon={icon}>
            <Popup>
              <PlacePopup pin={pin} />
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
