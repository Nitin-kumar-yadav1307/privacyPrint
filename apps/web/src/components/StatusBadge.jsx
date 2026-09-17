const STATUS_COLORS = {
  CREATED: 'bg-gray-100 text-gray-700',
  READY: 'bg-blue-100 text-blue-700',
  PRINTING: 'bg-yellow-100 text-yellow-700',
  PRINTED: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-red-100 text-red-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-orange-100 text-orange-700',
}

const STATUS_LABELS = {
  CREATED: 'Created',
  READY: 'Ready',
  PRINTING: 'Printing',
  PRINTED: 'Printed',
  EXPIRED: 'Expired',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
}

export function StatusBadge({ status }) {
  const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'
  const label = STATUS_LABELS[status] || status

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  )
}
