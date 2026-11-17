import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import { usePermission } from '@/hooks/usePermission'
import { formatDate, getErrorMessage, money } from '@/utils/format'

interface Entry { id: number; number: string; date: string; description: string; reference?: string; total: string; source_type?: string | null }
interface EntryDetail extends Entry { lines: Array<{ id: number; debit: string; credit: string; description?: string; account: { code: string; name: string } }> }
interface Line { account_id: string; debit: string; credit: string }

const blank = (): Line => ({ account_id: '', debit: '', credit: '' })

export function JournalPage() {
  const qc = useQueryClient()
  const { can } = usePermission()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [lines, setLines] = useState<Line[]>([blank(), blank()])

  const { data, isLoading } = useQuery({
    queryKey: ['journal', page, search],
    queryFn: () => apiClient.get('/journal-entries', { params: { page, search: search || undefined } })
      .then((r) => r.data as { data: Entry[]; meta: { total: number; per_page: number } }),
  })
  const { data: accounts = [] } = useQuery({
    queryKey: ['options', '/accounts'],
    queryFn: () => apiClient.get('/accounts', { params: { all: 1 } }).then((r) => r.data.data as Array<{ id: number; code: string; name: string }>),
  })
  const { data: detail } = useQuery({
    queryKey: ['journal-entry', viewing],
    queryFn: () => apiClient.get(`/journal-entries/${viewing}`).then((r) => r.data.data as EntryDetail),
    enabled: !!viewing,
  })

  const debits = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const credits = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const balanced = debits > 0 && Math.abs(debits - credits) < 0.005

  const post = useMutation({
    mutationFn: () => apiClient.post('/journal-entries', {
      date, description, reference: reference || undefined,
      lines: lines.filter((l) => l.account_id).map((l) => ({ account_id: Number(l.account_id), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
    }),
    onSuccess: () => {
      toast.success('Journal entry posted.')
      qc.invalidateQueries({ queryKey: ['journal'] }); qc.invalidateQueries({ queryKey: ['/accounts'] })
      setOpen(false); setLines([blank(), blank()]); setDescription(''); setReference('')
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const accountOptions = accounts.map((a) => ({ value: String(a.id), label: `${a.code} · ${a.name}` }))

  const columns: Column<Entry>[] = [
    { key: 'date', header: 'Date', cell: (e) => formatDate(e.date) },
    { key: 'number', header: 'Entry', cell: (e) => <span className="font-medium">{e.number}</span> },
    { key: 'description', header: 'Description' },
    { key: 'source', header: 'Source', cell: (e) => e.source_type ? <span className="text-xs text-gray-500">{e.source_type.split('\\').pop()}</span> : <span className="text-xs text-gray-500">Manual</span> },
    { key: 'total', header: 'Amount', align: 'right', cell: (e) => money(e.total) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Journal</h1>
        {can('create', 'accounting') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New entry</Button>}
      </div>
      <Card padding="none">
        <div className="border-b p-4"><Input placeholder="Search entry number or description…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} /></div>
        <Table columns={columns} data={data?.data ?? []} keyExtractor={(e) => e.id} loading={isLoading}
               onRowClick={(e) => setViewing(e.id)} emptyMessage="No journal entries yet." />
        {data?.meta && data.meta.total > data.meta.per_page && (
          <div className="border-t p-4"><Pagination page={page} total={data.meta.total} perPage={data.meta.per_page} onChange={setPage} /></div>
        )}
      </Card>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={detail ? `${detail.number} · ${formatDate(detail.date)}` : 'Journal entry'} size="lg">
        {detail && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">{detail.description}{detail.reference ? ` · ${detail.reference}` : ''}</p>
            <table className="w-full">
              <thead className="border-b text-left text-xs uppercase text-gray-500"><tr><th className="py-2">Account</th><th className="py-2 text-right">Debit</th><th className="py-2 text-right">Credit</th></tr></thead>
              <tbody className="divide-y">
                {detail.lines.map((l) => (
                  <tr key={l.id}><td className="py-2">{l.account.code} · {l.account.name}</td>
                    <td className="py-2 text-right">{Number(l.debit) ? money(l.debit) : ''}</td>
                    <td className="py-2 text-right">{Number(l.credit) ? money(l.credit) : ''}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="New journal entry" size="xl"
             footer={<div className="flex items-center justify-between gap-2">
               <span className={`text-sm ${balanced ? 'text-green-700' : 'text-red-600'}`}>Debits {money(debits)} · Credits {money(credits)}</span>
               <div className="flex gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                 <Button disabled={!balanced || !description} loading={post.isPending} onClick={() => post.mutate()}>Post entry</Button></div>
             </div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_110px_110px_40px] gap-2">
              <Select aria-label="Account" value={l.account_id} placeholder="Account…" options={accountOptions} onChange={(e) => setLine(i, { account_id: e.target.value })} />
              <Input aria-label="Debit" type="number" min="0" step="any" placeholder="Debit" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: '' })} />
              <Input aria-label="Credit" type="number" min="0" step="any" placeholder="Credit" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: '' })} />
              <Button variant="ghost" size="sm" aria-label="Remove line" onClick={() => setLines((ls) => ls.length > 2 ? ls.filter((_, j) => j !== i) : ls)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setLines((ls) => [...ls, blank()])}>Add line</Button>
        </div>
      </Modal>
    </div>
  )
}
