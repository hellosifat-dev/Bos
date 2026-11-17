import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, X } from 'lucide-react'
import { apiClient } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ResourcePage } from '@/components/resource/ResourcePage'
import { usePermission } from '@/hooks/usePermission'
import { formatDate, getErrorMessage, money } from '@/utils/format'

interface ExpenseRow {
  id: number; date: string; amount: string; payee?: string; reference?: string; description?: string; status: string
  account?: { name: string }; payment_account?: { name: string }; account_id: number; payment_account_id: number
}
const variant: Record<string, 'warning' | 'success' | 'danger'> = { pending: 'warning', approved: 'success', rejected: 'danger' }

export function ExpensesPage() {
  const qc = useQueryClient()
  const { can } = usePermission()
  const review = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'approve' | 'reject' }) => apiClient.post(`/expenses/${id}/${action}`),
    onSuccess: () => { toast.success('Expense updated.'); qc.invalidateQueries({ queryKey: ['/expenses'] }) },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  return (
    <ResourcePage<ExpenseRow>
      title="Expenses" endpoint="/expenses" module="expenses" searchPlaceholder="Search payee, reference or description…"
      columns={[
        { key: 'date', header: 'Date', cell: (e) => formatDate(e.date) },
        { key: 'account', header: 'Category', cell: (e) => e.account?.name ?? '—' },
        { key: 'payee', header: 'Payee', cell: (e) => e.payee ?? '—' },
        { key: 'payment_account', header: 'Paid from', cell: (e) => e.payment_account?.name ?? '—' },
        { key: 'amount', header: 'Amount', align: 'right', cell: (e) => money(e.amount) },
        { key: 'status', header: 'Status', cell: (e) => <Badge variant={variant[e.status]}>{e.status}</Badge> },
      ]}
      fields={[
        { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: new Date().toLocaleDateString('en-CA') },
        { name: 'amount', label: 'Amount', type: 'number', required: true },
        { name: 'account_id', label: 'Expense category', type: 'select', required: true,
          optionsFrom: { endpoint: '/accounts?type=expense', label: (a) => `${a.code} · ${a.name}` } },
        { name: 'payment_account_id', label: 'Paid from', type: 'select', required: true,
          optionsFrom: { endpoint: '/accounts', label: (a) => `${a.code} · ${a.name}`, filter: (a) => ['cash', 'bank', 'payable'].includes(a.system_key) },
          hint: 'Cash, bank, or accounts payable (unpaid bill).' },
        { name: 'payee', label: 'Payee' },
        { name: 'reference', label: 'Reference / receipt no.' },
        { name: 'branch_id', label: 'Branch', type: 'select', optionsFrom: { endpoint: '/branches' }, placeholder: 'None' },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      toForm={(e) => ({ ...e, date: e.date?.slice(0, 10) })}
      canDelete={(e) => e.status !== 'approved'}
      canEdit={(e) => e.status === 'pending'}
      rowActions={(e) => e.status !== 'pending' ? null : (
        <>
          {can('approve', 'expenses') && <Button size="sm" variant="ghost" aria-label="Approve" onClick={(ev) => { ev.stopPropagation(); review.mutate({ id: e.id, action: 'approve' }) }}><Check className="h-4 w-4 text-green-600" /></Button>}
          {can('reject', 'expenses') && <Button size="sm" variant="ghost" aria-label="Reject" onClick={(ev) => { ev.stopPropagation(); review.mutate({ id: e.id, action: 'reject' }) }}><X className="h-4 w-4 text-red-600" /></Button>}
        </>
      )}
    />
  )
}
