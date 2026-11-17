import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { money } from '@/utils/format'

type Tab = 'profit-loss' | 'balance-sheet' | 'trial-balance' | 'sales' | 'inventory' | 'expenses'
const tabs: Array<[Tab, string]> = [
  ['profit-loss', 'Profit & loss'], ['balance-sheet', 'Balance sheet'], ['trial-balance', 'Trial balance'],
  ['sales', 'Sales'], ['inventory', 'Inventory valuation'], ['expenses', 'Expenses'],
]
const ranged: Tab[] = ['profit-loss', 'sales', 'expenses']
const pointInTime: Tab[] = ['balance-sheet', 'trial-balance']

interface AcctRow { id: number; code: string; name: string; balance: number; debit_balance?: number; credit_balance?: number }

/** Download rows as CSV. */
function exportCsv(name: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

const Section = ({ title, rows, total }: { title: string; rows: AcctRow[]; total: number }) => (
  <div className="space-y-1">
    <h3 className="font-semibold text-gray-900">{title}</h3>
    {rows.length === 0 && <p className="text-sm text-gray-400">None</p>}
    {rows.map((r) => (
      <div key={r.id} className="flex justify-between text-sm"><span>{r.code} · {r.name}</span><span>{money(r.balance)}</span></div>
    ))}
    <div className="flex justify-between border-t pt-1 text-sm font-semibold"><span>Total {title.toLowerCase()}</span><span>{money(total)}</span></div>
  </div>
)
const Line = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
  <div className={`flex justify-between ${strong ? 'border-t pt-2 text-base font-bold' : 'text-sm'}`}>
    <span>{label}</span><span className={value < 0 ? 'text-red-600' : ''}>{money(value)}</span>
  </div>
)
const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-lg border border-gray-200 p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>
)

export function ReportsPage() {
  const today = new Date().toLocaleDateString('en-CA')
  const [tab, setTab] = useState<Tab>('profit-loss')
  const [from, setFrom] = useState(today.slice(0, 8) + '01')
  const [to, setTo] = useState(today)
  const [asOf, setAsOf] = useState(today)

  const params = ranged.includes(tab) ? { from, to } : pointInTime.includes(tab) ? { as_of: asOf } : {}
  const { data, isLoading, error } = useQuery({
    queryKey: ['report', tab, params],
    queryFn: () => apiClient.get(`/reports/${tab}`, { params }).then((r) => r.data.data),
  })

  const csvRows = (): Array<Record<string, unknown>> => {
    if (!data) return []
    switch (tab) {
      case 'profit-loss': return [...data.income, ...data.expenses].map((a: any) => ({ code: a.code, account: a.name, type: a.type, amount: a.balance }))
      case 'balance-sheet': return [...data.assets, ...data.liabilities, ...data.equity].map((a: any) => ({ code: a.code, account: a.name, type: a.type, balance: a.balance }))
      case 'trial-balance': return data.accounts.map((a: any) => ({ code: a.code, account: a.name, debit: a.debit_balance, credit: a.credit_balance }))
      case 'sales': return data.daily
      case 'inventory': return data.by_category
      case 'expenses': return data.by_account
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <div className="flex flex-wrap items-end gap-2">
          {ranged.includes(tab) && (
            <>
              <div className="w-40"><Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="w-40"><Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </>
          )}
          {pointInTime.includes(tab) && <div className="w-40"><Input label="As of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>}
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => exportCsv(`${tab}-${today}`, csvRows())}>Export CSV</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : error || !data ? (
          <p className="text-sm text-red-600">Could not load this report.</p>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {tab === 'profit-loss' && (
              <>
                <Section title="Income" rows={data.income} total={data.total_income} />
                <Line label="Cost of sales" value={-data.cost_of_sales || 0} />
                <Line label="Gross profit" value={data.gross_profit} strong />
                <Section title="Expenses" rows={data.expenses.filter((e: any) => e.system_key !== 'cogs')} total={data.operating_expenses} />
                <Line label="Net profit" value={data.net_profit} strong />
              </>
            )}
            {tab === 'balance-sheet' && (
              <>
                {!data.balanced && <p className="rounded bg-red-50 p-3 text-sm text-red-700">The balance sheet does not balance — check manual journal entries.</p>}
                <Section title="Assets" rows={data.assets} total={data.total_assets} />
                <Section title="Liabilities" rows={data.liabilities} total={data.total_liabilities} />
                <Section title="Equity" rows={[...data.equity, { id: -1, code: '', name: 'Current earnings', balance: data.current_earnings }]} total={data.total_equity} />
                <Line label="Liabilities + equity" value={data.total_liabilities + data.total_equity} strong />
              </>
            )}
            {tab === 'trial-balance' && (
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-gray-500"><tr><th className="py-2">Account</th><th className="py-2 text-right">Debit</th><th className="py-2 text-right">Credit</th></tr></thead>
                <tbody className="divide-y">
                  {data.accounts.map((a: AcctRow) => (
                    <tr key={a.id}><td className="py-1.5">{a.code} · {a.name}</td>
                      <td className="py-1.5 text-right">{a.debit_balance ? money(a.debit_balance) : ''}</td>
                      <td className="py-1.5 text-right">{a.credit_balance ? money(a.credit_balance) : ''}</td></tr>
                  ))}
                  <tr className="font-semibold"><td className="py-2">Total</td><td className="py-2 text-right">{money(data.total_debit)}</td><td className="py-2 text-right">{money(data.total_credit)}</td></tr>
                </tbody>
              </table>
            )}
            {tab === 'sales' && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Orders" value={data.totals.orders} />
                  <Stat label="Net sales" value={money(data.totals.net)} />
                  <Stat label="Returns" value={money(data.totals.returns)} />
                  <Stat label="Average order" value={money(data.totals.average_order)} />
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">By day</h3>
                  <table className="w-full text-sm">
                    <thead className="border-b text-left text-xs uppercase text-gray-500"><tr><th className="py-2">Date</th><th className="py-2 text-right">Orders</th><th className="py-2 text-right">Tax</th><th className="py-2 text-right">Returns</th><th className="py-2 text-right">Net</th></tr></thead>
                    <tbody className="divide-y">{data.daily.map((d: any) => (
                      <tr key={d.date}><td className="py-1.5">{d.date}</td><td className="py-1.5 text-right">{d.orders}</td><td className="py-1.5 text-right">{money(d.tax)}</td><td className="py-1.5 text-right">{money(d.returns)}</td><td className="py-1.5 text-right">{money(d.net)}</td></tr>
                    ))}</tbody>
                  </table>
                  {data.daily.length === 0 && <p className="py-4 text-sm text-gray-400">No sales in this period.</p>}
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-2 font-semibold">Top products</h3>
                    {data.top_products.map((p: any) => (
                      <div key={p.product_id} className="flex justify-between text-sm"><span>{p.name} × {p.quantity}</span><span>{money(p.revenue)}</span></div>
                    ))}
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold">Collections by method</h3>
                    {data.payments.map((p: any) => (
                      <div key={p.method} className="flex justify-between text-sm capitalize"><span>{p.method}</span><span>{money(p.amount)}</span></div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {tab === 'inventory' && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Cost value" value={money(data.total_cost_value)} />
                  <Stat label="Retail value" value={money(data.total_retail_value)} />
                  <Stat label="Low stock items" value={data.low_stock} />
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs uppercase text-gray-500"><tr><th className="py-2">Category</th><th className="py-2 text-right">Products</th><th className="py-2 text-right">Units</th><th className="py-2 text-right">Cost value</th><th className="py-2 text-right">Retail value</th></tr></thead>
                  <tbody className="divide-y">{data.by_category.map((c: any) => (
                    <tr key={c.category}><td className="py-1.5">{c.category}</td><td className="py-1.5 text-right">{c.products}</td><td className="py-1.5 text-right">{c.quantity}</td><td className="py-1.5 text-right">{money(c.cost_value)}</td><td className="py-1.5 text-right">{money(c.retail_value)}</td></tr>
                  ))}</tbody>
                </table>
              </>
            )}
            {tab === 'expenses' && (
              <>
                {data.by_account.map((e: any) => (
                  <div key={e.code} className="flex justify-between text-sm"><span>{e.code} · {e.account} ({e.count})</span><span>{money(e.amount)}</span></div>
                ))}
                {data.by_account.length === 0 && <p className="text-sm text-gray-400">No approved expenses in this period.</p>}
                <Line label="Total expenses" value={data.total} strong />
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
