// ============================================================================
// REPORTS - Budget vs Actual + Expenses summaries
// ============================================================================
import { supabase } from '../supabase.js';
import { formatTZS, formatNumber, formatDate, todayISO, toast, exportMenu, escapeHtml } from '../utils.js';

let currentReport = null;
let currentData = [];

export async function initReports() {
  bindEvents();
  // Default report
  selectReport('budget_vs_actual');
}

function bindEvents() {
  document.querySelectorAll('.report-btn').forEach(btn => {
    btn.onclick = () => selectReport(btn.dataset.report);
  });
  document.getElementById('generate-btn')?.addEventListener('click', generate);
  document.getElementById('export-btn')?.addEventListener('click', (e) => {
    if (!currentData.length) { toast('Tengeneza ripoti kwanza', 'warning'); return; }
    exportCurrent(e.currentTarget);
  });
  // Set default dates
  const fromInp = document.getElementById('date-from');
  const toInp = document.getElementById('date-to');
  if (fromInp && !fromInp.value) {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    fromInp.value = d.toISOString().split('T')[0];
  }
  if (toInp && !toInp.value) toInp.value = todayISO();
}

function selectReport(type) {
  currentReport = type;
  document.querySelectorAll('.report-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.report === type);
  });
  document.getElementById('report-title').textContent = REPORT_TITLES[type] || type;
  document.getElementById('date-filters').style.display = ['expenses_by_date', 'expenses_by_plot'].includes(type) ? '' : 'none';
  document.getElementById('report-output').innerHTML = '<div class="text-center text-gray-500 py-12">Bofya "Tengeneza" kuona data</div>';
  currentData = [];
}

const REPORT_TITLES = {
  budget_vs_actual: '📊 Bajeti dhidi ya Matumizi Halisi',
  expenses_by_date: '🧾 Matumizi kwa Tarehe',
  expenses_by_plot: '🏞️ Matumizi kwa Shamba',
  budget_summary: '💵 Muhtasari wa Bajeti'
};

async function generate() {
  if (!currentReport) { toast('Chagua ripoti', 'warning'); return; }
  document.getElementById('report-output').innerHTML = '<div class="text-center py-12"><div class="animate-spin inline-block w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full"></div><div class="mt-2 text-gray-600">Inazalisha ripoti...</div></div>';
  
  try {
    switch (currentReport) {
      case 'budget_vs_actual': await reportBudgetVsActual(); break;
      case 'expenses_by_date': await reportExpensesByDate(); break;
      case 'expenses_by_plot': await reportExpensesByPlot(); break;
      case 'budget_summary': await reportBudgetSummary(); break;
    }
  } catch (e) {
    console.error(e);
    document.getElementById('report-output').innerHTML = `<div class="text-center text-red-600 py-8">Imeshindikana: ${e.message}</div>`;
  }
}

// ============================================================================
// REPORT 1: Budget vs Actual (Hierarchical)
// ============================================================================
async function reportBudgetVsActual() {
  const { data: periods } = await supabase.from('budget_periods').select('id, name').eq('status', 'active').limit(1);
  if (!periods || periods.length === 0) {
    document.getElementById('report-output').innerHTML = '<div class="text-center text-gray-500 py-8">Hakuna bajeti active</div>';
    return;
  }
  
  const { data: cats } = await supabase
    .from('budget_categories')
    .select('*, budget_items(id, code, item, item_type, parent_id, total_planned, total_actual)')
    .eq('period_id', periods[0].id)
    .order('display_order');
  
  if (!cats || cats.length === 0) {
    document.getElementById('report-output').innerHTML = '<div class="text-center text-gray-500 py-8">Hakuna shughuli</div>';
    return;
  }
  
  const rows = [];
  let grandPlanned = 0, grandActual = 0;
  
  cats.forEach(cat => {
    const leaves = (cat.budget_items || []).filter(i => i.item_type === 'leaf');
    const planned = leaves.reduce((s, i) => s + Number(i.total_planned || 0), 0);
    const actual = leaves.reduce((s, i) => s + Number(i.total_actual || 0), 0);
    grandPlanned += planned;
    grandActual += actual;
    rows.push({
      code: cat.code,
      item: cat.name,
      type: 'Section',
      planned, actual,
      variance: planned - actual,
      percent: planned > 0 ? (actual / planned * 100) : 0
    });
    // Items under this category
    const headers = (cat.budget_items || []).filter(i => i.item_type === 'header');
    headers.forEach(h => {
      const children = leaves.filter(l => l.parent_id === h.id);
      const hPlanned = children.reduce((s, c) => s + Number(c.total_planned || 0), 0);
      const hActual = children.reduce((s, c) => s + Number(c.total_actual || 0), 0);
      rows.push({
        code: '  ' + h.code,
        item: '  ' + h.item,
        type: 'Activity',
        planned: hPlanned, actual: hActual,
        variance: hPlanned - hActual,
        percent: hPlanned > 0 ? (hActual / hPlanned * 100) : 0
      });
      children.forEach(c => {
        rows.push({
          code: '    ' + c.code,
          item: '    ' + c.item,
          type: 'Item',
          planned: Number(c.total_planned || 0),
          actual: Number(c.total_actual || 0),
          variance: Number(c.total_planned || 0) - Number(c.total_actual || 0),
          percent: Number(c.total_planned || 0) > 0 ? (Number(c.total_actual || 0) / Number(c.total_planned || 0) * 100) : 0
        });
      });
    });
  });
  
  currentData = rows;
  
  // Render
  const grandVariance = grandPlanned - grandActual;
  const grandPct = grandPlanned > 0 ? (grandActual / grandPlanned * 100) : 0;
  
  document.getElementById('report-output').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
      <div class="stat-card"><div class="stat-label">Bajeti Jumla</div><div class="stat-value money">${formatTZS(grandPlanned)}</div></div>
      <div class="stat-card blue"><div class="stat-label">Imetumika</div><div class="stat-value money">${formatTZS(grandActual)}</div></div>
      <div class="stat-card ${grandVariance < 0 ? 'red' : 'orange'}"><div class="stat-label">Iliyobaki</div><div class="stat-value money ${grandVariance < 0 ? 'money-negative' : 'money-positive'}">${formatTZS(grandVariance)}</div></div>
      <div class="stat-card purple"><div class="stat-label">Progress</div><div class="stat-value">${grandPct.toFixed(1)}%</div><div class="progress mt-2"><div class="progress-bar ${grandPct > 90 ? 'danger' : grandPct > 75 ? 'warning' : ''}" style="width:${Math.min(grandPct, 100)}%"></div></div></div>
    </div>
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr>
          <th>Code</th><th>Kipengele</th><th>Aina</th>
          <th class="text-right">Bajeti</th><th class="text-right">Halisi</th>
          <th class="text-right">Tofauti</th><th class="text-right">%</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr class="${r.type === 'Section' ? 'font-bold bg-green-50' : r.type === 'Activity' ? 'bg-gray-50 font-medium' : ''}">
              <td><code>${escapeHtml(r.code)}</code></td>
              <td>${escapeHtml(r.item)}</td>
              <td><span class="badge badge-default">${r.type}</span></td>
              <td class="text-right money">${formatNumber(r.planned)}</td>
              <td class="text-right money">${formatNumber(r.actual)}</td>
              <td class="text-right money ${r.variance < 0 ? 'money-negative' : 'money-positive'}">${formatNumber(r.variance)}</td>
              <td class="text-right"><span class="${r.percent > 100 ? 'text-red-600 font-bold' : r.percent > 80 ? 'text-yellow-600' : ''}">${r.percent.toFixed(1)}%</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

// ============================================================================
// REPORT 2: Expenses by Date
// ============================================================================
async function reportExpensesByDate() {
  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;
  
  let q = supabase.from('expenses')
    .select('*, budget_item:budget_items(code, item), plot:plots(name, code)')
    .order('expense_date', { ascending: false });
  if (from) q = q.gte('expense_date', from);
  if (to) q = q.lte('expense_date', to);
  
  const { data, error } = await q;
  if (error) throw error;
  currentData = data || [];
  
  const totalApproved = currentData.filter(e => e.status === 'approved').reduce((s, e) => s + Number(e.amount), 0);
  const totalPending = currentData.filter(e => e.status === 'pending').reduce((s, e) => s + Number(e.amount), 0);
  
  document.getElementById('report-output').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <div class="stat-card"><div class="stat-label">Matumizi (${currentData.length})</div><div class="stat-value money">${formatTZS(totalApproved + totalPending)}</div></div>
      <div class="stat-card blue"><div class="stat-label">Yaliyoidhinishwa</div><div class="stat-value money">${formatTZS(totalApproved)}</div></div>
      <div class="stat-card orange"><div class="stat-label">Yanasubiri</div><div class="stat-value money">${formatTZS(totalPending)}</div></div>
    </div>
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Tarehe</th><th>Shamba</th><th>Kipengele</th><th>Maelezo</th><th class="text-right">Kiasi</th><th>Status</th></tr></thead>
        <tbody>
          ${currentData.length === 0 ? '<tr><td colspan="6" class="text-center text-gray-500 py-6">Hakuna matumizi</td></tr>' : currentData.map(e => `
            <tr>
              <td class="text-xs">${formatDate(e.expense_date)}</td>
              <td><span class="badge badge-info">${escapeHtml(e.plot?.code || '-')}</span></td>
              <td class="text-xs">${escapeHtml(e.budget_item?.code || '')} ${escapeHtml(e.budget_item?.item || '')}</td>
              <td>${escapeHtml(e.description)}</td>
              <td class="text-right money">${formatNumber(e.amount)}</td>
              <td><span class="badge badge-${e.status === 'approved' ? 'success' : e.status === 'rejected' ? 'danger' : 'warning'}">${e.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

// ============================================================================
// REPORT 3: Expenses by Plot
// ============================================================================
async function reportExpensesByPlot() {
  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;
  
  let q = supabase.from('expenses').select('*, plot:plots(id, name, code)').eq('status', 'approved');
  if (from) q = q.gte('expense_date', from);
  if (to) q = q.lte('expense_date', to);
  
  const { data, error } = await q;
  if (error) throw error;
  
  // Group by plot
  const grouped = {};
  (data || []).forEach(e => {
    const key = e.plot?.code || 'unknown';
    if (!grouped[key]) grouped[key] = { plot: e.plot, total: 0, count: 0 };
    grouped[key].total += Number(e.amount);
    grouped[key].count++;
  });
  
  currentData = Object.values(grouped).sort((a, b) => b.total - a.total);
  const grandTotal = currentData.reduce((s, g) => s + g.total, 0);
  
  document.getElementById('report-output').innerHTML = `
    <div class="stat-card mb-4"><div class="stat-label">Jumla ya Matumizi</div><div class="stat-value money">${formatTZS(grandTotal)}</div><div class="stat-sub">${data?.length || 0} matumizi kwenye mashamba ${currentData.length}</div></div>
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Shamba</th><th class="text-right">Idadi ya Matumizi</th><th class="text-right">Jumla (TZS)</th><th class="text-right">%</th></tr></thead>
        <tbody>
          ${currentData.length === 0 ? '<tr><td colspan="4" class="text-center text-gray-500 py-6">Hakuna matumizi</td></tr>' : currentData.map(g => `
            <tr>
              <td class="font-medium">${escapeHtml(g.plot?.name || 'Unknown')}</td>
              <td class="text-right">${g.count}</td>
              <td class="text-right money">${formatNumber(g.total)}</td>
              <td class="text-right">${grandTotal > 0 ? ((g.total / grandTotal) * 100).toFixed(1) : 0}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

// ============================================================================
// REPORT 4: Budget Summary
// ============================================================================
async function reportBudgetSummary() {
  const { data: periods } = await supabase.from('budget_periods').select('*').order('start_date', { ascending: false });
  currentData = periods || [];
  
  document.getElementById('report-output').innerHTML = `
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Jina</th><th>Mwaka</th><th>Tarehe</th><th class="text-right">Bajeti</th><th class="text-right">Imetumika</th><th class="text-right">%</th><th>Status</th></tr></thead>
        <tbody>
          ${currentData.length === 0 ? '<tr><td colspan="7" class="text-center text-gray-500 py-6">Hakuna bajeti</td></tr>' : currentData.map(p => {
            const planned = Number(p.total_planned_budget || 0);
            const actual = Number(p.total_actual_spent || 0);
            const pct = planned > 0 ? (actual / planned * 100) : 0;
            return `
              <tr>
                <td class="font-medium">${escapeHtml(p.name)}</td>
                <td>${escapeHtml(p.fiscal_year || '-')}</td>
                <td class="text-xs">${formatDate(p.start_date)} - ${formatDate(p.end_date)}</td>
                <td class="text-right money">${formatNumber(planned)}</td>
                <td class="text-right money">${formatNumber(actual)}</td>
                <td class="text-right"><span class="${pct > 100 ? 'text-red-600 font-bold' : pct > 80 ? 'text-yellow-600' : ''}">${pct.toFixed(1)}%</span></td>
                <td><span class="badge badge-${p.status === 'active' ? 'success' : 'default'}">${p.status}</span></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ============================================================================
// EXPORT
// ============================================================================
function exportCurrent(btnEl) {
  const filename = `ripoti-${currentReport}-${todayISO()}`;
  let cols;
  switch (currentReport) {
    case 'budget_vs_actual':
      cols = [
        { key: 'code', label: 'Code' }, { key: 'item', label: 'Kipengele' }, { key: 'type', label: 'Aina' },
        { key: 'planned', label: 'Bajeti (TZS)', value: r => formatNumber(r.planned) },
        { key: 'actual', label: 'Halisi (TZS)', value: r => formatNumber(r.actual) },
        { key: 'variance', label: 'Tofauti (TZS)', value: r => formatNumber(r.variance) },
        { key: 'percent', label: '%', value: r => r.percent.toFixed(1) + '%' }
      ];
      break;
    case 'expenses_by_date':
      cols = [
        { key: 'expense_date', label: 'Tarehe', value: e => formatDate(e.expense_date) },
        { label: 'Shamba', value: e => e.plot?.name || '' },
        { label: 'Code', value: e => e.budget_item?.code || '' },
        { label: 'Kipengele', value: e => e.budget_item?.item || '' },
        { key: 'description', label: 'Maelezo' },
        { key: 'amount', label: 'Kiasi (TZS)', value: e => formatNumber(e.amount) },
        { key: 'status', label: 'Status' }
      ];
      break;
    case 'expenses_by_plot':
      cols = [
        { label: 'Shamba', value: g => g.plot?.name || '' },
        { key: 'count', label: 'Idadi' },
        { key: 'total', label: 'Jumla (TZS)', value: g => formatNumber(g.total) }
      ];
      break;
    case 'budget_summary':
      cols = [
        { key: 'name', label: 'Jina' }, { key: 'fiscal_year', label: 'Mwaka' },
        { key: 'start_date', label: 'Anza' }, { key: 'end_date', label: 'Mwisho' },
        { key: 'total_planned_budget', label: 'Bajeti', value: p => formatNumber(p.total_planned_budget) },
        { key: 'total_actual_spent', label: 'Halisi', value: p => formatNumber(p.total_actual_spent) },
        { key: 'status', label: 'Status' }
      ];
      break;
  }
  exportMenu(btnEl, currentData, filename, cols, { title: REPORT_TITLES[currentReport], orientation: 'landscape' });
}
