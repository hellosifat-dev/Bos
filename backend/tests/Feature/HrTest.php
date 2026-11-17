<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesBusiness;
use Tests\TestCase;

class HrTest extends TestCase
{
    use RefreshDatabase, CreatesBusiness;

    public function test_hr_and_payroll_flow(): void
    {
        $this->seed(DatabaseSeeder::class);
        $h = $this->ownerWithBusiness();

        $dept  = $this->postJson('/api/v1/departments', ['name' => 'Sales'], $h)->assertCreated()->json('data.id');
        $desig = $this->postJson('/api/v1/designations', ['name' => 'Associate', 'department_id' => $dept], $h)->assertCreated()->json('data.id');

        $emp = $this->postJson('/api/v1/employees', [
            'name' => 'Rahim', 'employee_code' => 'E001', 'join_date' => '2026-01-01',
            'department_id' => $dept, 'designation_id' => $desig,
            'basic_salary' => 2200, 'allowances' => 300, 'deductions' => 50,
        ], $h)->assertCreated()->json('data.id');
        $this->postJson('/api/v1/employees', ['name' => 'Dup', 'employee_code' => 'E001', 'join_date' => '2026-01-01'], $h)->assertStatus(422);
        $late = $this->postJson('/api/v1/employees', ['name' => 'Joins later', 'employee_code' => 'E002', 'join_date' => '2026-05-01', 'basic_salary' => 1000], $h)
            ->assertCreated()->json('data.id');
        $this->deleteJson("/api/v1/departments/{$dept}", [], $h)->assertStatus(422);

        // Attendance (March 2026: 22 working days with a Sat/Sun weekend)
        $this->postJson('/api/v1/attendance', ['date' => '2026-03-02', 'records' => [['employee_id' => $emp, 'status' => 'absent']]], $h)->assertOk();
        $this->postJson('/api/v1/attendance', ['date' => '2026-03-03', 'records' => [['employee_id' => $emp, 'status' => 'absent']]], $h)->assertOk();
        $this->postJson('/api/v1/attendance', ['date' => '2026-03-04', 'records' => [['employee_id' => $emp, 'status' => 'half_day']]], $h)->assertOk();
        $this->postJson('/api/v1/attendance', ['date' => '2026-03-05', 'records' => [['employee_id' => $emp, 'status' => 'present', 'check_in' => '09:00']]], $h)->assertOk();
        $this->postJson('/api/v1/attendance', ['date' => '2026-03-05', 'records' => [['employee_id' => $emp, 'status' => 'present', 'check_in' => '09:00']]], $h)->assertOk(); // idempotent
        $this->postJson('/api/v1/attendance', ['date' => '2099-01-01', 'records' => [['employee_id' => $emp, 'status' => 'present']]], $h)->assertStatus(422);

        $sheet = $this->getJson('/api/v1/attendance?date=2026-03-05', $h)->assertOk();
        $this->assertCount(1, $sheet->json('data')); // the later joiner isn't on the sheet yet
        $this->assertSame('present', $sheet->json('data.0.status'));
        $this->assertSame('09:00', $sheet->json('data.0.check_in'));

        // Leave: Mon 9 – Tue 10 March, unpaid
        $leave = $this->postJson('/api/v1/leave-requests', [
            'employee_id' => $emp, 'type' => 'unpaid', 'start_date' => '2026-03-07', 'end_date' => '2026-03-10',
        ], $h)->assertCreated();
        $this->assertEquals(2, (float) $leave->json('data.days')); // weekend skipped
        $this->postJson('/api/v1/leave-requests', [
            'employee_id' => $emp, 'type' => 'sick', 'start_date' => '2026-03-10', 'end_date' => '2026-03-11',
        ], $h)->assertStatus(422); // overlaps
        $this->postJson('/api/v1/leave-requests/' . $leave->json('data.id') . '/approve', [], $h)->assertOk();
        $this->postJson('/api/v1/leave-requests/' . $leave->json('data.id') . '/reject', [], $h)->assertStatus(422);
        $this->getJson('/api/v1/attendance?date=2026-03-09', $h)->assertJsonPath('data.0.status', 'leave');

        $summary = $this->getJson('/api/v1/attendance/summary?month=2026-03', $h)->assertOk();
        $row = collect($summary->json('data'))->firstWhere('employee_id', $emp);
        $this->assertSame(2, $row['absent']);
        $this->assertSame(2, $row['leave']);

        // Payroll
        $run = $this->postJson('/api/v1/payroll', ['period' => '2026-03'], $h)->assertCreated();
        $runId = $run->json('data.id');
        $this->assertSame(22, $run->json('data.working_days'));
        $this->assertSame(1, $run->json('data.payslips_count'));
        $this->postJson('/api/v1/payroll', ['period' => '2026-03'], $h)->assertStatus(422);

        $detail = $this->getJson("/api/v1/payroll/{$runId}", $h)->assertOk();
        $slip = $detail->json('data.payslips.0');
        // 100/day * (2 absent + 0.5 half day + 2 unpaid leave) = 450
        $this->assertEquals(450, (float) $slip['absence_deduction']);
        $this->assertEquals(2500, (float) $slip['gross']);
        $this->assertEquals(2000, (float) $slip['net']);

        $this->putJson("/api/v1/payroll/{$runId}/payslips/{$slip['id']}", ['bonus' => 100], $h)->assertOk()->assertJsonPath('data.net', '2100.00');
        $this->getJson("/api/v1/payroll/{$runId}", $h)->assertJsonPath('data.total_net', '2100.00');

        $this->postJson("/api/v1/payroll/{$runId}/pay", [], $h)->assertStatus(422);
        $this->postJson("/api/v1/payroll/{$runId}/approve", [], $h)->assertOk();
        $this->putJson("/api/v1/payroll/{$runId}/payslips/{$slip['id']}", ['bonus' => 1], $h)->assertStatus(422);
        $this->deleteJson("/api/v1/payroll/{$runId}", [], $h)->assertStatus(422);
        $this->postJson("/api/v1/payroll/{$runId}/pay", [], $h)->assertOk()->assertJsonPath('data.status', 'paid');

        $this->deleteJson("/api/v1/employees/{$emp}", [], $h)->assertStatus(422);
        $this->deleteJson("/api/v1/employees/{$late}", [], $h)->assertOk();
    }
}
