import { DataTable } from '../components/DataTable.jsx'
import { useApiResource } from '../hooks/useApiResource.js'

export function AttendancePage() {
  const { rows, loading, error } = useApiResource('/staff-attendance/')

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
            { key: 'time', label: 'Time' },
          ]}
        />
      )}
    </>
  )
}
