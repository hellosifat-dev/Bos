import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import { usePermission } from '@/hooks/usePermission'
import { getErrorMessage } from '@/utils/format'

export type FieldType = 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date'

export interface Option { value: string; label: string }

export interface Field {
  name: string
  label: string
  type?: FieldType
  options?: Option[]
  /** Load select options from an API list endpoint (fetched with ?all=1). */
  optionsFrom?: { endpoint: string; label?: (row: any) => string; filter?: (row: any) => boolean }
  required?: boolean
  createOnly?: boolean
  placeholder?: string
  step?: string
  defaultValue?: unknown
  hint?: string
  /** Grid span (1 or 2 columns). */
  span?: 1 | 2
}

export interface ResourceConfig<T> {
  title: string
  subtitle?: string
  endpoint: string
  module: string
  singular?: string
  columns: Column<T>[]
  fields: Field[]
  searchPlaceholder?: string
  /** Extra query params (e.g. filters). */
  params?: Record<string, unknown>
  toForm?: (row: T) => Record<string, unknown>
  toPayload?: (form: Record<string, unknown>, editing: T | null) => Record<string, unknown>
  headerActions?: ReactNode
  rowActions?: (row: T) => ReactNode
  canDelete?: (row: T) => boolean
  canEdit?: (row: T) => boolean
}

type Row = { id: string | number }

function useOptions(field: Field) {
  const { data } = useQuery({
    queryKey: ['options', field.optionsFrom?.endpoint],
    queryFn: () => apiClient.get(field.optionsFrom!.endpoint, { params: { all: 1 } }).then((r) => r.data.data as any[]),
    enabled: !!field.optionsFrom,
    staleTime: 60_000,
  })
  if (field.options) return field.options
  return (data ?? []).filter((r) => field.optionsFrom?.filter?.(r) ?? true).map((r) => ({ value: String(r.id), label: field.optionsFrom?.label?.(r) ?? r.name }))
}

function FieldInput({ field, value, error, onChange }: {
  field: Field; value: unknown; error?: string; onChange: (v: unknown) => void
}) {
  const options = useOptions(field)
  const type = field.type ?? 'text'
  const label = field.label + (field.required ? ' *' : '')

  if (type === 'select') {
    return (
      <Select label={label} value={(value as string) ?? ''} error={error} hint={field.hint}
              placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}…`}
              options={options} onChange={(e) => onChange(e.target.value)} />
    )
  }
  if (type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 pt-6 text-sm text-gray-700">
        <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={!!value}
               onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    )
  }
  if (type === 'textarea') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <textarea rows={3} value={(value as string) ?? ''} placeholder={field.placeholder}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500" />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    )
  }
  return (
    <Input label={label} type={type} step={field.step ?? (type === 'number' ? 'any' : undefined)}
           value={(value as string | number) ?? ''} placeholder={field.placeholder} error={error} hint={field.hint}
           onChange={(e) => onChange(e.target.value)} />
  )
}

/** Normalise empty strings to null so optional API fields validate. */
function cleanPayload(form: Record<string, unknown>, fields: Field[], editing: boolean) {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    if (editing && f.createOnly) continue
    const v = form[f.name]
    if (v === '' || v === undefined) {
      out[f.name] = f.type === 'checkbox' ? false : null
      continue
    }
    out[f.name] = f.type === 'number' ? Number(v) : v
  }
  return out
}

export function ResourceForm({ fields, initial, errors, onChange }: {
  fields: Field[]; initial: Record<string, unknown>; errors: Record<string, string>
  onChange: (form: Record<string, unknown>) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.name} className={f.span === 1 ? '' : f.type === 'textarea' ? 'sm:col-span-2' : ''}>
          <FieldInput field={f} value={initial[f.name]} error={errors[f.name]}
                      onChange={(v) => onChange({ ...initial, [f.name]: v })} />
        </div>
      ))}
    </div>
  )
}

export function ResourcePage<T extends Row>(config: ResourceConfig<T>) {
  const qc = useQueryClient()
  const { can } = usePermission()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [editing, setEditing] = useState<T | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState<T | null>(null)
  const singular = config.singular ?? config.title.replace(/s$/, '')

  useEffect(() => {
    const t = setTimeout(() => { setTerm(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: [config.endpoint, page, term, config.params],
    queryFn: () => apiClient.get(config.endpoint, {
      params: { page, per_page: 15, search: term || undefined, ...config.params },
    }).then((r) => r.data as { data: T[]; meta: { total: number; per_page: number } }),
  })

  const save = useMutation({
    mutationFn: () => {
      const base = cleanPayload(form, config.fields, !!editing)
      const payload = config.toPayload ? config.toPayload({ ...form, ...base }, editing) : base
      return editing
        ? apiClient.put(`${config.endpoint}/${editing.id}`, payload)
        : apiClient.post(config.endpoint, payload)
    },
    onSuccess: () => {
      toast.success(`${singular} ${editing ? 'updated' : 'created'}.`)
      qc.invalidateQueries({ queryKey: [config.endpoint] })
      qc.invalidateQueries({ queryKey: ['options'] })
      setFormOpen(false)
    },
    onError: (err: any) => {
      const e = err?.response?.data?.errors as Record<string, string[]> | undefined
      if (e) setErrors(Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v[0]])))
      toast.error(getErrorMessage(err, 'Could not save.'))
    },
  })

  const remove = useMutation({
    mutationFn: (id: string | number) => apiClient.delete(`${config.endpoint}/${id}`),
    onSuccess: () => {
      toast.success(`${singular} deleted.`)
      qc.invalidateQueries({ queryKey: [config.endpoint] })
      setDeleting(null)
    },
    onError: (err: unknown) => { toast.error(getErrorMessage(err, 'Could not delete.')); setDeleting(null) },
  })

  const openCreate = () => {
    setEditing(null)
    setErrors({})
    setForm(Object.fromEntries(config.fields.filter((f) => f.defaultValue !== undefined).map((f) => [f.name, f.defaultValue])))
    setFormOpen(true)
  }

  const openEdit = (row: T) => {
    setEditing(row)
    setErrors({})
    const base = config.toForm ? config.toForm(row) : (row as Record<string, unknown>)
    setForm(Object.fromEntries(config.fields.map((f) => {
      const v = base[f.name]
      return [f.name, v === null || v === undefined ? (f.type === 'checkbox' ? false : '') : f.type === 'select' ? String(v) : v]
    })))
    setFormOpen(true)
  }

  const canEdit = can('edit', config.module)
  const canDel = can('delete', config.module)
  const columns: Column<T>[] = [...config.columns]
  if (canEdit || canDel || config.rowActions) {
    columns.push({
      key: '_actions', header: '', align: 'right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          {config.rowActions?.(row)}
          {canEdit && (config.canEdit?.(row) ?? true) && (
            <Button variant="ghost" size="sm" aria-label="Edit" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canDel && (config.canDelete?.(row) ?? true) && (
            <Button variant="ghost" size="sm" aria-label="Delete" onClick={(e) => { e.stopPropagation(); setDeleting(row) }}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      ),
    })
  }

  const fields = editing ? config.fields.filter((f) => !f.createOnly) : config.fields

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{config.title}</h1>
          {config.subtitle && <p className="mt-0.5 text-sm text-gray-500">{config.subtitle}</p>}
        </div>
        <div className="flex gap-2">
          {config.headerActions}
          {can('create', config.module) && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>New {singular.toLowerCase()}</Button>
          )}
        </div>
      </div>

      <Card padding="none">
        <div className="border-b border-gray-100 p-4">
          <Input leftIcon={<Search className="h-4 w-4" />} placeholder={config.searchPlaceholder ?? 'Search…'}
                 value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Table columns={columns} data={data?.data ?? []} keyExtractor={(r) => r.id} loading={isLoading}
               emptyMessage={`No ${config.title.toLowerCase()} yet.`} />
        {data?.meta && data.meta.total > data.meta.per_page && (
          <div className="border-t border-gray-100 p-4">
            <Pagination page={page} total={data.meta.total} perPage={data.meta.per_page} onChange={setPage} />
          </div>
        )}
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} size="xl"
             title={`${editing ? 'Edit' : 'New'} ${singular.toLowerCase()}`}
             footer={
               <div className="flex justify-end gap-2">
                 <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
                 <Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
               </div>
             }>
        <ResourceForm fields={fields} initial={form} errors={errors} onChange={setForm} />
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} size="sm" title={`Delete ${singular.toLowerCase()}?`}
             footer={
               <div className="flex justify-end gap-2">
                 <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
                 <Button variant="danger" loading={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>Delete</Button>
               </div>
             }>
        <p className="text-sm text-gray-600">This cannot be undone.</p>
      </Modal>
    </div>
  )
}
