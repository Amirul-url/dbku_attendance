import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { apiRequest, listFromResponse } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'
import { formatTime12Hour } from '../utils/dateTime.js'

export function AttendancePage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRows(listFromResponse(await apiRequest('/staff-attendance/')))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function deleteAttendance(row) {
    if (!window.confirm(`Delete attendance for ${row.full_name || 'this staff'}?`)) return
    setError('')
    try {
      await apiRequest(`/staff-attendance/${row.id}/`, { method: 'DELETE' })
      setRows((current) => current.filter((item) => item.id !== row.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Attendance</h1>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {loading ? (
        <div className="panel">Loading</div>
      ) : (
        <DataTable
          rows={rows}
          columns={[
            { key: 'full_name', label: 'Name' },
            { key: 'staff_id', label: 'Staff ID' },
            { key: 'event_name', label: 'Event' },
            { key: 'date', label: 'Date' },
            { key: 'time', label: 'Time', render: (row) => formatTime12Hour(row.time) },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <button type="button" className="btn btn-small btn-red" onClick={() => deleteAttendance(row)}><Trash2 size={14} /> Delete</button>
              ),
            },
          ]}
        />
      )}
    </>
  )
}
