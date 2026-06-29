import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, MapPin } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { apiRequest } from '../api/client.js'

const departmentOptions = [
  'Administration (ADM)',
  'Internal Audit (AUD)',
  'Human Resource Management (HRM)',
  'Information and Communication Technology (ICT)',
  'Finance (FIN)',
  'Others',
]

function PublicBrand() {
  return (
    <div className="public-brand">
      <div className="portal-mark"><img src="/logo.png" alt="DBKU crest" /></div>
      <div>
        <div className="portal-title">DBKU</div>
        <div className="portal-subtitle">Dewan Bandaraya Kuching Utara</div>
      </div>
    </div>
  )
}

function EventInfo({ event }) {
  return (
    <div className="event-info-box">
      <div className="span-2"><span>Event Name</span><strong>{event.name}</strong></div>
      <div><span>Start Date</span><strong>{event.start_date || '-'}</strong></div>
      <div><span>End Date</span><strong>{event.end_date || '-'}</strong></div>
      <div><span>Start Time</span><strong>{event.start_time || '-'}</strong></div>
      <div><span>End Time</span><strong>{event.end_time || '-'}</strong></div>
      <div><span>Radius</span><strong>{event.radius_meter} m</strong></div>
      <div><span>Location</span><strong>{event.location}</strong></div>
      <div className="span-2"><span>Description</span><strong>{event.description || '-'}</strong></div>
    </div>
  )
}

function useEvent(eventId) {
  const [event, setEvent] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    apiRequest(`/events/${eventId}/`)
      .then((data) => mounted && setEvent(data))
      .catch((err) => mounted && setError(err.message))
    return () => {
      mounted = false
    }
  }, [eventId])

  return { event, error }
}

async function withLocation(callback) {
  if (!navigator.geolocation) {
    throw new Error('Please enable location/GPS and try again.')
  }
  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000,
    })
  })
  return callback({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  })
}

function PublicFormShell({ type, title, subtitle, event, children, message, error }) {
  return (
    <div className="public-form-screen">
      <div className="public-form-wrap">
        <PublicBrand />
        <div className="public-card">
          <div className="login-hero">
            <div className="login-badge">{type}</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <EventInfo event={event} />
          <div className="public-form-body">
            {children}
            <div className="gps-note"><MapPin size={17} /> Location access is required to verify you are within the allowed radius.</div>
            {error && <div className="alert-error">{error}</div>}
            {message && <div className="alert-success"><CheckCircle2 size={18} /> {message}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function StaffAttendanceFormPage() {
  const { eventId } = useParams()
  const { event, error: loadError } = useEvent(eventId)
  const [form, setForm] = useState({ full_name: '', staff_id: '', phone_number: '', email: '', department: '', other_department: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const department = form.department === 'Others' ? form.other_department : form.department

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(submitEvent) {
    submitEvent.preventDefault()
    setError('')
    setMessage('')
    try {
      await withLocation((coords) => apiRequest('/staff-attendance/', {
        method: 'POST',
        body: JSON.stringify({ ...form, department, event: eventId, ...coords }),
      }))
      setMessage('Attendance submitted successfully.')
      setForm({ full_name: '', staff_id: '', phone_number: '', email: '', department: '', other_department: '' })
    } catch (err) {
      setError(err.message)
    }
  }

  if (loadError) return <div className="screen-center"><div className="alert-error">{loadError}</div></div>
  if (!event) return <div className="screen-center"><div className="panel">Loading event</div></div>

  return (
    <PublicFormShell type="Staff" title="Attendance Registration" subtitle="Fill in your details to register attendance for this event" event={event} error={error} message={message}>
      <form className="stack-form" onSubmit={submit}>
        <label className="compact-field"><span>Full Name</span><input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required /></label>
        <label className="compact-field"><span>Employee ID</span><input value={form.staff_id} onChange={(e) => update('staff_id', e.target.value)} required /></label>
        <label className="compact-field"><span>Phone Number</span><input value={form.phone_number} onChange={(e) => update('phone_number', e.target.value)} required /></label>
        <label className="compact-field"><span>Email Address</span><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required /></label>
        <label className="compact-field">
          <span>Department</span>
          <select value={form.department} onChange={(e) => update('department', e.target.value)} required>
            <option value="">-- Select department --</option>
            {departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        {form.department === 'Others' && <label className="compact-field"><span>Please Specify Department</span><input value={form.other_department} onChange={(e) => update('other_department', e.target.value)} required /></label>}
        <button type="submit" className="primary-button portal-login-button"><CheckCircle2 size={20} /> Submit</button>
      </form>
    </PublicFormShell>
  )
}

export function VisitorAttendanceFormPage() {
  const { eventId } = useParams()
  const { event, error: loadError } = useEvent(eventId)
  const [form, setForm] = useState({ full_name: '', phone_number: '', email: '', organization: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(submitEvent) {
    submitEvent.preventDefault()
    setError('')
    setMessage('')
    try {
      await withLocation(async (coords) => {
        const visitor = await apiRequest('/visitors/', { method: 'POST', body: JSON.stringify(form) })
        return apiRequest('/visitor-attendance/', {
          method: 'POST',
          body: JSON.stringify({ visitor: visitor.id, event: eventId, ...coords }),
        })
      })
      setMessage('Visitor attendance submitted successfully.')
      setForm({ full_name: '', phone_number: '', email: '', organization: '' })
    } catch (err) {
      setError(err.message)
    }
  }

  if (loadError) return <div className="screen-center"><div className="alert-error">{loadError}</div></div>
  if (!event) return <div className="screen-center"><div className="panel">Loading event</div></div>

  return (
    <PublicFormShell type="Visitor" title="Visitor Attendance" subtitle="Register visitor attendance for this event" event={event} error={error} message={message}>
      <form className="stack-form" onSubmit={submit}>
        <label className="compact-field"><span>Full Name</span><input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required /></label>
        <label className="compact-field"><span>Phone Number</span><input value={form.phone_number} onChange={(e) => update('phone_number', e.target.value)} required /></label>
        <label className="compact-field"><span>Email Address</span><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required /></label>
        <label className="compact-field"><span>Organization</span><input value={form.organization} onChange={(e) => update('organization', e.target.value)} required /></label>
        <button type="submit" className="primary-button portal-login-button"><CheckCircle2 size={20} /> Submit</button>
      </form>
    </PublicFormShell>
  )
}

export function PassportAttendanceFormPage() {
  const { eventId } = useParams()
  const { event, error: loadError } = useEvent(eventId)
  const [form, setForm] = useState({ full_name: '', passport_number: '', country: '', date_of_birth: '', expiry_date: '', gender: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [ocrNote, setOcrNote] = useState('')

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(submitEvent) {
    submitEvent.preventDefault()
    setError('')
    setMessage('')
    try {
      await withLocation(async (coords) => {
        const visitor = await apiRequest('/passport-visitors/', { method: 'POST', body: JSON.stringify(form) })
        return apiRequest('/passport-attendance/', {
          method: 'POST',
          body: JSON.stringify({ passport_visitor: visitor.id, event: eventId, ...coords }),
        })
      })
      setMessage('Passport attendance submitted successfully.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function uploadPassportImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setOcrNote('Scanning passport image...')
    try {
      const body = new FormData()
      body.append('image', file)
      const data = await apiRequest('/passport-visitors/ocr-preview/', { method: 'POST', body })
      setForm((current) => ({
        ...current,
        full_name: data.full_name || [data.first_name, data.last_name].filter(Boolean).join(' ') || current.full_name,
        passport_number: data.passport_number || current.passport_number,
        country: data.nationality || data.country_code || current.country,
        date_of_birth: data.date_of_birth || current.date_of_birth,
        expiry_date: data.date_of_expiry || current.expiry_date,
        gender: data.sex || current.gender,
      }))
      setOcrNote(data.image_quality_note || 'Passport scanned. Please verify the extracted fields before submitting.')
    } catch (err) {
      setOcrNote('')
      setError(err.message)
    }
  }

  if (loadError) return <div className="screen-center"><div className="alert-error">{loadError}</div></div>
  if (!event) return <div className="screen-center"><div className="panel">Loading event</div></div>

  return (
    <PublicFormShell type="Passport" title="Non-Malaysian Visitor Attendance" subtitle="Upload OCR support will be ported from the prototype next" event={event} error={error} message={message}>
      <form className="stack-form" onSubmit={submit}>
        <label className="compact-field"><span>Passport Image</span><input type="file" accept="image/*" onChange={uploadPassportImage} /></label>
        {ocrNote && <div className="requirement-box">{ocrNote}</div>}
        <label className="compact-field"><span>Full Name</span><input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required /></label>
        <label className="compact-field"><span>Passport Number</span><input value={form.passport_number} onChange={(e) => update('passport_number', e.target.value)} required /></label>
        <div className="form-grid-2">
          <label className="compact-field"><span>Country</span><input value={form.country} onChange={(e) => update('country', e.target.value)} /></label>
          <label className="compact-field"><span>Gender</span><input value={form.gender} onChange={(e) => update('gender', e.target.value)} /></label>
        </div>
        <div className="form-grid-2">
          <label className="compact-field"><span>Date of Birth</span><input value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} /></label>
          <label className="compact-field"><span>Expiry Date</span><input value={form.expiry_date} onChange={(e) => update('expiry_date', e.target.value)} /></label>
        </div>
        <button type="submit" className="primary-button portal-login-button"><CheckCircle2 size={20} /> Submit</button>
      </form>
    </PublicFormShell>
  )
}

export function AssignmentAttendanceFormPage() {
  const { assignmentId } = useParams()
  const [assignment, setAssignment] = useState(null)
  const [form, setForm] = useState({ full_name: '', staff_id: '', phone_number: '', email: '', notes: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest(`/event-assignments/${assignmentId}/`).then(setAssignment).catch((err) => setError(err.message))
  }, [assignmentId])

  const event = useMemo(() => ({
    name: assignment?.event_name || 'Assigned Task',
    location: '-',
    radius_meter: '-',
  }), [assignment])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(submitEvent) {
    submitEvent.preventDefault()
    setError('')
    setMessage('')
    try {
      await withLocation((coords) => apiRequest('/assignment-attendance/', {
        method: 'POST',
        body: JSON.stringify({ ...form, assignment: assignmentId, ...coords }),
      }))
      setMessage('Assignment attendance submitted successfully.')
    } catch (err) {
      setError(err.message)
    }
  }

  if (!assignment && !error) return <div className="screen-center"><div className="panel">Loading assignment</div></div>

  return (
    <PublicFormShell type="Assignment" title={assignment?.task_title || 'Assignment Attendance'} subtitle={assignment?.staff_name || 'Register assigned task attendance'} event={event} error={error} message={message}>
      <form className="stack-form" onSubmit={submit}>
        <label className="compact-field"><span>Full Name</span><input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required /></label>
        <label className="compact-field"><span>Staff ID</span><input value={form.staff_id} onChange={(e) => update('staff_id', e.target.value)} required /></label>
        <label className="compact-field"><span>Phone Number</span><input value={form.phone_number} onChange={(e) => update('phone_number', e.target.value)} required /></label>
        <label className="compact-field"><span>Email Address</span><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required /></label>
        <label className="compact-field"><span>Notes</span><textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={4} /></label>
        <button type="submit" className="primary-button portal-login-button"><CheckCircle2 size={20} /> Submit</button>
      </form>
    </PublicFormShell>
  )
}
