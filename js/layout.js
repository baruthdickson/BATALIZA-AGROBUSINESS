// ============================================================================
// LAYOUT - Sidebar + Topbar (shared across pages)
// ============================================================================

import { logout, getCurrentProfile, hasPermission, isPM } from './auth.js';
import { supabase } from './supabase.js';

// ============================================================================
// MENU ITEMS (kila item ina required permission)
// ============================================================================
// ============================================================================
// FOCUS: Bajeti + Matumizi vinaonyeshwa kikamilifu.
// Vingine vimefichwa kwa sasa (mteja ataongeza baadaye)
// ============================================================================
// Modern SVG icons (Lucide-style, inline)
const ICONS = {
  dashboard: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
  budget: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  expenses: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>',
  reports: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
  users: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  settings: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  logout: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>',
  admin: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>',
  requests: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  external: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'
};

const MENU_ITEMS = [
  { icon: ICONS.dashboard, label: 'Dashboard', href: 'dashboard.html', perm: ['reports', 'view_dashboard'] },
  { icon: ICONS.budget, label: 'Bajeti', href: 'budget.html', perm: ['budget', 'view'] },
  { icon: ICONS.requests, label: 'Maombi ya Pesa', href: 'expense-requests.html', perm: ['expense_requests', 'view'] },
  { icon: ICONS.expenses, label: 'Matumizi', href: 'expenses.html', perm: ['expenses', 'view'] },
  { icon: ICONS.reports, label: 'Ripoti', href: 'reports.html', perm: ['reports', 'view_dashboard'] },
];

const PM_ONLY_ITEMS = [
  { icon: ICONS.users, label: 'Watumiaji', href: 'users.html', perm: ['users', 'view'] },
  { icon: ICONS.settings, label: 'Mipangilio', href: 'settings.html', perm: ['system', 'edit_company'] },
];

// Admin-only menu (haoni biashara)
const ADMIN_MENU_ITEMS = [
  { icon: ICONS.admin, label: 'Admin Dashboard', href: 'admin.html' },
];

// ============================================================================
// RENDER ADMIN SIDEBAR (tofauti na ya PM/wafanyakazi)
// ============================================================================
export function renderAdminSidebar() {
  const container = document.getElementById('sidebar-container');
  if (!container) return;
  
  const currentPage = window.location.pathname.split('/').pop() || 'admin.html';
  const profile = getCurrentProfile();
  
  container.innerHTML = `
    <button id="mobile-menu-btn" class="lg:hidden fixed top-4 left-4 z-30 bg-green-700 text-white p-2 rounded-lg shadow-lg">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </button>
    
    <aside id="sidebar" class="fixed top-0 left-0 z-40 w-64 h-screen text-white transform -translate-x-full lg:translate-x-0 transition-transform duration-200 overflow-y-auto" style="background: linear-gradient(180deg, #14532D 0%, #0f3a1f 100%);">
      <div class="p-5 border-b border-green-800 text-center">
        <div class="sidebar-logo"><img src="assets/logo.jpg" alt="Bataliza"></div>
        <div class="text-base font-bold text-white">BATALIZA</div>
        <div class="text-xs text-green-300 mt-0.5 tracking-wider">AGROBUSINESS</div>
        <div class="text-xs text-yellow-300 mt-2 flex items-center justify-center gap-1">
          <span>🔧</span> System Admin
        </div>
      </div>
      
      <div class="p-4 border-b border-green-800">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold">
            ${profile?.full_name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">${profile?.full_name || 'Admin'}</div>
            <div class="text-xs text-yellow-300 truncate">🔒 Technical Admin</div>
          </div>
        </div>
      </div>
      
      <nav class="py-2">
        ${ADMIN_MENU_ITEMS.map(item => `
          <a href="${item.href}" class="flex items-center gap-3 px-4 py-3 hover:bg-green-800 transition ${currentPage === item.href ? 'bg-green-800 border-l-4 border-yellow-400' : ''}">
            <span class="text-green-100">${item.icon}</span>
            <span class="text-sm">${item.label}</span>
          </a>
        `).join('')}
        
        <div class="border-t border-green-800 mt-2 pt-2">
          <div class="px-4 py-2 text-xs text-green-300 uppercase">External</div>
          <a href="https://supabase.com/dashboard" target="_blank" class="flex items-center gap-3 px-4 py-3 hover:bg-green-800 transition">
            <span class="text-green-100">${ICONS.external}</span>
            <span class="text-sm">Supabase Console</span>
          </a>
        </div>
        
        <div class="border-t border-green-800 mt-2 pt-2">
          <button id="logout-btn" class="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-900 transition text-left">
            <span class="text-green-100">${ICONS.logout}</span>
            <span class="text-sm">Toka</span>
          </button>
        </div>
        
        <div class="px-4 py-4 text-xs text-green-400 text-center border-t border-green-800 mt-2">
          ⚠️ Haoni data ya<br>biashara ya mteja
        </div>
      </nav>
    </aside>
    
    <div id="mobile-overlay" class="hidden lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"></div>
  `;
  
  document.getElementById('logout-btn').onclick = async () => {
    if (confirm('Una hakika unataka kutoka?')) await logout();
  };
  
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  document.getElementById('mobile-menu-btn').onclick = () => {
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
  };
  overlay.onclick = () => {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  };
}

// ============================================================================
// INIT ADMIN LAYOUT
// ============================================================================
export function initAdminLayout(pageTitle) {
  renderAdminSidebar();
  renderTopbar(pageTitle);
}

// ============================================================================
// RENDER SIDEBAR (PM + Sub-users)
// ============================================================================
export function renderSidebar() {
  const container = document.getElementById('sidebar-container');
  if (!container) return;
  
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  const profile = getCurrentProfile();
  
  const visibleItems = MENU_ITEMS.filter(item => hasPermission(item.perm[0], item.perm[1]));
  const visiblePMItems = PM_ONLY_ITEMS.filter(item => hasPermission(item.perm[0], item.perm[1]));
  
  container.innerHTML = `
    <!-- Mobile menu toggle -->
    <button id="mobile-menu-btn" class="lg:hidden fixed top-4 left-4 z-30 bg-green-700 text-white p-2 rounded-lg shadow-lg">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </button>
    
    <!-- Sidebar -->
    <aside id="sidebar" class="fixed top-0 left-0 z-40 w-64 h-screen bg-green-900 text-white transform -translate-x-full lg:translate-x-0 transition-transform duration-200 overflow-y-auto">
      <!-- Logo -->
      <div class="p-5 border-b border-green-800 text-center">
        <div class="sidebar-logo"><img src="assets/logo.jpg" alt="Bataliza"></div>
        <div class="text-base font-bold text-white">BATALIZA</div>
        <div class="text-xs text-green-300 mt-0.5 tracking-wider">AGROBUSINESS</div>
      </div>
      
      <!-- User info -->
      <div class="p-4 border-b border-green-800">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
            ${profile?.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">${profile?.full_name || 'User'}</div>
            <div class="text-xs text-green-300 truncate">${profile?.role?.name || ''}</div>
          </div>
        </div>
      </div>
      
      <!-- Menu -->
      <nav class="py-2">
        ${visibleItems.map(item => `
          <a href="${item.href}" class="flex items-center gap-3 px-4 py-3 hover:bg-green-800 transition ${currentPage === item.href ? 'bg-green-800 border-l-4 border-green-400' : ''}">
            <span class="text-green-100">${item.icon}</span>
            <span class="text-sm">${item.label}</span>
          </a>
        `).join('')}
        
        ${visiblePMItems.length > 0 ? `
          <div class="border-t border-green-800 mt-2 pt-2">
            <div class="px-4 py-1 text-xs text-green-300 uppercase">Usimamizi</div>
            ${visiblePMItems.map(item => `
              <a href="${item.href}" class="flex items-center gap-3 px-4 py-3 hover:bg-green-800 transition ${currentPage === item.href ? 'bg-green-800 border-l-4 border-green-400' : ''}">
                <span class="text-green-100">${item.icon}</span>
                <span class="text-sm">${item.label}</span>
              </a>
            `).join('')}
          </div>
        ` : ''}
        
        <div class="border-t border-green-800 mt-2 pt-2">
          <button id="logout-btn" class="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-900 transition text-left">
            <span class="text-green-100">${ICONS.logout}</span>
            <span class="text-sm">Toka</span>
          </button>
        </div>
      </nav>
    </aside>
    
    <!-- Mobile overlay -->
    <div id="mobile-overlay" class="hidden lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"></div>
  `;
  
  // Event handlers
  document.getElementById('logout-btn').onclick = async () => {
    if (confirm('Una hakika unataka kutoka?')) await logout();
  };
  
  // Mobile menu toggle
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  document.getElementById('mobile-menu-btn').onclick = () => {
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
  };
  overlay.onclick = () => {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  };
}

// ============================================================================
// RENDER TOPBAR
// ============================================================================
export function renderTopbar(pageTitle) {
  const container = document.getElementById('topbar-container');
  if (!container) return;
  
  container.innerHTML = `
    <header class="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div class="px-6 py-4 flex items-center justify-between">
        <div class="ml-12 lg:ml-0">
          <h1 class="text-2xl font-bold text-green-900">${pageTitle}</h1>
        </div>
        <div class="flex items-center gap-4">
          <button id="notifications-btn" class="relative p-2 text-gray-600 hover:text-green-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            <span id="notification-count" class="hidden absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">0</span>
          </button>
        </div>
      </div>
    </header>
    
    <!-- Notifications dropdown -->
    <div id="notifications-dropdown" class="hidden absolute top-16 right-6 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-30">
      <div class="p-4 border-b border-gray-200">
        <h3 class="font-bold text-green-900">Notifications</h3>
      </div>
      <div id="notifications-list" class="max-h-96 overflow-y-auto">
        <div class="p-4 text-center text-gray-500 text-sm">Hakuna notifications</div>
      </div>
    </div>
  `;
  
  // Notifications
  const btn = document.getElementById('notifications-btn');
  const dropdown = document.getElementById('notifications-dropdown');
  btn.onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) loadNotifications();
  };
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
  
  // Load notification count
  loadNotificationCount();
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================
async function loadNotificationCount() {
  const profile = getCurrentProfile();
  if (!profile) return;
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('is_read', false);
  
  const el = document.getElementById('notification-count');
  if (count > 0) {
    el.textContent = count;
    el.classList.remove('hidden');
  }
}

async function loadNotifications() {
  const profile = getCurrentProfile();
  if (!profile) return;
  
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(10);
  
  const list = document.getElementById('notifications-list');
  if (!data || data.length === 0) {
    list.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">Hakuna notifications</div>';
    return;
  }
  
  list.innerHTML = data.map(n => `
    <div class="p-3 border-b border-gray-100 hover:bg-green-50 cursor-pointer ${n.is_read ? '' : 'bg-green-50'}">
      <div class="font-medium text-sm text-green-900">${n.title}</div>
      <div class="text-xs text-gray-600 mt-1">${n.message}</div>
      <div class="text-xs text-gray-400 mt-1">${new Date(n.created_at).toLocaleString('sw-TZ')}</div>
    </div>
  `).join('');
}

// ============================================================================
// INIT LAYOUT (call kwenye kila page)
// ============================================================================
export function initLayout(pageTitle) {
  renderSidebar();
  renderTopbar(pageTitle);
  checkSetupHealth();
}

// ============================================================================
// SETUP HEALTH CHECK — Onyesha banner kama setup haijakamilika
// ============================================================================
async function checkSetupHealth() {
  const profile = getCurrentProfile();
  if (!profile) return;
  
  // Admin akifika hapa, redirect mara moja
  if (profile.is_system_admin) {
    window.location.href = '/admin.html';
    return;
  }
  
  // Kagua kama una permissions
  const { hasPermission } = await import('./auth.js');
  const hasAnyPermission = ['budget', 'expenses', 'hr', 'reports'].some(m => 
    hasPermission(m, 'view') || hasPermission(m, 'view_dashboard')
  );
  
  if (!hasAnyPermission) {
    const banner = document.createElement('div');
    banner.className = 'fixed top-0 left-0 right-0 lg:left-64 bg-red-100 border-b-2 border-red-500 p-4 z-30';
    banner.innerHTML = `
      <div class="max-w-4xl mx-auto">
        <div class="flex items-start gap-3">
          <div class="text-2xl">⚠️</div>
          <div class="flex-1">
            <div class="font-bold text-red-900">Akaunti yako haijasetup vizuri</div>
            <div class="text-sm text-red-800 mt-1">
              Huna permissions zozote — ndio sababu sidebar haina menu items.
              <br>Bofya hapa kuona <a href="/setup-check.html" class="underline font-bold">setup diagnostic</a> 
              au mwambie System Admin akupatie role na permissions.
            </div>
          </div>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-red-600 hover:text-red-800">✕</button>
        </div>
      </div>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
    // Push content down
    const main = document.querySelector('main');
    if (main) main.style.paddingTop = '100px';
  }
}
