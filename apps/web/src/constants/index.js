// Shared constants for PrivacyPrint

export const RETENTION_OPTIONS = [
  { value: 10, label: '10 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 1440, label: '1 day' },
  { value: 4320, label: '3 days' },
]

export const DEMO_RETENTION_MULTIPLIER = 1 / 60 // 10 min → 10 sec in demo mode
