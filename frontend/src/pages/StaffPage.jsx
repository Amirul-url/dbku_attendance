import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Edit, Plus, Search, Trash2 } from 'lucide-react'
import { apiRequest, listFromResponse } from '../api/client.js'
import { useConfirmDialog } from '../components/ConfirmDialog.jsx'
import { DataTable } from '../components/DataTable.jsx'
import { useAuth } from '../state/AuthContext.jsx'
import { formatDateTime12Hour } from '../utils/dateTime.js'

const emptyStaff = {
  full_name: '',
  staff_id: '',
  email: '',
  phone_number: '',
  department: '',
  other_department: '',
  registration_method: 'manual',
  role: 'viewer',
  password: '',
  confirm_password: '',
}

const countryCodeOptions = ['+60']
const departments = [
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
        placeholder="-"
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
        placeholder="-"
        aria-label="Phone number"
      />
    </div>
  )
}

function SelectWithIcon({ value, onChange, children, required = false }) {
  return (
    <div className="select-with-icon">
      <select value={value} onChange={onChange} required={required}>
        {children}
      </select>
      <ChevronDown className="select-chevron" size={18} aria-hidden="true" />
    </div>
  )
}

function staffFormFromRow(row) {
  const departmentValue = departments.includes(row.department) ? row.department : 'Others'
  return {
    ...emptyStaff,
    ...row,
    email: row.email || '',
    phone_number: row.phone_number || '',
    department: departmentValue,
    other_department: departmentValue === 'Others' ? row.department : '',
    password: '',
    confirm_password: '',
  }
}

function formatLoginDate(value) {
  if (!value) return 'Never'
  return formatDateTime12Hour(value)
}

function displayOptional(value) {
  return value || '-'
}

function optionalContactPayload(value) {
  const trimmed = String(value || '').trim()
  return trimmed && trimmed !== '-' ? trimmed : null
}

export function StaffPage() {
  const { user, refreshUser } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [modal, setModal] = useState(null)
  const [modalError, setModalError] = useState('')
  const [form, setForm] = useState(emptyStaff)
  const [page, setPage] = useState(1)
  const { confirm, confirmDialog } = useConfirmDialog()
  const isSuperadmin = Boolean(user?.is_superuser || user?.staff_profile?.role === 'superadmin')
  const canViewStaff = Boolean(isSuperadmin || user?.staff_profile?.role === 'admin')
  const canManageStaff = isSuperadmin

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (row.is_superuser || row.role === 'superadmin') return false
    const query = search.toLowerCase()
    const matchesSearch = !query
      || row.full_name?.toLowerCase().includes(query)
      || row.staff_id?.toLowerCase().includes(query)
      || row.email?.toLowerCase().includes(query)
      || row.phone_number?.includes(query)
    const matchesDepartment = !department || row.department === department
    return matchesSearch && matchesDepartment
  }).sort((a, b) => {
    const createdComparison = String(b.created_at || '').localeCompare(String(a.created_at || ''))
    if (createdComparison) return createdComparison
    return Number(b.id) - Number(a.id)
  }), [rows, search, department])
  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize)
  const pageStart = filteredRows.length ? (page - 1) * pageSize + 1 : 0
  const pageEnd = Math.min(page * pageSize, filteredRows.length)

  useEffect(() => {
    setPage(1)
  }, [search, department, rows.length])

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
    if (canViewStaff) {
      load()
    } else {
      setLoading(false)
    }
  }, [canViewStaff])

  function openCreate() {
    if (!canManageStaff) return
    setForm(emptyStaff)
    setModalError('')
    setModal({ mode: 'create' })
  }

  function openEdit(row) {
    if (!canManageStaff) return
    setForm(staffFormFromRow(row))
    setModalError('')
    setModal({ mode: 'edit', id: row.id })
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function saveStaff(event) {
    event.preventDefault()
    setError('')
    setModalError('')
    if (form.password || form.confirm_password) {
      if (form.password !== form.confirm_password) {
        setModalError('Password and confirm password do not match.')
        return
      }
    }
    const payload = {
      ...form,
      email: optionalContactPayload(form.email),
      phone_number: optionalContactPayload(form.phone_number),
      department: form.department === 'Others' ? form.other_department : form.department,
    }
    delete payload.confirm_password
    delete payload.other_department
    if (!payload.password) delete payload.password
    try {
      let savedStaff
      if (modal.mode === 'create') {
        savedStaff = await apiRequest('/staff/', { method: 'POST', body: JSON.stringify(payload) })
        setRows((current) => [savedStaff, ...current])
      } else {
        savedStaff = await apiRequest(`/staff/${modal.id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
        setRows((current) => current.map((row) => (row.id === savedStaff.id ? savedStaff : row)))
      }
      if (savedStaff?.id === user?.staff_profile?.id || savedStaff?.username === user?.username) {
        await refreshUser()
      }
      setModal(null)
    } catch (err) {
      setModalError(err.message)
    }
  }

  async function deleteStaff(row) {
    if (!canManageStaff) return
    const shouldDelete = await confirm({
      title: 'Delete Staff',
      message: `Delete ${row.full_name || 'this staff'}? This action cannot be undone.`,
    })
    if (!shouldDelete) return
    try {
      await apiRequest(`/staff/${row.id}/`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!canViewStaff) {
    return <div className="alert-error">Only an admin or superadmin can access staff management.</div>
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Staff Management</h1>
          <div className="page-sub">Manage staff records and access roles.</div>
        </div>
        {canManageStaff && (
          <button type="button" className="btn btn-green" onClick={openCreate}><Plus size={16} /> Add Staff</button>
        )}
      </div>
      <div className="filter-card">
        <input className="filter-input" placeholder="Search name, Staff ID, email, or phone" value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="filter-select-wrap">
          <select className="filter-input filter-select" value={department} onChange={(event) => setDepartment(event.target.value)}>
            <option value="">All Department</option>
            {departments.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <ChevronDown className="filter-select-chevron" size={18} aria-hidden="true" />
        </div>
        <button type="button" className="btn btn-ocean"><Search size={16} /> Filter</button>
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
              <div className="table-card-sub">Latest 5 staff members per page</div>
            </div>
            <div className="table-pagination table-pagination-header">
              <span>{pageStart}-{pageEnd} of {filteredRows.length}</span>
              <div className="pagination-buttons">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="Previous page">&lt;</button>
                <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} aria-label="Next page">&gt;</button>
              </div>
            </div>
          </div>
          <DataTable
            rows={pageRows}
            columns={[
              { key: 'full_name', label: 'Name', render: (row) => <span className="table-two-line table-name-cell" title={row.full_name}>{row.full_name}</span> },
              { key: 'staff_id', label: 'Staff ID' },
              { key: 'email', label: 'Email', render: (row) => displayOptional(row.email) },
              { key: 'phone_number', label: 'Phone', render: (row) => displayOptional(row.phone_number) },
              { key: 'department', label: 'Department', render: (row) => <span className="table-two-line table-department-cell" title={row.department}>{row.department}</span> },
              { key: 'last_login', label: 'Login Date', render: (row) => <span className="table-date-cell">{formatLoginDate(row.last_login)}</span> },
              { key: 'registration_method', label: 'Method', render: (row) => <span className="badge badge-blue">{row.registration_method}</span> },
              { key: 'role', label: 'Role', render: (row) => <span className={`badge badge-${row.role}`}>{row.role}</span> },
              ...(canManageStaff ? [{
                key: 'actions',
                label: 'Actions',
                render: (row) => (
                  <div className="button-row">
                    <button type="button" className="btn btn-small btn-blue" onClick={() => openEdit(row)}><Edit size={14} /> Edit</button>
                    <button type="button" className="btn btn-small btn-red" onClick={() => deleteStaff(row)}><Trash2 size={14} /> Delete</button>
                  </div>
                ),
              }] : []),
            ]}
          />
        </div>
      )}

      {modal && (
        <div className="modal-overlay open">
          <form className="modal-box modal-staff" onSubmit={saveStaff}>
            <div className="modal-header">
              <div className="modal-title">{modal.mode === 'create' ? 'Add Staff' : 'Edit Staff'}</div>
              <button type="button" className="modal-close" onClick={() => setModal(null)}>x</button>
            </div>
            <div className="modal-body stack-form staff-modal-body">
              <div className="form-section-title">Identity</div>
              <div className="form-grid-2">
                <label className="compact-field"><span>Full Name</span><input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required /></label>
                <label className="compact-field"><span>Staff ID</span><input value={form.staff_id} onChange={(e) => update('staff_id', e.target.value)} required /></label>
              </div>
              <label className="compact-field"><span>Email</span><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="-" /></label>
              <label className="compact-field"><span>WhatsApp Number</span><PhoneNumberSelectInput value={form.phone_number || ''} onChange={(value) => update('phone_number', value)} /></label>

              <div className="form-section-title">Department & Access</div>
              <label className="compact-field">
                <span>Department</span>
                <SelectWithIcon value={form.department} onChange={(e) => update('department', e.target.value)} required>
                  <option value="">-- Select department --</option>
                  {departments.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectWithIcon>
              </label>
              {form.department === 'Others' && (
                <label className="compact-field"><span>Specify Department</span><input value={form.other_department} onChange={(e) => update('other_department', e.target.value)} required /></label>
              )}
              <div className="form-grid-2">
                <label className="compact-field">
                  <span>Method</span>
                  <SelectWithIcon value={form.registration_method} onChange={(e) => update('registration_method', e.target.value)}>
                    <option value="manual">Manual</option>
                    <option value="mykad">MyKad</option>
                  </SelectWithIcon>
                </label>
                <label className="compact-field">
                  <span>Role</span>
                  <SelectWithIcon value={form.role} onChange={(e) => update('role', e.target.value)}>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </SelectWithIcon>
                </label>
              </div>

              <div className="form-section-title">Security</div>
              {modal.mode === 'edit' && (
                <div className="form-helper-note">Leave password fields empty during edit to keep the current password.</div>
              )}
              {modalError && <div className="alert-error">{modalError}</div>}
              <div className="form-grid-2">
                <label className="compact-field"><span>Password</span><input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required={modal.mode === 'create'} minLength={8} /></label>
                <label className="compact-field"><span>Confirm Password</span><input type="password" value={form.confirm_password} onChange={(e) => update('confirm_password', e.target.value)} required={modal.mode === 'create'} minLength={8} /></label>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-ocean">Save</button>
            </div>
          </form>
        </div>
      )}
      {confirmDialog}
    </>
  )
}
