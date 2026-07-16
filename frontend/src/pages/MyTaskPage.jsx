import { ArrowLeft, CalendarDays, Download, ExternalLink, Eye, QrCode, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { API_BASE_URL, apiRequest, getAccessToken, listFromResponse } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'
import { RichTextDisplay } from '../components/RichTextDisplay.jsx'
import { useAuth } from '../state/AuthContext.jsx'
import { formatTime12Hour } from '../utils/dateTime.js'
import { richTextToPlainText } from '../utils/richText.js'

const monthOptions = [
  { value: '', label: 'All Month' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

function formatDisplayDate(value) {
  if (!value) return '-'
  const [year, month, day] = String(value).split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return '-'
  if (!endDate || startDate === endDate) return formatDisplayDate(startDate)
  return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`
}

function formatStatus(value) {
  return String(value || '-')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatCoordinate(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(6) : '-'
}

function initials(value) {
  const words = String(value || 'NA').trim().split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'NA'
}

function getQrDownloadUrl(qrUrl) {
  if (!qrUrl) return ''
  if (qrUrl.startsWith('http')) return qrUrl
  return `${API_BASE_URL.replace('/api', '')}${qrUrl}`
}

function getAssignmentStatus(assignment, attendance) {
  if (attendance && assignment?.assignment_status === 'assigned') return 'in_progress'
  return assignment?.assignment_status || 'assigned'
}

function useMyTasks() {
  const [assignments, setAssignments] = useState([])
  const [attendanceRows, setAttendanceRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const assignmentRows = listFromResponse(await apiRequest('/event-assignments/my-tasks/'))
        const nestedAttendanceRows = await Promise.all(
          assignmentRows.map((assignment) => (
            apiRequest(`/assignment-attendance/?assignment=${assignment.id}`)
              .then((data) => listFromResponse(data).map((row) => ({ ...row, assignment_id: assignment.id })))
              .catch(() => [])
          )),
        )
        if (!mounted) return
        setAssignments(assignmentRows)
        setAttendanceRows(nestedAttendanceRows.flat())
      } catch (err) {
        if (mounted) setError(err.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const attendanceByAssignmentId = useMemo(() => {
    const map = new Map()
    attendanceRows.forEach((item) => map.set(Number(item.assignment_id || item.assignment), item))
    return map
  }, [attendanceRows])

  const rows = useMemo(() => (
    assignments.map((assignment) => {
      const attendance = attendanceByAssignmentId.get(Number(assignment.id))
      return {
        ...assignment,
        attendance,
        displayStatus: getAssignmentStatus(assignment, attendance),
        attendanceStatus: attendance ? 'submitted' : 'pending',
      }
    })
  ), [assignments, attendanceByAssignmentId])

  return { rows, loading, error }
}

function getYearOptions(rows) {
  const years = rows
    .map((row) => String(row.event_start_date || '').slice(0, 4))
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .sort((a, b) => Number(b) - Number(a))
  return years.length ? years : [String(new Date().getFullYear())]
}

function filterRows(rows, filters) {
  const query = filters.search.trim().toLowerCase()
  return rows.filter((row) => {
    const [eventYear, eventMonth] = String(row.event_start_date || '').split('-')
    const matchesMonth = !filters.month || Number(eventMonth) === Number(filters.month)
    const matchesYear = !filters.year || eventYear === filters.year
    const haystack = [
      row.event_name,
      row.event_location,
      row.task_title,
      richTextToPlainText(row.task_description),
      row.displayStatus,
      row.attendanceStatus,
    ].join(' ').toLowerCase()
    const matchesSearch = !query || haystack.includes(query)
    return matchesMonth && matchesYear && matchesSearch
  })
}

export function MyTaskPage() {
  const { user } = useAuth()
  const { rows, loading, error } = useMyTasks()
  const [draftFilters, setDraftFilters] = useState({ search: '', month: '', year: '' })
  const [appliedFilters, setAppliedFilters] = useState({ search: '', month: '', year: '' })
  const [page, setPage] = useState(1)
  const pageSize = 5

  const yearOptions = useMemo(() => getYearOptions(rows), [rows])
  const filteredRows = useMemo(() => filterRows(rows, appliedFilters), [appliedFilters, rows])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const pageStart = filteredRows.length ? (safePage - 1) * pageSize + 1 : 0
  const pageEnd = Math.min(safePage * pageSize, filteredRows.length)

  useEffect(() => {
    setPage(1)
  }, [appliedFilters])

  function updateDraftFilter(field, value) {
    setDraftFilters((current) => ({ ...current, [field]: value }))
  }

  function applyFilters() {
    setAppliedFilters(draftFilters)
  }

  function resetFilters() {
    const nextFilters = { search: '', month: '', year: '' }
    setDraftFilters(nextFilters)
    setAppliedFilters(nextFilters)
  }

  if (!user?.staff_profile) {
    return <div className="alert-error">Staff profile is required to view My Task.</div>
  }

  return (
    <div className="my-task-page">
      <div className="page-header">
        <div>
          <h1>My Task</h1>
          <div className="page-sub">Assigned event tasks for your account.</div>
        </div>
        <div className="attendance-total-pill"><CalendarDays size={16} /> Total: {filteredRows.length}</div>
      </div>

      <div className="my-task-filter">
        <input value={draftFilters.search} onChange={(event) => updateDraftFilter('search', event.target.value)} placeholder="Search event or task" />
        <select value={draftFilters.month} onChange={(event) => updateDraftFilter('month', event.target.value)}>
          {monthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select value={draftFilters.year} onChange={(event) => updateDraftFilter('year', event.target.value)}>
          <option value="">All Year</option>
          {yearOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button type="button" className="btn btn-ocean" onClick={applyFilters}><Search size={15} /> Apply Filter</button>
        <button type="button" className="btn btn-ghost" onClick={resetFilters}>Reset</button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="table-card my-task-table-card">
        <div className="table-card-header">
          <div>
            <div className="table-card-title">Task List</div>
            <div className="table-card-sub">{loading ? 'Loading tasks...' : 'Latest 5 tasks per page'}</div>
          </div>
          <div className="table-pagination table-pagination-header">
            <span>{pageStart}-{pageEnd} of {filteredRows.length}</span>
            <div className="pagination-buttons">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1} aria-label="Previous page">&lt;</button>
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages} aria-label="Next page">&gt;</button>
            </div>
          </div>
        </div>
        <DataTable
          rows={loading ? [] : pageRows}
          emptyLabel={loading ? 'Loading tasks...' : 'No task assigned.'}
          columns={[
            { key: 'event_name', label: 'Event', render: (row) => <span className="table-two-line"><strong>{row.event_name}</strong><span>{row.event_location || '-'}</span></span> },
            { key: 'event_start_date', label: 'Date', render: (row) => formatDateRange(row.event_start_date, row.event_end_date) },
            { key: 'task_title', label: 'Task', render: (row) => <span className="event-assignment-task my-task-table-task"><strong>{row.task_title}</strong><RichTextDisplay value={row.task_description || '-'} className="assignment-table-description" /></span> },
            { key: 'assignment_status', label: 'Status', render: (row) => <span className={`status-pill status-${row.displayStatus}`}>{formatStatus(row.displayStatus)}</span> },
            { key: 'attendance', label: 'Attendance', render: (row) => <span className={`status-pill status-${row.attendanceStatus}`}>{row.attendance ? 'Submitted' : 'Pending'}</span> },
            {
              key: 'actions',
              label: 'Action',
              render: (row) => (
                <Link className="btn btn-small btn-green" to={`/my-task/${row.id}`}>
                  <Eye size={14} /> View
                </Link>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

export function MyTaskDetailPage() {
  const { taskId } = useParams()
  const { rows, loading, error } = useMyTasks()
  const assignment = rows.find((row) => Number(row.id) === Number(taskId))

  if (loading) return <div className="panel">Loading task details</div>
  if (error) return <div className="alert-error">{error}</div>
  if (!assignment) return <div className="alert-error">Task not found for your account.</div>

  return (
    <div className="my-task-page">
      <Link className="back-link my-task-back-link" to="/my-task"><ArrowLeft size={15} /> Back to My Task</Link>
      <MyTaskDetail assignment={assignment} />
    </div>
  )
}

function MyTaskDetail({ assignment }) {
  const attendance = assignment.attendance
  const assignmentStatus = getAssignmentStatus(assignment, attendance)

  async function downloadQr(qrUrl, filename) {
    const url = getQrDownloadUrl(qrUrl)
    if (!url) return
    const headers = new Headers()
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(url, { headers })
    if (!response.ok) return
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }

  function openAssignmentForm(assignmentId) {
    window.open(`${window.location.origin}/assignment-attendance/${assignmentId}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="my-task-detail-panel">
      <div className="assignment-detail-layout">
        <section className="assignment-detail-summary">
          <div className="assignment-detail-person">
            <span className="assignment-detail-avatar">{initials(assignment.staff_name)}</span>
            <div>
              <span>Assigned Staff</span>
              <h3>{assignment.staff_name || '-'}</h3>
              <p>{assignment.staff_id || '-'} | {assignment.staff_department || '-'}</p>
            </div>
          </div>
          <div className="assignment-detail-status-row">
            <span className={`status-pill status-${assignmentStatus}`}>{formatStatus(assignmentStatus)}</span>
            <span className={`status-pill status-${attendance ? 'submitted' : 'pending'}`}>
              {attendance ? 'Submitted' : 'Pending Attendance'}
            </span>
          </div>
          <div className="assignment-detail-task-card">
            <span>Task</span>
            <h4>{assignment.task_title || '-'}</h4>
            <RichTextDisplay value={assignment.task_description || '-'} className="assignment-detail-task-description" />
          </div>
        </section>

        <aside className="assignment-detail-qr-panel">
          <span>Assignment QR</span>
          <div>
            {assignment.qr_url ? <img src={assignment.qr_url} alt="Assignment QR Code" /> : <QrCode size={108} />}
          </div>
          <div className="my-task-qr-actions">
            <button type="button" className="btn btn-blue" onClick={() => openAssignmentForm(assignment.id)}><ExternalLink size={15} /> Open Form</button>
            {assignment.qr_url && (
              <button type="button" className="btn btn-ocean" onClick={() => downloadQr(assignment.qr_url, `${assignment.task_title || 'assignment'}-qr.png`)}>
                <Download size={15} /> Download QR
              </button>
            )}
          </div>
        </aside>

        <EventSummaryCard assignment={assignment} />

        <DetailSection title="Staff Contact">
          <ReadOnlyField label="Email" value={assignment.staff_email} />
          <ReadOnlyField label="Phone Number" value={assignment.staff_phone_number} />
        </DetailSection>

        <DetailSection title="Attendance Record">
          <ReadOnlyField label="Date" value={attendance?.date ? formatDisplayDate(attendance.date) : '-'} />
          <ReadOnlyField label="Time" value={attendance?.time ? formatTime12Hour(attendance.time) : '-'} />
          <ReadOnlyField label="Latitude" value={attendance?.latitude ? formatCoordinate(attendance.latitude) : '-'} />
          <ReadOnlyField label="Longitude" value={attendance?.longitude ? formatCoordinate(attendance.longitude) : '-'} />
          <ReadOnlyField label="IPv4" value={attendance?.ipv4_address || '-'} />
          <ReadOnlyField label="IPv6" value={attendance?.ipv6_address || '-'} />
          <ReadOnlyField label="Notes" value={attendance?.notes || '-'} wide />
        </DetailSection>
      </div>
    </section>
  )
}

function EventSummaryCard({ assignment }) {
  return (
    <section className="my-task-event-card">
      <div className="event-view-hero">
        <div className="event-view-title-row">
          <div className="event-view-icon"><CalendarDays size={19} /></div>
          <div>
            <h1>{assignment.event_name || '-'}</h1>
          </div>
        </div>
        <div className="event-radius-pill">Radius: {assignment.event_radius_meter || '-'}m</div>
      </div>
      <div className="event-view-summary-grid">
        <section>
          <div className="event-view-section-label">Schedule</div>
          <InfoBlock label="Start Date" value={formatDisplayDate(assignment.event_start_date)} />
          <InfoBlock label="End Date" value={formatDisplayDate(assignment.event_end_date)} />
          <InfoBlock label="Start Time" value={formatTime12Hour(assignment.event_start_time)} />
          <InfoBlock label="End Time" value={formatTime12Hour(assignment.event_end_time)} />
        </section>
        <section>
          <div className="event-view-section-label">Location</div>
          <InfoBlock label="Venue" value={assignment.event_location || '-'} strong />
          <InfoBlock label="Latitude" value={formatCoordinate(assignment.event_latitude)} />
          <InfoBlock label="Longitude" value={formatCoordinate(assignment.event_longitude)} />
        </section>
        <section>
          <div className="event-view-section-label">Details</div>
          <InfoBlock label="Description" value={assignment.event_description || '-'} strong />
        </section>
      </div>
    </section>
  )
}

function InfoBlock({ label, value, strong = false }) {
  return (
    <div className="event-info-block">
      <span>{label}</span>
      <strong className={strong ? 'event-info-strong' : ''}>{value || '-'}</strong>
    </div>
  )
}

function ReadOnlyField({ label, value, wide = false }) {
  return (
    <div className={`assignment-readonly-field ${wide ? 'assignment-readonly-wide' : ''}`}>
      <span>{label}</span>
      <p>{value || '-'}</p>
    </div>
  )
}

function DetailSection({ title, children }) {
  return (
    <section className="assignment-detail-section">
      <h3>{title}</h3>
      <div className="assignment-detail-section-grid">
        {children}
      </div>
    </section>
  )
}
