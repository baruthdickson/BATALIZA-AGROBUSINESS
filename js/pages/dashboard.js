// ============================================================================
// DASHBOARD - Different views kwa kila role
// ============================================================================
import { supabase } from '../supabase.js';
import { getCurrentProfile, isAccountant, isPM } from '../auth.js';
import { formatTZS, formatNumber, formatDate, escapeHtml, toast } from '../utils.js';

export async function initDashboard() {
  document.getElementById('dashboard-content').innerHTML = '<div class="text-center py-12"><div class="animate-spin inline-block w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full"></div></div>';
  
  if (isAccountant()) {
    await renderAccountantDashboard();
  } else {
    await renderPMDashboard();
  }
}

// ============================================================================
// MUHASIBU DASHBOARD
// ============================================================================
async function renderAccountantDashboard() {
  const profile = getCurrentProfile();
  
  // Load data muhasibu anaitaji
  const [requestsRes, periodsRes] = await Promise.all([
    supabase.from('expense_requests')
      .select('*, plot:plots(name, code), budget_item:budget_items(code, item)')
      .eq('requested_by', profile?.id)
      .order('created_at', { ascending: false }),
    supabase.from('budget_periods').select('id, name, total_planned_budget, total_actual_spent').eq('status', 'active').limit(1)
  ]);
  
  const requests = requestsRes.data || [];
  const activePeriod = periodsRes.data?.[0];
  
  // Categorize requests
  const pending = requests.filter(r => r.status === 'pending');
  const approved = requests.filter(r => r.status === 'approved');
  const rejected = requests.filter(r => r.status === 'rejected');
  
  const totalApproved = approved.reduce((s, r) => s + Number(r.amount), 0);
  const totalPending = pending.reduce((s, r) => s + Number(r.amount), 0);
  
  // This month
  const thisMonth = approved.filter(r => {
    const d = new Date(r.approved_at || r.request_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthTotal = thisMonth.reduce((s, r) => s + Number(r.amount), 0);
  
  document.getElementById('dashboard-content').innerHTML = `
    <!-- Welcome banner -->
    <div class="card mb-4" style="background: linear-gradient(135deg, #14532D 0%, #16A34A 100%); color: white; border: none;">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-sm opacity-75 uppercase tracking-wider">Habari, Muhasibu</div>
          <div class="text-3xl font-bold mt-1">${escapeHtml(profile?.full_name || profile?.first_name || 'Muhasibu')}</div>
          <div class="text-sm opacity-75 mt-1">${new Date().toLocaleDateString('sw-TZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <a href="expense-requests.html" class="bg-white text-green-900 px-6 py-3 rounded-lg font-bold hover:bg-green-50 transition shadow-lg">
          + Tengeneza Ombi Jipya
        </a>
      </div>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
      <div class="stat-card orange">
        <div class="stat-label">Maombi Pending</div>
        <div class="stat-value">${pending.length}</div>
        <div class="stat-sub money">${formatTZS(totalPending)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Yaliyoidhinishwa</div>
        <div class="stat-value">${approved.length}</div>
        <div class="stat-sub money">${formatTZS(totalApproved)}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Mwezi Huu</div>
        <div class="stat-value">${thisMonth.length}</div>
        <div class="stat-sub money">${formatTZS(monthTotal)}</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">Yaliyokataliwa</div>
        <div class="stat-value">${rejected.length}</div>
        <div class="stat-sub">${rejected.length > 0 ? 'Tazama sababu' : 'Hakuna'}</div>
      </div>
    </div>
    
    <!-- Quick Actions -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <a href="expense-requests.html" class="card hover:shadow-lg transition text-center cursor-pointer">
        <div class="text-4xl mb-2">📝</div>
        <div class="font-bold text-green-900">Tengeneza Ombi</div>
        <div class="text-xs text-gray-600 mt-1">Omba pesa kwa shughuli</div>
      </a>
      <a href="receipts.html" class="card hover:shadow-lg transition text-center cursor-pointer">
        <div class="text-4xl mb-2">🧾</div>
        <div class="font-bold text-green-900">Risiti Zangu</div>
        <div class="text-xs text-gray-600 mt-1">Chapisha risiti za PDF</div>
      </a>
      <a href="budget.html" class="card hover:shadow-lg transition text-center cursor-pointer">
        <div class="text-4xl mb-2">📊</div>
        <div class="font-bold text-green-900">Tazama Bajeti</div>
        <div class="text-xs text-gray-600 mt-1">Bajeti iliyopangwa</div>
      </a>
      <a href="expenses.html" class="card hover:shadow-lg transition text-center cursor-pointer">
        <div class="text-4xl mb-2">💰</div>
        <div class="font-bold text-green-900">Matumizi</div>
        <div class="text-xs text-gray-600 mt-1">Orodha ya matumizi</div>
      </a>
    </div>
    
    <!-- Two columns: Pending + Recent Receipts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <!-- Maombi Yangu Pending -->
      <div class="card">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-lg font-bold text-green-900">⏳ Maombi Yangu Yanasubiri</h3>
          <a href="expense-requests.html" class="text-sm text-green-600 hover:underline">Yote →</a>
        </div>
        ${pending.length === 0 ? `
          <div class="text-center text-gray-500 py-6">
            <div class="text-4xl mb-2">✓</div>
            <p>Hakuna maombi yanayosubiri</p>
          </div>
        ` : `
          <div class="space-y-2">
            ${pending.slice(0, 5).map(r => `
              <div class="flex justify-between items-center p-2 bg-yellow-50 rounded">
                <div>
                  <div class="font-medium text-sm">${escapeHtml(r.purpose)}</div>
                  <div class="text-xs text-gray-500">${escapeHtml(r.request_number)} · ${escapeHtml(r.plot?.code || '-')}</div>
                </div>
                <div class="money font-bold text-yellow-700">${formatTZS(r.amount)}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
      
      <!-- Risiti za Hivi Karibuni -->
      <div class="card">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-lg font-bold text-green-900">🧾 Risiti za Hivi Karibuni</h3>
          <a href="receipts.html" class="text-sm text-green-600 hover:underline">Yote →</a>
        </div>
        ${approved.length === 0 ? `
          <div class="text-center text-gray-500 py-6">
            <div class="text-4xl mb-2">📋</div>
            <p>Hakuna risiti bado</p>
          </div>
        ` : `
          <div class="space-y-2">
            ${approved.slice(0, 5).map(r => `
              <div class="flex justify-between items-center p-2 bg-green-50 rounded hover:bg-green-100 cursor-pointer" onclick="window.location.href='receipts.html'">
                <div>
                  <div class="font-mono text-xs font-bold text-green-700">${escapeHtml(r.receipt_number || r.request_number)}</div>
                  <div class="text-sm">${escapeHtml(r.purpose)}</div>
                </div>
                <div class="money font-bold text-green-700">${formatTZS(r.amount)}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
    
    <!-- Rejected requests (if any) -->
    ${rejected.length > 0 ? `
      <div class="card border-l-4 border-red-500">
        <h3 class="text-lg font-bold text-red-900 mb-3">❌ Maombi Yaliyokataliwa</h3>
        <div class="space-y-2">
          ${rejected.slice(0, 3).map(r => `
            <div class="p-3 bg-red-50 rounded">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="font-medium">${escapeHtml(r.purpose)}</div>
                  <div class="text-xs text-gray-500">${escapeHtml(r.request_number)} · ${formatDate(r.request_date)}</div>
                  ${r.rejection_reason ? `<div class="text-sm text-red-700 mt-1"><strong>Sababu:</strong> ${escapeHtml(r.rejection_reason)}</div>` : ''}
                </div>
                <div class="money text-red-700 font-bold">${formatTZS(r.amount)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

// ============================================================================
// PM DASHBOARD (Full overview)
// ============================================================================
async function renderPMDashboard() {
  // Load all data
  const [pendingRes, periodsRes, recentExpRes] = await Promise.all([
    supabase.from('expense_requests')
      .select('*, plot:plots(name, code), budget_item:budget_items(code, item), requester:requested_by(full_name, first_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase.from('budget_periods').select('*').eq('status', 'active').limit(1),
    supabase.from('expenses').select('*, plot:plots(name, code)').order('expense_date', { ascending: false }).limit(8)
  ]);
  
  const pendingRequests = pendingRes.data || [];
  const activePeriod = periodsRes.data?.[0];
  const recentExp = recentExpRes.data || [];
  
  // Load budget details
  let totalPlanned = 0, totalActual = 0;
  let catBreakdown = [];
  
  if (activePeriod) {
    const { data: cats } = await supabase
      .from('budget_categories')
      .select('*, budget_items(item_type, total_planned, total_actual, parent_id)')
      .eq('period_id', activePeriod.id)
      .order('display_order');
    
    (cats || []).forEach(cat => {
      const leaves = (cat.budget_items || []).filter(i => i.item_type === 'leaf');
      const planned = leaves.reduce((s, i) => s + Number(i.total_planned || 0), 0);
      const actual = leaves.reduce((s, i) => s + Number(i.total_actual || 0), 0);
      totalPlanned += planned;
      totalActual += actual;
      catBreakdown.push({ ...cat, planned, actual });
    });
  }
  
  const remaining = totalPlanned - totalActual;
  const pct = totalPlanned > 0 ? (totalActual / totalPlanned * 100) : 0;
  const totalPendingAmount = pendingRequests.reduce((s, r) => s + Number(r.amount), 0);
  
  document.getElementById('dashboard-content').innerHTML = `
    <!-- Bajeti Kuu Banner -->
    <div class="card mb-4" style="background: linear-gradient(135deg, #14532D 0%, #15803D 100%); color: white; border: none;">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-sm opacity-75 uppercase tracking-wider">Bajeti Kuu Iliyopangwa</div>
          <div class="text-3xl font-bold mt-1">${escapeHtml(activePeriod?.name || 'Hakuna Bajeti')}</div>
          <div class="text-sm opacity-75 mt-1">${activePeriod ? `${formatDate(activePeriod.start_date)} - ${formatDate(activePeriod.end_date)}` : ''}</div>
        </div>
        <div class="text-right">
          <div class="text-sm opacity-75">JUMLA YA BAJETI</div>
          <div class="text-4xl font-bold money">${formatTZS(totalPlanned)}</div>
        </div>
      </div>
    </div>
    
    <!-- Pending Approval Alert -->
    ${pendingRequests.length > 0 ? `
      <div class="card mb-4 border-l-4 border-yellow-500" style="background: linear-gradient(90deg, #FEF3C7 0%, #FFFBEB 100%);">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="font-bold text-yellow-900 text-lg">⚠️ Maombi ${pendingRequests.length} Yanasubiri Idhinisho Wako</div>
            <div class="text-sm text-yellow-800">Jumla ya ${formatTZS(totalPendingAmount)} inangoja kuidhinishwa</div>
          </div>
          <a href="expense-requests.html" class="btn btn-primary">Tazama Maombi</a>
        </div>
      </div>
    ` : ''}
    
    <!-- Stat Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
      <div class="stat-card">
        <div class="stat-label">Bajeti Iliyopangwa</div>
        <div class="stat-value money">${formatTZS(totalPlanned)}</div>
        <div class="stat-sub">${catBreakdown.length} sections</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Matumizi Halisi</div>
        <div class="stat-value money">${formatTZS(totalActual)}</div>
        <div class="stat-sub">${pct.toFixed(1)}% ya bajeti</div>
      </div>
      <div class="stat-card ${remaining < 0 ? 'red' : 'orange'}">
        <div class="stat-label">Iliyobaki</div>
        <div class="stat-value money ${remaining < 0 ? 'money-negative' : 'money-positive'}">${formatTZS(remaining)}</div>
        <div class="stat-sub">${remaining < 0 ? '⚠️ Imezidi' : '✓ Salama'}</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-label">Maombi Pending</div>
        <div class="stat-value">${pendingRequests.length}</div>
        <div class="stat-sub money">${formatTZS(totalPendingAmount)}</div>
      </div>
    </div>
    
    <!-- Quick Actions -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <a href="expense-requests.html" class="card hover:shadow-lg transition text-center cursor-pointer ${pendingRequests.length > 0 ? 'border-2 border-yellow-400' : ''}">
        <div class="text-4xl mb-2">📋</div>
        <div class="font-bold text-green-900">Maombi</div>
        <div class="text-xs text-gray-600 mt-1">${pendingRequests.length} pending</div>
      </a>
      <a href="budget.html" class="card hover:shadow-lg transition text-center cursor-pointer">
        <div class="text-4xl mb-2">💵</div>
        <div class="font-bold text-green-900">Bajeti</div>
        <div class="text-xs text-gray-600 mt-1">Manage budgets</div>
      </a>
      <a href="expenses.html" class="card hover:shadow-lg transition text-center cursor-pointer">
        <div class="text-4xl mb-2">💰</div>
        <div class="font-bold text-green-900">Matumizi</div>
        <div class="text-xs text-gray-600 mt-1">View expenses</div>
      </a>
      <a href="reports.html" class="card hover:shadow-lg transition text-center cursor-pointer">
        <div class="text-4xl mb-2">📈</div>
        <div class="font-bold text-green-900">Ripoti</div>
        <div class="text-xs text-gray-600 mt-1">Analytics</div>
      </a>
    </div>
    
    <!-- Two-column: Pending Approvals + Budget Breakdown -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <!-- Pending Approvals -->
      <div class="card">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-lg font-bold text-green-900">⏳ Yanahitaji Idhinisho Wako</h3>
          <a href="expense-requests.html" class="text-sm text-green-600 hover:underline">Yote →</a>
        </div>
        ${pendingRequests.length === 0 ? `
          <div class="text-center text-gray-500 py-6">
            <div class="text-4xl mb-2">✓</div>
            <p>Hakuna maombi yanayohitaji idhinisho</p>
          </div>
        ` : `
          <div class="space-y-2">
            ${pendingRequests.slice(0, 5).map(r => `
              <div class="p-3 bg-yellow-50 rounded hover:bg-yellow-100 cursor-pointer" onclick="window.location.href='expense-requests.html'">
                <div class="flex justify-between items-start mb-1">
                  <div class="font-medium text-sm">${escapeHtml(r.purpose)}</div>
                  <div class="money font-bold text-yellow-700">${formatTZS(r.amount)}</div>
                </div>
                <div class="text-xs text-gray-600">
                  ${escapeHtml(r.requester?.full_name || r.requester?.first_name || '-')} · 
                  ${escapeHtml(r.plot?.code || '-')} · 
                  ${formatDate(r.request_date)}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
      
      <!-- Budget Breakdown -->
      <div class="card">
        <h3 class="text-lg font-bold text-green-900 mb-3">📊 Bajeti vs Matumizi (kwa Section)</h3>
        ${catBreakdown.length === 0 ? '<p class="text-center text-gray-500 py-6">Hakuna bajeti</p>' : `
          <div class="space-y-3">
            ${catBreakdown.map(c => {
              const cp = c.planned > 0 ? (c.actual / c.planned * 100) : 0;
              return `
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <div class="font-medium">${escapeHtml(c.code)} - ${escapeHtml(c.name)}</div>
                    <div class="money text-xs">${formatNumber(c.actual)} / ${formatNumber(c.planned)}</div>
                  </div>
                  <div class="progress progress-tall">
                    <div class="progress-bar ${cp > 90 ? 'danger' : cp > 75 ? 'warning' : ''}" style="width: ${Math.min(cp, 100)}%">${cp.toFixed(0)}%</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>
    
    <!-- Recent Expenses -->
    <div class="card">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-lg font-bold text-green-900">🧾 Matumizi ya Hivi Karibuni</h3>
        <a href="expenses.html" class="text-sm text-green-600 hover:underline">Yote →</a>
      </div>
      ${recentExp.length === 0 ? '<p class="text-center text-gray-500 py-6">Hakuna matumizi bado</p>' : `
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr><th>Tarehe</th><th>Shamba</th><th>Maelezo</th><th class="text-right">Kiasi (TZS)</th></tr></thead>
            <tbody>
              ${recentExp.map(e => `
                <tr>
                  <td class="text-xs whitespace-nowrap">${formatDate(e.expense_date)}</td>
                  <td class="text-xs">${e.plot ? `<span class="badge badge-info">${escapeHtml(e.plot.code)}</span>` : '-'}</td>
                  <td class="text-sm">${escapeHtml(e.description)}</td>
                  <td class="text-right money text-sm">${formatNumber(e.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}
