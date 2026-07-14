import {
  BarChart3,
  Building2,
  CalendarDays,
  Contact,
  Filter,
  Globe2,
  IdCard,
  MapPin,
  PieChart,
  RotateCcw,
  Search,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api/client.js'
import { DataTable } from '../components/DataTable.jsx'

const monthOptions = [
  { value: '', label: 'All Months' },
  { value: '1', label: 'Jan' },
  { value: '2', label: 'Feb' },
  { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' },
  { value: '5', label: 'May' },
  { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' },
  { value: '8', label: 'Aug' },
  { value: '9', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
]

function yearOptions() {
  const currentYear = new Date().getFullYear()
  return ['', ...Array.from({ length: 7 }, (_, index) => String(currentYear - 3 + index))]
}

function numberText(value) {
  return new Intl.NumberFormat('en-MY').format(Number(value) || 0)
}

function percentage(value, total) {
  if (!total) return '0%'
  return `${Math.round((Number(value || 0) / total) * 100)}%`
}

function normalizeTopList(items) {
  return (items || []).map((item, index) => ({
    id: `${item[0] || 'unknown'}-${index}`,
    label: item[0] || 'Unspecified',
    value: Number(item[1]) || 0,
  }))
}

function AnalyticsKpiCard({ label, value, detail, icon: Icon, tone }) {
  return (
    <div className={`analytics-kpi-card analytics-kpi-${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{numberText(value)}</strong>
        <small>{detail}</small>
      </div>
      <div className="analytics-kpi-icon">
        <Icon size={21} />
      </div>
    </div>
  )
}

function MonthlyTrend({ rows }) {
  const maxValue = Math.max(1, ...rows.map((item) => Number(item.value) || 0))
  return (
    <div className="analytics-trend-chart" role="img" aria-label="Monthly attendance trend">
      {rows.map((item) => {
        const value = Number(item.value) || 0
        const height = Math.max(4, (value / maxValue) * 100)
        return (
          <div className="analytics-trend-item" key={item.label}>
            <div className="analytics-trend-bar-wrap">
              <div className="analytics-trend-bar" style={{ height: `${height}%` }} title={`${item.label}: ${value}`} />
            </div>
            <span>{item.label}</span>
            <strong>{value}</strong>
          </div>
        )
      })}
    </div>
  )
}

function CategoryShareChart({ rows, total }) {
  return (
    <div className="analytics-share-list">
      {rows.map((item) => (
        <div className="analytics-share-row" key={item.label}>
          <div>
            <span className={`analytics-share-dot analytics-share-${item.tone}`} />
            <strong>{item.label}</strong>
          </div>
          <div className="analytics-share-meter">
            <span style={{ width: percentage(item.value, total) }} />
          </div>
          <em>{numberText(item.value)} ({percentage(item.value, total)})</em>
        </div>
      ))}
    </div>
  )
}

function TopList({ title, subtitle, icon: Icon, items }) {
  const maxValue = Math.max(1, ...items.map((item) => item.value))
  return (
    <section className="analytics-card">
      <div className="analytics-card-header compact">
        <div className="analytics-card-title">
          <div className="analytics-card-icon">
            <Icon size={17} />
          </div>
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="analytics-ranked-list">
        {items.length === 0 ? (
          <div className="analytics-empty">No data available.</div>
        ) : items.map((item, index) => (
          <div className="analytics-ranked-row" key={item.id}>
            <span>{index + 1}</span>
            <div>
              <strong>{item.label}</strong>
              <div className="analytics-ranked-meter">
                <i style={{ width: `${Math.max(6, (item.value / maxValue) * 100)}%` }} />
              </div>
            </div>
            <em>{numberText(item.value)}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

export function ReportsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({ name: '', location: '', month: '', year: '' })
  const [appliedFilters, setAppliedFilters] = useState({ name: '', location: '', month: '', year: '' })

  async function loadAnalytics(nextFilters = filters) {
    setIsLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) params.set(key, value)
      })
      const query = params.toString()
      setData(await apiRequest(`/reports/analytics/${query ? `?${query}` : ''}`))
      setAppliedFilters(nextFilters)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [])

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function applyFilters(event) {
    event.preventDefault()
    loadAnalytics(filters)
  }

  function resetFilters() {
    const emptyFilters = { name: '', location: '', month: '', year: '' }
    setFilters(emptyFilters)
    loadAnalytics(emptyFilters)
  }

  const totalAttendance = (data?.total_filtered_staff ?? 0) + (data?.total_filtered_visitors ?? 0) + (data?.total_filtered_passport ?? 0)
  const categoryRows = [
    { label: 'Staff', value: data?.total_filtered_staff ?? 0, tone: 'staff' },
    { label: 'Malaysian Visitors', value: data?.total_filtered_visitors ?? 0, tone: 'visitor' },
    { label: 'Non-Malaysian Visitors', value: data?.total_filtered_passport ?? 0, tone: 'passport' },
  ]
  const monthlyRows = data?.monthly || []
  const topDepartments = useMemo(() => normalizeTopList(data?.top_departments), [data?.top_departments])
  const topOrganizations = useMemo(() => normalizeTopList(data?.top_organizations), [data?.top_organizations])
  const topCountries = useMemo(() => normalizeTopList(data?.top_countries), [data?.top_countries])
  const topEvents = useMemo(() => (data?.top_events || []).map((item) => ({ ...item, id: item.event_id })), [data?.top_events])
  const allEvents = useMemo(() => (data?.events || []).map((item) => ({ ...item, id: item.event_id })), [data?.events])
  const bestEvent = topEvents[0]
  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length

  return (
    <div className="analytics-page">
      <div className="page-header analytics-page-header">
        <div>
          <h1>Analytics</h1>
          <div className="page-sub">Attendance performance, visitor mix, and event participation insights.</div>
        </div>
        <div className="analytics-header-summary">
          <span>Total Attendance</span>
          <strong>{numberText(totalAttendance)}</strong>
          <small>{numberText(data?.total_filtered_events ?? 0)} filtered events</small>
        </div>
      </div>

      <form className="analytics-filter-card" onSubmit={applyFilters}>
        <label>
          <span>Event</span>
          <div><Search size={16} /><input value={filters.name} onChange={(event) => updateFilter('name', event.target.value)} placeholder="Search event name" /></div>
        </label>
        <label>
          <span>Location</span>
          <div><MapPin size={16} /><input value={filters.location} onChange={(event) => updateFilter('location', event.target.value)} placeholder="Search location" /></div>
        </label>
        <label>
          <span>Month</span>
          <div><CalendarDays size={16} /><select value={filters.month} onChange={(event) => updateFilter('month', event.target.value)}>{monthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        </label>
        <label>
          <span>Year</span>
          <div><CalendarDays size={16} /><select value={filters.year} onChange={(event) => updateFilter('year', event.target.value)}>{yearOptions().map((year) => <option key={year || 'all'} value={year}>{year || 'All Years'}</option>)}</select></div>
        </label>
        <button type="submit" className="btn btn-ocean"><Filter size={16} /> Apply</button>
        <button type="button" className="btn btn-ghost" onClick={resetFilters}><RotateCcw size={16} /> Reset</button>
      </form>

      {error && <div className="alert-error">{error}</div>}

      <div className="analytics-status-row">
        <span>{isLoading ? 'Loading analytics...' : `Showing ${numberText(data?.total_filtered_events ?? 0)} event(s)`}</span>
        <em>{activeFilterCount ? `${activeFilterCount} active filter(s)` : 'All data'}</em>
      </div>

      <div className="analytics-kpi-grid">
        <AnalyticsKpiCard label="Events" value={data?.total_filtered_events ?? 0} detail="Matched by current filters" icon={CalendarDays} tone="blue" />
        <AnalyticsKpiCard label="Staff Attendance" value={data?.total_filtered_staff ?? 0} detail={`${percentage(data?.total_filtered_staff, totalAttendance)} of total`} icon={ShieldCheck} tone="green" />
        <AnalyticsKpiCard label="Malaysian Visitors" value={data?.total_filtered_visitors ?? 0} detail={`${percentage(data?.total_filtered_visitors, totalAttendance)} of total`} icon={Contact} tone="cyan" />
        <AnalyticsKpiCard label="Non-Malaysian Visitors" value={data?.total_filtered_passport ?? 0} detail={`${percentage(data?.total_filtered_passport, totalAttendance)} of total`} icon={IdCard} tone="purple" />
      </div>

      <div className="analytics-main-grid">
        <section className="analytics-card analytics-trend-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title">
              <div className="analytics-card-icon"><BarChart3 size={17} /></div>
              <div>
                <h2>Attendance Trend</h2>
                <p>Monthly attendance volume across filtered events</p>
              </div>
            </div>
            <span className="analytics-pill">12 months</span>
          </div>
          <MonthlyTrend rows={monthlyRows} />
        </section>

        <section className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title">
              <div className="analytics-card-icon"><PieChart size={17} /></div>
              <div>
                <h2>Audience Mix</h2>
                <p>Staff, Malaysian visitors, and Non-Malaysian visitors</p>
              </div>
            </div>
            <span className="analytics-pill">{numberText(totalAttendance)} total</span>
          </div>
          <CategoryShareChart rows={categoryRows} total={totalAttendance} />
        </section>
      </div>

      <div className="analytics-insight-grid">
        <section className="analytics-card analytics-highlight-card">
          <div className="analytics-card-title">
            <div className="analytics-card-icon"><Trophy size={17} /></div>
            <div>
              <h2>Top Performing Event</h2>
              <p>Highest attendance in current filter</p>
            </div>
          </div>
          {bestEvent ? (
            <div className="analytics-highlight-body">
              <strong>{bestEvent.event_name}</strong>
              <span>{numberText(bestEvent.grand_total)}</span>
              <p>Total attendance</p>
              <div>
                <em>Staff {numberText(bestEvent.staff_total)}</em>
                <em>Malaysian {numberText(bestEvent.visitor_total)}</em>
                <em>Non-Malaysian {numberText(bestEvent.passport_total)}</em>
              </div>
            </div>
          ) : <div className="analytics-empty">No event data available.</div>}
        </section>
        <TopList title="Top Departments" subtitle="Staff attendance concentration" icon={Users} items={topDepartments} />
        <TopList title="Top Organizations" subtitle="Malaysian visitor organization mix" icon={Building2} items={topOrganizations} />
        <TopList title="Top Countries" subtitle="Non-Malaysian visitor origin" icon={Globe2} items={topCountries} />
      </div>

      <section className="table-card analytics-table-card">
        <div className="table-card-header">
          <div>
            <div className="table-card-title">Top Events</div>
            <div className="table-card-sub">Ranked by total attendance</div>
          </div>
        </div>
        <DataTable rows={topEvents} columns={[
          { key: 'event_name', label: 'Event' },
          { key: 'staff_total', label: 'Staff' },
          { key: 'visitor_total', label: 'Malaysian Visitors' },
          { key: 'passport_total', label: 'Non-Malaysian Visitors' },
          { key: 'grand_total', label: 'Total' },
        ]} />
      </section>

      <section className="table-card analytics-table-card">
        <div className="table-card-header">
          <div>
            <div className="table-card-title">Event Drill-Down</div>
            <div className="table-card-sub">Per-event category totals for current filters</div>
          </div>
        </div>
        <DataTable rows={allEvents} columns={[
          { key: 'event_name', label: 'Event' },
          { key: 'staff_total', label: 'Staff' },
          { key: 'visitor_total', label: 'Malaysian Visitors' },
          { key: 'passport_total', label: 'Non-Malaysian Visitors' },
          { key: 'grand_total', label: 'Total' },
        ]} />
      </section>
    </div>
  )
}
