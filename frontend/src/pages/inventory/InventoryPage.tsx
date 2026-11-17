import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeftRight, SlidersHorizontal } from 'lucide-react'
import { apiClient } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import { ResourceForm, type Field } from '@/components/resource/ResourcePage'
import { usePermission } from '@/hooks/usePermission'
import { formatDateTime, getErrorMessage, money } from '@/utils/format'

interface StockRow {
  product_id: number; name: string; sku: string; category: string | null; unit: string | null
  quantity: number; reorder_level: number; value: number; low_stock: boolean
}
interface Movement {
  id: number; type: string; quantity: string; balance_after: string; note: string | null; created_at: string
  product?: { name: string; sku: string }; warehouse?: { name: string }; user_name?: string
}

const productField: Field = { name: 'product_id', label: 'Product', type: 'select', required: true,
  optionsFrom: { endpoint: '/products', label: (p) => `${p.name} (${p.sku})` } }

const adjustFields: Field[] = [
  productField,
  { name: 'warehouse_id', label: 'Warehouse', type: 'select', optionsFrom: { endpoint: '/warehouses' }, placeholder: 'Default warehouse' },
  { name: 'quantity', label: 'Quantity change', type: 'number', required: true, hint: 'Positive adds stock, negative removes it.' },
  { name: 'note', label: 'Reason', placeholder: 'Stock count, damage…' },
]
const transferFields: Field[] = [
  productField,
  { name: 'quantity', label: 'Quantity', type: 'number', required: true },
  { name: 'from_warehouse_id', label: 'From', type: 'select', required: true, optionsFrom: { endpoint: '/warehouses' } },
  { name: 'to_warehouse_id', label: 'To', type: 'select', required: true, optionsFrom: { endpoint: '/warehouses' } },
  { name: 'note', label: 'Note' },
]

const typeVariant: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default'> = {
  opening: 'info', adjustment: 'warning', transfer_in: 'success', transfer_out: 'danger',
  sale: 'danger', sale_return: 'success', purchase: 'success',
}

function StockAction({ title, endpoint, fields, open, onClose }: {
  title: string; endpoint: string; fields: Field[]; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const mutation = useMutation({
    mutationFn: () => apiClient.post(endpoint, Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''))),
    onSuccess: () => {
      toast.success(`${title} saved.`)
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inventory-movements'] })
      qc.invalidateQueries({ queryKey: ['/products'] })
      setForm({}); setErrors({}); onClose()
    },
    onError: (err: any) => {
      const e = err?.response?.data?.errors as Record<string, string[]> | undefined
      if (e) setErrors(Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v[0]])))
      toast.error(getErrorMessage(err))
    },
  })
  return (
    <Modal open={open} onClose={onClose} title={title} size="xl"
           footer={<div className="flex justify-end gap-2">
             <Button variant="secondary" onClick={onClose}>Cancel</Button>
             <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>Save</Button>
           </div>}>
      <ResourceForm fields={fields} initial={form} errors={errors} onChange={setForm} />
    </Modal>
  )
}

export function InventoryPage() {
  const { can } = usePermission()
  const [tab, setTab] = useState<'stock' | 'movements'>('stock')
  const [warehouse, setWarehouse] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [mPage, setMPage] = useState(1)
  const [modal, setModal] = useState<'adjust' | 'transfer' | null>(null)

  const { data: warehouses } = useQuery({
    queryKey: ['options', '/warehouses'],
    queryFn: () => apiClient.get('/warehouses', { params: { all: 1 } }).then((r) => r.data.data as Array<{ id: number; name: string }>),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', warehouse, lowOnly, search, page],
    queryFn: () => apiClient.get('/inventory', {
      params: { warehouse_id: warehouse || undefined, low_stock: lowOnly ? 1 : undefined, search: search || undefined, page },
    }).then((r) => r.data as { data: StockRow[]; meta: { total: number; per_page: number; total_value: number; low_stock: number } }),
    enabled: tab === 'stock',
  })

  const { data: movements, isLoading: mLoading } = useQuery({
    queryKey: ['inventory-movements', warehouse, mPage],
    queryFn: () => apiClient.get('/inventory/movements', { params: { warehouse_id: warehouse || undefined, page: mPage } })
      .then((r) => r.data as { data: Movement[]; meta: { total: number; per_page: number } }),
    enabled: tab === 'movements',
  })

  const stockColumns: Column<StockRow>[] = [
    { key: 'name', header: 'Product', cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-gray-500">{r.sku}</p></div> },
    { key: 'category', header: 'Category', cell: (r) => r.category ?? '—' },
    { key: 'quantity', header: 'On hand', align: 'right', cell: (r) => `${r.quantity} ${r.unit ?? ''}` },
    { key: 'reorder_level', header: 'Reorder at', align: 'right' },
    { key: 'value', header: 'Value', align: 'right', cell: (r) => money(r.value) },
    { key: 'low_stock', header: '', cell: (r) => r.low_stock ? <Badge variant="danger">Low</Badge> : null },
  ]
  const movementColumns: Column<Movement>[] = [
    { key: 'created_at', header: 'When', cell: (m) => formatDateTime(m.created_at) },
    { key: 'product', header: 'Product', cell: (m) => m.product?.name ?? '—' },
    { key: 'warehouse', header: 'Warehouse', cell: (m) => m.warehouse?.name ?? '—' },
    { key: 'type', header: 'Type', cell: (m) => <Badge variant={typeVariant[m.type] ?? 'default'}>{m.type.replace('_', ' ')}</Badge> },
    { key: 'quantity', header: 'Change', align: 'right', cell: (m) => {
      const q = Number(m.quantity)
      return <span className={q < 0 ? 'text-red-600' : 'text-green-600'}>{q > 0 ? '+' : ''}{q}</span>
    } },
    { key: 'balance_after', header: 'Balance', align: 'right', cell: (m) => Number(m.balance_after) },
    { key: 'note', header: 'Note', cell: (m) => m.note ?? '—' },
    { key: 'user', header: 'By', cell: (m) => m.user_name ?? '—' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          {data?.meta && tab === 'stock' && (
            <p className="mt-0.5 text-sm text-gray-500">
              Stock value {money(data.meta.total_value)} · {data.meta.low_stock} item(s) low on stock
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {can('adjust', 'inventory') && (
            <Button variant="secondary" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setModal('adjust')}>Adjust</Button>
          )}
          {can('transfer', 'inventory') && (
            <Button icon={<ArrowLeftRight className="h-4 w-4" />} onClick={() => setModal('transfer')}>Transfer</Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(['stock', 'movements'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'stock' ? 'Stock levels' : 'Movements'}
          </button>
        ))}
      </div>

      <Card padding="none">
        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 p-4 sm:grid-cols-3">
          <Select value={warehouse} onChange={(e) => { setWarehouse(e.target.value); setPage(1); setMPage(1) }}
                  placeholder="All warehouses" options={(warehouses ?? []).map((w) => ({ value: String(w.id), label: w.name }))} />
          {tab === 'stock' && (
            <>
              <Input placeholder="Search product or SKU…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={lowOnly} onChange={(e) => { setLowOnly(e.target.checked); setPage(1) }} />
                Low stock only
              </label>
            </>
          )}
        </div>
        {tab === 'stock' ? (
          <>
            <Table columns={stockColumns} data={data?.data ?? []} keyExtractor={(r) => r.product_id} loading={isLoading}
                   emptyMessage="No stocked products." />
            {data?.meta && data.meta.total > data.meta.per_page && (
              <div className="border-t p-4"><Pagination page={page} total={data.meta.total} perPage={data.meta.per_page} onChange={setPage} /></div>
            )}
          </>
        ) : (
          <>
            <Table columns={movementColumns} data={movements?.data ?? []} keyExtractor={(r) => r.id} loading={mLoading}
                   emptyMessage="No stock movements yet." />
            {movements?.meta && movements.meta.total > movements.meta.per_page && (
              <div className="border-t p-4"><Pagination page={mPage} total={movements.meta.total} perPage={movements.meta.per_page} onChange={setMPage} /></div>
            )}
          </>
        )}
      </Card>

      <StockAction title="Adjust stock" endpoint="/inventory/adjust" fields={adjustFields} open={modal === 'adjust'} onClose={() => setModal(null)} />
      <StockAction title="Transfer stock" endpoint="/inventory/transfer" fields={transferFields} open={modal === 'transfer'} onClose={() => setModal(null)} />
    </div>
  )
}
