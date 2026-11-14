import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { Spinner } from './Spinner'

// --- Column definition -------------------------------------------------
export interface Column<T> {
  key:        string
  header:     string
  cell?:      (row: T) => ReactNode
  sortable?:  boolean
  align?:     'left' | 'center' | 'right'
  className?: string
}

interface TableProps<T> {
  columns:      Column<T>[]
  data:         T[]
  keyExtractor: (row: T) => string | number
  loading?:     boolean
  emptyMessage?: string
  sortKey?:     string
  sortDir?:     'asc' | 'desc'
  onSort?:      (key: string) => void
  onRowClick?:  (row: T) => void
  className?:   string
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  loading,
  emptyMessage = 'No data found.',
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  className,
}: TableProps<T>) {
  return (
    <div className={clsx('overflow-hidden rounded-xl border border-gray-200', className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={clsx(
                    'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500',
                    col.align === 'center' && 'text-center',
                    col.align === 'right'  && 'text-right',
                    !col.align             && 'text-left',
                    col.sortable && onSort  && 'cursor-pointer select-none hover:text-gray-700',
                    col.className
                  )}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && onSort && (
                      <span className="flex flex-col">
                        <ChevronUp   className={clsx('h-3 w-3', sortKey === col.key && sortDir === 'asc'  ? 'text-primary-600' : 'text-gray-300')} />
                        <ChevronDown className={clsx('h-3 w-3 -mt-1', sortKey === col.key && sortDir === 'desc' ? 'text-primary-600' : 'text-gray-300')} />
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  <Spinner size="md" className="mx-auto" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-sm text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick?.(row)}
                  className={clsx(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-gray-50'
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        'px-4 py-3 text-sm text-gray-700',
                        col.align === 'center' && 'text-center',
                        col.align === 'right'  && 'text-right',
                        col.className
                      )}
                    >
                      {col.cell
                        ? col.cell(row)
                        : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Pagination --------------------------------------------------------
interface PaginationProps {
  page:       number
  total:      number
  perPage:    number
  onChange:   (page: number) => void
}

export function Pagination({ page, total, perPage, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null

  const from = (page - 1) * perPage + 1
  const to   = Math.min(page * perPage, total)

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium">{from}</span>–<span className="font-medium">{to}</span> of{' '}
        <span className="font-medium">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="rounded-lg px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={clsx(
                'h-8 w-8 rounded-lg text-sm font-medium',
                p === page
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="rounded-lg px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  )
}
