export function formatTime12Hour(value) {
  if (!value) return '-'

  const match = String(value).match(/^(\d{1,2}):(\d{2})/)
  if (!match) return value

  const hour = Number(match[1])
  const minute = match[2]
  if (!Number.isFinite(hour)) return value

  const period = hour >= 12 ? 'p.m.' : 'a.m.'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${period}`
}

export function formatDateTime12Hour(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${day}/${month}/${year}, ${formatTime12Hour(`${hour}:${minute}`)}`
}
