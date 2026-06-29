export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export function getAccessToken() {
  return localStorage.getItem('access_token')
}

export function formatApiError(data, fallback = 'Something went wrong. Please try again.') {
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  if (data.non_field_errors?.length) return data.non_field_errors[0]

  const messages = []
  for (const [field, value] of Object.entries(data)) {
    const label = field.replaceAll('_', ' ')
    const text = Array.isArray(value) ? value[0] : value
    if (typeof text === 'string') {
      messages.push(`${label}: ${text}`)
    }
  }
  return messages[0] || fallback
}

export class ApiRequestError extends Error {
  constructor(message, data, status) {
    super(message)
    this.name = 'ApiRequestError'
    this.data = data
    this.status = status
  }
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getAccessToken()
  if (token && !options.skipAuth) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const message = formatApiError(data)
    throw new ApiRequestError(message || 'Request failed', data, response.status)
  }

  return data
}

export function listFromResponse(data) {
  return Array.isArray(data) ? data : data?.results || data?.events || []
}

export async function downloadApiFile(path) {
  const headers = new Headers()
  const token = getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { headers })
  if (!response.ok) {
    throw new Error(await response.text() || 'Download failed')
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="?([^"]+)"?/i)
  const filename = match?.[1] || 'export.csv'
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
