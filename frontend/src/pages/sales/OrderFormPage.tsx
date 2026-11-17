import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { apiClient } from '@/api/client'
import { ordersApi, type OrderInput } from '@/api/sales'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PageSpinner } from '@/components/ui/Spinner'
import { getErrorMessage, money } from '@/utils/format'

interface ProductOpt { id: number; name: string; sku: string; sell_price: string; tax_rate: string }
interface Line { product_id: string; quantity: string; unit_price: string; discount: string }

const emptyLine: Line = { product_id: '', quantity: '1', unit_price: '', discount: '0' }

export function OrderFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [customer, setCustomer] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState('0')
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }])

  const list = <T,>(endpoint: string) => apiClient.get(endpoint, { params: { all: 1 } }).then((r) => r.data.data as T[])
  const { data: products = [] } = useQuery({ queryKey: ['options', '/products'], queryFn: () => list<ProductOpt>('/products') })
  const { data: customers = [] } = useQuery({ queryKey: ['options', '/customers'], queryFn: () => list<{ id: number; name: string }>('/customers') })
  const { data: warehouses = [] } = useQuery({ queryKey: ['options', '/warehouses'], queryFn: () => list<{ id: number; name: string }>('/warehouses') })

  const { data: existing, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => ordersApi.get(id!), enabled: !!id })
  useEffect(() => {
    if (!existing) return
    setCustomer(existing.customer_id ? String(existing.customer_id) : '')
    setWarehouse(existing.warehouse_id ? String(existing.warehouse_id) : '')
    setNotes(existing.notes ?? '')
    const lineDisc = (existing.items ?? []).reduce((s, i) => s + Number(i.discount), 0)
    setDiscount(String(Math.max(Number(existing.discount_total) - lineDisc, 0)))
    setLines((existing.items ?? []).map((i) => ({
      product_id: String(i.product_id), quantity: String(Number(i.quantity)), unit_price: i.unit_price, discount: i.discount,
    })))
  }, [existing])

  const byId = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products])

  const totals = useMemo(() => {
    let sub = 0, tax = 0, disc = 0
    for (const l of lines) {
      const p = byId.get(l.product_id)
      if (!p) continue
      const price = l.unit_price === '' ? Number(p.sell_price) : Number(l.unit_price)
      const gross = Number(l.quantity) * price
      const d = Math.min(Number(l.discount) || 0, gross)
      sub += gross; disc += d
      tax += Math.round((gross - d) * Number(p.tax_rate)) / 100
    }
    const orderDisc = Math.min(Number(discount) || 0, sub - disc + tax)
    return { sub, tax, disc: disc + orderDisc, total: sub - disc + tax - orderDisc }
  }, [lines, byId, discount])

  const save = useMutation({
    mutationFn: (complete: boolean) => {
      const payload: OrderInput = {
        customer_id: customer ? Number(customer) : null,
        warehouse_id: warehouse ? Number(warehouse) : null,
        notes: notes || undefined,
        discount: Number(discount) || 0,
        items: lines.filter((l) => l.product_id).map((l) => ({
          product_id: Number(l.product_id), quantity: Number(l.quantity),
          unit_price: l.unit_price === '' ? undefined : Number(l.unit_price), discount: Number(l.discount) || 0,
        })),
      }
      return (async () => {
        const order = id ? await ordersApi.update(Number(id), payload) : await ordersApi.create(payload)
        if (complete) await ordersApi.complete(order.id)
        return order
      })()
    },
    onSuccess: (order) => {
      toast.success('Order saved.')
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order', String(order.id)] })
      navigate(`/app/orders/${order.id}`)
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, 'Could not save order.')),
  })

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  if (id && isLoading) return <PageSpinner />
  if (existing && existing.status !== 'draft') {
    return <p className="text-sm text-gray-600">Only draft orders can be edited.</p>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <button onClick={() => navigate('/app/orders')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </button>
      <h1 className="text-2xl font-bold text-gray-900">{id ? `Edit ${existing?.number}` : 'New order'}</h1>

      <Card>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in customer"
                  options={customers.map((c) => ({ value: String(c.id), label: c.name }))} />
          <Select label="Warehouse" value={warehouse} onChange={(e) => setWarehouse(e.target.value)} placeholder="Default warehouse"
                  options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))} />
        </CardBody>
      </Card>

      <Card padding="none">
        <div className="px-6 pt-5"><CardHeader title="Items" /></div>
        <div className="overflow-x-auto p-6 pt-3">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500">
              <tr><th className="pb-2">Product</th><th className="w-24 pb-2">Qty</th><th className="w-32 pb-2">Unit price</th>
                <th className="w-28 pb-2">Discount</th><th className="w-28 pb-2 text-right">Line total</th><th className="w-10" /></tr>
            </thead>
            <tbody className="align-top">
              {lines.map((l, i) => {
                const p = byId.get(l.product_id)
                const price = l.unit_price === '' ? Number(p?.sell_price ?? 0) : Number(l.unit_price)
                const net = Number(l.quantity) * price - (Number(l.discount) || 0)
                const lineTotal = p ? net + Math.round(net * Number(p.tax_rate)) / 100 : 0
                return (
                  <tr key={i}>
                    <td className="py-1 pr-2">
                      <Select value={l.product_id} placeholder="Select product…" aria-label="Product"
                              options={products.map((pp) => ({ value: String(pp.id), label: `${pp.name} (${pp.sku})` }))}
                              onChange={(e) => setLine(i, { product_id: e.target.value, unit_price: '' })} />
                    </td>
                    <td className="py-1 pr-2"><Input type="number" min="0" step="any" aria-label="Quantity" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} /></td>
                    <td className="py-1 pr-2"><Input type="number" min="0" step="any" aria-label="Unit price" placeholder={p?.sell_price ?? ''} value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} /></td>
                    <td className="py-1 pr-2"><Input type="number" min="0" step="any" aria-label="Discount" value={l.discount} onChange={(e) => setLine(i, { discount: e.target.value })} /></td>
                    <td className="py-3 text-right font-medium">{money(lineTotal)}</td>
                    <td className="py-1 text-right">
                      <Button variant="ghost" size="sm" aria-label="Remove line" onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((_, j) => j !== i) : [{ ...emptyLine }])}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Button variant="secondary" size="sm" className="mt-3" icon={<Plus className="h-4 w-4" />}
                  onClick={() => setLines((ls) => [...ls, { ...emptyLine }])}>Add line</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardBody className="space-y-4">
            <Input label="Order discount" type="number" min="0" step="any" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{money(totals.sub)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>-{money(totals.disc)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{money(totals.tax)}</span></div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{money(totals.total)}</span></div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate(false)}>Save draft</Button>
              <Button loading={save.isPending} onClick={() => save.mutate(true)}>Save &amp; complete</Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
