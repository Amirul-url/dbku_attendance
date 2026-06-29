import { useRef, useState } from 'react'
import { CalendarDays, CalendarPlus, Search } from 'lucide-react'
import { apiRequest } from '../api/client.js'
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
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [dateSearch, setDateSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyEvent)
  const dateInputRef = useRef(null)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function openCreate() {
    setForm(emptyEvent)
    setModal({ mode: 'create' })
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
      <div className="table-card">
        <div className="table-card-header">
          <div>
            <div className="table-card-title">Events List</div>
            <div className="table-card-sub">All available events in the system</div>
          </div>
        </div>
        <DataTable
          rows={[]}
          columns={[
            { key: 'name', label: 'Event Name' },
            { key: 'location', label: 'Location' },
            { key: 'period', label: 'Period' },
            { key: 'description', label: 'Description' },
            { key: 'geofence', label: 'Geofence' },
            { key: 'actions', label: 'Actions' },
          ]}
        />
      </div>

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
