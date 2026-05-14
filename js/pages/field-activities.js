// ============================================================================
// FIELD ACTIVITIES MODULE
// ============================================================================

import { supabase } from '../supabase.js';
import { hasPermission, getCurrentProfile } from '../auth.js';
import { formatDate, todayISO, toast, confirm, createModal, debounce, escapeHtml } from '../utils.js';

let activities = [];
let budgetItems = [];
let plots = [];

export async function initFieldActivities() {
  await Promise.all([loadBudgetItems(), loadPlots()]);
  await loadActivities();
  bindEvents();
}

async function loadBudgetItems() {
  const { data } = await supabase.from('budget_items').select('id, code, item').order('code');
  budgetItems = data || [];
}

async function loadPlots() {
  const { data } = await supabase.from('plots').select('*').order('name');
  plots = data || [];
}

async function loadActivities() {
  const { data, error } = await supabase
    .from('field_activities')
    .select(`*, budget_item:budget_items(code, item), supervisor:employees(first_name, last_name)`)
    .order('planned_start_date');
  if (error) { toast(error.message, 'error'); return; }
  activities = data || [];
  render();
}

function render() {
  const status = document.getElementById('filter-status').value;
  const search = document.getElementById('filter-search').value.toLowerCase();
  
  let filtered = activities;
  if (status) filtered = filtered.filter(a => a.status === status);
  if (search) filtered = filtered.filter(a => `${a.name} ${a.budget_item?.code || ''}`.toLowerCase().includes(search));
  
  document.getElementById('stat-total').textContent = activities.length;
  document.getElementById('stat-active').textContent = activities.filter(a => a.status === 'in_progress').length;
  const tp = activities.reduce((s, a) => s + Number(a.planned_hectares || 0), 0);
  const td = activities.reduce((s, a) => s + Number(a.completed_hectares || 0), 0);
  document.getElementById('stat-planned').textContent = tp.toFixed(1) + ' ha';
  document.getElementById('stat-done').textContent = td.toFixed(1) + ' ha';
  
  const container = document.getElementById('activities-container');
  if (filtered.length === 0) {
    container.innerHTML = '<div class="card text-center text-gray-500 py-8">Hakuna shughuli</div>';
    return;
  }
  
  const statusBadge = (s) => {
    const map = { not_started: 'badge-default', in_progress: 'badge-warning', completed: 'badge-success', on_hold: 'badge-danger', cancelled: 'badge-default' };
    const labels = { not_started: 'Haijaanza', in_progress: 'Inaendelea', completed: 'Imekamilika', on_hold: 'Imesimamishwa', cancelled: 'Imefutwa' };
    return `<span class="badge ${map[s]}">${labels[s]}</span>`;
  };
  
  container.innerHTML = filtered.map(a => {
    const pct = Number(a.progress_percentage || 0);
    return `
      <div class="card">
        <div class="flex flex-wrap justify-between items-start gap-3 mb-3">
          <div>
            <h3 class="text-lg font-bold text-green-900">${escapeHtml(a.name)}</h3>
            <p class="text-xs text-gray-500 mt-1">${a.budget_item?.code || ''} - ${escapeHtml(a.budget_item?.item || '')}</p>
            <p class="text-xs text-gray-500">${formatDate(a.planned_start_date)} → ${formatDate(a.planned_end_date)}</p>
            ${a.supervisor ? `<p class="text-xs text-gray-500">👤 ${a.supervisor.first_name} ${a.supervisor.last_name}</p>` : ''}
          </div>
          <div class="text-right">
            ${statusBadge(a.status)}
            <div class="text-sm font-bold text-green-900 mt-1">${Number(a.completed_hectares).toFixed(1)} / ${Number(a.planned_hectares).toFixed(1)} ha</div>
            <div class="text-xs text-gray-500">${pct.toFixed(1)}%</div>
          </div>
        </div>
        <div class="progress">
          <div class="progress-bar" style="width: ${Math.min(pct, 100)}%"></div>
        </div>
        <div class="flex justify-between items-center mt-3">
          <div class="text-xs text-gray-500">${escapeHtml(a.description || '')}</div>
          <div class="flex gap-2">
            ${hasPermission('field_activities', 'edit') ? `
              <button class="text-green-600 text-sm" onclick="window.recordProgress(${a.id})">+ Progress</button>
              <button class="text-green-600 text-sm" onclick="window.editAct(${a.id})">✏️</button>
            ` : ''}
            ${hasPermission('field_activities', 'delete') ? `<button class="text-red-600 text-sm" onclick="window.deleteAct(${a.id})">🗑</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openModal(act = null) {
  if (budgetItems.length === 0) { toast('Tengeneza budget items kwanza', 'warning'); return; }
  
  const html = `
    <form id="act-form" class="space-y-3">
      <div>
        <label class="form-label">Jina la Shughuli</label>
        <input type="text" name="name" required class="form-input" value="${escapeHtml(act?.name || '')}">
      </div>
      <div>
        <label class="form-label">Kifungu cha Bajeti</label>
        <select name="budget_item_id" required class="form-select">
          ${budgetItems.map(b => `<option value="${b.id}" ${act?.budget_item_id == b.id ? 'selected' : ''}>${b.code} - ${escapeHtml(b.item)}</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Anza</label>
          <input type="date" name="planned_start_date" required class="form-input" value="${act?.planned_start_date || todayISO()}">
        </div>
        <div>
          <label class="form-label">Maliza</label>
          <input type="date" name="planned_end_date" required class="form-input" value="${act?.planned_end_date || ''}">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Hekta Zilizopangwa</label>
          <input type="number" step="0.01" name="planned_hectares" required class="form-input" value="${act?.planned_hectares || ''}">
        </div>
        <div>
          <label class="form-label">Status</label>
          <select name="status" class="form-select">
            <option value="not_started" ${act?.status === 'not_started' ? 'selected' : ''}>Haijaanza</option>
            <option value="in_progress" ${act?.status === 'in_progress' ? 'selected' : ''}>Inaendelea</option>
            <option value="completed" ${act?.status === 'completed' ? 'selected' : ''}>Imekamilika</option>
            <option value="on_hold" ${act?.status === 'on_hold' ? 'selected' : ''}>Imesimamishwa</option>
          </select>
        </div>
      </div>
      <div>
        <label class="form-label">Maelezo</label>
        <textarea name="description" class="form-textarea" rows="2">${escapeHtml(act?.description || '')}</textarea>
      </div>
      <div class="flex justify-end gap-2 pt-3">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Hifadhi</button>
      </div>
    </form>
  `;
  const { overlay, close } = createModal(act ? 'Hariri Shughuli' : 'Shughuli Mpya', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#act-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name'),
      budget_item_id: parseInt(fd.get('budget_item_id')),
      planned_start_date: fd.get('planned_start_date'),
      planned_end_date: fd.get('planned_end_date'),
      planned_hectares: parseFloat(fd.get('planned_hectares')),
      status: fd.get('status'),
      description: fd.get('description')
    };
    const { error } = act
      ? await supabase.from('field_activities').update(data).eq('id', act.id)
      : await supabase.from('field_activities').insert(data);
    if (error) { toast(error.message, 'error'); return; }
    toast(act ? 'Yamebadilishwa' : 'Yameongezwa', 'success');
    close();
    await loadActivities();
  };
}

function openProgressModal(activityId) {
  const html = `
    <form id="prog-form" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Tarehe</label>
          <input type="date" name="progress_date" required class="form-input" value="${todayISO()}">
        </div>
        <div>
          <label class="form-label">Block</label>
          <select name="plot_id" class="form-select">
            <option value="">--</option>
            ${plots.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Hekta Zilizofanywa Leo</label>
          <input type="number" step="0.01" name="hectares_done" required class="form-input">
        </div>
        <div>
          <label class="form-label">Idadi ya Wafanyakazi</label>
          <input type="number" name="workers_count" class="form-input" value="0">
        </div>
      </div>
      <div>
        <label class="form-label">Hali ya Hewa</label>
        <input type="text" name="weather_condition" class="form-input" placeholder="Mfano: Jua, Mvua...">
      </div>
      <div>
        <label class="form-label">Changamoto/Notes</label>
        <textarea name="notes" class="form-textarea" rows="2"></textarea>
      </div>
      <div class="flex justify-end gap-2 pt-3">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Hifadhi Progress</button>
      </div>
    </form>
  `;
  const { overlay, close } = createModal('Rekodi Progress', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#prog-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const profile = getCurrentProfile();
    const hectaresDone = parseFloat(fd.get('hectares_done'));
    
    // Insert progress
    const { error: pe } = await supabase.from('activity_progress').insert({
      field_activity_id: activityId,
      plot_id: fd.get('plot_id') ? parseInt(fd.get('plot_id')) : null,
      progress_date: fd.get('progress_date'),
      hectares_done: hectaresDone,
      workers_count: parseInt(fd.get('workers_count')) || 0,
      weather_condition: fd.get('weather_condition'),
      notes: fd.get('notes'),
      recorded_by: profile.id
    });
    if (pe) { toast(pe.message, 'error'); return; }
    
    // Update activity completed_hectares
    const act = activities.find(a => a.id === activityId);
    const newDone = Number(act.completed_hectares) + hectaresDone;
    await supabase.from('field_activities').update({
      completed_hectares: newDone,
      actual_start_date: act.actual_start_date || todayISO(),
      status: newDone >= act.planned_hectares ? 'completed' : 'in_progress',
      actual_end_date: newDone >= act.planned_hectares ? todayISO() : null
    }).eq('id', activityId);
    
    toast('Progress imerekodiwa', 'success');
    close();
    await loadActivities();
  };
}

function bindEvents() {
  document.getElementById('filter-status').onchange = render;
  document.getElementById('filter-search').oninput = debounce(render);
  document.getElementById('add-btn').onclick = () => openModal();
  
  window.editAct = (id) => openModal(activities.find(a => a.id === id));
  window.recordProgress = (id) => openProgressModal(id);
  window.deleteAct = async (id) => {
    if (!await confirm('Una hakika unataka kufuta?')) return;
    const { error } = await supabase.from('field_activities').delete().eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Imefutwa', 'success');
    await loadActivities();
  };
}
