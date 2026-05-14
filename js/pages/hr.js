// ============================================================================
// HR MODULE - Employees + Attendance
// ============================================================================

import { supabase } from '../supabase.js';
import { hasPermission, getCurrentProfile } from '../auth.js';
import { formatTZS, formatDate, todayISO, toast, confirm, createModal, exportToCSV, exportMenu, debounce, escapeHtml, generateEmployeeNumber } from '../utils.js';

let employees = [];
let categories = [];
let attendance = {};

export async function initHR() {
  await loadCategories();
  await loadEmployees();
  bindTabs();
  bindEvents();
  document.getElementById('att-date').value = todayISO();
}

// ============================================================================
// TABS
// ============================================================================
function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('border-b-2', 'border-green-500', 'text-green-900');
        b.classList.add('text-gray-500');
      });
      btn.classList.add('border-b-2', 'border-green-500', 'text-green-900');
      btn.classList.remove('text-gray-500');
      
      document.getElementById('tab-employees').classList.toggle('hidden', btn.dataset.tab !== 'employees');
      document.getElementById('tab-attendance').classList.toggle('hidden', btn.dataset.tab !== 'attendance');
      
      if (btn.dataset.tab === 'attendance') loadAttendance();
    };
  });
}

// ============================================================================
// LOAD DATA
// ============================================================================
async function loadCategories() {
  const { data } = await supabase.from('employee_categories').select('*').order('name');
  categories = data || [];
  
  const select = document.getElementById('filter-category');
  select.innerHTML = '<option value="">Zote</option>' + 
    categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

async function loadEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select(`*, category:employee_categories(id, name)`)
    .is('deleted_at', null)
    .order('first_name');
  
  if (error) { toast(error.message, 'error'); return; }
  employees = data || [];
  renderEmployees();
}

function renderEmployees() {
  const status = document.getElementById('filter-emp-status').value;
  const cat = document.getElementById('filter-category').value;
  const search = document.getElementById('filter-emp-search').value.toLowerCase();
  
  let filtered = employees;
  if (status) filtered = filtered.filter(e => e.status === status);
  if (cat) filtered = filtered.filter(e => e.employee_category_id == cat);
  if (search) filtered = filtered.filter(e => 
    `${e.first_name} ${e.last_name} ${e.phone || ''} ${e.nida_number || ''}`.toLowerCase().includes(search)
  );
  
  document.getElementById('emp-total').textContent = employees.length;
  document.getElementById('emp-active').textContent = employees.filter(e => e.status === 'active').length;
  document.getElementById('emp-leave').textContent = employees.filter(e => e.status === 'on_leave').length;
  document.getElementById('emp-terminated').textContent = employees.filter(e => e.status === 'terminated').length;
  
  const tbody = document.getElementById('employees-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-500 py-8">Hakuna wafanyakazi</td></tr>';
    return;
  }
  
  const statusBadge = (s) => {
    const map = { active: 'badge-success', inactive: 'badge-default', terminated: 'badge-danger', on_leave: 'badge-warning' };
    return `<span class="badge ${map[s]}">${s.replace('_', ' ')}</span>`;
  };
  
  const canShowSalary = hasPermission('hr', 'view_salary');
  
  tbody.innerHTML = filtered.map(e => `
    <tr>
      <td class="font-mono text-xs">${e.employee_number}</td>
      <td>
        <div class="font-medium">${escapeHtml(e.first_name)} ${escapeHtml(e.last_name)}</div>
        <div class="text-xs text-gray-500">${escapeHtml(e.email || '')}</div>
      </td>
      <td>${escapeHtml(e.category?.name || '-')}</td>
      <td class="text-xs">${escapeHtml(e.nida_number || '-')}</td>
      <td>${escapeHtml(e.phone || '-')}</td>
      <td class="text-right">${canShowSalary ? formatTZS(e.salary) : '••••••'}</td>
      <td>${statusBadge(e.status)}</td>
      <td class="whitespace-nowrap">
        ${hasPermission('hr', 'edit') ? `<button class="text-green-600 text-sm" onclick="window.editEmp(${e.id})">✏️</button>` : ''}
        ${hasPermission('hr', 'delete') ? `<button class="text-red-600 text-sm ml-1" onclick="window.deleteEmp(${e.id})">🗑</button>` : ''}
      </td>
    </tr>
  `).join('');
}

// ============================================================================
// EMPLOYEE CRUD
// ============================================================================
function openEmployeeModal(emp = null) {
  if (categories.length === 0) {
    toast('Tengeneza categories kwanza', 'warning');
    return;
  }
  
  const html = `
    <form id="emp-form" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Namba ya Mfanyakazi</label>
          <input type="text" name="employee_number" required class="form-input" value="${emp?.employee_number || generateEmployeeNumber()}">
        </div>
        <div>
          <label class="form-label">Category</label>
          <select name="employee_category_id" required class="form-select">
            ${categories.map(c => `<option value="${c.id}" ${emp?.employee_category_id == c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="form-label">Jina la Kwanza</label>
          <input type="text" name="first_name" required class="form-input" value="${escapeHtml(emp?.first_name || '')}">
        </div>
        <div>
          <label class="form-label">Jina la Kati</label>
          <input type="text" name="middle_name" class="form-input" value="${escapeHtml(emp?.middle_name || '')}">
        </div>
        <div>
          <label class="form-label">Jina la Mwisho</label>
          <input type="text" name="last_name" required class="form-input" value="${escapeHtml(emp?.last_name || '')}">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">NIDA</label>
          <input type="text" name="nida_number" class="form-input" value="${escapeHtml(emp?.nida_number || '')}">
        </div>
        <div>
          <label class="form-label">Simu</label>
          <input type="tel" name="phone" class="form-input" value="${escapeHtml(emp?.phone || '')}">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Email</label>
          <input type="email" name="email" class="form-input" value="${escapeHtml(emp?.email || '')}">
        </div>
        <div>
          <label class="form-label">Gender</label>
          <select name="gender" class="form-select">
            <option value="">--</option>
            <option value="male" ${emp?.gender === 'male' ? 'selected' : ''}>Mwanaume</option>
            <option value="female" ${emp?.gender === 'female' ? 'selected' : ''}>Mwanamke</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Tarehe ya Kuajiriwa</label>
          <input type="date" name="hire_date" required class="form-input" value="${emp?.hire_date || todayISO()}">
        </div>
        <div>
          <label class="form-label">Mshahara (TZS)</label>
          <input type="number" step="0.01" name="salary" required class="form-input" value="${emp?.salary || ''}">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Mobile Money</label>
          <input type="text" name="mobile_money_number" class="form-input" value="${escapeHtml(emp?.mobile_money_number || '')}">
        </div>
        <div>
          <label class="form-label">Status</label>
          <select name="status" class="form-select">
            <option value="active" ${emp?.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="inactive" ${emp?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
            <option value="on_leave" ${emp?.status === 'on_leave' ? 'selected' : ''}>On Leave</option>
            <option value="terminated" ${emp?.status === 'terminated' ? 'selected' : ''}>Terminated</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Emergency Contact</label>
          <input type="text" name="emergency_contact_name" class="form-input" value="${escapeHtml(emp?.emergency_contact_name || '')}">
        </div>
        <div>
          <label class="form-label">Simu ya Emergency</label>
          <input type="tel" name="emergency_contact_phone" class="form-input" value="${escapeHtml(emp?.emergency_contact_phone || '')}">
        </div>
      </div>
      <div>
        <label class="form-label">Anwani</label>
        <textarea name="address" class="form-textarea" rows="2">${escapeHtml(emp?.address || '')}</textarea>
      </div>
      <div class="flex justify-end gap-2 pt-3">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Hifadhi</button>
      </div>
    </form>
  `;
  
  const { overlay, close } = createModal(emp ? 'Hariri Mfanyakazi' : 'Mfanyakazi Mpya', html, { size: 'lg' });
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#emp-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const profile = getCurrentProfile();
    const data = {};
    for (const [k, v] of fd.entries()) data[k] = v || null;
    data.employee_category_id = parseInt(data.employee_category_id);
    data.salary = parseFloat(data.salary);
    if (!emp) data.created_by = profile.id;
    
    const { error } = emp
      ? await supabase.from('employees').update(data).eq('id', emp.id)
      : await supabase.from('employees').insert(data);
    if (error) { toast(error.message, 'error'); return; }
    toast(emp ? 'Yamebadilishwa' : 'Yameongezwa', 'success');
    close();
    await loadEmployees();
  };
}

// ============================================================================
// ATTENDANCE
// ============================================================================
async function loadAttendance() {
  const date = document.getElementById('att-date').value;
  if (!date) return;
  
  // Get all active employees
  const activeEmps = employees.filter(e => e.status === 'active');
  
  // Get existing attendance for date
  const { data: existing } = await supabase
    .from('attendance')
    .select('*')
    .eq('attendance_date', date);
  
  const existingMap = {};
  (existing || []).forEach(a => { existingMap[a.employee_id] = a; });
  attendance = existingMap;
  
  const tbody = document.getElementById('attendance-tbody');
  if (activeEmps.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-8">Hakuna wafanyakazi active</td></tr>';
    return;
  }
  
  tbody.innerHTML = activeEmps.map(e => {
    const a = existingMap[e.id];
    return `
      <tr data-emp-id="${e.id}">
        <td><div class="font-medium">${escapeHtml(e.first_name)} ${escapeHtml(e.last_name)}</div></td>
        <td class="text-xs text-gray-500">${escapeHtml(e.category?.name || '-')}</td>
        <td>
          <select class="form-select att-status" style="min-width:130px">
            <option value="present" ${a?.status === 'present' ? 'selected' : ''}>Present</option>
            <option value="absent" ${a?.status === 'absent' ? 'selected' : ''}>Absent</option>
            <option value="half_day" ${a?.status === 'half_day' ? 'selected' : ''}>Half Day</option>
            <option value="leave" ${a?.status === 'leave' ? 'selected' : ''}>Leave</option>
            <option value="sick" ${a?.status === 'sick' ? 'selected' : ''}>Sick</option>
            <option value="holiday" ${a?.status === 'holiday' ? 'selected' : ''}>Holiday</option>
          </select>
        </td>
        <td><input type="time" class="form-input att-checkin" style="width:120px" value="${a?.check_in_time || ''}"></td>
        <td><input type="time" class="form-input att-checkout" style="width:120px" value="${a?.check_out_time || ''}"></td>
        <td><input type="text" class="form-input att-notes" placeholder="Notes..." value="${escapeHtml(a?.notes || '')}"></td>
      </tr>
    `;
  }).join('');
}

async function saveAttendance() {
  const date = document.getElementById('att-date').value;
  if (!date) { toast('Chagua tarehe', 'warning'); return; }
  
  const profile = getCurrentProfile();
  const rows = document.querySelectorAll('#attendance-tbody tr[data-emp-id]');
  const records = Array.from(rows).map(tr => ({
    employee_id: parseInt(tr.dataset.empId),
    attendance_date: date,
    status: tr.querySelector('.att-status').value,
    check_in_time: tr.querySelector('.att-checkin').value || null,
    check_out_time: tr.querySelector('.att-checkout').value || null,
    notes: tr.querySelector('.att-notes').value || null,
    recorded_by: profile.id
  }));
  
  const { error } = await supabase.from('attendance').upsert(records, { onConflict: 'employee_id,attendance_date' });
  if (error) { toast(error.message, 'error'); return; }
  toast(`Mahudhurio ya ${records.length} yamehifadhiwa`, 'success');
}

// ============================================================================
// EVENTS
// ============================================================================
function bindEvents() {
  document.getElementById('filter-category').onchange = renderEmployees;
  document.getElementById('filter-emp-status').onchange = renderEmployees;
  document.getElementById('filter-emp-search').oninput = debounce(renderEmployees);
  document.getElementById('add-emp-btn').onclick = () => openEmployeeModal();
  document.getElementById('export-emp-btn').onclick = (e) => {
    exportMenu(e.currentTarget, employees, `employees-${todayISO()}`, [
      { key: 'employee_number', label: '#' },
      { key: 'first_name', label: 'First' },
      { key: 'last_name', label: 'Last' },
      { label: 'Category', value: e => e.category?.name || '' },
      { key: 'nida_number', label: 'NIDA' },
      { key: 'phone', label: 'Phone' },
      { key: 'salary', label: 'Salary (TZS)', value: e => Number(e.salary || 0).toLocaleString() },
      { key: 'status', label: 'Status' }
    ], { title: 'Orodha ya Wafanyakazi' });
  };
  document.getElementById('att-date').onchange = loadAttendance;
  document.getElementById('save-attendance-btn').onclick = saveAttendance;
  
  window.editEmp = (id) => openEmployeeModal(employees.find(e => e.id === id));
  window.deleteEmp = async (id) => {
    if (!await confirm('Una hakika unataka kufuta mfanyakazi huyu?')) return;
    const { error } = await supabase.from('employees').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Amefutwa', 'success');
    await loadEmployees();
  };
}
