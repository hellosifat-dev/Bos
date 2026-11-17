import { Badge } from '@/components/ui/Badge'
import { ResourcePage } from '@/components/resource/ResourcePage'
import { money } from '@/utils/format'

interface Row {
  id: number; name: string; email?: string; phone?: string; status: string
  orders_count?: number; total_spent?: string | null; balance_due?: number
}

export function CustomersPage() {
  return (
    <ResourcePage<Row>
      title="Customers" endpoint="/customers" module="customers" searchPlaceholder="Search name, email or phone…"
      columns={[
        { key: 'name', header: 'Name', cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-gray-500">{r.email ?? ''}</p></div> },
        { key: 'phone', header: 'Phone', cell: (r) => r.phone ?? '—' },
        { key: 'orders_count', header: 'Orders', align: 'right' },
        { key: 'total_spent', header: 'Total spent', align: 'right', cell: (r) => money(r.total_spent ?? 0) },
        { key: 'balance_due', header: 'Balance due', align: 'right', cell: (r) =>
          (r.balance_due ?? 0) > 0 ? <span className="font-medium text-red-600">{money(r.balance_due)}</span> : money(0) },
        { key: 'status', header: 'Status', cell: (r) => <Badge variant={r.status === 'active' ? 'success' : 'default'}>{r.status}</Badge> },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'phone', label: 'Phone' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'tax_number', label: 'Tax number' },
        { name: 'address', label: 'Address' },
        { name: 'status', label: 'Status', type: 'select', defaultValue: 'active',
          options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
    />
  )
}
