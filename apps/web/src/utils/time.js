export function getCountdownParts(expiresAt, now = Date.now()) {
  if (!expiresAt) return null

  const totalMs = new Date(expiresAt).getTime() - now
  if (totalMs <= 0) {
    return {
      expired: true,
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      text: 'Expired',
    }
  }

  const totalSeconds = Math.floor(totalMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    expired: false,
    totalMs,
    days,
    hours,
    minutes,
    seconds,
    text: [
      days ? `${days}d` : null,
      hours || days ? `${hours}h` : null,
      minutes ? `${minutes}m` : null,
      `${seconds}s`,
    ].filter(Boolean).join(' '),
  }
}

export function formatCountdown(expiresAt, now = Date.now()) {
  const parts = getCountdownParts(expiresAt, now)
  if (!parts) return 'Not scheduled'
  if (parts.expired) return 'Expired'
  return parts.text
}
