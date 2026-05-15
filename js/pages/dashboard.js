// ============================================================================
// DASHBOARD - Bajeti Kuu + Grafu za Matumizi
// ============================================================================
import { supabase } from '../supabase.js';
import { formatTZS, formatNumber, formatDate, escapeHtml, toast } from '../utils.js';

let activePeriod = null;
let categories = [];
let allItems = [];
let recentExpenses = [];
let plotSpending = [];

export async function initDashboard() {
  document.getElementById('dashboard-content').innerHTML = '<div class="text-center py-12"><div class="animate-spin inline-block w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full"></div></div>';
  
  // Load all data in parallel for speed
  await Promise.all([
    loadActiveBudget(),
    loadRecentExpenses(),
    loadPlotSpending()
  ]);
  
  render();
}

async function loadActiveBudget() {
  // Get active period
  const { data: periods } = await supabase
    .from('budget_periods')
    .select('*')
    .eq('status', 'active')
    .order('start_date', { ascending: false })
    .limit(1);
  
  activePeriod = periods?.[0] || null;
  if (!activePeriod) return;
  
  // Load categories
  const { data: cats } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('period_id', activePeriod.id)
    .order('display_order, code');
  categories = cats || [];
  
  if (categories.length === 0) return;
  
  // Load all items
  const { data: items } = await supabase
    .from('budget_items')
    .select('*')
    .in('category_id', categories.map(c => c.id));
  allItems = items || [];
}

async function loadRecentExpenses() {
  // Try with joins
  let { data, error } = await supabase
    .from('expenses')
    .select('*, plot:plots(name, code), budget_item:budget_items(code, item)')
    .order('expense_date', { ascending: false })
    .limit(10);
  
  // Fallback bila joins
  if (error) {
    const fb = await supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(10);
    data = fb.data || [];
  }
  recentExpenses = data || [];
}

async function loadPlotSpending() {
  let { data, error } = await supabase
    .from('expenses')
    .select('plot_id, amount, plot:plots(name, code)');
  
  if (error) {
    const fb = await supabase.from('expenses').select('plot_id, amount');
    data = fb.data || [];
  }
  
  // Get plot names
  const plotMap = {};
  const { data: plots } = await supabase.from('plots').select('id, name, code');
  (plots || []).forEach(p => plotMap[p.id] = p);
  
  // Group by plot
  const grouped = {};
  (data || []).forEach(e => {
    const plotId = e.plot_id || 'unknown';
    if (!grouped[plotId]) {
      grouped[plotId] = { 
        plot: e.plot || plotMap[plotId] || { name: 'Hakuna Shamba', code: 'N/A' }, 
        total: 0, 
        count: 0 
      };
    }
    grouped[plotId].total += Number(e.amount || 0);
    grouped[plotId].count++;
  });
  
  plotSpending = Object.values(grouped).sort((a, b) => b.total - a.total);
}

function calcItemTotal(item, type = 'planned') {
  const field = type === 'planned' ? 'total_planned' : 'total_actual';
  if (item.item_type !== 'header') return Number(item[field]) || 0;
  return allItems.filter(i => i.parent_id === item.id).reduce((s, c) => s + calcItemTotal(c, type), 0);
}

function render() {
  if (!activePeriod) {
    document.getElementById('dashboard-content').innerHTML = `
      <div class="text-center py-12">
        <div class="text-6xl mb-3">📊</div>
        <h3 class="text-xl font-bold text-green-900 mb-2">Hakuna Bajeti Active</h3>
        <p class="text-gray-600 mb-4">Tengeneza bajeti yako ya kwanza ili kuanza</p>
        <a href="budget.html" class="btn btn-primary inline-flex">+ Tengeneza Bajeti</a>
      </div>`;
    return;
  }
  
  // Calculate totals from items (more accurate than period.total_planned_budget)
  let totalPlanned = 0, totalActual = 0;
  const catBreakdown = [];
  
  categories.forEach(cat => {
    const catItems = allItems.filter(i => i.category_id === cat.id && !i.parent_id);
    const planned = catItems.reduce((s, i) => s + calcItemTotal(i, 'planned'), 0);
    const actual = catItems.reduce((s, i) => s + calcItemTotal(i, 'actual'), 0);
    totalPlanned += planned;
    totalActual += actual;
    catBreakdown.push({ ...cat, planned, actual });
  });
  
  const remaining = totalPlanned - totalActual;
  const pct = totalPlanned > 0 ? (totalActual / totalPlanned * 100) : 0;
  
  // Find max for chart scaling
  const maxCatPlanned = Math.max(...catBreakdown.map(c => c.planned), 1);
  
  document.getElementById('dashboard-content').innerHTML = `
    <!-- Mwanzo: Bajeti Kuu -->
    <div class="card mb-4" style="background: linear-gradient(135deg, #14532D 0%, #15803D 100%); color: white; border: none;">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-sm opacity-75 uppercase tracking-wider">Bajeti Kuu Iliyokuwepo</div>
          <div class="text-3xl font-bold mt-1">${escapeHtml(activePeriod.name)}</div>
          <div class="text-sm opacity-75 mt-1">${formatDate(activePeriod.start_date)} - ${formatDate(activePeriod.end_date)} (${activePeriod.fiscal_year || ''})</div>
        </div>
        <div class="text-right">
          <div class="text-sm opacity-75">JUMLA YA BAJETI</div>
          <div class="text-4xl font-bold money">${formatTZS(totalPlanned)}</div>
        </div>
      </div>
    </div>
    
    <!-- Stat Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
      <div class="stat-card">
        <div class="stat-label">Bajeti Iliyopangwa</div>
        <div class="stat-value money">${formatTZS(totalPlanned)}</div>
        <div class="stat-sub">${categories.length} sections · ${allItems.filter(i => i.item_type === 'leaf').length} vipengele</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Matumizi Halisi</div>
        <div class="stat-value money">${formatTZS(totalActual)}</div>
        <div class="stat-sub">${pct.toFixed(1)}% ya bajeti</div>
      </div>
      <div class="stat-card ${remaining < 0 ? 'red' : 'orange'}">
        <div class="stat-label">Iliyobaki</div>
        <div class="stat-value money ${remaining < 0 ? 'money-negative' : 'money-positive'}">${formatTZS(remaining)}</div>
        <div class="stat-sub">${remaining < 0 ? '⚠️ Imezidi' : '✓ Bado kuna pesa'}</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-label">Progress</div>
        <div class="stat-value">${pct.toFixed(0)}%</div>
        <div class="progress mt-2"><div class="progress-bar ${pct > 90 ? 'danger' : pct > 75 ? 'warning' : ''}" style="width: ${Math.min(pct, 100)}%"></div></div>
      </div>
    </div>
    
    <!-- Warning banner -->
    ${pct >= 100 ? `
      <div class="warning-banner danger mb-4">
        <div class="text-3xl">🚨</div>
        <div class="flex-1">
          <div class="font-bold text-red-900">UMEZIDI BAJETI KUU!</div>
          <div class="text-sm text-red-800">Umetumia ${formatTZS(totalActual - totalPlanned)} zaidi ya bajeti uliyopanga</div>
        </div>
      </div>
    ` : pct >= 80 ? `
      <div class="warning-banner mb-4">
        <div class="text-3xl">⚠️</div>
        <div class="flex-1">
          <div class="font-bold text-yellow-900">Onyo: Umefikia ${pct.toFixed(1)}% ya bajeti</div>
          <div class="text-sm text-yellow-800">Bado una ${formatTZS(remaining)} kabla ya kuzidi bajeti</div>
        </div>
      </div>
    ` : ''}
    
    <!-- Quick Actions -->
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
      <a href="expenses.html" class="btn btn-primary justify-center py-3">+ Ongeza Matumizi</a>
      <a href="budget.html" class="btn btn-secondary justify-center py-3">📊 Tazama Bajeti</a>
      <a href="reports.html" class="btn btn-secondary justify-center py-3">📈 Ripoti</a>
    </div>
    
    <!-- Grafu ya Matumizi kwa Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <div class="card">
        <h3 class="text-lg font-bold text-green-900 mb-4">📊 Bajeti dhidi ya Matumizi (kwa Section)</h3>
        ${renderBarChart(catBreakdown, maxCatPlanned)}
      </div>
      
      <!-- Pie/Donut kwa Mashamba -->
      <div class="card">
        <h3 class="text-lg font-bold text-green-900 mb-4">🏞️ Matumizi kwa Shamba</h3>
        ${renderPlotChart()}
      </div>
    </div>
    
    <!-- Categories detail + Recent Expenses -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card">
        <h3 class="text-lg font-bold text-green-900 mb-3">💵 Bajeti kwa Section</h3>
        <div class="space-y-3">
          ${catBreakdown.map(c => {
            const cp = c.planned > 0 ? (c.actual / c.planned * 100) : 0;
            return `
              <div>
                <div class="flex justify-between text-sm mb-1">
                  <div class="font-medium">${escapeHtml(c.code)} - ${escapeHtml(c.name)}</div>
                  <div class="money font-bold">${formatNumber(c.actual)} / ${formatNumber(c.planned)}</div>
                </div>
                <div class="progress progress-tall">
                  <div class="progress-bar ${cp > 90 ? 'danger' : cp > 75 ? 'warning' : ''}" style="width: ${Math.min(cp, 100)}%">${cp.toFixed(0)}%</div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>
      
      <div class="card">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-lg font-bold text-green-900">🧾 Matumizi ya Hivi Karibuni</h3>
          <a href="expenses.html" class="text-sm text-green-600 hover:underline">Yote →</a>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr><th>Tarehe</th><th>Shamba</th><th>Maelezo</th><th class="text-right">Kiasi (TZS)</th></tr></thead>
            <tbody>
              ${recentExpenses.length === 0 ? `<tr><td colspan="4" class="text-center text-gray-500 py-6">Hakuna matumizi bado<br><a href="expenses.html" class="btn btn-primary mt-3 inline-flex text-xs">+ Ongeza Matumizi</a></td></tr>` :
                recentExpenses.map(e => `
                  <tr>
                    <td class="text-xs whitespace-nowrap">${formatDate(e.expense_date)}</td>
                    <td class="text-xs">${e.plot ? `<span class="badge badge-info">${escapeHtml(e.plot.code || '')}</span>` : '-'}</td>
                    <td class="text-sm">${escapeHtml(e.description)}</td>
                    <td class="text-right money text-sm">${formatNumber(e.amount)}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// CHARTS (Pure SVG, no library needed - super fast!)
// ============================================================================
function renderBarChart(data, max) {
  if (!data || data.length === 0) return '<p class="text-center text-gray-500 py-8">Hakuna data</p>';
  
  const barHeight = 32;
  const gap = 12;
  const labelWidth = 80;
  const padding = 16;
  const chartWidth = 400;
  const totalHeight = data.length * (barHeight + gap) + padding * 2;
  
  return `
    <svg viewBox="0 0 ${chartWidth + labelWidth + padding * 2} ${totalHeight}" style="width: 100%; height: auto;" xmlns="http://www.w3.org/2000/svg">
      ${data.map((d, i) => {
        const y = padding + i * (barHeight + gap);
        const plannedW = (d.planned / max) * chartWidth;
        const actualW = max > 0 ? Math.min((d.actual / max) * chartWidth, plannedW) : 0;
        const pct = d.planned > 0 ? (d.actual / d.planned * 100) : 0;
        const overBudget = d.actual > d.planned;
        const actualColor = pct > 90 ? '#EF4444' : pct > 75 ? '#F59E0B' : '#16A34A';
        return `
          <text x="${padding}" y="${y + barHeight/2 + 5}" font-size="12" font-weight="600" fill="#14532D">${escapeHtml(d.code)}</text>
          <!-- Planned (light bg) -->
          <rect x="${padding + labelWidth}" y="${y}" width="${plannedW}" height="${barHeight}" rx="6" fill="#E5F2E8"/>
          <!-- Actual (colored) -->
          <rect x="${padding + labelWidth}" y="${y}" width="${actualW}" height="${barHeight}" rx="6" fill="${actualColor}">
            <animate attributeName="width" from="0" to="${actualW}" dur="0.8s" begin="${i * 0.1}s" fill="freeze" />
          </rect>
          ${overBudget ? `<rect x="${padding + labelWidth + plannedW - 2}" y="${y}" width="3" height="${barHeight}" fill="#DC2626"/>` : ''}
          <text x="${padding + labelWidth + Math.max(actualW, 60) + 8}" y="${y + barHeight/2 + 5}" font-size="11" font-weight="700" fill="#14532D">${pct.toFixed(0)}%</text>
        `;
      }).join('')}
    </svg>
    <div class="flex gap-4 mt-3 text-xs text-gray-600 justify-center">
      <div class="flex items-center gap-1"><div style="width:12px;height:12px;background:#E5F2E8;border-radius:2px"></div> Iliyopangwa</div>
      <div class="flex items-center gap-1"><div style="width:12px;height:12px;background:#16A34A;border-radius:2px"></div> Imetumika</div>
      <div class="flex items-center gap-1"><div style="width:12px;height:12px;background:#F59E0B;border-radius:2px"></div> >75%</div>
      <div class="flex items-center gap-1"><div style="width:12px;height:12px;background:#EF4444;border-radius:2px"></div> >90%</div>
    </div>`;
}

function renderPlotChart() {
  if (!plotSpending || plotSpending.length === 0) {
    return '<div class="text-center text-gray-500 py-8">Hakuna matumizi bado</div>';
  }
  
  const total = plotSpending.reduce((s, p) => s + p.total, 0);
  const colors = ['#16A34A', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];
  
  // Donut chart
  const radius = 70;
  const innerRadius = 45;
  const centerX = 100, centerY = 100;
  let currentAngle = -90; // Start at top
  
  const slices = plotSpending.map((p, i) => {
    const pct = total > 0 ? (p.total / total) : 0;
    const angle = pct * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    const ix1 = centerX + innerRadius * Math.cos(endRad);
    const iy1 = centerY + innerRadius * Math.sin(endRad);
    const ix2 = centerX + innerRadius * Math.cos(startRad);
    const iy2 = centerY + innerRadius * Math.sin(startRad);
    const largeArc = angle > 180 ? 1 : 0;
    
    if (pct === 0) return '';
    return `<path d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z" fill="${colors[i % colors.length]}"><animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="${i * 0.1}s" fill="freeze" /></path>`;
  }).join('');
  
  return `
    <div class="flex items-center justify-center gap-6 flex-wrap">
      <svg viewBox="0 0 200 200" style="width: 180px; height: 180px;" xmlns="http://www.w3.org/2000/svg">
        ${slices}
        <text x="100" y="95" text-anchor="middle" font-size="11" fill="#6B7280">Jumla</text>
        <text x="100" y="113" text-anchor="middle" font-size="13" font-weight="700" fill="#14532D">${formatTZS(total)}</text>
      </svg>
      <div class="space-y-2">
        ${plotSpending.map((p, i) => `
          <div class="flex items-center gap-2 text-sm">
            <div style="width:14px;height:14px;background:${colors[i % colors.length]};border-radius:3px"></div>
            <div>
              <div class="font-medium">${escapeHtml(p.plot?.name || 'Hakuna')}</div>
              <div class="text-xs text-gray-500">${formatTZS(p.total)} (${total > 0 ? (p.total / total * 100).toFixed(1) : 0}%)</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
}
