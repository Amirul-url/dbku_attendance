import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Box, CalendarDays, CalendarPlus, Crosshair, Edit, Eye, Map, Search, Trash2 } from 'lucide-react'
import { apiRequest, listFromResponse } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''
const DEFAULT_EVENT_LONGITUDE = 110.334028
const DEFAULT_EVENT_LATITUDE = 1.586684
const KUCHING_CENTER = [DEFAULT_EVENT_LONGITUDE, DEFAULT_EVENT_LATITUDE]
const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  outdoor: 'mapbox://styles/mapbox/outdoors-v12',
}
const LOCAL_ADDRESS_SUGGESTIONS = [
  {
    id: 'local-muzium-kucing',
    text: 'Muzium Kucing',
    place_name: 'Muzium Kucing, Jalan Semariang, Petra Jaya, 93000 Kuching, Sarawak',
    center: [110.334028, 1.586684],
  },
  {
    id: 'local-dbku',
    text: 'Dewan Bandaraya Kuching Utara',
    place_name: 'Dewan Bandaraya Kuching Utara, Bukit Siol, Jalan Semariang, 93050 Kuching, Sarawak',
    center: [110.334028, 1.586684],
  },
]

const emptyEvent = {
  name: '',
  location: '',
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  description: '',
  latitude: formatCoordinate(DEFAULT_EVENT_LATITUDE),
  longitude: formatCoordinate(DEFAULT_EVENT_LONGITUDE),
  radius_meter: 100,
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatCoordinate(value) {
  const number = toNumber(value)
  return number === null ? '' : number.toFixed(6)
}

function makeCircleFeature(longitude, latitude, radiusMeter) {
  const points = 96
  const coordinates = []
  const distanceKm = radiusMeter / 1000
  const earthRadiusKm = 6371
  const latRad = latitude * Math.PI / 180
  const lngRad = longitude * Math.PI / 180

  for (let index = 0; index <= points; index += 1) {
    const bearing = index * 2 * Math.PI / points
    const angularDistance = distanceKm / earthRadiusKm
    const pointLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing),
    )
    const pointLng = lngRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(pointLat),
    )
    coordinates.push([pointLng * 180 / Math.PI, pointLat * 180 / Math.PI])
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
      },
    ],
  }
}

function syncRadiusCircle(map, longitude, latitude, radiusMeter) {
  if (!map.isStyleLoaded()) return
  const data = makeCircleFeature(longitude, latitude, Number(radiusMeter) || 100)
  const source = map.getSource('event-radius')

  if (source) {
    source.setData(data)
    return
  }

  map.addSource('event-radius', { type: 'geojson', data })
  map.addLayer({
    id: 'event-radius-fill',
    type: 'fill',
    source: 'event-radius',
    paint: {
      'fill-color': '#0e7c6b',
      'fill-opacity': 0.16,
    },
  })
  map.addLayer({
    id: 'event-radius-line',
    type: 'line',
    source: 'event-radius',
    paint: {
      'line-color': '#003B46',
      'line-width': 2,
    },
  })
}

function applyMapView(map, mode) {
  const is3d = mode === '3d'
  map.easeTo({
    pitch: is3d ? 58 : 0,
    bearing: is3d ? -18 : 0,
    duration: 450,
  })

  if (!is3d || map.getLayer('event-3d-buildings') || !map.getSource('composite')) return

  map.addLayer({
    id: 'event-3d-buildings',
    source: 'composite',
    'source-layer': 'building',
    filter: ['==', 'extrude', 'true'],
    type: 'fill-extrusion',
    minzoom: 14,
    paint: {
      'fill-extrusion-color': '#9ba8ad',
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'min_height'],
      'fill-extrusion-opacity': 0.55,
    },
  })
}

function formatPeriod(row) {
  if (!row.start_date && !row.end_date) return '-'
  const startDate = formatDateDisplay(row.start_date)
  const endDate = formatDateDisplay(row.end_date)
  const dateRange = row.start_date === row.end_date || !row.end_date ? startDate : `${startDate} -> ${endDate}`
  const timeRange = row.start_time || row.end_time ? `${formatTimeDisplay(row.start_time)} - ${formatTimeDisplay(row.end_time)}` : ''

  return (
    <span className="event-period-cell">
      <strong>{dateRange}</strong>
      {timeRange && <span>{timeRange}</span>}
    </span>
  )
}

function localAddressSuggestions(query) {
  const normalizedQuery = query.toLowerCase()
  return LOCAL_ADDRESS_SUGGESTIONS.filter((place) => {
    const searchable = `${place.text} ${place.place_name} dbku kuching`.toLowerCase()
    return searchable.includes(normalizedQuery) || normalizedQuery.includes('dbku')
  })
}

function formatNominatimAddress(item) {
  const address = item.address || {}
  const buildingName = item.name || address.building || address.amenity || address.shop || address.office || address.tourism || ''
  const road = address.road || address.pedestrian || address.footway || ''
  const suburb = address.suburb || address.neighbourhood || address.quarter || ''
  const city = address.city || address.town || address.village || address.county || ''
  const state = address.state || ''
  const postcode = address.postcode || ''

  return [buildingName, road, suburb, city, state, postcode, 'Malaysia'].filter(Boolean).join(', ') || item.display_name || ''
}

function formatDateDisplay(value) {
  if (!value) return '-'
  const [year, month, day] = String(value).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function formatTimeDisplay(value) {
  if (!value) return '-'
  return String(value).slice(0, 5)
}

export function EventsPage() {
  const [error, setError] = useState('')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateSearch, setDateSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyEvent)
  const [addressQuery, setAddressQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [mapMessage, setMapMessage] = useState('')
  const [mapView, setMapView] = useState('2d')
  const [mapStyleKey, setMapStyleKey] = useState('streets')
  const dateInputRef = useRef(null)
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const formRef = useRef(form)
  const mapViewRef = useRef(mapView)
  const mapStyleKeyRef = useRef(mapStyleKey)
  const selectedAddressRef = useRef('')
  const geofenceSectionRef = useRef(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiRequest('/events/')
      setEvents(listFromResponse(data))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    mapViewRef.current = mapView
  }, [mapView])

  useEffect(() => {
    mapStyleKeyRef.current = mapStyleKey
  }, [mapStyleKey])

  useEffect(() => {
    if (!modal || !MAPBOX_TOKEN) return undefined
    const query = addressQuery.trim()
    if (query.length < 3) {
      setSuggestions([])
      return undefined
    }
    if (query === selectedAddressRef.current) {
      setSuggestions([])
      return undefined
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      try {
        const places = await searchPlaces(query, 5, controller.signal)
        setSuggestions(places)
        if (places[0]) previewSuggestion(places[0])
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions([])
          setMapMessage(err.message)
        }
      }
    }, 350)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [addressQuery, modal])

  useEffect(() => {
    if (!modal || mapRef.current || !mapContainerRef.current || !MAPBOX_TOKEN) return undefined

    mapboxgl.accessToken = MAPBOX_TOKEN
    const currentForm = formRef.current
    const currentMapView = mapViewRef.current
    const latitude = toNumber(currentForm.latitude) ?? KUCHING_CENTER[1]
    const longitude = toNumber(currentForm.longitude) ?? KUCHING_CENTER[0]
    const hasCoordinates = toNumber(currentForm.latitude) !== null && toNumber(currentForm.longitude) !== null

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[mapStyleKeyRef.current],
      center: [longitude, latitude],
      zoom: hasCoordinates ? 15 : 12,
      pitch: currentMapView === '3d' ? 58 : 0,
      bearing: currentMapView === '3d' ? -18 : 0,
    })

    const marker = new mapboxgl.Marker({ color: '#dc2626', draggable: true })
      .setLngLat([longitude, latitude])
      .addTo(map)

    marker.on('dragend', () => {
      const next = marker.getLngLat()
      updateLocationFromCoordinates(next.lng, next.lat, true)
    })

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right')
    map.on('load', () => {
      const latestForm = formRef.current
      const latestLatitude = toNumber(latestForm.latitude) ?? latitude
      const latestLongitude = toNumber(latestForm.longitude) ?? longitude
      syncRadiusCircle(map, latestLongitude, latestLatitude, latestForm.radius_meter)
      applyMapView(map, mapViewRef.current)
    })
    map.on('click', (event) => {
      updateLocationFromCoordinates(event.lngLat.lng, event.lngLat.lat, true)
    })

    mapRef.current = map
    markerRef.current = marker
    window.setTimeout(() => map.resize(), 0)

    return () => {
      marker.remove()
      map.remove()
      markerRef.current = null
      mapRef.current = null
    }
  }, [modal])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return

    const latitude = toNumber(form.latitude)
    const longitude = toNumber(form.longitude)
    if (latitude === null || longitude === null) return

    marker.setLngLat([longitude, latitude])
    syncRadiusCircle(map, longitude, latitude, form.radius_meter)
  }, [form.latitude, form.longitude, form.radius_meter])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.setStyle(MAP_STYLES[mapStyleKey])
    map.once('style.load', () => {
      const currentForm = formRef.current
      const latitude = toNumber(currentForm.latitude) ?? KUCHING_CENTER[1]
      const longitude = toNumber(currentForm.longitude) ?? KUCHING_CENTER[0]
      syncRadiusCircle(map, longitude, latitude, currentForm.radius_meter)
      applyMapView(map, mapViewRef.current)
    })
  }, [mapStyleKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    applyMapView(map, mapView)
  }, [mapView])

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase()
    return events.filter((row) => {
      const matchesTerm = !term || row.name?.toLowerCase().includes(term) || row.location?.toLowerCase().includes(term)
      const matchesDate = !dateSearch || row.start_date === dateSearch || row.end_date === dateSearch
      return matchesTerm && matchesDate
    })
  }, [dateSearch, events, search])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    if (field === 'location') {
      selectedAddressRef.current = ''
      setAddressQuery(value)
    }
  }

  function setCoordinates(longitude, latitude) {
    setForm((current) => ({
      ...current,
      latitude: formatCoordinate(latitude),
      longitude: formatCoordinate(longitude),
    }))
  }

  function setLocationAddress(nextAddress) {
    selectedAddressRef.current = nextAddress
    setAddressQuery(nextAddress)
    setForm((current) => ({
      ...current,
      location: nextAddress,
    }))
  }

  function moveMapTo(longitude, latitude, options = {}) {
    const map = mapRef.current
    const marker = markerRef.current

    setCoordinates(longitude, latitude)
    marker?.setLngLat([longitude, latitude])

    if (!map) return

    map.resize()
    map.jumpTo({ center: [longitude, latitude], zoom: options.zoom || 17 })
    if (map.isStyleLoaded()) {
      syncRadiusCircle(map, longitude, latitude, formRef.current.radius_meter)
    } else {
      map.once('load', () => {
        marker?.setLngLat([longitude, latitude])
        map.jumpTo({ center: [longitude, latitude], zoom: options.zoom || 17 })
        syncRadiusCircle(map, longitude, latitude, formRef.current.radius_meter)
      })
    }

    if (options.scroll) {
      window.setTimeout(() => {
        geofenceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        window.setTimeout(() => map.resize(), 250)
      }, 0)
    }
  }

  function previewSuggestion(place) {
    if (!place?.center) return
    const [longitude, latitude] = place.center
    moveMapTo(longitude, latitude)
  }

  async function reverseGeocode(longitude, latitude) {
    try {
      const params = new URLSearchParams({
        lat: String(latitude),
        lon: String(longitude),
        format: 'json',
        addressdetails: '1',
        zoom: '18',
      })
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'DBKUAttendance/1.0' },
      })
      if (!response.ok) return ''
      const data = await response.json()
      return formatNominatimAddress(data)
    } catch (err) {
      console.error('Reverse geocoding failed:', err)
      return ''
    }
  }

  async function updateLocationFromCoordinates(longitude, latitude, shouldReverse = false) {
    const fixedLongitude = Number(longitude.toFixed(6))
    const fixedLatitude = Number(latitude.toFixed(6))

    moveMapTo(fixedLongitude, fixedLatitude, { zoom: Math.max(mapRef.current?.getZoom?.() || 16, 16) })
    setMapMessage('Pin location updated.')

    if (!shouldReverse) return

    setMapMessage('Updating address...')
    const nextAddress = await reverseGeocode(fixedLongitude, fixedLatitude)
    if (nextAddress) {
      setLocationAddress(nextAddress)
      setMapMessage('Address detected.')
    } else {
      setMapMessage('Pin location updated.')
    }
  }

  function openCreate() {
    setForm(emptyEvent)
    setAddressQuery('')
    selectedAddressRef.current = ''
    setSuggestions([])
    setMapMessage('')
    setMapView('2d')
    setMapStyleKey('streets')
    setModal({ mode: 'create' })
  }

  function openEdit(row) {
    setForm({
      ...emptyEvent,
      ...row,
      latitude: row.latitude ?? '',
      longitude: row.longitude ?? '',
      radius_meter: row.radius_meter || 100,
    })
    setAddressQuery(row.location || '')
    selectedAddressRef.current = row.location || ''
    setSuggestions([])
    setMapMessage('')
    setMapView('2d')
    setMapStyleKey('streets')
    setModal({ mode: 'edit', id: row.id })
  }

  async function deleteEvent(row) {
    if (!window.confirm(`Delete ${row.name}?`)) return
    try {
      await apiRequest(`/events/${row.id}/`, { method: 'DELETE' })
      await fetchEvents()
    } catch (err) {
      setError(err.message)
    }
  }

  async function fetchNominatimResults(query, limit, signal) {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: String(limit),
      countrycodes: 'my',
      viewbox: '109.7,2.2,111.2,0.8',
      bounded: '0',
    })
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      signal,
      headers: { 'Accept-Language': 'en', 'User-Agent': 'DBKUAttendance/1.0' },
    })
    if (!response.ok) return []
    const data = await response.json()

    return data.map((item) => ({
      id: `nominatim-${item.place_id}`,
      text: item.name || item.address?.tourism || item.address?.building || item.display_name?.split(',')[0] || '',
      place_name: formatNominatimAddress(item),
      center: [Number.parseFloat(item.lon), Number.parseFloat(item.lat)],
    }))
  }

  async function fetchMapboxResults(query, limit, signal) {
    const kuchingQuery = `${query}, Kuching, Sarawak, Malaysia`
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      language: 'en',
      country: 'my',
      limit: String(limit),
      proximity: '110.334028,1.586684',
      bbox: '109.7,0.8,111.2,2.2',
    })
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(kuchingQuery)}.json?${params}`, { signal })
    if (!response.ok) {
      return []
    }
    const data = await response.json()

    return (data.features || []).map((feature) => ({
      id: feature.id,
      text: feature.text || feature.place_name?.split(',')[0] || '',
      place_name: feature.place_name || '',
      center: feature.geometry?.coordinates || feature.center,
    }))
  }

  async function searchPlaces(query, limit = 1, signal) {
    const nominatimPlaces = await fetchNominatimResults(query, limit, signal)
    if (nominatimPlaces.length) return nominatimPlaces

    const mapboxPlaces = await fetchMapboxResults(query, limit, signal)
    if (mapboxPlaces.length) return mapboxPlaces

    return localAddressSuggestions(query).slice(0, limit)
  }

  function chooseSuggestion(place) {
    const [longitude, latitude] = place.center
    setForm((current) => ({
      ...current,
      location: place.place_name,
      latitude: formatCoordinate(latitude),
      longitude: formatCoordinate(longitude),
    }))
    selectedAddressRef.current = place.place_name
    setAddressQuery(place.place_name)
    setSuggestions([])
    setMapMessage('Address selected. Drag the pin to fine-tune.')
    moveMapTo(longitude, latitude, { scroll: true })
  }

  function focusMapLocation() {
    const latitude = toNumber(form.latitude)
    const longitude = toNumber(form.longitude)
    if (latitude === null || longitude === null) {
      setMapMessage('Choose an address suggestion first.')
      return
    }

    mapRef.current?.flyTo({
      center: [longitude, latitude],
      zoom: 17,
      pitch: mapView === '3d' ? 58 : 0,
      bearing: mapView === '3d' ? -18 : 0,
      duration: 700,
    })
  }

  function renderSuggestions() {
    if (suggestions.length === 0) return null

    return (
      <div className="map-suggestions">
        {suggestions.map((place) => (
          <button type="button" key={place.id} onClick={() => chooseSuggestion(place)}>
            <strong>{place.text}</strong>
            <span>{place.place_name}</span>
          </button>
        ))}
      </div>
    )
  }

  async function saveEvent(event) {
    event.preventDefault()
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => {
        if (value === '') return [key, null]
        if (key === 'latitude' || key === 'longitude') return [key, Number(value)]
        if (key === 'radius_meter') return [key, Number(value) || 100]
        return [key, value]
      }),
    )

    try {
      if (modal.mode === 'create') {
        await apiRequest('/events/', { method: 'POST', body: JSON.stringify(payload) })
      } else {
        await apiRequest(`/events/${modal.id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
      }
      setModal(null)
      await fetchEvents()
    } catch (err) {
      setError(err.message)
    }
  }

  function resetFilters() {
    setSearch('')
    setDateSearch('')
  }

  function openDatePicker() {
    const input = dateInputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }
    input.focus()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Event Management</h1>
          <div className="page-sub">Manage event information, geofence settings, and QR attendance access.</div>
        </div>
        <button type="button" className="btn btn-green" onClick={openCreate}><CalendarPlus size={16} /> Create Event</button>
      </div>
      <div className="filter-card event-filter-card">
        <input className="filter-input" placeholder="Search event name or location" value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="filter-date-wrap">
          <input ref={dateInputRef} type="date" className="filter-input" value={dateSearch} onChange={(event) => setDateSearch(event.target.value)} />
          <button type="button" className="filter-date-button" onClick={openDatePicker} aria-label="Open calendar">
            <CalendarDays size={16} />
          </button>
        </div>
        <button type="button" className="btn btn-ocean"><Search size={16} /> Filter</button>
        <button type="button" className="btn btn-ghost" onClick={resetFilters}>Reset</button>
      </div>
      {error && <div className="alert-error">{error}</div>}
      <div className="table-card event-table-card">
        <div className="table-card-header">
          <div>
            <div className="table-card-title">Events List</div>
            <div className="table-card-sub">{loading ? 'Loading events...' : 'All available events in the system'}</div>
          </div>
        </div>
        <DataTable
          rows={filteredEvents}
          columns={[
            { key: 'name', label: 'Event Name' },
            { key: 'location', label: 'Location', render: (row) => <span className="event-location-cell" title={row.location}>{row.location || '-'}</span> },
            { key: 'period', label: 'Period', render: formatPeriod },
            { key: 'description', label: 'Description', render: (row) => <span className="event-description-cell" title={row.description}>{row.description || '-'}</span> },
            {
              key: 'geofence',
              label: 'Geofence',
              render: (row) => (
                row.latitude && row.longitude
                  ? (
                    <span className="event-geofence-cell">
                      <strong>{Number(row.latitude).toFixed(6)}, {Number(row.longitude).toFixed(6)}</strong>
                      <span>{row.radius_meter} m</span>
                    </span>
                  )
                  : '-'
              ),
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="button-row event-action-row">
                  <Link className="btn btn-small btn-green" to={`/events/${row.id}`}><Eye size={14} /> View</Link>
                  <button type="button" className="btn btn-small btn-blue" onClick={() => openEdit(row)}><Edit size={14} /> Edit</button>
                  <button type="button" className="btn btn-small btn-red" onClick={() => deleteEvent(row)}><Trash2 size={14} /> Delete</button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {modal && (
        <div className="modal-overlay open">
          <form className="modal-box modal-wide event-modal" onSubmit={saveEvent}>
            <div className="modal-header event-modal-header">
              <div>
                <div className="modal-title">{modal.mode === 'create' ? 'Create Event' : 'Edit Event'}</div>
                <div className="event-modal-subtitle">Fill in the event details below</div>
              </div>
              <button type="button" className="modal-close" onClick={() => setModal(null)} aria-label="Close">x</button>
            </div>
            <div className="modal-body event-modal-body stack-form">
              <label className="compact-field"><span>Event Name</span><input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Enter event name" required /></label>
              <div className="compact-field address-field">
                <span>Location / Full Address</span>
                <input value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="e.g. Dewan Bandaraya Kuching Utara, Jalan Semariang, 93050 Kuching" required />
                {renderSuggestions()}
              </div>
              <div className="form-grid-2">
                <label className="compact-field"><span>Start Date</span><input type="date" value={form.start_date || ''} onChange={(e) => update('start_date', e.target.value)} required /></label>
                <label className="compact-field"><span>End Date</span><input type="date" value={form.end_date || ''} onChange={(e) => update('end_date', e.target.value)} required /></label>
              </div>
              <div className="form-grid-2">
                <label className="compact-field"><span>Start Time</span><input type="time" value={form.start_time || ''} onChange={(e) => update('start_time', e.target.value)} /></label>
                <label className="compact-field"><span>End Time</span><input type="time" value={form.end_time || ''} onChange={(e) => update('end_time', e.target.value)} /></label>
              </div>
              <label className="compact-field"><span>Description</span><textarea value={form.description || ''} onChange={(e) => update('description', e.target.value)} placeholder="Enter description" rows={2} /></label>

              <section className="geofence-section" ref={geofenceSectionRef}>
                <div className="geofence-heading">
                  <h2>Geofence Setting</h2>
                  <p>Type the full address and choose a suggestion. Latitude, longitude, and radius update in real time.</p>
                </div>
                <div className="form-grid-3">
                  <label className="compact-field"><span>Latitude</span><input value={form.latitude || ''} onChange={(e) => update('latitude', e.target.value)} placeholder="Auto from map" /></label>
                  <label className="compact-field"><span>Longitude</span><input value={form.longitude || ''} onChange={(e) => update('longitude', e.target.value)} placeholder="Auto from map" /></label>
                  <label className="compact-field"><span>Radius (meters)</span><input type="number" min="1" value={form.radius_meter} onChange={(e) => update('radius_meter', e.target.value)} /></label>
                </div>
                <div className="geofence-toolbar">
                  <button type="button" className="btn btn-ghost" onClick={focusMapLocation}><Crosshair size={16} /> Focus</button>
                  <button type="button" className={`btn ${mapView === '2d' ? 'btn-ocean' : 'btn-ghost'}`} onClick={() => setMapView('2d')}><Map size={16} /> 2D View</button>
                  <button type="button" className={`btn ${mapView === '3d' ? 'btn-ocean' : 'btn-ghost'}`} onClick={() => setMapView('3d')}><Box size={16} /> 3D View</button>
                  <button type="button" className={`btn ${mapStyleKey === 'streets' ? 'btn-green' : 'btn-ghost'}`} onClick={() => setMapStyleKey('streets')}>Street</button>
                  <button type="button" className={`btn ${mapStyleKey === 'satellite' ? 'btn-green' : 'btn-ghost'}`} onClick={() => setMapStyleKey('satellite')}>Satellite</button>
                  <button type="button" className={`btn ${mapStyleKey === 'outdoor' ? 'btn-green' : 'btn-ghost'}`} onClick={() => setMapStyleKey('outdoor')}>Outdoor</button>
                </div>
                <div className="map-canvas" ref={mapContainerRef}>
                  {!MAPBOX_TOKEN && <div className="map-empty-state">Mapbox token is required.</div>}
                </div>
                <div className="map-help">{mapMessage || 'Tip: type address, pick a suggestion, then drag pin to fine-tune.'}</div>
              </section>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-ocean">Save Event</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
