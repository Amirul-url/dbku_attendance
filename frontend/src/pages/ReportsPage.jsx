import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'

export function ReportsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest('/reports/analytics/').then(setData).catch((err) => setError(err.message))
  }, [])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <div className="page-sub">Attendance summaries and event participation insights.</div>
        </div>
      </div>
      {error && <div className="alert-error">{error}</div>}
      <div className="stat-grid">
        <div className="stat-card"><span>Filtered Events</span><strong>{data?.total_filtered_events ?? 0}</strong></div>
        <div className="stat-card"><span>Staff Attendance</span><strong>{data?.total_filtered_staff ?? 0}</strong></div>
        <div className="stat-card"><span>Visitor Attendance</span><strong>{data?.total_filtered_visitors ?? 0}</strong></div>
        <div className="stat-card"><span>Passport Attendance</span><strong>{data?.total_filtered_passport ?? 0}</strong></div>
      </div>
      <div className="detail-grid">
        <section className="table-card">
          <div className="table-card-header">
            <div>
              <div className="table-card-title">Top Events</div>
              <div className="table-card-sub">Ranked by total attendance</div>
            </div>
          </div>
          <DataTable rows={data?.top_events || []} columns={[
            { key: 'event_name', label: 'Event' },
            { key: 'staff_total', label: 'Staff' },
            { key: 'visitor_total', label: 'Visitors' },
            { key: 'passport_total', label: 'Passport' },
            { key: 'grand_total', label: 'Total' },
          ]} />
        </section>
        <section className="table-card">
          <div className="table-card-header">
            <div>
              <div className="table-card-title">Monthly Attendance</div>
              <div className="table-card-sub">Totals by event month</div>
            </div>
          </div>
          <DataTable rows={(data?.monthly || []).map((item) => ({ ...item, id: item.label }))} columns={[
            { key: 'label', label: 'Month' },
            { key: 'value', label: 'Total' },
          ]} />
        </section>
      </div>
      <section className="table-card">
        <div className="table-card-header">
          <div>
            <div className="table-card-title">All Event Analytics</div>
            <div className="table-card-sub">Per-event category totals</div>
          </div>
        </div>
        <DataTable rows={data?.events || []} columns={[
          { key: 'event_name', label: 'Event' },
          { key: 'staff_total', label: 'Staff' },
          { key: 'visitor_total', label: 'Visitors' },
          { key: 'passport_total', label: 'Passport' },
          { key: 'grand_total', label: 'Total' },
        ]} />
      </section>
    </>
  )
}
