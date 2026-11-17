import { useQuery } from '@tanstack/react-query'
import { Building2, Users, Shield, CheckCircle2, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge }    from '@/components/ui/Badge'
import { Spinner }  from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { apiClient }    from '@/api/client'
import type { AuditLog } from '@/types'

interface Stats { branches: number; users: number; roles: number; setup_progress: number }

function StatTile({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="rounded-lg bg-primary-50 p-2.5 text-primary-600">{icon}</div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { user, currentBusiness, permissions } = useAuthStore()
  const businessId = currentBusiness?.id
  const canSeeAudit = permissions.includes('*') || permissions.includes('audit_logs.view')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', businessId],
    queryFn:  () => apiClient.get<{ data: Stats }>('/dashboard/stats').then((r) => r.data.data),
    enabled:  !!businessId,
  })

  const { data: activity } = useQuery({
    queryKey: ['dashboard-activity', businessId],
    queryFn:  () => apiClient.get<{ data: AuditLog[] }>('/audit-logs', { params: { per_page: 5 } }).then((r) => r.data.data),
    enabled:  !!businessId && canSeeAudit,
  })

  if (!currentBusiness) {
    return (
      <Card>
        <div className="py-10 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Welcome, {user?.name?.split(' ')[0]}!</h1>
          <p className="mt-2 text-sm text-gray-500">Select or create a business to get started.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/app/businesses" className="text-sm font-medium text-primary-600 hover:underline">My businesses</Link>
            <Link to="/app/businesses/new" className="text-sm font-medium text-primary-600 hover:underline">Create a business</Link>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {getGreeting()}, {user?.name?.split(' ')[0]}!
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Here's an overview of {currentBusiness.name}.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Branches"       value={stats?.branches ?? 0} icon={<Building2 className="h-5 w-5" />} />
          <StatTile label="Team members"   value={stats?.users ?? 0}    icon={<Users className="h-5 w-5" />} />
          <StatTile label="Roles"          value={stats?.roles ?? 0}    icon={<Shield className="h-5 w-5" />} />
          <StatTile label="Setup progress" value={`${stats?.setup_progress ?? 0}%`} icon={<CheckCircle2 className="h-5 w-5" />} />
        </div>
      )}

      {canSeeAudit && (
        <Card padding="none">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <CardHeader title="Recent activity" subtitle="Latest actions in this business" />
            <Link to="/app/audit-logs" className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {!activity || activity.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No activity yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activity.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{log.action} {log.module}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{log.user?.name ?? 'System'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="info">{log.module}</Badge>
                    <span className="text-xs text-gray-400">{format(new Date(log.created_at), 'MMM d, HH:mm')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
