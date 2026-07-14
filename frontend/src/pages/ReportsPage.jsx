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

function pluralText(value, singular, plural = `${singular}s`) {
  return `${numberText(value)} ${Number(value) === 1 ? singular : plural}`
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
          <button
            type="button"
            className={`analytics-trend-item ${isSelected ? 'is-selected' : ''}`}
            key={item.label}
            onClick={() => onSelectMonth(item.label)}
          >
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

function describePieSlice(cx, cy, radius, startAngle, endAngle) {
  const startRadians = ((startAngle - 90) * Math.PI) / 180
  const endRadians = ((endAngle - 90) * Math.PI) / 180
  const startX = cx + radius * Math.cos(startRadians)
  const startY = cy + radius * Math.sin(startRadians)
  const endX = cx + radius * Math.cos(endRadians)
  const endY = cy + radius * Math.sin(endRadians)
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`
}

function AnalyticsPie({ items, total, size = 'default', ariaLabel = 'Analytics pie chart' }) {
  const [tooltip, setTooltip] = useState(null)
  const radius = 90
  const center = 110
  const hasData = total > 0
  let cursor = 0

  function showTooltip(event, item, color) {
    const wrapper = event.currentTarget.ownerSVGElement.parentElement
    const bounds = wrapper.getBoundingClientRect()
    const clientX = event.clientX || bounds.left + bounds.width / 2
    const clientY = event.clientY || bounds.top + bounds.height / 2
    setTooltip({
      label: item.label,
      value: Number(item.value) || 0,
      color,
      x: clientX - bounds.left + 12,
      y: clientY - bounds.top + 12,
    })
  }

  return (
    <div className={`analytics-svg-pie ${size === 'large' ? 'analytics-svg-pie-large' : ''}`} onMouseLeave={() => setTooltip(null)}>
      <svg className="analytics-svg-pie-chart" viewBox="0 0 220 220" role="img" aria-label={ariaLabel}>
        {!hasData && <circle className="analytics-svg-pie-empty" cx={center} cy={center} r={radius} />}
        {hasData ? items.map((item, index) => {
          const value = Number(item.value) || 0
          if (!value) return null
          const color = pieColor(index)
          if (value === total) {
            return (
              <circle
                key={item.id || item.label}
                className="analytics-svg-pie-segment"
                cx={center}
                cy={center}
                r={radius}
                fill={color}
                onMouseEnter={(event) => showTooltip(event, item, color)}
                onMouseMove={(event) => showTooltip(event, item, color)}
                onFocus={(event) => showTooltip(event, item, color)}
                onBlur={() => setTooltip(null)}
                tabIndex={0}
              >
                <title>{item.label}: {numberText(value)}</title>
              </circle>
            )
          }
          const startAngle = cursor
          const endAngle = cursor + (value / total) * 360
          cursor = endAngle
          return (
            <path
              key={item.id || item.label}
              className="analytics-svg-pie-segment"
              d={describePieSlice(center, center, radius, startAngle, endAngle)}
              fill={color}
              onMouseEnter={(event) => showTooltip(event, item, color)}
              onMouseMove={(event) => showTooltip(event, item, color)}
              onFocus={(event) => showTooltip(event, item, color)}
              onBlur={() => setTooltip(null)}
              tabIndex={0}
            >
              <title>{item.label}: {numberText(value)}</title>
            </path>
          )
        }) : null}
      </svg>
      {tooltip && (
        <div className="analytics-pie-tooltip" style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}>
          <span>{tooltip.label}</span>
          <em><i style={{ background: tooltip.color }} /> {numberText(tooltip.value)}</em>
        </div>
      )}
    </div>
  )
}

function CategoryShareChart({ rows, total }) {
  return (
    <div className="analytics-audience-donut">
      <AnalyticsPie items={rows} total={total} size="large" ariaLabel="Audience mix chart" />
      <div className="analytics-pie-legend analytics-audience-legend">
        {rows.map((item, index) => (
          <div key={item.label}>
            <i style={{ background: pieColor(index) }} />
            <span>{item.label}</span>
            <strong>{numberText(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

const pieColors = [
  '#a6a6a6',
  '#4775c4',
  '#f47c27',
  '#6f4bb8',
  '#0b8f6a',
  '#d34b4b',
  '#2f8cc9',
  '#bf8b2e',
  '#6d8f33',
  '#c94b9b',
  '#0b5c66',
  '#9b6a3c',
  '#6173d9',
  '#db6f45',
  '#4f9f45',
  '#8a5aa8',
  '#268a9c',
  '#b65b72',
  '#756f2f',
  '#516d7f',
  '#c26f1a',
  '#5e8d73',
  '#a64f4f',
  '#3f6fb5',
]

function pieColor(index) {
  return pieColors[index] || `hsl(${(index * 47) % 360} 58% 48%)`
}

function PieSummaryCard({ title, subtitle, icon: Icon, items }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const visibleItems = items.slice(0, 5)
  const hiddenCount = Math.max(0, items.length - visibleItems.length)
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
        <span className="analytics-pill">Total: {numberText(total)}</span>
      </div>
      <div className="analytics-pie-card-body">
        {items.length === 0 ? (
          <div className="analytics-empty">No data available.</div>
        ) : (
          <>
            <AnalyticsPie items={items} total={total} ariaLabel={`${title} chart`} />
            <div className="analytics-pie-legend">
              {visibleItems.map((item, index) => (
                <div key={item.id}>
                  <i style={{ background: pieColor(index) }} />
                  <span title={item.label}>{item.label}</span>
                  <strong>{numberText(item.value)}</strong>
                </div>
              ))}
              {hiddenCount > 0 && <em>+{numberText(hiddenCount)} more categories</em>}
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
          <div className="page-sub">Attendance totals, monthly trends, and category breakdowns for filtered events.</div>
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
        <span>{isLoading ? 'Loading analytics...' : `${pluralText(data?.total_filtered_events ?? 0, 'event')} included in this report`}</span>
        <em>{activeFilterCount ? `${activeFilterCount} active filter(s)` : 'All data'}</em>
      </div>

      <div className="analytics-kpi-grid">
        <AnalyticsKpiCard label="Filtered Events" value={data?.total_filtered_events ?? 0} detail="Included in this report" icon={CalendarDays} tone="blue" />
        <AnalyticsKpiCard label="Staff Check-ins" value={data?.total_filtered_staff ?? 0} icon={ShieldCheck} tone="green" />
        <AnalyticsKpiCard label="Malaysian Visitor Check-ins" value={data?.total_filtered_visitors ?? 0} icon={Contact} tone="cyan" />
        <AnalyticsKpiCard label="Non-Malaysian Visitor Check-ins" value={data?.total_filtered_passport ?? 0} icon={IdCard} tone="purple" />
      </div>

      <div className="analytics-main-grid">
        <section className="analytics-card analytics-trend-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title">
              <div className="analytics-card-icon"><BarChart3 size={17} /></div>
              <div>
                <h2>Attendance Trend</h2>
                <p>Monthly check-ins across filtered events</p>
              </div>
            </div>
            <span className="analytics-pill">{selectedMonth ? `${selectedMonth} selected` : '12 months'}</span>
          </div>
          <MonthlyTrend
            rows={monthlyRows}
            selectedMonth={selectedMonth}
            onSelectMonth={(month) => setSelectedMonth((current) => (current === month ? '' : month))}
          />
        </section>

        <section className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-title">
              <div className="analytics-card-icon"><PieChart size={17} /></div>
              <div>
                <h2>Attendance Category Breakdown</h2>
                <p>{selectedMonth ? `${selectedMonth} attendee-type breakdown` : 'Check-ins by attendee type'}</p>
              </div>
            </div>
            <span className="analytics-pill">{numberText(audienceTotals.total)} total</span>
          </div>
          <CategoryShareChart rows={categoryRows} total={audienceTotals.total} />
        </section>
      </div>

      <div className="analytics-insight-grid">
        <PieSummaryCard title="Top Departments" subtitle="Staff check-ins by department" icon={Users} items={topDepartments} />
        <PieSummaryCard title="Top Organizations" subtitle="Malaysian visitor check-ins by organization" icon={Building2} items={topOrganizations} />
        <PieSummaryCard title="Top Countries" subtitle="Non-Malaysian visitor check-ins by country" icon={Globe2} items={topCountries} />
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
