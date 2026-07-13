import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, Eye, Search, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest, downloadApiFile, listFromResponse } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatCoordinate(value) {
  const number = toNumber(value)
  return number === null ? '-' : number.toFixed(6)
}

function formatShortDate(value) {
  if (!value) return '-'
  const [year, month, day] = String(value).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function formatDisplayTime(value) {
  if (!value) return '-'
  return String(value).slice(0, 5)
}

function formatPhoneNumber(value) {
  if (!value) return '-'
  const digits = String(value).replace(/\D/g, '')
  if (digits.startsWith('60')) return `Malaysia +60 ${digits.slice(2)}`.trim()
  return value
}

function renderTimestamp(row) {
  return (
    <span className="event-timestamp-cell">
      <strong>{formatShortDate(row.date)}</strong>
      <span>{formatDisplayTime(row.time)}</span>
    </span>
  )
}

export function EventVisitorAttendancePage() {
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [organization, setOrganization] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedRow, setSelectedRow] = useState(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [eventData, attendanceData] = await Promise.all([
          apiRequest(`/events/${id}/`),
          apiRequest(`/visitor-attendance/?event=${id}`),
        ])
        if (!mounted) return
        setEvent(eventData)
        setRows(listFromResponse(attendanceData))
      } catch (err) {
        if (mounted) setError(err.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [id])

  const organizationOptions = useMemo(() => {
    const values = new Set()
    rows.forEach((row) => {
      const value = row.visitor_detail?.organization?.trim()
      if (value) values.add(value)
    })
    return [
      { value: '', label: 'All Organizations' },
      ...Array.from(values).sort().map((value) => ({ value, label: value })),
    ]
  }, [rows])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const visitor = row.visitor_detail || {}
      const matchesSearch = !query
        || visitor.full_name?.toLowerCase().includes(query)
        || visitor.email?.toLowerCase().includes(query)
        || visitor.phone_number?.toLowerCase().includes(query)
      const matchesOrganization = !organization || visitor.organization === organization
      return matchesSearch && matchesOrganization
    })
  }, [organization, rows, search])

  return (
    <>
      <Link className="back-link" to={`/events/${id}`}><ArrowLeft size={15} /> Back to Event</Link>

      <div className="attendance-records-header">
        <div>
          <h2>Visitor Attendance (Malaysian)</h2>
          <p>{event?.name || 'Event visitor attendance list'}</p>
        </div>
        <div className="attendance-total-pill"><Users size={16} /> Total: {filteredRows.length}</div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="event-attendance-section">
        <div className="event-view-section-label">{loading ? 'Loading Visitor Attendance' : 'Visitor Attendance (Malaysian)'}</div>
        <div className="event-attendance-filter">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search visitor name" />
          <select value={organization} onChange={(event) => setOrganization(event.target.value)}>
            {organizationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" className="btn btn-ocean"><Search size={15} /> Search</button>
          <button type="button" className="btn btn-ghost" onClick={() => {
            setSearch('')
            setOrganization('')
          }}>Reset</button>
          <button type="button" className="btn btn-green" onClick={() => downloadApiFile(`/reports/events/${id}/export/visitor/`)}><Download size={15} /> Export CSV</button>
        </div>
        <div className="event-detail-table">
          <DataTable
            rows={filteredRows}
            columns={[
              { key: 'name', label: 'Name', render: (row) => row.visitor_detail?.full_name || '-' },
              { key: 'phone', label: 'Phone', render: (row) => formatPhoneNumber(row.visitor_detail?.phone_number) },
              { key: 'email', label: 'Email', render: (row) => row.visitor_detail?.email || '-' },
              { key: 'organization', label: 'Organization', render: (row) => row.visitor_detail?.organization || '-' },
              { key: 'ipv4_address', label: 'IPv4', render: (row) => row.ipv4_address || '-' },
              { key: 'ipv6_address', label: 'IPv6', render: (row) => row.ipv6_address || '-' },
              { key: 'timestamp', label: 'Timestamp', render: renderTimestamp },
              { key: 'latitude', label: 'Latitude', render: (row) => formatCoordinate(row.latitude) },
              { key: 'longitude', label: 'Longitude', render: (row) => formatCoordinate(row.longitude) },
              {
                key: 'actions',
                label: 'Action',
                render: (row) => (
                  <button type="button" className="btn btn-small btn-green" onClick={() => setSelectedRow(row)}><Eye size={14} /> View</button>
                ),
              },
            ]}
          />
        </div>
        <div className="event-section-pagination">Page 1 of 1</div>
      </section>

      {selectedRow && (
        <div className="modal-backdrop">
          <div className="modal-box visitor-attendance-modal">
            <div className="modal-header">
              <div className="modal-title">View Visitor Attendance</div>
              <button type="button" className="icon-button" onClick={() => setSelectedRow(null)}>x</button>
            </div>
            <div className="modal-body visitor-modal-grid">
              <label className="compact-field"><span>Full Name</span><input readOnly value={selectedRow.visitor_detail?.full_name || ''} /></label>
              <label className="compact-field"><span>Phone Number</span><input readOnly value={formatPhoneNumber(selectedRow.visitor_detail?.phone_number)} /></label>
              <label className="compact-field"><span>Email</span><input readOnly value={selectedRow.visitor_detail?.email || ''} /></label>
              <label className="compact-field"><span>Organization</span><input readOnly value={selectedRow.visitor_detail?.organization || ''} /></label>
              <label className="compact-field"><span>IPv4 Address</span><input readOnly value={selectedRow.ipv4_address || ''} /></label>
              <label className="compact-field"><span>IPv6 Address</span><input readOnly value={selectedRow.ipv6_address || ''} /></label>
              <label className="compact-field"><span>Attendance Date</span><input readOnly value={formatShortDate(selectedRow.date)} /></label>
              <label className="compact-field"><span>Attendance Time</span><input readOnly value={formatDisplayTime(selectedRow.time)} /></label>
              <label className="compact-field"><span>Latitude</span><input readOnly value={formatCoordinate(selectedRow.latitude)} /></label>
              <label className="compact-field"><span>Longitude</span><input readOnly value={formatCoordinate(selectedRow.longitude)} /></label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedRow(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
