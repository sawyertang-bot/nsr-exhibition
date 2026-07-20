/**
 * 新丝路会展运营管理平台 V9 Stable
 * 主应用逻辑 - 路由、导航、模块渲染
 */

// ============ 应用状态 ============
const AppState = {
  currentTab: 'dashboard',
  currentProjectId: null,
  currentCompanyId: null,
  modals: {},
  searchQuery: '',
  filters: {}
};

// ============ 初始化 ============
async function initApp() {
  try {
    await openDB();
    console.log('数据库连接成功');
    
    const stats = await getDataStats();
    const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);
    
    if (totalRecords === 0) {
      showImportPanel();
    } else {
      renderApp();
    }
    
    checkAutoBackup();
  } catch (err) {
    console.error('初始化失败:', err);
    const isVersionError = err.message && (err.message.includes('upgradeneeded') || err.message.includes('VersionError') || err.message.includes('version'));
    document.getElementById('app-root').innerHTML = `
      <div class="error-panel" style="text-align:center;padding:60px 20px;max-width:500px;margin:0 auto">
        <h2 style="color:#ef4444;margin-bottom:12px">系统初始化失败</h2>
        <p style="color:#64748b;margin-bottom:24px">${err.message || '未知错误'}</p>
        <div style="display:flex;gap:12px;justify-content:center">
          <button class="btn btn-primary" onclick="location.reload()">重试</button>
          ${isVersionError ? `<button class="btn btn-outline" onclick="indexedDB.deleteDatabase('NSR_EOMP').onsuccess=()=>{location.reload()};indexedDB.deleteDatabase('NSR_EOMP').onerror=()=>{location.reload()}">清除数据并重新加载</button>` : ''}
        </div>
      </div>`;
  }
}

// ============ 主渲染 ============
function renderApp() {
  const root = document.getElementById('app-root');
  root.innerHTML = `
    <div class="app-container">
      <nav class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="logo">
            <div class="logo-icon">NS</div>
            <div>
              <div class="logo-text">新丝路会展</div>
              <div class="logo-sub">NEW SILK ROAD EXHIBITION</div>
            </div>
          </div>
        </div>
        <div class="sidebar-nav" id="sidebar-nav">
          <div class="nav-section">
            <div class="nav-section-label">运营</div>
          </div>
        </div>
        <div class="sidebar-bottom">
          <div class="sidebar-nav-item-tag">
            <span>项目 · 展位 · 合同 · 收款</span>
          </div>
          <div class="sidebar-nav-item-tag" style="margin-top:4px">
            <span>确保项目全流程高效运营</span>
          </div>
        </div>
      </nav>
      <main class="main-content" id="main-content">
        <header class="topbar">
          <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
          <div class="topbar-brand">
            <span class="brand-code">NSR-EOMP</span>
            <span class="brand-divider"></span>
            <span class="brand-title">EXHIBITION OPERATIONS</span>
          </div>
          <div class="topbar-center">
            <div class="global-search">
              <input type="text" id="global-search" placeholder="搜索企业、行业、标签、官网或联系方式" 
                     onkeydown="if(event.key==='Enter')handleGlobalSearch(event)" />
            </div>
          </div>
          <div class="topbar-actions">
            <span class="db-status" id="db-status" style="font-size:11px;color:#10b981">● 就绪</span>
            <div class="user-badge">
              <div class="user-avatar">唐</div>
              <div>
                <div class="user-name">唐静韬</div>
                <div class="user-role">项目负责人</div>
              </div>
            </div>
          </div>
        </header>
        <div class="content-area" id="content-area"></div>
      </main>
    </div>
  `;
  
  renderSidebar();
  navigateTo('dashboard');
  updateDBStatus();
}

// ============ 侧边栏 ============
function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const tabs = [
    { id: 'dashboard', label: '运营中心', icon: '📊' },
    { id: 'companies', label: '企业库', icon: '🏢' },
    { id: 'projects', label: '项目中心', icon: '📋' },
    { id: 'project-members', label: '企业档案', icon: '📁' },
    { id: 'contracts', label: '合同中心', icon: '📝' },
    { id: 'payments', label: '付款中心', icon: '💰' },
    { id: 'booths', label: '展位管理', icon: '🏗' },
    { id: 'rentals', label: '增租管理', icon: '➕' },
    { id: 'group-travel', label: '随团管理', icon: '✈' },
    { id: 'subsidy', label: '补贴资料', icon: '📑' },
    { id: 'backup', label: '数据备份', icon: '💾' },
  ];
  
  let html = '<div class="nav-section"><div class="nav-section-label">运营</div>';
  
  html += tabs.slice(0, 3).map(t => `
    <div class="nav-item ${AppState.currentTab === t.id ? 'active' : ''}" 
         onclick="navigateTo('${t.id}')" data-tab="${t.id}">
      <span class="nav-icon">${t.icon}</span>
      <span class="nav-label">${t.label}</span>
    </div>
  `).join('');
  
  html += '</div><div class="nav-section" style="margin-top:8px"><div class="nav-section-label">基础设置</div>';
  
  html += tabs.slice(3).map(t => `
    <div class="nav-item ${AppState.currentTab === t.id ? 'active' : ''}" 
         onclick="navigateTo('${t.id}')" data-tab="${t.id}">
      <span class="nav-icon">${t.icon}</span>
      <span class="nav-label">${t.label}</span>
    </div>
  `).join('');
  
  html += '</div>';
  
  nav.innerHTML = html;
}

// ============ 导航 ============
async function navigateTo(tab, params = {}) {
  AppState.currentTab = tab;
  
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  if (navItem) navItem.classList.add('active');
  
  const content = document.getElementById('content-area');
  if (!content) return;
  
  content.innerHTML = '<div class="loading">正在加载...</div>';
  
  try {
    switch (tab) {
      case 'dashboard': content.innerHTML = await renderDashboard(); break;
      case 'companies': content.innerHTML = await renderCompanies(); break;
      case 'projects': content.innerHTML = await renderProjects(); break;
      case 'project-members': content.innerHTML = await renderProjectMembers(params); break;
      case 'contracts': content.innerHTML = await renderContracts(); break;
      case 'payments': content.innerHTML = await renderPayments(); break;
      case 'booths': content.innerHTML = await renderBooths(); break;
      case 'rentals': content.innerHTML = await renderRentals(); break;
      case 'group-travel': content.innerHTML = await renderGroupTravel(); break;
      case 'subsidy': content.innerHTML = await renderSubsidy(); break;
      case 'backup': content.innerHTML = await renderBackup(); break;
      default: content.innerHTML = '<div class="error-panel"><h2>未知页面</h2></div>';
    }
  } catch (err) {
    console.error(err);
    content.innerHTML = `<div class="error-panel"><h2>加载失败</h2><p>${err.message}</p><button class="btn btn-primary" onclick="navigateTo('${tab}')">重试</button></div>`;
  }
}

// ============ 侧边栏切换 ============
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ============ 全局搜索 ============
async function handleGlobalSearch(e) {
  const query = e.target.value.trim();
  if (!query) return;
  
  AppState.searchQuery = query;
  
  const results = [];
  const companies = await getAll('companies');
  const matchedCompanies = companies.filter(c => 
    (c.companyCn && c.companyCn.toLowerCase().includes(query.toLowerCase())) ||
    (c.company && c.company.toLowerCase().includes(query.toLowerCase())) ||
    (c.contactName && c.contactName.toLowerCase().includes(query.toLowerCase())) ||
    (c.phone && c.phone.includes(query)) ||
    (c.email && c.email.toLowerCase().includes(query)) ||
    (c.website && c.website.toLowerCase().includes(query))
  );
  
  const contracts = await getAll('contracts');
  const matchedContracts = contracts.filter(c => c.contractNumber && c.contractNumber.toLowerCase().includes(query.toLowerCase()));
  
  const booths = await getAll('boothConfirmations');
  const matchedBooths = booths.filter(b => b.boothNumber && b.boothNumber.toLowerCase().includes(query.toLowerCase()));
  
  const allResults = { companies: matchedCompanies.slice(0, 10), contracts: matchedContracts.slice(0, 10), booths: matchedBooths.slice(0, 10) };
  
  showSearchResults(query, allResults);
}

function showSearchResults(query, results) {
  let html = `<div class="card">
    <div class="card-header"><h2>搜索结果: "${esc(query)}"</h2>
    <button class="btn btn-ghost btn-sm" onclick="navigateTo('${AppState.currentTab}')">✕ 关闭</button></div>
    <div class="card-body">`;
  
  if (results.companies.length > 0) {
    html += `<h3 style="font-size:13px;font-weight:600;margin-bottom:12px">🏢 企业 (${results.companies.length})</h3>
      <div class="table-container"><table class="data-table">
      <thead><tr><th>中文名</th><th>英文名</th><th>联系人</th><th>电话</th><th>操作</th></tr></thead><tbody>`;
    results.companies.forEach(c => {
      html += `<tr><td><strong>${esc(c.companyCn)}</strong></td><td class="text-sm">${esc(c.company)}</td><td>${esc(c.contactName)}</td><td>${esc(c.phone)}</td>
        <td><button class="btn btn-sm btn-primary" onclick="navigateTo('project-members',{companyId:'${c.id}'})">查看档案</button></td></tr>`;
    });
    html += '</tbody></table></div>';
  }
  
  if (results.contracts.length > 0) {
    html += `<h3 style="font-size:13px;font-weight:600;margin:16px 0 12px">📝 合同 (${results.contracts.length})</h3>
      <div class="table-container"><table class="data-table">
      <thead><tr><th>合同编号</th><th>状态</th><th>金额</th></tr></thead><tbody>`;
    results.contracts.forEach(c => {
      html += `<tr><td><strong>${esc(c.contractNumber)}</strong></td><td><span class="badge badge-${getContractStatusClass(c.status)}">${esc(c.status)}</span></td><td>¥${fmt(c.totalAmount)}</td></tr>`;
    });
    html += '</tbody></table></div>';
  }
  
  if (results.booths.length > 0) {
    html += `<h3 style="font-size:13px;font-weight:600;margin:16px 0 12px">🏗 展位 (${results.booths.length})</h3>
      <div class="table-container"><table class="data-table">
      <thead><tr><th>展位号</th><th>类型</th><th>状态</th></tr></thead><tbody>`;
    results.booths.forEach(b => {
      html += `<tr><td><strong>${esc(b.boothNumber)}</strong></td><td>${esc(b.boothType)}</td><td><span class="badge">${esc(b.status)}</span></td></tr>`;
    });
    html += '</tbody></table></div>';
  }
  
  if (results.companies.length === 0 && results.contracts.length === 0 && results.booths.length === 0) {
    html += '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">未找到匹配结果</div><div class="empty-desc">尝试搜索企业名称、联系人、合同编号或展位号</div></div>';
  }
  
  html += '</div></div>';
  document.getElementById('content-area').innerHTML = html;
}

// ============ 工具函数 ============
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(num, decimals = 2) {
  if (num === undefined || num === null || num === '') return '0.00';
  const n = Number(num);
  if (isNaN(n)) return String(num);
  return n.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtInt(num) {
  if (num === undefined || num === null || num === '') return '0';
  const n = Number(num);
  if (isNaN(n)) return String(num);
  return Math.round(n).toLocaleString('zh-CN');
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().split('T')[0];
  } catch(e) { return dateStr; }
}

function now() { return new Date().toISOString(); }
function generateId() { return String(Date.now()) + Math.random().toString(36).substr(2, 6); }

async function generateContractNumber(projectId) {
  const project = await getById('projects', projectId);
  if (!project) return '';
  const year = project.year || new Date().getFullYear();
  const abbr = project.englishName ? project.englishName.replace(/[^A-Z]/g, '').substring(0, 6) : 'PROJ';
  if (!abbr || abbr.length < 2) { throw new Error('请先在项目设置中填写英文名称缩写'); }
  const contracts = await getAll('contracts');
  const existing = contracts.filter(c => c.projectId === projectId && c.contractNumber);
  const maxSeq = existing.reduce((max, c) => {
    const parts = c.contractNumber.split('-');
    const seq = parseInt(parts[parts.length - 1]) || 0;
    return Math.max(max, seq);
  }, 0);
  const seq = String(maxSeq + 1).padStart(3, '0');
  return `NSR-${year}-${abbr}-${seq}`;
}

function amountToChinese(num) {
  if (!num || num === 0) return '零元整';
  const units = ['', '拾', '佰', '仟', '万', '拾', '佰', '仟', '亿'];
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  let n = Math.abs(Math.round(Number(num) * 100));
  if (n === 0) return '零元整';
  let yuan = Math.floor(n / 100), jiao = Math.floor((n % 100) / 10), fen = n % 10;
  function convertYuan(num) {
    if (num === 0) return '零';
    let s = '', i = 0, prevZero = false;
    while (num > 0) {
      let d = num % 10;
      if (d === 0) { if (!prevZero && s !== '') prevZero = true; }
      else { if (prevZero) { s = '零' + s; prevZero = false; } s = digits[d] + units[i] + s; }
      num = Math.floor(num / 10); i++;
    }
    return s.replace(/零$/, '');
  }
  let result = convertYuan(yuan) + '元';
  if (jiao > 0) result += digits[jiao] + '角';
  if (fen > 0) result += digits[fen] + '分';
  else if (jiao === 0) result += '整';
  return result;
}

async function updateDBStatus() {
  const el = document.getElementById('db-status');
  if (!el) return;
  try {
    const stats = await getDataStats();
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    el.innerHTML = `● 就绪 (${total}条)`;
  } catch(e) { el.innerHTML = '● 离线'; }
}

function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showModal(title, content, onSave, size = 'medium') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal-${size}">
      <div class="modal-header">
        <h2>${title}</h2>
        <div class="modal-actions">
          <button class="btn btn-icon" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
      </div>
      <div class="modal-body">${content}</div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="btn btn-primary" id="modal-save-btn">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('modal-save-btn').addEventListener('click', async () => {
    try { await onSave(overlay); overlay.remove(); showToast('保存成功', 'success'); }
    catch(err) { showToast('保存失败: ' + err.message, 'error'); }
  });
}

async function openCompanyDetail(companyId, projectId = null) {
  const company = await getById('companies', companyId);
  if (!company) { showToast('企业不存在', 'error'); return; }
  let member = null;
  if (projectId) {
    const members = await getByIndex('projectMembers', 'companyId', companyId);
    member = members.find(m => m.projectId === projectId);
  }
  
  let html = `<div class="card">
    <div class="card-header">
      <h2>${esc(company.companyCn)}</h2>
      <div class="panel-actions">
        <button class="btn btn-sm btn-primary" onclick="editCompany('${companyId}')">编辑</button>
        <button class="btn btn-sm btn-outline" onclick="navigateTo('${AppState.currentTab}')">返回</button>
      </div>
    </div>
    <div class="card-body">`;
  
  html += `<div class="detail-grid">
    <div class="detail-item"><label>中文名称</label><span>${esc(company.companyCn)}</span></div>
    <div class="detail-item"><label>英文名称</label><span class="text-sm">${esc(company.company)}</span></div>
    <div class="detail-item"><label>联系人</label><span>${esc(company.contactName)}</span></div>
    <div class="detail-item"><label>电话</label><span>${esc(company.phone || company.contactPhone)}</span></div>
    <div class="detail-item"><label>邮箱</label><span class="text-sm">${esc(company.email || company.contactEmail)}</span></div>
    <div class="detail-item"><label>地区</label><span>${esc(company.province || '')} ${esc(company.city || '')}</span></div>
    <div class="detail-item"><label>阶段</label><span><span class="badge badge-default">${esc(company.stage || '未设置')}</span></span></div>
    <div class="detail-item"><label>优先级</label><span><span class="badge badge-${company.priority==='高'?'danger':company.priority==='中'?'warning':'default'}">${esc(company.priority || '-')}</span></span></div>
    <div class="detail-item"><label>业务归属</label><span>${esc(company.owner || '-')}</span></div>
    <div class="detail-item"><label>官网</label><span class="text-sm">${esc(company.website)}</span></div>
    <div class="detail-item"><label>地址</label><span class="text-sm">${esc(company.officialAddress)}</span></div>
    <div class="detail-item"><label>备注</label><span class="text-sm">${esc(company.notes)}</span></div>
  </div>`;
  
  if (member) {
    html += `<div class="mt-4"><h3 style="font-size:14px;font-weight:600;margin-bottom:12px">📁 项目业务档案</h3>
    <div class="detail-grid">
      <div class="detail-item"><label>意向类型</label><span>${esc(member.intentionType)}</span></div>
      <div class="detail-item"><label>意向面积</label><span>${member.intendedArea || '-'} ㎡</span></div>
      <div class="detail-item"><label>业务归属</label><span>${esc(member.businessOwner || member.owner)}</span></div>
      <div class="detail-item"><label>合同状态</label><span><span class="badge badge-${getContractStatusClass(member.contractStatus)}">${esc(member.contractStatus||'未签订')}</span></span></div>
      <div class="detail-item"><label>付款状态</label><span><span class="badge badge-${getPaymentStatusClass(member.paymentStatus)}">${esc(member.paymentStatus||'未收款')}</span></span></div>
      <div class="detail-item"><label>展位类型</label><span>${esc(member.boothType || '-')}</span></div>
      <div class="detail-item"><label>是否跟团</label><span>${member.isGroupTour ? '✅' : '❌'}</span></div>
      <div class="detail-item"><label>是否申请补贴</label><span>${member.subsidyEnabled ? '✅' : '❌'}</span></div>
    </div>
    
    <h4 style="font-size:13px;font-weight:600;margin:16px 0 12px">📝 跟进记录 (${(member.followUps || []).length})</h4>
    <div class="timeline">${(member.followUps || []).map(f => `
      <div class="timeline-item">
        <div class="timeline-date">${fmtDate(f.date)}</div>
        <div class="timeline-content">
          <div class="timeline-meta">${esc(f.method || '')} | ${esc(f.person || '')}</div>
          <p>${esc(f.content)}</p>
          ${f.nextDate ? `<small>下次跟进: ${fmtDate(f.nextDate)}</small>` : ''}
        </div>
      </div>
    `).join('')}${(member.followUps || []).length === 0 ? '<p class="text-muted">暂无跟进记录</p>' : ''}</div>`;
  }
  
  html += '</div></div>';
  document.getElementById('content-area').innerHTML = html;
}

function getContractStatusClass(status) {
  switch(status) { case '已签订': case '履行中': case '已完成': return 'success'; case '已发送': case '待回签': return 'info'; case '草稿': case '待确认': return 'warning'; case '已取消': case '已作废': return 'danger'; default: return 'default'; }
}
function getPaymentStatusClass(status) {
  switch(status) { case '已收全款': return 'success'; case '部分收款': return 'info'; case '未收款': return 'default'; case '多收款': return 'warning'; case '已退款': return 'danger'; default: return 'default'; }
}
