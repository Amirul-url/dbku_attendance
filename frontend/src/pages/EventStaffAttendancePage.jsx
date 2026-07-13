import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, Search, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest, downloadApiFile, listFromResponse } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'

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

function formatDisplayTime(value) {
  if (!value) return '-'
  return String(value).slice(0, 5)
}

function renderTimestamp(row) {
  return (
    <span className="event-timestamp-cell">
      <strong>{formatShortDate(row.date)}</strong>
      <span>{formatDisplayTime(row.time)}</span>
    </span>
  )
}

export function EventStaffAttendancePage() {
  const { id } = useParams()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function load() {
      setError('')
      try {
        const attendanceData = await apiRequest(`/staff-attendance/?event=${id}`)
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

  const departmentOptions = useMemo(() => {
    const values = new Set()
    rows.forEach((row) => {
      const value = row.department?.trim()
      if (value) values.add(value)
    })
    return [
      { value: '', label: 'All Departments' },
      ...Array.from(values).sort().map((value) => ({ value, label: value })),
    ]
  }, [rows])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch = !query
        || row.full_name?.toLowerCase().includes(query)
        || row.staff_id?.toLowerCase().includes(query)
        || row.email?.toLowerCase().includes(query)
        || row.phone_number?.toLowerCase().includes(query)
      const matchesDepartment = !department || row.department === department
      return matchesSearch && matchesDepartment
    })
  }, [department, rows, search])

  return (
    <>
      <Link className="back-link" to={`/events/${id}`}><ArrowLeft size={15} /> Back to Event</Link>

      <div className="attendance-records-header">
        <div>
          <h2>Employee / Staff Attendance</h2>
        </div>
        <div className="attendance-total-pill"><Users size={16} /> Total: {filteredRows.length}</div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="event-attendance-section">
        <div className="event-attendance-filter">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff name" />
          <select value={department} onChange={(event) => setDepartment(event.target.value)}>
            {departmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" className="btn btn-ocean"><Search size={15} /> Search</button>
          <button type="button" className="btn btn-ghost" onClick={() => {
            setSearch('')
            setDepartment('')
          }}>Reset</button>
          <button type="button" className="btn btn-green" onClick={() => downloadApiFile(`/reports/events/${id}/export/staff/`)}><Download size={15} /> Export CSV</button>
        </div>
        <div className="event-detail-table">
          <DataTable
            rows={filteredRows}
            columns={[
              { key: 'full_name', label: 'Name' },
              { key: 'staff_id', label: 'Employee ID' },
              { key: 'email', label: 'Email' },
              { key: 'phone_number', label: 'Phone' },
              { key: 'department', label: 'Department' },
              { key: 'ipv4_address', label: 'IPv4', render: (row) => row.ipv4_address || '-' },
              { key: 'ipv6_address', label: 'IPv6', render: (row) => row.ipv6_address || '-' },
              { key: 'timestamp', label: 'Timestamp', render: renderTimestamp },
              { key: 'latitude', label: 'Latitude', render: (row) => formatCoordinate(row.latitude) },
              { key: 'longitude', label: 'Longitude', render: (row) => formatCoordinate(row.longitude) },
            ]}
          />
        </div>
        <div className="event-section-pagination">Page 1 of 1</div>
      </section>
    </>
  )
}
