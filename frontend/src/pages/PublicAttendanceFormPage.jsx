import { useEffect, useMemo, useState } from 'react'
import { Building2, CalendarDays, Camera, Check, CheckCircle2, ChevronDown, ClipboardCheck, FileText, ImageIcon, LocateFixed, Mail, MapPin, Phone, Plus, RotateCcw, ScanLine, ShieldCheck, User } from 'lucide-react'
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

function formatCoordinate(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(6) : value
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
      <div className="public-event-card-header">
        <div className="public-event-title-row">
          <div className="public-event-icon"><CalendarDays size={18} /></div>
          <h2>{event.name}</h2>
        </div>
        <div className="public-event-radius-pill"><LocateFixed size={15} /> Radius: {event.radius_meter || '-'}m</div>
      </div>

      <div className="public-event-summary-grid">
        <section>
          <div className="public-event-section-label">Schedule</div>
          <EventInfoItem label="Start Date" value={formatDate(event.start_date)} />
          <EventInfoItem label="End Date" value={formatDate(event.end_date)} />
          <EventInfoItem label="Start Time" value={formatTime(event.start_time)} />
          <EventInfoItem label="End Time" value={formatTime(event.end_time)} />
        </section>
        <section>
          <div className="public-event-section-label">Location</div>
          <EventInfoItem label="Venue" value={formatAddress(event.location)} />
          <EventInfoItem label="Latitude" value={formatCoordinate(event.latitude)} />
          <EventInfoItem label="Longitude" value={formatCoordinate(event.longitude)} />
        </section>
        <section>
          <div className="public-event-section-label">Details</div>
          <EventInfoItem label="Description" value={event.description || '-'} />
        </section>
      </div>
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

function PublicFormShell({ type, title, subtitle, event, children, message, onDismissMessage, error, showEvent = true, showGpsNote = true }) {
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
            {showEvent && <EventInfo event={event} />}
            {children}
            {showGpsNote && <div className="gps-note"><MapPin size={17} /> Location access is required to verify you are within the allowed radius. Please allow location access when prompted.</div>}
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
  const [form, setForm] = useState({
    passport_type: '',
    country_code: '',
    passport_number: '',
    nationality: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    sex: '',
    date_of_issue: '',
    date_of_expiry: '',
    ocr_raw_text: '',
  })
  const [passportFile, setPassportFile] = useState(null)
  const [passportPreview, setPassportPreview] = useState('')
  const [ocrStatus, setOcrStatus] = useState('pending verification')
  const [ocrSource, setOcrSource] = useState('-')
  const [extraFields, setExtraFields] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [ocrNote, setOcrNote] = useState('')

  useEffect(() => () => {
    if (passportPreview) URL.revokeObjectURL(passportPreview)
  }, [passportPreview])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(submitEvent) {
    submitEvent.preventDefault()
    setError('')
    setMessage('')
    const fullName = [form.first_name, form.last_name].filter(Boolean).join(' ').trim()
    const extraData = Object.fromEntries(
      extraFields
        .filter((item) => item.label.trim())
        .map((item) => [item.label.trim(), item.value.trim()]),
    )
    try {
      await withLocation(async (coords) => {
        const visitor = await apiRequest('/passport-visitors/', {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName || form.passport_number,
            passport_number: form.passport_number,
            country: form.nationality || form.country_code,
            date_of_birth: form.date_of_birth,
            expiry_date: form.date_of_expiry,
            gender: form.sex,
            ocr_raw_text: form.ocr_raw_text,
            status: ocrStatus,
            extra_data: {
              passport_type: form.passport_type,
              country_code: form.country_code,
              nationality: form.nationality,
              first_name: form.first_name,
              last_name: form.last_name,
              date_of_issue: form.date_of_issue,
              ...extraData,
            },
          }),
        })
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

  function choosePassportImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setPassportFile(file)
    setPassportPreview((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })
    setError('')
    setOcrNote('')
    setOcrSource(file.name)
    setOcrStatus('pending verification')
  }

  async function scanPassportImage() {
    if (!passportFile) {
      setError('Please upload or capture a passport image first.')
      return
    }
    setOcrNote('Scanning passport image...')
    try {
      const body = new FormData()
      body.append('image', passportFile)
      const data = await apiRequest('/passport-visitors/ocr-preview/', { method: 'POST', body })
      setForm((current) => ({
        ...current,
        passport_type: data.type || current.passport_type,
        country_code: data.country_code || current.country_code,
        passport_number: data.passport_number || current.passport_number,
        nationality: data.nationality || current.nationality,
        first_name: data.first_name || current.first_name,
        last_name: data.last_name || current.last_name,
        date_of_birth: data.date_of_birth || current.date_of_birth,
        sex: data.sex || current.sex,
        date_of_issue: data.date_of_issue || current.date_of_issue,
        date_of_expiry: data.date_of_expiry || current.date_of_expiry,
        ocr_raw_text: data.raw_text || current.ocr_raw_text,
      }))
      setOcrStatus(data.status || 'auto-extracted')
      setOcrNote(data.image_quality_note || 'Passport scanned. Please verify the extracted fields before submitting.')
    } catch (err) {
      setOcrNote('')
      setError(err.message)
    }
  }

  function resetPassportImage() {
    setPassportFile(null)
    setPassportPreview((current) => {
      if (current) URL.revokeObjectURL(current)
      return ''
    })
    setOcrSource('-')
    setOcrStatus('pending verification')
    setOcrNote('')
  }

  function resetForm() {
    resetPassportImage()
    setExtraFields([])
    setForm({
      passport_type: '',
      country_code: '',
      passport_number: '',
      nationality: '',
      first_name: '',
      last_name: '',
      date_of_birth: '',
      sex: '',
      date_of_issue: '',
      date_of_expiry: '',
      ocr_raw_text: '',
    })
  }

  function addExtraField() {
    setExtraFields((current) => [...current, { id: Date.now(), label: '', value: '' }])
  }

  function updateExtraField(id, field, value) {
    setExtraFields((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  if (loadError) return <div className="screen-center"><div className="alert-error">{loadError}</div></div>
  if (!event) return <div className="screen-center"><div className="panel">Loading event</div></div>

  return (
    <PublicFormShell
      type="Non-Malaysian Attendance"
      title="Passport Registration Form"
      subtitle="Upload or capture your passport, review the extracted details, and submit your attendance."
      event={event}
      error={error}
      message={message}
      onDismissMessage={() => setMessage('')}
      showGpsNote={false}
    >
      <form className="passport-workflow-form" onSubmit={submit}>
        <section className="passport-step-card">
          <div className="passport-step-title"><b>1</b><span>Upload Passport Image</span></div>
          <div className="passport-upload-box">
            <div className="passport-upload-actions">
              <label className="passport-file-button passport-camera-button">
                <Camera size={20} /> Open Camera
                <input type="file" accept="image/*" capture="environment" onChange={choosePassportImage} />
              </label>
              <label className="passport-file-button">
                <FileText size={20} /> Choose File
                <input type="file" accept="image/*" onChange={choosePassportImage} />
              </label>
            </div>
            <div className="passport-file-name"><FileText size={18} /> {passportFile?.name || 'No file selected'}</div>
            <p>On mobile, "Open Camera" opens the rear camera. Ensure good lighting and align the full passport page.</p>
            <div className="passport-preview-box">
              {passportPreview ? <img src={passportPreview} alt="Passport preview" /> : <><ImageIcon size={42} /><span>No image uploaded yet</span></>}
            </div>
            <div className="passport-status-row">
              <span className="passport-chip passport-source-chip">Source: {ocrSource}</span>
              <span className={`passport-chip ${ocrStatus === 'auto-extracted' ? 'passport-ok-chip' : 'passport-pending-chip'}`}>Status: {ocrStatus}</span>
            </div>
            {ocrNote && <div className="requirement-box passport-ocr-note">{ocrNote}</div>}
            <div className="passport-step-actions">
              <button type="button" className="btn btn-green" onClick={scanPassportImage}><ScanLine size={18} /> Scan Passport</button>
              <button type="button" className="btn btn-ghost" onClick={resetPassportImage}>Reset Image</button>
            </div>
          </div>
        </section>

        <section className="passport-step-card">
          <div className="passport-step-title"><b>2</b><span>Review Extracted Details</span></div>
          <div className="passport-review-status">Pending Verification</div>
          <div className="passport-form-grid">
            <label className="compact-field"><span>Passport Type</span><input value={form.passport_type} onChange={(e) => update('passport_type', e.target.value)} placeholder="e.g. P" /></label>
            <label className="compact-field"><span>Country Code</span><input value={form.country_code} onChange={(e) => update('country_code', e.target.value)} placeholder="E.G. JPN" /></label>
          </div>
          <label className="compact-field"><span>Passport Number *</span><input value={form.passport_number} onChange={(e) => update('passport_number', e.target.value)} placeholder="e.g. AB1234567" required /></label>
          <label className="compact-field"><span>Nationality</span><input value={form.nationality} onChange={(e) => update('nationality', e.target.value)} placeholder="e.g. Japanese" /></label>
          <div className="passport-form-grid">
            <label className="compact-field"><span>First Name</span><input value={form.first_name} onChange={(e) => update('first_name', e.target.value)} placeholder="Given name(s)" /></label>
            <label className="compact-field"><span>Last Name</span><input value={form.last_name} onChange={(e) => update('last_name', e.target.value)} placeholder="Family name / BIN / BINTI section" /></label>
            <label className="compact-field"><span>Date of Birth</span><input type="date" value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} /></label>
            <label className="compact-field"><span>Sex</span><select value={form.sex} onChange={(e) => update('sex', e.target.value)}><option value="">-- Select --</option><option value="M">Male</option><option value="F">Female</option><option value="X">Other</option></select></label>
            <label className="compact-field"><span>Date of Issue</span><input type="date" value={form.date_of_issue} onChange={(e) => update('date_of_issue', e.target.value)} /></label>
            <label className="compact-field"><span>Date of Expiry</span><input type="date" value={form.date_of_expiry} onChange={(e) => update('date_of_expiry', e.target.value)} /></label>
          </div>
          <label className="compact-field"><span>OCR Raw Text</span><textarea rows={5} value={form.ocr_raw_text} onChange={(e) => update('ocr_raw_text', e.target.value)} placeholder="OCR output will appear here." /></label>
          <p className="passport-helper-text">Keep this text if OCR extraction is incomplete. It helps manual verification and later correction.</p>
        </section>

        <section className="passport-step-card">
          <div className="passport-step-title passport-step-title-row">
            <span><b>3</b> Additional Passport Fields <em>Optional</em><i>{extraFields.length}</i></span>
            <button type="button" className="btn btn-ghost passport-add-field" onClick={addExtraField}><Plus size={16} /> Add Field</button>
          </div>
          {extraFields.length === 0 ? (
            <div className="passport-empty-extra"><FileText size={20} /> <span>No additional fields added yet.</span><small>Tap "Add Field" to include supplementary passport data.</small></div>
          ) : (
            <div className="passport-extra-list">
              {extraFields.map((item) => (
                <div className="passport-extra-row" key={item.id}>
                  <input value={item.label} onChange={(e) => updateExtraField(item.id, 'label', e.target.value)} placeholder="Field label" />
                  <input value={item.value} onChange={(e) => updateExtraField(item.id, 'value', e.target.value)} placeholder="Value" />
                </div>
              ))}
            </div>
          )}
          <p className="passport-extra-help">Capture supplementary data from the passport such as <code>Height</code>, <code>Place of Birth</code> or <code>Hair Colour</code>. Each entry is stored as a labelled key-value pair.</p>
        </section>

        <section className="passport-step-card">
          <div className="passport-step-title"><b>4</b><span>Submit Attendance</span></div>
          <p className="passport-helper-text">GPS/location access is required before attendance submission.</p>
          <div className="passport-step-actions">
            <button type="submit" className="btn btn-green"><Check size={18} /> Submit Attendance</button>
            <button type="button" className="btn btn-ghost" onClick={resetForm}><RotateCcw size={17} /> Clear Form</button>
          </div>
        </section>
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
