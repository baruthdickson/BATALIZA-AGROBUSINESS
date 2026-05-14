// ============================================================================
// FLEET MODULE - Vehicles, Fuel, Service
// ============================================================================

import { supabase } from '../supabase.js';
import { hasPermission, getCurrentProfile } from '../auth.js';
import { formatTZS, formatNumber, formatDate, todayISO, toast, confirm, createModal, escapeHtml } from '../utils.js';

let vehicles = [];
let fuelLogs = [];
let serviceRecords = [];

export async function initFleet() {
  await loadVehicles();
  bindTabs();
  bindEvents();
}

async function loadVehicles() {
  const { data } = await supabase.from('vehicles').select('*').order('vehicle_number');
  vehicles = data || [];
  renderVehicles();
}

async function loadFuel() {
  const { data } = await supabase
    .from('fuel_logs')
    .select(`*, vehicle:vehicles(vehicle_number)`)
    .order('log_date', { ascending: false })
    .limit(100);
  fuelLogs = data || [];
  renderFuel();
}

async function loadService() {
  const { data } = await supabase
    .from('service_records')
    .select(`*, vehicle:vehicles(vehicle_number)`)
    .order('service_date', { ascending: false })
    .limit(100);
  serviceRecords = data || [];
  renderService();
}

function renderVehicles() {
  const tbody = document.getElementById('vehicles-tbody');
  if (vehicles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-8">Hakuna magari</td></tr>';
    return;
  }
  tbody.innerHTML = vehicles.map(v => `
    <tr>
      <td class="font-mono text-xs">${escapeHtml(v.vehicle_number)}</td>
      <td>${v.type}</td>
      <td>${escapeHtml(v.make || '')} ${escapeHtml(v.model || '')}</td>
      <td>${v.fuel_type}</td>
      <td class="text-right">${formatNumber(v.current_odometer)} km</td>
      <td><span class="badge ${v.status === 'active' ? 'badge-success' : 'badge-default'}">${v.status}</span></td>
      <td>
        ${hasPermission('fleet', 'edit') ? `<button class="text-green-600 text-sm" onclick="window.editVeh(${v.id})">✏️</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function renderFuel() {
  const tbody = document.getElementById('fuel-tbody');
  if (fuelLogs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-8">Hakuna fuel logs</td></tr>';
    return;
  }
  tbody.innerHTML = fuelLogs.map(f => `
    <tr>
      <td>${formatDate(f.log_date)}</td>
      <td>${escapeHtml(f.vehicle?.vehicle_number || '-')}</td>
      <td>${f.fuel_type}</td>
      <td class="text-right">${formatNumber(f.liters)}</td>
      <td class="text-right">${formatTZS(f.price_per_liter)}</td>
      <td class="text-right font-bold">${formatTZS(f.total_cost)}</td>
      <td class="text-right">${f.odometer_after || '-'}</td>
    </tr>
  `).join('');
}

function renderService() {
  const tbody = document.getElementById('service-tbody');
  if (serviceRecords.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-8">Hakuna service records</td></tr>';
    return;
  }
  tbody.innerHTML = serviceRecords.map(s => `
    <tr>
      <td>${formatDate(s.service_date)}</td>
      <td>${escapeHtml(s.vehicle?.vehicle_number || '-')}</td>
      <td>${escapeHtml(s.service_type)}</td>
      <td>${escapeHtml(s.description)}</td>
      <td class="text-right font-bold">${formatTZS(s.cost)}</td>
      <td>${escapeHtml(s.service_provider || '-')}</td>
    </tr>
  `).join('');
}

function openVehicleModal(v = null) {
  const html = `
    <form id="v-form" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Number Plate</label>
          <input type="text" name="vehicle_number" required class="form-input" value="${escapeHtml(v?.vehicle_number || '')}">
        </div>
        <div>
          <label class="form-label">Type</label>
          <select name="type" required class="form-select">
            <option value="car" ${v?.type === 'car' ? 'selected' : ''}>Car</option>
            <option value="motorcycle" ${v?.type === 'motorcycle' ? 'selected' : ''}>Motorcycle</option>
            <option value="truck" ${v?.type === 'truck' ? 'selected' : ''}>Truck</option>
            <option value="tractor" ${v?.type === 'tractor' ? 'selected' : ''}>Tractor</option>
            <option value="other" ${v?.type === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Make</label><input type="text" name="make" class="form-input" value="${escapeHtml(v?.make || '')}"></div>
        <div><label class="form-label">Model</label><input type="text" name="model" class="form-input" value="${escapeHtml(v?.model || '')}"></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Fuel Type</label>
          <select name="fuel_type" required class="form-select">
            <option value="diesel" ${v?.fuel_type === 'diesel' ? 'selected' : ''}>Diesel</option>
            <option value="petrol" ${v?.fuel_type === 'petrol' ? 'selected' : ''}>Petrol</option>
            <option value="electric" ${v?.fuel_type === 'electric' ? 'selected' : ''}>Electric</option>
          </select>
        </div>
        <div><label class="form-label">Current Odometer</label><input type="number" name="current_odometer" class="form-input" value="${v?.current_odometer || 0}"></div>
      </div>
      <div class="flex justify-end gap-2 pt-3">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Hifadhi</button>
      </div>
    </form>
  `;
  const { overlay, close } = createModal(v ? 'Hariri Gari' : 'Gari Jipya', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#v-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    for (const [k, val] of fd.entries()) data[k] = val || null;
    data.current_odometer = parseInt(data.current_odometer) || 0;
    const { error } = v
      ? await supabase.from('vehicles').update(data).eq('id', v.id)
      : await supabase.from('vehicles').insert(data);
    if (error) { toast(error.message, 'error'); return; }
    toast('Imehifadhiwa', 'success');
    close();
    await loadVehicles();
  };
}

function openFuelModal() {
  if (vehicles.length === 0) { toast('Tengeneza gari kwanza', 'warning'); return; }
  const html = `
    <form id="f-form" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Gari</label>
          <select name="vehicle_id" required class="form-select">
            ${vehicles.map(v => `<option value="${v.id}">${escapeHtml(v.vehicle_number)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Tarehe</label>
          <input type="date" name="log_date" required class="form-input" value="${todayISO()}">
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="form-label">Type</label>
          <select name="fuel_type" required class="form-select">
            <option value="diesel">Diesel</option>
            <option value="petrol">Petrol</option>
          </select>
        </div>
        <div><label class="form-label">Liters</label><input type="number" step="0.01" name="liters" required class="form-input"></div>
        <div><label class="form-label">Bei/Lt</label><input type="number" step="0.01" name="price_per_liter" required class="form-input"></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Odo Before</label><input type="number" name="odometer_before" class="form-input"></div>
        <div><label class="form-label">Odo After</label><input type="number" name="odometer_after" class="form-input"></div>
      </div>
      <div><label class="form-label">Station</label><input type="text" name="station_name" class="form-input"></div>
      <div class="flex justify-end gap-2 pt-3">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Hifadhi</button>
      </div>
    </form>
  `;
  const { overlay, close } = createModal('Fuel Log', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#f-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const profile = getCurrentProfile();
    const { error } = await supabase.from('fuel_logs').insert({
      vehicle_id: parseInt(fd.get('vehicle_id')),
      log_date: fd.get('log_date'),
      fuel_type: fd.get('fuel_type'),
      liters: parseFloat(fd.get('liters')),
      price_per_liter: parseFloat(fd.get('price_per_liter')),
      odometer_before: parseInt(fd.get('odometer_before')) || null,
      odometer_after: parseInt(fd.get('odometer_after')) || null,
      station_name: fd.get('station_name'),
      recorded_by: profile.id
    });
    if (error) { toast(error.message, 'error'); return; }
    toast('Fuel log imeongezwa', 'success');
    close();
    await loadFuel();
  };
}

function openServiceModal() {
  if (vehicles.length === 0) { toast('Tengeneza gari kwanza', 'warning'); return; }
  const html = `
    <form id="s-form" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Gari</label>
          <select name="vehicle_id" required class="form-select">
            ${vehicles.map(v => `<option value="${v.id}">${escapeHtml(v.vehicle_number)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Tarehe</label>
          <input type="date" name="service_date" required class="form-input" value="${todayISO()}">
        </div>
      </div>
      <div><label class="form-label">Service Type</label><input type="text" name="service_type" required class="form-input" placeholder="Oil change, Tire repair..."></div>
      <div><label class="form-label">Description</label><textarea name="description" required class="form-textarea" rows="2"></textarea></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Cost (TZS)</label><input type="number" step="0.01" name="cost" required class="form-input"></div>
        <div><label class="form-label">Provider</label><input type="text" name="service_provider" class="form-input"></div>
      </div>
      <div class="flex justify-end gap-2 pt-3">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Hifadhi</button>
      </div>
    </form>
  `;
  const { overlay, close } = createModal('Service Record', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#s-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const profile = getCurrentProfile();
    const { error } = await supabase.from('service_records').insert({
      vehicle_id: parseInt(fd.get('vehicle_id')),
      service_date: fd.get('service_date'),
      service_type: fd.get('service_type'),
      description: fd.get('description'),
      cost: parseFloat(fd.get('cost')),
      service_provider: fd.get('service_provider'),
      recorded_by: profile.id
    });
    if (error) { toast(error.message, 'error'); return; }
    toast('Service record imeongezwa', 'success');
    close();
    await loadService();
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
      ['vehicles', 'fuel', 'service'].forEach(t => {
        document.getElementById('tab-' + t).classList.toggle('hidden', btn.dataset.tab !== t);
      });
      if (btn.dataset.tab === 'fuel') loadFuel();
      if (btn.dataset.tab === 'service') loadService();
    };
  });
}

function bindEvents() {
  document.getElementById('add-vehicle-btn').onclick = () => openVehicleModal();
  document.getElementById('add-fuel-btn').onclick = () => openFuelModal();
  document.getElementById('add-service-btn').onclick = () => openServiceModal();
  window.editVeh = (id) => openVehicleModal(vehicles.find(v => v.id === id));
}
