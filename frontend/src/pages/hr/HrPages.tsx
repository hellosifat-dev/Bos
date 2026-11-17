import { Badge } from '@/components/ui/Badge'
import { ResourcePage, type Field } from '@/components/resource/ResourcePage'
import { formatDate, money } from '@/utils/format'

const statusField: Field = {
  name: 'status', label: 'Status', type: 'select', defaultValue: 'active',
  options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
}

export function DepartmentsPage() {
  return (
    <ResourcePage<{ id: number; name: string; code?: string; status: string; employees_count?: number; branch?: { name: string } }>
      title="Departments" singular="Department" endpoint="/departments" module="employees"
      columns={[
        { key: 'name', header: 'Name' },
        { key: 'code', header: 'Code', cell: (r) => r.code ?? '—' },
        { key: 'branch', header: 'Branch', cell: (r) => r.branch?.name ?? '—' },
        { key: 'employees_count', header: 'Employees', align: 'right' },
        { key: 'status', header: 'Status', cell: (r) => <Badge variant={r.status === 'active' ? 'success' : 'default'}>{r.status}</Badge> },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'code', label: 'Code' },
        { name: 'branch_id', label: 'Branch', type: 'select', optionsFrom: { endpoint: '/branches' }, placeholder: 'All branches' },
        statusField,
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  )
}

export function DesignationsPage() {
  return (
    <ResourcePage<{ id: number; name: string; level: number; status: string; employees_count?: number; department?: { name: string } }>
      title="Designations" endpoint="/designations" module="employees"
      columns={[
        { key: 'name', header: 'Name' },
        { key: 'department', header: 'Department', cell: (r) => r.department?.name ?? '—' },
        { key: 'level', header: 'Level', align: 'right' },
        { key: 'employees_count', header: 'Employees', align: 'right' },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'department_id', label: 'Department', type: 'select', optionsFrom: { endpoint: '/departments' }, placeholder: 'Any' },
        { name: 'level', label: 'Level', type: 'number', defaultValue: 1 },
        statusField,
      ]}
    />
  )
}

interface EmployeeRow {
  id: number; name: string; employee_code: string; email?: string; phone?: string; join_date: string
  employment_type: string; basic_salary: string; status: string
  department?: { name: string }; designation?: { name: string }
}

const statusVariant: Record<string, 'success' | 'default' | 'danger'> = { active: 'success', inactive: 'default', terminated: 'danger' }

export function EmployeesPage() {
  return (
    <ResourcePage<EmployeeRow>
      title="Employees" endpoint="/employees" module="employees" searchPlaceholder="Search name, code, email or phone…"
      columns={[
        { key: 'name', header: 'Employee', cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-gray-500">{r.employee_code}</p></div> },
        { key: 'department', header: 'Department', cell: (r) => r.department?.name ?? '—' },
        { key: 'designation', header: 'Designation', cell: (r) => r.designation?.name ?? '—' },
        { key: 'join_date', header: 'Joined', cell: (r) => formatDate(r.join_date) },
        { key: 'basic_salary', header: 'Basic salary', align: 'right', cell: (r) => money(r.basic_salary) },
        { key: 'status', header: 'Status', cell: (r) => <Badge variant={statusVariant[r.status] ?? 'default'}>{r.status}</Badge> },
      ]}
      fields={[
        { name: 'name', label: 'Full name', required: true },
        { name: 'employee_code', label: 'Employee code', required: true },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone' },
        { name: 'join_date', label: 'Join date', type: 'date', required: true },
        { name: 'employment_type', label: 'Employment type', type: 'select', defaultValue: 'full_time', options: [
          { value: 'full_time', label: 'Full time' }, { value: 'part_time', label: 'Part time' },
          { value: 'contract', label: 'Contract' }, { value: 'intern', label: 'Intern' },
        ] },
        { name: 'branch_id', label: 'Branch', type: 'select', optionsFrom: { endpoint: '/branches' }, placeholder: 'None' },
        { name: 'department_id', label: 'Department', type: 'select', optionsFrom: { endpoint: '/departments' }, placeholder: 'None' },
        { name: 'designation_id', label: 'Designation', type: 'select', optionsFrom: { endpoint: '/designations' }, placeholder: 'None' },
        { name: 'basic_salary', label: 'Basic salary (monthly)', type: 'number', defaultValue: 0 },
        { name: 'allowances', label: 'Fixed allowances', type: 'number', defaultValue: 0 },
        { name: 'deductions', label: 'Fixed deductions', type: 'number', defaultValue: 0 },
        { name: 'bank_account', label: 'Bank account' },
        { name: 'status', label: 'Status', type: 'select', defaultValue: 'active', options: [
          { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'terminated', label: 'Terminated' },
        ] },
        { name: 'terminated_at', label: 'Termination date', type: 'date', hint: 'Required when terminated.' },
      ]}
      toForm={(r) => ({ ...r, join_date: r.join_date?.slice(0, 10) })}
    />
  )
}
