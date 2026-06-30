import { useEffect, useMemo, useState } from 'react'
import { Building2, CheckCircle2, ChevronDown, ClipboardCheck, Mail, MapPin, Phone, ShieldCheck, User } from 'lucide-react'
import { getCountries, getCountryCallingCode } from 'libphonenumber-js'
import { useParams } from 'react-router-dom'
import { apiRequest } from '../api/client.js'

const departmentOptions = [
  'Administration (ADM)',
  'Internal Audit (AUD)',
  'Building (BLG)',
  'Community Development & Services (CDS)',
  'Contract and Procurement (COP)',
  'Committee Secretariat (CTS)',
  'Engineering Project (ENG)',
  'Enforcement and Security (ENS)',
  'Health and Environment (ENV)',
  'Finance (FIN)',
  'Geoinformation and Property Management (GPM)',
  'Human Resource Management (HRM)',
  'Information and Communication Technology (ICT)',
  'Infrastructure Maintenance (IMT)',
  'Information Resource (IRD)',
  'Legal Affairs (LAW)',
  'Licensing (LES)',
  'Landscape and Planning (LNP)',
  'Mechanical and Electrical (MNE)',
  'Public Relations (PRD)',
  'Special Project & Public Facility (SPF)',
  'Transformation and Innovation (TRI)',
  'Valuation and Taxation (VAL)',
  'Others',
]

const organizationOptions = [
  'Student (School / University)',
  'Government Agency',
  'Private Company',
  'Community / NGO',
  'Visitor / Guest',
  'Others',
]

const countryNameFormatter = new Intl.DisplayNames(['en'], { type: 'region' })
const priorityCountries = ['MY', 'SG', 'ID', 'BN', 'TH', 'AU', 'CN', 'IN', 'GB', 'US', 'CA']
const countryCodeOptions = getCountries()
  .map((iso) => ({
    country: countryNameFormatter.of(iso) || iso,
    code: `+${getCountryCallingCode(iso)}`,
    iso,
  }))
  .sort((a, b) => {
    const priorityA = priorityCountries.indexOf(a.iso)
    const priorityB = priorityCountries.indexOf(b.iso)
    if (priorityA !== -1 || priorityB !== -1) {
      return (priorityA === -1 ? 999 : priorityA) - (priorityB === -1 ? 999 : priorityB)
    }
    return a.country.localeCompare(b.country)
  })

function splitPhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '')
  const matchedCountry = [...countryCodeOptions]
    .sort((a, b) => b.code.length - a.code.length)
    .find((option) => digits.startsWith(option.code.replace(/\D/g, '')))
  const countryCode = matchedCountry?.code || '+60'
  const countryDigits = countryCode.replace(/\D/g, '')
  return {
    countryCode,
    localNumber: digits.startsWith(countryDigits) ? digits.slice(countryDigits.length) : digits,
  }
}

function combinePhoneNumber(countryCode, localNumber) {
  const cleanLocalNumber = String(localNumber || '').replace(/\D/g, '')
  if (!cleanLocalNumber) return ''
  return `${String(countryCode || '+60').replace(/\D/g, '')}${cleanLocalNumber}`
}

function PhoneNumberSelectInput({ value, onChange, required = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { countryCode, localNumber } = splitPhoneNumber(value)
  const selectedCountry = countryCodeOptions.find((option) => option.code === countryCode) || countryCodeOptions[0]
  const filteredCountries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return countryCodeOptions
    return countryCodeOptions.filter((option) => (
      option.country.toLowerCase().includes(normalizedQuery)
      || option.code.includes(normalizedQuery)
      || option.iso.toLowerCase().includes(normalizedQuery)
    ))
  }, [query])

  function updatePhone(nextCountryCode, nextLocalNumber) {
    onChange(combinePhoneNumber(nextCountryCode, nextLocalNumber))
  }

  function chooseCountry(option) {
    updatePhone(option.code, localNumber)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div className="phone-input-grid public-phone-input">
      <div className="public-country-picker" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false)
      }}>
        <button type="button" className="public-country-trigger" onClick={() => setIsOpen((current) => !current)}>
          <span>{selectedCountry.country}</span>
          <strong>{selectedCountry.code}</strong>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {isOpen && (
          <div className="public-country-menu">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && filteredCountries[0]) {
                  event.preventDefault()
                  chooseCountry(filteredCountries[0])
                }
              }}
              placeholder="Search country or code"
              aria-label="Search country or dialing code"
              autoFocus
            />
            <div className="public-country-list">
              {filteredCountries.map((option) => (
                <button type="button" key={option.iso} onClick={() => chooseCountry(option)}>
                  <span>{option.country}</span>
                  <strong>{option.code}</strong>
                </button>
              ))}
              {filteredCountries.length === 0 && <div className="public-country-empty">No country found</div>}
            </div>
          </div>
        )}
      </div>
      <input
        inputMode="tel"
        autoComplete="tel"
        value={localNumber}
        onChange={(event) => updatePhone(countryCode, event.target.value)}
        placeholder="e.g. 123456789"
        aria-label="Phone number"
        required={required}
      />
    </div>
  )
}

function formatDate(value) {
  if (!value) return '-'
  const [year, month, day] = String(value).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function formatTime(value) {
  if (!value) return '-'
  return String(value).slice(0, 5)
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

function PublicBrand() {
  return (
    <div className="public-brand">
      <div className="portal-mark"><img src="/logo.png" alt="DBKU crest" /></div>
      <div>
        <div className="portal-title">DBKU Portal</div>
        <div className="portal-subtitle">Attendance Management System</div>
      </div>
    </div>
  )
}

function EventInfoItem({ label, value }) {
  return (
    <div className="public-event-info-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function EventInfo({ event }) {
  return (
    <div className="public-event-card">
      <EventInfoItem label="Event Name" value={event.name} />
      <div className="public-event-grid">
        <EventInfoItem label="Start Date" value={formatDate(event.start_date)} />
        <EventInfoItem label="End Date" value={formatDate(event.end_date)} />
        <EventInfoItem label="Start Time" value={formatTime(event.start_time)} />
        <EventInfoItem label="End Time" value={formatTime(event.end_time)} />
        <EventInfoItem label="Radius" value={`${event.radius_meter || '-'} m`} />
        <EventInfoItem label="Location" value={formatAddress(event.location)} />
      </div>
      <EventInfoItem label="Description" value={event.description || '-'} />
    </div>
  )
}

function PublicField({ index, label, icon: Icon, children }) {
  return (
    <div className="compact-field public-field">
      <span><b>{index}</b>{Icon && <Icon size={16} />}{label}</span>
      {children}
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

function normalizeCoordinate(value) {
  return Number(Number(value).toFixed(6))
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
    latitude: normalizeCoordinate(position.coords.latitude),
    longitude: normalizeCoordinate(position.coords.longitude),
  })
}

function SuccessModal({ message, onClose }) {
  if (!message) return null

  return (
    <div className="modal-overlay open">
      <div className="modal-box public-success-modal">
        <div className="public-success-icon"><CheckCircle2 size={34} /></div>
        <h2>Attendance Registered</h2>
        <p>{message}</p>
        <p className="public-success-note">Thank you. You may now close this tab or browser.</p>
        <button type="button" className="btn btn-ocean" onClick={onClose}>Close Message</button>
      </div>
    </div>
  )
}

function PublicFormShell({ type, title, subtitle, event, children, message, onDismissMessage, error }) {
  return (
    <div className="public-attendance-screen">
      <main className="public-attendance-wrap">
        <PublicBrand />
        <section className="public-attendance-card">
          <div className="public-attendance-hero">
            <div className="public-pill"><ShieldCheck size={15} /> {type}</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="public-attendance-body">
            <EventInfo event={event} />
            {children}
            <div className="gps-note"><MapPin size={17} /> Location access is required to verify you are within the allowed radius. Please allow location access when prompted.</div>
            {error && <div className="alert-error">{error}</div>}
          </div>
        </section>
      </main>
      <SuccessModal message={message} onClose={onDismissMessage} />
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
      setMessage('Staff attendance registered successfully.')
      setForm({ full_name: '', staff_id: '', phone_number: '', email: '', department: '', other_department: '' })
    } catch (err) {
      setError(err.message)
    }
  }

  if (loadError) return <div className="screen-center"><div className="alert-error">{loadError}</div></div>
  if (!event) return <div className="screen-center"><div className="panel">Loading event</div></div>

  return (
    <PublicFormShell type="Staff" title="Attendance Registration" subtitle="Fill in your details to register attendance for this event" event={event} error={error} message={message} onDismissMessage={() => setMessage('')}>
      <form className="stack-form public-entry-form" onSubmit={submit}>
        <PublicField index="1" label="Full Name" icon={User}><input autoComplete="name" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} placeholder="e.g. John Doe" required /></PublicField>
        <PublicField index="2" label="Employee ID" icon={ClipboardCheck}><input value={form.staff_id} onChange={(e) => update('staff_id', e.target.value)} placeholder="e.g. DBKU0001" required /></PublicField>
        <PublicField index="3" label="Phone Number" icon={Phone}><PhoneNumberSelectInput value={form.phone_number} onChange={(value) => update('phone_number', value)} required /></PublicField>
        <PublicField index="4" label="Email Address" icon={Mail}><input type="email" autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="e.g. john@email.com" required /></PublicField>
        <PublicField index="5" label="Department" icon={Building2}>
          <select value={form.department} onChange={(e) => update('department', e.target.value)} required>
            <option value="">-- Select department --</option>
            {departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </PublicField>
        {form.department === 'Others' && <PublicField index="6" label="Please Specify Department"><input value={form.other_department} onChange={(e) => update('other_department', e.target.value)} required /></PublicField>}
        <button type="submit" className="primary-button portal-login-button"><CheckCircle2 size={20} /> Submit</button>
      </form>
    </PublicFormShell>
  )
}

export function VisitorAttendanceFormPage() {
  const { eventId } = useParams()
  const { event, error: loadError } = useEvent(eventId)
  const [form, setForm] = useState({ full_name: '', phone_number: '', email: '', organization: '', other_organization: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const organization = form.organization === 'Others' ? form.other_organization : form.organization

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(submitEvent) {
    submitEvent.preventDefault()
    setError('')
    setMessage('')
    try {
      await withLocation(async (coords) => {
        const visitor = await apiRequest('/visitors/', { method: 'POST', body: JSON.stringify({ ...form, organization }) })
        return apiRequest('/visitor-attendance/', {
          method: 'POST',
          body: JSON.stringify({ visitor: visitor.id, event: eventId, ...coords }),
        })
      })
      setMessage('Visitor attendance submitted successfully.')
      setForm({ full_name: '', phone_number: '', email: '', organization: '', other_organization: '' })
    } catch (err) {
      setError(err.message)
    }
  }

  if (loadError) return <div className="screen-center"><div className="alert-error">{loadError}</div></div>
  if (!event) return <div className="screen-center"><div className="panel">Loading event</div></div>

  return (
    <PublicFormShell type="Visitor" title="Attendance Registration" subtitle="Fill in your details to register attendance for this event" event={event} error={error} message={message} onDismissMessage={() => setMessage('')}>
      <form className="stack-form public-entry-form" onSubmit={submit}>
        <PublicField index="1" label="Full Name" icon={User}><input autoComplete="name" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} placeholder="e.g. John Doe" required /></PublicField>
        <PublicField index="2" label="Phone Number" icon={Phone}><PhoneNumberSelectInput value={form.phone_number} onChange={(value) => update('phone_number', value)} required /></PublicField>
        <PublicField index="3" label="Email Address" icon={Mail}><input type="email" autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="e.g. john@email.com" required /></PublicField>
        <PublicField index="4" label="Organization" icon={Building2}>
          <select value={form.organization} onChange={(e) => update('organization', e.target.value)} required>
            <option value="">-- Select organization --</option>
            {organizationOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </PublicField>
        {form.organization === 'Others' && <PublicField index="5" label="Please Specify Organization"><input value={form.other_organization} onChange={(e) => update('other_organization', e.target.value)} required /></PublicField>}
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
    <PublicFormShell type="Non-Malaysian Visitor" title="Attendance Registration" subtitle="Scan passport details or enter them manually to register attendance" event={event} error={error} message={message} onDismissMessage={() => setMessage('')}>
      <form className="stack-form public-entry-form" onSubmit={submit}>
        <PublicField index="1" label="Passport Image" icon={ClipboardCheck}><input type="file" accept="image/*" capture="environment" onChange={uploadPassportImage} /></PublicField>
        {ocrNote && <div className="requirement-box">{ocrNote}</div>}
        <PublicField index="2" label="Full Name" icon={User}><input autoComplete="name" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required /></PublicField>
        <PublicField index="3" label="Passport Number" icon={ClipboardCheck}><input value={form.passport_number} onChange={(e) => update('passport_number', e.target.value)} required /></PublicField>
        <div className="form-grid-2">
          <PublicField index="4" label="Country"><input value={form.country} onChange={(e) => update('country', e.target.value)} /></PublicField>
          <PublicField index="5" label="Gender"><input value={form.gender} onChange={(e) => update('gender', e.target.value)} /></PublicField>
        </div>
        <div className="form-grid-2">
          <PublicField index="6" label="Date of Birth"><input value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} /></PublicField>
          <PublicField index="7" label="Expiry Date"><input value={form.expiry_date} onChange={(e) => update('expiry_date', e.target.value)} /></PublicField>
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
    <PublicFormShell type="Assignment" title={assignment?.task_title || 'Assignment Attendance'} subtitle={assignment?.staff_name || 'Register assigned task attendance'} event={event} error={error} message={message} onDismissMessage={() => setMessage('')}>
      <form className="stack-form public-entry-form" onSubmit={submit}>
        <PublicField index="1" label="Full Name" icon={User}><input autoComplete="name" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required /></PublicField>
        <PublicField index="2" label="Staff ID" icon={ClipboardCheck}><input value={form.staff_id} onChange={(e) => update('staff_id', e.target.value)} required /></PublicField>
        <PublicField index="3" label="Phone Number" icon={Phone}><PhoneNumberSelectInput value={form.phone_number} onChange={(value) => update('phone_number', value)} required /></PublicField>
        <PublicField index="4" label="Email Address" icon={Mail}><input type="email" autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} required /></PublicField>
        <PublicField index="5" label="Notes"><textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={4} /></PublicField>
        <button type="submit" className="primary-button portal-login-button"><CheckCircle2 size={20} /> Submit</button>
      </form>
    </PublicFormShell>
  )
}
