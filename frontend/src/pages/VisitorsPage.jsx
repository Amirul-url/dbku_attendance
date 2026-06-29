import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { apiRequest, listFromResponse } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'

export function VisitorsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const filteredRows = useMemo(() => rows.filter((row) => {
    const query = search.toLowerCase()
    return !query
      || row.full_name?.toLowerCase().includes(query)
      || row.email?.toLowerCase().includes(query)
      || row.organization?.toLowerCase().includes(query)
      || row.phone_number?.includes(query)
  }), [rows, search])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRows(listFromResponse(await apiRequest('/visitors/')))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function deleteVisitor(row) {
    if (!window.confirm(`Delete ${row.full_name}?`)) return
    try {
      await apiRequest(`/visitors/${row.id}/`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Visitor Management</h1>
          <div className="page-sub">View visitor records captured from attendance forms.</div>
        </div>
      </div>
      <div className="filter-card">
        <input className="filter-input" placeholder="Search visitor, email, phone, or organization" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button type="button" className="btn btn-ghost" onClick={() => setSearch('')}>Reset</button>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {loading ? (
        <div className="panel">Loading</div>
      ) : (
        <div className="table-card">
          <div className="table-card-header">
            <div>
              <div className="table-card-title">Visitor List</div>
              <div className="table-card-sub">All visitors registered in the system</div>
            </div>
          </div>
          <DataTable
            rows={filteredRows}
            columns={[
              { key: 'full_name', label: 'Name' },
              { key: 'phone_number', label: 'Phone' },
              { key: 'email', label: 'Email' },
              { key: 'organization', label: 'Organization' },
              { key: 'created_at', label: 'Created', render: (row) => new Date(row.created_at).toLocaleDateString() },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => (
                  <button type="button" className="btn btn-small btn-red" onClick={() => deleteVisitor(row)}><Trash2 size={14} /> Delete</button>
                ),
              },
            ]}
          />
        </div>
      )}
    </>
  )
}
