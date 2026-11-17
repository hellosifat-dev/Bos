import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { apiClient } from '@/api/client'
import type { Order } from '@/api/sales'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import { usePermission } from '@/hooks/usePermission'
import { formatDateTime, money } from '@/utils/format'
import { OrderStatusBadge, PaymentStatusBadge } from './salesUi'

export function OrdersPage() {
  const navigate = useNavigate()
  const { can } = usePermission()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [payment, setPayment] = useState('')
  const [channel, setChannel] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, search, status, payment, channel],
    queryFn: () => apiClient.get('/orders', {
      params: { page, search: search || undefined, status: status || undefined, payment_status: payment || undefined, channel: channel || undefined },
    }).then((r) => r.data as { data: Order[]; meta: { total: number; per_page: number } }),
  })

  const columns: Column<Order>[] = [
    { key: 'number', header: 'Order', cell: (o) => <span className="font-medium text-primary-700">{o.number}</span> },
    { key: 'created_at', header: 'Date', cell: (o) => formatDateTime(o.created_at) },
    { key: 'customer', header: 'Customer', cell: (o) => o.customer?.name ?? 'Walk-in' },
    { key: 'channel', header: 'Channel', cell: (o) => o.channel.toUpperCase() },
    { key: 'status', header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
    { key: 'payment_status', header: 'Payment', cell: (o) => <PaymentStatusBadge status={o.payment_status} /> },
    { key: 'total', header: 'Total', align: 'right', cell: (o) => money(o.total) },
    { key: 'balance_due', header: 'Due', align: 'right', cell: (o) => o.balance_due > 0 ? <span className="text-red-600">{money(o.balance_due)}</span> : '—' },
  ]

  const reset = (fn: (v: string) => void) => (e: { target: { value: string } }) => { fn(e.target.value); setPage(1) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        {can('create', 'orders') && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/app/orders/new')}>New order</Button>
        )}
      </div>
      <Card padding="none">
        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 p-4 sm:grid-cols-4">
          <Input placeholder="Order number…" value={search} onChange={reset(setSearch)} />
          <Select value={status} onChange={reset(setStatus)} placeholder="All statuses"
                  options={['draft', 'completed', 'cancelled', 'returned'].map((v) => ({ value: v, label: v }))} />
          <Select value={payment} onChange={reset(setPayment)} placeholder="All payments"
                  options={['unpaid', 'partial', 'paid', 'refunded'].map((v) => ({ value: v, label: v }))} />
          <Select value={channel} onChange={reset(setChannel)} placeholder="All channels"
                  options={[{ value: 'pos', label: 'POS' }, { value: 'manual', label: 'Manual' }]} />
        </div>
        <Table columns={columns} data={data?.data ?? []} keyExtractor={(o) => o.id} loading={isLoading}
               onRowClick={(o) => navigate(`/app/orders/${o.id}`)} emptyMessage="No orders yet." />
        {data?.meta && data.meta.total > data.meta.per_page && (
          <div className="border-t p-4"><Pagination page={page} total={data.meta.total} perPage={data.meta.per_page} onChange={setPage} /></div>
        )}
      </Card>
    </div>
  )
}
