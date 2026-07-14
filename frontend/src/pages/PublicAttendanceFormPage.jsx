import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, CalendarDays, Camera, Check, CheckCircle2, ChevronDown, ClipboardCheck, FileText, ImageIcon, LocateFixed, Mail, MapPin, Phone, Plus, RotateCcw, ScanLine, ShieldCheck, Trash2, User, X } from 'lucide-react'
import { getCountries, getCountryCallingCode } from 'libphonenumber-js'
import { useParams } from 'react-router-dom'
import { apiRequest } from '../api/client.js'
import { useConfirmDialog } from '../components/ConfirmDialog.jsx'
import { formatTime12Hour } from '../utils/dateTime.js'

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

const passportCountryOptions = [
  { code: 'AUS', nationality: 'Australia' },
  { code: 'BRN', nationality: 'Brunei' },
  { code: 'CAN', nationality: 'Canada' },
  { code: 'CHN', nationality: 'China' },
  { code: 'GBR', nationality: 'United Kingdom' },
  { code: 'IDN', nationality: 'Indonesia' },
  { code: 'IND', nationality: 'India' },
  { code: 'JPN', nationality: 'Japan' },
  { code: 'KOR', nationality: 'South Korea' },
  { code: 'MYS', nationality: 'Malaysia' },
  { code: 'PHL', nationality: 'Philippines' },
  { code: 'SGP', nationality: 'Singapore' },
  { code: 'THA', nationality: 'Thailand' },
  { code: 'USA', nationality: 'United States' },
].sort((a, b) => a.nationality.localeCompare(b.nationality))

function findPassportCountryByCode(value) {
  const code = String(value || '').trim().toUpperCase()
  return passportCountryOptions.find((option) => option.code === code)
}

function findPassportCountryByNationality(value) {
  const nationality = String(value || '').trim().toLowerCase()
  return passportCountryOptions.find((option) => option.nationality.toLowerCase() === nationality)
}

const passportStatusMeta = {
  'auto-extracted': { label: 'Auto Extracted', className: 'is-ok', chipClassName: 'passport-ok-chip' },
  'manually-corrected': { label: 'Manually Corrected', className: 'is-manual', chipClassName: 'passport-manual-chip' },
  'pending verification': { label: 'Pending Verification', className: '', chipClassName: 'passport-pending-chip' },
}

const defaultPassportExtraFields = [
  { id: 'default-phone-number', label: 'Phone Number', value: '', locked: true },
  { id: 'default-email', label: 'Email', value: '', locked: true },
]

function getPassportStatusMeta(status) {
  return passportStatusMeta[status] || passportStatusMeta['pending verification']
}

function createDefaultPassportExtraFields() {
  return defaultPassportExtraFields.map((item) => ({ ...item }))
}

function normalizePassportExtraLabel(value) {
  return String(value || '').trim().toLowerCase()
}

function ensureDefaultPassportExtraFields(fields = []) {
  const safeFields = Array.isArray(fields) ? fields : []
  const defaults = defaultPassportExtraFields.map((defaultField) => {
    const existing = safeFields.find((item) => normalizePassportExtraLabel(item.label) === normalizePassportExtraLabel(defaultField.label))
    return existing
      ? { ...existing, id: defaultField.id, label: defaultField.label, locked: true }
      : { ...defaultField }
  })
  const customFields = safeFields.filter((item) => (
    !defaultPassportExtraFields.some((defaultField) => normalizePassportExtraLabel(defaultField.label) === normalizePassportExtraLabel(item.label))
  ))
  return [...defaults, ...customFields]
}

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
          <EventInfoItem label="Start Time" value={formatTime12Hour(event.start_time)} />
          <EventInfoItem label="End Time" value={formatTime12Hour(event.end_time)} />
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
      maximumAge: 60000,
    })
  })
  return callback({
    latitude: normalizeCoordinate(position.coords.latitude),
    longitude: normalizeCoordinate(position.coords.longitude),
  })
}

function SubmitButton({ isSubmitting, children, className = 'primary-button portal-login-button' }) {
  return (
    <button type="submit" className={`${className} ${isSubmitting ? 'is-loading' : ''}`} disabled={isSubmitting}>
      <span className="button-spinner" aria-hidden="true" />
      {isSubmitting ? 'Submitting...' : children}
    </button>
  )
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const department = form.department === 'Others' ? form.other_department : form.department

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(submitEvent) {
    submitEvent.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      await withLocation((coords) => apiRequest('/staff-attendance/', {
        method: 'POST',
        body: JSON.stringify({ ...form, department, event: eventId, ...coords }),
      }))
      setMessage('Staff attendance registered successfully.')
      setForm({ full_name: '', staff_id: '', phone_number: '', email: '', department: '', other_department: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
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
        <SubmitButton isSubmitting={isSubmitting}><CheckCircle2 size={20} /> Submit</SubmitButton>
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const organization = form.organization === 'Others' ? form.other_organization : form.organization

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(submitEvent) {
    submitEvent.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setError('')
    setMessage('')
    setIsSubmitting(true)
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
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
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
        <SubmitButton isSubmitting={isSubmitting}><CheckCircle2 size={20} /> Submit</SubmitButton>
      </form>
    </PublicFormShell>
  )
}

export function PassportAttendanceFormPage() {
  const { eventId } = useParams()
  const { event, error: loadError } = useEvent(eventId)
  const { confirm, confirmDialog } = useConfirmDialog()
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
  const [passportImageMeta, setPassportImageMeta] = useState({ original: '', processed: '', qualityNote: '' })
  const [extraFields, setExtraFields] = useState(createDefaultPassportExtraFields)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [ocrNote, setOcrNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [qualityPopupMessage, setQualityPopupMessage] = useState('')
  const submittingRef = useRef(false)
  const cameraVideoRef = useRef(null)
  const cameraCanvasRef = useRef(null)
  const cameraGuideRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const ocrSnapshotRef = useRef(null)
  const statusMeta = getPassportStatusMeta(ocrStatus)
  const visibleExtraFields = useMemo(() => ensureDefaultPassportExtraFields(extraFields), [extraFields])

  useEffect(() => {
    if (visibleExtraFields.length !== extraFields.length) {
      setExtraFields(visibleExtraFields)
    }
  }, [extraFields.length, visibleExtraFields])

  useEffect(() => () => {
    if (passportPreview) URL.revokeObjectURL(passportPreview)
  }, [passportPreview])

  useEffect(() => {
    if (!isCameraOpen) return undefined
    let cancelled = false

    async function startCamera() {
      setCameraError('')
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera is not supported on this browser.')
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        cameraStreamRef.current = stream
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream
          await cameraVideoRef.current.play()
        }
      } catch (err) {
        setCameraError(err.message || 'Camera permission was blocked. Please allow camera access and try again.')
      }
    }

    startCamera()
    return () => {
      cancelled = true
      stopCameraStream()
    }
  }, [isCameraOpen])

  function markManualCorrection(field, value) {
    if (field === 'ocr_raw_text') return
    const snapshot = ocrSnapshotRef.current
    if (!snapshot || String(snapshot[field] || '') !== String(value || '')) {
      setOcrStatus('manually-corrected')
    }
  }

  function update(field, value) {
    markManualCorrection(field, value)
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updateCountryCode(value) {
    markManualCorrection('country_code', value)
    const option = findPassportCountryByCode(value)
    setForm((current) => ({
      ...current,
      country_code: value,
      nationality: option?.nationality || current.nationality,
    }))
  }

  function updateNationality(value) {
    markManualCorrection('nationality', value)
    const option = findPassportCountryByNationality(value)
    setForm((current) => ({
      ...current,
      nationality: value,
      country_code: option?.code || current.country_code,
    }))
  }

  async function submit(submitEvent) {
    submitEvent.preventDefault()
    if (submittingRef.current) return
    if (form.date_of_expiry && new Date(`${form.date_of_expiry}T23:59:59`) < new Date()) {
      setError('Passport has expired. Please use a valid passport.')
      return
    }
    submittingRef.current = true
    setError('')
    setMessage('')
    setIsSubmitting(true)
    const fullName = [form.first_name, form.last_name].filter(Boolean).join(' ').trim()
    const cleanExtraFields = visibleExtraFields
      .map((item) => ({ label: item.label.trim(), value: item.value.trim() }))
      .filter((item) => item.label || item.value)
    const additionalFieldsText = cleanExtraFields
      .map((item) => (item.label ? `${item.label}: ${item.value}` : item.value))
      .join('\n')
    try {
      await withLocation((coords) => apiRequest('/passport-attendance/submit/', {
        method: 'POST',
        body: JSON.stringify({
          event: eventId,
          type: form.passport_type,
          country_code: form.country_code,
          passport_number: form.passport_number,
          nationality: form.nationality,
          full_name: fullName,
          first_name: form.first_name,
          last_name: form.last_name,
          date_of_birth: form.date_of_birth,
          sex: form.sex,
          date_of_issue: form.date_of_issue,
          date_of_expiry: form.date_of_expiry,
          raw_text: form.ocr_raw_text,
          status: ocrStatus,
          original_image_name: passportImageMeta.original,
          processed_image_name: passportImageMeta.processed,
          image_quality_note: passportImageMeta.qualityNote,
          additional_fields: cleanExtraFields,
          additional_fields_text: additionalFieldsText,
          ...coords,
        }),
      }))
      setMessage('Passport attendance submitted successfully.')
      resetForm()
    } catch (err) {
      setError(err.message)
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  function setPassportImageFile(file, source = file?.name || 'Camera capture') {
    if (!file) return
    setPassportFile(file)
    setPassportPreview((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })
    setError('')
    setOcrNote('')
    setOcrSource(source)
    setOcrStatus('pending verification')
    ocrSnapshotRef.current = null
    setPassportImageMeta({ original: '', processed: '', qualityNote: '' })
    setQualityPopupMessage('')
  }

  function choosePassportImage(event) {
    const file = event.target.files?.[0]
    setPassportImageFile(file)
    event.target.value = ''
  }

  function stopCameraStream() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null
  }

  function openPassportCamera() {
    setError('')
    setCameraError('')
    setIsCameraOpen(true)
  }

  function closePassportCamera() {
    setIsCameraOpen(false)
  }

  function capturePassportImage() {
    const video = cameraVideoRef.current
    const canvas = cameraCanvasRef.current
    const guide = cameraGuideRef.current
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setCameraError('Camera is still loading. Please try again.')
      return
    }
    const viewRect = video.getBoundingClientRect()
    const guideRect = guide?.getBoundingClientRect()
    const videoAspect = video.videoWidth / video.videoHeight
    const viewAspect = viewRect.width / viewRect.height
    let renderedWidth = viewRect.width
    let renderedHeight = viewRect.height
    let offsetX = 0
    let offsetY = 0
    if (videoAspect > viewAspect) {
      renderedWidth = viewRect.height * videoAspect
      offsetX = (viewRect.width - renderedWidth) / 2
    } else {
      renderedHeight = viewRect.width / videoAspect
      offsetY = (viewRect.height - renderedHeight) / 2
    }
    const cropRect = guideRect ? {
      left: guideRect.left - viewRect.left - offsetX,
      top: guideRect.top - viewRect.top - offsetY,
      width: guideRect.width,
      height: guideRect.height,
    } : { left: 0, top: 0, width: renderedWidth, height: renderedHeight }
    const sourceX = Math.max(0, Math.round((cropRect.left / renderedWidth) * video.videoWidth))
    const sourceY = Math.max(0, Math.round((cropRect.top / renderedHeight) * video.videoHeight))
    const sourceWidth = Math.min(video.videoWidth - sourceX, Math.round((cropRect.width / renderedWidth) * video.videoWidth))
    const sourceHeight = Math.min(video.videoHeight - sourceY, Math.round((cropRect.height / renderedHeight) * video.videoHeight))
    canvas.width = sourceWidth || video.videoWidth
    canvas.height = sourceHeight || video.videoHeight
    const context = canvas.getContext('2d')
    context.drawImage(video, sourceX, sourceY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('Unable to capture passport image. Please try again.')
        return
      }
      const file = new File([blob], `passport-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
      setPassportImageFile(file, 'Camera capture')
      closePassportCamera()
    }, 'image/jpeg', 0.92)
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
      setForm((current) => {
        const passportCountry = findPassportCountryByCode(data.country_code) || findPassportCountryByNationality(data.nationality)
        const nextForm = {
          ...current,
          passport_type: data.type || current.passport_type,
          country_code: data.country_code || passportCountry?.code || current.country_code,
          passport_number: data.passport_number || current.passport_number,
          nationality: data.nationality || passportCountry?.nationality || current.nationality,
          first_name: data.first_name || current.first_name,
          last_name: data.last_name || current.last_name,
          date_of_birth: data.date_of_birth || current.date_of_birth,
          sex: data.sex || current.sex,
          date_of_issue: data.date_of_issue || current.date_of_issue,
          date_of_expiry: data.date_of_expiry || current.date_of_expiry,
          ocr_raw_text: data.raw_text || current.ocr_raw_text,
        }
        ocrSnapshotRef.current = {
          passport_type: nextForm.passport_type,
          country_code: nextForm.country_code,
          passport_number: nextForm.passport_number,
          nationality: nextForm.nationality,
          first_name: nextForm.first_name,
          last_name: nextForm.last_name,
          date_of_birth: nextForm.date_of_birth,
          sex: nextForm.sex,
          date_of_issue: nextForm.date_of_issue,
          date_of_expiry: nextForm.date_of_expiry,
        }
        return nextForm
      })
      setOcrStatus(data.status || 'auto-extracted')
      setPassportImageMeta({
        original: data.original_image_name || '',
        processed: data.processed_image_name || '',
        qualityNote: data.image_quality_note || '',
      })
      if (data.image_quality_note) setQualityPopupMessage(data.image_quality_note)
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
    ocrSnapshotRef.current = null
    setPassportImageMeta({ original: '', processed: '', qualityNote: '' })
    setOcrNote('')
    setQualityPopupMessage('')
  }

  function resetForm() {
    resetPassportImage()
    setExtraFields(createDefaultPassportExtraFields())
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
    setExtraFields((current) => [...ensureDefaultPassportExtraFields(current), { id: Date.now(), label: '', value: '' }])
  }

  function updateExtraField(id, field, value) {
    setExtraFields((current) => current.map((item) => {
      if (item.id !== id) return item
      if (item.locked && field === 'label') return item
      return { ...item, [field]: value }
    }))
  }

  function removeExtraField(id) {
    setExtraFields((current) => current.filter((item) => item.id !== id || item.locked))
  }

  async function confirmRemoveExtraField(item) {
    if (item.locked) return
    const shouldDelete = await confirm({
      title: 'Delete Additional Field',
      message: `Delete additional field "${item.label || 'Untitled'}"?`,
    })
    if (shouldDelete) removeExtraField(item.id)
  }

  const hasCustomCountryCode = form.country_code && !findPassportCountryByCode(form.country_code)
  const hasCustomNationality = form.nationality && !findPassportCountryByNationality(form.nationality)

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
              <button type="button" className="passport-file-button passport-camera-button" onClick={openPassportCamera}>
                <Camera size={20} /> Open Camera
              </button>
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
              <span className={`passport-chip ${statusMeta.chipClassName}`}>Status: {statusMeta.label}</span>
            </div>
            {ocrNote && <div className="requirement-box passport-ocr-note">{ocrNote}</div>}
            <div className="passport-step-actions">
              <button type="button" className="btn btn-green" onClick={scanPassportImage}><ScanLine size={18} /> Scan Passport</button>
              <button type="button" className="btn btn-ghost" onClick={resetForm}><RotateCcw size={17} /> Reset All</button>
            </div>
          </div>
        </section>

        <section className="passport-step-card">
          <div className="passport-step-title"><b>2</b><span>Review Extracted Details</span></div>
          <div className={`passport-review-status ${statusMeta.className}`}>{statusMeta.label}</div>
          <div className="passport-form-grid">
            <label className="compact-field"><span>Passport Type <span className="required-star">*</span></span><input value={form.passport_type} onChange={(e) => update('passport_type', e.target.value)} placeholder="e.g. P" required /></label>
            <label className="compact-field"><span>Passport Number <span className="required-star">*</span></span><input value={form.passport_number} onChange={(e) => update('passport_number', e.target.value)} placeholder="e.g. AB1234567" required /></label>
            <label className="compact-field">
              <span>Country Code <span className="required-star">*</span></span>
              <select value={form.country_code} onChange={(e) => updateCountryCode(e.target.value)} required>
                <option value="">-- Select country code --</option>
                {hasCustomCountryCode && <option value={form.country_code}>{form.country_code}</option>}
                {passportCountryOptions.map((option) => <option key={option.code} value={option.code}>{option.code}</option>)}
              </select>
            </label>
            <label className="compact-field">
              <span>Nationality <span className="required-star">*</span></span>
              <select value={form.nationality} onChange={(e) => updateNationality(e.target.value)} required>
                <option value="">-- Select nationality --</option>
                {hasCustomNationality && <option value={form.nationality}>{form.nationality}</option>}
                {passportCountryOptions.map((option) => <option key={option.nationality} value={option.nationality}>{option.nationality}</option>)}
              </select>
            </label>
          </div>
          <div className="passport-form-grid">
            <label className="compact-field"><span>First Name <span className="required-star">*</span></span><input value={form.first_name} onChange={(e) => update('first_name', e.target.value)} placeholder="Given name(s)" required /></label>
            <label className="compact-field"><span>Last Name <span className="required-star">*</span></span><input value={form.last_name} onChange={(e) => update('last_name', e.target.value)} placeholder="Family name" required /></label>
            <label className="compact-field"><span>Date of Birth <span className="required-star">*</span></span><input type="date" value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} required /></label>
            <label className="compact-field"><span>Sex <span className="required-star">*</span></span><select value={form.sex} onChange={(e) => update('sex', e.target.value)} required><option value="">-- Select --</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></label>
            <label className="compact-field"><span>Date of Issue <span className="required-star">*</span></span><input type="date" value={form.date_of_issue} onChange={(e) => update('date_of_issue', e.target.value)} required /></label>
            <label className="compact-field"><span>Date of Expiry <span className="required-star">*</span></span><input type="date" value={form.date_of_expiry} onChange={(e) => update('date_of_expiry', e.target.value)} required /></label>
          </div>
          <label className="compact-field"><span>OCR Raw Text</span><textarea rows={5} value={form.ocr_raw_text} onChange={(e) => update('ocr_raw_text', e.target.value)} placeholder="OCR output will appear here." /></label>
          <p className="passport-helper-text">Keep this text if OCR extraction is incomplete. It helps manual verification and later correction.</p>
        </section>

        <section className="passport-step-card">
          <div className="passport-step-title passport-step-title-row">
            <span><b>3</b> Additional Passport Fields <em>Optional</em><i>{visibleExtraFields.length}</i></span>
            <button type="button" className="btn btn-ghost passport-add-field" onClick={addExtraField}><Plus size={16} /> Add Field</button>
          </div>
          {visibleExtraFields.length === 0 ? (
            <div className="passport-empty-extra"><FileText size={20} /> <span>No additional fields added yet.</span><small>Tap "Add Field" to include supplementary passport data.</small></div>
          ) : (
            <div className="passport-extra-list">
              {visibleExtraFields.map((item) => (
                <div className="passport-extra-row" key={item.id}>
                  <input value={item.label} onChange={(e) => updateExtraField(item.id, 'label', e.target.value)} placeholder="Field label" disabled={item.locked} />
                  <input value={item.value} onChange={(e) => updateExtraField(item.id, 'value', e.target.value)} placeholder="Value" />
                  <button type="button" className="passport-extra-delete" onClick={() => confirmRemoveExtraField(item)} aria-label="Delete additional field" disabled={item.locked}><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          )}
          <p className="passport-extra-help">Capture supplementary data from the passport such as <code>Height</code>, <code>Place of Birth</code> or <code>Hair Colour</code>. Each entry is stored as a labelled key-value pair.</p>
        </section>

        <section className="passport-step-card">
          <div className="passport-step-title"><b>4</b><span>Submit Attendance</span></div>
          <p className="passport-helper-text">GPS/location access is required before attendance submission.</p>
          <div className="passport-step-actions passport-submit-actions">
            <SubmitButton isSubmitting={isSubmitting} className="btn btn-green"><Check size={18} /> Submit Attendance</SubmitButton>
          </div>
        </section>
      </form>
      {isCameraOpen && (
        <div className="passport-camera-overlay" role="dialog" aria-modal="true" aria-label="Capture passport">
          <div className="passport-camera-panel">
            <div className="passport-camera-header">
              <div>
                <h2>Capture Passport</h2>
                <p>Align the passport inside the guide frame.</p>
              </div>
              <button type="button" className="passport-camera-close" onClick={closePassportCamera} aria-label="Close camera"><X size={24} /></button>
            </div>
            <div className="passport-camera-view">
              <video ref={cameraVideoRef} autoPlay playsInline muted />
              <div className="passport-camera-guide" ref={cameraGuideRef}>
                <span>Fit full passport page inside frame</span>
              </div>
            </div>
            {cameraError && <div className="passport-camera-error">{cameraError}</div>}
            <div className="passport-camera-actions">
              <button type="button" className="passport-camera-capture" onClick={capturePassportImage}>Capture Passport</button>
            </div>
            <canvas ref={cameraCanvasRef} hidden />
          </div>
        </div>
      )}
      {qualityPopupMessage && (
        <div className="passport-quality-overlay" role="alertdialog" aria-modal="true" aria-label="Passport image quality">
          <div className="passport-quality-dialog">
            <div className="passport-quality-icon"><ImageIcon size={24} /></div>
            <h2>Passport Image Quality</h2>
            <p>{qualityPopupMessage}</p>
            <button type="button" className="btn btn-green" onClick={() => setQualityPopupMessage('')}>OK</button>
          </div>
        </div>
      )}
      {confirmDialog}
    </PublicFormShell>
  )
}

export function AssignmentAttendanceFormPage() {
  const { assignmentId } = useParams()
  const [assignment, setAssignment] = useState(null)
  const [form, setForm] = useState({ full_name: '', staff_id: '', phone_number: '', email: '', notes: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

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
    if (submittingRef.current) return
    submittingRef.current = true
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      await withLocation((coords) => apiRequest('/assignment-attendance/', {
        method: 'POST',
        body: JSON.stringify({ ...form, assignment: assignmentId, ...coords }),
      }))
      setMessage('Assignment attendance submitted successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
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
        <SubmitButton isSubmitting={isSubmitting}><CheckCircle2 size={20} /> Submit</SubmitButton>
      </form>
    </PublicFormShell>
  )
}
