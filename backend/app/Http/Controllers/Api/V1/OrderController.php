<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\AuditService;
use App\Services\SalesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function __construct(protected SalesService $sales, protected AuditService $audit) {}

    protected function exists(string $table): \Illuminate\Validation\Rules\Exists
    {
        return Rule::exists($table, 'id')->where('business_id', app('current_business')->id);
    }

    protected function orderRules(bool $draftUpdate = false): array
    {
        return [
            'customer_id'          => ['nullable', $this->exists('customers')],
            'warehouse_id'         => ['nullable', $this->exists('warehouses')],
            'notes'                => 'nullable|string',
            'discount'             => 'nullable|numeric|min:0',
            'items'                => [$draftUpdate ? 'sometimes' : 'required', 'array', 'min:1'],
            'items.*.product_id'   => ['required', $this->exists('products')],
            'items.*.quantity'     => 'required|numeric|gt:0',
            'items.*.unit_price'   => 'nullable|numeric|min:0',
            'items.*.discount'     => 'nullable|numeric|min:0',
            'complete'             => 'boolean',
            'payments'             => 'array',
            'payments.*.amount'    => 'required|numeric|gt:0',
            'payments.*.method'    => 'required|in:cash,card,bank,mobile,other',
            'payments.*.reference' => 'nullable|string|max:255',
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $page = Order::query()
            ->with(['customer:id,name'])
            ->withCount('items')
            ->when($request->query('status'), fn ($q, $v) => $q->where('status', $v))
            ->when($request->query('payment_status'), fn ($q, $v) => $q->where('payment_status', $v))
            ->when($request->query('channel'), fn ($q, $v) => $q->where('channel', $v))
            ->when($request->query('customer_id'), fn ($q, $v) => $q->where('customer_id', $v))
            ->when($request->query('date_from'), fn ($q, $v) => $q->whereDate('created_at', '>=', $v))
            ->when($request->query('date_to'), fn ($q, $v) => $q->whereDate('created_at', '<=', $v))
            ->when($request->query('search'), fn ($q, $v) => $q->whereRaw('LOWER(number) LIKE ?', ['%' . strtolower($v) . '%']))
            ->orderByDesc('id')
            ->paginate(min((int) $request->query('per_page', 15), 100));

        return response()->json([
            'success' => true,
            'data'    => $page->items(),
            'meta'    => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'per_page'     => $page->perPage(),
                'total'        => $page->total(),
            ],
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $order = Order::with(['items', 'payments.receiver:id,first_name,last_name', 'customer', 'warehouse:id,name', 'creator:id,first_name,last_name', 'business'])
            ->findOrFail($id);

        return response()->json(['success' => true, 'data' => $order]);
    }

    public function store(Request $request): JsonResponse
    {
        $data  = $request->validate($this->orderRules());
        $order = $this->sales->create(app('current_business'), $data + ['channel' => 'manual']);
        $this->audit->record('create', 'orders', $order->id, null, ['number' => $order->number, 'total' => $order->total]);

        return response()->json(['success' => true, 'message' => 'Order created.', 'data' => $order], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $order = $this->sales->updateDraft(Order::findOrFail($id), $request->validate($this->orderRules(true)));
        $this->audit->record('update', 'orders', $order->id, null, ['total' => $order->total]);

        return response()->json(['success' => true, 'message' => 'Order updated.', 'data' => $order]);
    }

    public function complete(string $id): JsonResponse
    {
        $order = $this->sales->complete(Order::findOrFail($id));
        $this->audit->record('complete', 'orders', $order->id);

        return response()->json(['success' => true, 'message' => 'Order completed.', 'data' => $order->fresh(['items', 'payments'])]);
    }

    public function cancel(string $id): JsonResponse
    {
        $order = $this->sales->cancel(Order::findOrFail($id));
        $this->audit->record('cancel', 'orders', $order->id);

        return response()->json(['success' => true, 'message' => 'Order cancelled.', 'data' => $order]);
    }

    public function addPayment(Request $request, string $id): JsonResponse
    {
        $data    = $request->validate([
            'amount'    => 'required|numeric|gt:0',
            'method'    => 'required|in:cash,card,bank,mobile,other',
            'reference' => 'nullable|string|max:255',
        ]);
        $order   = Order::findOrFail($id);
        $payment = $this->sales->addPayment($order, (float) $data['amount'], $data['method'], $data['reference'] ?? null);
        $this->audit->record('payment', 'orders', $order->id, null, $data);

        return response()->json(['success' => true, 'message' => 'Payment recorded.', 'data' => $payment], 201);
    }

    public function returnItems(Request $request, string $id): JsonResponse
    {
        $data  = $request->validate([
            'lines'            => 'array',
            'lines.*.item_id'  => 'required|integer',
            'lines.*.quantity' => 'required|numeric|gt:0',
            'method'           => 'in:cash,card,bank,mobile,other',
        ]);
        $order = $this->sales->returnItems(Order::findOrFail($id), $data['lines'] ?? [], $data['method'] ?? 'cash');
        $this->audit->record('return', 'orders', $order->id, null, $data);

        return response()->json(['success' => true, 'message' => 'Return processed.', 'data' => $order]);
    }
}
