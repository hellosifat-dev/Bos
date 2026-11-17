import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Table, type Column } from '@/components/ui/Table'
import { usePermission } from '@/hooks/usePermission'
import { getErrorMessage } from '@/utils/format'

interface SheetRow {
  employee_id: number; employee_code: string; name: string; department: string | null
  status: string | null; check_in: string | null; check_out: string | null; note: string | null
}
interface SummaryRow { employee_id: number; name: string; employee_code: string; present: number; late: number; half_day: number; absent: number; leave: number; holiday: number }

const statuses = ['present', 'late', 'half_day', 'absent', 'leave', 'holiday']
const today = () => new Date().toLocaleDateString('en-CA') // local YYYY-MM-DD

export function AttendancePage() {
  const qc = useQueryClient()
  const { can } = usePermission()
  const [tab, setTab] = useState<'sheet' | 'summary'>('sheet')
  const [date, setDate] = useState(today())
  const [month, setMonth] = useState(today().slice(0, 7))
  const [rows, setRows] = useState<SheetRow[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', date],
    queryFn: () => apiClient.get('/attendance', { params: { date } }).then((r) => r.data.data as SheetRow[]),
    enabled: tab === 'sheet',
  })
  useEffect(() => { if (data) setRows(data) }, [data])

  const { data: summary, isLoading: sLoading } = useQuery({
    queryKey: ['attendance-summary', month],
    queryFn: () => apiClient.get('/attendance/summary', { params: { month } }).then((r) => r.data.data as SummaryRow[]),
    enabled: tab === 'summary',
  })

  const save = useMutation({
    mutationFn: () => apiClient.post('/attendance', {
      date,
      records: rows.map((r) => ({ employee_id: r.employee_id, status: r.status || null, check_in: r.check_in || null, check_out: r.check_out || null, note: r.note || null })),
    }),
    onSuccess: () => { toast.success('Attendance saved.'); qc.invalidateQueries({ queryKey: ['attendance'] }) },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const set = (id: number, patch: Partial<SheetRow>) => setRows((rs) => rs.map((r) => (r.employee_id === id ? { ...r, ...patch } : r)))
  const editable = can('create', 'attendance')

  const sheetColumns: Column<SheetRow>[] = [
    { key: 'name', header: 'Employee', cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-gray-500">{r.employee_code} · {r.department ?? '—'}</p></div> },
    { key: 'status', header: 'Status', cell: (r) => (
      <select aria-label={`Status for ${r.name}`} disabled={!editable} value={r.status ?? ''} onChange={(e) => set(r.employee_id, { status: e.target.value || null })}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
        <option value="">— not recorded —</option>
        {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </select>
    ) },
    { key: 'check_in', header: 'In', cell: (r) => <input type="time" aria-label={`Check-in for ${r.name}`} disabled={!editable} value={r.check_in ?? ''} onChange={(e) => set(r.employee_id, { check_in: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" /> },
    { key: 'check_out', header: 'Out', cell: (r) => <input type="time" aria-label={`Check-out for ${r.name}`} disabled={!editable} value={r.check_out ?? ''} onChange={(e) => set(r.employee_id, { check_out: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" /> },
    { key: 'note', header: 'Note', cell: (r) => <input aria-label={`Note for ${r.name}`} disabled={!editable} value={r.note ?? ''} onChange={(e) => set(r.employee_id, { note: e.target.value })} className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm" /> },
  ]
  const summaryColumns: Column<SummaryRow>[] = [
    { key: 'name', header: 'Employee', cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-gray-500">{r.employee_code}</p></div> },
    ...(['present', 'late', 'half_day', 'absent', 'leave', 'holiday'] as const).map((k) => ({ key: k, header: k.replace('_', ' '), align: 'right' as const })),
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
      <div className="flex gap-2 border-b border-gray-200">
        {(['sheet', 'summary'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500'}`}>
            {t === 'sheet' ? 'Daily sheet' : 'Monthly summary'}
          </button>
        ))}
      </div>
      <Card padding="none">
        {tab === 'sheet' ? (
          <>
            <div className="flex flex-wrap items-end gap-3 border-b p-4">
              <div className="w-48"><Input label="Date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
              {editable && (
                <>
                  <Button variant="secondary" onClick={() => setRows((rs) => rs.map((r) => (r.status ? r : { ...r, status: 'present' })))}>Mark unrecorded present</Button>
                  <Button loading={save.isPending} onClick={() => save.mutate()} disabled={!rows.length}>Save attendance</Button>
                </>
              )}
            </div>
            <Table columns={sheetColumns} data={rows} keyExtractor={(r) => r.employee_id} loading={isLoading} emptyMessage="No active employees." />
          </>
        ) : (
          <>
            <div className="border-b p-4"><div className="w-48"><Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div></div>
            <Table columns={summaryColumns} data={summary ?? []} keyExtractor={(r) => r.employee_id} loading={sLoading} emptyMessage="No employees." />
          </>
        )}
      </Card>
    </div>
  )
}
