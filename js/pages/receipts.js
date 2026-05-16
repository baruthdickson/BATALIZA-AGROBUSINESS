// ============================================================================
// RECEIPTS - Risiti Zangu (kwa Muhasibu)
// ============================================================================
import { supabase } from '../supabase.js';
import { getCurrentProfile, isAccountant, isPM } from '../auth.js';
import { formatTZS, formatNumber, formatDate, todayISO, toast, escapeHtml, debounce, exportMenu } from '../utils.js';

let allReceipts = [];
let filteredReceipts = [];
let plots = [];

export async function initReceipts() {
  await Promise.all([loadPlots(), loadReceipts()]);
  bindEvents();
  renderStats();
  renderReceipts();
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

async function loadReceipts() {
  const profile = getCurrentProfile();
  
  // Muhasibu anaona risiti zake tu, PM anaona zote
  let query = supabase
    .from('expense_requests')
    .select('*, plot:plots(name, code), budget_item:budget_items(code, item), requester:requested_by(full_name, first_name, last_name), approver:approved_by(full_name)')
    .eq('status', 'approved')
    .not('receipt_number', 'is', null)
    .order('approved_at', { ascending: false });
  
  // Muhasibu anaona zake tu
  if (isAccountant() && profile?.id) {
    query = query.eq('requested_by', profile.id);
  }
  
  let { data, error } = await query;
  
  // Fallback bila joins
  if (error) {
    let fb = supabase.from('expense_requests').select('*')
      .eq('status', 'approved')
      .not('receipt_number', 'is', null)
      .order('approved_at', { ascending: false });
    if (isAccountant() && profile?.id) fb = fb.eq('requested_by', profile.id);
    const result = await fb;
    data = result.data;
    error = result.error;
  }
  
  if (error) {
    document.getElementById('receipts-grid').innerHTML = `<div class="col-span-full text-center text-red-600 py-8">${error.message}</div>`;
    return;
  }
  
  allReceipts = data || [];
  applyFilters();
}

function applyFilters() {
  const plotId = document.getElementById('filter-plot')?.value || '';
  const search = document.getElementById('filter-search')?.value.toLowerCase() || '';
  const fromDate = document.getElementById('filter-from')?.value;
  const toDate = document.getElementById('filter-to')?.value;
  
  filteredReceipts = allReceipts.filter(r => {
    if (plotId && r.plot_id != plotId) return false;
    const dateStr = r.approved_at?.split('T')[0] || r.request_date;
    if (fromDate && dateStr < fromDate) return false;
    if (toDate && dateStr > toDate) return false;
    if (search) {
      const hay = `${r.receipt_number || ''} ${r.request_number || ''} ${r.purpose} ${r.supplier_name || ''} ${r.budget_item?.item || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
  renderReceipts();
  renderStats();
}

function renderStats() {
  const total = filteredReceipts.reduce((s, r) => s + Number(r.amount), 0);
  const thisMonth = filteredReceipts.filter(r => {
    const d = new Date(r.approved_at || r.request_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthTotal = thisMonth.reduce((s, r) => s + Number(r.amount), 0);
  
  const el = document.getElementById('receipts-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="stat-card">
        <div class="stat-label">Jumla ya Risiti</div>
        <div class="stat-value">${filteredReceipts.length}</div>
        <div class="stat-sub money">${formatTZS(total)}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Mwezi Huu</div>
        <div class="stat-value">${thisMonth.length}</div>
        <div class="stat-sub money">${formatTZS(monthTotal)}</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-label">Wastani kwa Risiti</div>
        <div class="stat-value money" style="font-size:1.5rem">${formatTZS(filteredReceipts.length > 0 ? total / filteredReceipts.length : 0)}</div>
        <div class="stat-sub">Average per receipt</div>
      </div>
    </div>`;
}

function renderReceipts() {
  const grid = document.getElementById('receipts-grid');
  if (!grid) return;
  
  if (filteredReceipts.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <div class="text-6xl mb-3">🧾</div>
        <p class="text-gray-600 mb-3">Hakuna risiti bado</p>
        <a href="expense-requests.html" class="btn btn-primary inline-flex">+ Tengeneza Ombi</a>
      </div>`;
    return;
  }
  
  grid.innerHTML = filteredReceipts.map(r => `
    <div class="card hover:shadow-lg transition-all" style="border-top: 4px solid #16A34A;">
      <div class="flex justify-between items-start mb-3">
        <div>
          <div class="text-xs text-gray-500 uppercase tracking-wider">Receipt #</div>
          <div class="font-mono font-bold text-green-900">${escapeHtml(r.receipt_number)}</div>
        </div>
        <span class="badge badge-success">✓ Imeidhinishwa</span>
      </div>
      
      <div class="space-y-2 mb-4">
        <div>
          <div class="text-xs text-gray-500">Kusudi</div>
          <div class="font-medium text-sm">${escapeHtml(r.purpose)}</div>
        </div>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div class="text-xs text-gray-500">Tarehe</div>
            <div>${formatDate(r.approved_at || r.request_date)}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500">Shamba</div>
            <div><span class="badge badge-info text-xs">${escapeHtml(r.plot?.code || '-')}</span></div>
          </div>
        </div>
        ${r.supplier_name ? `<div class="text-xs"><span class="text-gray-500">Supplier:</span> <strong>${escapeHtml(r.supplier_name)}</strong></div>` : ''}
        ${r.budget_item ? `<div class="text-xs text-gray-500">${escapeHtml(r.budget_item.code)} - ${escapeHtml(r.budget_item.item)}</div>` : ''}
      </div>
      
      <div class="border-t pt-3 mb-3">
        <div class="text-xs text-gray-500 uppercase">Kiasi</div>
        <div class="text-2xl font-bold money money-positive">${formatTZS(r.amount)}</div>
      </div>
      
      <div class="flex gap-2">
        <button onclick="window.printReceipt(${r.id})" class="btn btn-primary flex-1 justify-center text-sm">📄 Chapisha PDF</button>
        <button onclick="window.viewReceipt(${r.id})" class="btn btn-secondary text-sm">👁️</button>
      </div>
    </div>
  `).join('');
}

function bindEvents() {
  document.getElementById('filter-search')?.addEventListener('input', debounce(applyFilters, 300));
  document.getElementById('filter-plot')?.addEventListener('change', applyFilters);
  document.getElementById('filter-from')?.addEventListener('change', applyFilters);
  document.getElementById('filter-to')?.addEventListener('change', applyFilters);
  document.getElementById('clear-filters')?.addEventListener('click', () => {
    ['filter-search', 'filter-plot', 'filter-from', 'filter-to'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    applyFilters();
  });
  document.getElementById('export-all')?.addEventListener('click', (e) => exportReceipts(e.currentTarget));
  
  window.printReceipt = (id) => printReceiptPDF(allReceipts.find(r => r.id === id));
  window.viewReceipt = (id) => viewReceiptModal(allReceipts.find(r => r.id === id));
}

function viewReceiptModal(r) {
  if (!r) return;
  const html = `
    <div class="space-y-3 max-h-96 overflow-y-auto">
      <div class="bg-green-50 border-2 border-green-300 p-3 rounded">
        <div class="text-xs text-green-700 uppercase">Receipt Number</div>
        <div class="text-xl font-mono font-bold text-green-900">${escapeHtml(r.receipt_number)}</div>
      </div>
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div><div class="text-xs text-gray-500">Ombi #</div><div class="font-mono">${escapeHtml(r.request_number || '-')}</div></div>
        <div><div class="text-xs text-gray-500">Tarehe</div><div>${formatDate(r.approved_at || r.request_date)}</div></div>
        <div><div class="text-xs text-gray-500">Shamba</div><div>${escapeHtml(r.plot?.name || '-')}</div></div>
        <div><div class="text-xs text-gray-500">Kipengele</div><div>${escapeHtml(r.budget_item?.code || '')} - ${escapeHtml(r.budget_item?.item || '')}</div></div>
      </div>
      <div><div class="text-xs text-gray-500">Kusudi</div><div class="font-medium">${escapeHtml(r.purpose)}</div></div>
      ${r.description ? `<div><div class="text-xs text-gray-500">Maelezo</div><div>${escapeHtml(r.description)}</div></div>` : ''}
      <div class="grid grid-cols-2 gap-3">
        <div><div class="text-xs text-gray-500">Mtoa Bidhaa</div><div class="font-medium">${escapeHtml(r.supplier_name || '-')}</div></div>
        <div><div class="text-xs text-gray-500">Njia ya Malipo</div><div>${escapeHtml(r.payment_method || '-')}</div></div>
      </div>
      <div class="bg-green-100 p-3 rounded">
        <div class="text-xs text-green-700">JUMLA</div>
        <div class="text-2xl font-bold money money-positive">${formatTZS(r.amount)}</div>
      </div>
      ${r.approval_notes ? `<div><div class="text-xs text-gray-500">Maelezo ya Idhinisho</div><div class="bg-green-50 p-2 rounded">${escapeHtml(r.approval_notes)}</div></div>` : ''}
      <button onclick="window.printReceipt(${r.id})" class="btn btn-primary w-full justify-center">📄 Chapisha PDF</button>
    </div>`;
  
  // Create modal
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold text-green-900">Risiti #${escapeHtml(r.receipt_number)}</h2>
        <button class="text-gray-500 hover:text-red-600 text-2xl close-btn">×</button>
      </div>
      ${html}
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.close-btn').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

function printReceiptPDF(r) {
  if (!r || !r.receipt_number) {
    toast('Risiti haijatengenezwa', 'warning');
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Header
  doc.setFillColor(20, 83, 45);
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
  
  // Receipt # box
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
  
  // Date + request
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Tarehe / Date:', 15, 70);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(r.approved_at || r.request_date), 50, 70);
  doc.setFont('helvetica', 'normal');
  doc.text('Ombi No.:', 15, 77);
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
    doc.text(String(value || '-'), 75, y);
    y += 7;
  };
  
  drawRow('Aliyepokea / Recipient:', r.supplier_name);
  drawRow('Aliyeomba / Requested By:', r.requester?.full_name || '-');
  drawRow('Aliyeidhinisha / Approved By:', r.approver?.full_name || '-');
  drawRow('Shamba / Plot:', r.plot?.name);
  drawRow('Kipengele / Budget Item:', `${r.budget_item?.code || ''} - ${r.budget_item?.item || ''}`);
  drawRow('Kusudi / Purpose:', r.purpose, true);
  drawRow('Njia ya Malipo:', r.payment_method?.replace('_', ' ').toUpperCase());
  
  y += 5;
  doc.line(15, y, 195, y);
  y += 10;
  
  // Amount box
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
  
  if (r.approval_notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 83, 45);
    doc.text('Maelezo:', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(r.approval_notes, 180);
    doc.text(lines, 15, y);
    y += lines.length * 5;
  }
  
  // Signatures
  y = Math.max(y, 220);
  doc.setDrawColor(0, 0, 0);
  doc.line(20, y, 80, y);
  doc.line(130, y, 190, y);
  y += 5;
  doc.setFontSize(9);
  doc.text('Saini ya Muhasibu', 50, y, { align: 'center' });
  doc.text('Saini ya Project Manager', 160, y, { align: 'center' });
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Imezalishwa: ${new Date().toLocaleString('sw-TZ')}`, 105, 285, { align: 'center' });
  doc.text('BATALIZA AGROBUSINESS', 105, 290, { align: 'center' });
  
  doc.output('dataurlnewwindow', { filename: `Risiti-${r.receipt_number}.pdf` });
}

function exportReceipts(btnEl) {
  exportMenu(btnEl, filteredReceipts, `risiti-${todayISO()}`, [
    { key: 'receipt_number', label: 'Receipt #' },
    { key: 'request_number', label: 'Ombi #' },
    { label: 'Tarehe', value: r => formatDate(r.approved_at || r.request_date) },
    { label: 'Shamba', value: r => r.plot?.name || '' },
    { label: 'Kipengele', value: r => `${r.budget_item?.code || ''} - ${r.budget_item?.item || ''}` },
    { key: 'purpose', label: 'Kusudi' },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'amount', label: 'Kiasi (TZS)', value: r => formatNumber(r.amount) },
    { label: 'Aliyeidhinisha', value: r => r.approver?.full_name || '' }
  ], { title: 'Risiti Zangu', orientation: 'landscape' });
}
