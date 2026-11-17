import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { apiClient } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageSpinner } from '@/components/ui/Spinner'
import { Table, type Column } from '@/components/ui/Table'
import { ResourcePage } from '@/components/resource/ResourcePage'
import { formatDate, money } from '@/utils/format'

interface AccountRow { id: number; code: string; name: string; type: string; system_key: string | null; status: string; balance: number }

const typeVariant: Record<string, 'info' | 'warning' | 'purple' | 'success' | 'danger'> = {
  asset: 'info', liability: 'warning', equity: 'purple', income: 'success', expense: 'danger',
}

export function AccountsPage() {
  const navigate = useNavigate()
  return (
    <ResourcePage<AccountRow>
      title="Chart of accounts" singular="Account" endpoint="/accounts" module="accounting" searchPlaceholder="Search code or name…"
      columns={[
        { key: 'code', header: 'Code' },
        { key: 'name', header: 'Name', cell: (a) => <span>{a.name} {a.system_key && <span className="text-xs text-gray-400">(system)</span>}</span> },
        { key: 'type', header: 'Type', cell: (a) => <Badge variant={typeVariant[a.type]}>{a.type}</Badge> },
        { key: 'balance', header: 'Balance', align: 'right', cell: (a) => <span className={a.balance < 0 ? 'text-red-600' : ''}>{money(a.balance)}</span> },
      ]}
      fields={[
        { name: 'code', label: 'Code', required: true },
        { name: 'name', label: 'Name', required: true },
        { name: 'type', label: 'Type', type: 'select', required: true, createOnly: true, options: [
          { value: 'asset', label: 'Asset' }, { value: 'liability', label: 'Liability' }, { value: 'equity', label: 'Equity' },
          { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' },
        ] },
        { name: 'status', label: 'Status', type: 'select', defaultValue: 'active', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      canDelete={(a) => !a.system_key}
      rowActions={(a) => (
        <Button variant="ghost" size="sm" aria-label="Ledger" onClick={(e) => { e.stopPropagation(); navigate(`/app/accounts/${a.id}/ledger`) }}>
          <BookOpen className="h-4 w-4" />
        </Button>
      )}
    />
  )
}

interface LedgerLine { id: number; number: string; date: string; description: string; reference?: string; debit: number; credit: number; balance: number }

export function LedgerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['ledger', id, from, to],
    queryFn: () => apiClient.get(`/accounts/${id}/ledger`, { params: { from: from || undefined, to: to || undefined } })
      .then((r) => r.data.data as { account: AccountRow; opening_balance: number; closing_balance: number; lines: LedgerLine[] }),
  })
  if (isLoading || !data) return <PageSpinner />

  const columns: Column<LedgerLine>[] = [
    { key: 'date', header: 'Date', cell: (l) => formatDate(l.date) },
    { key: 'number', header: 'Entry' },
    { key: 'description', header: 'Description' },
    { key: 'debit', header: 'Debit', align: 'right', cell: (l) => (l.debit ? money(l.debit) : '') },
    { key: 'credit', header: 'Credit', align: 'right', cell: (l) => (l.credit ? money(l.credit) : '') },
    { key: 'balance', header: 'Balance', align: 'right', cell: (l) => money(l.balance) },
  ]

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/app/accounts')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Chart of accounts
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.account.code} · {data.account.name}</h1>
          <p className="text-sm text-gray-500">Opening {money(data.opening_balance)} · Closing {money(data.closing_balance)}</p>
        </div>
        <div className="flex gap-2">
          <div className="w-40"><Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="w-40"><Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </div>
      <Card padding="none">
        <Table columns={columns} data={data.lines} keyExtractor={(l) => l.id} emptyMessage="No entries in this period." />
      </Card>
    </div>
  )
}
