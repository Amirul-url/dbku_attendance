import { useEffect, useMemo, useState } from 'react'
import { Edit, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiRequest, listFromResponse } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'

const emptyEvent = {
  name: '',
  location: '',
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  description: '',
  latitude: '',
  longitude: '',
  radius_meter: 100,
}

export function EventsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyEvent)

  const filteredRows = useMemo(() => rows.filter((row) => !search || row.name.toLowerCase().includes(search.toLowerCase())), [rows, search])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRows(listFromResponse(await apiRequest('/events/')))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function openCreate() {
    setForm(emptyEvent)
    setModal({ mode: 'create' })
  }

  function openEdit(row) {
    setForm({ ...emptyEvent, ...row, start_time: row.start_time || '', end_time: row.end_time || '', latitude: row.latitude || '', longitude: row.longitude || '' })
    setModal({ mode: 'edit', id: row.id })
  }

  async function saveEvent(event) {
    event.preventDefault()
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value === '' ? null : value]))
    try {
      if (modal.mode === 'create') {
        await apiRequest('/events/', { method: 'POST', body: JSON.stringify(payload) })
      } else {
        await apiRequest(`/events/${modal.id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
      }
      setModal(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteEvent(row) {
    if (!window.confirm(`Delete ${row.name}?`)) return
    try {
      await apiRequest(`/events/${row.id}/`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Events</h1>
          <div className="page-sub">Create, monitor, and manage attendance events.</div>
        </div>
        <button type="button" className="btn btn-ocean" onClick={openCreate}><Plus size={16} /> Create Event</button>
      </div>
      <div className="filter-card">
        <input className="filter-input" placeholder="Search event name" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button type="button" className="btn btn-ocean">Filter</button>
        <button type="button" className="btn btn-ghost" onClick={() => setSearch('')}>Reset</button>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {loading ? (
        <div className="panel">Loading</div>
      ) : (
        <div className="table-card">
          <div className="table-card-header">
            <div>
              <div className="table-card-title">Event List</div>
              <div className="table-card-sub">All attendance events in the system</div>
            </div>
          </div>
          <DataTable
            rows={filteredRows}
            columns={[
              { key: 'name', label: 'Event' },
              { key: 'location', label: 'Location' },
              { key: 'start_date', label: 'Start' },
              { key: 'end_date', label: 'End' },
              { key: 'radius_meter', label: 'Radius' },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => (
                  <div className="button-row">
                    <Link className="btn btn-ocean btn-small" to={`/events/${row.id}`}><ExternalLink size={14} /> View</Link>
                    <button type="button" className="btn btn-small btn-blue" onClick={() => openEdit(row)}><Edit size={14} /> Edit</button>
                    <button type="button" className="btn btn-small btn-red" onClick={() => deleteEvent(row)}><Trash2 size={14} /> Delete</button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {modal && (
        <div className="modal-overlay open">
          <form className="modal-box modal-wide" onSubmit={saveEvent}>
            <div className="modal-header">
              <div className="modal-title">{modal.mode === 'create' ? 'Create Event' : 'Edit Event'}</div>
              <button type="button" className="modal-close" onClick={() => setModal(null)}>x</button>
            </div>
            <div className="modal-body stack-form">
              <label className="compact-field"><span>Event Name</span><input value={form.name} onChange={(e) => update('name', e.target.value)} required /></label>
              <label className="compact-field"><span>Location</span><input value={form.location} onChange={(e) => update('location', e.target.value)} required /></label>
              <div className="form-grid-2">
                <label className="compact-field"><span>Start Date</span><input type="date" value={form.start_date || ''} onChange={(e) => update('start_date', e.target.value)} required /></label>
                <label className="compact-field"><span>End Date</span><input type="date" value={form.end_date || ''} onChange={(e) => update('end_date', e.target.value)} required /></label>
              </div>
              <div className="form-grid-2">
                <label className="compact-field"><span>Start Time</span><input type="time" value={form.start_time || ''} onChange={(e) => update('start_time', e.target.value)} /></label>
                <label className="compact-field"><span>End Time</span><input type="time" value={form.end_time || ''} onChange={(e) => update('end_time', e.target.value)} /></label>
              </div>
              <div className="form-grid-2">
                <label className="compact-field"><span>Latitude</span><input value={form.latitude || ''} onChange={(e) => update('latitude', e.target.value)} /></label>
                <label className="compact-field"><span>Longitude</span><input value={form.longitude || ''} onChange={(e) => update('longitude', e.target.value)} /></label>
              </div>
              <label className="compact-field"><span>Radius Meter</span><input type="number" min="1" value={form.radius_meter} onChange={(e) => update('radius_meter', e.target.value)} /></label>
              <label className="compact-field"><span>Description</span><textarea value={form.description || ''} onChange={(e) => update('description', e.target.value)} rows={4} /></label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-ocean">Save</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
