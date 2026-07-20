/**
 * 展位管理 + 增租 + 随团 + 补贴 + 备份 + 设置模块
 */
async function renderBooths() {
  const booths = await getAll('boothConfirmations');
  const companies = await getAll('companies');
  const projects = await getAll('projects');
  
  let html = `<div class="panel">
    <div class="panel-header">
      <h2>🏗 展位管理 (${booths.length} 个)</h2>
    </div>
    <div class="table-container">`;
  
  if (booths.length === 0) {
    html += '<p class="text-muted text-center p-4">暂无展位确认记录</p>';
  } else {
    html += `<table class="data-table">
      <thead><tr>
        <th>企业</th><th>项目</th><th>展位号</th><th>类型</th><th>面积</th><th>数量</th>
        <th>馆号</th><th>开口</th><th>状态</th><th>确认日期</th>
      </tr></thead>
      <tbody>`;
    booths.forEach(b => {
      const c = companies.find(co => String(co.id) === String(b.companyId));
      const p = projects.find(pr => String(pr.id) === String(b.projectId));
      html += `<tr>
        <td>${esc(c ? c.companyCn : '')}</td>
        <td>${esc(p ? p.name : '')}</td>
        <td>${esc(b.boothNumber || '待分配')}</td>
        <td>${esc(b.boothType)}</td>
        <td>${esc(b.area)}</td>
        <td>${b.boothCount}</td>
        <td>${esc(b.hallNumber)}</td>
        <td>${esc(b.openingType)}</td>
        <td><span class="badge">${esc(b.status)}</span></td>
        <td>${fmtDate(b.confirmedAt)}</td>
      </tr>`;
    });
    html += '</tbody></table>';
  }
  
  html += '</div></div>';
  return html;
}

async function editBooth(boothId) {
  const booth = await getById('boothConfirmations', boothId);
  if (!booth) { showToast('展位不存在', 'error'); return; }
  
  showModal('编辑展位', `
    <div class="form-grid">
      <div class="form-group"><label>展位类型</label>
        <select id="f-boothType" class="form-input">
          ${['光地展位','独立标准展位','中国区标准展位','联合参展','其他'].map(t => `<option value="${t}" ${booth.boothType===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>面积</label><input id="f-area" class="form-input" value="${esc(booth.area)}" /></div>
      <div class="form-group"><label>展位数量</label><input id="f-boothCount" class="form-input" type="number" value="${booth.boothCount||0}" /></div>
      <div class="form-group"><label>馆号</label><input id="f-hallNumber" class="form-input" value="${esc(booth.hallNumber)}" /></div>
      <div class="form-group"><label>展位号</label><input id="f-boothNumber" class="form-input" value="${esc(booth.boothNumber)}" /></div>
      <div class="form-group"><label>开口</label>
        <select id="f-openingType" class="form-input">
          ${['暂未确定','一面开','两面开','三面开','四面开'].map(o => `<option value="${o}" ${booth.openingType===o?'selected':''}>${o}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>状态</label>
        <select id="f-status" class="form-input"><option>待确认</option><option>已确认</option></select></div>
      <div class="form-group full-width"><label>位置备注</label><textarea id="f-locationNotes" class="form-input" rows="2">${esc(booth.locationNotes)}</textarea></div>
    </div>
  `, async (overlay) => {
    booth.boothType = overlay.querySelector('#f-boothType').value;
    booth.area = overlay.querySelector('#f-area').value;
    booth.boothCount = parseInt(overlay.querySelector('#f-boothCount').value) || 0;
    booth.hallNumber = overlay.querySelector('#f-hallNumber').value.trim();
    booth.boothNumber = overlay.querySelector('#f-boothNumber').value.trim();
    booth.openingType = overlay.querySelector('#f-openingType').value;
    booth.status = overlay.querySelector('#f-status').value;
    booth.locationNotes = overlay.querySelector('#f-locationNotes').value.trim();
    booth.updatedAt = now();
    await put('boothConfirmations', booth);
    navigateTo('booths');
  });
}

// ===== 增租管理 =====
async function renderRentals() {
  const members = await getAll('projectMembers');
  const companies = await getAll('companies');
  
  let allRentals = [];
  members.forEach(m => {
    (m.rentals || []).forEach(r => {
      allRentals.push({ ...r, companyId: m.companyId, projectId: m.projectId, memberId: m.id });
    });
  });
  
  let html = `<div class="panel">
    <div class="panel-header"><h2>➕ 增租管理 (${allRentals.length} 条)</h2></div>
    <div class="table-container">`;
  
  if (allRentals.length === 0) {
    html += '<p class="text-muted text-center p-4">暂无增租记录。请在项目企业档案中添加。</p>';
  } else {
    html += `<table class="data-table">
      <thead><tr><th>企业</th><th>类别</th><th>规格</th><th>数量</th><th>单价</th><th>总金额</th><th>已收</th><th>未收</th><th>状态</th></tr></thead>
      <tbody>`;
    allRentals.forEach(r => {
      const c = companies.find(co => String(co.id) === String(r.companyId));
      html += `<tr>
        <td>${esc(c ? c.companyCn : '')}</td><td>${esc(r.category)}</td><td>${esc(r.spec)}</td><td>${r.quantity}</td>
        <td>¥${fmt(r.unitPrice)}</td><td>¥${fmt(r.totalPrice)}</td>
        <td>¥${fmt(r.paidAmount)}</td><td>¥${fmt((r.totalPrice||0)-(r.paidAmount||0))}</td>
        <td><span class="badge">${esc(r.paymentStatus||'未收款')}</span></td></tr>`;
    });
    html += '</tbody></table>';
  }
  
  html += '</div></div>';
  return html;
}

// ===== 随团管理 =====
async function renderGroupTravel() {
  const members = await getAll('projectMembers');
  const companies = await getAll('companies');
  
  const groupMembers = members.filter(m => m.isGroupTour || (m.groupTravel && m.groupTravel.count > 0));
  
  let html = `<div class="panel">
    <div class="panel-header"><h2>✈ 随团管理 (${groupMembers.length} 家)</h2></div>
    <div class="table-container">`;
  
  if (groupMembers.length === 0) {
    html += '<p class="text-muted text-center p-4">暂无随团记录。</p>';
  } else {
    html += `<table class="data-table">
      <thead><tr><th>企业</th><th>人数</th><th>人员</th><th>护照</th><th>签证</th><th>机票</th><th>酒店</th><th>总费用</th><th>已收</th></tr></thead>
      <tbody>`;
    groupMembers.forEach(m => {
      const c = companies.find(co => String(co.id) === String(m.companyId));
      const gt = m.groupTravel || {};
      html += `<tr>
        <td>${esc(c ? c.companyCn : '')}</td><td>${gt.count||0}</td>
        <td>${esc(gt.participants||'-')}</td>
        <td><span class="badge badge-${gt.passport?'success':'default'}">${gt.passport?'已提交':'未提交'}</span></td>
        <td><span class="badge badge-${gt.visa?'success':'default'}">${gt.visa?'已提交':'未提交'}</span></td>
        <td><span class="badge badge-${gt.flight?'success':'default'}">${gt.flight?'已提交':'未提交'}</span></td>
        <td><span class="badge badge-${gt.hotel?'info':'default'}">${gt.hotel?'已订':'未订'}</span></td>
        <td>¥${fmt(gt.totalCost)}</td><td>¥${fmt(gt.paidAmount)}</td></tr>`;
    });
    html += '</tbody></table>';
  }
  
  html += '</div></div>';
  return html;
}

// ===== 补贴资料 =====
async function renderSubsidy() {
  const members = await getAll('projectMembers');
  const companies = await getAll('companies');
  const projects = await getAll('projects');
  
  const subsidyMembers = members.filter(m => m.subsidyEnabled);
  
  let html = `<div class="panel">
    <div class="panel-header"><h2>📑 补贴资料管理 (${subsidyMembers.length} 家)</h2></div>
    <div class="table-container">
      <table class="data-table">
        <thead><tr><th>企业</th><th>项目</th><th>补贴状态</th><th>资料完成</th><th>操作</th></tr></thead>
        <tbody>`;
  
  subsidyMembers.forEach(m => {
    const c = companies.find(co => String(co.id) === String(m.companyId));
    const p = projects.find(pr => String(pr.id) === String(m.projectId));
    const materials = m.subsidyMaterials || {};
    const totalItems = Object.keys(materials).length;
    const completedItems = Object.values(materials).filter(v => v.status === '已通过' || v.status === '不适用').length;
    const missingItems = Object.values(materials).filter(v => v.status === '未提交' || v.status === '需补充').length;
    
    html += `<tr>
      <td>${esc(c ? c.companyCn : '')}</td>
      <td>${esc(p ? p.name : '')}</td>
      <td>${totalItems > 0 ? (missingItems === 0 ? '✅ 全部完成' : `⚠ 缺${missingItems}项`) : '未设置'}</td>
      <td>${completedItems}/${totalItems}</td>
      <td><button class="btn btn-xs" onclick="editSubsidy('${m.id}')">管理资料</button></td>
    </tr>`;
  });
  
  if (subsidyMembers.length === 0) {
    html += '<tr><td colspan="6" class="text-muted text-center">暂无企业申请补贴</td></tr>';
  }
  
  html += '</tbody></table></div></div>';
  return html;
}

// ===== 数据备份中心 =====
async function renderBackup() {
  const stats = await getDataStats();
  
  let html = `<div class="panel">
    <div class="panel-header"><h2>💾 数据备份中心</h2></div>
    <div class="panel-body">`;
  
  html += `<h3>当前数据统计</h3>
    <div class="stats-grid mb-4">
      ${Object.entries(stats).filter(([k]) => k !== 'attachments').map(([k, v]) => `
        <div class="stat-card small"><div class="stat-value">${v}</div><div class="stat-label">${k}</div></div>
      `).join('')}
    </div>
    
    <div class="backup-actions">
      <button class="btn btn-primary btn-lg" onclick="exportBackup()">📥 导出完整备份</button>
      <button class="btn btn-lg" onclick="importBackup()">📤 导入/恢复备份</button>
      <button class="btn btn-lg" onclick="exportCompaniesCSV()">📄 导出企业库CSV</button>
    </div>
    
    <div class="mt-4">
      <h4>备份说明</h4>
      <ul class="info-list">
        <li>备份包含所有企业、项目、合同、付款、展位、跟进等完整数据</li>
        <li>导出的文件为 JSON 格式，包含备份时间和版本信息</li>
        <li>建议每次重大更新前进行完整备份</li>
        <li>恢复操作将覆盖当前数据，请谨慎操作</li>
      </ul>
    </div>`;
  
  html += '</div></div>';
  return html;
}

async function exportBackup() {
  try {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `新丝路会展平台_备份_${new Date().toISOString().split('T')[0]}_${new Date().toTimeString().split(' ')[0].replace(/:/g,'')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('备份导出成功！', 'success');
  } catch(e) {
    showToast('备份导出失败: ' + e.message, 'error');
  }
}

async function exportCompaniesCSV() {
  const companies = await getAll('companies');
  const headers = ['id','companyCn','company','contactName','phone','email','website','province','city','stage','priority','owner','contactSource','notes'];
  const rows = companies.map(c => headers.map(h => `"${String(c[h]||'').replace(/"/g,'""')}"`).join(','));
  const csv = ['\uFEFF' + headers.join(','), ...rows].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `企业库_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('企业库导出成功', 'success');
}

async function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!confirm('⚠️ 恢复操作将覆盖当前所有数据！\n\n请确认已备份当前数据。\n\n此操作不可撤销，确定要恢复吗？')) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllData(data, true);
      showToast('数据恢复成功！页面将重新加载。', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch(err) {
      showToast('数据恢复失败: ' + err.message, 'error');
    }
  };
  input.click();
}

// ===== 系统设置 =====
function showSettings() {
  const content = document.getElementById('content-area');
  if (!content) return;
  
  content.innerHTML = `<div class="panel">
    <div class="panel-header"><h2>⚙ 系统设置</h2></div>
    <div class="panel-body">
      <div class="detail-grid">
        <div class="detail-item"><label>系统名称</label><span>新丝路会展运营管理平台</span></div>
        <div class="detail-item"><label>公司名称</label><span>深圳市新丝路会展服务有限公司</span></div>
        <div class="detail-item"><label>统一社会信用代码</label><span>91440300MA5EHE0P4H</span></div>
        <div class="detail-item"><label>注册地址</label><span>深圳市南山区沙河街道光华街社区深南大道9002号锦绣花园二期C栋6A</span></div>
        <div class="detail-item"><label>银行</label><span>中信银行深圳南山支行</span></div>
        <div class="detail-item"><label>银行账号</label><span>8110301012400257945</span></div>
        <div class="detail-item"><label>数据库版本</label><span>V9 / Schema ${DB_VERSION}</span></div>
        <div class="detail-item"><label>存储引擎</label><span>IndexedDB (浏览器本地持久化)</span></div>
      </div>
      <div class="mt-4">
        <button class="btn btn-danger" onclick="if(confirm('⚠️ 确定要清空所有数据？此操作不可撤销！')){clearAllData()}">🗑 清空所有数据</button>
      </div>
    </div>
  </div>`;
}

async function clearAllData() {
  for (const name of Object.keys(STORES)) {
    await clearStore(name);
  }
  showToast('所有数据已清空', 'warning');
  setTimeout(() => location.reload(), 1000);
}

// ===== 导入面板 =====
function showImportPanel() {
  const root = document.getElementById('app-root');
  root.innerHTML = `
    <div class="import-panel">
      <div class="import-card">
        <div class="logo-big">NSR</div>
        <h1>新丝路会展运营管理平台</h1>
        <p>V9 | Schema ${DB_VERSION}</p>
        <p class="text-muted">首次使用，请导入V9备份CSV数据或开始空白系统</p>
        <div class="import-actions">
          <button class="btn btn-primary btn-lg" onclick="triggerFileImport()">📂 选择CSV文件导入</button>
          <button class="btn btn-lg" onclick="tryServerImport()">🌐 从服务器导入</button>
          <button class="btn btn-lg" onclick="startEmptySystem()">✨ 开始空白系统</button>
        </div>
        <p class="text-xs text-muted mt-2">"选择CSV文件导入"：请选择备份目录中的所有13个CSV文件（可多选）</p>
        <p class="text-xs text-muted">备份目录: data/backup_v9_20260719/csv/</p>
        <input type="file" id="csv-file-input" multiple accept=".csv" style="display:none" onchange="handleFileImport(event)" />
        <div id="import-log" class="import-log mt-2"></div>
      </div>
    </div>
  `;
}

function triggerFileImport() {
  document.getElementById('csv-file-input').click();
}

async function handleFileImport(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  
  const log = document.getElementById('import-log');
  log.innerHTML = `<p>正在读取 ${files.length} 个文件...</p>`;
  
  try {
    const results = await importFromFiles(files);
    log.innerHTML = '<h4>导入结果:</h4>' + results.map(r => `<p>${r}</p>`).join('');
    log.innerHTML += '<p style="color:green;font-weight:bold">✅ 数据导入完成！页面即将刷新...</p>';
    setTimeout(() => location.reload(), 2000);
  } catch(e) {
    log.innerHTML += `<p style="color:red">❌ 导入失败: ${e.message}</p>`;
  }
}

async function tryServerImport() {
  const log = document.getElementById('import-log');
  log.innerHTML = '<p>正在尝试从服务器导入...</p>';
  
  try {
    const results = await importFromServer();
    log.innerHTML = '<h4>导入结果:</h4>' + results.map(r => `<p>${r}</p>`).join('');
    log.innerHTML += '<p style="color:green;font-weight:bold">✅ 数据导入完成！页面即将刷新...</p>';
    setTimeout(() => location.reload(), 2000);
  } catch(e) {
    log.innerHTML += `<p style="color:red">❌ 服务器导入失败: ${e.message}</p>`;
    log.innerHTML += '<p style="color:orange">💡 请使用"选择CSV文件导入"方式，选择 data/backup_v9_20260719/csv/ 目录中的所有文件</p>';
  }
}

async function startEmptySystem() {
  await clearStore('companies');
  await clearStore('projects');
  await clearStore('projectMembers');
  await clearStore('contracts');
  await clearStore('paymentRecords');
  await clearStore('boothConfirmations');
  await clearStore('receivables');
  await clearStore('todos');
  await clearStore('emailLogs');
  renderApp();
}

function checkAutoBackup() {
  const lastBackup = localStorage.getItem('nsr_last_backup');
  const now = new Date().getTime();
  if (!lastBackup || (now - parseInt(lastBackup)) > 7 * 24 * 60 * 60 * 1000) {
    setTimeout(() => {
      showToast('💡 距上次备份已超过7天，建议前往"数据备份"中心导出备份', 'info');
    }, 3000);
  }
}
