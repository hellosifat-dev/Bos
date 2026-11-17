import { Badge } from '@/components/ui/Badge'
import { ResourcePage, type Field } from '@/components/resource/ResourcePage'
import { money } from '@/utils/format'

const statusField: Field = {
  name: 'status', label: 'Status', type: 'select', defaultValue: 'active',
  options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
}
const statusBadge = (s: string) => <Badge variant={s === 'active' ? 'success' : 'default'}>{s}</Badge>

interface Named { id: number; name: string; status?: string; description?: string }

export function CategoriesPage() {
  return (
    <ResourcePage<Named & { parent?: { name: string }; products_count?: number }>
      title="Categories" singular="Category" endpoint="/categories" module="categories"
      columns={[
        { key: 'name', header: 'Name' },
        { key: 'parent', header: 'Parent', cell: (r) => r.parent?.name ?? '—' },
        { key: 'products_count', header: 'Products', align: 'right' },
        { key: 'status', header: 'Status', cell: (r) => statusBadge(r.status ?? 'active') },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'parent_id', label: 'Parent category', type: 'select', optionsFrom: { endpoint: '/categories' }, placeholder: 'None' },
        statusField,
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  )
}

export function BrandsPage() {
  return (
    <ResourcePage<Named>
      title="Brands" endpoint="/brands" module="brands"
      columns={[
        { key: 'name', header: 'Name' },
        { key: 'description', header: 'Description', cell: (r) => r.description ?? '—' },
        { key: 'status', header: 'Status', cell: (r) => statusBadge(r.status ?? 'active') },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        statusField,
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  )
}

export function UnitsPage() {
  return (
    <ResourcePage<{ id: number; name: string; short_name: string }>
      title="Units" endpoint="/units" module="products"
      columns={[{ key: 'name', header: 'Name' }, { key: 'short_name', header: 'Short name' }]}
      fields={[
        { name: 'name', label: 'Name', required: true, placeholder: 'Kilogram' },
        { name: 'short_name', label: 'Short name', required: true, placeholder: 'kg' },
      ]}
    />
  )
}

interface ProductRow {
  id: number; name: string; sku: string; type: string; status: string
  sell_price: string; cost_price: string; stock_quantity: string | null; reorder_level: string; track_stock: boolean
  category?: { name: string }; brand?: { name: string }; unit?: { short_name: string }
}

export function ProductsPage() {
  return (
    <ResourcePage<ProductRow>
      title="Products" endpoint="/products" module="products" searchPlaceholder="Search name, SKU or barcode…"
      columns={[
        { key: 'name', header: 'Product', cell: (r) => (
          <div><p className="font-medium text-gray-900">{r.name}</p><p className="text-xs text-gray-500">{r.sku}</p></div>
        ) },
        { key: 'category', header: 'Category', cell: (r) => r.category?.name ?? '—' },
        { key: 'sell_price', header: 'Price', align: 'right', cell: (r) => money(r.sell_price) },
        { key: 'stock', header: 'Stock', align: 'right', cell: (r) => {
          if (!r.track_stock) return <span className="text-gray-400">—</span>
          const q = Number(r.stock_quantity ?? 0)
          return <span className={q <= Number(r.reorder_level) ? 'font-medium text-red-600' : ''}>{q} {r.unit?.short_name ?? ''}</span>
        } },
        { key: 'status', header: 'Status', cell: (r) => statusBadge(r.status) },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'sku', label: 'SKU', required: true },
        { name: 'barcode', label: 'Barcode' },
        { name: 'type', label: 'Type', type: 'select', defaultValue: 'standard',
          options: [{ value: 'standard', label: 'Stocked item' }, { value: 'service', label: 'Service' }] },
        { name: 'category_id', label: 'Category', type: 'select', optionsFrom: { endpoint: '/categories' }, placeholder: 'None' },
        { name: 'brand_id', label: 'Brand', type: 'select', optionsFrom: { endpoint: '/brands' }, placeholder: 'None' },
        { name: 'unit_id', label: 'Unit', type: 'select', optionsFrom: { endpoint: '/units', label: (u) => `${u.name} (${u.short_name})` }, placeholder: 'None' },
        { name: 'cost_price', label: 'Cost price', type: 'number', defaultValue: 0 },
        { name: 'sell_price', label: 'Selling price', type: 'number', defaultValue: 0 },
        { name: 'tax_rate', label: 'Tax rate (%)', type: 'number', defaultValue: 0 },
        { name: 'reorder_level', label: 'Reorder level', type: 'number', defaultValue: 0 },
        statusField,
        { name: 'opening_stock', label: 'Opening stock', type: 'number', createOnly: true },
        { name: 'warehouse_id', label: 'Into warehouse', type: 'select', createOnly: true,
          optionsFrom: { endpoint: '/warehouses' }, placeholder: 'Default warehouse' },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  )
}

export function WarehousesPage() {
  return (
    <ResourcePage<{ id: number; name: string; code: string; status: string; is_default: boolean; branch?: { name: string }; stock_quantity: string | null }>
      title="Warehouses" endpoint="/warehouses" module="warehouses"
      columns={[
        { key: 'name', header: 'Name', cell: (r) => <span>{r.name} {r.is_default && <Badge variant="info">Default</Badge>}</span> },
        { key: 'code', header: 'Code' },
        { key: 'branch', header: 'Branch', cell: (r) => r.branch?.name ?? '—' },
        { key: 'stock_quantity', header: 'Units in stock', align: 'right', cell: (r) => Number(r.stock_quantity ?? 0) },
        { key: 'status', header: 'Status', cell: (r) => statusBadge(r.status) },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'code', label: 'Code', required: true },
        { name: 'branch_id', label: 'Branch', type: 'select', optionsFrom: { endpoint: '/branches' }, placeholder: 'None' },
        statusField,
        { name: 'address', label: 'Address' },
        { name: 'is_default', label: 'Default warehouse', type: 'checkbox' },
      ]}
    />
  )
}
