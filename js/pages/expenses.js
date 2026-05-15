// ============================================================================
// MATUMIZI MODULE - Simplified, Focused
// Inahitajika: Tarehe, Shamba, Kiasi, Aliyeidhinisha, Maelezo, Risiti (optional)
// ============================================================================
import { supabase } from '../supabase.js';
import { hasPermission, getCurrentProfile } from '../auth.js';
import { formatTZS, formatDate, todayISO, toast, confirm, createModal, exportMenu, debounce, escapeHtml, logAction, formatNumber } from '../utils.js';

let allExpenses = [];
let filteredExpenses = [];
let plots = [];
let budgetItems = [];
let currentPage = 1;
const PAGE_SIZE = 25;

export async function initExpenses() {
  await Promise.all([loadPlots(), loadBudgetItems(), loadExpenses()]);
  bindEvents();
  renderStats();
}

async function loadPlots() {
  const { data } = await supabase.from('plots').select('*').order('code');
  plots = data || [];
  // Populate filters and modals
  const filter = document.getElementById('filter-plot');
  if (filter) {
    filter.innerHTML = '<option value="">Mashamba Yote</option>' +
      plots.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  }
}

async function loadBudgetItems() {
  // Try with categories join first
  let { data, error } = await supabase
    .from('budget_items')
    .select('id, code, item, category_id, item_type, total_planned, total_actual, budget_categories(name, code, period_id)')
    .eq('item_type', 'leaf')
    .order('code');
  
  // Fallback bila join kama relationship haijapatikana
  if (error) {
    const fb = await supabase
      .from('budget_items')
      .select('id, code, item, category_id, item_type, total_planned, total_actual')
      .eq('item_type', 'leaf')
      .order('code');
    data = fb.data;
    error = fb.error;
    
    // Enrich client-side
    if (data && data.length > 0) {
      const catIds = [...new Set(data.map(b => b.category_id).filter(Boolean))];
      if (catIds.length > 0) {
        const { data: cats } = await supabase.from('budget_categories').select('id, name, code, period_id').in('id', catIds);
        const catMap = {};
        (cats || []).forEach(c => catMap[c.id] = c);
        data.forEach(b => { if (catMap[b.category_id]) b.budget_categories = catMap[b.category_id]; });
      }
    }
  }
  
  budgetItems = data || [];
}

async function loadExpenses() {
  // Try with full joins first
  let { data, error } = await supabase
    .from('expenses')
    .select('*, budget_item:budget_items(code, item), plot:plots(name, code), approver:approved_by(full_name)')
    .order('expense_date', { ascending: false })
    .limit(500);
  
  // Fallback 1: bila approver join
  if (error) {
    console.warn('Full join failed, trying without approver:', error.message);
    const fb1 = await supabase
      .from('expenses')
      .select('*, budget_item:budget_items(code, item), plot:plots(name, code)')
      .order('expense_date', { ascending: false })
      .limit(500);
    data = fb1.data;
    error = fb1.error;
  }
  
  // Fallback 2: bila joins yote
  if (error) {
    console.warn('Joins failed, loading plain:', error.message);
    const fb2 = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      .limit(500);
    data = fb2.data;
    error = fb2.error;
  }
  
  if (error) { 
    toast('Imeshindikana: ' + error.message, 'error'); 
    document.getElementById('expenses-tbody').innerHTML = `<tr><td colspan="9" class="text-center text-red-600 py-8">${error.message}</td></tr>`;
    return; 
  }
  
  allExpenses = data || [];
  
  // Enrich client-side kama joins zilifeli
  await enrichExpensesClientSide();
  
  applyFilters();
}

async function enrichExpensesClientSide() {
  // Enrich approver
  const approverIds = [...new Set(allExpenses.map(e => e.approved_by).filter(id => id && !e.approver))];
  if (approverIds.length > 0) {
    const { data: users } = await supabase.from('users').select('id, full_name').in('id', approverIds);
    const userMap = {};
    (users || []).forEach(u => userMap[u.id] = u);
    allExpenses.forEach(e => {
      if (e.approved_by && userMap[e.approved_by] && !e.approver) {
        e.approver = userMap[e.approved_by];
      }
    });
  }
  
  // Enrich plot
  const plotIds = [...new Set(allExpenses.map(e => e.plot_id).filter(id => id && !plots.find(p => p.id === id)))];
  allExpenses.forEach(e => {
    if (e.plot_id && !e.plot) {
      const p = plots.find(plot => plot.id === e.plot_id);
      if (p) e.plot = { name: p.name, code: p.code };
    }
  });
  
  // Enrich budget_item
  const itemIds = [...new Set(allExpenses.map(e => e.budget_item_id).filter(Boolean))];
  if (itemIds.length > 0) {
    const missingIds = itemIds.filter(id => !allExpenses.find(e => e.budget_item_id === id && e.budget_item));
    if (missingIds.length > 0) {
      const { data: items } = await supabase.from('budget_items').select('id, code, item').in('id', missingIds);
      const itemMap = {};
      (items || []).forEach(i => itemMap[i.id] = i);
      allExpenses.forEach(e => {
        if (e.budget_item_id && itemMap[e.budget_item_id] && !e.budget_item) {
          e.budget_item = { code: itemMap[e.budget_item_id].code, item: itemMap[e.budget_item_id].item };
        }
      });
    }
  }
}

function applyFilters() {
  const plotId = document.getElementById('filter-plot')?.value || '';
  const search = document.getElementById('filter-search')?.value.toLowerCase() || '';
  const fromDate = document.getElementById('filter-from')?.value;
  const toDate = document.getElementById('filter-to')?.value;
  
  filteredExpenses = allExpenses.filter(e => {
    if (plotId && e.plot_id != plotId) return false;
    if (fromDate && e.expense_date < fromDate) return false;
    if (toDate && e.expense_date > toDate) return false;
    if (search) {
      const haystack = `${e.description} ${e.supplier_name || ''} ${e.budget_item?.item || ''} ${e.plot?.name || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  currentPage = 1;
  renderExpenses();
  renderStats();
}

function renderStats() {
  // Hesabu zote kama approved (single user, hakuna approval flow)
  const total = allExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const thisMonth = allExpenses.filter(e => {
    const d = new Date(e.expense_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalMonth = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
  
  // Per shamba
  const byPlot = {};
  allExpenses.forEach(e => {
    const code = e.plot?.code || 'N/A';
    if (!byPlot[code]) byPlot[code] = 0;
    byPlot[code] += Number(e.amount);
  });
  const topPlot = Object.entries(byPlot).sort((a, b) => b[1] - a[1])[0];
  
  const el = document.getElementById('expense-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="stat-card">
        <div class="stat-label">Jumla ya Matumizi</div>
        <div class="stat-value money">${formatTZS(total)}</div>
        <div class="stat-sub">${allExpenses.length} matumizi yaliyoingizwa</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Mwezi Huu</div>
        <div class="stat-value money">${formatTZS(totalMonth)}</div>
        <div class="stat-sub">${thisMonth.length} matumizi mwezi huu</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">Wastani kwa Matumizi</div>
        <div class="stat-value money">${formatTZS(allExpenses.length > 0 ? total / allExpenses.length : 0)}</div>
        <div class="stat-sub">Average per expense</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-label">Shamba Linaloongoza</div>
        <div class="stat-value" style="font-size: 1.5rem">${topPlot ? topPlot[0] : '-'}</div>
        <div class="stat-sub">${topPlot ? formatTZS(topPlot[1]) : 'Hakuna data'}</div>
      </div>
    </div>`;
}

function renderExpenses() {
  const tbody = document.getElementById('expenses-tbody');
  if (!tbody) return;
  
  if (filteredExpenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-gray-500 py-12">
      <div class="text-5xl mb-2">📋</div>
      <div>Hakuna matumizi yaliyopatikana</div>
      ${hasPermission('expenses', 'create') ? '<button onclick="window.addExpense()" class="btn btn-primary mt-3">+ Ongeza Matumizi</button>' : ''}
    </td></tr>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }
  
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageData = filteredExpenses.slice(start, start + PAGE_SIZE);
  
  tbody.innerHTML = pageData.map(e => {
    return `
      <tr>
        <td class="whitespace-nowrap text-sm">${formatDate(e.expense_date)}</td>
        <td class="text-sm">${e.plot ? `<span class="badge badge-info">${escapeHtml(e.plot.code)}</span>` : '-'}</td>
        <td>
          <div class="font-medium">${escapeHtml(e.description)}</div>
          ${e.budget_item ? `<div class="text-xs text-gray-500">${escapeHtml(e.budget_item.code)} - ${escapeHtml(e.budget_item.item)}</div>` : ''}
        </td>
        <td class="text-sm">${escapeHtml(e.supplier_name || '-')}</td>
        <td class="text-sm">${escapeHtml(e.payment_method || '-')}</td>
        <td class="text-right money font-bold text-green-700">${formatNumber(e.amount)}</td>
        <td>${e.receipt_url ? `<button class="text-blue-600 text-sm" onclick="window.viewReceipt('${e.receipt_url}')">📎 Tazama</button>` : '-'}</td>
        <td class="whitespace-nowrap">
          ${hasPermission('expenses', 'edit') ? `<button class="text-blue-600" onclick="window.editExpense(${e.id})" title="Hariri">✏️</button>` : ''}
          ${hasPermission('expenses', 'delete') ? `<button class="text-red-600 ml-2" onclick="window.deleteExpense(${e.id})" title="Futa">🗑️</button>` : ''}
        </td>
      </tr>`;
  }).join('');
  
  // Pagination
  const totalPages = Math.ceil(filteredExpenses.length / PAGE_SIZE);
  const pag = document.getElementById('pagination');
  pag.innerHTML = `
    <span>Inaonyesha ${start + 1}-${Math.min(start + PAGE_SIZE, filteredExpenses.length)} ya ${filteredExpenses.length}</span>
    <div class="flex gap-1">
      <button class="btn btn-secondary px-3 py-1 text-sm" ${currentPage === 1 ? 'disabled' : ''} onclick="window.expPrev()">← Nyuma</button>
      <span class="px-3 py-1 text-sm">${currentPage} / ${totalPages}</span>
      <button class="btn btn-secondary px-3 py-1 text-sm" ${currentPage >= totalPages ? 'disabled' : ''} onclick="window.expNext()">Mbele →</button>
    </div>`;
}

function bindEvents() {
  document.getElementById('add-expense-btn')?.addEventListener('click', () => openExpenseModal());
  document.getElementById('filter-plot')?.addEventListener('change', applyFilters);
  document.getElementById('filter-from')?.addEventListener('change', applyFilters);
  document.getElementById('filter-to')?.addEventListener('change', applyFilters);
  document.getElementById('filter-search')?.addEventListener('input', debounce(applyFilters, 300));
  document.getElementById('export-btn')?.addEventListener('click', (e) => exportExpenses(e.currentTarget));
  document.getElementById('clear-filters')?.addEventListener('click', () => {
    ['filter-plot','filter-from','filter-to','filter-search'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    applyFilters();
  });
  
  window.addExpense = () => openExpenseModal();
  window.editExpense = (id) => openExpenseModal(allExpenses.find(e => e.id === id));
  window.approveExpense = (id) => updateStatus(id, 'approved');
  window.rejectExpense = (id) => promptReject(id);
  window.deleteExpense = async (id) => {
    if (!await confirm('Una uhakika unataka kufuta matumizi haya?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    await logAction('delete', 'expenses', 'Amefuta matumizi');
    toast('Imefutwa', 'success');
    await loadExpenses();
  };
  window.viewReceipt = async (url) => {
    if (url.startsWith('http')) {
      window.open(url, '_blank');
    } else {
      // Supabase storage
      const { data } = await supabase.storage.from('receipts').createSignedUrl(url, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    }
  };
  window.expPrev = () => { if (currentPage > 1) { currentPage--; renderExpenses(); } };
  window.expNext = () => { if (currentPage * PAGE_SIZE < filteredExpenses.length) { currentPage++; renderExpenses(); } };
}

function openExpenseModal(expense = null) {
  // Group budget items by category for select
  const itemsByCategory = {};
  budgetItems.forEach(b => {
    const catName = b.budget_categories?.name || 'Other';
    if (!itemsByCategory[catName]) itemsByCategory[catName] = [];
    itemsByCategory[catName].push(b);
  });
  
  const html = `
    <form id="exp-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Tarehe <span class="text-red-500">*</span></label>
          <input type="date" name="expense_date" required class="form-input" value="${expense?.expense_date || todayISO()}">
        </div>
        <div>
          <label class="form-label">Shamba <span class="text-red-500">*</span></label>
          <select name="plot_id" required class="form-select">
            <option value="">-- Chagua Shamba --</option>
            ${plots.map(p => `<option value="${p.id}" ${expense?.plot_id == p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <div>
        <label class="form-label">Aina ya Matumizi (Budget Item) <span class="text-red-500">*</span></label>
        <select name="budget_item_id" required class="form-select">
          <option value="">-- Chagua Kipengele cha Bajeti --</option>
          ${Object.entries(itemsByCategory).map(([catName, items]) => `
            <optgroup label="${escapeHtml(catName)}">
              ${items.map(b => `<option value="${b.id}" ${expense?.budget_item_id == b.id ? 'selected' : ''}>${escapeHtml(b.code)} - ${escapeHtml(b.item)}</option>`).join('')}
            </optgroup>
          `).join('')}
        </select>
        <p class="text-xs text-gray-500 mt-1">Matumizi yatahesabiwa kwa kipengele hiki kwenye bajeti</p>
      </div>
      
      <div>
        <label class="form-label">Maelezo <span class="text-red-500">*</span></label>
        <input type="text" name="description" required class="form-input" value="${expense?.description || ''}" placeholder="Mfano: Mafuta ya tractor, ununuzi wa mbegu, n.k.">
      </div>
      
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Kiasi (TZS) <span class="text-red-500">*</span></label>
          <input type="number" step="0.01" name="amount" required class="form-input" value="${expense?.amount || ''}" placeholder="0">
        </div>
        <div>
          <label class="form-label">Mtoa Bidhaa/Huduma</label>
          <input type="text" name="supplier_name" class="form-input" value="${expense?.supplier_name || ''}" placeholder="Jina la duka au mtu">
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Njia ya Malipo</label>
          <select name="payment_method" class="form-select">
            <option value="">-- Chagua --</option>
            <option value="cash" ${expense?.payment_method === 'cash' ? 'selected' : ''}>💵 Cash</option>
            <option value="mpesa" ${expense?.payment_method === 'mpesa' ? 'selected' : ''}>📱 M-Pesa</option>
            <option value="tigo_pesa" ${expense?.payment_method === 'tigo_pesa' ? 'selected' : ''}>📱 Tigo Pesa</option>
            <option value="airtel_money" ${expense?.payment_method === 'airtel_money' ? 'selected' : ''}>📱 Airtel Money</option>
            <option value="bank" ${expense?.payment_method === 'bank' ? 'selected' : ''}>🏦 Bank Transfer</option>
            <option value="cheque" ${expense?.payment_method === 'cheque' ? 'selected' : ''}>📄 Cheque</option>
          </select>
        </div>
        <div>
          <label class="form-label">Reference Number</label>
          <input type="text" name="reference_number" class="form-input" value="${expense?.reference_number || ''}" placeholder="M-Pesa code, receipt #">
        </div>
      </div>
      
      <div>
        <label class="form-label">Picha ya Risiti (Optional)</label>
        <input type="file" name="receipt" accept="image/*,application/pdf" class="form-input">
        <p class="text-xs text-gray-500 mt-1">JPG, PNG, au PDF. Max 5MB.</p>
        ${expense?.receipt_url ? `<p class="text-xs text-green-600 mt-1">✓ Risiti tayari ipo: <a href="#" onclick="window.viewReceipt('${expense.receipt_url}'); return false;" class="underline">Tazama</a></p>` : ''}
      </div>
      
      <div class="flex justify-end gap-2 pt-2 border-t">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">${expense ? 'Hifadhi' : 'Ongeza'}</button>
      </div>
    </form>`;
  
  const { overlay, close } = createModal(expense ? 'Hariri Matumizi' : 'Matumizi Mapya', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#exp-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Inahifadhi...';
    
    const fd = new FormData(e.target);
    const file = fd.get('receipt');
    let receipt_url = expense?.receipt_url || null;
    
    try {
      // Upload receipt if provided
      if (file && file.size > 0) {
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g,'_')}`;
        const { error: uploadErr } = await supabase.storage.from('receipts').upload(fileName, file);
        if (uploadErr) {
          if (uploadErr.message.includes('Bucket not found')) {
            toast('Tafadhali tengeneza bucket "receipts" kwenye Supabase', 'error');
            throw uploadErr;
          }
          throw uploadErr;
        }
        receipt_url = fileName;
      }
      
      const data = {
        expense_date: fd.get('expense_date'),
        plot_id: parseInt(fd.get('plot_id')),
        budget_item_id: parseInt(fd.get('budget_item_id')),
        description: fd.get('description'),
        amount: parseFloat(fd.get('amount')),
        supplier_name: fd.get('supplier_name') || null,
        payment_method: fd.get('payment_method') || null,
        reference_number: fd.get('reference_number') || null,
        receipt_url,
        status: 'approved'  // Auto-approve (single user mode)
      };
      if (!expense) {
        const profile = getCurrentProfile();
        if (profile?.id) {
          // Set all possible "who created this" columns
          data.created_by = profile.id;
          data.recorded_by = profile.id;
          data.user_id = profile.id;
          data.approved_by = profile.id;
          data.approved_at = new Date().toISOString();
        }
      }
      
      let err;
      if (expense) ({ error: err } = await supabase.from('expenses').update(data).eq('id', expense.id));
      else {
        let result = await supabase.from('expenses').insert(data);
        // Smart retry: ondoa columns ambazo schema hazikubali
        let retryCount = 0;
        while (result.error && retryCount < 5) {
          const msg = result.error.message;
          // Find which column is causing the error
          const colMatch = msg.match(/column "([^"]+)"/);
          if (colMatch) {
            const badCol = colMatch[1];
            if (data[badCol] !== undefined) {
              delete data[badCol];
              retryCount++;
              result = await supabase.from('expenses').insert(data);
              continue;
            }
          }
          break;
        }
        err = result.error;
      }
      if (err) throw err;
      
      await logAction(expense ? 'update' : 'create', 'expenses', `${expense ? 'Amebadilisha' : 'Ameingiza'} matumizi: ${data.description} - TZS ${data.amount.toLocaleString()}`);
      toast(expense ? 'Imebadilishwa' : 'Imeongezwa', 'success');
      close();
      await loadExpenses();
    } catch (err) {
      toast(err.message || 'Imeshindikana', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = expense ? 'Hifadhi' : 'Ongeza';
    }
  };
}

async function updateStatus(id, status, reason = null) {
  const profile = getCurrentProfile();
  const updates = { status };
  if (profile?.id) {
    updates.approved_by = profile.id;
    updates.approved_at = new Date().toISOString();
  }
  if (reason) updates.rejection_reason = reason;
  
  let { error } = await supabase.from('expenses').update(updates).eq('id', id);
  // Retry bila approved_by/approved_at kama columns hazipo
  if (error && (error.message.includes('approved_by') || error.message.includes('approved_at') || error.message.includes('rejection_reason'))) {
    const minimal = { status };
    if (reason && !error.message.includes('rejection_reason')) minimal.rejection_reason = reason;
    ({ error } = await supabase.from('expenses').update(minimal).eq('id', id));
  }
  if (error) { toast(error.message, 'error'); return; }
  
  const expense = allExpenses.find(e => e.id === id);
  await logAction(status === 'approved' ? 'approve' : 'reject', 'expenses', `${status === 'approved' ? 'Ameidhinisha' : 'Amekataa'}: ${expense?.description} - TZS ${Number(expense?.amount || 0).toLocaleString()}${reason ? ' (' + reason + ')' : ''}`);
  toast(status === 'approved' ? 'Yameidhinishwa' : 'Yamekataliwa', 'success');
  await loadExpenses();
}

function promptReject(id) {
  const html = `
    <form id="reject-form" class="space-y-3">
      <p class="text-sm">Eleza sababu ya kukataa matumizi haya:</p>
      <textarea name="reason" required class="form-textarea" rows="3" placeholder="Sababu..."></textarea>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-danger">Kataa</button>
      </div>
    </form>`;
  const { overlay, close } = createModal('Kataa Matumizi', html, 'max-w-md');
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#reject-form').onsubmit = async (e) => {
    e.preventDefault();
    await updateStatus(id, 'rejected', new FormData(e.target).get('reason'));
    close();
  };
}

function exportExpenses(btnEl) {
  exportMenu(btnEl, filteredExpenses, `matumizi-${todayISO()}`, [
    { key: 'expense_date', label: 'Tarehe', value: e => formatDate(e.expense_date) },
    { label: 'Shamba', value: e => e.plot?.name || '' },
    { label: 'Code', value: e => e.budget_item?.code || '' },
    { label: 'Kipengele', value: e => e.budget_item?.item || '' },
    { key: 'description', label: 'Maelezo' },
    { key: 'supplier_name', label: 'Mtoa Bidhaa' },
    { key: 'amount', label: 'Kiasi (TZS)', value: e => formatNumber(e.amount) },
    { key: 'payment_method', label: 'Njia ya Malipo' },
    { key: 'reference_number', label: 'Reference' },
    { key: 'status', label: 'Status' },
    { label: 'Aliyeidhinisha', value: e => e.approver?.full_name || '' }
  ], { title: 'Ripoti ya Matumizi', orientation: 'landscape' });
}
