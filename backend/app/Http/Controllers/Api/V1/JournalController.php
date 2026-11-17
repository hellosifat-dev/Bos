<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\JournalEntry;
use App\Services\AccountingService;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class JournalController extends Controller
{
    public function __construct(private AccountingService $accounting, private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $page = JournalEntry::query()
            ->when($request->query('from'), fn ($q, $v) => $q->whereDate('date', '>=', $v))
            ->when($request->query('to'), fn ($q, $v) => $q->whereDate('date', '<=', $v))
            ->when($request->query('search'), function ($q, $v) {
                $t = '%' . strtolower($v) . '%';
                $q->where(fn ($q2) => $q2->whereRaw('LOWER(number) LIKE ?', [$t])->orWhereRaw('LOWER(description) LIKE ?', [$t]));
            })
            ->orderByDesc('date')->orderByDesc('id')
            ->paginate(min((int) $request->query('per_page', 20), 100));

        return response()->json([
            'success' => true,
            'data'    => $page->items(),
            'meta'    => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data'    => JournalEntry::with(['lines.account:id,code,name,type', 'creator:id,first_name,last_name'])->findOrFail($id),
        ]);
    }

    /** Manual journal entry. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'date'               => 'required|date',
            'description'        => 'required|string|max:255',
            'reference'          => 'nullable|string|max:255',
            'lines'              => 'required|array|min:2',
            'lines.*.account_id' => ['required', Rule::exists('accounts', 'id')->where('business_id', app('current_business')->id)],
            'lines.*.debit'      => 'nullable|numeric|min:0',
            'lines.*.credit'     => 'nullable|numeric|min:0',
            'lines.*.description'=> 'nullable|string|max:255',
        ]);

        $entry = $this->accounting->post(
            app('current_business'),
            $data['date'],
            $data['description'],
            array_map(fn ($l) => ['account' => (int) $l['account_id']] + $l, $data['lines']),
            null,
            $data['reference'] ?? null,
        );
        if (!$entry) {
            return response()->json(['success' => false, 'message' => 'Enter at least one non-zero amount.', 'errors' => ['lines' => ['Enter at least one non-zero amount.']]], 422);
        }
        $this->audit->record('create', 'accounting', $entry->id, null, ['number' => $entry->number, 'total' => $entry->total]);

        return response()->json(['success' => true, 'message' => 'Journal entry posted.', 'data' => $entry->load('lines')], 201);
    }
}
