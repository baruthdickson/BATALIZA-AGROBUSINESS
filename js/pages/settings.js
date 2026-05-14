// ============================================================================
// SETTINGS MODULE - Company profile + System settings
// ============================================================================

import { supabase } from '../supabase.js';
import { getCurrentProfile } from '../auth.js';
import { toast, escapeHtml } from '../utils.js';

let companyData = null;
let systemSettings = [];

export async function initSettings() {
  await loadCompany();
  await loadSystemSettings();
  bindTabs();
  bindEvents();
}

// ============================================================================
// COMPANY
// ============================================================================
async function loadCompany() {
  const { data } = await supabase
    .from('company_profile')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  companyData = data;
  if (data) {
    const form = document.getElementById('company-form');
    ['company_name', 'region', 'district', 'address', 'phone', 'email', 'tin_number', 'vrn_number', 'website'].forEach(field => {
      const input = form.elements[field];
      if (input) input.value = data[field] || '';
    });
  }
}

async function saveCompany(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const profile = getCurrentProfile();
  
  const data = {
    company_name: fd.get('company_name'),
    region: fd.get('region'),
    district: fd.get('district'),
    address: fd.get('address'),
    phone: fd.get('phone'),
    email: fd.get('email'),
    tin_number: fd.get('tin_number'),
    vrn_number: fd.get('vrn_number'),
    website: fd.get('website'),
    updated_by: profile.id
  };
  
  const { error } = companyData
    ? await supabase.from('company_profile').update(data).eq('id', companyData.id)
    : await supabase.from('company_profile').insert(data);
  
  if (error) { toast(error.message, 'error'); return; }
  toast('Taarifa za kampuni zimehifadhiwa', 'success');
  await loadCompany();
}

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================
async function loadSystemSettings() {
  const { data } = await supabase
    .from('system_settings')
    .select('*')
    .eq('is_system', false)
    .order('category, setting_key');
  
  systemSettings = data || [];
  renderSettings();
}

function renderSettings() {
  const container = document.getElementById('settings-list');
  if (systemSettings.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-500 py-4">Hakuna settings</div>';
    return;
  }
  
  // Group by category
  const grouped = {};
  systemSettings.forEach(s => {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  });
  
  container.innerHTML = Object.keys(grouped).map(cat => `
    <div class="border-b border-green-100 pb-4 mb-4 last:border-0">
      <h3 class="font-bold text-green-900 mb-3 uppercase text-sm">${escapeHtml(cat || 'General')}</h3>
      <div class="space-y-3">
        ${grouped[cat].map(s => `
          <div class="grid grid-cols-3 gap-3 items-center">
            <label class="form-label mb-0">${escapeHtml(s.setting_key)}</label>
            <div class="col-span-2">
              ${s.setting_type === 'boolean' ? `
                <select class="form-select setting-input" data-id="${s.id}">
                  <option value="true" ${s.setting_value === 'true' ? 'selected' : ''}>Ndiyo</option>
                  <option value="false" ${s.setting_value === 'false' ? 'selected' : ''}>Hapana</option>
                </select>
              ` : s.setting_type === 'integer' ? `
                <input type="number" class="form-input setting-input" data-id="${s.id}" value="${escapeHtml(s.setting_value || '')}">
              ` : `
                <input type="text" class="form-input setting-input" data-id="${s.id}" value="${escapeHtml(s.setting_value || '')}">
              `}
              ${s.description ? `<p class="text-xs text-gray-500 mt-1">${escapeHtml(s.description)}</p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('') + `
    <div class="flex justify-end mt-4">
      <button id="save-settings-btn" class="btn btn-primary">Hifadhi Settings</button>
    </div>
  `;
  
  document.getElementById('save-settings-btn').onclick = async () => {
    const profile = getCurrentProfile();
    const inputs = document.querySelectorAll('.setting-input');
    for (const input of inputs) {
      await supabase.from('system_settings').update({
        setting_value: input.value,
        updated_by: profile.id
      }).eq('id', parseInt(input.dataset.id));
    }
    toast('Settings zimehifadhiwa', 'success');
  };
}

// ============================================================================
// TABS & EVENTS
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
      document.getElementById('tab-company').classList.toggle('hidden', btn.dataset.tab !== 'company');
      document.getElementById('tab-system').classList.toggle('hidden', btn.dataset.tab !== 'system');
    };
  });
}

function bindEvents() {
  document.getElementById('company-form').onsubmit = saveCompany;
}
