import { useQuery } from '@tanstack/react-query'
import {
  ShoppingCart, DollarSign, Users, Package,
  TrendingUp, TrendingDown, ArrowRight,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge }    from '@/components/ui/Badge'
import { Button }   from '@/components/ui/Button'
import { Spinner }  from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { apiClient }    from '@/api/client'
import { format }       from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────
interface StatCard { label: string; value: string; change: number; icon: React.ReactNode }
interface RecentOrder {
  id:       string
  order_no: string
  customer: string
  total:    string
  status:   'pending' | 'processing' | 'completed' | 'cancelled'
  created_at: string
}

const statusVariant: Record<string, 'warning' | 'info' | 'success' | 'danger'> = {
  pending:    'warning',
  processing: 'info',
  completed:  'success',
  cancelled:  'danger',
}

// ─── Stat card component ─────────────────────────────────────────────────────
function StatTile({ label, value, change, icon }: StatCard) {
  const up = change >= 0
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="rounded-lg bg-primary-50 p-2.5 text-primary-600">{icon}</div>
      </div>
      <div className="mt-3 flex items-center gap-1">
        {up
          ? <TrendingUp   className="h-4 w-4 text-green-500" />
          : <TrendingDown className="h-4 w-4 text-red-500" />}
        <span className={`text-sm font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
          {up ? '+' : ''}{change}%
        </span>
        <span className="text-xs text-gray-400">vs last month</span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const { user, currentBusiness } = useAuthStore()

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey:  ['dashboard-stats', currentBusiness?.id],
    queryFn:   () => apiClient.get('/dashboard/stats').then((r) => r.data.data),
    enabled:   !!currentBusiness?.id,
    // Graceful fallback while real API doesn't exist yet
    placeholderData: {
      total_orders:   { value: '1,284', change: 12.4 },
      total_revenue:  { value: '$48,320', change: 8.1 },
      total_customers:{ value: '342', change: 5.7 },
      low_stock_items:{ value: '17', change: -3.2 },
    },
  })

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['recent-orders', currentBusiness?.id],
    queryFn:  () => apiClient.get('/orders?per_page=5').then((r) => r.data.data),
    enabled:  !!currentBusiness?.id,
    placeholderData: [],
  })

  const stats = statsData ?? {
    total_orders:    { value: '—', change: 0 },
    total_revenue:   { value: '—', change: 0 },
    total_customers: { value: '—', change: 0 },
    low_stock_items: { value: '—', change: 0 },
  }

  const orders: RecentOrder[] = ordersData ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {getGreeting()}, {user?.name?.split(' ')[0]}!
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Here's what's happening with {currentBusiness?.name ?? 'your business'} today.
        </p>
      </div>

      {/* Stat tiles */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Total Orders"
            value={stats.total_orders.value}
            change={stats.total_orders.change}
            icon={<ShoppingCart className="h-5 w-5" />}
          />
          <StatTile
            label="Revenue"
            value={stats.total_revenue.value}
            change={stats.total_revenue.change}
            icon={<DollarSign className="h-5 w-5" />}
          />
          <StatTile
            label="Customers"
            value={stats.total_customers.value}
            change={stats.total_customers.change}
            icon={<Users className="h-5 w-5" />}
          />
          <StatTile
            label="Low Stock Items"
            value={stats.low_stock_items.value}
            change={stats.low_stock_items.change}
            icon={<Package className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Recent orders */}
      <Card padding="none">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <CardHeader title="Recent Orders" subtitle="Last 5 orders across all branches" />
          <Button variant="ghost" size="sm" iconRight={<ArrowRight className="h-4 w-4" />}>
            View all
          </Button>
        </div>

        {ordersLoading ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No orders yet. Start by creating your first sale.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{order.order_no}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{order.customer}</p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={statusVariant[order.status] ?? 'default'} dot>
                    {order.status}
                  </Badge>
                  <span className="text-sm font-semibold text-gray-900">{order.total}</span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(order.created_at), 'MMM d')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
