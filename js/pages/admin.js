// ============================================================================
// ADMIN MODULE - System Admin operations
// ============================================================================

import { supabase } from '../supabase.js';
import { createUser, sendPasswordReset } from '../auth.js';
import { toast, confirm, createModal, escapeHtml, logAction, exportMenu, formatDate } from '../utils.js';
import { SUPABASE_URL } from '../config.js';

let projectManagers = [];
let auditLogs = [];
let auditPage = 1;
const AUDIT_PAGE_SIZE = 50;

export async function initAdmin() {
  await loadStats();
  await loadPMs();
  await loadDbStats();
  loadSystemInfo();
  bindTabs();
  bindEvents();
}

// ============================================================================
// STATS
// ============================================================================
async function loadStats() {
  try {
    // All users (excluding admins)
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_system_admin', false)
      .is('deleted_at', null);
    document.getElementById('stat-users').textContent = usersCount || 0;
    
    // PMs only
    const { data: pmRole } = await supabase.from('roles').select('id').eq('slug', 'project_manager').single();
    if (pmRole) {
      const { count: pmCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role_id', pmRole.id)
        .is('deleted_at', null);
      document.getElementById('stat-pms').textContent = pmCount || 0;
    }
    
    // Roles
    const { count: rolesCount } = await supabase
      .from('roles')
      .select('*', { count: 'exact', head: true })
      .eq('is_hidden', false);
    document.getElementById('stat-roles').textContent = rolesCount || 0;
    
    // Logins last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: loginsCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'login')
      .gte('created_at', sevenDaysAgo);
    document.getElementById('stat-logins').textContent = loginsCount || 0;
  } catch (e) {
    console.error('Stats error:', e);
  }
}

// ============================================================================
// PROJECT MANAGERS
// ============================================================================
async function loadPMs() {
  const { data: pmRole } = await supabase.from('roles').select('id').eq('slug', 'project_manager').single();
  if (!pmRole) {
    document.getElementById('pms-tbody').innerHTML = '<tr><td colspan="6" class="text-center text-red-600 py-4">Role ya project_manager haipo. Endesha 03_seed_data.sql.</td></tr>';
    return;
  }
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role_id', pmRole.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  
  if (error) { toast('Imeshindikana kupakia PMs', 'error'); return; }
  projectManagers = data || [];
  renderPMs();
}

function renderPMs() {
  const tbody = document.getElementById('pms-tbody');
  if (projectManagers.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="text-center text-gray-500 py-8">
        Hakuna Project Manager bado. Bofya "+ Tengeneza Project Manager" kuanzisha mfumo.
      </td></tr>`;
    return;
  }
  
  tbody.innerHTML = projectManagers.map(p => `
    <tr>
      <td>
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
            ${p.full_name.charAt(0).toUpperCase()}
          </div>
          <div class="font-medium">${escapeHtml(p.full_name)}</div>
        </div>
      </td>
      <td class="text-sm">${escapeHtml(p.email)}</td>
      <td class="text-sm">${escapeHtml(p.phone || '-')}</td>
      <td>
        <span class="badge ${p.is_active ? 'badge-success' : 'badge-default'}">
          ${p.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td class="text-xs text-gray-500">${p.last_login_at ? formatDate(p.last_login_at) : 'Bado'}</td>
      <td class="whitespace-nowrap">
        <button class="text-blue-600 text-sm" onclick="window.adminResetPwd('${p.email}')" title="Reset Password">🔑 Reset</button>
        <button class="text-${p.is_active ? 'red' : 'green'}-600 text-sm ml-2" onclick="window.adminToggleStatus('${p.id}', ${p.is_active})" title="${p.is_active ? 'Zima' : 'Wezesha'}">
          ${p.is_active ? '🚫 Zima' : '✓ Wezesha'}
        </button>
      </td>
    </tr>
  `).join('');
}

// ============================================================================
// CREATE PROJECT MANAGER MODAL
// ============================================================================
function openCreatePMModal() {
  const html = `
    <form id="pm-form" class="space-y-3">
      <div class="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-900">
        ℹ️ Project Manager atapata ruhusa zote za biashara. Hakikisha unampatia mteja taarifa zifuatazo.
      </div>
      
      <div>
        <label class="form-label">Jina Kamili la PM <span class="text-red-500">*</span></label>
        <input type="text" name="full_name" required class="form-input" placeholder="Mfano: John Mwakasege">
      </div>
      
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Email <span class="text-red-500">*</span></label>
          <input type="email" name="email" required class="form-input" placeholder="pm@example.com">
        </div>
        <div>
          <label class="form-label">Namba ya Simu</label>
          <input type="tel" name="phone" class="form-input" placeholder="+255 xxx xxx xxx">
        </div>
      </div>
      
      <div>
        <label class="form-label">Password ya Awali <span class="text-red-500">*</span></label>
        <input type="text" name="password" required class="form-input" minlength="6" placeholder="Angalau characters 6">
        <p class="text-xs text-gray-500 mt-1">⚠️ Iwe rahisi kukumbuka lakini salama. PM atashauriwa kubadilisha baada ya kuingia.</p>
      </div>
      
      <div class="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-900">
        💡 <strong>Tip:</strong> Andika taarifa hizi mahali salama kabla ya kubonyeza Tengeneza, kisha mpe mteja.
      </div>
      
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Tengeneza Project Manager</button>
      </div>
    </form>
  `;
  
  const { overlay, close } = createModal('Tengeneza Project Manager Mpya', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#pm-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Inatengeneza...';
    
    try {
      // Pata role_id ya project_manager
      const { data: pmRole, error: roleErr } = await supabase
        .from('roles').select('id').eq('slug', 'project_manager').single();
      if (roleErr || !pmRole) throw new Error('Role ya project_manager haipo');
      
      const newUser = await createUser(
        fd.get('email').trim(),
        fd.get('password'),
        fd.get('full_name').trim(),
        pmRole.id,
        fd.get('phone')?.trim() || null
      );
      
      await supabase.from('audit_logs').insert({
        action: 'create',
        module: 'users',
        entity_type: 'user',
        entity_id: null,
        description: `Admin ametengeneza Project Manager: ${fd.get('full_name')} (${fd.get('email')})`,
        visible_to_pm: false  // hide admin actions from PM
      });
      
      close();
      
      // Show credentials summary
      showCredentialsSummary({
        name: fd.get('full_name'),
        email: fd.get('email'),
        password: fd.get('password'),
        phone: fd.get('phone')
      });
      
      await loadPMs();
      await loadStats();
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Tengeneza Project Manager';
      toast(err.message || 'Imeshindikana', 'error');
    }
  };
}

function showCredentialsSummary(creds) {
  const html = `
    <div class="space-y-4">
      <div class="bg-green-50 border-2 border-green-500 rounded p-4">
        <div class="text-green-900 font-bold mb-3 flex items-center gap-2">
          ✅ Project Manager Ameundwa Kikamilifu!
        </div>
        <div class="space-y-2 text-sm font-mono bg-white p-3 rounded">
          <div><strong>Jina:</strong> ${escapeHtml(creds.name)}</div>
          <div><strong>Email:</strong> ${escapeHtml(creds.email)}</div>
          <div><strong>Password:</strong> ${escapeHtml(creds.password)}</div>
          <div><strong>Simu:</strong> ${escapeHtml(creds.phone || '-')}</div>
        </div>
      </div>
      
      <div class="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm">
        ⚠️ <strong>Muhimu:</strong> Mpe mteja taarifa hizi MARA MOJA. Password haitaonyeshwa tena baadaye.
      </div>
      
      <div class="flex gap-2">
        <button id="copy-creds-btn" class="btn btn-secondary flex-1">📋 Nakili Credentials</button>
        <button class="btn btn-primary flex-1 modal-close-btn">Sawa</button>
      </div>
    </div>
  `;
  
  const { overlay, close } = createModal('Credentials za PM', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#copy-creds-btn').onclick = () => {
    const text = `Bataliza Agrobusiness - Project Manager Login\n\nEmail: ${creds.email}\nPassword: ${creds.password}\nJina: ${creds.name}\nSimu: ${creds.phone || '-'}\n\nFungua: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    toast('Imenakiliwa!', 'success');
  };
}

// ============================================================================
// AUDIT LOGS (ALL logs, including hidden)
// ============================================================================
async function loadAuditLogs() {
  const module = document.getElementById('audit-filter-module').value;
  const from = document.getElementById('audit-filter-from').value;
  const to = document.getElementById('audit-filter-to').value;
  
  let q = supabase
    .from('audit_logs')
    .select('*, user:users(full_name, email, is_system_admin)', { count: 'exact' })
    .order('created_at', { ascending: false });
  
  if (module) q = q.eq('module', module);
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to + 'T23:59:59');
  
  const start = (auditPage - 1) * AUDIT_PAGE_SIZE;
  q = q.range(start, start + AUDIT_PAGE_SIZE - 1);
  
  const { data, count, error } = await q;
  if (error) { toast('Imeshindikana kupakia audit', 'error'); return; }
  
  auditLogs = data || [];
  renderAuditLogs(count || 0);
}

function renderAuditLogs(totalCount) {
  const tbody = document.getElementById('audit-tbody');
  if (auditLogs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-8">Hakuna shughuli zilizopatikana</td></tr>';
    document.getElementById('audit-pagination').innerHTML = '';
    return;
  }
  
  const actionLabels = {
    create: 'Tengeneza', update: 'Hariri', delete: 'Futa',
    approve: 'Idhinisha', reject: 'Kataa',
    login: 'Ingia', logout: 'Toka',
    deactivate: 'Zima', activate: 'Wezesha'
  };
  
  tbody.innerHTML = auditLogs.map(l => {
    const time = new Date(l.created_at).toLocaleString('sw-TZ', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const userBadge = l.user?.is_system_admin 
      ? '<span class="badge badge-warning">Admin</span>'
      : escapeHtml(l.user?.full_name || 'System');
    return `
      <tr>
        <td class="text-xs whitespace-nowrap">${time}</td>
        <td class="text-sm">${userBadge}</td>
        <td><span class="badge badge-default">${escapeHtml(l.module)}</span></td>
        <td><span class="badge badge-info">${actionLabels[l.action] || l.action}</span></td>
        <td class="text-sm">${escapeHtml(l.description || '-')}</td>
        <td class="text-center">${l.visible_to_pm ? '✓' : '<span class="text-red-600">✗ Hidden</span>'}</td>
      </tr>
    `;
  }).join('');
  
  const totalPages = Math.ceil(totalCount / AUDIT_PAGE_SIZE);
  document.getElementById('audit-pagination').innerHTML = `
    <span>${(auditPage - 1) * AUDIT_PAGE_SIZE + 1} - ${Math.min(auditPage * AUDIT_PAGE_SIZE, totalCount)} kati ya ${totalCount}</span>
    <div class="flex gap-1">
      <button class="btn btn-secondary px-3 py-1 text-sm" ${auditPage === 1 ? 'disabled' : ''} onclick="window.adminAuditPrev()">← Nyuma</button>
      <span class="px-3 py-1">Ukurasa ${auditPage} / ${totalPages}</span>
      <button class="btn btn-secondary px-3 py-1 text-sm" ${auditPage >= totalPages ? 'disabled' : ''} onclick="window.adminAuditNext()">Mbele →</button>
    </div>
  `;
}

// ============================================================================
// DATABASE STATS
// ============================================================================
async function loadDbStats() {
  const tables = [
    'users', 'roles', 'permissions', 'employees', 'budget_periods',
    'budget_items', 'expenses', 'field_activities', 'payroll_periods',
    'inventory_items', 'vehicles', 'audit_logs'
  ];
  
  const tbody = document.getElementById('db-stats-tbody');
  if (!tbody) return;
  
  const results = await Promise.all(
    tables.map(async (t) => {
      try {
        const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
        return { table: t, count: count || 0 };
      } catch {
        return { table: t, count: 'error' };
      }
    })
  );
  
  tbody.innerHTML = results.map(r => `
    <tr class="border-b">
      <td class="py-2 font-mono">${r.table}</td>
      <td class="py-2 text-right font-bold">${r.count}</td>
    </tr>
  `).join('');
}

function loadSystemInfo() {
  document.getElementById('info-url').textContent = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
  document.getElementById('info-browser').textContent = navigator.userAgent.split(' ').slice(-2).join(' ');
  document.getElementById('info-date').textContent = new Date().toLocaleString('sw-TZ');
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
      const tab = btn.dataset.tab;
      document.getElementById('tab-pms').classList.toggle('hidden', tab !== 'pms');
      document.getElementById('tab-audit').classList.toggle('hidden', tab !== 'audit');
      document.getElementById('tab-system').classList.toggle('hidden', tab !== 'system');
    };
  });
}

function bindEvents() {
  document.getElementById('add-pm-btn').onclick = openCreatePMModal;
  document.getElementById('audit-refresh-btn').onclick = () => { auditPage = 1; loadAuditLogs(); };
  document.getElementById('audit-export-btn').onclick = (e) => {
    if (auditLogs.length === 0) { toast('Pakia data kwanza', 'warning'); return; }
    exportMenu(e.target, auditLogs, 'audit_logs_admin', [
      { key: 'created_at', label: 'Tarehe', value: r => new Date(r.created_at).toLocaleString('sw-TZ') },
      { key: 'user', label: 'Mtumiaji', value: r => r.user?.full_name || 'System' },
      { key: 'module', label: 'Module' },
      { key: 'action', label: 'Kitendo' },
      { key: 'description', label: 'Maelezo' },
      { key: 'visible_to_pm', label: 'Visible to PM', value: r => r.visible_to_pm ? 'Yes' : 'Hidden' }
    ], { title: 'Audit Logs - Admin View', subtitle: 'Shughuli zote za mfumo', orientation: 'landscape' });
  };
  
  document.getElementById('reset-pm-pwd-btn').onclick = async () => {
    if (projectManagers.length === 0) { toast('Hakuna PM bado', 'warning'); return; }
    if (projectManagers.length === 1) {
      const pm = projectManagers[0];
      if (await confirm(`Tuma password reset link kwa ${pm.email}?`)) {
        try {
          await sendPasswordReset(pm.email);
          toast('Link imepelekwa kwa email ya PM', 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      }
    } else {
      toast('Tumia "Reset" mbele ya PM unayemtaka', 'info');
      document.querySelector('[data-tab="pms"]').click();
    }
  };
  
  document.getElementById('view-errors-btn').onclick = () => {
    document.querySelector('[data-tab="audit"]').click();
    document.getElementById('audit-filter-module').value = '';
    auditPage = 1;
    loadAuditLogs();
  };
  
  window.adminAuditPrev = () => { if (auditPage > 1) { auditPage--; loadAuditLogs(); } };
  window.adminAuditNext = () => { auditPage++; loadAuditLogs(); };
  
  window.adminResetPwd = async (email) => {
    if (!await confirm(`Tuma password reset link kwa ${email}?`)) return;
    try {
      await sendPasswordReset(email);
      await supabase.from('audit_logs').insert({
        action: 'update', module: 'users',
        description: `Admin ametuma password reset kwa: ${email}`,
        visible_to_pm: false
      });
      toast('Link imepelekwa', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  
  window.adminToggleStatus = async (id, currentlyActive) => {
    const action = currentlyActive ? 'kuzima' : 'kuwezesha';
    if (!await confirm(`Una hakika unataka ${action} PM huyu?`)) return;
    const { error } = await supabase.from('users').update({ is_active: !currentlyActive }).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    const pm = projectManagers.find(p => p.id === id);
    await supabase.from('audit_logs').insert({
      action: currentlyActive ? 'deactivate' : 'activate',
      module: 'users',
      description: `Admin ${currentlyActive ? 'amezima' : 'amewezesha'} PM: ${pm?.full_name || id}`,
      visible_to_pm: false
    });
    toast(currentlyActive ? 'Amezimwa' : 'Amewezeshwa', 'success');
    await loadPMs();
    await loadStats();
  };
}
