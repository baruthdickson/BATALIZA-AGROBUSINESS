// ============================================================================
// REPORTS MODULE
// ============================================================================

import { supabase } from '../supabase.js';
import { formatTZS, formatDate, formatNumber, todayISO, toast, exportToCSV, exportMenu, escapeHtml } from '../utils.js';
import { COLORS } from '../config.js';

let currentReport = null;
let currentData = [];
let currentChart = null;

export async function initReports() {
  document.querySelectorAll('.report-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.report-btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
      });
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');
      currentReport = btn.dataset.report;
    };
  });
  
  document.getElementById('generate-btn').onclick = generate;
  document.getElementById('export-report-btn').onclick = (e) => {
    if (!currentData.length) { toast('Tengeneza ripoti kwanza', 'warning'); return; }
    exportCurrent(e.currentTarget);
  };
}

async function generate() {
  if (!currentReport) { toast('Chagua aina ya ripoti', 'warning'); return; }
  if (currentChart) { currentChart.destroy(); currentChart = null; }
  
  const from = document.getElementById('report-from').value;
  const to = document.getElementById('report-to').value;
  const container = document.getElementById('report-container');
  container.innerHTML = '<div class="text-center py-8 text-gray-500">Inatengeneza...</div>';
  
  switch (currentReport) {
    case 'budget': return await reportBudget(container);
    case 'expenses': return await reportExpenses(container, from, to);
    case 'field': return await reportField(container);
    case 'payroll': return await reportPayroll(container);
  }
}

async function reportBudget(container) {
  const { data } = await supabase
    .from('budget_categories')
    .select(`*, items:budget_items(code, item, total_planned, total_actual)`)
    .order('sort_order');
  
  const flat = [];
  (data || []).forEach(cat => {
    (cat.items || []).forEach(item => {
      flat.push({
        category: cat.name,
        code: item.code,
        item: item.item,
        planned: item.total_planned,
        actual: item.total_actual,
        variance: Number(item.total_planned) - Number(item.total_actual),
        percent: item.total_planned > 0 ? ((item.total_actual / item.total_planned) * 100).toFixed(1) : 0
      });
    });
  });
  currentData = flat;
  
  const totalPlanned = flat.reduce((s, r) => s + Number(r.planned), 0);
  const totalActual = flat.reduce((s, r) => s + Number(r.actual), 0);
  
  container.innerHTML = `
    <h2 class="text-2xl font-bold text-green-900 mb-4">Budget vs Actual</h2>
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="stat-card"><div class="stat-label">Planned</div><div class="stat-value">${formatTZS(totalPlanned)}</div></div>
      <div class="stat-card" style="border-color:#3B82F6"><div class="stat-label">Actual</div><div class="stat-value">${formatTZS(totalActual)}</div></div>
      <div class="stat-card" style="border-color:#F59E0B"><div class="stat-label">Variance</div><div class="stat-value">${formatTZS(totalPlanned - totalActual)}</div></div>
    </div>
    <canvas id="report-chart" height="80"></canvas>
    <div class="overflow-x-auto mt-6">
      <table class="data-table">
        <thead><tr><th>Code</th><th>Item</th><th>Category</th><th class="text-right">Planned</th><th class="text-right">Actual</th><th class="text-right">Variance</th><th class="text-right">%</th></tr></thead>
        <tbody>
          ${flat.map(r => `
            <tr>
              <td class="font-mono text-xs">${r.code}</td>
              <td>${escapeHtml(r.item)}</td>
              <td>${escapeHtml(r.category)}</td>
              <td class="text-right">${formatTZS(r.planned)}</td>
              <td class="text-right">${formatTZS(r.actual)}</td>
              <td class="text-right">${formatTZS(r.variance)}</td>
              <td class="text-right">${r.percent}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  // Chart
  currentChart = new Chart(document.getElementById('report-chart'), {
    type: 'bar',
    data: {
      labels: data.map(c => c.code_prefix),
      datasets: [
        { label: 'Planned', data: data.map(c => c.subtotal_planned), backgroundColor: COLORS.greenLight },
        { label: 'Actual', data: data.map(c => c.subtotal_actual), backgroundColor: COLORS.green }
      ]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { callback: v => 'TZS ' + (v/1000000).toFixed(1) + 'M' } } } }
  });
}

async function reportExpenses(container, from, to) {
  let query = supabase
    .from('expenses')
    .select(`*, budget_item:budget_items(code, item)`)
    .is('deleted_at', null);
  if (from) query = query.gte('expense_date', from);
  if (to) query = query.lte('expense_date', to);
  
  const { data } = await query.order('expense_date', { ascending: false });
  currentData = data || [];
  
  const total = currentData.reduce((s, e) => s + Number(e.amount), 0);
  const byStatus = currentData.reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + Number(e.amount); return acc; }, {});
  
  container.innerHTML = `
    <h2 class="text-2xl font-bold text-green-900 mb-4">Matumizi (${from || 'Zote'} - ${to || 'Sasa'})</h2>
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="stat-card"><div class="stat-label">Jumla</div><div class="stat-value">${formatTZS(total)}</div></div>
      <div class="stat-card" style="border-color:#22C55E"><div class="stat-label">Approved</div><div class="stat-value">${formatTZS(byStatus.approved || 0)}</div></div>
      <div class="stat-card" style="border-color:#F59E0B"><div class="stat-label">Pending</div><div class="stat-value">${formatTZS(byStatus.pending || 0)}</div></div>
      <div class="stat-card" style="border-color:#EF4444"><div class="stat-label">Rejected</div><div class="stat-value">${formatTZS(byStatus.rejected || 0)}</div></div>
    </div>
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Tarehe</th><th>Code</th><th>Maelezo</th><th>Supplier</th><th class="text-right">Kiasi</th><th>Status</th></tr></thead>
        <tbody>
          ${currentData.map(e => `
            <tr>
              <td>${formatDate(e.expense_date)}</td>
              <td class="font-mono text-xs">${e.budget_item?.code || '-'}</td>
              <td>${escapeHtml(e.description)}</td>
              <td>${escapeHtml(e.supplier_name || '-')}</td>
              <td class="text-right font-bold">${formatTZS(e.amount)}</td>
              <td>${e.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function reportField(container) {
  const { data } = await supabase
    .from('field_activities')
    .select(`*, budget_item:budget_items(code, item)`)
    .order('planned_start_date');
  currentData = data || [];
  
  const totalPlanned = currentData.reduce((s, a) => s + Number(a.planned_hectares), 0);
  const totalDone = currentData.reduce((s, a) => s + Number(a.completed_hectares), 0);
  const pct = totalPlanned > 0 ? ((totalDone / totalPlanned) * 100).toFixed(1) : 0;
  
  container.innerHTML = `
    <h2 class="text-2xl font-bold text-green-900 mb-4">Field Progress</h2>
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="stat-card"><div class="stat-label">Hekta Zilizopangwa</div><div class="stat-value">${totalPlanned.toFixed(1)}</div></div>
      <div class="stat-card" style="border-color:#22C55E"><div class="stat-label">Hekta Zilizofanyika</div><div class="stat-value">${totalDone.toFixed(1)}</div></div>
      <div class="stat-card" style="border-color:#3B82F6"><div class="stat-label">Maendeleo</div><div class="stat-value">${pct}%</div></div>
    </div>
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Shughuli</th><th>Code</th><th>Start</th><th>End</th><th class="text-right">Planned ha</th><th class="text-right">Done ha</th><th class="text-right">%</th><th>Status</th></tr></thead>
        <tbody>
          ${currentData.map(a => `
            <tr>
              <td>${escapeHtml(a.name)}</td>
              <td class="text-xs">${a.budget_item?.code || '-'}</td>
              <td>${formatDate(a.planned_start_date)}</td>
              <td>${formatDate(a.planned_end_date)}</td>
              <td class="text-right">${formatNumber(a.planned_hectares)}</td>
              <td class="text-right">${formatNumber(a.completed_hectares)}</td>
              <td class="text-right">${Number(a.progress_percentage).toFixed(1)}%</td>
              <td>${a.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function reportPayroll(container) {
  const { data } = await supabase
    .from('payroll_items')
    .select(`*, employee:employees(first_name, last_name, employee_number), period:payroll_periods(month, year)`)
    .order('created_at', { ascending: false })
    .limit(500);
  currentData = data || [];
  
  const total = currentData.reduce((s, i) => s + Number(i.net_pay), 0);
  
  container.innerHTML = `
    <h2 class="text-2xl font-bold text-green-900 mb-4">Payroll Summary</h2>
    <div class="grid grid-cols-2 gap-4 mb-6">
      <div class="stat-card"><div class="stat-label">Idadi ya Records</div><div class="stat-value">${currentData.length}</div></div>
      <div class="stat-card" style="border-color:#22C55E"><div class="stat-label">Jumla ya Malipo</div><div class="stat-value">${formatTZS(total)}</div></div>
    </div>
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Period</th><th>Mfanyakazi</th><th class="text-right">Basic</th><th class="text-right">Allow</th><th class="text-right">Net</th><th>Status</th></tr></thead>
        <tbody>
          ${currentData.map(i => `
            <tr>
              <td>${i.period?.month}/${i.period?.year}</td>
              <td>${escapeHtml(i.employee?.first_name)} ${escapeHtml(i.employee?.last_name)}</td>
              <td class="text-right">${formatTZS(i.basic_salary)}</td>
              <td class="text-right">${formatTZS(i.allowances)}</td>
              <td class="text-right font-bold">${formatTZS(i.net_pay)}</td>
              <td>${i.payment_status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function exportCurrent(btnEl) {
  if (!currentData.length) { toast('Hakuna data ya ku-export', 'warning'); return; }
  const fname = `${currentReport}-${todayISO()}`;
  
  const titles = {
    budget: 'Ripoti ya Bajeti dhidi ya Matumizi Halisi',
    expenses: 'Ripoti ya Matumizi',
    field: 'Ripoti ya Shughuli za Shamba',
    payroll: 'Ripoti ya Mishahara'
  };
  
  const cols = {
    budget: [
      { key: 'code', label: 'Code' }, { key: 'item', label: 'Item' }, { key: 'category', label: 'Category' },
      { key: 'planned', label: 'Planned (TZS)', value: r => formatNumber(r.planned) },
      { key: 'actual', label: 'Actual (TZS)', value: r => formatNumber(r.actual) },
      { key: 'variance', label: 'Variance (TZS)', value: r => formatNumber(r.variance) },
      { key: 'percent', label: '%', value: r => (r.percent || 0).toFixed(1) }
    ],
    expenses: [
      { key: 'expense_date', label: 'Date', value: e => formatDate(e.expense_date) },
      { label: 'Code', value: e => e.budget_item?.code || '' },
      { key: 'description', label: 'Description' },
      { key: 'supplier_name', label: 'Supplier' },
      { key: 'amount', label: 'Amount (TZS)', value: e => formatNumber(e.amount) },
      { key: 'status', label: 'Status' }
    ],
    field: [
      { key: 'name', label: 'Activity' },
      { label: 'Code', value: a => a.budget_item?.code || '' },
      { key: 'planned_hectares', label: 'Planned ha' },
      { key: 'completed_hectares', label: 'Done ha' },
      { key: 'progress_percentage', label: '%', value: a => (a.progress_percentage || 0).toFixed(1) },
      { key: 'status', label: 'Status' }
    ],
    payroll: [
      { label: 'Period', value: i => `${i.period?.month}/${i.period?.year}` },
      { label: 'Employee', value: i => `${i.employee?.first_name} ${i.employee?.last_name}` },
      { key: 'basic_salary', label: 'Basic (TZS)', value: i => formatNumber(i.basic_salary) },
      { key: 'allowances', label: 'Allowance (TZS)', value: i => formatNumber(i.allowances) },
      { key: 'net_pay', label: 'Net (TZS)', value: i => formatNumber(i.net_pay) },
      { key: 'payment_status', label: 'Status' }
    ]
  };
  
  exportMenu(btnEl, currentData, fname, cols[currentReport], {
    title: titles[currentReport],
    subtitle: `Imezalishwa: ${formatDate(new Date())}`,
    orientation: 'landscape'
  });
}
