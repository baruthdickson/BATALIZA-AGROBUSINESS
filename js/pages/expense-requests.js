// ============================================================================
// EXPENSE REQUESTS - Maombi ya Pesa (Muhasibu ↔ PM)
// ============================================================================
import { supabase } from '../supabase.js';
import { hasPermission, getCurrentProfile, isPM } from '../auth.js';
import { formatTZS, formatDate, todayISO, toast, confirm, createModal, escapeHtml, logAction, formatNumber, debounce } from '../utils.js';

let allRequests = [];
let filteredRequests = [];
let plots = [];
let budgetItems = [];

export async function initExpenseRequests() {
  await Promise.all([loadPlots(), loadBudgetItems(), loadRequests()]);
  bindEvents();
  renderStats();
}

async function loadPlots() {
  const { data } = await supabase.from('plots').select('*').order('code');
  plots = data || [];
  const filter = document.getElementById('filter-plot');
  if (filter) {
    filter.innerHTML = '<option value="">Mashamba Yote</option>' +
      plots.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  }
}

async function loadBudgetItems() {
  const { data } = await supabase
    .from('budget_items')
    .select('id, code, item, category_id, item_type, budget_categories(name, code)')
    .eq('item_type', 'leaf')
    .order('code');
  budgetItems = data || [];
}

async function loadRequests() {
  // Bulletproof query - try with joins, fall back if needed
  let { data, error } = await supabase
    .from('expense_requests')
    .select('*, plot:plots(name, code), budget_item:budget_items(code, item), requester:requested_by(full_name, first_name, last_name), approver:approved_by(full_name)')
    .order('created_at', { ascending: false })
    .limit(500);
  
  if (error) {
    const fb = await supabase.from('expense_requests').select('*').order('created_at', { ascending: false }).limit(500);
    data = fb.data;
    error = fb.error;
  }
  
  if (error) {
    document.getElementById('requests-tbody').innerHTML = `<tr><td colspan="8" class="text-center text-red-600 py-8">${error.message}</td></tr>`;
    return;
  }
  
  allRequests = data || [];
  applyFilters();
}

function renderStats() {
  const pending = allRequests.filter(r => r.status === 'pending');
  const approved = allRequests.filter(r => r.status === 'approved');
  const rejected = allRequests.filter(r => r.status === 'rejected');
  
  const totalPending = pending.reduce((s, r) => s + Number(r.amount), 0);
  const totalApproved = approved.reduce((s, r) => s + Number(r.amount), 0);
  
  const el = document.getElementById('request-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="stat-card orange">
        <div class="stat-label">Maombi Yanasubiri</div>
        <div class="stat-value">${pending.length}</div>
        <div class="stat-sub money">${formatTZS(totalPending)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Yaliyoidhinishwa</div>
        <div class="stat-value">${approved.length}</div>
        <div class="stat-sub money">${formatTZS(totalApproved)}</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">Yaliyokataliwa</div>
        <div class="stat-value">${rejected.length}</div>
        <div class="stat-sub">${rejected.length > 0 ? formatTZS(rejected.reduce((s, r) => s + Number(r.amount), 0)) : 'Hakuna'}</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-label">Jumla ya Maombi</div>
        <div class="stat-value">${allRequests.length}</div>
        <div class="stat-sub">Tangu mwanzo</div>
      </div>
    </div>`;
}

function applyFilters() {
  const status = document.getElementById('filter-status')?.value || '';
  const plotId = document.getElementById('filter-plot')?.value || '';
  const search = document.getElementById('filter-search')?.value.toLowerCase() || '';
  
  filteredRequests = allRequests.filter(r => {
    if (status && r.status !== status) return false;
    if (plotId && r.plot_id != plotId) return false;
    if (search) {
      const haystack = `${r.request_number || ''} ${r.purpose} ${r.supplier_name || ''} ${r.budget_item?.item || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  renderRequests();
  renderStats();
}

function renderRequests() {
  const tbody = document.getElementById('requests-tbody');
  if (!tbody) return;
  
  if (filteredRequests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500 py-12">
      <div class="text-5xl mb-2">📋</div>
      <div>Hakuna maombi yaliyopatikana</div>
      <button onclick="window.addRequest()" class="btn btn-primary mt-3">+ Tengeneza Ombi</button>
    </td></tr>`;
    return;
  }
  
  tbody.innerHTML = filteredRequests.map(r => {
    const statusBadge = {
      pending: '<span class="badge badge-warning">⏳ Inasubiri</span>',
      approved: '<span class="badge badge-success">✓ Imeidhinishwa</span>',
      rejected: '<span class="badge badge-danger">✗ Imekataliwa</span>',
      completed: '<span class="badge badge-info">📋 Imekamilika</span>'
    }[r.status] || r.status;
    
    return `
      <tr>
        <td class="text-xs font-bold">${escapeHtml(r.request_number || '-')}</td>
        <td class="text-sm whitespace-nowrap">${formatDate(r.request_date)}</td>
        <td>${r.plot ? `<span class="badge badge-info">${escapeHtml(r.plot.code)}</span>` : '-'}</td>
        <td>
          <div class="font-medium">${escapeHtml(r.purpose)}</div>
          ${r.budget_item ? `<div class="text-xs text-gray-500">${escapeHtml(r.budget_item.code)} - ${escapeHtml(r.budget_item.item)}</div>` : ''}
        </td>
        <td class="text-right money font-bold">${formatNumber(r.amount)}</td>
        <td>${statusBadge}</td>
        <td>${r.receipt_number ? `<button onclick="window.printReceipt(${r.id})" class="text-blue-600 text-xs font-mono hover:underline">📄 ${escapeHtml(r.receipt_number)}</button>` : '-'}</td>
        <td class="whitespace-nowrap">
          <button class="text-blue-600" onclick="window.viewRequest(${r.id})" title="Tazama">👁️</button>
          ${r.status === 'pending' && isPM() ? `
            <button class="text-green-600 ml-2" onclick="window.approveRequest(${r.id})" title="Idhinisha">✓</button>
            <button class="text-red-600 ml-2" onclick="window.rejectRequest(${r.id})" title="Kataa">✗</button>
          ` : ''}
          ${r.status === 'pending' ? `<button class="text-red-700 ml-2" onclick="window.deleteRequest(${r.id})" title="Futa">🗑️</button>` : ''}
        </td>
      </tr>`;
  }).join('');
}

function bindEvents() {
  document.getElementById('add-request-btn')?.addEventListener('click', () => openRequestModal());
  document.getElementById('filter-status')?.addEventListener('change', applyFilters);
  document.getElementById('filter-plot')?.addEventListener('change', applyFilters);
  document.getElementById('filter-search')?.addEventListener('input', debounce(applyFilters, 300));
  document.getElementById('clear-filters')?.addEventListener('click', () => {
    ['filter-status', 'filter-plot', 'filter-search'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    applyFilters();
  });
  
  window.addRequest = () => openRequestModal();
  window.viewRequest = (id) => viewRequestModal(allRequests.find(r => r.id === id));
  window.approveRequest = (id) => approveRequestModal(id);
  window.rejectRequest = (id) => rejectRequestModal(id);
  window.printReceipt = (id) => printReceipt(allRequests.find(r => r.id === id));
  window.deleteRequest = async (id) => {
    if (!await confirm('Una uhakika unataka kufuta ombi hili?')) return;
    const { error } = await supabase.from('expense_requests').delete().eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Imefutwa', 'success');
    await loadRequests();
  };
}

function openRequestModal(request = null) {
  // Group budget items by category
  const itemsByCategory = {};
  budgetItems.forEach(b => {
    const catName = b.budget_categories?.name || 'Other';
    if (!itemsByCategory[catName]) itemsByCategory[catName] = [];
    itemsByCategory[catName].push(b);
  });
  
  const html = `
    <form id="req-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Tarehe <span class="text-red-500">*</span></label>
          <input type="date" name="request_date" required class="form-input" value="${request?.request_date || todayISO()}">
        </div>
        <div>
          <label class="form-label">Shamba <span class="text-red-500">*</span></label>
          <select name="plot_id" required class="form-select">
            <option value="">-- Chagua Shamba --</option>
            ${plots.map(p => `<option value="${p.id}" ${request?.plot_id == p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <div>
        <label class="form-label">Aina ya Matumizi (Budget Item) <span class="text-red-500">*</span></label>
        <select name="budget_item_id" required class="form-select">
          <option value="">-- Chagua Kipengele --</option>
          ${Object.entries(itemsByCategory).map(([catName, items]) => `
            <optgroup label="${escapeHtml(catName)}">
              ${items.map(b => `<option value="${b.id}" ${request?.budget_item_id == b.id ? 'selected' : ''}>${escapeHtml(b.code)} - ${escapeHtml(b.item)}</option>`).join('')}
            </optgroup>
          `).join('')}
        </select>
      </div>
      
      <div>
        <label class="form-label">Kusudi la Pesa <span class="text-red-500">*</span></label>
        <input type="text" name="purpose" required class="form-input" value="${request?.purpose || ''}" placeholder="Mfano: Ununuzi wa mbegu, mafuta, n.k.">
      </div>
      
      <div>
        <label class="form-label">Maelezo ya Ziada</label>
        <textarea name="description" class="form-textarea" rows="2">${request?.description || ''}</textarea>
      </div>
      
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Kiasi (TZS) <span class="text-red-500">*</span></label>
          <input type="number" step="0.01" name="amount" required class="form-input" value="${request?.amount || ''}" placeholder="0">
        </div>
        <div>
          <label class="form-label">Mtoa Bidhaa/Huduma</label>
          <input type="text" name="supplier_name" class="form-input" value="${request?.supplier_name || ''}" placeholder="Jina la duka au mtu">
        </div>
      </div>
      
      <div>
        <label class="form-label">Njia ya Malipo</label>
        <select name="payment_method" class="form-select">
          <option value="cash" ${request?.payment_method === 'cash' ? 'selected' : ''}>💵 Cash</option>
          <option value="mpesa" ${request?.payment_method === 'mpesa' ? 'selected' : ''}>📱 M-Pesa</option>
          <option value="tigo_pesa" ${request?.payment_method === 'tigo_pesa' ? 'selected' : ''}>📱 Tigo Pesa</option>
          <option value="airtel_money" ${request?.payment_method === 'airtel_money' ? 'selected' : ''}>📱 Airtel Money</option>
          <option value="bank" ${request?.payment_method === 'bank' ? 'selected' : ''}>🏦 Bank Transfer</option>
          <option value="cheque" ${request?.payment_method === 'cheque' ? 'selected' : ''}>📄 Cheque</option>
        </select>
      </div>
      
      <div class="bg-blue-50 p-3 rounded text-sm text-blue-900">
        💡 Baada ya kutuma ombi, Project Manager atapata notification na ataidhinisha au kukataa. Ukiidhinishwa, mfumo utatengeneza risiti automatic.
      </div>
      
      <div class="flex justify-end gap-2 pt-2 border-t">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Tuma Ombi</button>
      </div>
    </form>`;
  
  const { overlay, close } = createModal(request ? 'Hariri Ombi' : 'Ombi Jipya la Pesa', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#req-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Inahifadhi...';
    
    const fd = new FormData(e.target);
    const data = {
      request_date: fd.get('request_date'),
      plot_id: parseInt(fd.get('plot_id')),
      budget_item_id: parseInt(fd.get('budget_item_id')),
      purpose: fd.get('purpose'),
      description: fd.get('description') || null,
      amount: parseFloat(fd.get('amount')),
      supplier_name: fd.get('supplier_name') || null,
      payment_method: fd.get('payment_method') || 'cash',
      status: 'pending'
    };
    if (!request) {
      const profile = getCurrentProfile();
      if (profile?.id) data.requested_by = profile.id;
    }
    
    try {
      let result;
      if (request) result = await supabase.from('expense_requests').update(data).eq('id', request.id);
      else {
        // Smart retry
        result = await supabase.from('expense_requests').insert(data);
        let retry = 0;
        while (result.error && retry < 5) {
          const msg = result.error.message;
          const colMatch = msg.match(/['"]([a-z_]+)['"]/);
          if (colMatch && data[colMatch[1]] !== undefined) {
            delete data[colMatch[1]];
            result = await supabase.from('expense_requests').insert(data);
            retry++;
            continue;
          }
          break;
        }
      }
      if (result.error) throw result.error;
      
      await logAction(request ? 'update' : 'create', 'expense_requests', `Ombi: ${data.purpose} - ${formatTZS(data.amount)}`);
      toast(request ? 'Imebadilishwa' : 'Ombi limetumwa! Subiri idhinisho.', 'success');
      close();
      await loadRequests();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Imeshindikana', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Tuma Ombi';
    }
  };
}

function viewRequestModal(r) {
  if (!r) return;
  const html = `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div><div class="text-xs text-gray-500">Number</div><div class="font-bold">${escapeHtml(r.request_number || '-')}</div></div>
        <div><div class="text-xs text-gray-500">Tarehe</div><div class="font-medium">${formatDate(r.request_date)}</div></div>
        <div><div class="text-xs text-gray-500">Shamba</div><div class="font-medium">${escapeHtml(r.plot?.name || '-')}</div></div>
        <div><div class="text-xs text-gray-500">Kipengele cha Bajeti</div><div class="font-medium">${escapeHtml(r.budget_item?.code || '')} - ${escapeHtml(r.budget_item?.item || '')}</div></div>
      </div>
      <div><div class="text-xs text-gray-500">Kusudi</div><div class="font-medium">${escapeHtml(r.purpose)}</div></div>
      ${r.description ? `<div><div class="text-xs text-gray-500">Maelezo</div><div>${escapeHtml(r.description)}</div></div>` : ''}
      <div class="grid grid-cols-2 gap-3">
        <div><div class="text-xs text-gray-500">Kiasi</div><div class="text-xl font-bold money money-positive">${formatTZS(r.amount)}</div></div>
        <div><div class="text-xs text-gray-500">Mtoa Bidhaa</div><div class="font-medium">${escapeHtml(r.supplier_name || '-')}</div></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><div class="text-xs text-gray-500">Aliyeomba</div><div class="font-medium">${escapeHtml(r.requester?.full_name || r.requester?.first_name || '-')}</div></div>
        ${r.approver ? `<div><div class="text-xs text-gray-500">Aliyeidhinisha</div><div class="font-medium">${escapeHtml(r.approver.full_name)}</div></div>` : ''}
      </div>
      ${r.approval_notes ? `<div><div class="text-xs text-gray-500">Maelezo ya Idhinisho</div><div class="bg-green-50 p-2 rounded">${escapeHtml(r.approval_notes)}</div></div>` : ''}
      ${r.rejection_reason ? `<div><div class="text-xs text-gray-500">Sababu ya Kukataa</div><div class="bg-red-50 p-2 rounded">${escapeHtml(r.rejection_reason)}</div></div>` : ''}
      ${r.receipt_number ? `
        <div class="bg-green-50 border-2 border-green-300 p-3 rounded">
          <div class="text-xs text-green-700 font-bold uppercase">Receipt Number</div>
          <div class="text-xl font-mono font-bold text-green-900">${escapeHtml(r.receipt_number)}</div>
          <button onclick="window.printReceipt(${r.id})" class="btn btn-primary mt-2">📄 Chapisha Risiti</button>
        </div>
      ` : ''}
    </div>`;
  const { overlay, close } = createModal(`Ombi #${r.request_number}`, html);
}

function approveRequestModal(id) {
  const r = allRequests.find(x => x.id === id);
  if (!r) return;
  const html = `
    <form id="approve-form" class="space-y-3">
      <div class="bg-blue-50 p-3 rounded">
        <div class="text-sm">Unaidhinisha ombi la <strong class="money">${formatTZS(r.amount)}</strong></div>
        <div class="text-xs text-gray-600 mt-1">${escapeHtml(r.purpose)}</div>
      </div>
      <div>
        <label class="form-label">Maelezo ya Idhinisho (Optional)</label>
        <textarea name="notes" class="form-textarea" rows="2" placeholder="Mfano: Imeidhinishwa, tafadhali tumia kwa kusudi hili tu..."></textarea>
      </div>
      <div class="text-sm text-gray-600">
        ✓ Mfumo utatengeneza risiti automatic na kuingia kwenye matumizi
      </div>
      <div class="flex justify-end gap-2 pt-2 border-t">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">✓ Idhinisha</button>
      </div>
    </form>`;
  const { overlay, close } = createModal('Idhinisha Ombi', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#approve-form').onsubmit = async (e) => {
    e.preventDefault();
    const profile = getCurrentProfile();
    const updates = {
      status: 'approved',
      approved_by: profile?.id || null,
      approved_at: new Date().toISOString(),
      approval_notes: new FormData(e.target).get('notes') || null
    };
    const { error } = await supabase.from('expense_requests').update(updates).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    await logAction('approve', 'expense_requests', `Ameidhinisha ombi: ${r.request_number} - ${formatTZS(r.amount)}`);
    toast('Ombi limeidhinishwa! Risiti imetengenezwa.', 'success');
    close();
    await loadRequests();
  };
}

function rejectRequestModal(id) {
  const r = allRequests.find(x => x.id === id);
  if (!r) return;
  const html = `
    <form id="reject-form" class="space-y-3">
      <div class="bg-red-50 p-3 rounded">
        <div class="text-sm">Unakataa ombi la <strong class="money">${formatTZS(r.amount)}</strong></div>
      </div>
      <div>
        <label class="form-label">Sababu ya Kukataa <span class="text-red-500">*</span></label>
        <textarea name="reason" required class="form-textarea" rows="3" placeholder="Eleza kwa nini..."></textarea>
      </div>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-danger">✗ Kataa</button>
      </div>
    </form>`;
  const { overlay, close } = createModal('Kataa Ombi', html, 'max-w-md');
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#reject-form').onsubmit = async (e) => {
    e.preventDefault();
    const profile = getCurrentProfile();
    const updates = {
      status: 'rejected',
      approved_by: profile?.id || null,
      approved_at: new Date().toISOString(),
      rejection_reason: new FormData(e.target).get('reason')
    };
    const { error } = await supabase.from('expense_requests').update(updates).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    await logAction('reject', 'expense_requests', `Amekataa ombi: ${r.request_number}`);
    toast('Ombi limekataliwa', 'success');
    close();
    await loadRequests();
  };
}

// ============================================================================
// RECEIPT GENERATOR (Professional PDF)
// ============================================================================
function printReceipt(r) {
  if (!r || !r.receipt_number) {
    toast('Risiti haijatengenezwa bado', 'warning');
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Header - Logo placeholder + Company name
  doc.setFillColor(20, 83, 45); // Green-900
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('BATALIZA AGROBUSINESS', 105, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Tabora - Urambo, Tanzania', 105, 22, { align: 'center' });
  doc.text('Mfumo wa Usimamizi wa Bajeti na Matumizi', 105, 28, { align: 'center' });
  
  // Title
  doc.setTextColor(20, 83, 45);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RISITI YA MALIPO', 105, 50, { align: 'center' });
  doc.text('PAYMENT RECEIPT', 105, 58, { align: 'center' });
  
  // Receipt number box
  doc.setDrawColor(20, 83, 45);
  doc.setLineWidth(0.5);
  doc.rect(140, 65, 55, 15);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('RECEIPT NUMBER', 167.5, 70, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(r.receipt_number, 167.5, 76, { align: 'center' });
  
  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Tarehe / Date:', 15, 70);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(r.approved_at || r.request_date), 50, 70);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Ombi No. / Request:', 15, 77);
  doc.setFont('helvetica', 'bold');
  doc.text(r.request_number || '-', 50, 77);
  
  // Body
  let y = 95;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, 195, y);
  y += 8;
  
  const drawRow = (label, value, isBold = false) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(label, 15, y);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(String(value || '-'), 70, y);
    y += 7;
  };
  
  drawRow('Aliyepokea / Recipient:', r.supplier_name);
  drawRow('Aliyeomba / Requested By:', r.requester?.full_name || r.requester?.first_name || '-');
  drawRow('Aliyeidhinisha / Approved By:', r.approver?.full_name || '-');
  drawRow('Shamba / Plot:', r.plot?.name);
  drawRow('Kipengele cha Bajeti / Budget Item:', `${r.budget_item?.code || ''} - ${r.budget_item?.item || ''}`);
  drawRow('Kusudi / Purpose:', r.purpose, true);
  if (r.description) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('Maelezo / Description:', 15, y);
    y += 5;
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(r.description, 175);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 3;
  }
  drawRow('Njia ya Malipo / Payment Method:', r.payment_method?.replace('_', ' ').toUpperCase());
  
  y += 5;
  doc.line(15, y, 195, y);
  y += 10;
  
  // Amount box - prominent
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(20, 83, 45);
  doc.setLineWidth(1);
  doc.rect(15, y, 180, 25, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text('JUMLA / TOTAL AMOUNT', 25, y + 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 83, 45);
  doc.text(`TZS ${Number(r.amount).toLocaleString('en-US')}`, 185, y + 16, { align: 'right' });
  y += 35;
  
  // Approval notes
  if (r.approval_notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 83, 45);
    doc.text('Maelezo ya Idhinisho / Approval Notes:', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(r.approval_notes, 180);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 5;
  }
  
  // Signatures
  y = Math.max(y, 220);
  doc.setDrawColor(0, 0, 0);
  doc.line(20, y, 80, y);
  doc.line(130, y, 190, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Saini ya Muhasibu', 50, y, { align: 'center' });
  doc.text('Saini ya Project Manager', 160, y, { align: 'center' });
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Accountant Signature', 50, y, { align: 'center' });
  doc.text('Manager Signature', 160, y, { align: 'center' });
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Imezalishwa: ${new Date().toLocaleString('sw-TZ')}`, 105, 285, { align: 'center' });
  doc.text('BATALIZA AGROBUSINESS - Mfumo wa Usimamizi', 105, 290, { align: 'center' });
  
  // Open in new tab
  doc.output('dataurlnewwindow', { filename: `Risiti-${r.receipt_number}.pdf` });
}
