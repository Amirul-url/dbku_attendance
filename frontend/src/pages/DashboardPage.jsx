import { CalendarDays, ClipboardCheck, IdCard, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'

export function DashboardPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest('/reports/dashboard/').then(setData).catch((err) => setError(err.message))
  }, [])

  const cards = [
    { label: 'Staff', value: data?.total_staff ?? 0, icon: Users },
    { label: 'Events', value: data?.total_events ?? 0, icon: CalendarDays },
    { label: 'Passport Visitors', value: data?.total_passport_visitors ?? 0, icon: IdCard },
    {
      label: 'Total Attendance',
      value: (data?.total_staff_attendance ?? 0) + (data?.total_visitor_attendance ?? 0) + (data?.total_passport_attendance ?? 0),
      icon: ClipboardCheck,
    },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <div className="page-sub">Overview of staff, events, and attendance activity.</div>
        </div>
      </div>
      {error && <div className="alert-error">{error}</div>}
      <div className="stat-grid">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div className="stat-card" key={card.label}>
              <Icon size={20} />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          )
        })}
      </div>
      <div className="detail-grid">
        <section className="table-card">
          <div className="table-card-header">
            <div>
              <div className="table-card-title">Active Events</div>
              <div className="table-card-sub">{data?.active_events ?? 0} active today</div>
            </div>
          </div>
          <DataTable
            rows={data?.active_events_list || []}
            columns={[
              { key: 'name', label: 'Event', render: (row) => <Link to={`/events/${row.id}`}>{row.name}</Link> },
              { key: 'location', label: 'Location' },
              { key: 'start_date', label: 'Start' },
              { key: 'end_date', label: 'End' },
            ]}
          />
        </section>
        <section className="table-card">
          <div className="table-card-header">
            <div>
              <div className="table-card-title">Recent Activity</div>
              <div className="table-card-sub">Latest attendance submissions</div>
            </div>
          </div>
          <DataTable
            rows={(data?.recent_activities || []).map((item, index) => ({ ...item, id: `${item.type}-${index}` }))}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'type', label: 'Type' },
              { key: 'event_name', label: 'Event' },
              { key: 'date', label: 'Date' },
              { key: 'time', label: 'Time' },
            ]}
          />
        </section>
      </div>
    </>
  )
}
