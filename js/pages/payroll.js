// ============================================================================
// PAYROLL MODULE
// ============================================================================

import { supabase } from '../supabase.js';
import { hasPermission, getCurrentProfile } from '../auth.js';
import { formatTZS, toast, confirm, createModal, escapeHtml } from '../utils.js';

let periods = [];
let currentPeriod = null;
let items = [];

export async function initPayroll() {
  await loadPeriods();
  bindEvents();
}

async function loadPeriods() {
  const { data } = await supabase.from('payroll_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false });
  periods = data || [];
  
  const sel = document.getElementById('period-select');
  if (periods.length === 0) {
    sel.innerHTML = '<option>Hakuna period</option>';
    return;
  }
  
  sel.innerHTML = periods.map(p => `<option value="${p.id}">${p.month}/${p.year} - ${p.status}</option>`).join('');
  currentPeriod = periods[0];
  await loadItems();
}

async function loadItems() {
  if (!currentPeriod) return;
  const { data } = await supabase
    .from('payroll_items')
    .select(`*, employee:employees(first_name, last_name, employee_number)`)
    .eq('payroll_period_id', currentPeriod.id);
  items = data || [];
  render();
}

function render() {
  const total = items.reduce((s, i) => s + Number(i.net_pay), 0);
  const paid = items.filter(i => i.payment_status === 'paid').reduce((s, i) => s + Number(i.net_pay), 0);
  const pending = items.filter(i => i.payment_status === 'pending').reduce((s, i) => s + Number(i.net_pay), 0);
  
  document.getElementById('stat-emps').textContent = items.length;
  document.getElementById('stat-total').textContent = formatTZS(total);
  document.getElementById('stat-paid').textContent = formatTZS(paid);
  document.getElementById('stat-pending').textContent = formatTZS(pending);
  
  const tbody = document.getElementById('payroll-tbody');
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-gray-500 py-8">Hakuna payroll items. Bonyeza "Tengeneza kutoka Mahudhurio"</td></tr>';
    return;
  }
  
  tbody.innerHTML = items.map(i => `
    <tr>
      <td>
        <div class="font-medium">${escapeHtml(i.employee?.first_name)} ${escapeHtml(i.employee?.last_name)}</div>
        <div class="text-xs text-gray-500">${i.employee?.employee_number}</div>
      </td>
      <td class="text-right">${formatTZS(i.basic_salary)}</td>
      <td class="text-right">${formatTZS(i.allowances)}</td>
      <td class="text-right">${formatTZS(i.overtime)}</td>
      <td class="text-right text-red-600">-${formatTZS(i.deductions)}</td>
      <td class="text-right">${i.days_worked}/${i.days_worked + i.days_absent}</td>
      <td class="text-right font-bold">${formatTZS(i.net_pay)}</td>
      <td><span class="badge ${i.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}">${i.payment_status}</span></td>
      <td>
        ${i.payment_status === 'pending' && hasPermission('payroll', 'process_payment') ? 
          `<button class="text-green-600 text-sm" onclick="window.payItem(${i.id})">💰 Lipa</button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function generateFromAttendance() {
  if (!currentPeriod) { toast('Chagua period', 'warning'); return; }
  if (!await confirm('Tengeneza payroll kutoka mahudhurio? Items zilizopo zitabadilishwa.')) return;
  
  // Get all active employees
  const { data: emps } = await supabase.from('employees').select('*').eq('status', 'active').is('deleted_at', null);
  
  // Get attendance for period
  const { data: attendance } = await supabase
    .from('attendance')
    .select('employee_id, status')
    .gte('attendance_date', currentPeriod.start_date)
    .lte('attendance_date', currentPeriod.end_date);
  
  // Count days per employee
  const counts = {};
  (attendance || []).forEach(a => {
    if (!counts[a.employee_id]) counts[a.employee_id] = { present: 0, absent: 0 };
    if (['present', 'holiday'].includes(a.status)) counts[a.employee_id].present++;
    else if (a.status === 'half_day') counts[a.employee_id].present += 0.5;
    else counts[a.employee_id].absent++;
  });
  
  // Create payroll items
  const records = emps.map(e => {
    const c = counts[e.id] || { present: 0, absent: 0 };
    return {
      payroll_period_id: currentPeriod.id,
      employee_id: e.id,
      basic_salary: Number(e.salary),
      allowances: 0,
      overtime: 0,
      deductions: 0,
      days_worked: Math.round(c.present),
      days_absent: c.absent
    };
  });
  
  if (records.length === 0) { toast('Hakuna wafanyakazi', 'warning'); return; }
  
  // Delete existing then insert
  await supabase.from('payroll_items').delete().eq('payroll_period_id', currentPeriod.id);
  const { error } = await supabase.from('payroll_items').insert(records);
  if (error) { toast(error.message, 'error'); return; }
  
  toast(`Payroll ya wafanyakazi ${records.length} imetengenezwa`, 'success');
  await loadItems();
}

function openPeriodModal() {
  const html = `
    <form id="pp-form" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Mwezi</label>
          <select name="month" required class="form-select">
            ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => `<option value="${i+1}">${m}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Mwaka</label>
          <input type="number" name="year" required class="form-input" value="${new Date().getFullYear()}">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Anza</label>
          <input type="date" name="start_date" required class="form-input">
        </div>
        <div>
          <label class="form-label">Maliza</label>
          <input type="date" name="end_date" required class="form-input">
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-3">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Hifadhi</button>
      </div>
    </form>
  `;
  const { overlay, close } = createModal('Period Mpya', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#pp-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { error } = await supabase.from('payroll_periods').insert({
      month: parseInt(fd.get('month')),
      year: parseInt(fd.get('year')),
      start_date: fd.get('start_date'),
      end_date: fd.get('end_date'),
      status: 'draft'
    });
    if (error) { toast(error.message, 'error'); return; }
    toast('Imeundwa', 'success');
    close();
    await loadPeriods();
  };
}

function bindEvents() {
  document.getElementById('period-select').onchange = async (e) => {
    currentPeriod = periods.find(p => p.id == e.target.value);
    await loadItems();
  };
  document.getElementById('add-period-btn').onclick = openPeriodModal;
  document.getElementById('generate-btn').onclick = generateFromAttendance;
  
  window.payItem = async (id) => {
    if (!await confirm('Thibitisha kulipa?')) return;
    const { error } = await supabase.from('payroll_items').update({
      payment_status: 'paid',
      payment_date: new Date().toISOString().split('T')[0]
    }).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Imelipwa', 'success');
    await loadItems();
  };
}
