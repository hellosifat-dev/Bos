import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Minus, Plus, Printer, Search, Trash2 } from 'lucide-react'
import { apiClient } from '@/api/client'
import { ordersApi, paymentMethods, posApi, type Order, type PosProduct } from '@/api/sales'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { getErrorMessage, money } from '@/utils/format'
import { Invoice } from './OrderDetailPage'

interface CartLine { product: PosProduct; quantity: number; discount: number }

export function PosPage() {
  const qc = useQueryClient()
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [category, setCategory] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [customer, setCustomer] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState('')
  const [method, setMethod] = useState('cash')
  const [tendered, setTendered] = useState('')
  const [receipt, setReceipt] = useState<{ order: Order; change: number } | null>(null)

  useEffect(() => { const t = setTimeout(() => setTerm(search), 250); return () => clearTimeout(t) }, [search])

  const list = <T,>(endpoint: string) => apiClient.get(endpoint, { params: { all: 1 } }).then((r) => r.data.data as T[])
  const { data: categories = [] } = useQuery({ queryKey: ['options', '/categories'], queryFn: () => list<{ id: number; name: string }>('/categories') })
  const { data: warehouses = [] } = useQuery({ queryKey: ['options', '/warehouses'], queryFn: () => list<{ id: number; name: string }>('/warehouses') })
  const { data: customers = [] } = useQuery({ queryKey: ['options', '/customers'], queryFn: () => list<{ id: number; name: string }>('/customers') })

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['pos-products', term, category, warehouse],
    queryFn: () => posApi.products({ search: term || undefined, category_id: category || undefined, warehouse_id: warehouse || undefined }),
  })

  const add = (p: PosProduct) => {
    setCart((c) => {
      const existing = c.find((l) => l.product.id === p.id)
      const qty = (existing?.quantity ?? 0) + 1
      if (p.track_stock && qty > p.available) { toast.error(`Only ${p.available} ${p.name} in stock.`); return c }
      return existing ? c.map((l) => (l.product.id === p.id ? { ...l, quantity: qty } : l)) : [...c, { product: p, quantity: 1, discount: 0 }]
    })
  }
  const setQty = (id: number, qty: number) =>
    setCart((c) => c.flatMap((l) => {
      if (l.product.id !== id) return [l]
      if (qty <= 0) return []
      if (l.product.track_stock && qty > l.product.available) { toast.error('Not enough stock.'); return [l] }
      return [{ ...l, quantity: qty }]
    }))

  const totals = useMemo(() => {
    let sub = 0, tax = 0, disc = 0
    for (const l of cart) {
      const gross = l.quantity * Number(l.product.sell_price)
      const d = Math.min(l.discount, gross)
      sub += gross; disc += d
      tax += Math.round((gross - d) * Number(l.product.tax_rate)) / 100
    }
    const orderDisc = Math.min(Number(discount) || 0, sub - disc + tax)
    return { sub, tax, disc: disc + orderDisc, total: Math.round((sub - disc + tax - orderDisc) * 100) / 100 }
  }, [cart, discount])

  const paid = method === 'cash' ? Math.min(Number(tendered) || totals.total, totals.total) : totals.total
  const change = method === 'cash' && Number(tendered) > totals.total ? Number(tendered) - totals.total : 0

  const checkout = useMutation({
    mutationFn: () => posApi.checkout({
      customer_id: customer ? Number(customer) : null,
      warehouse_id: warehouse ? Number(warehouse) : null,
      discount: Number(discount) || 0,
      items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity, discount: l.discount })),
      payments: paid > 0 ? [{ amount: Math.round(paid * 100) / 100, method }] : [],
      tendered: Number(tendered) || undefined,
    }),
    onSuccess: async (res) => {
      const order = await ordersApi.get(res.data.id)
      setReceipt({ order, change: res.change })
      setCart([]); setDiscount(''); setTendered(''); setCustomer('')
      qc.invalidateQueries({ queryKey: ['pos-products'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, 'Checkout failed.')),
  })

  const onSearchKey = (e: React.KeyboardEvent) => {
    // Barcode scanners type the code then press Enter: add an exact match straight to the cart.
    if (e.key !== 'Enter') return
    const hit = products.find((p) => p.barcode === search || p.sku.toLowerCase() === search.toLowerCase()) ?? (products.length === 1 ? products[0] : undefined)
    if (hit) { add(hit); setSearch('') }
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
      <div className="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white">
        <div className="grid grid-cols-1 gap-2 border-b p-3 sm:grid-cols-3">
          <Input ref={searchRef} autoFocus leftIcon={<Search className="h-4 w-4" />} placeholder="Search or scan barcode…"
                 value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey} />
          <Select value={category} onChange={(e) => setCategory(e.target.value)} placeholder="All categories"
                  options={categories.map((c) => ({ value: String(c.id), label: c.name }))} />
          <Select value={warehouse} onChange={(e) => { setWarehouse(e.target.value); setCart([]) }} placeholder="Default warehouse"
                  options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : products.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No products found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => {
                const out = p.track_stock && p.available <= 0
                return (
                  <button key={p.id} disabled={out} onClick={() => add(p)}
                          className="flex flex-col rounded-lg border border-gray-200 p-3 text-left transition hover:border-primary-400 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
                    <span className="line-clamp-2 text-sm font-medium text-gray-900">{p.name}</span>
                    <span className="text-xs text-gray-400">{p.sku}</span>
                    <span className="mt-auto pt-2 text-sm font-semibold text-primary-700">{money(p.sell_price)}</span>
                    <span className={`text-xs ${out ? 'text-red-500' : 'text-gray-500'}`}>
                      {p.track_stock ? (out ? 'Out of stock' : `${p.available} in stock`) : 'Service'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white">
        <div className="border-b p-3">
          <Select value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in customer"
                  options={customers.map((c) => ({ value: String(c.id), label: c.name }))} />
        </div>
        <div className="min-h-0 flex-1 divide-y overflow-y-auto">
          {cart.length === 0 ? <p className="py-12 text-center text-sm text-gray-400">Cart is empty.</p> : cart.map((l) => (
            <div key={l.product.id} className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.product.name}</p>
                <p className="text-xs text-gray-500">{money(l.product.sell_price)} each</p>
              </div>
              <Button variant="ghost" size="sm" aria-label="Decrease" onClick={() => setQty(l.product.id, l.quantity - 1)}><Minus className="h-3 w-3" /></Button>
              <span className="w-8 text-center text-sm">{l.quantity}</span>
              <Button variant="ghost" size="sm" aria-label="Increase" onClick={() => setQty(l.product.id, l.quantity + 1)}><Plus className="h-3 w-3" /></Button>
              <span className="w-20 text-right text-sm font-medium">{money(l.quantity * Number(l.product.sell_price))}</span>
              <Button variant="ghost" size="sm" aria-label="Remove" onClick={() => setQty(l.product.id, 0)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t p-3 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{money(totals.sub)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{money(totals.tax)}</span></div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500">Discount</span>
            <div className="w-28"><Input type="number" min="0" step="any" aria-label="Order discount" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
          </div>
          <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span>{money(totals.total)}</span></div>
          <div className="grid grid-cols-2 gap-2">
            <Select aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)} options={paymentMethods} />
            {method === 'cash' && <Input type="number" min="0" step="any" placeholder="Cash received" aria-label="Cash received" value={tendered} onChange={(e) => setTendered(e.target.value)} />}
          </div>
          {change > 0 && <p className="text-right text-green-700">Change: {money(change)}</p>}
          {method === 'cash' && Number(tendered) > 0 && Number(tendered) < totals.total && (
            <p className="text-right text-amber-600">Partial payment — {money(totals.total - Number(tendered))} will be due.</p>
          )}
          <Button className="w-full" size="lg" disabled={!cart.length} loading={checkout.isPending} onClick={() => checkout.mutate()}>
            Charge {money(totals.total)}
          </Button>
        </div>
      </div>

      <Modal open={!!receipt} onClose={() => { setReceipt(null); searchRef.current?.focus() }} title="Sale complete" size="lg"
             footer={<div className="flex justify-end gap-2 print:hidden">
               <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print receipt</Button>
               <Button onClick={() => { setReceipt(null); searchRef.current?.focus() }}>New sale</Button>
             </div>}>
        {receipt && (
          <div className="space-y-4">
            {receipt.change > 0 && <p className="rounded-lg bg-green-50 p-3 text-center text-lg font-semibold text-green-700">Change due: {money(receipt.change)}</p>}
            <Invoice order={receipt.order} />
          </div>
        )}
      </Modal>
    </div>
  )
}
