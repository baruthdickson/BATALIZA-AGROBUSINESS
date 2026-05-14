// ============================================================================
// EXPENSES MODULE - Matumizi management
// ============================================================================

import { supabase } from '../supabase.js';
import { hasPermission, getCurrentProfile } from '../auth.js';
import { formatTZS, formatDate, todayISO, toast, confirm, createModal, exportToCSV, exportMenu, debounce, escapeHtml, logAction } from '../utils.js';

let allExpenses = [];
let filteredExpenses = [];
let budgetItems = [];
let suppliers = [];
let currentPage = 1;
const pageSize = 25;

export async function initExpenses() {
  await loadBudgetItems();
  await loadSuppliers();
  await loadExpenses();
  bindEvents();
}

// ============================================================================
// LOAD DATA
// ============================================================================
async function loadBudgetItems() {
  const { data } = await supabase
    .from('budget_items')
    .select('id, code, item')
    .order('code');
  budgetItems = data || [];
}

async function loadSuppliers() {
  const { data } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('status', 'active')
    .order('name');
  suppliers = data || [];
}

async function loadExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      budget_item:budget_items(id, code, item),
      supplier:suppliers(id, name),
      recorder:users!expenses_recorded_by_fkey(full_name)
    `)
    .is('deleted_at', null)
    .order('expense_date', { ascending: false });
  
  if (error) { toast(error.message, 'error'); return; }
  
  allExpenses = data || [];
  applyFilters();
}

// ============================================================================
// FILTERS
// ============================================================================
function applyFilters() {
  const status = document.getElementById('filter-status').value;
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const search = document.getElementById('filter-search').value.toLowerCase();
  
  filteredExpenses = allExpenses.filter(e => {
    if (status && e.status !== status) return false;
    if (from && e.expense_date < from) return false;
    if (to && e.expense_date > to) return false;
    if (search) {
      const text = `${e.description} ${e.budget_item?.code || ''} ${e.budget_item?.item || ''} ${e.supplier_name || ''}`.toLowerCase();
      if (!text.includes(search)) return false;
    }
    return true;
  });
  
  currentPage = 1;
  renderSummary();
  renderTable();
}

function renderSummary() {
  const total = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const pending = filteredExpenses.filter(e => e.status === 'pending').reduce((s, e) => s + Number(e.amount), 0);
  const approved = filteredExpenses.filter(e => e.status === 'approved').reduce((s, e) => s + Number(e.amount), 0);
  const rejected = filteredExpenses.filter(e => e.status === 'rejected').reduce((s, e) => s + Number(e.amount), 0);
  
  document.getElementById('sum-total').textContent = formatTZS(total);
  document.getElementById('sum-pending').textContent = formatTZS(pending);
  document.getElementById('sum-approved').textContent = formatTZS(approved);
  document.getElementById('sum-rejected').textContent = formatTZS(rejected);
}

// ============================================================================
// RENDER TABLE
// ============================================================================
function renderTable() {
  const tbody = document.getElementById('expenses-tbody');
  
  if (filteredExpenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-500 py-8">Hakuna matumizi</td></tr>';
    document.getElementById('pagination').innerHTML = '';
    return;
  }
  
  const start = (currentPage - 1) * pageSize;
  const pageData = filteredExpenses.slice(start, start + pageSize);
  const totalPages = Math.ceil(filteredExpenses.length / pageSize);
  
  const statusBadge = (s) => {
    const map = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };
    const labels = { pending: 'Inasubiri', approved: 'Imeidhinishwa', rejected: 'Imekataliwa' };
    return `<span class="badge ${map[s]}">${labels[s]}</span>`;
  };
  
  const paymentLabels = {
    cash: '💵 Cash', bank: '🏦 Bank', mobile_money: '📱 Mobile', cheque: '📝 Cheque'
  };
  
  tbody.innerHTML = pageData.map(e => `
    <tr>
      <td>${formatDate(e.expense_date)}</td>
      <td class="font-mono text-xs">${e.budget_item?.code || '-'}</td>
      <td>${escapeHtml(e.description)}</td>
      <td>${escapeHtml(e.supplier_name || e.supplier?.name || '-')}</td>
      <td class="text-right font-bold">${formatTZS(e.amount)}</td>
      <td class="text-xs">${paymentLabels[e.payment_method] || e.payment_method}</td>
      <td>${statusBadge(e.status)}</td>
      <td class="whitespace-nowrap">
        <button class="text-green-600 hover:text-green-800 text-sm" onclick="window.viewExpense(${e.id})">👁</button>
        ${e.status === 'pending' && hasPermission('expenses', 'approve') ? `
          <button class="text-green-600 hover:text-green-800 text-sm ml-1" onclick="window.approveExpense(${e.id})" title="Idhinisha">✓</button>
          <button class="text-red-600 hover:text-red-800 text-sm ml-1" onclick="window.rejectExpense(${e.id})" title="Kataa">✗</button>
        ` : ''}
        ${e.status === 'pending' && hasPermission('expenses', 'edit') ? `
          <button class="text-green-600 hover:text-green-800 text-sm ml-1" onclick="window.editExpense(${e.id})">✏️</button>
        ` : ''}
        ${hasPermission('expenses', 'delete') ? `
          <button class="text-red-600 hover:text-red-800 text-sm ml-1" onclick="window.deleteExpense(${e.id})">🗑</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
  
  // Pagination
  document.getElementById('pagination').innerHTML = `
    <div class="text-sm text-gray-600">
      Ukurasa ${currentPage} kati ya ${totalPages} (jumla ${filteredExpenses.length})
    </div>
    <div class="flex gap-2">
      <button ${currentPage === 1 ? 'disabled' : ''} onclick="window.changePage(${currentPage - 1})" class="btn btn-secondary text-sm ${currentPage === 1 ? 'opacity-50' : ''}">← Mbele</button>
      <button ${currentPage >= totalPages ? 'disabled' : ''} onclick="window.changePage(${currentPage + 1})" class="btn btn-secondary text-sm ${currentPage >= totalPages ? 'opacity-50' : ''}">Nyuma →</button>
    </div>
  `;
}

// ============================================================================
// EVENTS
// ============================================================================
function bindEvents() {
  document.getElementById('filter-status').onchange = applyFilters;
  document.getElementById('filter-from').onchange = applyFilters;
  document.getElementById('filter-to').onchange = applyFilters;
  document.getElementById('filter-search').oninput = debounce(applyFilters);
  document.getElementById('add-btn').onclick = () => openModal();
  document.getElementById('export-btn').onclick = (e) => exportData(e.currentTarget);
  
  // Window handlers
  window.changePage = (p) => { currentPage = p; renderTable(); window.scrollTo(0, 0); };
  window.viewExpense = (id) => viewDetails(id);
  window.editExpense = (id) => openModal(allExpenses.find(e => e.id === id));
  window.approveExpense = (id) => updateStatus(id, 'approved');
  window.rejectExpense = (id) => promptReject(id);
  window.deleteExpense = async (id) => {
    if (!await confirm('Una hakika unataka kufuta matumizi haya?')) return;
    const { error } = await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Yamefutwa', 'success');
    await loadExpenses();
  };
}

// ============================================================================
// MODAL (add/edit)
// ============================================================================
function openModal(expense = null) {
  if (budgetItems.length === 0) {
    toast('Tengeneza budget items kwanza', 'warning');
    return;
  }
  
  const html = `
    <form id="expense-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Tarehe</label>
          <input type="date" name="expense_date" required class="form-input" value="${expense?.expense_date || todayISO()}">
        </div>
        <div>
          <label class="form-label">Kifungu cha Bajeti</label>
          <select name="budget_item_id" required class="form-select">
            <option value="">Chagua...</option>
            ${budgetItems.map(b => `<option value="${b.id}" ${expense?.budget_item_id == b.id ? 'selected' : ''}>${b.code} - ${escapeHtml(b.item)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="form-label">Maelezo</label>
        <input type="text" name="description" required class="form-input" value="${escapeHtml(expense?.description || '')}" placeholder="Mfano: Diesel kwa trekta">
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="form-label">Quantity</label>
          <input type="number" step="0.01" name="quantity" class="form-input" value="${expense?.quantity || ''}">
        </div>
        <div>
          <label class="form-label">Bei kwa Unit</label>
          <input type="number" step="0.01" name="unit_price" class="form-input" value="${expense?.unit_price || ''}">
        </div>
        <div>
          <label class="form-label">Jumla (TZS)</label>
          <input type="number" step="0.01" name="amount" required class="form-input" value="${expense?.amount || ''}">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Supplier</label>
          <input type="text" name="supplier_name" class="form-input" value="${escapeHtml(expense?.supplier_name || '')}" placeholder="Jina la mtoa huduma">
        </div>
        <div>
          <label class="form-label">Njia ya Malipo</label>
          <select name="payment_method" required class="form-select">
            <option value="cash" ${expense?.payment_method === 'cash' ? 'selected' : ''}>Cash</option>
            <option value="bank" ${expense?.payment_method === 'bank' ? 'selected' : ''}>Bank</option>
            <option value="mobile_money" ${expense?.payment_method === 'mobile_money' ? 'selected' : ''}>Mobile Money</option>
            <option value="cheque" ${expense?.payment_method === 'cheque' ? 'selected' : ''}>Cheque</option>
          </select>
        </div>
      </div>
      <div>
        <label class="form-label">Reference Number</label>
        <input type="text" name="reference_number" class="form-input" value="${escapeHtml(expense?.reference_number || '')}" placeholder="Transaction ID, receipt #, n.k.">
      </div>
      <div>
        <label class="form-label">Picha ya Risiti (hiari)</label>
        <input type="file" name="receipt" accept="image/*,application/pdf" class="form-input">
      </div>
      <div class="flex justify-end gap-2 pt-4">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Hifadhi</button>
      </div>
    </form>
  `;
  
  const { overlay, close } = createModal(expense ? 'Hariri Matumizi' : 'Matumizi Mapya', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  
  // Auto-calculate amount when quantity/unit_price change
  const form = overlay.querySelector('#expense-form');
  const qtyInput = form.querySelector('[name="quantity"]');
  const priceInput = form.querySelector('[name="unit_price"]');
  const amountInput = form.querySelector('[name="amount"]');
  const calcAmount = () => {
    const q = parseFloat(qtyInput.value) || 0;
    const p = parseFloat(priceInput.value) || 0;
    if (q && p) amountInput.value = (q * p).toFixed(2);
  };
  qtyInput.oninput = calcAmount;
  priceInput.oninput = calcAmount;
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const profile = getCurrentProfile();
    
    const data = {
      budget_item_id: parseInt(fd.get('budget_item_id')),
      expense_date: fd.get('expense_date'),
      description: fd.get('description'),
      quantity: parseFloat(fd.get('quantity')) || null,
      unit_price: parseFloat(fd.get('unit_price')) || null,
      amount: parseFloat(fd.get('amount')),
      supplier_name: fd.get('supplier_name'),
      payment_method: fd.get('payment_method'),
      reference_number: fd.get('reference_number'),
      recorded_by: profile.id
    };
    
    let expenseId;
    if (expense) {
      const { error } = await supabase.from('expenses').update(data).eq('id', expense.id);
      if (error) { toast(error.message, 'error'); return; }
      expenseId = expense.id;
    } else {
      const { data: inserted, error } = await supabase.from('expenses').insert(data).select().single();
      if (error) { toast(error.message, 'error'); return; }
      expenseId = inserted.id;
    }
    
    // Upload receipt if provided
    const file = fd.get('receipt');
    if (file && file.size > 0) {
      const path = `expenses/${expenseId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(path, file);
      if (!uploadError) {
        await supabase.from('expense_attachments').insert({
          expense_id: expenseId,
          file_path: path,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: profile.id
        });
      } else {
        toast('Receipt upload failed: ' + uploadError.message, 'warning');
      }
    }
    
    toast(expense ? 'Yamebadilishwa' : 'Yameongezwa', 'success');
    close();
    await loadExpenses();
  };
}

// ============================================================================
// APPROVAL / REJECTION
// ============================================================================
async function updateStatus(id, status, reason = null) {
  const profile = getCurrentProfile();
  const updates = {
    status,
    approved_by: profile.id,
    approved_at: new Date().toISOString()
  };
  if (reason) updates.rejection_reason = reason;
  
  const { error } = await supabase.from('expenses').update(updates).eq('id', id);
  if (error) { toast(error.message, 'error'); return; }
  
  const expense = allExpenses.find(e => e.id === id);
  const desc = `${status === 'approved' ? 'Ameidhinisha' : 'Amekataa'} matumizi: ${expense?.description || `#${id}`} (TZS ${Number(expense?.amount || 0).toLocaleString()})${reason ? ' - ' + reason : ''}`;
  await logAction(supabase, status === 'approved' ? 'approve' : 'reject', 'expenses', { type: 'expense', id }, desc);
  
  toast(status === 'approved' ? 'Yameidhinishwa' : 'Yamekataliwa', 'success');
  await loadExpenses();
}

function promptReject(id) {
  const html = `
    <form id="reject-form" class="space-y-4">
      <p class="text-gray-600">Toa sababu ya kukataa:</p>
      <textarea name="reason" required class="form-textarea" rows="3" placeholder="Sababu..."></textarea>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-danger">Kataa</button>
      </div>
    </form>
  `;
  const { overlay, close } = createModal('Kataa Matumizi', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#reject-form').onsubmit = async (e) => {
    e.preventDefault();
    const reason = new FormData(e.target).get('reason');
    await updateStatus(id, 'rejected', reason);
    close();
  };
}

// ============================================================================
// VIEW DETAILS
// ============================================================================
async function viewDetails(id) {
  const exp = allExpenses.find(e => e.id === id);
  if (!exp) return;
  
  // Load attachments
  const { data: attachments } = await supabase
    .from('expense_attachments')
    .select('*')
    .eq('expense_id', id);
  
  const html = `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div><strong>Tarehe:</strong> ${formatDate(exp.expense_date)}</div>
        <div><strong>Kiasi:</strong> ${formatTZS(exp.amount)}</div>
        <div><strong>Kifungu:</strong> ${exp.budget_item?.code} - ${escapeHtml(exp.budget_item?.item || '')}</div>
        <div><strong>Status:</strong> ${exp.status}</div>
        <div><strong>Supplier:</strong> ${escapeHtml(exp.supplier_name || '-')}</div>
        <div><strong>Malipo:</strong> ${exp.payment_method}</div>
        <div><strong>Ref:</strong> ${escapeHtml(exp.reference_number || '-')}</div>
        <div><strong>Aliyeingiza:</strong> ${escapeHtml(exp.recorder?.full_name || '-')}</div>
      </div>
      <div>
        <strong>Maelezo:</strong>
        <p class="mt-1 text-gray-700">${escapeHtml(exp.description)}</p>
      </div>
      ${exp.rejection_reason ? `<div class="bg-red-50 p-3 rounded"><strong>Sababu ya kukataa:</strong> ${escapeHtml(exp.rejection_reason)}</div>` : ''}
      ${attachments && attachments.length > 0 ? `
        <div>
          <strong>Risiti:</strong>
          <div class="space-y-1 mt-2">
            ${await Promise.all(attachments.map(async a => {
              const { data } = await supabase.storage.from('receipts').createSignedUrl(a.file_path, 3600);
              return `<a href="${data?.signedUrl || '#'}" target="_blank" class="block text-green-600 hover:text-green-800 text-sm">📎 ${escapeHtml(a.file_name)}</a>`;
            })).then(a => a.join(''))}
          </div>
        </div>
      ` : ''}
    </div>
  `;
  createModal('Maelezo Kamili', html);
}

// ============================================================================
// EXPORT
// ============================================================================
function exportData(btnEl) {
  exportMenu(btnEl, filteredExpenses, `expenses-${todayISO()}`, [
    { key: 'expense_date', label: 'Tarehe', value: e => formatDate(e.expense_date) },
    { label: 'Code', value: e => e.budget_item?.code || '' },
    { label: 'Item', value: e => e.budget_item?.item || '' },
    { key: 'description', label: 'Maelezo' },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'amount', label: 'Kiasi (TZS)', value: e => Number(e.amount).toLocaleString() },
    { key: 'payment_method', label: 'Malipo' },
    { key: 'reference_number', label: 'Ref' },
    { key: 'status', label: 'Status' }
  ], { title: 'Ripoti ya Matumizi', orientation: 'landscape' });
}
