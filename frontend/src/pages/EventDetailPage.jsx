import { useEffect, useState } from 'react'
import { ArrowLeft, ClipboardList, Download, Edit, ExternalLink, Plus, QrCode, Trash2, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest, downloadApiFile, listFromResponse } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'

export function EventDetailPage() {
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [staffAttendance, setStaffAttendance] = useState([])
  const [visitorAttendance, setVisitorAttendance] = useState([])
  const [passportAttendance, setPassportAttendance] = useState([])
  const [assignments, setAssignments] = useState([])
  const [staff, setStaff] = useState([])
  const [assignmentModal, setAssignmentModal] = useState(null)
  const [assignmentForm, setAssignmentForm] = useState({ staff_member: '', task_title: '', task_description: '', assignment_status: 'assigned' })
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [eventData, staffAttendanceData, visitorData, passportData, assignmentData, staffData] = await Promise.all([
          apiRequest(`/events/${id}/`),
          apiRequest(`/staff-attendance/?event=${id}`),
          apiRequest(`/visitor-attendance/?event=${id}`),
          apiRequest(`/passport-attendance/?event=${id}`),
          apiRequest(`/event-assignments/?event=${id}`),
          apiRequest('/staff/'),
        ])
        if (!mounted) return
        setEvent(eventData)
        setStaffAttendance(listFromResponse(staffAttendanceData))
        setVisitorAttendance(listFromResponse(visitorData))
        setPassportAttendance(listFromResponse(passportData))
        setAssignments(listFromResponse(assignmentData))
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

  function openAssignmentCreate() {
    setAssignmentForm({ staff_member: '', task_title: '', task_description: '', assignment_status: 'assigned' })
    setAssignmentModal({ mode: 'create' })
  }

  function openAssignmentEdit(row) {
    setAssignmentForm({
      staff_member: row.staff_member || '',
      task_title: row.task_title || '',
      task_description: row.task_description || '',
      assignment_status: row.assignment_status || 'assigned',
    })
    setAssignmentModal({ mode: 'edit', id: row.id })
  }

  async function saveAssignment(event) {
    event.preventDefault()
    setError('')
    try {
      const payload = { ...assignmentForm, event: id }
      if (assignmentModal.mode === 'create') {
        await apiRequest('/event-assignments/', { method: 'POST', body: JSON.stringify(payload) })
      } else {
        await apiRequest(`/event-assignments/${assignmentModal.id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
      }
      setAssignmentModal(null)
      setAssignments(listFromResponse(await apiRequest(`/event-assignments/?event=${id}`)))
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteAssignment(row) {
    if (!window.confirm(`Delete assignment "${row.task_title}"?`)) return
    setError('')
    try {
      await apiRequest(`/event-assignments/${row.id}/`, { method: 'DELETE' })
      setAssignments(listFromResponse(await apiRequest(`/event-assignments/?event=${id}`)))
    } catch (err) {
      setError(err.message)
    }
  }

  if (error) return <div className="alert-error">{error}</div>
  if (!event) return <div className="panel">Loading event</div>

  const publicLinks = [
    { label: 'Staff Attendance', url: `/staff-attendance/${id}`, qr: event.staff_qr_url },
    { label: 'Visitor Attendance', url: `/visitor-attendance/${id}`, qr: event.visitor_qr_url },
    { label: 'Passport Attendance', url: `/passport-attendance/${id}`, qr: event.passport_qr_url },
  ]
  const exportLinks = [
    { label: 'Summary', path: `/reports/events/${id}/export/summary/` },
    { label: 'Staff', path: `/reports/events/${id}/export/staff/` },
    { label: 'Visitor', path: `/reports/events/${id}/export/visitor/` },
    { label: 'Passport', path: `/reports/events/${id}/export/passport/` },
    { label: 'Assignment', path: `/reports/events/${id}/export/assignment/` },
  ]

  return (
    <>
      <Link className="back-link" to="/events"><ArrowLeft size={15} /> Back to Events</Link>
      <div className="page-header">
        <div>
          <h1>{event.name}</h1>
          <div className="page-sub">{event.location}</div>
        </div>
      </div>

      <div className="detail-grid">
        <section className="table-card detail-panel">
          <div className="table-card-header">
            <div>
              <div className="table-card-title">Event Information</div>
              <div className="table-card-sub">Schedule, location, and geofence settings</div>
            </div>
          </div>
          <div className="detail-list">
            <div><span>Start Date</span><strong>{event.start_date || '-'}</strong></div>
            <div><span>End Date</span><strong>{event.end_date || '-'}</strong></div>
            <div><span>Start Time</span><strong>{event.start_time || '-'}</strong></div>
            <div><span>End Time</span><strong>{event.end_time || '-'}</strong></div>
            <div><span>Radius</span><strong>{event.radius_meter} m</strong></div>
            <div><span>Coordinates</span><strong>{event.latitude && event.longitude ? `${event.latitude}, ${event.longitude}` : '-'}</strong></div>
            <div className="span-2"><span>Description</span><strong>{event.description || '-'}</strong></div>
          </div>
        </section>

        <section className="table-card detail-panel">
          <div className="table-card-header">
          <div>
            <div className="table-card-title">QR Attendance Links</div>
            <div className="table-card-sub">Use these while QR image generation is being ported</div>
          </div>
          </div>
          <div className="qr-link-grid">
            {publicLinks.map((item) => (
              <a key={item.url} className="qr-link-card" href={item.url} target="_blank" rel="noreferrer">
                {item.qr ? <img className="qr-thumb" src={item.qr} alt="" /> : <QrCode size={26} />}
                <span>{item.label}</span>
                <ExternalLink size={16} />
              </a>
            ))}
          </div>
        </section>
      </div>

      <section className="table-card">
        <div className="table-card-header">
          <div>
            <div className="table-card-title"><Download size={15} /> CSV Exports</div>
            <div className="table-card-sub">Same event export categories as the prototype</div>
          </div>
          <div className="button-row">
            {exportLinks.map((item) => (
              <button key={item.path} type="button" className="btn btn-ghost" onClick={() => downloadApiFile(item.path)}>
                <Download size={14} />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="table-card">
        <div className="table-card-header">
          <div>
            <div className="table-card-title"><ClipboardList size={15} /> Assignments</div>
            <div className="table-card-sub">Staff assignments for this event</div>
          </div>
          <button type="button" className="btn btn-ocean" onClick={openAssignmentCreate}><Plus size={15} /> Add Assignment</button>
        </div>
        <DataTable
          rows={assignments}
          columns={[
            { key: 'staff_name', label: 'Staff' },
            { key: 'task_title', label: 'Task' },
            { key: 'assignment_status', label: 'Status' },
            { key: 'qr_url', label: 'QR', render: (row) => row.qr_url ? <a href={row.qr_url} target="_blank" rel="noreferrer">Open</a> : '-' },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="button-row">
                  <button type="button" className="btn btn-small btn-blue" onClick={() => openAssignmentEdit(row)}><Edit size={14} /> Edit</button>
                  <button type="button" className="btn btn-small btn-red" onClick={() => deleteAssignment(row)}><Trash2 size={14} /> Delete</button>
                </div>
              ),
            },
          ]}
        />
      </section>

      <section className="table-card">
        <div className="table-card-header">
          <div>
            <div className="table-card-title"><Users size={15} /> Staff Attendance</div>
            <div className="table-card-sub">{staffAttendance.length} records</div>
          </div>
          <button type="button" className="btn btn-ocean" onClick={() => downloadApiFile(`/reports/events/${id}/export/staff/`)}><Download size={15} /> Export CSV</button>
        </div>
        <DataTable rows={staffAttendance} columns={[
          { key: 'full_name', label: 'Name' },
          { key: 'staff_id', label: 'Staff ID' },
          { key: 'department', label: 'Department' },
          { key: 'date', label: 'Date' },
          { key: 'time', label: 'Time' },
        ]} />
      </section>

      <section className="detail-grid">
        <div className="table-card">
          <div className="table-card-header">
            <div>
              <div className="table-card-title">Visitor Attendance</div>
              <div className="table-card-sub">{visitorAttendance.length} records</div>
            </div>
          </div>
          <DataTable rows={visitorAttendance} columns={[
            { key: 'event_name', label: 'Event' },
            { key: 'date', label: 'Date' },
            { key: 'time', label: 'Time' },
          ]} />
        </div>
        <div className="table-card">
          <div className="table-card-header">
            <div>
              <div className="table-card-title">Passport Attendance</div>
              <div className="table-card-sub">{passportAttendance.length} records</div>
            </div>
          </div>
          <DataTable rows={passportAttendance} columns={[
            { key: 'event_name', label: 'Event' },
            { key: 'date', label: 'Date' },
            { key: 'time', label: 'Time' },
          ]} />
        </div>
      </section>

      {assignmentModal && (
        <div className="modal-overlay open">
          <form className="modal-box" onSubmit={saveAssignment}>
            <div className="modal-header">
              <div className="modal-title">{assignmentModal.mode === 'create' ? 'Add Assignment' : 'Edit Assignment'}</div>
              <button type="button" className="modal-close" onClick={() => setAssignmentModal(null)}>x</button>
            </div>
            <div className="modal-body stack-form">
              <label className="compact-field">
                <span>Staff</span>
                <select value={assignmentForm.staff_member} onChange={(e) => setAssignmentForm((current) => ({ ...current, staff_member: e.target.value }))} required>
                  <option value="">-- Select staff --</option>
                  {staff.map((item) => <option key={item.id} value={item.id}>{item.full_name} - {item.staff_id}</option>)}
                </select>
              </label>
              <label className="compact-field"><span>Task Title</span><input value={assignmentForm.task_title} onChange={(e) => setAssignmentForm((current) => ({ ...current, task_title: e.target.value }))} required /></label>
              <label className="compact-field"><span>Task Description</span><textarea rows={4} value={assignmentForm.task_description} onChange={(e) => setAssignmentForm((current) => ({ ...current, task_description: e.target.value }))} /></label>
              <label className="compact-field">
                <span>Status</span>
                <select value={assignmentForm.assignment_status} onChange={(e) => setAssignmentForm((current) => ({ ...current, assignment_status: e.target.value }))}>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setAssignmentModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-ocean">Save</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
