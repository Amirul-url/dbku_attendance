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
import { useEffect, useState } from 'react'
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

export function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

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
  const chartTotal = totalAttendance || 1
  const staffAngle = (staffAttendance / chartTotal) * 360
  const visitorAngle = staffAngle + (visitorAttendance / chartTotal) * 360

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
      featured: true,
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
            <div className={`dashboard-stat-card ${card.featured ? 'dashboard-stat-featured' : ''}`} key={card.label}>
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
            <div
              className="dashboard-donut"
              style={{
                '--staff-angle': `${staffAngle}deg`,
                '--visitor-angle': `${visitorAngle}deg`,
              }}
              aria-label="Attendance overview chart"
            />
            <div className="dashboard-chart-legend">
              <span><i className="legend-dot legend-staff" /> Staff</span>
              <span><i className="legend-dot legend-visitor" /> Malaysian</span>
              <span><i className="legend-dot legend-passport" /> Non-Malaysian</span>
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
          </div>
          <div className="activity-list">
            {(data?.recent_activities || []).length === 0 ? (
              <div className="dashboard-empty">No recent attendance records.</div>
            ) : (
              data.recent_activities.map((item, index) => (
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
          </div>
          <div className="event-summary-list">
            <span className="event-summary-heading">Ongoing</span>
            {(data?.active_events_list || []).length === 0 ? (
              <div className="dashboard-empty dashboard-empty-dashed">No active events today.</div>
            ) : (
              data.active_events_list.map((event) => (
                <Link to={`/events/${event.id}`} className="event-summary-card" key={`active-${event.id}`}>
                  <strong>{event.name}</strong>
                  <p>{event.location || '-'}</p>
                  <span>{formatEventDateRange(event.start_date, event.end_date)}</span>
                  <em>Ongoing</em>
                </Link>
              ))
            )}
            <span className="event-summary-heading">Upcoming</span>
            {(data?.upcoming_events || []).length === 0 ? (
              <div className="dashboard-empty dashboard-empty-dashed">No upcoming events.</div>
            ) : (
              data.upcoming_events.map((event) => (
                <Link to={`/events/${event.id}`} className="event-summary-card" key={`upcoming-${event.id}`}>
                  <strong>{event.name}</strong>
                  <p>{event.location || '-'}</p>
                  <span>{formatEventDateRange(event.start_date, event.end_date)}</span>
                  <em>Upcoming</em>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
