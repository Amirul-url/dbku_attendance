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

function numberText(value) {
  return new Intl.NumberFormat('en-MY').format(Number(value) || 0)
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
        {detail && <small>{detail}</small>}
      </div>
      <div className="analytics-kpi-icon">
        <Icon size={21} />
      </div>
    </div>
  )
}

function MonthlyTrend({ rows, selectedMonth, onSelectMonth }) {
  const maxValue = Math.max(1, ...rows.map((item) => Number(item.value) || 0))
  return (
    <div className="analytics-trend-chart" role="img" aria-label="Monthly attendance trend">
      {rows.map((item) => {
        const value = Number(item.value) || 0
        const height = Math.max(4, (value / maxValue) * 100)
        const isSelected = item.label === selectedMonth
        return (
          <button type="button" className={`analytics-trend-item ${isSelected ? 'is-selected' : ''}`} key={item.label} onClick={() => onSelectMonth(item.label)}>
            <div className="analytics-trend-bar-wrap">
              <div className="analytics-trend-bar" style={{ height: `${height}%` }} title={`${item.label}: ${value}`} />
            </div>
            <span>{item.label}</span>
            <strong>{value}</strong>
          </button>
        )
      })}
    </div>
  )
}

function CategoryShareChart({ rows, total }) {
  return (
    <div className="analytics-audience-donut">
      <div className="analytics-pie-chart analytics-pie-chart-large" style={{ background: pieGradient(rows) }}>
        <span>
          <strong>{numberText(total)}</strong>
          <em>Total Attendance</em>
        </span>
      </div>
      <div className="analytics-pie-legend analytics-audience-legend">
        {rows.map((item, index) => (
          <div key={item.label}>
            <i style={{ background: pieColors[index % pieColors.length] }} />
            <span>{item.label}</span>
            <strong>{numberText(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

const pieColors = ['#004b55', '#08aeca', '#c4c4c4', '#2e7d32', '#d46b00']

function pieGradient(items) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (!total) return '#edf3f5'
  let cursor = 0
  const slices = items.map((item, index) => {
    const start = cursor
    const end = cursor + (item.value / total) * 360
    cursor = end
    return `${pieColors[index % pieColors.length]} ${start}deg ${end}deg`
  })
  return `conic-gradient(${slices.join(', ')})`
}

function PieSummaryCard({ title, subtitle, icon: Icon, items }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
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
      <div className="analytics-pie-card-body">
        {items.length === 0 ? (
          <div className="analytics-empty">No data available.</div>
        ) : (
          <>
            <div className="analytics-pie-chart" style={{ background: pieGradient(items) }}>
              <span>
                <strong>{numberText(total)}</strong>
                <em>Total Attendance</em>
              </span>
            </div>
            <div className="analytics-pie-legend">
              {items.map((item, index) => (
                <div key={item.id}>
                  <i style={{ background: pieColors[index % pieColors.length] }} />
                  <span title={item.label}>{item.label}</span>
                  <strong>{numberText(item.value)}</strong>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
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

export function ReportsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({ name: '', location: '', month: '', year: '' })
  const [appliedFilters, setAppliedFilters] = useState({ name: '', location: '', month: '', year: '' })
  const [topEventsPage, setTopEventsPage] = useState(1)
  const [selectedMonth, setSelectedMonth] = useState('')

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
      setSelectedMonth('')
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
  const selectedMonthlyBreakdown = (data?.monthly_breakdown || []).find((item) => item.label === selectedMonth)
  const audienceTotals = selectedMonthlyBreakdown
    ? {
      total: selectedMonthlyBreakdown.grand_total || 0,
      staff: selectedMonthlyBreakdown.staff_total || 0,
      visitors: selectedMonthlyBreakdown.visitor_total || 0,
      passport: selectedMonthlyBreakdown.passport_total || 0,
    }
    : {
      total: totalAttendance,
      staff: data?.total_filtered_staff ?? 0,
      visitors: data?.total_filtered_visitors ?? 0,
      passport: data?.total_filtered_passport ?? 0,
    }
  const categoryRows = [
    { label: 'Staff', value: audienceTotals.staff, tone: 'staff' },
    { label: 'Malaysian Visitors', value: audienceTotals.visitors, tone: 'visitor' },
    { label: 'Non-Malaysian Visitors', value: audienceTotals.passport, tone: 'passport' },
  ]
  const monthlyRows = data?.monthly || []
  const topDepartments = useMemo(() => normalizeTopList(data?.top_departments), [data?.top_departments])
  const topOrganizations = useMemo(() => normalizeTopList(data?.top_organizations), [data?.top_organizations])
  const topCountries = useMemo(() => normalizeTopList(data?.top_countries), [data?.top_countries])
  const topEvents = useMemo(() => (data?.top_events || []).map((item) => ({ ...item, id: item.event_id })), [data?.top_events])
  const topEventsPagination = paginateItems(topEvents, topEventsPage)
  const availableYears = data?.available_years || []
  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length

  useEffect(() => {
    setTopEventsPage(1)
  }, [topEvents.length])

  return (
    <div className="analytics-page">
      <div className="page-header analytics-page-header">
        <div>
          <h1>Analytics</h1>
          <div className="page-sub">Attendance performance, visitor mix, and event participation insights.</div>
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
          <div>
            <CalendarDays size={16} />
            <select value={filters.year} onChange={(event) => updateFilter('year', event.target.value)}>
              <option value="">All Years</option>
              {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
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
        <AnalyticsKpiCard label="Staff Attendance" value={data?.total_filtered_staff ?? 0} icon={ShieldCheck} tone="green" />
        <AnalyticsKpiCard label="Malaysian Visitors" value={data?.total_filtered_visitors ?? 0} icon={Contact} tone="cyan" />
        <AnalyticsKpiCard label="Non-Malaysian Visitors" value={data?.total_filtered_passport ?? 0} icon={IdCard} tone="purple" />
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
            <span className="analytics-pill">{selectedMonth ? `${selectedMonth} selected` : '12 months'}</span>
          </div>
          <MonthlyTrend rows={monthlyRows} selectedMonth={selectedMonth} onSelectMonth={(month) => setSelectedMonth((current) => (current === month ? '' : month))} />
        </section>

        <section className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title">
              <div className="analytics-card-icon"><PieChart size={17} /></div>
              <div>
                <h2>Audience Mix</h2>
                <p>{selectedMonth ? `${selectedMonth} category breakdown` : 'Staff, Malaysian visitors, and Non-Malaysian visitors'}</p>
              </div>
            </div>
            <span className="analytics-pill">{numberText(audienceTotals.total)} total</span>
          </div>
          <CategoryShareChart rows={categoryRows} total={audienceTotals.total} />
        </section>
      </div>

      <div className="analytics-insight-grid">
        <PieSummaryCard title="Top Departments" subtitle="Staff attendance concentration" icon={Users} items={topDepartments} />
        <PieSummaryCard title="Top Organizations" subtitle="Malaysian visitor organization mix" icon={Building2} items={topOrganizations} />
        <PieSummaryCard title="Top Countries" subtitle="Non-Malaysian visitor origin" icon={Globe2} items={topCountries} />
      </div>

      <section className="table-card analytics-table-card">
        <div className="table-card-header">
          <div>
            <div className="table-card-title">Top Events</div>
            <div className="table-card-sub">Top 5 events per page, ranked by total attendance</div>
          </div>
          <div className="table-pagination table-pagination-header">
            <span>{topEventsPagination.start}-{topEventsPagination.end} of {topEvents.length}</span>
            <div className="pagination-buttons">
              <button type="button" onClick={() => setTopEventsPage((current) => Math.max(1, current - 1))} disabled={topEventsPagination.page === 1} aria-label="Previous page">&lt;</button>
              <button type="button" onClick={() => setTopEventsPage((current) => Math.min(topEventsPagination.totalPages, current + 1))} disabled={topEventsPagination.page === topEventsPagination.totalPages} aria-label="Next page">&gt;</button>
            </div>
          </div>
        </div>
        <DataTable rows={topEventsPagination.items} columns={[
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
