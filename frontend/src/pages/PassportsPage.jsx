import { DataTable } from '../components/DataTable.jsx'
import { useApiResource } from '../hooks/useApiResource.js'

export function PassportsPage() {
  const { rows, loading, error } = useApiResource('/passport-visitors/')

  return (
    <>
      <div className="page-header">
        <h1>Passports</h1>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {loading ? (
        <div className="panel">Loading</div>
      ) : (
        <DataTable
          rows={rows}
          columns={[
            { key: 'full_name', label: 'Name' },
            { key: 'passport_number', label: 'Passport No.' },
            { key: 'country', label: 'Country' },
            { key: 'expiry_date', label: 'Expiry' },
            { key: 'status', label: 'Status' },
          ]}
        />
      )}
    </>
  )
}
