import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, Eye, Pencil, Search, Trash2, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest, downloadApiFile, listFromResponse } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'
import { formatTime12Hour } from '../utils/dateTime.js'

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

function formatPhoneNumber(value) {
  if (!value) return '-'
  const digits = String(value).replace(/\D/g, '')
  if (digits.startsWith('60')) return `Malaysia +${digits}`
  return value
}

function renderTimestamp(row) {
  return (
    <span className="event-timestamp-cell">
      <strong>{formatShortDate(row.date)}</strong>
      <span>{formatTime12Hour(row.time)}</span>
    </span>
  )
}

export function EventVisitorAttendancePage() {
  const { id } = useParams()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [organization, setOrganization] = useState('')
  const [error, setError] = useState('')
  const [selectedRow, setSelectedRow] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      setError('')
      try {
        const attendanceData = await apiRequest(`/visitor-attendance/?event=${id}`)
        if (!mounted) return
        setRows(listFromResponse(attendanceData))
      } catch (err) {
        if (mounted) setError(err.message)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [id])

  async function deleteAttendance(row) {
    const visitorName = row.visitor_detail?.full_name || 'this attendance record'
    if (!window.confirm(`Delete attendance for ${visitorName}?`)) return
    setError('')
    try {
      await apiRequest(`/visitor-attendance/${row.id}/`, { method: 'DELETE' })
      setRows((current) => current.filter((item) => item.id !== row.id))
      if (selectedRow?.id === row.id) setSelectedRow(null)
      if (editRow?.id === row.id) setEditRow(null)
    } catch (err) {
      setError(err.message)
    }
  }

  function openEdit(row) {
    setEditRow(row)
    setEditForm({
      full_name: row.visitor_detail?.full_name || '',
      phone_number: row.visitor_detail?.phone_number || '',
      email: row.visitor_detail?.email || '',
      organization: row.visitor_detail?.organization || '',
      ipv4_address: row.ipv4_address || '',
      ipv6_address: row.ipv6_address || '',
      latitude: row.latitude || '',
      longitude: row.longitude || '',
    })
  }

  function updateEdit(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  async function saveEdit(event) {
    event.preventDefault()
    if (!editRow || !editForm) return
    setIsSaving(true)
    setError('')
    try {
      const updated = await apiRequest(`/visitor-attendance/${editRow.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          ipv4_address: editForm.ipv4_address || null,
          ipv6_address: editForm.ipv6_address || null,
          latitude: editForm.latitude || null,
          longitude: editForm.longitude || null,
          visitor_detail: {
            full_name: editForm.full_name,
            phone_number: editForm.phone_number,
            email: editForm.email,
            organization: editForm.organization,
          },
        }),
      })
      setRows((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setEditRow(null)
      setEditForm(null)
      if (selectedRow?.id === updated.id) setSelectedRow(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

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
        </div>
        <div className="attendance-total-pill"><Users size={16} /> Total: {filteredRows.length}</div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="event-attendance-section">
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
        <div className="event-detail-table attendance-table-card visitor-attendance-table">
          <DataTable
            rows={filteredRows}
            columns={[
              { key: 'name', label: 'Name', render: (row) => <span className="table-ellipsis" title={row.visitor_detail?.full_name}>{row.visitor_detail?.full_name || '-'}</span> },
              { key: 'phone', label: 'Phone', render: (row) => <span className="table-ellipsis" title={formatPhoneNumber(row.visitor_detail?.phone_number)}>{formatPhoneNumber(row.visitor_detail?.phone_number)}</span> },
              { key: 'email', label: 'Email', render: (row) => <span className="table-ellipsis" title={row.visitor_detail?.email}>{row.visitor_detail?.email || '-'}</span> },
              { key: 'organization', label: 'Organization', render: (row) => <span className="table-ellipsis" title={row.visitor_detail?.organization}>{row.visitor_detail?.organization || '-'}</span> },
              { key: 'ipv4_address', label: 'IPv4', render: (row) => row.ipv4_address || '-' },
              { key: 'ipv6_address', label: 'IPv6', render: (row) => row.ipv6_address || '-' },
              { key: 'timestamp', label: 'Timestamp', render: renderTimestamp },
              { key: 'latitude', label: 'Latitude', render: (row) => formatCoordinate(row.latitude) },
              { key: 'longitude', label: 'Longitude', render: (row) => formatCoordinate(row.longitude) },
              {
                key: 'actions',
                label: 'Action',
                render: (row) => (
                  <div className="button-row event-action-row">
                    <button type="button" className="btn btn-small btn-icon btn-green" title="View" aria-label="View visitor attendance" onClick={() => setSelectedRow(row)}><Eye size={15} /></button>
                    <button type="button" className="btn btn-small btn-icon btn-blue" title="Edit" aria-label="Edit visitor attendance" onClick={() => openEdit(row)}><Pencil size={15} /></button>
                    <button type="button" className="btn btn-small btn-icon btn-red" title="Delete" aria-label="Delete visitor attendance" onClick={() => deleteAttendance(row)}><Trash2 size={15} /></button>
                  </div>
                ),
              },
            ]}
          />
        </div>
        <div className="event-section-pagination">Page 1 of 1</div>
      </section>

      {selectedRow && (
        <div className="modal-overlay open">
          <div className="modal-box visitor-attendance-modal">
            <div className="modal-header">
              <div className="modal-title">View Visitor Attendance</div>
              <button type="button" className="modal-close" onClick={() => setSelectedRow(null)}>x</button>
            </div>
            <div className="modal-body visitor-modal-grid">
              <label className="compact-field"><span>Full Name</span><input readOnly value={selectedRow.visitor_detail?.full_name || ''} /></label>
              <label className="compact-field"><span>Phone Number</span><input readOnly value={formatPhoneNumber(selectedRow.visitor_detail?.phone_number)} /></label>
              <label className="compact-field"><span>Email</span><input readOnly value={selectedRow.visitor_detail?.email || ''} /></label>
              <label className="compact-field"><span>Organization</span><input readOnly value={selectedRow.visitor_detail?.organization || ''} /></label>
              <label className="compact-field"><span>IPv4 Address</span><input readOnly value={selectedRow.ipv4_address || ''} /></label>
              <label className="compact-field"><span>IPv6 Address</span><input readOnly value={selectedRow.ipv6_address || ''} /></label>
              <label className="compact-field"><span>Attendance Date</span><input readOnly value={formatShortDate(selectedRow.date)} /></label>
              <label className="compact-field"><span>Attendance Time</span><input readOnly value={formatTime12Hour(selectedRow.time)} /></label>
              <label className="compact-field"><span>Latitude</span><input readOnly value={formatCoordinate(selectedRow.latitude)} /></label>
              <label className="compact-field"><span>Longitude</span><input readOnly value={formatCoordinate(selectedRow.longitude)} /></label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedRow(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editRow && editForm && (
        <div className="modal-overlay open">
          <div className="modal-box visitor-attendance-modal">
            <div className="modal-header">
              <div className="modal-title">Edit Visitor Attendance</div>
              <button type="button" className="modal-close" onClick={() => setEditRow(null)}>x</button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="modal-body visitor-modal-grid">
                <label className="compact-field"><span>Full Name</span><input value={editForm.full_name} onChange={(event) => updateEdit('full_name', event.target.value)} required /></label>
                <label className="compact-field"><span>Phone Number</span><input value={editForm.phone_number} onChange={(event) => updateEdit('phone_number', event.target.value)} required /></label>
                <label className="compact-field"><span>Email</span><input type="email" value={editForm.email} onChange={(event) => updateEdit('email', event.target.value)} required /></label>
                <label className="compact-field"><span>Organization</span><input value={editForm.organization} onChange={(event) => updateEdit('organization', event.target.value)} required /></label>
                <label className="compact-field"><span>IPv4 Address</span><input value={editForm.ipv4_address} onChange={(event) => updateEdit('ipv4_address', event.target.value)} /></label>
                <label className="compact-field"><span>IPv6 Address</span><input value={editForm.ipv6_address} onChange={(event) => updateEdit('ipv6_address', event.target.value)} /></label>
                <label className="compact-field"><span>Latitude</span><input value={editForm.latitude} onChange={(event) => updateEdit('latitude', event.target.value)} /></label>
                <label className="compact-field"><span>Longitude</span><input value={editForm.longitude} onChange={(event) => updateEdit('longitude', event.target.value)} /></label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditRow(null)}>Cancel</button>
                <button type="submit" className="btn btn-ocean" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
