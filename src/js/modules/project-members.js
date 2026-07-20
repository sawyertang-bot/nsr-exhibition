/**
 * 企业项目业务档案模块 - 项目级企业档案管理
 */
async function renderProjectMembers(params = {}) {
  const projects = await getAll('projects');
  const companies = await getAll('companies');
  
  let projectId = params.projectId || AppState.currentProjectId;
  if (!projectId && projects.length > 0) {
    projectId = String(projects[0].id);
  }
  AppState.currentProjectId = projectId;
  
  const project = projectId ? await getById('projects', projectId) : null;
  const members = projectId ? (await getByIndex('projectMembers', 'projectId', projectId) || []) : [];
  
  let html = `<div class="panel">
    <div class="panel-header">
      <h2>📁 企业项目业务档案</h2>
      <div class="panel-actions" style="display:flex;gap:8px;align-items:center">
        <select id="member-project-select" class="filter-select" onchange="navigateTo('project-members',{projectId:this.value})" style="min-width:200px">
          ${projects.map(p => `<option value="${p.id}" ${String(p.id)===projectId?'selected':''}>${esc(p.name)}</option>`).join('')}
        </select>
        ${project ? `<button class="btn btn-primary" onclick="showAddMember('${projectId}')">+ 添加企业到项目</button>` : ''}
      </div>
    </div>`;
  
  if (!project) {
    html += '<p class="text-muted p-4">请先创建项目</p></div>';
    return html;
  }
  
  // 项目下拉
  html += `<div class="filter-bar">
    <input type="text" id="member-search" class="search-input" placeholder="搜索企业名称..." oninput="filterMembers()" />
    <select id="filter-intention" class="filter-select" onchange="filterMembers()">
      <option value="">全部意向</option>
      <option>光地展位</option><option>独立标准展位</option><option>中国区标准展位</option><option>联合参展</option><option>其他</option>
    </select>
    <select id="filter-contract" class="filter-select" onchange="filterMembers()">
      <option value="">全部合同状态</option>
      <option>未签订</option><option>草稿</option><option>待确认</option><option>已生成</option><option>已发送</option><option>待回签</option><option>已签订</option><option>履行中</option><option>已完成</option><option>已取消</option><option>已作废</option>
    </select>
    <select id="filter-payment-m" class="filter-select" onchange="filterMembers()">
      <option value="">全部付款状态</option>
      <option>未收款</option><option>部分收款</option><option>已收全款</option><option>多收款</option><option>待核对</option><option>已退款</option>
    </select>
    <select id="filter-owner-m" class="filter-select" onchange="filterMembers()">
      <option value="">全部归属</option>
      ${[...new Set(members.map(m => m.businessOwner || m.owner).filter(Boolean))].sort().map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
    </select>
  </div>`;
  
  // 企业列表
  html += `<div class="table-container" id="members-table">`;
  html += renderMemberTable(members, companies);
  html += `</div></div>`;
  
  return html;
}

function renderMemberTable(members, companies) {
  if (members.length === 0) {
    return '<p class="text-muted text-center p-4">该项目暂无企业档案。请点击"添加企业到项目"。</p>';
  }
  
  return `<table class="data-table">
    <thead><tr>
      <th>企业名称</th><th>意向类型</th><th>意向面积</th><th>合同状态</th><th>付款状态</th>
      <th>展位类型</th><th>跟团</th><th>补贴</th><th>业务归属</th><th>下次跟进</th><th>操作</th>
    </tr></thead>
    <tbody>
      ${members.map(m => {
        const c = companies.find(c => String(c.id) === String(m.companyId));
        const companyName = c ? c.companyCn : (m.companyCn || m.companyId);
        return `<tr>
          <td><strong>${esc(companyName)}</strong></td>
          <td>${esc(m.intentionType || '-')}</td>
          <td>${m.intendedArea ? m.intendedArea + '㎡' : '-'}</td>
          <td><span class="badge badge-${getContractStatusClass(m.contractStatus)}">${esc(m.contractStatus||'未签订')}</span></td>
          <td><span class="badge badge-${getPaymentStatusClass(m.paymentStatus)}">${esc(m.paymentStatus||'未收款')}</span></td>
          <td>${esc(m.boothType || '-')}</td>
          <td>${m.isGroupTour ? '✅' : '❌'}</td>
          <td>${m.subsidyEnabled ? '✅' : '❌'}</td>
          <td>${esc(m.businessOwner || m.owner || '-')}</td>
          <td>${fmtDate(m.nextFollowUp)}</td>
          <td class="actions">
            <button class="btn btn-xs btn-primary" onclick="openMemberDetail('${m.id}')">详情</button>
            <button class="btn btn-xs" onclick="editMember('${m.id}')">编辑</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

async function filterMembers() {
  const query = (document.getElementById('member-search')?.value || '').toLowerCase();
  const intention = document.getElementById('filter-intention')?.value || '';
  const contract = document.getElementById('filter-contract')?.value || '';
  const payment = document.getElementById('filter-payment-m')?.value || '';
  const owner = document.getElementById('filter-owner-m')?.value || '';
  
  const members = await getByIndex('projectMembers', 'projectId', AppState.currentProjectId) || [];
  const companies = await getAll('companies');
  
  let filtered = members;
  if (query) {
    filtered = filtered.filter(m => {
      const c = companies.find(c => String(c.id) === String(m.companyId));
      const name = c ? c.companyCn : (m.companyCn || '');
      return name.toLowerCase().includes(query);
    });
  }
  if (intention) filtered = filtered.filter(m => m.intentionType === intention);
  if (contract) filtered = filtered.filter(m => m.contractStatus === contract);
  if (payment) filtered = filtered.filter(m => m.paymentStatus === payment);
  if (owner) filtered = filtered.filter(m => (m.businessOwner || m.owner) === owner);
  
  const container = document.getElementById('members-table');
  if (container) container.innerHTML = renderMemberTable(filtered, companies);
}

async function showAddMember(projectId) {
  const companies = await getAll('companies');
  const existingMembers = await getByIndex('projectMembers', 'projectId', projectId) || [];
  const existingIds = new Set(existingMembers.map(m => String(m.companyId)));
  const available = companies.filter(c => !existingIds.has(String(c.id)));
  
  showModal('添加企业到项目', `
    <div class="form-group">
      <label>选择企业 (${available.length} 家可用)</label>
      <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:4px">
        ${available.map(c => `
          <label class="checkbox-row">
            <input type="checkbox" value="${c.id}" class="member-company-check" />
            ${esc(c.companyCn)} ${c.contactName ? '- ' + esc(c.contactName) : ''}
          </label>
        `).join('')}
        ${available.length === 0 ? '<p class="text-muted p-2">所有企业已加入项目，或企业库为空</p>' : ''}
      </div>
    </div>
  `, async (overlay) => {
    const checks = overlay.querySelectorAll('.member-company-check:checked');
    if (checks.length === 0) throw new Error('请至少选择一家企业');
    
    for (const chk of checks) {
      const companyId = chk.value;
      const member = {
        id: generateId(),
        projectId: projectId,
        companyId: companyId,
        stage: '待联系',
        priority: '中',
        owner: '新丝路',
        businessOwner: '新丝路',
        intentionType: '',
        intendedArea: '',
        intendedBoothType: '',
        intendedBoothCount: 0,
        nextFollowUp: '',
        notes: '',
        contractStatus: '未签订',
        contractNumber: '',
        contractAmount: 0,
        depositAmount: 0,
        depositPaidDate: '',
        balanceAmount: 0,
        balanceDueDate: '',
        paymentStatus: '未收款',
        contractNotes: '',
        boothType: '',
        boothMaterials: {},
        subsidyMaterials: {},
        rentals: [],
        isGroupTour: false,
        groupTravel: {},
        intentionData: {},
        followUps: [],
        payments: [],
        booths: [],
        executionUnlocked: false,
        subsidyEnabled: false,
        profitData: {},
        contractData: {},
        updatedAt: now()
      };
      await put('projectMembers', member);
    }
    navigateTo('project-members', {projectId});
  });
}

async function openMemberDetail(memberId) {
  const member = await getById('projectMembers', memberId);
  if (!member) { showToast('档案不存在', 'error'); return; }
  
  const company = await getById('companies', String(member.companyId));
  const project = await getById('projects', String(member.projectId));
  const companyContracts = await getByIndex('contracts', 'companyId', String(member.companyId));
  const memberContracts = companyContracts.filter(c => String(c.projectId) === String(member.projectId));
  const payments = await getByIndex('paymentRecords', 'companyId', String(member.companyId));
  const memberPayments = payments.filter(p => String(p.projectId) === String(member.projectId));
  const memberBooths = await getByIndex('boothConfirmations', 'companyId', String(member.companyId));
  
  let html = `<div class="panel">
    <div class="panel-header">
      <h2>📁 ${esc(company ? company.companyCn : member.companyId)}</h2>
      <div>
        <button class="btn btn-sm btn-primary" onclick="editMember('${memberId}')">编辑档案</button>
        <button class="btn btn-sm" onclick="navigateTo('project-members',{projectId:'${member.projectId}'});return false;">返回列表</button>
      </div>
    </div>
    <div class="detail-tabs">
      <button class="tab-btn active" onclick="switchMemberTab(event,'info')">基本信息</button>
      <button class="tab-btn" onclick="switchMemberTab(event,'intention')">意向需求</button>
      <button class="tab-btn" onclick="switchMemberTab(event,'followup')">跟进记录</button>
      <button class="tab-btn" onclick="switchMemberTab(event,'contracts')">合同</button>
      <button class="tab-btn" onclick="switchMemberTab(event,'payments')">付款</button>
      <button class="tab-btn" onclick="switchMemberTab(event,'booths')">展位</button>
      <button class="tab-btn" onclick="switchMemberTab(event,'rentals')">增租</button>
      <button class="tab-btn" onclick="switchMemberTab(event,'group-travel')">随团</button>
      <button class="tab-btn" onclick="switchMemberTab(event,'subsidy')">补贴</button>
    </div>
    <div class="tab-content" id="member-tab-content">`;
  
  // Info tab
  html += `<div class="tab-pane active" data-tab="info">
    <div class="detail-grid">
      <div class="detail-item"><label>项目</label><span>${esc(project ? project.name : '')}</span></div>
      <div class="detail-item"><label>企业</label><span>${esc(company ? company.companyCn : '')}</span></div>
      <div class="detail-item"><label>意向类型</label><span>${esc(member.intentionType)}</span></div>
      <div class="detail-item"><label>意向面积</label><span>${member.intendedArea || '-'} ㎡</span></div>
      <div class="detail-item"><label>合同状态</label><span>${esc(member.contractStatus)}</span></div>
      <div class="detail-item"><label>合同金额</label><span>¥${fmt(member.contractAmount)}</span></div>
      <div class="detail-item"><label>定金</label><span>¥${fmt(member.depositAmount)}</span></div>
      <div class="detail-item"><label>付款状态</label><span>${esc(member.paymentStatus)}</span></div>
      <div class="detail-item"><label>展位类型</label><span>${esc(member.boothType)}</span></div>
      <div class="detail-item"><label>业务归属</label><span>${esc(member.businessOwner || member.owner)}</span></div>
      <div class="detail-item"><label>下次跟进</label><span>${fmtDate(member.nextFollowUp)}</span></div>
      <div class="detail-item"><label>备注</label><span>${esc(member.notes)}</span></div>
    </div>
  </div>`;
  
  // Intention tab
  const intentionData = member.intentionData || {};
  html += `<div class="tab-pane" data-tab="intention">
    <div class="detail-grid">
      <div class="detail-item"><label>意向面积</label><span>${member.intendedArea || '-'} ㎡</span></div>
      <div class="detail-item"><label>意向展位数量</label><span>${member.intendedBoothCount || '-'}</span></div>
      <div class="detail-item"><label>意向类型</label><span>${esc(member.intentionType)}</span></div>
      <div class="detail-item"><label>意向馆号</label><span>${esc(intentionData.hall)}</span></div>
      <div class="detail-item"><label>意向位置</label><span>${esc(intentionData.location)}</span></div>
      <div class="detail-item"><label>意向开口</label><span>${esc(intentionData.openings)}</span></div>
      <div class="detail-item"><label>意向价格</label><span>${intentionData.price ? '¥' + fmt(intentionData.price) : '-'}</span></div>
      <div class="detail-item"><label>是否申请补贴</label><span>${member.subsidyEnabled ? '是' : '否'}</span></div>
      <div class="detail-item"><label>预计参展人数</label><span>${intentionData.attendees || '-'}</span></div>
      <div class="detail-item"><label>是否跟团</label><span>${member.isGroupTour ? '是' : '否'}</span></div>
    </div>
  </div>`;
  
  // Follow-up tab
  const followUps = member.followUps || [];
  html += `<div class="tab-pane" data-tab="followup">
    <button class="btn btn-sm btn-primary mb-2" onclick="addFollowUp('${memberId}')">+ 添加跟进</button>
    <div class="timeline" id="followup-list">
      ${followUps.length === 0 ? '<p class="text-muted">暂无跟进记录</p>' : ''}
      ${followUps.map(f => `
        <div class="timeline-item">
          <div class="timeline-date">${fmtDate(f.date)}</div>
          <div class="timeline-content">
            <div class="timeline-meta">${esc(f.method||'')} | ${esc(f.person||'')}</div>
            <p>${esc(f.content)}</p>
            ${f.nextDate ? `<small>下次跟进: ${fmtDate(f.nextDate)}</small>` : ''}
            ${f.feedback ? `<small>反馈: ${esc(f.feedback)}</small>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  </div>`;
  
  // Contracts tab
  html += renderContractsTabContent(memberContracts, member);
  
  // Payments tab
  html += renderPaymentsTabContent(memberPayments, member);
  
  // Booths tab
  html += renderBoothsTabContent(memberBooths, member);
  
  // Rentals tab
  html += renderRentalsTabContent(member);
  
  // Group travel tab
  html += renderGroupTravelTabContent(member);
  
  // Subsidy tab
  html += renderSubsidyTabContent(member, project);

  html += `</div></div>`;
  
  document.getElementById('content-area').innerHTML = html;
}

function renderContractsTabContent(contracts, member) {
  let html = `<div class="tab-pane" data-tab="contracts">
    <button class="btn btn-sm btn-primary mb-2" onclick="createContract('${member.id}')">+ 创建合同</button>
    <div class="table-container">`;
  
  if (contracts.length === 0) {
    html += '<p class="text-muted">暂无合同</p>';
  } else {
    html += `<table class="data-table">
      <thead><tr><th>合同编号</th><th>类型</th><th>状态</th><th>金额</th><th>版本</th><th>创建时间</th><th>操作</th></tr></thead>
      <tbody>`;
    contracts.forEach(c => {
      html += `<tr>
        <td>${esc(c.contractNumber || '-')}</td>
        <td>${esc(c.templateKey || '-')}</td>
        <td><span class="badge badge-${getContractStatusClass(c.status)}">${esc(c.status)}</span></td>
        <td>¥${fmt(c.totalAmount)}</td>
        <td>${c.version || 1}</td>
        <td>${fmtDate(c.createdAt)}</td>
        <td class="actions">
          <button class="btn btn-xs" onclick="viewContract('${c.id}')">查看</button>
          <button class="btn btn-xs" onclick="editContract('${c.id}')">编辑</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
  }
  
  html += '</div></div>';
  return html;
}

function renderPaymentsTabContent(payments, member) {
  const totalPaid = payments.filter(p => p.validityStatus !== '已作废').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const contractAmount = Number(member.contractAmount) || 0;
  const unpaid = Math.max(0, contractAmount - totalPaid);
  
  let html = `<div class="tab-pane" data-tab="payments">
    <div class="payment-summary mb-2">
      <div class="stat-card small"><div class="stat-value">¥${fmt(contractAmount)}</div><div class="stat-label">合同金额</div></div>
      <div class="stat-card small"><div class="stat-value">¥${fmt(totalPaid)}</div><div class="stat-label">已收金额</div></div>
      <div class="stat-card small"><div class="stat-value">¥${fmt(unpaid)}</div><div class="stat-label">未收金额</div></div>
    </div>
    <button class="btn btn-sm btn-primary mb-2" onclick="addPayment('${member.id}')">+ 添加付款</button>
    <div class="table-container">`;
  
  if (payments.length === 0) {
    html += '<p class="text-muted">暂无付款记录</p>';
  } else {
    html += `<table class="data-table">
      <thead><tr><th>日期</th><th>金额</th><th>类型</th><th>用途</th><th>核对状态</th><th>备注</th><th>操作</th></tr></thead>
      <tbody>`;
    payments.forEach(p => {
      html += `<tr>
        <td>${fmtDate(p.paidAt)}</td>
        <td>¥${fmt(p.amount)}</td>
        <td>${esc(p.category || '-')}</td>
        <td>${esc(p.purpose || '-')}</td>
        <td><span class="badge">${esc(p.verificationStatus)}</span></td>
        <td>${esc(p.notes || '')}</td>
        <td class="actions">
          <button class="btn btn-xs" onclick="editPayment('${p.id}')">编辑</button>
          <button class="btn btn-xs btn-danger" onclick="voidPayment('${p.id}')">作废</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
  }
  
  html += '</div></div>';
  return html;
}

function renderBoothsTabContent(booths, member) {
  let html = `<div class="tab-pane" data-tab="booths">
    <button class="btn btn-sm btn-primary mb-2" onclick="addBooth('${member.id}')">+ 确认展位</button>
    <div class="table-container">`;
  
  if (booths.length === 0) {
    html += '<p class="text-muted">暂无展位确认记录</p>';
  } else {
    html += `<table class="data-table">
      <thead><tr><th>展位号</th><th>类型</th><th>面积</th><th>数量</th><th>馆号</th><th>开口</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>`;
    booths.forEach(b => {
      html += `<tr>
        <td>${esc(b.boothNumber || '待分配')}</td>
        <td>${esc(b.boothType)}</td>
        <td>${esc(b.area)}</td>
        <td>${esc(b.boothCount)}</td>
        <td>${esc(b.hallNumber)}</td>
        <td>${esc(b.openingType)}</td>
        <td><span class="badge">${esc(b.status)}</span></td>
        <td class="actions">
          <button class="btn btn-xs" onclick="editBooth('${b.id}')">编辑</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
  }
  
  html += '</div></div>';
  return html;
}

function renderRentalsTabContent(member) {
  const rentals = member.rentals || [];
  let html = `<div class="tab-pane" data-tab="rentals">
    <button class="btn btn-sm btn-primary mb-2" onclick="addRental('${member.id}')">+ 添加增租</button>
    <div class="table-container">`;
  
  if (rentals.length === 0) {
    html += '<p class="text-muted">暂无增租记录</p>';
  } else {
    html += `<table class="data-table">
      <thead><tr><th>类别</th><th>规格</th><th>数量</th><th>单价</th><th>总金额</th><th>已收</th><th>未收</th><th>状态</th></tr></thead>
      <tbody>`;
    rentals.forEach(r => {
      html += `<tr>
        <td>${esc(r.category || '')}</td><td>${esc(r.spec || '')}</td><td>${r.quantity || 0}</td>
        <td>¥${fmt(r.unitPrice)}</td><td>¥${fmt(r.totalPrice)}</td>
        <td>¥${fmt(r.paidAmount)}</td><td>¥${fmt((r.totalPrice||0)-(r.paidAmount||0))}</td>
        <td><span class="badge">${esc(r.paymentStatus || '未收款')}</span></td>
      </tr>`;
    });
    html += '</tbody></table>';
  }
  
  html += '</div></div>';
  return html;
}

function renderGroupTravelTabContent(member) {
  const gt = member.groupTravel || {};
  let html = `<div class="tab-pane" data-tab="group-travel">
    <div class="detail-grid">
      <div class="detail-item"><label>是否跟团</label><span>${member.isGroupTour ? '是' : '否'}</span></div>
      <div class="detail-item"><label>跟团人数</label><span>${gt.count || '-'}</span></div>
      <div class="detail-item"><label>参展人员</label><span>${esc(gt.participants || '-')}</span></div>
      <div class="detail-item"><label>护照</label><span>${esc(gt.passport || '-')}</span></div>
      <div class="detail-item"><label>签证</label><span>${esc(gt.visa || '-')}</span></div>
      <div class="detail-item"><label>机票</label><span>${esc(gt.flight || '-')}</span></div>
      <div class="detail-item"><label>酒店</label><span>${esc(gt.hotel || '-')}</span></div>
      <div class="detail-item"><label>保险</label><span>${esc(gt.insurance || '-')}</span></div>
      <div class="detail-item"><label>接送机</label><span>${esc(gt.transfer || '-')}</span></div>
      <div class="detail-item"><label>总费用</label><span>${gt.totalCost ? '¥'+fmt(gt.totalCost) : '-'}</span></div>
      <div class="detail-item"><label>已收</label><span>${gt.paidAmount ? '¥'+fmt(gt.paidAmount) : '-'}</span></div>
      <div class="detail-item"><label>未收</label><span>${gt.totalCost ? '¥'+fmt((gt.totalCost||0)-(gt.paidAmount||0)) : '-'}</span></div>
    </div>
    <button class="btn btn-sm mt-2" onclick="editGroupTravel('${member.id}')">编辑随团信息</button>
  </div>`;
  return html;
}

function renderSubsidyTabContent(member, project) {
  const subsidyMaterials = member.subsidyMaterials || {};
  const requirements = project ? (project.subsidyRequirements || []) : [];
  
  let html = `<div class="tab-pane" data-tab="subsidy">
    <div class="detail-item"><label>是否申请补贴</label><span>${member.subsidyEnabled ? '是' : '否'}</span></div>
    <h4 class="mt-2">补贴资料清单</h4>
    <div class="table-container">
      <table class="data-table">
        <thead><tr><th>资料名称</th><th>状态</th><th>备注</th></tr></thead>
        <tbody>`;
  
  if (requirements.length === 0) {
    html += '<tr><td colspan="3" class="text-muted">该项目未配置补贴资料清单</td></tr>';
  } else {
    requirements.forEach(req => {
      const item = subsidyMaterials[req] || {};
      const status = item.status || '未提交';
      html += `<tr>
        <td>${esc(req)}</td>
        <td><span class="badge badge-${status === '已通过' ? 'success' : status === '需补充' ? 'warning' : status === '未提交' ? 'default' : 'info'}">${esc(status)}</span></td>
        <td>${esc(item.notes || '')}</td>
      </tr>`;
    });
  }
  
  html += '</tbody></table></div>';
  html += `<button class="btn btn-sm mt-2" onclick="editSubsidy('${member.id}')">更新补贴资料</button>`;
  html += '</div>';
  return html;
}

function switchMemberTab(event, tabName) {
  // Update tab buttons
  event.currentTarget.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  event.currentTarget.classList.add('active');
  // Show content
  const content = document.getElementById('member-tab-content');
  if (content) {
    content.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const pane = content.querySelector(`[data-tab="${tabName}"]`);
    if (pane) pane.classList.add('active');
  }
}

// Edit member intention details
async function editMember(memberId) {
  const member = await getById('projectMembers', memberId);
  if (!member) { showToast('档案不存在', 'error'); return; }
  
  const intentionData = member.intentionData || {};
  
  showModal('编辑企业档案', `
    <div class="form-grid">
      <div class="form-group"><label>意向类型</label>
        <select id="f-intentionType" class="form-input">
          <option value="">未设置</option>
          ${['光地展位','独立标准展位','中国区标准展位','联合参展','其他'].map(t => `<option value="${t}" ${member.intentionType===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>意向面积(㎡)</label><input id="f-intendedArea" class="form-input" type="number" step="0.01" value="${member.intendedArea||''}" /></div>
      <div class="form-group"><label>意向展位数量</label><input id="f-intendedBoothCount" class="form-input" type="number" value="${member.intendedBoothCount||''}" /></div>
      <div class="form-group"><label>展位类型</label>
        <select id="f-boothType" class="form-input">
          <option value="">待确认</option>
          ${['光地展位','独立标准展位','中国区标准展位','联合参展','其他'].map(t => `<option value="${t}" ${member.boothType===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>意向馆号</label><input id="f-hall" class="form-input" value="${esc(intentionData.hall||'')}" /></div>
      <div class="form-group"><label>意向位置</label><input id="f-location" class="form-input" value="${esc(intentionData.location||'')}" /></div>
      <div class="form-group"><label>意向开口</label><input id="f-openings" class="form-input" value="${esc(intentionData.openings||'')}" /></div>
      <div class="form-group"><label>意向价格</label><input id="f-price" class="form-input" type="number" step="0.01" value="${intentionData.price||''}" /></div>
      <div class="form-group"><label>预计参展人数</label><input id="f-attendees" class="form-input" type="number" value="${intentionData.attendees||''}" /></div>
      <div class="form-group"><label>下次跟进日期</label><input id="f-nextFollowUp" class="form-input" type="date" value="${fmtDate(member.nextFollowUp)}" /></div>
      <div class="form-group"><label>合同状态</label>
        <select id="f-contractStatus" class="form-input">
          ${['未签订','草稿','待确认','已生成','已发送','待回签','已签订','履行中','已完成','已取消','已作废'].map(s => `<option value="${s}" ${member.contractStatus===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>合同金额</label><input id="f-contractAmount" class="form-input" type="number" step="0.01" value="${member.contractAmount||''}" /></div>
      <div class="form-group"><label>定金</label><input id="f-depositAmount" class="form-input" type="number" step="0.01" value="${member.depositAmount||''}" /></div>
      <div class="form-group"><label>付款状态</label>
        <select id="f-paymentStatus" class="form-input">
          ${['未收款','部分收款','已收全款','多收款','待核对','已退款'].map(s => `<option value="${s}" ${member.paymentStatus===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>业务归属</label><input id="f-businessOwner" class="form-input" value="${esc(member.businessOwner||member.owner||'')}" /></div>
      <div class="form-group"><label>是否跟团</label>
        <select id="f-isGroupTour" class="form-input">
          <option value="false" ${!member.isGroupTour?'selected':''}>否</option>
          <option value="true" ${member.isGroupTour?'selected':''}>是</option>
        </select></div>
      <div class="form-group"><label>是否申请补贴</label>
        <select id="f-subsidyEnabled" class="form-input">
          <option value="false" ${!member.subsidyEnabled?'selected':''}>否</option>
          <option value="true" ${member.subsidyEnabled?'selected':''}>是</option>
        </select></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f-notes" class="form-input" rows="3">${esc(member.notes)}</textarea></div>
    </div>
  `, async (overlay) => {
    member.intentionType = overlay.querySelector('#f-intentionType').value;
    member.intendedArea = overlay.querySelector('#f-intendedArea').value || '';
    member.intendedBoothCount = parseInt(overlay.querySelector('#f-intendedBoothCount').value) || 0;
    member.boothType = overlay.querySelector('#f-boothType').value;
    member.nextFollowUp = overlay.querySelector('#f-nextFollowUp').value;
    member.contractStatus = overlay.querySelector('#f-contractStatus').value;
    member.contractAmount = parseFloat(overlay.querySelector('#f-contractAmount').value) || 0;
    member.depositAmount = parseFloat(overlay.querySelector('#f-depositAmount').value) || 0;
    member.paymentStatus = overlay.querySelector('#f-paymentStatus').value;
    member.businessOwner = overlay.querySelector('#f-businessOwner').value.trim();
    member.owner = member.businessOwner;
    member.isGroupTour = overlay.querySelector('#f-isGroupTour').value === 'true';
    member.subsidyEnabled = overlay.querySelector('#f-subsidyEnabled').value === 'true';
    member.notes = overlay.querySelector('#f-notes').value.trim();
    member.intentionData = {
      ...intentionData,
      hall: overlay.querySelector('#f-hall').value.trim(),
      location: overlay.querySelector('#f-location').value.trim(),
      openings: overlay.querySelector('#f-openings').value.trim(),
      price: parseFloat(overlay.querySelector('#f-price').value) || 0,
      attendees: parseInt(overlay.querySelector('#f-attendees').value) || 0
    };
    member.updatedAt = now();
    await put('projectMembers', member);
    await openMemberDetail(memberId);
  });
}

// Add follow-up
async function addFollowUp(memberId) {
  showModal('添加跟进记录', `
    <div class="form-grid">
      <div class="form-group"><label>跟进日期 *</label><input id="f-date" class="form-input" type="datetime-local" value="${new Date().toISOString().slice(0,16)}" /></div>
      <div class="form-group"><label>跟进方式</label>
        <select id="f-method" class="form-input"><option>电话</option><option>微信</option><option>邮件</option><option>面谈</option><option>展会现场</option><option>其他</option></select></div>
      <div class="form-group"><label>跟进人员</label><input id="f-person" class="form-input" value="新丝路" /></div>
      <div class="form-group full-width"><label>跟进内容 *</label><textarea id="f-content" class="form-input" rows="4" required></textarea></div>
      <div class="form-group full-width"><label>反馈</label><textarea id="f-feedback" class="form-input" rows="2"></textarea></div>
      <div class="form-group"><label>下次跟进日期</label><input id="f-nextDate" class="form-input" type="date" /></div>
    </div>
  `, async (overlay) => {
    const content = overlay.querySelector('#f-content').value.trim();
    if (!content) throw new Error('跟进内容必填');
    
    const member = await getById('projectMembers', memberId);
    if (!member) throw new Error('档案不存在');
    
    const followUp = {
      id: generateId(),
      date: overlay.querySelector('#f-date').value,
      method: overlay.querySelector('#f-method').value,
      person: overlay.querySelector('#f-person').value.trim(),
      content: content,
      feedback: overlay.querySelector('#f-feedback').value.trim(),
      nextDate: overlay.querySelector('#f-nextDate').value,
      createdAt: now()
    };
    
    member.followUps = [...(member.followUps || []), followUp];
    member.nextFollowUp = followUp.nextDate || member.nextFollowUp;
    member.updatedAt = now();
    await put('projectMembers', member);
    await openMemberDetail(memberId);
  });
}

// Add payment
async function addPayment(memberId) {
  const member = await getById('projectMembers', memberId);
  if (!member) { showToast('档案不存在', 'error'); return; }
  
  showModal('添加付款记录', `
    <div class="form-grid">
      <div class="form-group"><label>付款日期 *</label><input id="f-paidAt" class="form-input" type="date" value="${new Date().toISOString().split('T')[0]}" /></div>
      <div class="form-group"><label>金额 *</label><input id="f-amount" class="form-input" type="number" step="0.01" /></div>
      <div class="form-group"><label>类型</label>
        <select id="f-category" class="form-input">
          <option>意向定金</option><option>展位费</option><option>展位费首款</option><option>展位费中期款</option><option>展位费尾款</option>
          <option>报名费</option><option>会刊费</option><option>增租费</option><option>随团费用</option><option>其他费用</option>
        </select></div>
      <div class="form-group"><label>用途</label><input id="f-purpose" class="form-input" /></div>
      <div class="form-group"><label>付款方式</label><input id="f-source" class="form-input" placeholder="银行转账/现金/微信/支付宝" /></div>
      <div class="form-group"><label>核对状态</label>
        <select id="f-verificationStatus" class="form-input"><option>待核对</option><option>已核对</option></select></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f-notes" class="form-input" rows="2"></textarea></div>
    </div>
  `, async (overlay) => {
    const amount = parseFloat(overlay.querySelector('#f-amount').value);
    if (!amount || amount <= 0) throw new Error('金额必须大于0');
    
    const payment = {
      id: generateId(),
      projectId: member.projectId,
      companyId: member.companyId,
      contractId: '',
      receivableId: '',
      amount: amount,
      paidAt: overlay.querySelector('#f-paidAt').value,
      category: overlay.querySelector('#f-category').value,
      purpose: overlay.querySelector('#f-purpose').value.trim() || overlay.querySelector('#f-category').value,
      source: overlay.querySelector('#f-source').value.trim(),
      verificationStatus: overlay.querySelector('#f-verificationStatus').value,
      validityStatus: '有效',
      notes: overlay.querySelector('#f-notes').value.trim(),
      createdAt: now(),
      updatedAt: now()
    };
    await put('paymentRecords', payment);
    
    // 更新 member 付款状态
    const allPayments = await getByIndex('paymentRecords', 'companyId', String(member.companyId));
    const memberPayments = allPayments.filter(p => String(p.projectId) === String(member.projectId) && p.validityStatus !== '已作废');
    const totalPaid = memberPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const contractAmount = Number(member.contractAmount) || 0;
    
    if (totalPaid <= 0) {
      member.paymentStatus = '未收款';
    } else if (totalPaid < contractAmount) {
      member.paymentStatus = '部分收款';
    } else if (Math.abs(totalPaid - contractAmount) < 0.01) {
      member.paymentStatus = '已收全款';
    } else {
      member.paymentStatus = '多收款';
    }
    member.updatedAt = now();
    await put('projectMembers', member);
    await openMemberDetail(memberId);
  });
}

// Add booth
async function addBooth(memberId) {
  const member = await getById('projectMembers', memberId);
  if (!member) { showToast('档案不存在', 'error'); return; }
  
  showModal('确认展位', `
    <div class="form-grid">
      <div class="form-group"><label>展位类型</label>
        <select id="f-boothType" class="form-input">
          <option>光地展位</option><option>独立标准展位</option><option>中国区标准展位</option><option>联合参展</option><option>其他</option>
        </select></div>
      <div class="form-group"><label>面积(㎡)</label><input id="f-area" class="form-input" type="number" step="0.01" /></div>
      <div class="form-group"><label>展位数量</label><input id="f-boothCount" class="form-input" type="number" /></div>
      <div class="form-group"><label>馆号</label><input id="f-hallNumber" class="form-input" /></div>
      <div class="form-group"><label>展位号</label><input id="f-boothNumber" class="form-input" /></div>
      <div class="form-group"><label>开口</label>
        <select id="f-openingType" class="form-input">
          <option>暂未确定</option><option>一面开</option><option>两面开</option><option>三面开</option><option>四面开</option>
        </select></div>
      <div class="form-group"><label>状态</label>
        <select id="f-status" class="form-input"><option>待确认</option><option>已确认</option></select></div>
      <div class="form-group"><label>确认日期</label><input id="f-confirmedAt" class="form-input" type="date" /></div>
      <div class="form-group full-width"><label>位置备注</label><textarea id="f-locationNotes" class="form-input" rows="2"></textarea></div>
    </div>
  `, async (overlay) => {
    const booth = {
      id: generateId(),
      projectId: member.projectId,
      companyId: member.companyId,
      boothType: overlay.querySelector('#f-boothType').value,
      area: overlay.querySelector('#f-area').value || '',
      boothCount: parseInt(overlay.querySelector('#f-boothCount').value) || 0,
      hallNumber: overlay.querySelector('#f-hallNumber').value.trim(),
      boothNumber: overlay.querySelector('#f-boothNumber').value.trim(),
      openingType: overlay.querySelector('#f-openingType').value,
      status: overlay.querySelector('#f-status').value,
      confirmedAt: overlay.querySelector('#f-confirmedAt').value || now(),
      confirmedBy: '',
      locationNotes: overlay.querySelector('#f-locationNotes').value.trim(),
      sourceSnapshot: '{}',
      unitPrice: 0,
      totalPrice: 0,
      updatedAt: now()
    };
    await put('boothConfirmations', booth);
    await openMemberDetail(memberId);
  });
}

// Add rental
async function addRental(memberId) {
  const member = await getById('projectMembers', memberId);
  if (!member) { showToast('档案不存在', 'error'); return; }
  
  showModal('添加增租', `
    <div class="form-grid">
      <div class="form-group"><label>类别</label><input id="f-category" class="form-input" /></div>
      <div class="form-group"><label>规格</label><input id="f-spec" class="form-input" /></div>
      <div class="form-group"><label>数量</label><input id="f-quantity" class="form-input" type="number" /></div>
      <div class="form-group"><label>单价</label><input id="f-unitPrice" class="form-input" type="number" step="0.01" /></div>
      <div class="form-group"><label>总金额</label><input id="f-totalPrice" class="form-input" type="number" step="0.01" /></div>
      <div class="form-group"><label>已收金额</label><input id="f-paidAmount" class="form-input" type="number" step="0.01" value="0" /></div>
      <div class="form-group"><label>付款状态</label>
        <select id="f-paymentStatus" class="form-input"><option>未收款</option><option>部分收款</option><option>已收全款</option></select></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f-notes" class="form-input" rows="2"></textarea></div>
    </div>
  `, async (overlay) => {
    const rental = {
      id: generateId(),
      category: overlay.querySelector('#f-category').value.trim(),
      spec: overlay.querySelector('#f-spec').value.trim(),
      quantity: parseInt(overlay.querySelector('#f-quantity').value) || 0,
      unitPrice: parseFloat(overlay.querySelector('#f-unitPrice').value) || 0,
      totalPrice: parseFloat(overlay.querySelector('#f-totalPrice').value) || 0,
      paidAmount: parseFloat(overlay.querySelector('#f-paidAmount').value) || 0,
      paymentStatus: overlay.querySelector('#f-paymentStatus').value,
      notes: overlay.querySelector('#f-notes').value.trim()
    };
    member.rentals = [...(member.rentals || []), rental];
    member.updatedAt = now();
    await put('projectMembers', member);
    await openMemberDetail(memberId);
  });
}

// Edit group travel
async function editGroupTravel(memberId) {
  const member = await getById('projectMembers', memberId);
  if (!member) { showToast('档案不存在', 'error'); return; }
  const gt = member.groupTravel || {};
  
  showModal('编辑随团信息', `
    <div class="form-grid">
      <div class="form-group"><label>是否跟团</label>
        <select id="f-isGroupTour" class="form-input"><option value="false">否</option><option value="true" ${member.isGroupTour?'selected':''}>是</option></select></div>
      <div class="form-group"><label>跟团人数</label><input id="f-count" class="form-input" type="number" value="${gt.count||''}" /></div>
      <div class="form-group"><label>参展人员</label><input id="f-participants" class="form-input" value="${esc(gt.participants||'')}" /></div>
      <div class="form-group"><label>护照</label><input id="f-passport" class="form-input" value="${esc(gt.passport||'')}" /></div>
      <div class="form-group"><label>签证</label><input id="f-visa" class="form-input" value="${esc(gt.visa||'')}" /></div>
      <div class="form-group"><label>机票</label><input id="f-flight" class="form-input" value="${esc(gt.flight||'')}" /></div>
      <div class="form-group"><label>酒店</label><input id="f-hotel" class="form-input" value="${esc(gt.hotel||'')}" /></div>
      <div class="form-group"><label>保险</label><input id="f-insurance" class="form-input" value="${esc(gt.insurance||'')}" /></div>
      <div class="form-group"><label>接送机</label><input id="f-transfer" class="form-input" value="${esc(gt.transfer||'')}" /></div>
      <div class="form-group"><label>总费用</label><input id="f-totalCost" class="form-input" type="number" step="0.01" value="${gt.totalCost||''}" /></div>
      <div class="form-group"><label>已收</label><input id="f-paidAmount" class="form-input" type="number" step="0.01" value="${gt.paidAmount||''}" /></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f-notes" class="form-input" rows="2">${esc(gt.notes||'')}</textarea></div>
    </div>
  `, async (overlay) => {
    member.isGroupTour = overlay.querySelector('#f-isGroupTour').value === 'true';
    member.groupTravel = {
      count: parseInt(overlay.querySelector('#f-count').value) || 0,
      participants: overlay.querySelector('#f-participants').value.trim(),
      passport: overlay.querySelector('#f-passport').value.trim(),
      visa: overlay.querySelector('#f-visa').value.trim(),
      flight: overlay.querySelector('#f-flight').value.trim(),
      hotel: overlay.querySelector('#f-hotel').value.trim(),
      insurance: overlay.querySelector('#f-insurance').value.trim(),
      transfer: overlay.querySelector('#f-transfer').value.trim(),
      totalCost: parseFloat(overlay.querySelector('#f-totalCost').value) || 0,
      paidAmount: parseFloat(overlay.querySelector('#f-paidAmount').value) || 0,
      notes: overlay.querySelector('#f-notes').value.trim()
    };
    member.updatedAt = now();
    await put('projectMembers', member);
    await openMemberDetail(memberId);
  });
}

// Edit subsidy
async function editSubsidy(memberId) {
  const member = await getById('projectMembers', memberId);
  if (!member) { showToast('档案不存在', 'error'); return; }
  const project = await getById('projects', String(member.projectId));
  const requirements = project ? (project.subsidyRequirements || []) : [];
  const currentMaterials = member.subsidyMaterials || {};
  
  let formHtml = `
    <div class="form-group"><label>是否申请补贴</label>
      <select id="f-subsidyEnabled" class="form-input">
        <option value="true" ${member.subsidyEnabled?'selected':''}>是</option>
        <option value="false" ${!member.subsidyEnabled?'selected':''}>否</option>
      </select></div>
    <h4 class="mt-2">资料状态</h4>`;
  
  requirements.forEach(req => {
    const item = currentMaterials[req] || {};
    formHtml += `
      <div class="form-row">
        <span class="form-label">${esc(req)}</span>
        <select name="subsidy-status" data-key="${esc(req)}" class="form-input sm">
          <option value="未提交" ${(item.status||'未提交')==='未提交'?'selected':''}>未提交</option>
          <option value="已提交" ${item.status==='已提交'?'selected':''}>已提交</option>
          <option value="待审核" ${item.status==='待审核'?'selected':''}>待审核</option>
          <option value="需补充" ${item.status==='需补充'?'selected':''}>需补充</option>
          <option value="已通过" ${item.status==='已通过'?'selected':''}>已通过</option>
          <option value="不适用" ${item.status==='不适用'?'selected':''}>不适用</option>
        </select>
        <input name="subsidy-notes" data-key="${esc(req)}" class="form-input sm" placeholder="备注" value="${esc(item.notes||'')}" />
      </div>`;
  });
  
  showModal('补贴资料管理', formHtml, async (overlay) => {
    member.subsidyEnabled = overlay.querySelector('#f-subsidyEnabled').value === 'true';
    
    const newMaterials = {};
    const statusSelects = overlay.querySelectorAll('select[name="subsidy-status"]');
    const notesInputs = overlay.querySelectorAll('input[name="subsidy-notes"]');
    
    statusSelects.forEach(s => {
      const key = s.dataset.key;
      newMaterials[key] = { status: s.value, notes: '' };
    });
    notesInputs.forEach(n => {
      const key = n.dataset.key;
      if (newMaterials[key]) newMaterials[key].notes = n.value.trim();
    });
    
    member.subsidyMaterials = newMaterials;
    member.updatedAt = now();
    await put('projectMembers', member);
    await openMemberDetail(memberId);
  });
}
