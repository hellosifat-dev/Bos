import { format, formatDistanceToNow } from 'date-fns'

export function formatDate(date: string | Date, pattern = 'MMM d, yyyy') {
  return format(new Date(date), pattern)
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), 'MMM d, yyyy HH:mm')
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatCurrency(amount: number, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n)
}

export function truncate(str: string, max = 50) {
  return str.length > max ? str.slice(0, max) + '…' : str
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Best-effort extraction of a human-readable message from an API/axios error. */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string }
  const data = e?.response?.data
  const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined
  return first || data?.message || e?.message || fallback
}

/** Format an amount in the current business currency. */
export function money(amount: number | string | null | undefined): string {
  // Read lazily to avoid a circular import at module load.
  const raw = localStorage.getItem('bos-auth')
  let currency = 'USD'
  try { currency = JSON.parse(raw ?? '{}')?.state?.currentBusiness?.currency || 'USD' } catch { /* ignore */ }
  const n = Number(amount ?? 0)
  try { return formatCurrency(Number.isFinite(n) ? n : 0, currency) } catch { return n.toFixed(2) }
}
