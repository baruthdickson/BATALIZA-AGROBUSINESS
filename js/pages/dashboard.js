// ============================================================================
// DASHBOARD - Bajeti + Matumizi tu (focused)
// ============================================================================
import { supabase } from '../supabase.js';
import { formatTZS, formatNumber, formatDate, escapeHtml, toast } from '../utils.js';

let chartBudget = null;

export async function initDashboard() {
  await Promise.all([
    loadOverviewStats(),
    loadBudgetBreakdown(),
    loadRecentExpenses(),
    loadAlerts()
  ]);
}

async function loadOverviewStats() {
  // Active budget
  const { data: periods } = await supabase
    .from('budget_periods')
    .select('id, name, total_planned_budget, total_actual_spent')
    .eq('status', 'active')
    .order('start_date', { ascending: false })
    .limit(1);
  
  const activePeriod = periods?.[0];
  const totalPlanned = Number(activePeriod?.total_planned_budget) || 0;
  const totalActual = Number(activePeriod?.total_actual_spent) || 0;
  const remaining = totalPlanned - totalActual;
  const pct = totalPlanned > 0 ? (totalActual / totalPlanned * 100) : 0;
  
  // Pending expenses
  const { count: pendingCount, data: pendingData } = await supabase
    .from('expenses')
    .select('amount', { count: 'exact' })
    .eq('status', 'pending');
  const pendingTotal = (pendingData || []).reduce((s, e) => s + Number(e.amount), 0);
  
  // This month expenses
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data: monthExp } = await supabase
    .from('expenses')
    .select('amount')
    .eq('status', 'approved')
    .gte('expense_date', monthStart.toISOString().split('T')[0]);
  const monthTotal = (monthExp || []).reduce((s, e) => s + Number(e.amount), 0);
  
  const el = document.getElementById('overview-stats');
  el.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Bajeti ya Mradi</div>
      <div class="stat-value money">${formatTZS(totalPlanned)}</div>
      <div class="stat-sub">${activePeriod?.name || 'Hakuna bajeti'}</div>
    </div>
    <div class="stat-card blue">
      <div class="stat-label">Imetumika</div>
      <div class="stat-value money">${formatTZS(totalActual)}</div>
      <div class="stat-sub">${pct.toFixed(1)}% ya bajeti</div>
    </div>
    <div class="stat-card ${remaining < 0 ? 'red' : 'orange'}">
      <div class="stat-label">Iliyobaki</div>
      <div class="stat-value money ${remaining < 0 ? 'money-negative' : 'money-positive'}">${formatTZS(remaining)}</div>
      <div class="stat-sub">${remaining < 0 ? '⚠️ Imezidi' : '✓ Bado kuna pesa'}</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-label">Mwezi Huu</div>
      <div class="stat-value money">${formatTZS(monthTotal)}</div>
      <div class="stat-sub">${pendingCount || 0} yanasubiri (${formatTZS(pendingTotal)})</div>
    </div>`;
}

async function loadBudgetBreakdown() {
  // Get active period
  const { data: periods } = await supabase
    .from('budget_periods')
    .select('id')
    .eq('status', 'active')
    .limit(1);
  
  if (!periods || periods.length === 0) {
    document.getElementById('budget-breakdown').innerHTML = `
      <div class="text-center text-gray-500 py-8">
        <div class="text-4xl mb-2">📊</div>
        <p>Hakuna bajeti active</p>
        <a href="budget.html" class="btn btn-primary mt-3 inline-flex">+ Tengeneza Bajeti</a>
      </div>`;
    return;
  }
  
  const { data: cats } = await supabase
    .from('budget_categories')
    .select('*, budget_items(item_type, total_planned, total_actual, parent_id)')
    .eq('period_id', periods[0].id)
    .order('display_order');
  
  if (!cats || cats.length === 0) {
    document.getElementById('budget-breakdown').innerHTML = '<p class="text-center text-gray-500 py-8">Hakuna shughuli kwenye bajeti</p>';
    return;
  }
  
  const breakdown = cats.map(cat => {
    // Sum only leaf items (avoid double counting)
    const leaves = (cat.budget_items || []).filter(i => i.item_type === 'leaf');
    const planned = leaves.reduce((s, i) => s + Number(i.total_planned || 0), 0);
    const actual = leaves.reduce((s, i) => s + Number(i.total_actual || 0), 0);
    const pct = planned > 0 ? (actual / planned * 100) : 0;
    return { ...cat, planned, actual, pct, leafCount: leaves.length };
  });
  
  document.getElementById('budget-breakdown').innerHTML = breakdown.map(b => `
    <div class="mb-4">
      <div class="flex justify-between mb-1">
        <div class="font-semibold text-green-900">${escapeHtml(b.code)} - ${escapeHtml(b.name)}</div>
        <div class="text-sm">
          <span class="money font-bold">${formatNumber(b.actual)}</span>
          <span class="text-gray-500">/ ${formatNumber(b.planned)}</span>
        </div>
      </div>
      <div class="progress progress-tall">
        <div class="progress-bar ${b.pct > 90 ? 'danger' : b.pct > 75 ? 'warning' : ''}" style="width: ${Math.min(b.pct, 100)}%">
          <span>${b.pct.toFixed(1)}%</span>
        </div>
      </div>
      <div class="text-xs text-gray-500 mt-1">${b.leafCount} vipengele</div>
    </div>
  `).join('');
}

async function loadRecentExpenses() {
  const { data } = await supabase
    .from('expenses')
    .select('*, plot:plots(name, code), budget_item:budget_items(code, item)')
    .order('created_at', { ascending: false })
    .limit(10);
  
  const tbody = document.getElementById('recent-tbody');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-6">Hakuna matumizi bado</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map(e => {
    const statusBadge = {
      pending: '<span class="badge badge-warning">⏳</span>',
      approved: '<span class="badge badge-success">✓</span>',
      rejected: '<span class="badge badge-danger">✗</span>'
    }[e.status] || '';
    return `
      <tr>
        <td class="text-xs whitespace-nowrap">${formatDate(e.expense_date)}</td>
        <td class="text-xs">${e.plot ? `<span class="badge badge-info">${escapeHtml(e.plot.code)}</span>` : '-'}</td>
        <td class="text-sm">${escapeHtml(e.description)}</td>
        <td class="text-right money text-sm">${formatNumber(e.amount)}</td>
        <td>${statusBadge}</td>
      </tr>`;
  }).join('');
}

async function loadAlerts() {
  // Find budget categories that are >= 80% used
  const { data: periods } = await supabase
    .from('budget_periods').select('id').eq('status', 'active').limit(1);
  if (!periods || periods.length === 0) {
    document.getElementById('alerts-tbody').innerHTML = '<tr><td class="text-center text-gray-500 py-6">Hakuna bajeti active</td></tr>';
    return;
  }
  
  const { data: cats } = await supabase
    .from('budget_categories')
    .select('*, budget_items(item_type, total_planned, total_actual)')
    .eq('period_id', periods[0].id);
  
  const alerts = (cats || []).map(cat => {
    const leaves = (cat.budget_items || []).filter(i => i.item_type === 'leaf');
    const planned = leaves.reduce((s, i) => s + Number(i.total_planned || 0), 0);
    const actual = leaves.reduce((s, i) => s + Number(i.total_actual || 0), 0);
    const pct = planned > 0 ? (actual / planned * 100) : 0;
    return { ...cat, planned, actual, pct };
  }).filter(c => c.pct >= 80).sort((a, b) => b.pct - a.pct);
  
  const tbody = document.getElementById('alerts-tbody');
  if (alerts.length === 0) {
    tbody.innerHTML = '<tr><td class="text-center text-green-700 py-6">✓ Hakuna onyo - bajeti zote ziko salama</td></tr>';
    return;
  }
  
  tbody.innerHTML = alerts.map(a => `
    <tr>
      <td>
        <div class="font-semibold ${a.pct >= 100 ? 'text-red-700' : 'text-yellow-700'}">${a.pct >= 100 ? '🚨' : '⚠️'} ${escapeHtml(a.code)} - ${escapeHtml(a.name)}</div>
        <div class="text-xs text-gray-500">${formatTZS(a.actual)} / ${formatTZS(a.planned)}</div>
      </td>
      <td class="text-right">
        <span class="badge ${a.pct >= 100 ? 'badge-danger' : 'badge-warning'}">${a.pct.toFixed(1)}%</span>
      </td>
    </tr>`).join('');
}
