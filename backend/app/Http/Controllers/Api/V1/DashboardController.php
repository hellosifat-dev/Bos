<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\UserRole;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $business = $request->attributes->get('business');
        $canSales = app(PermissionService::class)->userCan($request->user(), 'orders.view', $business->id);
        $sales    = Order::whereIn('status', ['completed', 'returned']);

        $lowStock = Product::where('track_stock', true)->where('status', 'active')
            ->withSum('stocks as qty', 'quantity')->get()
            ->filter(fn ($p) => (float) $p->qty <= (float) $p->reorder_level)->count();

        $data = [
            'branches'       => Branch::where('business_id', $business->id)->count(),
            'roles'          => Role::where('is_system', true)->orWhere('business_id', $business->id)->count(),
            'users'          => UserRole::where('business_id', $business->id)->distinct('user_id')->count('user_id'),
            'setup_progress' => $business->setup_progress,
            'products'       => Product::count(),
            'customers'      => Customer::count(),
            'low_stock'      => $lowStock,
            'sales_today'    => round((float) (clone $sales)->whereDate('completed_at', today())->get()->sum(fn ($o) => $o->netTotal()), 2),
            'orders_today'   => (clone $sales)->whereDate('completed_at', today())->count(),
            'sales_month'    => round((float) (clone $sales)->where('completed_at', '>=', now()->startOfMonth())->get()->sum(fn ($o) => $o->netTotal()), 2),
            'receivables'    => round((float) Order::where('status', 'completed')->get()->sum(fn ($o) => $o->balance_due), 2),
        ];

        // Hide revenue figures from users who cannot see orders.
        if (!$canSales) {
            foreach (['sales_today', 'orders_today', 'sales_month', 'receivables'] as $key) {
                $data[$key] = null;
            }
        }

        return response()->json(['success' => true, 'data' => $data]);
    }
}
