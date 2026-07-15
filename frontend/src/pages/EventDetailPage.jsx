import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  ArrowLeft,
  Box,
  CalendarDays,
  Crosshair,
  Download,
  Edit,
  Eye,
  ExternalLink,
  LocateFixed,
  Map as MapIcon,
  QrCode,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { API_BASE_URL, apiRequest, downloadApiFile, getAccessToken, listFromResponse } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'
import { useConfirmDialog } from '../components/ConfirmDialog.jsx'
import { useAuth } from '../state/AuthContext.jsx'
import { formatTime12Hour } from '../utils/dateTime.js'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''
const DEFAULT_EVENT_LONGITUDE = 110.334028
const DEFAULT_EVENT_LATITUDE = 1.586684
const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  outdoor: 'mapbox://styles/mapbox/outdoors-v12',
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatCoordinate(value) {
  const number = toNumber(value)
  return number === null ? '-' : number.toFixed(6)
}

function formatAddress(value) {
  if (!value) return '-'
  const seen = new Set()
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join(', ')
}

function formatDisplayDate(value) {
  if (!value) return '-'
  const [year, month, day] = String(value).split('-')
  if (!year || !month || !day) return value
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatNumericDate(value) {
  if (!value) return '-'
  const [year, month, day] = String(value).split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function formatStatus(value) {
  return String(value || '-')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
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
  const data = makeCircleFeature(longitude, latitude, Number(radiusMeter) || 100)

  try {
    const source = map.getSource('event-detail-radius')

    if (source) {
      source.setData(data)
      return true
    }

    map.addSource('event-detail-radius', { type: 'geojson', data })
    map.addLayer({
      id: 'event-detail-radius-fill',
      type: 'fill',
      source: 'event-detail-radius',
      paint: {
        'fill-color': '#0e7c6b',
        'fill-opacity': 0.16,
      },
    })
    map.addLayer({
      id: 'event-detail-radius-line',
      type: 'line',
      source: 'event-detail-radius',
      paint: {
        'line-color': '#003B46',
        'line-width': 2,
      },
    })
    return true
  } catch {
    return false
  }
}

function applyMapView(map, mode) {
  const is3d = mode === '3d'
  map.easeTo({
    pitch: is3d ? 58 : 0,
    bearing: is3d ? -18 : 0,
    duration: 450,
  })

  if (!is3d || map.getLayer('event-detail-3d-buildings') || !map.getSource('composite')) return

  map.addLayer({
    id: 'event-detail-3d-buildings',
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

function getQrDownloadUrl(qrUrl) {
  if (!qrUrl) return ''
  if (qrUrl.startsWith('http')) return qrUrl
  return `${API_BASE_URL.replace('/api', '')}${qrUrl}`
}

export function EventDetailPage() {
  const { id } = useParams()
  const { confirm, confirmDialog } = useConfirmDialog()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [assignmentAttendance, setAssignmentAttendance] = useState([])
  const [staff, setStaff] = useState([])
  const [assignmentModal, setAssignmentModal] = useState(null)
  const [assignmentDetailModal, setAssignmentDetailModal] = useState(null)
  const [qrModal, setQrModal] = useState(null)
  const [assignmentDepartment, setAssignmentDepartment] = useState('')
  const [assignmentForm, setAssignmentForm] = useState({ staff_member: '', task_title: '', task_description: '' })
  const [assignmentFormError, setAssignmentFormError] = useState('')
  const [assignmentConflict, setAssignmentConflict] = useState({ state: 'idle', message: 'Select staff first', conflicts: [] })
  const [error, setError] = useState('')
  const [mapMode, setMapMode] = useState('2d')
  const [mapStyleKey, setMapStyleKey] = useState('streets')
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [assignmentStatus, setAssignmentStatus] = useState('')
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const mapModeRef = useRef('2d')
  const canManageAssignments = Boolean(user?.is_superuser || ['admin', 'superadmin'].includes(user?.staff_profile?.role))

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [eventData, assignmentData, staffData] = await Promise.all([
          apiRequest(`/events/${id}/`),
          apiRequest(`/event-assignments/?event=${id}`),
          apiRequest('/staff/'),
        ])
        if (!mounted) return

        const assignmentRows = listFromResponse(assignmentData)
        const assignmentAttendanceRows = await loadAssignmentAttendance(assignmentRows)
        if (!mounted) return

        setEvent(eventData)
        setAssignments(assignmentRows)
        setAssignmentAttendance(assignmentAttendanceRows)
        setStaff(listFromResponse(staffData))
      } catch (err) {
        if (mounted) setError(err.message)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [id])

  useEffect(() => {
    if (!event || !mapContainerRef.current || mapRef.current || !MAPBOX_TOKEN) return undefined

    mapboxgl.accessToken = MAPBOX_TOKEN
    const latitude = toNumber(event.latitude) ?? DEFAULT_EVENT_LATITUDE
    const longitude = toNumber(event.longitude) ?? DEFAULT_EVENT_LONGITUDE

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES.streets,
      center: [longitude, latitude],
      zoom: 16,
      pitch: 0,
      bearing: 0,
      interactive: false,
    })

    const marker = new mapboxgl.Marker({ color: '#003B46' })
      .setLngLat([longitude, latitude])
      .addTo(map)

    const drawRadius = () => {
      syncRadiusCircle(map, longitude, latitude, event.radius_meter)
    }

    map.on('load', drawRadius)
    map.on('style.load', drawRadius)
    map.once('idle', drawRadius)

    mapRef.current = map
    markerRef.current = marker
    window.setTimeout(() => map.resize(), 0)

    return () => {
      marker.remove()
      map.remove()
      markerRef.current = null
      mapRef.current = null
    }
  }, [event])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !event) return

    map.setStyle(MAP_STYLES[mapStyleKey])
    const drawRadiusAfterStyle = () => {
      const latitude = toNumber(event.latitude) ?? DEFAULT_EVENT_LATITUDE
      const longitude = toNumber(event.longitude) ?? DEFAULT_EVENT_LONGITUDE
      syncRadiusCircle(map, longitude, latitude, event.radius_meter)
      applyMapView(map, mapModeRef.current)
    }
    map.once('style.load', drawRadiusAfterStyle)
    map.once('idle', drawRadiusAfterStyle)
  }, [event, mapStyleKey])

  useEffect(() => {
    mapModeRef.current = mapMode
    const map = mapRef.current
    if (!map) return
    applyMapView(map, mapMode)
  }, [mapMode])

  async function loadAssignmentAttendance(assignmentRows) {
    if (!assignmentRows.length) return []
    const nestedRows = await Promise.all(
      assignmentRows.map((assignment) => (
        apiRequest(`/assignment-attendance/?assignment=${assignment.id}`)
          .then((data) => listFromResponse(data).map((row) => ({ ...row, assignment_id: assignment.id })))
          .catch(() => [])
      )),
    )
    return nestedRows.flat()
  }

  async function reloadAssignments() {
    const data = listFromResponse(await apiRequest(`/event-assignments/?event=${id}`))
    setAssignments(data)
    setAssignmentAttendance(await loadAssignmentAttendance(data))
  }

  function openAssignmentCreate() {
    setAssignmentDepartment('')
    setAssignmentForm({ staff_member: '', task_title: '', task_description: '' })
    setAssignmentFormError('')
    setAssignmentConflict({ state: 'idle', message: 'Select staff first', conflicts: [] })
    setAssignmentModal({ mode: 'create' })
  }

  function openAssignmentEdit(row) {
    const staffMember = staffById.get(Number(row.staff_member))
    setAssignmentDepartment(staffMember?.department || '')
    setAssignmentForm({
      staff_member: row.staff_member || '',
      task_title: row.task_title || '',
      task_description: row.task_description || '',
    })
    setAssignmentFormError('')
    setAssignmentConflict({ state: 'checking', message: 'Checking assignment availability...', conflicts: [] })
    setAssignmentModal({ mode: 'edit', id: row.id })
  }

  function openAssignmentDetail(row) {
    setAssignmentDetailModal(row)
  }

  function updateAssignmentDepartment(value) {
    setAssignmentDepartment(value)
    setAssignmentForm((current) => ({ ...current, staff_member: '' }))
  }

  function updateAssignmentStaff(staffId) {
    const staffMember = staffById.get(Number(staffId))
    setAssignmentForm((current) => ({ ...current, staff_member: staffId }))
    if (staffMember?.department) setAssignmentDepartment(staffMember.department)
  }

  function updateAssignmentField(field, value) {
    setAssignmentForm((current) => ({ ...current, [field]: value }))
  }

  async function saveAssignment(submitEvent) {
    submitEvent.preventDefault()
    setAssignmentFormError('')
    if (assignmentConflict.state === 'conflict') {
      setAssignmentFormError(assignmentConflict.message || 'Please resolve the assignment conflict before saving.')
      return
    }
    try {
      const payload = {
        event: id,
        staff_member: assignmentForm.staff_member,
        task_title: assignmentForm.task_title,
        task_description: assignmentForm.task_description,
      }
      if (assignmentModal.mode === 'create') {
        await apiRequest('/event-assignments/', { method: 'POST', body: JSON.stringify(payload) })
      } else {
        await apiRequest(`/event-assignments/${assignmentModal.id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
      }
      setAssignmentModal(null)
      await reloadAssignments()
    } catch (err) {
      setAssignmentFormError(err.message)
    }
  }

  async function deleteAssignment(row) {
    const shouldDelete = await confirm({
      title: 'Delete Assignment',
      message: `Delete assignment "${row.task_title}"?`,
    })
    if (!shouldDelete) return
    setError('')
    try {
      await apiRequest(`/event-assignments/${row.id}/`, { method: 'DELETE' })
      await reloadAssignments()
    } catch (err) {
      setError(err.message)
    }
  }

  function focusMap() {
    const map = mapRef.current
    if (!map || !event) return
    map.flyTo({
      center: [
        toNumber(event.longitude) ?? DEFAULT_EVENT_LONGITUDE,
        toNumber(event.latitude) ?? DEFAULT_EVENT_LATITUDE,
      ],
      zoom: 17,
      pitch: mapMode === '3d' ? 58 : 0,
      bearing: mapMode === '3d' ? -18 : 0,
      duration: 700,
    })
  }

  function openQr(item) {
    const qrUrl = typeof item === 'string' ? item : item.qr
    const url = getQrDownloadUrl(qrUrl)
    if (!url) return
    setQrModal({
      title: typeof item === 'string' ? 'QR Code' : item.title,
      qr: qrUrl,
      filename: typeof item === 'string' ? 'qr-code.png' : item.filename,
      url: typeof item === 'string' ? '' : item.url,
    })
  }

  function openQrForm(url) {
    if (!url) return
    window.open(`${window.location.origin}${url}`, '_blank', 'noopener,noreferrer')
  }

  async function downloadQr(qrUrl, filename) {
    const url = getQrDownloadUrl(qrUrl)
    if (!url) return
    const headers = new Headers()
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(url, { headers })
    if (!response.ok) return
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }

  const staffById = useMemo(() => {
    const map = new Map()
    staff.forEach((item) => map.set(Number(item.id), item))
    return map
  }, [staff])

  const assignmentAttendanceByAssignmentId = useMemo(() => {
    const map = new Map()
    assignmentAttendance.forEach((item) => map.set(Number(item.assignment_id || item.assignment), item))
    return map
  }, [assignmentAttendance])

  const assignableStaff = useMemo(() => (
    staff.filter((item) => !item.is_superuser && item.role !== 'superadmin')
  ), [staff])

  const assignmentDepartmentOptions = useMemo(() => {
    const departments = assignableStaff
      .map((item) => item.department)
      .filter(Boolean)
      .filter((item, index, rows) => rows.findIndex((row) => row.toLowerCase() === item.toLowerCase()) === index)
    return departments.sort((a, b) => a.localeCompare(b))
  }, [assignableStaff])

  const assignmentStaffOptions = useMemo(() => (
    assignableStaff
      .filter((item) => !assignmentDepartment || item.department === assignmentDepartment)
      .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')))
  ), [assignableStaff, assignmentDepartment])

  const selectedAssignmentStaff = useMemo(
    () => staffById.get(Number(assignmentForm.staff_member)),
    [assignmentForm.staff_member, staffById],
  )

  useEffect(() => {
    if (!assignmentModal) return undefined
    if (!assignmentForm.staff_member) {
      setAssignmentConflict({ state: 'idle', message: 'Select staff first', conflicts: [] })
      return undefined
    }

    let cancelled = false
    async function checkConflict() {
      setAssignmentConflict({ state: 'checking', message: 'Checking assignment availability...', conflicts: [] })
      try {
        const params = new URLSearchParams({
          staff: assignmentForm.staff_member,
          event: id,
          task_title: assignmentForm.task_title,
        })
        if (assignmentModal.id) params.set('assignment', assignmentModal.id)
        const data = await apiRequest(`/event-assignments/conflict-check/?${params.toString()}`)
        if (cancelled) return
        setAssignmentConflict({
          state: data.available ? 'available' : 'conflict',
          message: data.message,
          conflicts: data.conflicts || [],
        })
      } catch (err) {
        if (!cancelled) setAssignmentConflict({ state: 'error', message: err.message, conflicts: [] })
      }
    }

    const timer = window.setTimeout(checkConflict, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [assignmentForm.staff_member, assignmentForm.task_title, assignmentModal, id])

  const filteredAssignments = useMemo(() => {
    const query = assignmentSearch.trim().toLowerCase()
    return assignments.filter((row) => {
      const staffMember = staffById.get(Number(row.staff_member))
      const attendance = assignmentAttendanceByAssignmentId.get(Number(row.id))
      const matchesQuery = !query
        || row.staff_name?.toLowerCase().includes(query)
        || row.task_title?.toLowerCase().includes(query)
        || staffMember?.staff_id?.toLowerCase().includes(query)
      const attendanceStatus = attendance ? 'submitted' : 'pending'
      const matchesStatus = !assignmentStatus || row.assignment_status === assignmentStatus || attendanceStatus === assignmentStatus
      return matchesQuery && matchesStatus
    })
  }, [assignmentAttendanceByAssignmentId, assignmentSearch, assignmentStatus, assignments, staffById])

  if (error) return <div className="alert-error">{error}</div>
  if (!event) return <div className="panel">Loading event</div>

  const publicLinks = [
    { title: 'Visitor QR (Malaysian)', caption: 'For Malaysian visitors', qr: event.visitor_qr_url, filename: 'visitor-malaysian-qr.png', url: `/visitor-attendance/${id}`, attendancePath: `/events/${id}/visitors` },
    { title: 'Staff QR', caption: 'For Staff', qr: event.staff_qr_url, filename: 'staff-qr.png', url: `/staff-attendance/${id}`, attendancePath: `/events/${id}/staff-attendance` },
    { title: 'Visitor QR (Non-Malaysian)', caption: 'For non-Malaysian visitors', qr: event.passport_qr_url, filename: 'visitor-non-malaysian-qr.png', url: `/passport-attendance/${id}`, attendancePath: `/events/${id}/non-malaysian-visitors` },
  ]
  const displayLocation = formatAddress(event.location)
  const selectedAssignmentAttendance = assignmentDetailModal
    ? assignmentAttendanceByAssignmentId.get(Number(assignmentDetailModal.id))
    : null
  const selectedAssignmentStaffForDetail = assignmentDetailModal
    ? staffById.get(Number(assignmentDetailModal.staff_member))
    : null
  const selectedAssignmentStatus = selectedAssignmentAttendance && assignmentDetailModal?.assignment_status === 'assigned'
    ? 'in_progress'
    : assignmentDetailModal?.assignment_status

  return (
    <>
      <Link className="back-link" to="/events"><ArrowLeft size={15} /> Back to Events</Link>

      <section className="event-view-card">
        <div className="event-view-hero">
          <div className="event-view-title-row">
            <div className="event-view-icon"><CalendarDays size={19} /></div>
            <div>
              <h1>{event.name}</h1>
            </div>
          </div>
          <div className="event-radius-pill"><LocateFixed size={15} /> Radius: {event.radius_meter}m</div>
        </div>

        <div className="event-view-summary-grid">
          <section>
            <div className="event-view-section-label">Schedule</div>
            <InfoBlock label="Start Date" value={formatDisplayDate(event.start_date)} />
            <InfoBlock label="End Date" value={formatDisplayDate(event.end_date)} />
            <InfoBlock label="Start Time" value={formatTime12Hour(event.start_time)} />
            <InfoBlock label="End Time" value={formatTime12Hour(event.end_time)} />
          </section>

          <section>
            <div className="event-view-section-label">Location</div>
            <InfoBlock label="Venue" value={displayLocation} strong />
            <InfoBlock label="Latitude" value={formatCoordinate(event.latitude)} />
            <InfoBlock label="Longitude" value={formatCoordinate(event.longitude)} />
          </section>

          <section>
            <div className="event-view-section-label">Details</div>
            <InfoBlock label="Description" value={event.description || '-'} strong />
          </section>
        </div>

        <div className="event-view-divider" />

        <section className="event-map-section">
          <div className="event-view-section-label">Event Map</div>
          <div className="event-map-toolbar">
            <button type="button" className="btn btn-ghost" onClick={focusMap}><Crosshair size={16} /> Focus</button>
            <button type="button" className={`btn ${mapMode === '2d' ? 'btn-ocean' : 'btn-ghost'}`} onClick={() => setMapMode('2d')}><MapIcon size={16} /> 2D View</button>
            <button type="button" className={`btn ${mapMode === '3d' ? 'btn-ocean' : 'btn-ghost'}`} onClick={() => setMapMode('3d')}><Box size={16} /> 3D View</button>
            <button type="button" className={`btn ${mapStyleKey === 'streets' ? 'btn-green' : 'btn-ghost'}`} onClick={() => setMapStyleKey('streets')}>Street</button>
            <button type="button" className={`btn ${mapStyleKey === 'satellite' ? 'btn-green' : 'btn-ghost'}`} onClick={() => setMapStyleKey('satellite')}>Satellite</button>
            <button type="button" className={`btn ${mapStyleKey === 'outdoor' ? 'btn-green' : 'btn-ghost'}`} onClick={() => setMapStyleKey('outdoor')}>Outdoor</button>
          </div>
          <div className="event-detail-map" ref={mapContainerRef}>
            {!MAPBOX_TOKEN && <div className="map-empty-state">Mapbox token is required.</div>}
          </div>
          <p className="event-map-note">Event location preview with geofence radius {event.radius_meter}m.</p>
        </section>

        <div className="event-view-divider" />

        <section>
          <div className="event-qr-heading">
            <h2>Attendance Records</h2>
            <p>Staff and visitor attendance for this event</p>
          </div>
          <div className="event-qr-grid">
            {publicLinks.map((item) => (
              <div className="event-qr-card" key={item.title}>
                <h3><QrCode size={14} /> {item.title}</h3>
                <div className="event-qr-image-wrap">
                  {item.qr ? <img src={item.qr} alt={item.title} /> : <QrCode size={76} />}
                </div>
                <p>{item.caption}</p>
                <div className="button-row">
                  <button type="button" className="btn btn-small btn-blue" onClick={() => openQr(item)}><Eye size={14} /></button>
                  <button type="button" className="btn btn-small btn-ocean" onClick={() => downloadQr(item.qr, item.filename)}><Download size={14} /></button>
                  {item.attendancePath && <Link className="btn btn-small btn-green" to={item.attendancePath}><Users size={14} /> List</Link>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <AttendanceSection
        title="Staff Assignment"
        searchValue={assignmentSearch}
        onSearch={setAssignmentSearch}
        searchPlaceholder="Search staff or task"
        selectValue={assignmentStatus}
        onSelect={setAssignmentStatus}
        selectOptions={[
          { value: '', label: 'All Status' },
          { value: 'assigned', label: 'Assigned' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' },
          { value: 'submitted', label: 'Submitted' },
          { value: 'pending', label: 'Pending Attendance' },
        ]}
        onExport={() => downloadApiFile(`/reports/events/${id}/export/assignment/`)}
        extraAction={canManageAssignments ? <button type="button" className="btn btn-blue" onClick={openAssignmentCreate}><UserPlus size={15} /> Add Assignment</button> : null}
      >
        <div className="assignment-table">
          <DataTable
            rows={filteredAssignments}
            columns={[
              { key: 'staff_name', label: 'Name' },
              { key: 'employee_id', label: 'Employee ID', render: (row) => staffById.get(Number(row.staff_member))?.staff_id || '-' },
              { key: 'department', label: 'Department', render: (row) => staffById.get(Number(row.staff_member))?.department || '-' },
              { key: 'task_title', label: 'Task', render: (row) => <span className="event-assignment-task"><strong>{row.task_title}</strong><span>{row.task_description || '-'}</span></span> },
              {
                key: 'assignment_status',
                label: 'Status',
                render: (row) => {
                  const attendance = assignmentAttendanceByAssignmentId.get(Number(row.id))
                  const status = attendance && row.assignment_status === 'assigned' ? 'in_progress' : row.assignment_status
                  return <span className={`status-pill status-${status}`}>{formatStatus(status)}</span>
                },
              },
              { key: 'attendance', label: 'Attendance', render: (row) => assignmentAttendanceByAssignmentId.get(Number(row.id)) ? <span className="status-pill status-submitted">Submitted</span> : <span className="status-pill status-pending">Pending</span> },
              { key: 'qr_url', label: 'QR', render: (row) => row.qr_url ? <img className="table-qr-thumb" src={row.qr_url} alt="" /> : '-' },
              {
                key: 'actions',
                label: 'Action',
                render: (row) => (
                  canManageAssignments ? (
                    <div className="button-row event-action-row">
                      <button type="button" className="btn btn-small btn-green" onClick={() => openAssignmentDetail(row)}><Eye size={14} /></button>
                      <button type="button" className="btn btn-small btn-blue" onClick={() => openAssignmentEdit(row)}><Edit size={14} /></button>
                      <button type="button" className="btn btn-small btn-red" onClick={() => deleteAssignment(row)}><Trash2 size={14} /></button>
                    </div>
                  ) : '-'
                ),
              },
            ]}
          />
        </div>
      </AttendanceSection>

      {assignmentModal && (
        <div className="modal-overlay open">
          <form className="modal-box assignment-modal" onSubmit={saveAssignment}>
            <div className="modal-header">
              <div className="modal-title">{assignmentModal.mode === 'create' ? 'Add Staff Assignment' : 'Edit Staff Assignment'}</div>
              <button type="button" className="modal-close" onClick={() => setAssignmentModal(null)}>x</button>
            </div>
            <div className="modal-body assignment-modal-body">
              {assignmentFormError && <div className="alert-error">{assignmentFormError}</div>}

              <section className="assignment-form-section">
                <h3>1. Staff Selection</h3>
                <div className="assignment-form-grid">
                  <label className="compact-field">
                    <span>Department</span>
                    <select value={assignmentDepartment} onChange={(event) => updateAssignmentDepartment(event.target.value)}>
                      <option value="">-- Please Select --</option>
                      {assignmentDepartmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
                    </select>
                  </label>
                  <label className="compact-field">
                    <span>Staff Name</span>
                    <select value={assignmentForm.staff_member} onChange={(event) => updateAssignmentStaff(event.target.value)} required>
                      <option value="">-- Please Select --</option>
                      {assignmentStaffOptions.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                    </select>
                  </label>
                  <label className="compact-field">
                    <span>Staff ID</span>
                    <input value={selectedAssignmentStaff?.staff_id || ''} placeholder="Auto display after staff selection" readOnly />
                  </label>
                  <label className="compact-field">
                    <span>Staff Email</span>
                    <input value={selectedAssignmentStaff?.email || ''} placeholder="Auto display after staff selection" readOnly />
                  </label>
                  <label className="compact-field">
                    <span>Staff Phone Number</span>
                    <input value={selectedAssignmentStaff?.phone_number || ''} placeholder="Auto display after staff selection" readOnly />
                  </label>
                </div>
                <p>Choose department first, then choose staff name. Staff ID, email, and phone number will display automatically.</p>
              </section>

              <section className="assignment-form-section">
                <h3>2. Assignment Details</h3>
                <label className="compact-field">
                  <span>Task Title</span>
                  <input
                    value={assignmentForm.task_title}
                    onChange={(event) => updateAssignmentField('task_title', event.target.value)}
                    placeholder="Example: PA System, Registration Counter, Technical Support"
                    required
                  />
                </label>
                <label className="compact-field">
                  <span>Task Description</span>
                  <textarea
                    rows={5}
                    value={assignmentForm.task_description}
                    onChange={(event) => updateAssignmentField('task_description', event.target.value)}
                    placeholder="Enter task description"
                  />
                </label>
                <div className="assignment-auto-status-note">
                  Status is managed automatically: Assigned after saving, In Progress after staff submits attendance, and Completed after the event ends.
                </div>
              </section>

              <section className="assignment-form-section">
                <h3>3. Conflict Check</h3>
                <div className={`assignment-conflict-card is-${assignmentConflict.state}`}>
                  <div>
                    <strong>Assignment Availability</strong>
                    <p>{assignmentConflict.message}</p>
                  </div>
                  <span>{assignmentConflict.state === 'idle' ? 'Select staff first' : formatStatus(assignmentConflict.state)}</span>
                </div>
                {assignmentConflict.conflicts.length > 0 && (
                  <div className="assignment-conflict-list">
                    {assignmentConflict.conflicts.map((item) => (
                      <div key={item.id}>
                        <strong>{item.staff}</strong>
                        <span>{item.event} - {item.task_title} ({formatStatus(item.status)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setAssignmentModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-ocean">Save</button>
            </div>
          </form>
        </div>
      )}

      {assignmentDetailModal && (
        <div className="modal-overlay open">
          <div className="modal-box assignment-detail-modal">
            <div className="modal-header">
              <div className="modal-title">Assignment Details</div>
              <button type="button" className="modal-close" onClick={() => setAssignmentDetailModal(null)}>x</button>
            </div>
            <div className="modal-body assignment-detail-body">
              <div className="assignment-detail-grid">
                <div className="assignment-detail-qr assignment-detail-qr-top">
                  <span>QR Code</span>
                  <div>
                    {assignmentDetailModal.qr_url ? <img src={assignmentDetailModal.qr_url} alt="Assignment QR Code" /> : <QrCode size={120} />}
                  </div>
                  <p>This assignment QR is separate from the normal staff attendance QR.</p>
                </div>
                <ReadOnlyField label="Staff Name" value={assignmentDetailModal.staff_name || selectedAssignmentStaffForDetail?.full_name} />
                <ReadOnlyField label="Employee ID" value={selectedAssignmentStaffForDetail?.staff_id} />
                <ReadOnlyField label="Staff Email" value={selectedAssignmentStaffForDetail?.email} />
                <ReadOnlyField label="Staff Phone Number" value={selectedAssignmentStaffForDetail?.phone_number || assignmentDetailModal.staff_phone_number} />
                <ReadOnlyField label="Department" value={selectedAssignmentStaffForDetail?.department} />
                <ReadOnlyField label="Task Title" value={assignmentDetailModal.task_title} wide />
                <ReadOnlyField label="Task Description" value={assignmentDetailModal.task_description || '-'} wide />
                <ReadOnlyField label="Status" value={formatStatus(selectedAssignmentStatus)} />
                <ReadOnlyField label="Attendance Status" value={selectedAssignmentAttendance ? 'Submitted' : 'Pending'} />
                {selectedAssignmentAttendance && (
                  <>
                    <ReadOnlyField label="IPv4" value={selectedAssignmentAttendance.ipv4_address || '-'} />
                    <ReadOnlyField label="IPv6" value={selectedAssignmentAttendance.ipv6_address || '-'} />
                    <ReadOnlyField label="Latitude" value={selectedAssignmentAttendance.latitude ? formatCoordinate(selectedAssignmentAttendance.latitude) : '-'} />
                    <ReadOnlyField label="Longitude" value={selectedAssignmentAttendance.longitude ? formatCoordinate(selectedAssignmentAttendance.longitude) : '-'} />
                    <ReadOnlyField label="Date" value={selectedAssignmentAttendance.date ? formatNumericDate(selectedAssignmentAttendance.date) : '-'} />
                    <ReadOnlyField label="Time" value={selectedAssignmentAttendance.time ? formatTime12Hour(selectedAssignmentAttendance.time) : '-'} />
                    <ReadOnlyField label="Notes" value={selectedAssignmentAttendance.notes || '-'} wide />
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-blue" onClick={() => openQrForm(`/assignment-attendance/${assignmentDetailModal.id}`)}><ExternalLink size={15} /> Open Form</button>
              {assignmentDetailModal.qr_url && <button type="button" className="btn btn-ocean" onClick={() => downloadQr(assignmentDetailModal.qr_url, `${assignmentDetailModal.task_title || 'assignment'}-qr.png`)}><Download size={15} /> Download QR</button>}
              <button type="button" className="btn btn-ghost" onClick={() => setAssignmentDetailModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {qrModal && (
        <div className="modal-overlay open">
          <div className="modal-box qr-preview-modal">
            <div className="modal-header">
              <div className="modal-title">{qrModal.title}</div>
              <button type="button" className="modal-close" onClick={() => setQrModal(null)}>x</button>
            </div>
            <div className="qr-preview-body">
              <div className="qr-preview-frame">
                <img src={qrModal.qr} alt={qrModal.title} />
              </div>
            </div>
            <div className="modal-footer">
              {qrModal.url && <button type="button" className="btn btn-blue" onClick={() => openQrForm(qrModal.url)}><ExternalLink size={15} /> Open Form</button>}
              <button type="button" className="btn btn-ocean" onClick={() => downloadQr(qrModal.qr, qrModal.filename)}><Download size={15} /> Download</button>
              <button type="button" className="btn btn-ghost" onClick={() => setQrModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </>
  )
}

function InfoBlock({ label, value, strong = false }) {
  return (
    <div className="event-info-block">
      <span>{label}</span>
      <strong className={strong ? 'event-info-strong' : ''}>{value}</strong>
    </div>
  )
}

function ReadOnlyField({ label, value, wide = false }) {
  return (
    <div className={`assignment-readonly-field ${wide ? 'assignment-readonly-wide' : ''}`}>
      <span>{label}</span>
      <p>{value || '-'}</p>
    </div>
  )
}

function AttendanceSection({
  title,
  children,
  searchValue,
  onSearch,
  searchPlaceholder,
  selectValue = '',
  onSelect = () => {},
  selectOptions = [],
  onExport,
  extraAction = null,
}) {
  return (
    <section className="event-attendance-section">
      <div className="event-view-section-label">{title}</div>
      <div className="event-attendance-filter">
        <input value={searchValue} onChange={(event) => onSearch(event.target.value)} placeholder={searchPlaceholder} />
        {selectOptions.length > 0 && (
          <select value={selectValue} onChange={(event) => onSelect(event.target.value)}>
            {selectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        )}
        <button type="button" className="btn btn-ocean"><Search size={15} /> Search</button>
        <button type="button" className="btn btn-ghost" onClick={() => {
          onSearch('')
          onSelect('')
        }}>Reset</button>
        {onExport && <button type="button" className="btn btn-green" onClick={onExport}><Download size={15} /> Export CSV</button>}
        {extraAction}
      </div>
      <div className="event-detail-table">
        {children}
      </div>
      <div className="event-section-pagination">Page 1 of 1</div>
    </section>
  )
}
