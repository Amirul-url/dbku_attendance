import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, Download, Eye, Pencil, Search, Trash2, Users } from 'lucide-react'
import { getCountries, getCountryCallingCode } from 'libphonenumber-js'
import { Link, useParams } from 'react-router-dom'
import { apiRequest, downloadApiFile, listFromResponse } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'
import { formatTime12Hour } from '../utils/dateTime.js'

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

const visitorOrganizationOptions = [
  'Student (School / University)',
  'Government Agency',
  'Private Company',
  'Community / NGO',
  'Visitor / Guest',
  'Others',
]

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
    <div className="phone-input-grid public-phone-input visitor-phone-input">
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
        placeholder="Phone number"
        required={required}
      />
    </div>
  )
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
      attendance_date: formatShortDate(row.date),
      attendance_time: formatTime12Hour(row.time),
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
  const editHasCustomOrganization = editForm?.organization && !visitorOrganizationOptions.includes(editForm.organization)

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
                <label className="compact-field"><span>Phone Number</span><PhoneNumberSelectInput value={editForm.phone_number} onChange={(value) => updateEdit('phone_number', value)} required /></label>
                <label className="compact-field"><span>Email</span><input type="email" value={editForm.email} onChange={(event) => updateEdit('email', event.target.value)} required /></label>
                <label className="compact-field">
                  <span>Organization</span>
                  <select value={editForm.organization} onChange={(event) => updateEdit('organization', event.target.value)} required>
                    <option value="">-- Select organization --</option>
                    {editHasCustomOrganization && <option value={editForm.organization}>{editForm.organization}</option>}
                    {visitorOrganizationOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label className="compact-field"><span>IPv4 Address</span><input disabled value={editForm.ipv4_address} /></label>
                <label className="compact-field"><span>IPv6 Address</span><input disabled value={editForm.ipv6_address} /></label>
                <label className="compact-field"><span>Attendance Date</span><input disabled value={editForm.attendance_date} /></label>
                <label className="compact-field"><span>Attendance Time</span><input disabled value={editForm.attendance_time} /></label>
                <label className="compact-field"><span>Latitude</span><input disabled value={formatCoordinate(editForm.latitude)} /></label>
                <label className="compact-field"><span>Longitude</span><input disabled value={formatCoordinate(editForm.longitude)} /></label>
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
