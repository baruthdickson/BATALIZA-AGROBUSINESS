// ============================================================================
// USERS MODULE - User & Role Management (PM only)
// ============================================================================

import { supabase } from '../supabase.js';
import { hasPermission, createUser, sendPasswordReset } from '../auth.js';
import { formatDate, toast, confirm, createModal, debounce, escapeHtml, logAction, exportMenu } from '../utils.js';

let users = [];
let roles = [];
let permissions = [];
let auditLogs = [];
let auditPage = 1;
const AUDIT_PAGE_SIZE = 50;

export async function initUsers() {
  await Promise.all([loadUsers(), loadRoles(), loadPermissions()]);
  bindTabs();
  bindEvents();
}

async function loadUsers() {
  const { data, error } = await supabase
    .from('users')
    .select(`*, role:roles(id, name, slug)`)
    .is('deleted_at', null)
    .eq('is_system_admin', false)
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  users = data || [];
  renderUsers();
}

async function loadRoles() {
  const { data } = await supabase.from('roles').select('*').eq('is_hidden', false).order('name');
  roles = data || [];
  const sel = document.getElementById('filter-role');
  sel.innerHTML = '<option value="">Zote</option>' + roles.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  renderRoles();
}

async function loadPermissions() {
  const { data } = await supabase.from('permissions').select('*').order('module, action');
  permissions = data || [];
}

// ============================================================================
// USERS RENDER
// ============================================================================
function renderUsers() {
  const role = document.getElementById('filter-role').value;
  const search = document.getElementById('filter-search').value.toLowerCase();
  
  let filtered = users;
  if (role) filtered = filtered.filter(u => u.role_id == role);
  if (search) filtered = filtered.filter(u => `${u.full_name} ${u.email}`.toLowerCase().includes(search));
  
  const tbody = document.getElementById('users-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-8">Hakuna watumiaji</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.map(u => `
    <tr>
      <td>
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
            ${u.full_name.charAt(0).toUpperCase()}
          </div>
          <div class="font-medium">${escapeHtml(u.full_name)}</div>
        </div>
      </td>
      <td class="text-sm">${escapeHtml(u.email)}</td>
      <td class="text-sm">${escapeHtml(u.phone || '-')}</td>
      <td><span class="badge badge-info">${escapeHtml(u.role?.name || '-')}</span></td>
      <td>
        <span class="badge ${u.is_active ? 'badge-success' : 'badge-default'}">${u.is_active ? 'Active' : 'Inactive'}</span>
      </td>
      <td class="text-xs text-gray-500">${u.last_login_at ? formatDate(u.last_login_at) : '-'}</td>
      <td class="whitespace-nowrap">
        <button class="text-green-600 text-sm" onclick="window.editUser('${u.id}')" title="Hariri">✏️</button>
        <button class="text-blue-600 text-sm ml-1" onclick="window.resetUserPassword('${u.email}')" title="Reset Password">🔑</button>
        <button class="text-${u.is_active ? 'red' : 'green'}-600 text-sm ml-1" onclick="window.toggleUserStatus('${u.id}', ${u.is_active})" title="${u.is_active ? 'Zima' : 'Wezesha'}">${u.is_active ? '🚫' : '✓'}</button>
        <button class="text-red-700 text-sm ml-1" onclick="window.deleteUser('${u.id}','${escapeHtml(u.full_name)}')" title="Futa kabisa">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// ============================================================================
// ROLES RENDER
// ============================================================================
function renderRoles() {
  const container = document.getElementById('roles-container');
  if (roles.length === 0) {
    container.innerHTML = '<div class="card text-center text-gray-500">Hakuna roles</div>';
    return;
  }
  
  container.innerHTML = roles.map(r => `
    <div class="card">
      <div class="flex justify-between items-start mb-2">
        <div>
          <h3 class="text-lg font-bold text-green-900">${escapeHtml(r.name)}</h3>
          <p class="text-xs text-gray-500">${escapeHtml(r.description || '')}</p>
        </div>
        ${r.is_system_role ? '<span class="badge badge-info">System</span>' : r.is_template ? '<span class="badge badge-success">Template</span>' : ''}
      </div>
      <div class="flex gap-2 mt-3">
        <button class="text-green-600 text-sm" onclick="window.viewRolePermissions(${r.id})">👁 Ona Permissions</button>
        ${!r.is_system_role ? `<button class="text-green-600 text-sm" onclick="window.editRolePermissions(${r.id})">✏️ Hariri</button>` : ''}
      </div>
    </div>
  `).join('');
}

// ============================================================================
// USER MODAL
// ============================================================================
function openUserModal(user = null) {
  const html = `
    <form id="user-form" class="space-y-3">
      <div>
        <label class="form-label">Jina Kamili</label>
        <input type="text" name="full_name" required class="form-input" value="${escapeHtml(user?.full_name || '')}">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Email</label>
          <input type="email" name="email" required class="form-input" value="${escapeHtml(user?.email || '')}" ${user ? 'readonly' : ''}>
        </div>
        <div>
          <label class="form-label">Simu</label>
          <input type="tel" name="phone" class="form-input" value="${escapeHtml(user?.phone || '')}">
        </div>
      </div>
      ${!user ? `
        <div>
          <label class="form-label">Password ya Awali</label>
          <input type="password" name="password" required class="form-input" minlength="6">
          <p class="text-xs text-gray-500 mt-1">Mtumiaji anaweza kubadilisha baadaye</p>
        </div>
      ` : ''}
      <div>
        <label class="form-label">Role</label>
        <select name="role_id" required class="form-select">
          ${roles.filter(r => !r.is_hidden).map(r => `<option value="${r.id}" ${user?.role_id == r.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
        </select>
      </div>
      ${user ? `
        <div>
          <label class="flex items-center gap-2">
            <input type="checkbox" name="is_active" ${user.is_active ? 'checked' : ''}>
            <span>Active</span>
          </label>
        </div>
      ` : ''}
      <div class="flex justify-end gap-2 pt-3">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Hifadhi</button>
      </div>
    </form>
  `;
  
  const { overlay, close } = createModal(user ? 'Hariri Mtumiaji' : 'Mtumiaji Mpya', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#user-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    
    try {
      if (user) {
        // Update existing
        const { error } = await supabase.from('users').update({
          full_name: fd.get('full_name'),
          phone: fd.get('phone'),
          role_id: parseInt(fd.get('role_id')),
          is_active: fd.get('is_active') === 'on'
        }).eq('id', user.id);
        if (error) throw error;
        await logAction(supabase, 'update', 'users', { type: 'user', id: user.id }, `Amebadilisha mtumiaji: ${fd.get('full_name')}`);
        toast('Mtumiaji amebadilishwa', 'success');
      } else {
        // Create new
        const newUser = await createUser(
          fd.get('email'),
          fd.get('password'),
          fd.get('full_name'),
          parseInt(fd.get('role_id')),
          fd.get('phone')
        );
        await logAction(supabase, 'create', 'users', { type: 'user', id: newUser?.id }, `Ametengeneza mtumiaji: ${fd.get('full_name')} (${fd.get('email')})`);
        toast('Mtumiaji amesajiliwa! Anaweza kuingia sasa.', 'success');
      }
      close();
      await loadUsers();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

// ============================================================================
// ROLE PERMISSIONS MODAL
// ============================================================================
async function viewRolePermissions(roleId) {
  const role = roles.find(r => r.id === roleId);
  
  const { data: rps } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', roleId)
    .eq('granted', true);
  
  const granted = new Set((rps || []).map(rp => rp.permission_id));
  
  // Group by module
  const byModule = {};
  permissions.forEach(p => {
    if (!byModule[p.module]) byModule[p.module] = [];
    byModule[p.module].push(p);
  });
  
  const html = `
    <div class="space-y-4 max-h-96 overflow-y-auto">
      <p class="text-sm text-gray-600">Permissions za <strong>${escapeHtml(role.name)}</strong>:</p>
      ${Object.keys(byModule).map(mod => `
        <div class="border-b border-green-100 pb-3">
          <h4 class="font-bold text-green-900 mb-2 uppercase text-sm">${mod}</h4>
          <div class="grid grid-cols-2 gap-1">
            ${byModule[mod].map(p => `
              <div class="text-sm flex items-center gap-2 ${granted.has(p.id) ? 'text-green-700' : 'text-gray-400'}">
                ${granted.has(p.id) ? '✓' : '✗'} ${escapeHtml(p.name)}
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  createModal(`Permissions: ${role.name}`, html, { size: 'lg' });
}

async function editRolePermissions(roleId) {
  const role = roles.find(r => r.id === roleId);
  
  const { data: rps } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', roleId);
  const granted = new Set((rps || []).map(rp => rp.permission_id));
  
  const byModule = {};
  permissions.forEach(p => {
    if (!byModule[p.module]) byModule[p.module] = [];
    byModule[p.module].push(p);
  });
  
  const html = `
    <form id="perm-form" class="space-y-3 max-h-96 overflow-y-auto">
      ${Object.keys(byModule).map(mod => `
        <div class="border-b border-green-100 pb-2">
          <h4 class="font-bold text-green-900 mb-2 uppercase text-sm">${mod}</h4>
          <div class="grid grid-cols-2 gap-1">
            ${byModule[mod].map(p => `
              <label class="text-sm flex items-center gap-2">
                <input type="checkbox" name="perm_${p.id}" ${granted.has(p.id) ? 'checked' : ''}>
                <span>${escapeHtml(p.name)}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <div class="flex justify-end gap-2 pt-3 sticky bottom-0 bg-white">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Hifadhi</button>
      </div>
    </form>
  `;
  
  const { overlay, close } = createModal(`Hariri: ${role.name}`, html, { size: 'lg' });
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#perm-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    
    // Delete all current
    await supabase.from('role_permissions').delete().eq('role_id', roleId);
    
    // Insert checked
    const records = [];
    for (const p of permissions) {
      if (fd.get(`perm_${p.id}`) === 'on') {
        records.push({ role_id: roleId, permission_id: p.id, granted: true });
      }
    }
    if (records.length > 0) {
      const { error } = await supabase.from('role_permissions').insert(records);
      if (error) { toast(error.message, 'error'); return; }
    }
    toast('Permissions zimebadilishwa', 'success');
    close();
  };
}

function openRoleModal() {
  const html = `
    <form id="role-form" class="space-y-3">
      <div>
        <label class="form-label">Jina la Role</label>
        <input type="text" name="name" required class="form-input">
      </div>
      <div>
        <label class="form-label">Slug (lowercase, hakuna nafasi)</label>
        <input type="text" name="slug" required class="form-input" pattern="[a-z_]+">
      </div>
      <div>
        <label class="form-label">Maelezo</label>
        <textarea name="description" class="form-textarea" rows="2"></textarea>
      </div>
      <div class="flex justify-end gap-2 pt-3">
        <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Tengeneza</button>
      </div>
    </form>
  `;
  const { overlay, close } = createModal('Role Mpya', html);
  overlay.querySelector('.modal-close-btn').onclick = close;
  overlay.querySelector('#role-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { error } = await supabase.from('roles').insert({
      name: fd.get('name'),
      slug: fd.get('slug'),
      description: fd.get('description'),
      is_template: true
    });
    if (error) { toast(error.message, 'error'); return; }
    toast('Role imetengenezwa. Sasa weka permissions zake.', 'success');
    close();
    await loadRoles();
  };
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================
async function loadAuditFilters() {
  // Populate users dropdown
  const sel = document.getElementById('audit-filter-user');
  sel.innerHTML = '<option value="">Wote</option>' +
    users.map(u => `<option value="${u.id}">${escapeHtml(u.full_name)}</option>`).join('');
}

async function loadAuditLogs() {
  const userId = document.getElementById('audit-filter-user').value;
  const module = document.getElementById('audit-filter-module').value;
  const from = document.getElementById('audit-filter-from').value;
  const to = document.getElementById('audit-filter-to').value;
  
  let q = supabase
    .from('audit_logs')
    .select('*, user:users(full_name, email)', { count: 'exact' })
    .eq('visible_to_pm', true)
    .order('created_at', { ascending: false });
  
  if (userId) q = q.eq('user_id', userId);
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
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-8">Hakuna shughuli zilizopatikana</td></tr>';
    document.getElementById('audit-pagination').innerHTML = '';
    return;
  }
  
  const actionLabels = {
    create: { label: 'Tengeneza', cls: 'badge-success' },
    update: { label: 'Hariri', cls: 'badge-info' },
    delete: { label: 'Futa', cls: 'badge-danger' },
    approve: { label: 'Idhinisha', cls: 'badge-success' },
    reject: { label: 'Kataa', cls: 'badge-danger' },
    login: { label: 'Ingia', cls: 'badge-default' },
    logout: { label: 'Toka', cls: 'badge-default' },
    deactivate: { label: 'Zima', cls: 'badge-warning' },
    activate: { label: 'Wezesha', cls: 'badge-success' }
  };
  
  tbody.innerHTML = auditLogs.map(l => {
    const a = actionLabels[l.action] || { label: l.action, cls: 'badge-default' };
    const time = new Date(l.created_at).toLocaleString('sw-TZ', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    return `
      <tr>
        <td class="text-xs whitespace-nowrap">${time}</td>
        <td class="text-sm">${escapeHtml(l.user?.full_name || 'System')}</td>
        <td><span class="badge badge-default">${escapeHtml(l.module)}</span></td>
        <td><span class="badge ${a.cls}">${a.label}</span></td>
        <td class="text-sm">${escapeHtml(l.description || '-')}</td>
      </tr>
    `;
  }).join('');
  
  // Pagination
  const totalPages = Math.ceil(totalCount / AUDIT_PAGE_SIZE);
  document.getElementById('audit-pagination').innerHTML = `
    <span>Inaonyesha ${(auditPage - 1) * AUDIT_PAGE_SIZE + 1} - ${Math.min(auditPage * AUDIT_PAGE_SIZE, totalCount)} kati ya ${totalCount}</span>
    <div class="flex gap-1">
      <button class="btn btn-secondary px-3 py-1 text-sm" ${auditPage === 1 ? 'disabled' : ''} onclick="window.auditPrev()">← Nyuma</button>
      <span class="px-3 py-1">Ukurasa ${auditPage} / ${totalPages}</span>
      <button class="btn btn-secondary px-3 py-1 text-sm" ${auditPage >= totalPages ? 'disabled' : ''} onclick="window.auditNext()">Mbele →</button>
    </div>
  `;
}

// ============================================================================
// TABS & EVENTS
// ============================================================================
function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = async () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('border-b-2', 'border-green-500', 'text-green-900');
        b.classList.add('text-gray-500');
      });
      btn.classList.add('border-b-2', 'border-green-500', 'text-green-900');
      btn.classList.remove('text-gray-500');
      const tab = btn.dataset.tab;
      document.getElementById('tab-users').classList.toggle('hidden', tab !== 'users');
      document.getElementById('tab-roles').classList.toggle('hidden', tab !== 'roles');
      document.getElementById('tab-audit').classList.toggle('hidden', tab !== 'audit');
      if (tab === 'audit') {
        await loadAuditFilters();
      }
    };
  });
}

function bindEvents() {
  document.getElementById('filter-role').onchange = renderUsers;
  document.getElementById('filter-search').oninput = debounce(renderUsers);
  document.getElementById('add-user-btn').onclick = () => openUserModal();
  document.getElementById('add-role-btn').onclick = openRoleModal;
  
  // Audit events
  document.getElementById('audit-refresh-btn').onclick = () => {
    auditPage = 1;
    loadAuditLogs();
  };
  document.getElementById('audit-export-btn').onclick = (e) => {
    if (auditLogs.length === 0) { toast('Pakia data kwanza', 'warning'); return; }
    exportMenu(e.target, auditLogs, 'audit_trail', [
      { key: 'created_at', label: 'Tarehe', value: r => new Date(r.created_at).toLocaleString('sw-TZ') },
      { key: 'user', label: 'Mtumiaji', value: r => r.user?.full_name || 'System' },
      { key: 'module', label: 'Module' },
      { key: 'action', label: 'Kitendo' },
      { key: 'description', label: 'Maelezo' }
    ], { title: 'Audit Trail', subtitle: 'Shughuli za watumiaji' });
  };
  window.auditPrev = () => { if (auditPage > 1) { auditPage--; loadAuditLogs(); } };
  window.auditNext = () => { auditPage++; loadAuditLogs(); };
  
  window.editUser = (id) => openUserModal(users.find(u => u.id === id));
  window.resetUserPassword = async (email) => {
    if (!await confirm(`Tuma reset link kwa ${email}?`)) return;
    try {
      await sendPasswordReset(email);
      await logAction(supabase, 'update', 'users', { type: 'user' }, `Ametuma password reset kwa: ${email}`);
      toast('Link imepelekwa', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  window.toggleUserStatus = async (id, currentlyActive) => {
    const action = currentlyActive ? 'kuzima' : 'kuwezesha';
    if (!await confirm(`Una hakika unataka ${action} mtumiaji huyu?`)) return;
    const { error } = await supabase.from('users').update({ is_active: !currentlyActive }).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    const u = users.find(x => x.id === id);
    await logAction(supabase, currentlyActive ? 'deactivate' : 'activate', 'users', { type: 'user', id }, `${currentlyActive ? 'Amezima' : 'Amewezesha'} mtumiaji: ${u?.full_name || id}`);
    toast(currentlyActive ? 'Amezimwa' : 'Amewashwa', 'success');
    await loadUsers();
  };
  window.deleteUser = async (id, name) => {
    if (!await confirm(`Una uhakika unataka KUFUTA KABISA mtumiaji "${name}"?\n\nMtumiaji hataweza kuingia tena na atatoweka kwenye orodha.`)) return;
    // Soft delete
    const { error } = await supabase.from('users').update({
      deleted_at: new Date().toISOString(),
      is_active: false
    }).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    await logAction(supabase, 'delete', 'users', { type: 'user', id }, `Amefuta mtumiaji: ${name}`);
    toast('Mtumiaji amefutwa', 'success');
    await loadUsers();
  };
  window.viewRolePermissions = viewRolePermissions;
  window.editRolePermissions = editRolePermissions;
}
