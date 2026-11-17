import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Printer } from 'lucide-react'
import { apiClient } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageSpinner } from '@/components/ui/Spinner'
import { Table, type Column } from '@/components/ui/Table'
import { usePermission } from '@/hooks/usePermission'
import { getErrorMessage, money } from '@/utils/format'

interface Run {
  id: number; period: string; status: 'draft' | 'approved' | 'paid'; working_days: number
  total_gross: string; total_deductions: string; total_net: string; payslips_count?: number; payslips?: Slip[]
}
interface Slip {
  id: number; employee_id: number; working_days: string; present_days: string; absent_days: string; unpaid_leave_days: string
  basic: string; allowances: string; bonus: string; deductions: string; absence_deduction: string; gross: string; net: string; note?: string
  employee?: { name: string; employee_code: string; bank_account?: string; department?: { name: string }; designation?: { name: string } }
}

const variant = { draft: 'default', approved: 'info', paid: 'success' } as const
const monthLabel = (p: string) => new Date(`${p}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

export function PayrollPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { can } = usePermission()
  const [period, setPeriod] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7))

  const { data, isLoading } = useQuery({
    queryKey: ['payroll'],
    queryFn: () => apiClient.get('/payroll', { params: { per_page: 50 } }).then((r) => r.data.data as Run[]),
  })
  const generate = useMutation({
    mutationFn: () => apiClient.post('/payroll', { period }),
    onSuccess: (r) => { toast.success('Payroll generated.'); qc.invalidateQueries({ queryKey: ['payroll'] }); navigate(`/app/payroll/${r.data.data.id}`) },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const columns: Column<Run>[] = [
    { key: 'period', header: 'Period', cell: (r) => <span className="font-medium">{monthLabel(r.period)}</span> },
    { key: 'payslips_count', header: 'Employees', align: 'right' },
    { key: 'total_gross', header: 'Gross', align: 'right', cell: (r) => money(r.total_gross) },
    { key: 'total_deductions', header: 'Deductions', align: 'right', cell: (r) => money(r.total_deductions) },
    { key: 'total_net', header: 'Net pay', align: 'right', cell: (r) => <span className="font-semibold">{money(r.total_net)}</span> },
    { key: 'status', header: 'Status', cell: (r) => <Badge variant={variant[r.status]}>{r.status}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
        {can('create', 'payroll') && (
          <div className="flex items-end gap-2">
            <div className="w-44"><Input label="Month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
            <Button loading={generate.isPending} onClick={() => generate.mutate()}>Generate payroll</Button>
          </div>
        )}
      </div>
      <Card padding="none">
        <Table columns={columns} data={data ?? []} keyExtractor={(r) => r.id} loading={isLoading}
               onRowClick={(r) => navigate(`/app/payroll/${r.id}`)} emptyMessage="No payroll runs yet." />
      </Card>
    </div>
  )
}

export function PayrollDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { can } = usePermission()
  const [edits, setEdits] = useState<Record<number, { bonus?: string; deductions?: string }>>({})
  const [printSlip, setPrintSlip] = useState<Slip | null>(null)

  const { data: run, isLoading } = useQuery({
    queryKey: ['payroll', id],
    queryFn: () => apiClient.get(`/payroll/${id}`).then((r) => r.data.data as Run),
  })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['payroll'] }) }
  const onErr = (e: unknown) => toast.error(getErrorMessage(e))

  const saveSlip = useMutation({
    mutationFn: (slip: Slip) => apiClient.put(`/payroll/${id}/payslips/${slip.id}`, {
      bonus: Number(edits[slip.id]?.bonus ?? slip.bonus), deductions: Number(edits[slip.id]?.deductions ?? slip.deductions),
    }),
    onSuccess: (_r, slip) => { setEdits((e) => { const n = { ...e }; delete n[slip.id]; return n }); refresh() },
    onError: onErr,
  })
  const action = useMutation({
    mutationFn: (a: 'approve' | 'pay' | 'delete') => a === 'delete' ? apiClient.delete(`/payroll/${id}`) : apiClient.post(`/payroll/${id}/${a}`),
    onSuccess: (_r, a) => { toast.success('Payroll updated.'); refresh(); if (a === 'delete') navigate('/app/payroll') },
    onError: onErr,
  })

  if (isLoading || !run) return <PageSpinner />
  const draft = run.status === 'draft' && can('edit', 'payroll')

  const columns: Column<Slip>[] = [
    { key: 'employee', header: 'Employee', cell: (s) => <div><p className="font-medium">{s.employee?.name}</p><p className="text-xs text-gray-500">{s.employee?.employee_code}</p></div> },
    { key: 'days', header: 'Absent / unpaid', align: 'right', cell: (s) => `${Number(s.absent_days)} / ${Number(s.unpaid_leave_days)}` },
    { key: 'basic', header: 'Basic', align: 'right', cell: (s) => money(s.basic) },
    { key: 'allowances', header: 'Allowances', align: 'right', cell: (s) => money(s.allowances) },
    { key: 'bonus', header: 'Bonus', align: 'right', cell: (s) => draft
      ? <input aria-label={`Bonus for ${s.employee?.name}`} type="number" min="0" className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm"
               value={edits[s.id]?.bonus ?? Number(s.bonus)} onChange={(e) => setEdits((x) => ({ ...x, [s.id]: { ...x[s.id], bonus: e.target.value } }))} />
      : money(s.bonus) },
    { key: 'deductions', header: 'Deductions', align: 'right', cell: (s) => draft
      ? <input aria-label={`Deductions for ${s.employee?.name}`} type="number" min="0" className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm"
               value={edits[s.id]?.deductions ?? Number(s.deductions)} onChange={(e) => setEdits((x) => ({ ...x, [s.id]: { ...x[s.id], deductions: e.target.value } }))} />
      : money(s.deductions) },
    { key: 'absence_deduction', header: 'Absence', align: 'right', cell: (s) => money(s.absence_deduction) },
    { key: 'net', header: 'Net pay', align: 'right', cell: (s) => <span className="font-semibold">{money(s.net)}</span> },
    { key: 'actions', header: '', align: 'right', cell: (s) => (
      <div className="flex justify-end gap-1">
        {edits[s.id] && <Button size="sm" loading={saveSlip.isPending} onClick={() => saveSlip.mutate(s)}>Save</Button>}
        <Button size="sm" variant="ghost" aria-label="Print payslip" onClick={() => { setPrintSlip(s); setTimeout(() => window.print(), 50) }}><Printer className="h-4 w-4" /></Button>
      </div>
    ) },
  ]

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/app/payroll')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to payroll
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll — {monthLabel(run.period)}</h1>
          <p className="text-sm text-gray-500">{run.working_days} working days · Net {money(run.total_net)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={variant[run.status]}>{run.status}</Badge>
          {run.status === 'draft' && can('create', 'payroll') && <Button variant="danger" onClick={() => action.mutate('delete')}>Delete</Button>}
          {run.status === 'draft' && can('approve', 'payroll') && <Button loading={action.isPending} onClick={() => action.mutate('approve')}>Approve</Button>}
          {run.status === 'approved' && can('approve', 'payroll') && <Button loading={action.isPending} onClick={() => action.mutate('pay')}>Mark as paid</Button>}
        </div>
      </div>
      <Card padding="none">
        <Table columns={columns} data={run.payslips ?? []} keyExtractor={(s) => s.id} emptyMessage="No eligible employees for this period." />
      </Card>

      {printSlip && (
        <div className="print-area hidden print:block">
          <h2 className="text-xl font-bold">Payslip — {monthLabel(run.period)}</h2>
          <p className="mt-2">{printSlip.employee?.name} ({printSlip.employee?.employee_code})</p>
          <p className="text-sm text-gray-600">{printSlip.employee?.designation?.name} · {printSlip.employee?.department?.name}</p>
          <table className="mt-4 w-full text-sm"><tbody>
            {([['Working days', Number(printSlip.working_days)], ['Absent days', Number(printSlip.absent_days)], ['Unpaid leave days', Number(printSlip.unpaid_leave_days)],
               ['Basic', money(printSlip.basic)], ['Allowances', money(printSlip.allowances)], ['Bonus', money(printSlip.bonus)], ['Gross', money(printSlip.gross)],
               ['Deductions', `-${money(printSlip.deductions)}`], ['Absence deduction', `-${money(printSlip.absence_deduction)}`], ['Net pay', money(printSlip.net)]] as const
            ).map(([k, v]) => <tr key={k} className="border-b"><td className="py-1">{k}</td><td className="py-1 text-right">{v}</td></tr>)}
          </tbody></table>
        </div>
      )}
    </div>
  )
}
