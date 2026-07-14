import {
  Activity,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  Contact,
  IdCard,
  KeyRound,
  LayoutDashboard,
  PieChart,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/client.js'
import { useAuth } from '../state/AuthContext.jsx'

function parseDate(value) {
  if (!value) return null
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function formatDisplayDate(value, fallback = '') {
  const date = parseDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatEventDateRange(start, end) {
  const startText = formatDisplayDate(start)
  const endText = formatDisplayDate(end)
  if (!startText && !endText) return '-'
  if (startText === endText || !endText) return startText
  return `${startText} - ${endText}`
}

function initials(value) {
  const words = String(value || 'NA').trim().split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'NA'
}

function roleLabel(role, isSuperuser) {
  if (isSuperuser || role === 'superadmin') return 'Superadmin'
  if (role === 'admin') return 'Admin'
  return 'Viewer'
}

function activityBadge(type) {
  if (type === 'Staff') return 'Staff'
  if (type?.includes('Non-Malaysian')) return 'Visitor (Non-Malaysian)'
  return 'Visitor (Malaysian)'
}

function paginateItems(items, page, pageSize = 5) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const startIndex = (safePage - 1) * pageSize
  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page: safePage,
    totalPages,
    start: items.length ? startIndex + 1 : 0,
    end: Math.min(startIndex + pageSize, items.length),
  }
}

function MiniPagination({ page, totalPages, start, end, total, onPrevious, onNext }) {
  return (
    <div className="dashboard-mini-pagination">
      <span>{start}-{end} of {total}</span>
      <div className="pagination-buttons">
        <button type="button" onClick={onPrevious} disabled={page <= 1} aria-label="Previous page">&lt;</button>
        <button type="button" onClick={onNext} disabled={page >= totalPages} aria-label="Next page">&gt;</button>
      </div>
    </div>
  )
}

function AttendanceDonutChart({ segments, total }) {
  const [hoveredSegment, setHoveredSegment] = useState(null)
  const radius = 78
  const circumference = 2 * Math.PI * radius
  const hasData = total > 0
  let offset = 0
  const activeSegment = hoveredSegment || { label: 'Total Attendance', value: total }

  return (
    <div className="dashboard-donut" onMouseLeave={() => setHoveredSegment(null)}>
      <svg className="dashboard-donut-svg" viewBox="0 0 220 220" role="img" aria-label="Attendance overview chart">
        <circle className="dashboard-donut-track" cx="110" cy="110" r={radius} />
        {hasData ? segments.map((segment) => {
          const dash = (segment.value / total) * circumference
          const dashOffset = -offset
          offset += dash
          return (
            <circle
              key={segment.label}
              className={`dashboard-donut-segment ${segment.className}`}
              cx="110"
              cy="110"
              r={radius}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={dashOffset}
              onMouseEnter={() => setHoveredSegment(segment)}
              onFocus={() => setHoveredSegment(segment)}
              tabIndex={0}
            >
              <title>{segment.label}: {segment.value}</title>
            </circle>
          )
        }) : null}
      </svg>
      <div className="dashboard-donut-center">
        <strong>{activeSegment.value}</strong>
        <span>{activeSegment.label}</span>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [recentDate, setRecentDate] = useState('')
  const [recentPage, setRecentPage] = useState(1)
  const [eventPage, setEventPage] = useState(1)

  useEffect(() => {
    apiRequest('/reports/dashboard/').then(setData).catch((err) => setError(err.message))
  }, [])

  const profile = user?.staff_profile
  const accountName = profile?.full_name || user?.first_name || user?.username || 'User'
  const role = roleLabel(profile?.role, user?.is_superuser)
  const canManage = role === 'Admin' || role === 'Superadmin'
  const todayAttendance = (data?.today_staff_attendance ?? 0) + (data?.today_visitor_attendance ?? 0) + (data?.today_passport_attendance ?? 0)
  const totalAttendance = (data?.total_staff_attendance ?? 0) + (data?.total_visitor_attendance ?? 0) + (data?.total_passport_attendance ?? 0)
  const todayLabel = formatDisplayDate(data?.today_date, formatDisplayDate(new Date().toISOString().slice(0, 10)))
  const staffAttendance = data?.total_staff_attendance ?? 0
  const visitorAttendance = data?.total_visitor_attendance ?? 0
  const passportAttendance = data?.total_passport_attendance ?? 0
  const chartSegments = [
    { label: 'Staff', value: staffAttendance, className: 'dashboard-donut-staff' },
    { label: 'Malaysian Visitors', value: visitorAttendance, className: 'dashboard-donut-visitor' },
    { label: 'Non-Malaysian Visitors', value: passportAttendance, className: 'dashboard-donut-passport' },
  ]
  const recentActivities = data?.recent_activities || []
  const filteredRecentActivities = useMemo(() => (
    recentActivities.filter((item) => !recentDate || item.date === recentDate)
  ), [recentActivities, recentDate])
  const recentPagination = paginateItems(filteredRecentActivities, recentPage)
  const eventSummaryItems = useMemo(() => [
    ...(data?.active_events_list || []).map((event) => ({ ...event, statusLabel: 'Ongoing', sortGroup: 0 })),
    ...(data?.upcoming_events || []).map((event) => ({ ...event, statusLabel: 'Upcoming', sortGroup: 1 })),
  ].sort((a, b) => {
    if (a.sortGroup !== b.sortGroup) return a.sortGroup - b.sortGroup
    return String(a.start_date || '').localeCompare(String(b.start_date || '')) || Number(a.id) - Number(b.id)
  }), [data?.active_events_list, data?.upcoming_events])
  const eventPagination = paginateItems(eventSummaryItems, eventPage)

  useEffect(() => {
    setRecentPage(1)
  }, [recentDate, recentActivities.length])

  useEffect(() => {
    setEventPage(1)
  }, [eventSummaryItems.length])

  const overviewCards = [
    { label: 'Today Attendance', value: todayAttendance, detail: todayLabel, icon: Activity, tone: 'blue' },
    { label: 'Active Events', value: data?.active_events ?? 0, detail: 'Ongoing today', icon: CalendarDays, tone: 'purple' },
    { label: 'Total Staff', value: data?.total_staff ?? 0, detail: 'Registered users', icon: Users, tone: 'pink' },
    { label: 'Total Events', value: data?.total_events ?? 0, detail: 'All created events', icon: CalendarDays, tone: 'rose' },
  ]

  const breakdownCards = [
    { label: 'Staff Attendance', value: staffAttendance, icon: ShieldCheck, tone: 'orange' },
    { label: 'Visitor (Malaysian)', value: visitorAttendance, icon: Contact, tone: 'green' },
    { label: 'Visitor (Non-Malaysian)', value: passportAttendance, icon: IdCard, tone: 'cyan' },
    {
      label: 'Total Attendance',
      value: totalAttendance,
      icon: ClipboardCheck,
      tone: 'teal',
    },
  ]

  return (
    <div className="dashboard-page">
      <div className="dashboard-hero">
        <div className="dashboard-heading">
          <h1>Dashboard</h1>
          <p>
            Welcome back, <strong>{accountName}</strong> <span className="role-chip">{role}</span>
          </p>
        </div>
        <div className="dashboard-actions">
          {canManage && (
            <Link className="dashboard-action dashboard-action-ocean" to="/staff">
              <UserPlus size={16} /> Add Staff
            </Link>
          )}
          {canManage && (
            <Link className="dashboard-action dashboard-action-green" to="/events">
              <CalendarDays size={16} /> Manage Events
            </Link>
          )}
          <Link className="dashboard-action dashboard-action-dark" to="/analytics">
            <Activity size={16} /> View Analytics
          </Link>
        </div>
      </div>
      {error && <div className="alert-error">{error}</div>}

      <div className="dashboard-section-label">Overview</div>
      <div className="dashboard-stat-grid">
        {overviewCards.map((card) => {
          const Icon = card.icon
          return (
            <div className="dashboard-stat-card" key={card.label}>
              <div>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.detail}</small>
              </div>
              <div className={`dashboard-stat-icon dashboard-stat-${card.tone}`}>
                <Icon size={20} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="dashboard-section-label">Attendance Breakdown</div>
      <div className="dashboard-stat-grid">
        {breakdownCards.map((card) => {
          const Icon = card.icon
          return (
            <div className="dashboard-stat-card" key={card.label}>
              <div>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
              <div className={`dashboard-stat-icon dashboard-stat-${card.tone}`}>
                <Icon size={20} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="dashboard-section-label">Insights</div>
      <div className="dashboard-insights-grid">
        <section className="dashboard-panel dashboard-chart-panel">
          <div className="dashboard-panel-header">
            <div className="dashboard-panel-title-row">
              <div className="dashboard-panel-icon dashboard-stat-blue">
                <PieChart size={18} />
              </div>
              <div>
                <h2>Attendance Overview</h2>
                <p>Staff, Malaysian visitors, Non-Malaysian visitors</p>
              </div>
            </div>
            <span className="dashboard-total-pill">Total: {totalAttendance}</span>
          </div>
          <div className="dashboard-donut-wrap">
            <AttendanceDonutChart segments={chartSegments} total={totalAttendance} />
            <div className="dashboard-chart-legend">
              <span><i className="legend-dot legend-staff" /> Staff <strong>{staffAttendance}</strong></span>
              <span><i className="legend-dot legend-visitor" /> Malaysian <strong>{visitorAttendance}</strong></span>
              <span><i className="legend-dot legend-passport" /> Non-Malaysian <strong>{passportAttendance}</strong></span>
            </div>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="dashboard-panel-title-row">
              <div className="dashboard-panel-icon dashboard-stat-purple">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2>Access Summary</h2>
                <p>Your permissions</p>
              </div>
            </div>
          </div>
          <div className="access-summary-list">
            <div className="access-summary-item">
              <Users size={15} />
              <div>
                <strong>Your Role</strong>
                <span className="role-chip">{role}</span>
              </div>
            </div>
            <div className="access-summary-item">
              <LayoutDashboard size={15} />
              <div>
                <strong>Dashboard Access</strong>
                <p>All logged-in staff can view dashboard information.</p>
              </div>
            </div>
            <div className="access-summary-item">
              <KeyRound size={15} />
              <div>
                <strong>Management Access</strong>
                <p>{canManage ? 'Full access - staff, events, attendance, analytics export, create, update & delete.' : 'View-only access for dashboard and assigned records.'}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="dashboard-section-label">Activity & Events</div>
      <div className="dashboard-activity-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="dashboard-panel-title-row">
              <div className="dashboard-panel-icon dashboard-stat-green">
                <Clock3 size={18} />
              </div>
              <div>
                <h2>Recent Activity</h2>
                <p>Latest attendance records</p>
              </div>
            </div>
            <div className="dashboard-panel-tools">
              <input type="date" value={recentDate} onChange={(event) => setRecentDate(event.target.value)} aria-label="Filter recent activity by date" />
              {recentDate && <button type="button" className="dashboard-clear-filter" onClick={() => setRecentDate('')}>Reset</button>}
              <MiniPagination
                page={recentPagination.page}
                totalPages={recentPagination.totalPages}
                start={recentPagination.start}
                end={recentPagination.end}
                total={filteredRecentActivities.length}
                onPrevious={() => setRecentPage((current) => Math.max(1, current - 1))}
                onNext={() => setRecentPage((current) => Math.min(recentPagination.totalPages, current + 1))}
              />
            </div>
          </div>
          <div className="activity-list">
            {filteredRecentActivities.length === 0 ? (
              <div className="dashboard-empty">No recent attendance records.</div>
            ) : (
              recentPagination.items.map((item, index) => (
                <div className="activity-row" key={`${item.type}-${item.name}-${index}`}>
                  <span className="activity-avatar">{initials(item.name)}</span>
                  <div className="activity-main">
                    <strong>{item.name}</strong>
                    <span className={`activity-badge ${item.type === 'Staff' ? 'activity-staff' : item.type?.includes('Non-Malaysian') ? 'activity-passport' : 'activity-visitor'}`}>
                      {activityBadge(item.type)}
                    </span>
                    <p>{item.event_name}</p>
                  </div>
                  <div className="activity-time">
                    <span>{formatDisplayDate(item.date)}</span>
                    <span>{item.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="dashboard-panel-title-row">
              <div className="dashboard-panel-icon dashboard-stat-pink">
                <CalendarDays size={18} />
              </div>
              <div>
                <h2>Ongoing & Upcoming Events</h2>
                <p>Day-to-day operations</p>
              </div>
            </div>
            <MiniPagination
              page={eventPagination.page}
              totalPages={eventPagination.totalPages}
              start={eventPagination.start}
              end={eventPagination.end}
              total={eventSummaryItems.length}
              onPrevious={() => setEventPage((current) => Math.max(1, current - 1))}
              onNext={() => setEventPage((current) => Math.min(eventPagination.totalPages, current + 1))}
            />
          </div>
          <div className="event-summary-list">
            {eventSummaryItems.length === 0 ? (
              <div className="dashboard-empty dashboard-empty-dashed">No ongoing or upcoming events.</div>
            ) : (
              eventPagination.items.map((event) => (
                <Link to={`/events/${event.id}`} className="event-summary-card" key={`${event.statusLabel}-${event.id}`}>
                  <strong>{event.name}</strong>
                  <p>{event.location || '-'}</p>
                  <span>{formatEventDateRange(event.start_date, event.end_date)}</span>
                  <em className={event.statusLabel === 'Ongoing' ? 'event-status-ongoing' : ''}>{event.statusLabel}</em>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
