import { Badge } from '@/components/ui/Badge'
import type { OrderStatus, PaymentStatus } from '@/api/sales'

const statusVariant: Record<OrderStatus, 'default' | 'success' | 'danger' | 'warning'> = {
  draft: 'default', completed: 'success', cancelled: 'danger', returned: 'warning',
}
const payVariant: Record<PaymentStatus, 'default' | 'success' | 'danger' | 'warning' | 'info'> = {
  unpaid: 'danger', partial: 'warning', paid: 'success', refunded: 'info',
}

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => <Badge variant={statusVariant[status]}>{status}</Badge>
export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => <Badge variant={payVariant[status]}>{status}</Badge>
