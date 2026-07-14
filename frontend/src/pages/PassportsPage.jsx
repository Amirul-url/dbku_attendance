import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { apiRequest, listFromResponse } from '../api/client.js'
import { useConfirmDialog } from '../components/ConfirmDialog.jsx'
import { DataTable } from '../components/DataTable.jsx'

export function PassportsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { confirm, confirmDialog } = useConfirmDialog()

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRows(listFromResponse(await apiRequest('/passport-visitors/')))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function deletePassport(row) {
    const shouldDelete = await confirm({
      title: 'Delete Passport Record',
      message: `Delete passport record for ${row.full_name || row.passport_number}? This action cannot be undone.`,
    })
    if (!shouldDelete) return
    setError('')
    try {
      await apiRequest(`/passport-visitors/${row.id}/`, { method: 'DELETE' })
      setRows((current) => current.filter((item) => item.id !== row.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Passports</h1>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {loading ? (
        <div className="panel">Loading</div>
      ) : (
        <DataTable
          rows={rows}
          columns={[
            { key: 'full_name', label: 'Name' },
            { key: 'passport_number', label: 'Passport No.' },
            { key: 'country', label: 'Country' },
            { key: 'expiry_date', label: 'Expiry' },
            { key: 'status', label: 'Status' },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <button type="button" className="btn btn-small btn-red" onClick={() => deletePassport(row)}><Trash2 size={14} /> Delete</button>
              ),
            },
          ]}
        />
      )}
      {confirmDialog}
    </>
  )
}
