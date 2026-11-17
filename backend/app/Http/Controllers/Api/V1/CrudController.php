<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Generic business-scoped CRUD. Subclasses declare the model, validation
 * rules and searchable columns; models use the BusinessScoped trait.
 */
abstract class CrudController extends Controller
{
    /** @var class-string<Model> */
    protected string $model;
    protected string $module;
    protected array $searchable = ['name'];
    protected array $with = [];
    protected array $filters = [];
    protected string $orderBy = 'name';
    protected string $orderDir = 'asc';

    public function __construct(protected AuditService $audit) {}

    abstract protected function rules(Request $request, ?Model $record = null): array;

    protected function query(Request $request): Builder
    {
        return $this->model::query()->with($this->with);
    }

    protected function present(Model $record): array
    {
        return $record->toArray();
    }

    /** Hook to adjust validated data before save. */
    protected function prepare(array $data, Request $request, ?Model $record = null): array
    {
        return $data;
    }

    protected function afterSave(Model $record, array $data, Request $request): void {}

    protected function beforeDelete(Model $record): ?string
    {
        return null;
    }

    public function index(Request $request): JsonResponse
    {
        $query = $this->query($request);

        if ($term = $request->query('search')) {
            $term = '%' . strtolower($term) . '%';
            $query->where(function ($q) use ($term) {
                foreach ($this->searchable as $col) {
                    $q->orWhereRaw("LOWER({$col}) LIKE ?", [$term]);
                }
            });
        }

        foreach ($this->filters as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }

        if ($request->boolean('all')) {
            $items = $query->orderBy($this->orderBy, $this->orderDir)->limit(1000)->get();
            return response()->json(['success' => true, 'data' => $items->map(fn ($r) => $this->present($r))->values()]);
        }

        $page = $query->orderBy($this->orderBy, $this->orderDir)
            ->paginate(min((int) $request->query('per_page', 15), 100));

        return response()->json([
            'success' => true,
            'data'    => collect($page->items())->map(fn ($r) => $this->present($r))->values(),
            'meta'    => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'per_page'     => $page->perPage(),
                'total'        => $page->total(),
            ],
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->present($this->find($request, $id))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data   = $this->prepare($request->validate($this->rules($request)), $request);
        $record = DB::transaction(function () use ($data, $request) {
            $record = $this->model::create($data);
            $this->afterSave($record, $data, $request);
            return $record;
        });
        $this->audit->record('create', $this->module, $record->getKey(), null, $data);

        return response()->json([
            'success' => true,
            'message' => 'Created successfully.',
            'data'    => $this->present($this->query($request)->findOrFail($record->getKey())),
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $record = $this->find($request, $id);
        $old    = $record->toArray();
        $data   = $this->prepare($request->validate($this->rules($request, $record)), $request, $record);
        DB::transaction(function () use ($record, $data, $request) {
            $record->update($data);
            $this->afterSave($record, $data, $request);
        });
        $this->audit->record('update', $this->module, $record->getKey(), $old, $data);

        return response()->json([
            'success' => true,
            'message' => 'Updated successfully.',
            'data'    => $this->present($this->query($request)->findOrFail($record->getKey())),
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $record = $this->find($request, $id);

        if ($reason = $this->beforeDelete($record)) {
            return response()->json(['success' => false, 'message' => $reason], 422);
        }

        $this->audit->record('delete', $this->module, $record->getKey(), $record->toArray(), null);
        $record->delete();

        return response()->json(['success' => true, 'message' => 'Deleted successfully.']);
    }

    /** exists-rule restricted to the current business. */
    protected function inBusiness(string $table, string $column = 'id'): \Illuminate\Validation\Rules\Exists
    {
        return \Illuminate\Validation\Rule::exists($table, $column)->where('business_id', app('current_business')->id);
    }

    /** unique-rule restricted to the current business. */
    protected function uniqueInBusiness(string $table, string $column, ?Model $ignore = null): \Illuminate\Validation\Rules\Unique
    {
        $rule = \Illuminate\Validation\Rule::unique($table, $column)->where('business_id', app('current_business')->id);
        return $ignore ? $rule->ignore($ignore->getKey()) : $rule;
    }

    protected function find(Request $request, string $id): Model
    {
        return $this->query($request)->findOrFail($id);
    }
}
