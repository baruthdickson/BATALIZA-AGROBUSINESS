// ============================================================================
// UTILS - Helper functions zinazotumiwa popote
// ============================================================================

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================
export function toast(message, type = 'success', duration = 3000) {
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };
  const icons = {
    success: '✓', error: '✗', warning: '⚠', info: 'ℹ'
  };
  
  const div = document.createElement('div');
  div.className = `fixed top-4 right-4 z-50 ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in`;
  div.innerHTML = `<span class="font-bold text-lg">${icons[type]}</span> <span>${message}</span>`;
  document.body.appendChild(div);
  
  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transition = 'opacity 0.3s';
    setTimeout(() => div.remove(), 300);
  }, duration);
}

// ============================================================================
// CONFIRM DIALOG
// ============================================================================
export function confirm(message, title = 'Thibitisha') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    overlay.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 class="text-xl font-bold text-green-900 mb-3">${title}</h3>
        <p class="text-gray-700 mb-6">${message}</p>
        <div class="flex justify-end gap-3">
          <button id="cancel-btn" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Hapana</button>
          <button id="confirm-btn" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">Ndiyo</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    overlay.querySelector('#cancel-btn').onclick = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('#confirm-btn').onclick = () => { overlay.remove(); resolve(true); };
  });
}

// ============================================================================
// FORMAT MONEY (TZS)
// ============================================================================
export function formatTZS(amount) {
  if (amount === null || amount === undefined) return 'TZS 0';
  return 'TZS ' + Number(amount).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('en-US');
}

// ============================================================================
// FORMAT DATE
// ============================================================================
export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('sw-TZ', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('sw-TZ', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// LOADING SPINNER
// ============================================================================
export function showLoading(container = document.body) {
  const loader = document.createElement('div');
  loader.id = 'global-loader';
  loader.className = 'fixed inset-0 bg-white bg-opacity-75 z-50 flex items-center justify-center';
  loader.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow-lg flex items-center gap-3">
      <div class="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
      <span class="text-green-900 font-medium">Inapakia...</span>
    </div>
  `;
  container.appendChild(loader);
}

export function hideLoading() {
  document.getElementById('global-loader')?.remove();
}

// ============================================================================
// MODAL
// ============================================================================
export function createModal(title, contentHTML, options = {}) {
  const { size = 'md', onClose } = options;
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };
  
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-40 flex items-start justify-center p-4 overflow-y-auto';
  overlay.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl ${sizes[size]} w-full my-8">
      <div class="flex justify-between items-center p-5 border-b border-gray-200">
        <h3 class="text-xl font-bold text-green-900">${title}</h3>
        <button class="modal-close text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
      </div>
      <div class="p-6">${contentHTML}</div>
    </div>
  `;
  
  const close = () => {
    overlay.remove();
    if (onClose) onClose();
  };
  
  overlay.querySelector('.modal-close').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  
  document.body.appendChild(overlay);
  return { overlay, close };
}

// ============================================================================
// PAGINATION HELPER
// ============================================================================
export function paginate(array, pageSize, pageNumber) {
  const start = (pageNumber - 1) * pageSize;
  return array.slice(start, start + pageSize);
}

// ============================================================================
// ESCAPE HTML (kuepuka XSS)
// ============================================================================
export function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// ============================================================================
// DEBOUNCE (kwa search)
// ============================================================================
export function debounce(func, wait = 300) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ============================================================================
// GENERATE EMPLOYEE NUMBER
// ============================================================================
export function generateEmployeeNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `EMP-${year}-${random}`;
}

// ============================================================================
// EXPORT - Dynamic library loader (SheetJS na jsPDF zinakuwa loaded on-demand)
// ============================================================================
let _xlsxLoaded = false;
let _pdfLoaded = false;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

async function loadXlsxLib() {
  if (_xlsxLoaded) return;
  await loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');
  _xlsxLoaded = true;
}

async function loadPdfLib() {
  if (_pdfLoaded) return;
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  _pdfLoaded = true;
}

// ============================================================================
// EXPORT TO EXCEL (.xlsx)
// ============================================================================
export async function exportToExcel(data, filename, columns, sheetName = 'Data') {
  if (!data || data.length === 0) {
    toast('Hakuna data ya ku-export', 'warning');
    return;
  }
  try {
    showLoading('Inaandaa Excel...');
    await loadXlsxLib();
    const rows = data.map(row => {
      const obj = {};
      columns.forEach(c => {
        let val = c.value ? c.value(row) : row[c.key];
        if (val === null || val === undefined) val = '';
        obj[c.label] = val;
      });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto column widths
    const colWidths = columns.map(c => ({
      wch: Math.max(c.label.length, 12)
    }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : filename + '.xlsx');
    hideLoading();
    toast('Excel imeshushwa', 'success');
  } catch (err) {
    hideLoading();
    console.error(err);
    toast('Imeshindikana ku-export Excel', 'error');
  }
}

// ============================================================================
// EXPORT TO PDF
// ============================================================================
export async function exportToPDF(data, filename, columns, options = {}) {
  if (!data || data.length === 0) {
    toast('Hakuna data ya ku-export', 'warning');
    return;
  }
  try {
    showLoading('Inaandaa PDF...');
    await loadPdfLib();
    const { jsPDF } = window.jspdf;
    const orientation = options.orientation || (columns.length > 6 ? 'landscape' : 'portrait');
    const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
    
    // Header - BATALIZA AGROBUSINESS branding
    doc.setFontSize(16);
    doc.setTextColor(20, 83, 45); // greenDeep
    doc.setFont(undefined, 'bold');
    doc.text('BATALIZA AGROBUSINESS', 14, 15);
    doc.setTextColor(34, 197, 94); // green
    doc.text(' BATALIZA AGROBUSINESS', 38, 15);
    
    // Title
    doc.setFontSize(13);
    doc.setTextColor(20, 83, 45);
    doc.setFont(undefined, 'bold');
    doc.text(options.title || filename, 14, 24);
    
    // Subtitle
    if (options.subtitle) {
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(options.subtitle, 14, 29);
    }
    
    // Timestamp
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont(undefined, 'normal');
    doc.text(`Imezalishwa: ${new Date().toLocaleString('sw-TZ')}`, 14, options.subtitle ? 34 : 30);
    
    // Table
    const headers = columns.map(c => c.label);
    const rows = data.map(row => columns.map(c => {
      let val = c.value ? c.value(row) : row[c.key];
      if (val === null || val === undefined) val = '';
      return String(val);
    }));
    
    doc.autoTable({
      startY: options.subtitle ? 38 : 34,
      head: [headers],
      body: rows,
      theme: 'striped',
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { top: 14, right: 14, bottom: 20, left: 14 },
      didDrawPage: (data) => {
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        const pageNum = data.pageNumber;
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Ukurasa ${pageNum} kati ya ${pageCount}  |  BATALIZA AGROBUSINESS © ${new Date().getFullYear()}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }
    });
    
    // Summary row at bottom if provided
    if (options.summary) {
      const finalY = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(10);
      doc.setTextColor(20, 83, 45);
      doc.setFont(undefined, 'bold');
      doc.text(options.summary, 14, finalY);
    }
    
    doc.save(filename.endsWith('.pdf') ? filename : filename + '.pdf');
    hideLoading();
    toast('PDF imeshushwa', 'success');
  } catch (err) {
    hideLoading();
    console.error(err);
    toast('Imeshindikana ku-export PDF', 'error');
  }
}

// ============================================================================
// EXPORT MENU - Dropdown ya CSV/Excel/PDF
// ============================================================================
export function exportMenu(buttonEl, data, filename, columns, options = {}) {
  const menu = document.createElement('div');
  menu.className = 'absolute bg-white border border-green-200 rounded-lg shadow-lg z-50 py-1 min-w-[160px]';
  menu.innerHTML = `
    <button class="export-csv w-full text-left px-4 py-2 hover:bg-green-50 text-sm flex items-center gap-2">
      <span>📄</span> CSV
    </button>
    <button class="export-excel w-full text-left px-4 py-2 hover:bg-green-50 text-sm flex items-center gap-2">
      <span>📊</span> Excel
    </button>
    <button class="export-pdf w-full text-left px-4 py-2 hover:bg-green-50 text-sm flex items-center gap-2">
      <span>📕</span> PDF
    </button>
  `;
  const rect = buttonEl.getBoundingClientRect();
  menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  menu.style.left = (rect.left + window.scrollX) + 'px';
  document.body.appendChild(menu);
  
  const closeMenu = (e) => {
    if (!menu.contains(e.target) && e.target !== buttonEl) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
  
  menu.querySelector('.export-csv').onclick = () => {
    exportToCSV(data, filename + '.csv', columns);
    menu.remove();
  };
  menu.querySelector('.export-excel').onclick = () => {
    exportToExcel(data, filename, columns);
    menu.remove();
  };
  menu.querySelector('.export-pdf').onclick = () => {
    exportToPDF(data, filename, columns, options);
    menu.remove();
  };
}

// ============================================================================
// EXPORT TO CSV
// ============================================================================
export function exportToCSV(data, filename, columns) {
  if (!data || data.length === 0) {
    toast('Hakuna data ya ku-export', 'warning');
    return;
  }
  
  const headers = columns.map(c => c.label).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      let val = c.value ? c.value(row) : row[c.key];
      if (val === null || val === undefined) val = '';
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('\n')) val = `"${val}"`;
      return val;
    }).join(',')
  );
  
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// AUDIT LOG
// ============================================================================
export async function logAction(supabase, action, module, entity, description = null) {
  try {
    await supabase.from('audit_logs').insert({
      action, module,
      entity_type: entity?.type || null,
      entity_id: entity?.id || null,
      description
    });
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}
