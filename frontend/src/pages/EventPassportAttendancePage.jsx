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

const defaultPassportExtraFields = [
  { id: 'default-phone-number', label: 'Phone Number', value: '', locked: true },
  { id: 'default-email', label: 'Email', value: '', locked: true },
]

function findPassportCountryByCode(value) {
  const code = String(value || '').trim().toUpperCase()
  return passportCountryOptions.find((option) => option.code === code)
}

function findPassportCountryByNationality(value) {
  const nationality = String(value || '').trim().toLowerCase()
  return passportCountryOptions.find((option) => option.nationality.toLowerCase() === nationality)
}

function toDateInputValue(value) {
  if (!value) return ''
  const [year, month, day] = String(value).split('-')
  return year && month && day ? `${year}-${month}-${day}` : ''
}

function getPassportExtra(row) {
  return row.visitor_detail?.extra_data || {}
}

function getAdditionalFields(row) {
  const extra = getPassportExtra(row)
  if (Array.isArray(extra.additional_fields)) {
    return mergeDefaultAdditionalFields(extra.additional_fields.filter((item) => item?.label || item?.value))
  }
  return mergeDefaultAdditionalFields(Object.entries(extra)
    .filter(([key]) => !['type', 'passport_type', 'country_code', 'nationality', 'first_name', 'last_name', 'date_of_issue', 'additional_fields_text', 'additional_fields'].includes(key))
    .map(([label, value]) => ({ label, value })))
}

function normalizeExtraLabel(value) {
  return String(value || '').trim().toLowerCase()
}

function mergeDefaultAdditionalFields(fields = []) {
  const customFields = fields.map((item, index) => ({
    id: item.id || `extra-${index}-${item.label || 'field'}`,
    label: item.label || '',
    value: item.value || '',
    locked: Boolean(item.locked),
  }))
  const mergedDefaults = defaultPassportExtraFields.map((defaultField) => {
    const existing = customFields.find((item) => normalizeExtraLabel(item.label) === normalizeExtraLabel(defaultField.label))
    return existing ? { ...existing, id: defaultField.id, label: defaultField.label, locked: true } : { ...defaultField }
  })
  const nonDefaultFields = customFields.filter((item) => !defaultPassportExtraFields.some((defaultField) => normalizeExtraLabel(defaultField.label) === normalizeExtraLabel(item.label)))
  return [...mergedDefaults, ...nonDefaultFields]
}

function buildPassportEditForm(row) {
  const visitor = row.visitor_detail || {}
  const extra = getPassportExtra(row)
  return {
    type: extra.type || extra.passport_type || '',
    country_code: extra.country_code || '',
    passport_number: visitor.passport_number || '',
    nationality: extra.nationality || visitor.country || '',
    first_name: extra.first_name || '',
    last_name: extra.last_name || visitor.full_name || '',
    date_of_birth: toDateInputValue(visitor.date_of_birth),
    sex: visitor.gender || '',
    date_of_issue: toDateInputValue(extra.date_of_issue),
    date_of_expiry: toDateInputValue(visitor.expiry_date),
    ipv4_address: row.ipv4_address || '',
    ipv6_address: row.ipv6_address || '',
    attendance_date: formatShortDate(row.date),
    attendance_time: formatTime12Hour(row.time),
    latitude: row.latitude || '',
    longitude: row.longitude || '',
    status: visitor.status || '',
    ocr_raw_text: visitor.ocr_raw_text || '',
    additional_fields: getAdditionalFields(row),
  }
}

function renderTimestamp(row) {
  return (
    <span className="event-timestamp-cell">
      <strong>{formatShortDate(row.date)}</strong>
      <span>{formatTime12Hour(row.time)}</span>
    </span>
  )
}

export function EventPassportAttendancePage() {
  const { id } = useParams()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
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
        const attendanceData = await apiRequest(`/passport-attendance/?event=${id}`)
        if (mounted) setRows(listFromResponse(attendanceData))
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
      await apiRequest(`/passport-attendance/${row.id}/`, { method: 'DELETE' })
      setRows((current) => current.filter((item) => item.id !== row.id))
      if (selectedRow?.id === row.id) setSelectedRow(null)
      if (editRow?.id === row.id) setEditRow(null)
    } catch (err) {
      setError(err.message)
    }
  }

  function openEdit(row) {
    setEditRow(row)
    setEditForm(buildPassportEditForm(row))
  }

  function updateEdit(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  function updateEditCountryCode(value) {
    const option = findPassportCountryByCode(value)
    setEditForm((current) => ({
      ...current,
      country_code: value,
      nationality: option?.nationality || current.nationality,
    }))
  }

  function updateEditNationality(value) {
    const option = findPassportCountryByNationality(value)
    setEditForm((current) => ({
      ...current,
      nationality: value,
      country_code: option?.code || current.country_code,
    }))
  }

  function addEditExtraField() {
    setEditForm((current) => ({
      ...current,
      additional_fields: [
        ...(current.additional_fields || []),
        { id: `extra-${Date.now()}`, label: '', value: '' },
      ],
    }))
  }

  function updateEditExtraField(fieldId, field, value) {
    setEditForm((current) => ({
      ...current,
      additional_fields: (current.additional_fields || []).map((item) => {
        if (item.id !== fieldId) return item
        if (item.locked && field === 'label') return item
        return { ...item, [field]: value }
      }),
    }))
  }

  function removeEditExtraField(fieldId) {
    setEditForm((current) => ({
      ...current,
      additional_fields: (current.additional_fields || []).filter((item) => item.id !== fieldId || item.locked),
    }))
  }

  async function saveEdit(event) {
    event.preventDefault()
    if (!editRow || !editForm) return
    setIsSaving(true)
    setError('')
    try {
      const payload = {
        visitor_detail: {
          full_name: `${editForm.first_name} ${editForm.last_name}`.trim(),
          passport_number: editForm.passport_number,
          country: editForm.nationality,
          date_of_birth: editForm.date_of_birth,
          expiry_date: editForm.date_of_expiry,
          gender: editForm.sex,
          status: editForm.status || 'manually-corrected',
          ocr_raw_text: editForm.ocr_raw_text,
          extra_data: {
            type: editForm.type,
            passport_type: editForm.type,
            country_code: editForm.country_code,
            nationality: editForm.nationality,
            first_name: editForm.first_name,
            last_name: editForm.last_name,
            date_of_issue: editForm.date_of_issue,
            additional_fields: (editForm.additional_fields || [])
              .map((item) => ({ label: item.label.trim(), value: item.value.trim() }))
              .filter((item) => item.label || item.value),
          },
        },
      }
      const updated = await apiRequest(`/passport-attendance/${editRow.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
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

  const countryOptions = useMemo(() => {
    const values = new Set()
    rows.forEach((row) => {
      const value = row.visitor_detail?.country?.trim()
      if (value) values.add(value)
    })
    return [
      { value: '', label: 'All Countries' },
      ...Array.from(values).sort().map((value) => ({ value, label: value })),
    ]
  }, [rows])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const visitor = row.visitor_detail || {}
      const matchesSearch = !query
        || visitor.full_name?.toLowerCase().includes(query)
        || visitor.passport_number?.toLowerCase().includes(query)
        || visitor.country?.toLowerCase().includes(query)
      const matchesCountry = !country || visitor.country === country
      return matchesSearch && matchesCountry
    })
  }, [country, rows, search])

  const editHasCustomCountryCode = editForm?.country_code && !findPassportCountryByCode(editForm.country_code)
  const editHasCustomNationality = editForm?.nationality && !findPassportCountryByNationality(editForm.nationality)

  return (
    <>
      <Link className="back-link" to={`/events/${id}`}><ArrowLeft size={15} /> Back to Event</Link>

      <div className="attendance-records-header">
        <div>
          <h2>Visitor Attendance (Non-Malaysian)</h2>
        </div>
        <div className="attendance-total-pill"><Users size={16} /> Total: {filteredRows.length}</div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="event-attendance-section">
        <div className="event-attendance-filter">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search visitor name" />
          <select value={country} onChange={(event) => setCountry(event.target.value)}>
            {countryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" className="btn btn-ocean"><Search size={15} /> Search</button>
          <button type="button" className="btn btn-ghost" onClick={() => {
            setSearch('')
            setCountry('')
          }}>Reset</button>
          <button type="button" className="btn btn-green" onClick={() => downloadApiFile(`/reports/events/${id}/export/passport/`)}><Download size={15} /> Export CSV</button>
        </div>
        <div className="event-detail-table attendance-table-card passport-attendance-table">
          <DataTable
            rows={filteredRows}
            columns={[
              { key: 'name', label: 'Name', render: (row) => <span className="table-ellipsis" title={row.visitor_detail?.full_name}>{row.visitor_detail?.full_name || '-'}</span> },
              { key: 'passport_number', label: 'Passport No', render: (row) => <span className="table-ellipsis" title={row.visitor_detail?.passport_number}>{row.visitor_detail?.passport_number || '-'}</span> },
              { key: 'country', label: 'Country', render: (row) => <span className="table-ellipsis" title={row.visitor_detail?.country}>{row.visitor_detail?.country || '-'}</span> },
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
                    <button type="button" className="btn btn-small btn-icon btn-green" title="View" aria-label="View non-Malaysian visitor" onClick={() => setSelectedRow(row)}><Eye size={15} /></button>
                    <button type="button" className="btn btn-small btn-icon btn-blue" title="Edit" aria-label="Edit non-Malaysian visitor" onClick={() => openEdit(row)}><Pencil size={15} /></button>
                    <button type="button" className="btn btn-small btn-icon btn-red" title="Delete" aria-label="Delete non-Malaysian visitor" onClick={() => deleteAttendance(row)}><Trash2 size={15} /></button>
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
          <div className="modal-box visitor-attendance-modal passport-visitor-modal">
            <div className="modal-header">
              <div className="modal-title">View Non-Malaysian Visitor</div>
              <button type="button" className="modal-close" onClick={() => setSelectedRow(null)}>x</button>
            </div>
            <div className="modal-body visitor-modal-grid">
              <div className="passport-modal-image modal-field-wide">
                <span>Passport Image</span>
                <div>
                  {selectedRow.visitor_detail?.image
                    ? <img src={selectedRow.visitor_detail.image} alt="Passport" />
                    : <span>No passport image</span>}
                </div>
              </div>
              <label className="compact-field"><span>Passport Type</span><input readOnly value={getPassportExtra(selectedRow).type || getPassportExtra(selectedRow).passport_type || ''} /></label>
              <label className="compact-field"><span>Passport Number</span><input readOnly value={selectedRow.visitor_detail?.passport_number || ''} /></label>
              <label className="compact-field"><span>Country Code</span><input readOnly value={getPassportExtra(selectedRow).country_code || ''} /></label>
              <label className="compact-field"><span>Nationality</span><input readOnly value={getPassportExtra(selectedRow).nationality || selectedRow.visitor_detail?.country || ''} /></label>
              <label className="compact-field"><span>First Name</span><input readOnly value={getPassportExtra(selectedRow).first_name || ''} /></label>
              <label className="compact-field"><span>Last Name</span><input readOnly value={getPassportExtra(selectedRow).last_name || selectedRow.visitor_detail?.full_name || ''} /></label>
              <label className="compact-field"><span>Date of Birth</span><input readOnly value={formatShortDate(selectedRow.visitor_detail?.date_of_birth)} /></label>
              <label className="compact-field"><span>Sex</span><input readOnly value={selectedRow.visitor_detail?.gender || ''} /></label>
              <label className="compact-field"><span>Date of Issue</span><input readOnly value={formatShortDate(getPassportExtra(selectedRow).date_of_issue)} /></label>
              <label className="compact-field"><span>Date of Expiry</span><input readOnly value={formatShortDate(selectedRow.visitor_detail?.expiry_date)} /></label>
              <label className="compact-field modal-field-wide"><span>OCR Raw Text</span><textarea readOnly rows={6} value={selectedRow.visitor_detail?.ocr_raw_text || ''} /></label>
              <div className="passport-extra-view modal-field-wide">
                <span>Additional Passport Fields <b>{getAdditionalFields(selectedRow).length}</b></span>
                {getAdditionalFields(selectedRow).length ? getAdditionalFields(selectedRow).map((item, index) => (
                  <div className="passport-extra-view-row" key={`${item.label}-${index}`}>
                    <strong>{item.label}</strong>
                    <p>{String(item.value || '-')}</p>
                  </div>
                )) : <div className="passport-extra-view-empty">No additional fields.</div>}
              </div>
              <label className="compact-field"><span>IPv4 Address</span><input readOnly value={selectedRow.ipv4_address || ''} /></label>
              <label className="compact-field"><span>IPv6 Address</span><input readOnly value={selectedRow.ipv6_address || ''} /></label>
              <label className="compact-field"><span>Attendance Date</span><input readOnly value={formatShortDate(selectedRow.date)} /></label>
              <label className="compact-field"><span>Attendance Time</span><input readOnly value={formatTime12Hour(selectedRow.time)} /></label>
              <label className="compact-field"><span>Latitude</span><input readOnly value={formatCoordinate(selectedRow.latitude)} /></label>
              <label className="compact-field"><span>Longitude</span><input readOnly value={formatCoordinate(selectedRow.longitude)} /></label>
              <label className="compact-field modal-field-wide"><span>Status</span><input readOnly value={selectedRow.visitor_detail?.status || ''} /></label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-blue" onClick={() => {
                openEdit(selectedRow)
                setSelectedRow(null)
              }}><Pencil size={15} /> Edit</button>
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedRow(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editRow && editForm && (
        <div className="modal-overlay open">
          <div className="modal-box visitor-attendance-modal passport-visitor-modal">
            <div className="modal-header">
              <div className="modal-title">Edit Non-Malaysian Visitor</div>
              <button type="button" className="modal-close" onClick={() => setEditRow(null)}>x</button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="modal-body visitor-modal-grid">
                <div className="passport-modal-image modal-field-wide">
                  <span>Passport Image</span>
                  <div>
                    {editRow.visitor_detail?.image
                      ? <img src={editRow.visitor_detail.image} alt="Passport" />
                      : <span>No passport image</span>}
                  </div>
                </div>
                <label className="compact-field"><span>Passport Type</span><input value={editForm.type} onChange={(event) => updateEdit('type', event.target.value)} /></label>
                <label className="compact-field"><span>Passport Number</span><input value={editForm.passport_number} onChange={(event) => updateEdit('passport_number', event.target.value)} required /></label>
                <label className="compact-field">
                  <span>Country Code</span>
                  <select value={editForm.country_code} onChange={(event) => updateEditCountryCode(event.target.value)}>
                    <option value="">-- Select country code --</option>
                    {editHasCustomCountryCode && <option value={editForm.country_code}>{editForm.country_code}</option>}
                    {passportCountryOptions.map((option) => <option key={option.code} value={option.code}>{option.code}</option>)}
                  </select>
                </label>
                <label className="compact-field">
                  <span>Nationality</span>
                  <select value={editForm.nationality} onChange={(event) => updateEditNationality(event.target.value)}>
                    <option value="">-- Select nationality --</option>
                    {editHasCustomNationality && <option value={editForm.nationality}>{editForm.nationality}</option>}
                    {passportCountryOptions.map((option) => <option key={option.nationality} value={option.nationality}>{option.nationality}</option>)}
                  </select>
                </label>
                <label className="compact-field"><span>First Name</span><input value={editForm.first_name} onChange={(event) => updateEdit('first_name', event.target.value)} /></label>
                <label className="compact-field"><span>Last Name</span><input value={editForm.last_name} onChange={(event) => updateEdit('last_name', event.target.value)} /></label>
                <label className="compact-field"><span>Date of Birth</span><input type="date" value={editForm.date_of_birth} onChange={(event) => updateEdit('date_of_birth', event.target.value)} /></label>
                <label className="compact-field"><span>Sex</span><select value={editForm.sex} onChange={(event) => updateEdit('sex', event.target.value)}><option value="">-</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></label>
                <label className="compact-field"><span>Date of Issue</span><input type="date" value={editForm.date_of_issue} onChange={(event) => updateEdit('date_of_issue', event.target.value)} /></label>
                <label className="compact-field"><span>Date of Expiry</span><input type="date" value={editForm.date_of_expiry} onChange={(event) => updateEdit('date_of_expiry', event.target.value)} /></label>
                <label className="compact-field modal-field-wide"><span>OCR Raw Text</span><textarea rows={5} value={editForm.ocr_raw_text} onChange={(event) => updateEdit('ocr_raw_text', event.target.value)} /></label>
                <div className="passport-extra-view passport-extra-edit modal-field-wide">
                  <span>
                    Additional Passport Fields <b>{(editForm.additional_fields || []).length}</b>
                    <button type="button" className="btn btn-small btn-ghost" onClick={addEditExtraField}>Add Field</button>
                  </span>
                  {(editForm.additional_fields || []).map((item) => (
                    <div className="passport-extra-edit-row" key={item.id}>
                      <input value={item.label} onChange={(event) => updateEditExtraField(item.id, 'label', event.target.value)} placeholder="Field label" disabled={item.locked} />
                      <input value={item.value} onChange={(event) => updateEditExtraField(item.id, 'value', event.target.value)} placeholder="Value" />
                      <button type="button" className="passport-extra-delete" onClick={() => removeEditExtraField(item.id)} aria-label="Delete additional field" disabled={item.locked}><Trash2 size={18} /></button>
                    </div>
                  ))}
                </div>
                <label className="compact-field"><span>IPv4 Address</span><input disabled value={editForm.ipv4_address} /></label>
                <label className="compact-field"><span>IPv6 Address</span><input disabled value={editForm.ipv6_address} /></label>
                <label className="compact-field"><span>Attendance Date</span><input disabled value={editForm.attendance_date} /></label>
                <label className="compact-field"><span>Attendance Time</span><input disabled value={editForm.attendance_time} /></label>
                <label className="compact-field"><span>Latitude</span><input disabled value={formatCoordinate(editForm.latitude)} /></label>
                <label className="compact-field"><span>Longitude</span><input disabled value={formatCoordinate(editForm.longitude)} /></label>
                <label className="compact-field modal-field-wide"><span>Status</span><select value={editForm.status} onChange={(event) => updateEdit('status', event.target.value)}><option value="auto-extracted">Auto Extracted</option><option value="manually-corrected">Manually Corrected</option><option value="pending verification">Pending Verification</option></select></label>
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
