import { useEffect, useState } from 'react'
import { apiRequest, listFromResponse } from '../api/client.js'

export function useApiResource(path) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    apiRequest(path)
      .then((data) => {
        if (active) setRows(listFromResponse(data))
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [path])

  return { rows, loading, error }
}
