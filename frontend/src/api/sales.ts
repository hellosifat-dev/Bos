import apiClient from './client'

export interface Customer { id: number; name: string; email?: string; phone?: string; address?: string; tax_number?: string; status: string }

export interface OrderItem {
  id: number; product_id: number; name: string; sku?: string
  quantity: string; returned_quantity: string; unit_price: string; discount: string
  tax_rate: string; tax_amount: string; line_total: string
}

export interface Payment {
  id: number; type: 'payment' | 'refund'; amount: string; method: string; reference?: string; paid_at: string
  receiver?: { first_name: string; last_name: string }
}

export type OrderStatus = 'draft' | 'completed' | 'cancelled' | 'returned'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'

export interface Order {
  id: number; number: string; channel: 'pos' | 'manual'; status: OrderStatus; payment_status: PaymentStatus
  subtotal: string; discount_total: string; tax_total: string; total: string
  paid_total: string; refunded_total: string; returned_total: string; balance_due: number
  notes?: string; created_at: string; completed_at?: string
  customer?: Customer | null; items?: OrderItem[]; payments?: Payment[]; items_count?: number
  warehouse?: { id: number; name: string }; warehouse_id?: number; customer_id?: number | null
  creator?: { first_name: string; last_name: string }
  business?: { name: string; email?: string; phone?: string; currency: string; address?: Record<string, string> }
}

export interface OrderLineInput { product_id: number; quantity: number; unit_price?: number; discount?: number }
export interface OrderInput {
  customer_id?: number | null; warehouse_id?: number | null; notes?: string; discount?: number
  items: OrderLineInput[]; complete?: boolean
  payments?: Array<{ amount: number; method: string; reference?: string }>
  tendered?: number
}

export interface PosProduct {
  id: number; name: string; sku: string; barcode?: string; sell_price: string; tax_rate: string
  track_stock: boolean; available: number; category?: { name: string }; unit?: { short_name: string }
}

export const ordersApi = {
  get:      (id: string | number) => apiClient.get<{ data: Order }>(`/orders/${id}`).then((r) => r.data.data),
  create:   (data: OrderInput) => apiClient.post<{ data: Order }>('/orders', data).then((r) => r.data.data),
  update:   (id: number, data: Partial<OrderInput>) => apiClient.put<{ data: Order }>(`/orders/${id}`, data).then((r) => r.data.data),
  complete: (id: number) => apiClient.post(`/orders/${id}/complete`),
  cancel:   (id: number) => apiClient.post(`/orders/${id}/cancel`),
  pay:      (id: number, data: { amount: number; method: string; reference?: string }) => apiClient.post(`/orders/${id}/payments`, data),
  return:   (id: number, data: { lines: Array<{ item_id: number; quantity: number }>; method: string }) =>
              apiClient.post(`/orders/${id}/return`, data),
}

export const posApi = {
  products: (params: { search?: string; category_id?: string; warehouse_id?: string }) =>
    apiClient.get<{ data: PosProduct[] }>('/pos/products', { params }).then((r) => r.data.data),
  checkout: (data: OrderInput) =>
    apiClient.post<{ data: Order; change: number }>('/pos/checkout', data).then((r) => r.data),
}

export const paymentMethods = [
  { value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }, { value: 'mobile', label: 'Mobile banking' },
  { value: 'bank', label: 'Bank transfer' }, { value: 'other', label: 'Other' },
]
