import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Edit, Plus, Trash2 } from 'lucide-react'
import { apiRequest, listFromResponse } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'

const emptyStaff = {
  full_name: '',
  staff_id: '',
  email: '',
  phone_number: '',
  department: '',
  registration_method: 'manual',
  role: 'viewer',
  password: '',
}

const countryCodeOptions = ['+60']

function splitPhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('60')) {
    return { countryCode: '+60', localNumber: digits.slice(2) }
  }
  return { countryCode: '+60', localNumber: digits }
}

function combinePhoneNumber(countryCode, localNumber) {
  const cleanLocalNumber = String(localNumber || '').replace(/\D/g, '')
  if (!cleanLocalNumber) return ''
  return `${String(countryCode || '').replace(/\D/g, '')}${cleanLocalNumber}`
}

function PhoneNumberInput({ value, onChange }) {
  const initialPhone = splitPhoneNumber(value)
  const [countryCode, setCountryCode] = useState(initialPhone.countryCode)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const countryDigits = String(countryCode || '').replace(/\D/g, '')
  const valueDigits = String(value || '').replace(/\D/g, '')
  const localNumber = countryDigits && valueDigits.startsWith(countryDigits)
    ? valueDigits.slice(countryDigits.length)
    : splitPhoneNumber(value).localNumber

  function updatePhone(nextCountryCode, nextLocalNumber) {
    setCountryCode(nextCountryCode)
    onChange(combinePhoneNumber(nextCountryCode, nextLocalNumber))
  }

  function chooseCountryCode(nextCountryCode) {
    setIsMenuOpen(false)
    updatePhone(nextCountryCode, localNumber)
  }

  return (
    <div className="phone-input-grid">
      <div className="phone-code-combo">
        <input
          className="phone-code-input"
          inputMode="tel"
          value={countryCode}
          onChange={(event) => updatePhone(event.target.value, localNumber)}
          aria-label="Country code"
        />
        <button
          type="button"
          className="phone-code-toggle"
          aria-label="Select country code"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">▾</span>
        </button>
        {isMenuOpen && (
          <div className="phone-code-menu">
            {countryCodeOptions.map((option) => (
              <button type="button" key={option} onClick={() => chooseCountryCode(option)}>
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        inputMode="tel"
        value={localNumber}
        onChange={(event) => updatePhone(countryCode, event.target.value)}
        placeholder="e.g. 123456789"
        aria-label="Phone number"
      />
    </div>
  )
}

function PhoneNumberSelectInput({ value, onChange }) {
  const initialPhone = splitPhoneNumber(value)
  const [countryCode, setCountryCode] = useState(initialPhone.countryCode)
  const countryDigits = String(countryCode || '').replace(/\D/g, '')
  const valueDigits = String(value || '').replace(/\D/g, '')
  const localNumber = countryDigits && valueDigits.startsWith(countryDigits)
    ? valueDigits.slice(countryDigits.length)
    : splitPhoneNumber(value).localNumber

  function updatePhone(nextCountryCode, nextLocalNumber) {
    setCountryCode(nextCountryCode)
    onChange(combinePhoneNumber(nextCountryCode, nextLocalNumber))
  }

  return (
    <div className="phone-input-grid">
      <div className="phone-code-select-wrap">
        <select
          className="phone-code-select"
          value={countryCode}
          onChange={(event) => updatePhone(event.target.value, localNumber)}
          aria-label="Country code"
        >
          {countryCodeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <ChevronDown className="phone-code-chevron" size={18} aria-hidden="true" />
      </div>
      <input
        inputMode="tel"
        value={localNumber}
        onChange={(event) => updatePhone(countryCode, event.target.value)}
        placeholder="e.g. 123456789"
        aria-label="Phone number"
      />
    </div>
  )
}

export function StaffPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyStaff)

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (row.is_superuser) return false
    const matchesName = !search || row.full_name.toLowerCase().includes(search.toLowerCase())
    const matchesDepartment = !department || row.department.toLowerCase().includes(department.toLowerCase())
    return matchesName && matchesDepartment
  }), [rows, search, department])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRows(listFromResponse(await apiRequest('/staff/')))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setForm(emptyStaff)
    setModal({ mode: 'create' })
  }

  function openEdit(row) {
    setForm({ ...emptyStaff, ...row, password: '' })
    setModal({ mode: 'edit', id: row.id })
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function saveStaff(event) {
    event.preventDefault()
    const payload = { ...form }
    if (!payload.password) delete payload.password
    try {
      if (modal.mode === 'create') {
        await apiRequest('/staff/', { method: 'POST', body: JSON.stringify(payload) })
      } else {
        await apiRequest(`/staff/${modal.id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
      }
      setModal(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteStaff(row) {
    if (!window.confirm(`Delete ${row.full_name}?`)) return
    try {
      await apiRequest(`/staff/${row.id}/`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Staff Management</h1>
          <div className="page-sub">Manage staff records and access roles.</div>
        </div>
        <button type="button" className="btn btn-ocean" onClick={openCreate}><Plus size={16} /> Add Staff</button>
      </div>
      <div className="filter-card">
        <input className="filter-input" placeholder="Search staff name" value={search} onChange={(event) => setSearch(event.target.value)} />
        <input className="filter-input" placeholder="Search department" value={department} onChange={(event) => setDepartment(event.target.value)} />
        <button type="button" className="btn btn-ocean">Filter</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setSearch(''); setDepartment('') }}>Reset</button>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {loading ? (
        <div className="panel">Loading</div>
      ) : (
        <div className="table-card">
          <div className="table-card-header">
            <div>
              <div className="table-card-title">Staff List</div>
              <div className="table-card-sub">All staff members registered in the system</div>
            </div>
          </div>
          <DataTable
            rows={filteredRows}
            columns={[
              { key: 'full_name', label: 'Name' },
              { key: 'staff_id', label: 'Staff ID' },
              { key: 'email', label: 'Email' },
              { key: 'phone_number', label: 'Phone' },
              { key: 'department', label: 'Department' },
              { key: 'registration_method', label: 'Method', render: (row) => <span className="badge badge-blue">{row.registration_method}</span> },
              { key: 'role', label: 'Role', render: (row) => <span className={`badge badge-${row.role}`}>{row.role}</span> },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => (
                  <div className="button-row">
                    <button type="button" className="btn btn-small btn-blue" onClick={() => openEdit(row)}><Edit size={14} /> Edit</button>
                    <button type="button" className="btn btn-small btn-red" onClick={() => deleteStaff(row)}><Trash2 size={14} /> Delete</button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {modal && (
        <div className="modal-overlay open">
          <form className="modal-box" onSubmit={saveStaff}>
            <div className="modal-header">
              <div className="modal-title">{modal.mode === 'create' ? 'Add Staff' : 'Edit Staff'}</div>
              <button type="button" className="modal-close" onClick={() => setModal(null)}>x</button>
            </div>
            <div className="modal-body stack-form">
              <div className="form-grid-2">
                <label className="compact-field"><span>Full Name</span><input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required /></label>
                <label className="compact-field"><span>Staff ID</span><input value={form.staff_id} onChange={(e) => update('staff_id', e.target.value)} required /></label>
              </div>
              <label className="compact-field"><span>Email</span><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required /></label>
              <label className="compact-field"><span>WhatsApp Number</span><PhoneNumberSelectInput value={form.phone_number || ''} onChange={(value) => update('phone_number', value)} /></label>
              <label className="compact-field"><span>Department</span><input value={form.department} onChange={(e) => update('department', e.target.value)} required /></label>
              <div className="form-grid-2">
                <label className="compact-field"><span>Method</span><select value={form.registration_method} onChange={(e) => update('registration_method', e.target.value)}><option value="manual">Manual</option><option value="mykad">MyKad</option></select></label>
                <label className="compact-field"><span>Role</span><select value={form.role} onChange={(e) => update('role', e.target.value)}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></select></label>
              </div>
              <label className="compact-field"><span>Password {modal.mode === 'edit' ? '(leave blank to keep current)' : ''}</span><input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required={modal.mode === 'create'} minLength={8} /></label>
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
