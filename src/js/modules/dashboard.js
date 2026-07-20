/**
 * 工作台模块 - 统计看板和待办提醒
 */
async function renderDashboard() {
  const companies = await getAll('companies');
  const projects = await getAll('projects');
  const members = await getAll('projectMembers');
  const contracts = await getAll('contracts');
  const payments = await getAll('paymentRecords');
  const booths = await getAll('boothConfirmations');
  const todos = await getAll('todos');

  const activeProjects = projects.filter(p => p.status === '筹备中' || p.status === '进行中');
  
  // 待办统计
  const longNoFollow = members.filter(m => {
    if (!m.nextFollowUp) return false;
    const d = new Date(m.nextFollowUp);
    return !isNaN(d.getTime()) && d < new Date();
  });
  
  let html = `<div class="dashboard">
    <div class="page-header">
      <h1>📊 工作台</h1>
      <span class="text-muted">新丝路会展运营管理平台 V9</span>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card" onclick="navigateTo('companies')">
        <div class="stat-value">${companies.length}</div>
        <div class="stat-label">企业总数</div>
      </div>
      <div class="stat-card" onclick="navigateTo('projects')">
        <div class="stat-value">${activeProjects.length}</div>
        <div class="stat-label">活跃项目</div>
      </div>
      <div class="stat-card" onclick="navigateTo('project-members')">
        <div class="stat-value">${members.length}</div>
        <div class="stat-label">企业档案</div>
      </div>
      <div class="stat-card" onclick="navigateTo('contracts')">
        <div class="stat-value">${contracts.length}</div>
        <div class="stat-label">合同</div>
      </div>
      <div class="stat-card" onclick="navigateTo('payments')">
        <div class="stat-value">${payments.length}</div>
        <div class="stat-label">付款记录</div>
      </div>
      <div class="stat-card" onclick="navigateTo('booths')">
        <div class="stat-value">${booths.length}</div>
        <div class="stat-label">确认展位</div>
      </div>
    </div>
    
    <!-- 待办提醒 -->
    <div class="dashboard-grid">
      <div class="dashboard-panel">
        <h3>🔔 招商待办 (${longNoFollow.length})</h3>
        <div class="todo-list">
          ${longNoFollow.length === 0 ? '<p class="text-muted">暂无</p>' : ''}`;
  
  for (const m of longNoFollow.slice(0, 10)) {
    const c = companies.find(c => String(c.id) === String(m.companyId));
    const p = projects.find(p => String(p.id) === String(m.projectId));
    html += `<div class="todo-item overdue">
      <div class="todo-title">${esc(c ? c.companyCn : m.companyId)} - ${esc(p ? p.name : '')}</div>
      <div class="todo-meta">下次跟进: ${fmtDate(m.nextFollowUp)} | 归属: ${esc(m.owner)}</div>
    </div>`;
  }
  
  html += `</div></div>
      <div class="dashboard-panel">
        <h3>📝 合同待办</h3>
        <div class="todo-list">`;
  
  // 草稿未生成
  const draftContracts = contracts.filter(c => c.status === '草稿');
  // 已发送未回签
  const sentContracts = contracts.filter(c => c.status === '已发送' || c.status === '待回签');
  // 已签订未收首款（需要实际检查是否有付款记录）
  const signedNoPayment = contracts.filter(c => {
    if (c.status !== '已签订') return false;
    const contractPayments = payments.filter(p => 
      String(p.companyId) === String(c.companyId) && 
      String(p.projectId) === String(c.projectId) && 
      p.validityStatus !== '已作废'
    );
    return contractPayments.length === 0;
  });
  
  html += `<div class="todo-item"><span>草稿未生成:</span> <strong>${draftContracts.length}</strong> 份</div>`;
  html += `<div class="todo-item"><span>已发送未回签:</span> <strong>${sentContracts.length}</strong> 份</div>`;
  html += `<div class="todo-item"><span>已签订未收首款:</span> <strong>${signedNoPayment.length}</strong> 份</div>`;
  
  html += `</div></div>
      <div class="dashboard-panel">
        <h3>🏗 展位待办</h3>
        <div class="todo-list">`;
  
  // 已签合同但展位未确认
  const needConfirmBooths = members.filter(m => 
    m.contractStatus === '已签订' && (!m.booths || m.booths.length === 0)
  );
  
  html += `<div class="todo-item"><span>待确认展位:</span> <strong>${needConfirmBooths.length}</strong> 个</div>`;
  
  html += `</div></div>
      <div class="dashboard-panel">
        <h3>📑 补贴待办</h3>
        <div class="todo-list">`;
  
  const subsidyMembers = members.filter(m => m.subsidyEnabled);
  html += `<div class="todo-item"><span>已申请补贴:</span> <strong>${subsidyMembers.length}</strong> 家</div>`;
  
  html += `</div></div>
    </div>
    
    <!-- 项目概览 -->
    <div class="dashboard-panel">
      <h3>📋 项目概览</h3>
      <div class="table-container">
        <table class="data-table">
          <thead><tr>
            <th>项目名称</th><th>年份</th><th>行业</th><th>地点</th><th>状态</th>
            <th>目标展位</th><th>企业数</th><th>合同数</th>
          </tr></thead>
          <tbody>`;
  
  for (const p of projects) {
    const pMembers = members.filter(m => String(m.projectId) === String(p.id));
    const pContracts = contracts.filter(c => String(c.projectId) === String(p.id));
    html += `<tr>
      <td><a href="#" onclick="navigateTo('project-members',{projectId:'${p.id}'});return false">${esc(p.name)}</a></td>
      <td>${esc(p.year)}</td><td>${esc(p.industry)}</td><td>${esc(p.location)}</td>
      <td><span class="badge badge-${p.status === '筹备中' ? 'info' : p.status === '进行中' ? 'success' : 'default'}">${esc(p.status)}</span></td>
      <td>${esc(p.targetBooths)}</td><td>${pMembers.length}</td><td>${pContracts.length}</td>
    </tr>`;
  }
  
  html += `</tbody></table></div></div>
  </div>`;
  
  return html;
}
