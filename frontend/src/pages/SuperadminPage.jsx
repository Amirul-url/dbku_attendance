import { useEffect, useMemo, useState } from 'react'
import { Edit, Plus, Trash2 } from 'lucide-react'
import { apiRequest, listFromResponse } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'
import { useAuth } from '../state/AuthContext.jsx'

const emptySuperadmin = {
  full_name: '',
  staff_id: '',
  email: '',
  phone_number: '',
  department: 'Administration',
  role: 'admin',
  registration_method: 'manual',
  is_staff: true,
  is_superuser: true,
  password: '',
}

export function SuperadminPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptySuperadmin)

  const canManageSuperadmins = Boolean(user?.is_superuser)

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (!row.is_superuser) return false
    const query = search.toLowerCase()
    return !query
      || row.full_name?.toLowerCase().includes(query)
      || row.staff_id?.toLowerCase().includes(query)
      || row.email?.toLowerCase().includes(query)
  }), [rows, search])

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

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function openCreate() {
    setForm(emptySuperadmin)
    setModal({ mode: 'create' })
  }

  function openEdit(row) {
    setForm({ ...emptySuperadmin, ...row, role: 'admin', is_staff: true, is_superuser: true, password: '' })
    setModal({ mode: 'edit', id: row.id })
  }

  async function saveSuperadmin(event) {
    event.preventDefault()
    const payload = {
      ...form,
      role: 'admin',
      is_staff: true,
      is_superuser: true,
      registration_method: 'manual',
    }
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

  async function deleteSuperadmin(row) {
    if (!window.confirm(`Delete superadmin ${row.full_name}?`)) return
    try {
      await apiRequest(`/staff/${row.id}/`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!canManageSuperadmins) {
    return <div className="alert-error">Only a superadmin can access this page.</div>
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Superadmin Management</h1>
          <div className="page-sub">Manage superadmin accounts separately from staff records.</div>
        </div>
        <button type="button" className="btn btn-ocean" onClick={openCreate}><Plus size={16} /> Add Superadmin</button>
      </div>
      <div className="filter-card">
        <input className="filter-input" placeholder="Search superadmin name, staff ID, or email" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button type="button" className="btn btn-ghost" onClick={() => setSearch('')}>Reset</button>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {loading ? (
        <div className="panel">Loading</div>
      ) : (
        <div className="table-card">
          <div className="table-card-header">
            <div>
              <div className="table-card-title">Superadmin List</div>
              <div className="table-card-sub">Accounts with full system access</div>
            </div>
          </div>
          <DataTable
            rows={filteredRows}
            columns={[
              { key: 'full_name', label: 'Name' },
              { key: 'staff_id', label: 'Username' },
              { key: 'email', label: 'Email' },
              { key: 'department', label: 'Department' },
              { key: 'role', label: 'Role', render: () => <span className="badge badge-admin">superadmin</span> },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => (
                  <div className="button-row">
                    <button type="button" className="btn btn-small btn-blue" onClick={() => openEdit(row)}><Edit size={14} /> Edit</button>
                    <button type="button" className="btn btn-small btn-red" onClick={() => deleteSuperadmin(row)}><Trash2 size={14} /> Delete</button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {modal && (
        <div className="modal-overlay open">
          <form className="modal-box" onSubmit={saveSuperadmin}>
            <div className="modal-header">
              <div className="modal-title">{modal.mode === 'create' ? 'Add Superadmin' : 'Edit Superadmin'}</div>
              <button type="button" className="modal-close" onClick={() => setModal(null)}>x</button>
            </div>
            <div className="modal-body stack-form">
              <div className="form-grid-2">
                <label className="compact-field"><span>Full Name</span><input value={form.full_name} onChange={(event) => update('full_name', event.target.value)} required /></label>
                <label className="compact-field"><span>Username</span><input value={form.staff_id} onChange={(event) => update('staff_id', event.target.value)} required /></label>
              </div>
              <label className="compact-field"><span>Email</span><input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required /></label>
              <label className="compact-field"><span>WhatsApp Number</span><input value={form.phone_number || ''} onChange={(event) => update('phone_number', event.target.value)} inputMode="tel" /></label>
              <label className="compact-field"><span>Department</span><input value={form.department} onChange={(event) => update('department', event.target.value)} required /></label>
              <label className="compact-field"><span>Password {modal.mode === 'edit' ? '(leave blank to keep current)' : ''}</span><input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} required={modal.mode === 'create'} minLength={8} /></label>
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
