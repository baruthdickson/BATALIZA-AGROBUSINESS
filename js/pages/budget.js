// ============================================================================
// BUDGET MODULE - Hierarchical (QuickBooks-style)
// Activities → Sub-categories → Line Items (auto-calculate totals)
// ============================================================================
import { supabase } from '../supabase.js';
import { hasPermission } from '../auth.js';
import { formatTZS, formatNumber, toast, confirm, createModal, exportMenu, escapeHtml, logAction } from '../utils.js';

let periods = [];
let currentPeriod = null;
let categories = [];
let allItems = [];
let expandedNodes = new Set();

export async function initBudget() {
  await loadPeriods();
  bindEvents();
  if (periods.length > 0) {
    currentPeriod = periods[0];
    await loadBudgetTree();
  } else {
    renderEmpty();
  }
}

async function loadPeriods() {
  const { data, error } = await supabase.from('budget_periods').select('*').order('start_date', { ascending: false });
  if (error) { toast('Imeshindikana', 'error'); return; }
  periods = data || [];
  renderPeriodSelector();
}

function renderPeriodSelector() {
  const sel = document.getElementById('period-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Chagua Bajeti --</option>' +
    periods.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${p.fiscal_year || ''})</option>`).join('');
  if (currentPeriod) sel.value = currentPeriod.id;
}

async function loadBudgetTree() {
  if (!currentPeriod) return;
  const { data: cats } = await supabase.from('budget_categories').select('*').eq('period_id', currentPeriod.id).order('display_order, code');
  categories = cats || [];
  const catIds = categories.map(c => c.id);
  if (catIds.length === 0) { allItems = []; renderTree(); renderSummary(); return; }
  const { data: items } = await supabase.from('budget_items').select('*').in('category_id', catIds).order('display_order, code');
  allItems = items || [];
  renderTree();
  renderSummary();
}

function calcItemTotal(item, type = 'planned') {
  const field = type === 'planned' ? 'total_planned' : 'total_actual';
  if (item.item_type !== 'header') return Number(item[field]) || 0;
  return allItems.filter(i => i.parent_id === item.id).reduce((s, c) => s + calcItemTotal(c, type), 0);
}

function renderTree() {
  const container = document.getElementById('budget-tree');
  if (!container) return;
  if (categories.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <div class="text-5xl mb-3">📋</div>
        <p class="mb-3">Hakuna shughuli kwenye bajeti hii.</p>
        ${hasPermission('budget','create') ? '<button onclick="window.addCategory()" class="btn btn-primary">+ Ongeza Shughuli</button>' : ''}
      </div>`;
    return;
  }
  let html = `<table class="data-table"><thead><tr>
    <th style="min-width: 300px;">Kipengele</th>
    <th class="text-right">Bei/Unit</th><th class="text-right">Qty</th><th class="text-right">Miezi</th>
    <th class="text-right">Bajeti (TZS)</th><th class="text-right">Matumizi (TZS)</th>
    <th class="text-right">%</th><th>Hatua</th>
  </tr></thead><tbody>`;
  
  categories.forEach(cat => {
    const catItems = allItems.filter(i => i.category_id === cat.id && !i.parent_id);
    const planned = catItems.reduce((s, i) => s + calcItemTotal(i, 'planned'), 0);
    const actual = catItems.reduce((s, i) => s + calcItemTotal(i, 'actual'), 0);
    const pct = planned > 0 ? (actual / planned * 100) : 0;
    const expanded = expandedNodes.has('cat-' + cat.id);
    html += `
      <tr class="tree-row level-0">
        <td>
          <div class="flex items-center gap-2">
            <span class="tree-toggle" onclick="window.toggleNode('cat-${cat.id}')">${expanded ? '▼' : '▶'}</span>
            <span class="font-bold">📁 ${escapeHtml(cat.code)} — ${escapeHtml(cat.name)}</span>
          </div>
        </td>
        <td></td><td></td><td></td>
        <td class="text-right money money-large">${formatNumber(planned)}</td>
        <td class="text-right money ${actual > planned ? 'money-negative' : 'money-positive'}">${formatNumber(actual)}</td>
        <td class="text-right">
          <div class="flex items-center justify-end gap-2">
            <div class="progress" style="width: 60px;"><div class="progress-bar ${pct > 90 ? 'danger' : pct > 75 ? 'warning' : ''}" style="width: ${Math.min(pct, 100)}%"></div></div>
            <span class="text-xs">${pct.toFixed(0)}%</span>
          </div>
        </td>
        <td>
          ${hasPermission('budget','create') ? `<button class="text-green-600 text-sm" onclick="window.addItem(${cat.id}, null)" title="Ongeza">➕</button>` : ''}
          ${hasPermission('budget','edit') ? `<button class="text-blue-600 text-sm ml-1" onclick="window.editCategory(${cat.id})" title="Hariri">✏️</button>` : ''}
          ${hasPermission('budget','delete') ? `<button class="text-red-600 text-sm ml-1" onclick="window.deleteCategory(${cat.id})" title="Futa">🗑️</button>` : ''}
        </td>
      </tr>`;
    if (expanded) html += renderItemsRecursive(cat.id, null, 1);
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderItemsRecursive(categoryId, parentId, level) {
  const items = allItems.filter(i => i.category_id === categoryId && i.parent_id === parentId);
  let html = '';
  items.forEach(item => {
    const planned = calcItemTotal(item, 'planned');
    const actual = calcItemTotal(item, 'actual');
    const pct = planned > 0 ? (actual / planned * 100) : 0;
    const hasChildren = allItems.some(i => i.parent_id === item.id);
    const expanded = expandedNodes.has('item-' + item.id);
    const indent = level * 24;
    const icon = item.item_type === 'header' ? '📂' : '📄';
    const typeLabel = item.item_type === 'header' ? 'Group' : 'Item';
    
    html += `
      <tr class="tree-row level-${Math.min(level, 3)}">
        <td>
          <div class="flex items-center gap-2" style="padding-left: ${indent}px;">
            ${hasChildren ? `<span class="tree-toggle" onclick="window.toggleNode('item-${item.id}')">${expanded ? '▼' : '▶'}</span>` : '<span style="width: 1.5rem; display: inline-block;"></span>'}
            <span>${icon}</span>
            <span class="${item.item_type === 'header' ? 'font-bold' : ''}">${escapeHtml(item.code || '')} ${escapeHtml(item.item)}</span>
            <span class="badge ${item.item_type === 'header' ? 'badge-info' : 'badge-default'} text-xs">${typeLabel}</span>
          </div>
        </td>
        <td class="text-right money">${item.item_type === 'leaf' ? formatNumber(item.unit_price) : '-'}</td>
        <td class="text-right">${item.item_type === 'leaf' ? formatNumber(item.quantity) : '-'}</td>
        <td class="text-right">${item.item_type === 'leaf' ? (item.months || 1) : '-'}</td>
        <td class="text-right money">${formatNumber(planned)}</td>
        <td class="text-right money ${actual > planned ? 'money-negative' : ''}">${formatNumber(actual)}</td>
        <td class="text-right">
          ${planned > 0 ? `
            <div class="flex items-center justify-end gap-2">
              <div class="progress" style="width: 50px;"><div class="progress-bar ${pct > 90 ? 'danger' : pct > 75 ? 'warning' : ''}" style="width: ${Math.min(pct, 100)}%"></div></div>
              <span class="text-xs">${pct.toFixed(0)}%</span>
            </div>` : '-'}
        </td>
        <td>
          ${hasPermission('budget','create') && item.item_type === 'header' ? `<button class="text-green-600 text-sm" onclick="window.addItem(${categoryId}, ${item.id})" title="Ongeza Child">➕</button>` : ''}
          ${hasPermission('budget','edit') ? `<button class="text-blue-600 text-sm ml-1" onclick="window.editItem(${item.id})" title="Hariri">✏️</button>` : ''}
          ${hasPermission('budget','delete') ? `<button class="text-red-600 text-sm ml-1" onclick="window.deleteItem(${item.id})" title="Futa">🗑️</button>` : ''}
        </td>
      </tr>`;
    if (expanded && hasChildren) html += renderItemsRecursive(categoryId, item.id, level + 1);
  });
  return html;
}

function renderSummary() {
  if (!currentPeriod) return;
  const totalPlanned = categories.reduce((sum, cat) => sum + allItems.filter(i => i.category_id === cat.id && !i.parent_id).reduce((s, i) => s + calcItemTotal(i, 'planned'), 0), 0);
  const totalActual = categories.reduce((sum, cat) => sum + allItems.filter(i => i.category_id === cat.id && !i.parent_id).reduce((s, i) => s + calcItemTotal(i, 'actual'), 0), 0);
  const remaining = totalPlanned - totalActual;
  const pct = totalPlanned > 0 ? (totalActual / totalPlanned * 100) : 0;
  const el = document.getElementById('budget-summary');
  if (!el) return;
  
  // 80% warning banner
  let warningHtml = '';
  if (pct >= 100) {
    warningHtml = `<div class="warning-banner danger mb-4">
      <div class="text-3xl">🚨</div>
      <div class="flex-1">
        <div class="font-bold text-red-900">UMEZIDI BAJETI!</div>
        <div class="text-sm text-red-800">Umetumia ${formatTZS(totalActual - totalPlanned)} zaidi ya bajeti uliyopanga (${pct.toFixed(1)}%)</div>
      </div>
    </div>`;
  } else if (pct >= 80) {
    warningHtml = `<div class="warning-banner mb-4">
      <div class="text-3xl">⚠️</div>
      <div class="flex-1">
        <div class="font-bold text-yellow-900">Onyo: Umetumia ${pct.toFixed(1)}% ya bajeti</div>
        <div class="text-sm text-yellow-800">Bado una ${formatTZS(remaining)} kabla ya kuzidi bajeti. Tahadhari na matumizi yajayo.</div>
      </div>
    </div>`;
  }
  
  el.innerHTML = warningHtml + `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="stat-card"><div class="stat-label">Bajeti Jumla</div><div class="stat-value money">${formatTZS(totalPlanned)}</div><div class="stat-sub">${categories.length} shughuli · ${allItems.filter(i => i.item_type === 'leaf').length} vipengele</div></div>
      <div class="stat-card blue"><div class="stat-label">Matumizi Halisi</div><div class="stat-value money">${formatTZS(totalActual)}</div><div class="stat-sub">${pct.toFixed(1)}% ya bajeti</div></div>
      <div class="stat-card ${remaining < 0 ? 'red' : 'orange'}"><div class="stat-label">Iliyobaki</div><div class="stat-value money ${remaining < 0 ? 'money-negative' : 'money-positive'}">${formatTZS(remaining)}</div><div class="stat-sub">${remaining < 0 ? '⚠️ Imezidi' : '✓ Bado kuna pesa'}</div></div>
      <div class="stat-card purple"><div class="stat-label">Progress</div><div class="stat-value">${pct.toFixed(0)}%</div><div class="progress mt-2"><div class="progress-bar ${pct > 90 ? 'danger' : pct > 75 ? 'warning' : ''}" style="width: ${Math.min(pct, 100)}%"></div></div></div>
    </div>`;
}

function renderEmpty() {
  const c = document.getElementById('budget-tree');
  if (c) c.innerHTML = `
    <div class="text-center py-12">
      <div class="text-6xl mb-3">📊</div>
      <h3 class="text-xl font-bold text-green-900 mb-2">Karibu kwenye Bajeti</h3>
      <p class="text-gray-600 mb-4">Hakuna bajeti bado. Anza kwa kutengeneza bajeti yako ya kwanza.</p>
      ${hasPermission('budget','create') ? '<button onclick="window.addPeriod()" class="btn btn-primary">+ Tengeneza Bajeti Mpya</button>' : ''}
    </div>`;
}

function bindEvents() {
  document.getElementById('period-select')?.addEventListener('change', async (e) => {
    currentPeriod = periods.find(p => p.id == e.target.value) || null;
    if (currentPeriod) await loadBudgetTree();
    else { allItems = []; categories = []; renderTree(); renderSummary(); }
  });
  document.getElementById('add-period-btn')?.addEventListener('click', () => openPeriodModal());
  document.getElementById('add-category-btn')?.addEventListener('click', () => openCategoryModal());
  document.getElementById('expand-all-btn')?.addEventListener('click', () => {
    categories.forEach(c => expandedNodes.add('cat-' + c.id));
    allItems.filter(i => i.item_type === 'header').forEach(i => expandedNodes.add('item-' + i.id));
    renderTree();
  });
  document.getElementById('collapse-all-btn')?.addEventListener('click', () => { expandedNodes.clear(); renderTree(); });
  document.getElementById('export-btn')?.addEventListener('click', (e) => exportBudget(e.currentTarget));
  
  window.toggleNode = (id) => { if (expandedNodes.has(id)) expandedNodes.delete(id); else expandedNodes.add(id); renderTree(); };
  window.addPeriod = () => openPeriodModal();
  window.addCategory = () => openCategoryModal();
  window.editCategory = (id) => openCategoryModal(categories.find(c => c.id === id));
  window.deleteCategory = async (id) => {
    if (!await confirm('Futa shughuli na vipengele vyake vyote?')) return;
    const { error } = await supabase.from('budget_categories').delete().eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    await logAction('delete', 'budget', 'Amefuta shughuli');
    toast('Imefutwa', 'success'); await loadBudgetTree();
  };
  window.addItem = (categoryId, parentId) => openItemModal(null, categoryId, parentId);
  window.editItem = (id) => openItemModal(allItems.find(i => i.id === id));
  window.deleteItem = async (id) => {
    const it = allItems.find(i => i.id === id);
    if (!await confirm(`Futa "${it?.item}"?`)) return;
    const { error } = await supabase.from('budget_items').delete().eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    await logAction('delete', 'budget', `Amefuta: ${it?.item}`);
    toast('Imefutwa', 'success'); await loadBudgetTree();
  };
}

function openPeriodModal(period = null) {
  const html = `<form id="period-form" class="space-y-3">
    <div><label class="form-label">Jina la Bajeti <span class="text-red-500">*</span></label><input type="text" name="name" required class="form-input" value="${period?.name || ''}" placeholder="Bajeti ya Msimu 2025-2026"></div>
    <div><label class="form-label">Mwaka wa Fedha</label><input type="text" name="fiscal_year" class="form-input" value="${period?.fiscal_year || ''}" placeholder="2025-2026"></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Tarehe ya Kuanza</label><input type="date" name="start_date" required class="form-input" value="${period?.start_date || ''}"></div>
      <div><label class="form-label">Tarehe ya Mwisho</label><input type="date" name="end_date" required class="form-input" value="${period?.end_date || ''}"></div>
    </div>
    <div><label class="form-label">Maelezo</label><textarea name="notes" class="form-textarea" rows="2">${period?.notes || ''}</textarea></div>
    <div class="flex justify-end gap-2 pt-2">
      <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
      <button type="submit" class="btn btn-primary">${period ? 'Hifadhi' : 'Tengeneza'}</button>
    </div>
  </form>`;
  const { overlay, close } = createModal(period ? 'Hariri Bajeti' : 'Bajeti Mpya', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#period-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { name: fd.get('name'), fiscal_year: fd.get('fiscal_year') || null, start_date: fd.get('start_date'), end_date: fd.get('end_date'), notes: fd.get('notes') || null };
    let err;
    if (period) ({ error: err } = await supabase.from('budget_periods').update(data).eq('id', period.id));
    else ({ error: err } = await supabase.from('budget_periods').insert(data));
    if (err) { toast(err.message, 'error'); return; }
    await logAction(period ? 'update' : 'create', 'budget', `Bajeti: ${data.name}`);
    toast('Imehifadhiwa', 'success'); close();
    await loadPeriods();
    if (!period && periods.length > 0) { currentPeriod = periods[0]; await loadBudgetTree(); }
  };
}

function openCategoryModal(category = null) {
  if (!currentPeriod) { toast('Chagua bajeti kwanza', 'warning'); return; }
  const html = `<form id="cat-form" class="space-y-3">
    <div class="bg-green-50 p-3 rounded text-sm text-green-900">💡 <strong>Shughuli</strong> ni kiwango cha kwanza (LSF, CCP, Bustani, Mauzo...)</div>
    <div class="grid grid-cols-3 gap-3">
      <div><label class="form-label">Code <span class="text-red-500">*</span></label><input type="text" name="code" required class="form-input" value="${category?.code || ''}" placeholder="LSF"></div>
      <div class="col-span-2"><label class="form-label">Jina <span class="text-red-500">*</span></label><input type="text" name="name" required class="form-input" value="${category?.name || ''}" placeholder="Shughuli za LSF"></div>
    </div>
    <div><label class="form-label">Maelezo</label><textarea name="description" class="form-textarea" rows="2">${category?.description || ''}</textarea></div>
    <div><label class="form-label">Mpangilio</label><input type="number" name="display_order" class="form-input" value="${category?.display_order || 0}"></div>
    <div class="flex justify-end gap-2 pt-2">
      <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
      <button type="submit" class="btn btn-primary">${category ? 'Hifadhi' : 'Tengeneza'}</button>
    </div>
  </form>`;
  const { overlay, close } = createModal(category ? 'Hariri Shughuli' : 'Shughuli Mpya', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#cat-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { period_id: currentPeriod.id, code: fd.get('code'), name: fd.get('name'), description: fd.get('description') || null, display_order: parseInt(fd.get('display_order')) || 0 };
    let err;
    if (category) ({ error: err } = await supabase.from('budget_categories').update(data).eq('id', category.id));
    else ({ error: err } = await supabase.from('budget_categories').insert(data));
    if (err) { toast(err.message, 'error'); return; }
    await logAction(category ? 'update' : 'create', 'budget', `Shughuli: ${data.name}`);
    toast('Imehifadhiwa', 'success'); close(); await loadBudgetTree();
  };
}

function openItemModal(item = null, categoryId = null, parentId = null) {
  const catId = item?.category_id || categoryId;
  const pId = item?.parent_id !== undefined ? item.parent_id : parentId;
  const itemType = item?.item_type || 'leaf';
  const parent = pId ? allItems.find(i => i.id === pId) : null;
  const cat = categories.find(c => c.id === catId);
  
  const html = `<form id="item-form" class="space-y-3">
    <div class="bg-blue-50 p-3 rounded text-sm">
      <div class="font-medium text-blue-900">📍 Mahali:</div>
      <div class="text-blue-700">${escapeHtml(cat?.name || '')}${parent ? ' → ' + escapeHtml(parent.item) : ''}</div>
    </div>
    <div>
      <label class="form-label">Aina ya Kipengele <span class="text-red-500">*</span></label>
      <select name="item_type" id="item-type-select" required class="form-select">
        <option value="leaf" ${itemType === 'leaf' ? 'selected' : ''}>📄 Line Item (kina bei halisi)</option>
        <option value="header" ${itemType === 'header' ? 'selected' : ''}>📂 Group/Header (jumla ya watoto)</option>
      </select>
      <p class="text-xs text-gray-500 mt-1">Header = sub-categories ndani. Line Item = gharama halisi.</p>
    </div>
    <div class="grid grid-cols-3 gap-3">
      <div><label class="form-label">Code</label><input type="text" name="code" class="form-input" value="${item?.code || ''}" placeholder="A01"></div>
      <div class="col-span-2"><label class="form-label">Jina <span class="text-red-500">*</span></label><input type="text" name="item" required class="form-input" value="${item?.item || ''}" placeholder="Kusafisha Shamba"></div>
    </div>
    <div id="leaf-fields" style="${itemType === 'header' ? 'display:none' : ''}">
      <div class="grid grid-cols-3 gap-3">
        <div><label class="form-label">Unit</label><input type="text" name="unit" class="form-input" value="${item?.unit || ''}" placeholder="hekta"></div>
        <div><label class="form-label">Bei kwa Unit <span class="text-red-500">*</span></label><input type="number" step="0.01" name="unit_price" class="form-input" value="${item?.unit_price || 0}"></div>
        <div><label class="form-label">Quantity</label><input type="number" step="0.01" name="quantity" class="form-input" value="${item?.quantity || 1}"></div>
      </div>
      <div class="grid grid-cols-2 gap-3 mt-3">
        <div><label class="form-label">Miezi</label><input type="number" name="months" class="form-input" value="${item?.months || 1}"></div>
        <div><label class="form-label">Matumizi Halisi</label><input type="number" step="0.01" name="total_actual" class="form-input" value="${item?.total_actual || 0}"></div>
      </div>
    </div>
    <div><label class="form-label">Maelezo</label><textarea name="description" class="form-textarea" rows="2">${item?.description || ''}</textarea></div>
    <div class="flex justify-end gap-2 pt-2">
      <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
      <button type="submit" class="btn btn-primary">${item ? 'Hifadhi' : 'Tengeneza'}</button>
    </div>
  </form>`;
  const { overlay, close } = createModal(item ? 'Hariri Kipengele' : 'Kipengele Kipya', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#item-type-select').onchange = (e) => {
    overlay.querySelector('#leaf-fields').style.display = e.target.value === 'header' ? 'none' : '';
  };
  overlay.querySelector('#item-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const type = fd.get('item_type');
    const data = {
      category_id: catId, parent_id: pId, code: fd.get('code') || null,
      item: fd.get('item'), description: fd.get('description') || null, item_type: type,
      unit: type === 'leaf' ? (fd.get('unit') || null) : null,
      unit_price: type === 'leaf' ? (parseFloat(fd.get('unit_price')) || 0) : 0,
      quantity: type === 'leaf' ? (parseFloat(fd.get('quantity')) || 1) : 0,
      months: type === 'leaf' ? (parseInt(fd.get('months')) || 1) : 1,
      total_actual: type === 'leaf' ? (parseFloat(fd.get('total_actual')) || 0) : 0
    };
    let err;
    if (item) ({ error: err } = await supabase.from('budget_items').update(data).eq('id', item.id));
    else ({ error: err } = await supabase.from('budget_items').insert(data));
    if (err) { toast(err.message, 'error'); return; }
    await logAction(item ? 'update' : 'create', 'budget', `Kipengele: ${data.item}`);
    toast('Imehifadhiwa', 'success'); close();
    if (pId) expandedNodes.add('item-' + pId);
    if (catId) expandedNodes.add('cat-' + catId);
    await loadBudgetTree();
  };
}

function exportBudget(btnEl) {
  const rows = [];
  function walk(items, level) {
    items.forEach(i => {
      const planned = calcItemTotal(i, 'planned');
      const actual = calcItemTotal(i, 'actual');
      rows.push({
        level: '  '.repeat(level) + (i.code || ''),
        item: '  '.repeat(level) + i.item,
        type: i.item_type === 'header' ? 'Group' : 'Item',
        unit_price: i.item_type === 'leaf' ? i.unit_price : '',
        quantity: i.item_type === 'leaf' ? i.quantity : '',
        months: i.item_type === 'leaf' ? i.months : '',
        planned, actual,
        variance: planned - actual,
        percent: planned > 0 ? ((actual / planned) * 100).toFixed(1) + '%' : ''
      });
      const children = allItems.filter(x => x.parent_id === i.id);
      if (children.length) walk(children, level + 1);
    });
  }
  categories.forEach(cat => {
    const catItems = allItems.filter(i => i.category_id === cat.id && !i.parent_id);
    rows.push({
      level: cat.code, item: cat.name, type: 'Activity', unit_price: '', quantity: '', months: '',
      planned: catItems.reduce((s, i) => s + calcItemTotal(i, 'planned'), 0),
      actual: catItems.reduce((s, i) => s + calcItemTotal(i, 'actual'), 0),
      variance: '', percent: ''
    });
    walk(catItems, 1);
  });
  exportMenu(btnEl, rows, `bajeti-${currentPeriod?.name || 'export'}`, [
    { key: 'level', label: 'Code' }, { key: 'item', label: 'Kipengele' }, { key: 'type', label: 'Aina' },
    { key: 'unit_price', label: 'Bei/Unit', value: r => r.unit_price ? formatNumber(r.unit_price) : '' },
    { key: 'quantity', label: 'Qty' }, { key: 'months', label: 'Miezi' },
    { key: 'planned', label: 'Bajeti (TZS)', value: r => formatNumber(r.planned) },
    { key: 'actual', label: 'Matumizi (TZS)', value: r => formatNumber(r.actual) },
    { key: 'variance', label: 'Tofauti', value: r => r.variance !== '' ? formatNumber(r.variance) : '' },
    { key: 'percent', label: '%' }
  ], { title: `Bajeti — ${currentPeriod?.name || ''}`, orientation: 'landscape' });
}
