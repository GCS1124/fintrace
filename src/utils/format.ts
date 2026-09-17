import { DISPLAY_TIMEZONE } from '../config/detector'

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: DISPLAY_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: DISPLAY_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export function formatTimestamp(timestampMs: number): string {
  return dateTimeFormatter.format(timestampMs).replace(',', '') + ' IST'
}

export function formatTime(timestampMs: number): string {
  return `${timeFormatter.format(timestampMs)} IST`
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return 'In-memory'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatCount(count: number): string {
  return new Intl.NumberFormat('en-IN').format(count)
}

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
