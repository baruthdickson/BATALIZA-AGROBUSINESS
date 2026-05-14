// ============================================================================
// INVENTORY MODULE
// ============================================================================

import { supabase } from '../supabase.js';
import { hasPermission, getCurrentProfile } from '../auth.js';
import { formatTZS, formatNumber, formatDate, todayISO, toast, confirm, createModal, debounce, escapeHtml } from '../utils.js';

let items = [];
let categories = [];
let movements = [];

export async function initInventory() {
  await loadCategories();
  await loadItems();
  bindTabs();
  bindEvents();
}

async function loadCategories() {
  const { data } = await supabase.from('inventory_categories').select('*').order('name');
  categories = data || [];
  const sel = document.getElementById('filter-category');
  sel.innerHTML = '<option value="">Zote</option>' + categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

async function loadItems() {
  const { data } = await supabase
    .from('inventory_items')
    .select(`*, category:inventory_categories(name)`)
    .is('deleted_at', null)
    .order('name');
  items = data || [];
  renderItems();
}

async function loadMovements() {
  const { data } = await supabase
    .from('stock_movements')
    .select(`*, item:inventory_items(name, unit)`)
    .order('movement_date', { ascending: false })
    .limit(100);
  movements = data || [];
  renderMovements();
}

function renderItems() {
  const cat = document.getElementById('filter-category').value;
  const search = document.getElementById('filter-search').value.toLowerCase();
  
  let filtered = items;
  if (cat) filtered = filtered.filter(i => i.inventory_category_id == cat);
  if (search) filtered = filtered.filter(i => `${i.name} ${i.code || ''}`.toLowerCase().includes(search));
  
  const tbody = document.getElementById('items-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-gray-500 py-8">Hakuna vifaa</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.map(i => {
    const low = Number(i.current_stock) <= Number(i.minimum_stock);
    return `
      <tr>
        <td class="font-mono text-xs">${escapeHtml(i.code || '-')}</td>
        <td>${escapeHtml(i.name)}</td>
        <td>${escapeHtml(i.category?.name || '-')}</td>
        <td>${escapeHtml(i.unit)}</td>
        <td class="text-right font-bold ${low ? 'text-red-600' : ''}">${formatNumber(i.current_stock)}</td>
        <td class="text-right text-gray-500">${formatNumber(i.minimum_stock)}</td>
        <td class="text-right">${formatTZS(i.unit_price)}</td>
        <td>${low ? '<span class="badge badge-danger">Low!</span>' : '<span class="badge badge-success">OK</span>'}</td>
        <td>
          ${hasPermission('inventory', 'edit') ? `<button class="text-green-600 text-sm" onclick="window.editItem(${i.id})">✏️</button>` : ''}
          ${hasPermission('inventory', 'delete') ? `<button class="text-red-600 text-sm ml-1" onclick="window.deleteItem(${i.id})">🗑</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

function renderMovements() {
  const tbody = document.getElementById('movements-tbody');
  if (movements.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-8">Hakuna movements</td></tr>';
    return;
  }
  tbody.innerHTML = movements.map(m => `
    <tr>
      <td>${formatDate(m.movement_date)}</td>
      <td><span class="badge ${m.movement_type === 'in' ? 'badge-success' : m.movement_type === 'out' ? 'badge-warning' : 'badge-default'}">${m.movement_type.toUpperCase()}</span></td>
      <td>${escapeHtml(m.item?.name || '-')}</td>
      <td class="text-right">${formatNumber(m.quantity)} ${m.item?.unit || ''}</td>
      <td class="text-right">${formatTZS(m.unit_price || 0)}</td>
      <td class="text-right">${formatTZS(m.total_value || 0)}</td>
      <td class="text-xs">${escapeHtml(m.notes || '-')}</td>
    </tr>
  `).join('');
}

function openItemModal(item = null) {
  if (categories.length === 0) { toast('Tengeneza categories kwanza', 'warning'); return; }
  const html = `
    <form id="item-form" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Jina</label>
          <input type="text" name="name" required class="form-input" value="${escapeHtml(item?.name || '')}">
        </div>
        <div>
          <label class="form-label">Code</label>
          <input type="text" name="code" class="form-input" value="${escapeHtml(item?.code || '')}">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Category</label>
          <select name="inventory_category_id" required class="form-select">
            ${categories.map(c => `<option value="${c.id}" ${item?.inventory_category_id == c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Unit</label>
          <input type="text" name="unit" required class="form-input" value="${escapeHtml(item?.unit || '')}" placeholder="kg, lt, pieces...">
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="form-label">Current Stock</label>
          <input type="number" step="0.01" name="current_stock" class="form-input" value="${item?.current_stock || 0}">
        </div>
        <div>
          <label class="form-label">Min Stock</label>
          <input type="number" step="0.01" name="minimum_stock" class="form-input" value="${item?.minimum_stock || 0}">
        </div>
        <div>
          <label class="form-label">Unit Price</label>
          <input type="number" step="0.01" name="unit_price" class="form-input" value="${item?.unit_price || 0}">
        </div>
      </div>
      <div>
        <label class="form-label">Storage Location</label>
        <input type="text" name="storage_location" class="form-input" value="${escapeHtml(item?.storage_location || '')}">
      </div>
      <div class="flex justify-end gap-2 pt-3">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Hifadhi</button>
      </div>
    </form>
  `;
  const { overlay, close } = createModal(item ? 'Hariri Kifaa' : 'Kifaa Kipya', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#item-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    for (const [k, v] of fd.entries()) data[k] = v || null;
    data.inventory_category_id = parseInt(data.inventory_category_id);
    data.current_stock = parseFloat(data.current_stock) || 0;
    data.minimum_stock = parseFloat(data.minimum_stock) || 0;
    data.unit_price = parseFloat(data.unit_price) || 0;
    
    const { error } = item
      ? await supabase.from('inventory_items').update(data).eq('id', item.id)
      : await supabase.from('inventory_items').insert(data);
    if (error) { toast(error.message, 'error'); return; }
    toast('Imehifadhiwa', 'success');
    close();
    await loadItems();
  };
}

function openMovementModal(type) {
  if (items.length === 0) { toast('Tengeneza items kwanza', 'warning'); return; }
  const html = `
    <form id="mv-form" class="space-y-3">
      <div>
        <label class="form-label">Kifaa</label>
        <select name="inventory_item_id" required class="form-select">
          ${items.map(i => `<option value="${i.id}">${escapeHtml(i.name)} (Stock: ${i.current_stock} ${i.unit})</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Quantity</label>
          <input type="number" step="0.01" name="quantity" required class="form-input">
        </div>
        <div>
          <label class="form-label">Unit Price</label>
          <input type="number" step="0.01" name="unit_price" class="form-input">
        </div>
      </div>
      <div>
        <label class="form-label">Tarehe</label>
        <input type="date" name="movement_date" required class="form-input" value="${todayISO()}">
      </div>
      <div>
        <label class="form-label">Notes</label>
        <textarea name="notes" class="form-textarea" rows="2"></textarea>
      </div>
      <div class="flex justify-end gap-2 pt-3">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Hifadhi</button>
      </div>
    </form>
  `;
  const { overlay, close } = createModal(type === 'in' ? 'Stock IN' : 'Stock OUT', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#mv-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const profile = getCurrentProfile();
    const { error } = await supabase.from('stock_movements').insert({
      inventory_item_id: parseInt(fd.get('inventory_item_id')),
      movement_type: type,
      quantity: parseFloat(fd.get('quantity')),
      unit_price: parseFloat(fd.get('unit_price')) || null,
      movement_date: fd.get('movement_date'),
      notes: fd.get('notes'),
      recorded_by: profile.id
    });
    if (error) { toast(error.message, 'error'); return; }
    toast('Movement imehifadhiwa', 'success');
    close();
    await loadItems();
  };
}

function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('border-b-2', 'border-green-500', 'text-green-900');
        b.classList.add('text-gray-500');
      });
      btn.classList.add('border-b-2', 'border-green-500', 'text-green-900');
      btn.classList.remove('text-gray-500');
      document.getElementById('tab-items').classList.toggle('hidden', btn.dataset.tab !== 'items');
      document.getElementById('tab-movements').classList.toggle('hidden', btn.dataset.tab !== 'movements');
      if (btn.dataset.tab === 'movements') loadMovements();
    };
  });
}

function bindEvents() {
  document.getElementById('filter-category').onchange = renderItems;
  document.getElementById('filter-search').oninput = debounce(renderItems);
  document.getElementById('add-item-btn').onclick = () => openItemModal();
  document.getElementById('stock-in-btn').onclick = () => openMovementModal('in');
  document.getElementById('stock-out-btn').onclick = () => openMovementModal('out');
  
  window.editItem = (id) => openItemModal(items.find(i => i.id === id));
  window.deleteItem = async (id) => {
    if (!await confirm('Una hakika unataka kufuta?')) return;
    const { error } = await supabase.from('inventory_items').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Imefutwa', 'success');
    await loadItems();
  };
}
