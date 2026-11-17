import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Printer } from 'lucide-react'
import { ordersApi, paymentMethods, type Order } from '@/api/sales'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { PageSpinner } from '@/components/ui/Spinner'
import { usePermission } from '@/hooks/usePermission'
import { formatDateTime, getErrorMessage, money } from '@/utils/format'
import { OrderStatusBadge, PaymentStatusBadge } from './salesUi'

/** Printable invoice body, also used for POS receipts. */
export function Invoice({ order }: { order: Order }) {
  const addr = order.business?.address
  return (
    <div className="print-area space-y-6 text-sm">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{order.business?.name}</h2>
          {addr && <p className="text-gray-500">{[addr.line1, addr.city, addr.state].filter(Boolean).join(', ')}</p>}
          {order.business?.phone && <p className="text-gray-500">{order.business.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{order.status === 'draft' ? 'Quotation' : 'Invoice'} {order.number}</p>
          <p className="text-gray-500">{formatDateTime(order.completed_at ?? order.created_at)}</p>
        </div>
      </div>
      <div>
        <p className="text-xs uppercase text-gray-500">Bill to</p>
        <p className="font-medium">{order.customer?.name ?? 'Walk-in customer'}</p>
        {order.customer?.phone && <p className="text-gray-500">{order.customer.phone}</p>}
      </div>
      <table className="w-full">
        <thead className="border-b text-left text-xs uppercase text-gray-500">
          <tr><th className="py-2">Item</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Disc.</th><th className="py-2 text-right">Tax</th><th className="py-2 text-right">Total</th></tr>
        </thead>
        <tbody className="divide-y">
          {order.items?.map((i) => (
            <tr key={i.id}>
              <td className="py-2">{i.name}{Number(i.returned_quantity) > 0 && <span className="ml-2 text-xs text-amber-600">({Number(i.returned_quantity)} returned)</span>}</td>
              <td className="py-2 text-right">{Number(i.quantity)}</td>
              <td className="py-2 text-right">{money(i.unit_price)}</td>
              <td className="py-2 text-right">{Number(i.discount) ? money(i.discount) : '—'}</td>
              <td className="py-2 text-right">{Number(i.tax_amount) ? money(i.tax_amount) : '—'}</td>
              <td className="py-2 text-right">{money(i.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto w-full max-w-xs space-y-1">
        <Row label="Subtotal" value={money(order.subtotal)} />
        {Number(order.discount_total) > 0 && <Row label="Discount" value={`-${money(order.discount_total)}`} />}
        {Number(order.tax_total) > 0 && <Row label="Tax" value={money(order.tax_total)} />}
        <Row label="Total" value={money(order.total)} bold />
        {Number(order.returned_total) > 0 && <Row label="Returned" value={`-${money(order.returned_total)}`} />}
        <Row label="Paid" value={money(order.paid_total)} />
        {Number(order.refunded_total) > 0 && <Row label="Refunded" value={`-${money(order.refunded_total)}`} />}
        <Row label="Balance due" value={money(order.balance_due)} bold />
      </div>
    </div>
  )
}

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div className={`flex justify-between ${bold ? 'border-t pt-1 font-semibold' : ''}`}>
    <span className={bold ? '' : 'text-gray-500'}>{label}</span><span>{value}</span>
  </div>
)

export function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { can } = usePermission()
  const [payOpen, setPayOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [returnQty, setReturnQty] = useState<Record<number, string>>({})

  const { data: order, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => ordersApi.get(id!) })

  const done = (msg: string) => () => {
    toast.success(msg)
    qc.invalidateQueries({ queryKey: ['order', id] })
    qc.invalidateQueries({ queryKey: ['orders'] })
    setPayOpen(false); setReturnOpen(false)
  }
  const fail = (e: unknown) => toast.error(getErrorMessage(e))

  const complete = useMutation({ mutationFn: () => ordersApi.complete(order!.id), onSuccess: done('Order completed.'), onError: fail })
  const cancel = useMutation({ mutationFn: () => ordersApi.cancel(order!.id), onSuccess: done('Order cancelled.'), onError: fail })
  const pay = useMutation({
    mutationFn: () => ordersApi.pay(order!.id, { amount: Number(amount), method, reference: reference || undefined }),
    onSuccess: done('Payment recorded.'), onError: fail,
  })
  const ret = useMutation({
    mutationFn: () => ordersApi.return(order!.id, {
      method,
      lines: Object.entries(returnQty).filter(([, q]) => Number(q) > 0).map(([item, q]) => ({ item_id: Number(item), quantity: Number(q) })),
    }),
    onSuccess: done('Return processed.'), onError: fail,
  })

  if (isLoading || !order) return <PageSpinner />

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button onClick={() => navigate('/app/orders')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </button>
        <div className="flex flex-wrap gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.payment_status} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        {order.status === 'draft' && can('edit', 'orders') && (
          <>
            <Button variant="secondary" onClick={() => navigate(`/app/orders/${order.id}/edit`)}>Edit</Button>
            <Button loading={complete.isPending} onClick={() => complete.mutate()}>Complete order</Button>
          </>
        )}
        {order.status === 'draft' && can('cancel', 'orders') && (
          <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel</Button>
        )}
        {order.balance_due > 0 && order.status !== 'cancelled' && can('create', 'payments') && (
          <Button onClick={() => { setAmount(String(order.balance_due)); setPayOpen(true) }}>Record payment</Button>
        )}
        {order.status === 'completed' && can('refund', 'orders') && (
          <Button variant="secondary" onClick={() => { setReturnQty({}); setReturnOpen(true) }}>Return items</Button>
        )}
        <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button>
      </div>

      <Card><Invoice order={order} /></Card>

      {!!order.payments?.length && (
        <Card className="print:hidden">
          <h3 className="mb-3 font-semibold">Payments</h3>
          <div className="divide-y text-sm">
            {order.payments.map((p) => (
              <div key={p.id} className="flex justify-between py-2">
                <span>{formatDateTime(p.paid_at)} · {p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
                <span className={p.type === 'refund' ? 'text-red-600' : 'text-green-700'}>
                  {p.type === 'refund' ? '-' : '+'}{money(p.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record payment"
             footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button>
               <Button loading={pay.isPending} onClick={() => pay.mutate()}>Save payment</Button></div>}>
        <div className="space-y-4">
          <Input label="Amount" type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} hint={`Balance due ${money(order.balance_due)}`} />
          <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value)} options={paymentMethods} />
          <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
      </Modal>

      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} title="Return items" size="lg"
             footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setReturnOpen(false)}>Cancel</Button>
               <Button loading={ret.isPending} onClick={() => ret.mutate()}>Process return</Button></div>}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Leave all quantities empty to return everything. Returned stock goes back to the order's warehouse.</p>
          {order.items?.map((i) => {
            const left = Number(i.quantity) - Number(i.returned_quantity)
            return (
              <div key={i.id} className="flex items-center justify-between gap-3">
                <span className="text-sm">{i.name} <span className="text-gray-400">(max {left})</span></span>
                <div className="w-28"><Input type="number" min="0" max={left} step="any" aria-label={`Return ${i.name}`} disabled={left <= 0}
                       value={returnQty[i.id] ?? ''} onChange={(e) => setReturnQty((r) => ({ ...r, [i.id]: e.target.value }))} /></div>
              </div>
            )
          })}
          <Select label="Refund method" value={method} onChange={(e) => setMethod(e.target.value)} options={paymentMethods} />
        </div>
      </Modal>
    </div>
  )
}
