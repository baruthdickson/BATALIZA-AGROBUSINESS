// ============================================================================
// DASHBOARD - Main overview page
// ============================================================================

import { supabase } from '../supabase.js';
import { formatTZS, formatDate, formatNumber } from '../utils.js';
import { COLORS } from '../config.js';

export async function initDashboard() {
  await Promise.all([
    loadStats(),
    loadBudgetChart(),
    loadExpensesChart(),
    loadAlerts(),
    loadRecentExpenses()
  ]);
}

// ============================================================================
// STATS CARDS
// ============================================================================
async function loadStats() {
  try {
    // Budget total
    const { data: period } = await supabase
      .from('budget_periods')
      .select('total_planned_budget, total_actual_spent')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (period) {
      const planned = period.total_planned_budget || 0;
      const spent = period.total_actual_spent || 0;
      const percent = planned > 0 ? ((spent / planned) * 100).toFixed(1) : 0;
      
      document.getElementById('stat-total-budget').textContent = formatTZS(planned);
      document.getElementById('stat-spent').textContent = formatTZS(spent);
      document.getElementById('stat-budget-detail').textContent = 'Bajeti iliyokubaliwa';
      document.getElementById('stat-spent-percent').textContent = `${percent}% ya bajeti`;
    }
    
    // Employees count
    const { count: empCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('deleted_at', null);
    document.getElementById('stat-employees').textContent = formatNumber(empCount || 0);
    
    // Hectares completed
    const { data: activities } = await supabase
      .from('field_activities')
      .select('planned_hectares, completed_hectares');
    
    const totalPlanned = (activities || []).reduce((s, a) => s + Number(a.planned_hectares || 0), 0);
    const totalDone = (activities || []).reduce((s, a) => s + Number(a.completed_hectares || 0), 0);
    document.getElementById('stat-hectares').textContent = `${totalDone.toFixed(1)} ha`;
    document.getElementById('stat-hectares-detail').textContent = `kati ya ${totalPlanned.toFixed(0)} ha`;
    
  } catch (e) {
    console.error('Stats error:', e);
  }
}

// ============================================================================
// BUDGET CHART
// ============================================================================
async function loadBudgetChart() {
  const { data: categories } = await supabase
    .from('budget_categories')
    .select('name, code_prefix, subtotal_planned, subtotal_actual')
    .order('sort_order');
  
  if (!categories || categories.length === 0) {
    document.getElementById('budget-chart').parentElement.innerHTML = 
      '<h3 class="text-lg font-bold text-green-900 mb-4">Bajeti vs Matumizi</h3>' +
      '<div class="text-center text-gray-500 py-12">Bado hakuna bajeti</div>';
    return;
  }
  
  const ctx = document.getElementById('budget-chart');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories.map(c => c.code_prefix),
      datasets: [
        {
          label: 'Iliyopangwa',
          data: categories.map(c => c.subtotal_planned),
          backgroundColor: COLORS.greenLight,
          borderColor: COLORS.greenDark,
          borderWidth: 1
        },
        {
          label: 'Imetumika',
          data: categories.map(c => c.subtotal_actual),
          backgroundColor: COLORS.green,
          borderColor: COLORS.greenDarker,
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y: { 
          beginAtZero: true,
          ticks: { callback: v => 'TZS ' + (v/1000000).toFixed(1) + 'M' }
        }
      }
    }
  });
}

// ============================================================================
// EXPENSES CHART (last 8 weeks)
// ============================================================================
async function loadExpensesChart() {
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  
  const { data: expenses } = await supabase
    .from('expenses')
    .select('expense_date, amount')
    .eq('status', 'approved')
    .gte('expense_date', eightWeeksAgo.toISOString().split('T')[0])
    .is('deleted_at', null);
  
  // Group by week
  const weeks = {};
  (expenses || []).forEach(e => {
    const d = new Date(e.expense_date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().split('T')[0];
    weeks[key] = (weeks[key] || 0) + Number(e.amount);
  });
  
  const sortedWeeks = Object.keys(weeks).sort();
  const ctx = document.getElementById('expenses-chart');
  
  if (sortedWeeks.length === 0) {
    ctx.parentElement.innerHTML = 
      '<h3 class="text-lg font-bold text-green-900 mb-4">Matumizi kwa Wiki</h3>' +
      '<div class="text-center text-gray-500 py-12">Bado hakuna matumizi</div>';
    return;
  }
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedWeeks.map(w => formatDate(w)),
      datasets: [{
        label: 'Matumizi',
        data: sortedWeeks.map(w => weeks[w]),
        backgroundColor: COLORS.greenLight,
        borderColor: COLORS.green,
        borderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { 
          beginAtZero: true,
          ticks: { callback: v => 'TZS ' + (v/1000).toFixed(0) + 'K' }
        }
      }
    }
  });
}

// ============================================================================
// ALERTS - Budget items inakaribia kuvunja
// ============================================================================
async function loadAlerts() {
  const { data } = await supabase
    .from('budget_items')
    .select('code, item, total_planned, total_actual')
    .limit(50);
  
  if (!data) return;
  
  const alerts = data
    .map(b => ({
      ...b,
      percent: b.total_planned > 0 ? (b.total_actual / b.total_planned) * 100 : 0
    }))
    .filter(b => b.percent >= 80)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);
  
  const container = document.getElementById('alerts-table');
  if (alerts.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-500 py-8">✓ Hakuna onyo - bajeti zote ziko salama</div>';
    return;
  }
  
  container.innerHTML = alerts.map(a => `
    <div class="border-b border-green-100 py-3 last:border-0">
      <div class="flex justify-between items-center mb-1">
        <span class="font-medium text-green-900 text-sm">${a.code} - ${a.item}</span>
        <span class="text-sm font-bold ${a.percent >= 100 ? 'text-red-600' : 'text-amber-600'}">${a.percent.toFixed(1)}%</span>
      </div>
      <div class="progress">
        <div class="progress-bar ${a.percent >= 100 ? 'danger' : 'warning'}" style="width: ${Math.min(a.percent, 100)}%"></div>
      </div>
      <div class="text-xs text-gray-500 mt-1">${formatTZS(a.total_actual)} / ${formatTZS(a.total_planned)}</div>
    </div>
  `).join('');
}

// ============================================================================
// RECENT EXPENSES
// ============================================================================
async function loadRecentExpenses() {
  const { data } = await supabase
    .from('expenses')
    .select(`id, expense_date, description, amount, status, budget_item:budget_items(code)`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5);
  
  const container = document.getElementById('recent-expenses');
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-500 py-8">Bado hakuna matumizi</div>';
    return;
  }
  
  const statusBadge = (s) => {
    const map = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };
    const labels = { pending: 'Inasubiri', approved: 'Imeidhinishwa', rejected: 'Imekataliwa' };
    return `<span class="badge ${map[s]}">${labels[s]}</span>`;
  };
  
  container.innerHTML = data.map(e => `
    <div class="border-b border-green-100 py-3 last:border-0">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <div class="text-sm font-medium text-green-900">${e.description}</div>
          <div class="text-xs text-gray-500 mt-1">
            ${e.budget_item?.code || ''} • ${formatDate(e.expense_date)}
          </div>
        </div>
        <div class="text-right ml-3">
          <div class="font-bold text-green-900 text-sm">${formatTZS(e.amount)}</div>
          <div class="mt-1">${statusBadge(e.status)}</div>
        </div>
      </div>
    </div>
  `).join('');
}
