/**
 * 合同中心模块 - 全局合同管理
 */
async function renderContracts() {
  const contracts = await getAll('contracts');
  const companies = await getAll('companies');
  const projects = await getAll('projects');
  
  let html = `<div class="panel">
    <div class="panel-header">
      <h2>📝 合同中心 (${contracts.length} 份)</h2>
    </div>
    <div class="filter-bar">
      <input type="text" id="contract-search" class="search-input" placeholder="搜索合同编号..." oninput="filterContracts()" />
      <select id="filter-contract-status" class="filter-select" onchange="filterContracts()">
        <option value="">全部状态</option>
        <option>未签订</option><option>草稿</option><option>待确认</option><option>已生成</option><option>已发送</option><option>待回签</option><option>已签订</option><option>履行中</option><option>已完成</option><option>已取消</option><option>已作废</option>
      </select>
      <select id="filter-contract-project" class="filter-select" onchange="filterContracts()">
        <option value="">全部项目</option>
        ${projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
      </select>
    </div>
    <div class="table-container" id="contracts-table">
      ${renderContractTable(contracts, companies, projects)}
    </div>
  </div>`;
  return html;
}

function renderContractTable(contracts, companies, projects) {
  if (contracts.length === 0) {
    return '<p class="text-muted text-center p-4">暂无合同</p>';
  }
  
  return `<table class="data-table">
    <thead><tr>
      <th>合同编号</th><th>企业</th><th>项目</th><th>模板</th><th>状态</th>
      <th>展位费</th><th>其他费</th><th>总金额</th><th>签署日期</th><th>操作</th>
    </tr></thead>
    <tbody>
      ${contracts.map(c => {
        const company = companies.find(co => String(co.id) === String(c.companyId));
        const project = projects.find(p => String(p.id) === String(c.projectId));
        return `<tr>
          <td><strong>${esc(c.contractNumber || '未编号')}</strong></td>
          <td>${esc(company ? company.companyCn : c.companyId)}</td>
          <td>${esc(project ? project.name : '')}</td>
          <td>${esc(c.templateKey || '-')}</td>
          <td><span class="badge badge-${getContractStatusClass(c.status)}">${esc(c.status)}</span></td>
          <td>¥${fmt(c.boothSubtotal)}</td>
          <td>¥${fmt(c.otherFeeSubtotal)}</td>
          <td>¥${fmt(c.totalAmount)}</td>
          <td>${fmtDate(c.signedAt)}</td>
          <td class="actions">
            <button class="btn btn-xs" onclick="viewContract('${c.id}')">查看</button>
            <button class="btn btn-xs" onclick="editContract('${c.id}')">编辑</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

async function filterContracts() {
  const query = (document.getElementById('contract-search')?.value || '').toLowerCase();
  const status = document.getElementById('filter-contract-status')?.value || '';
  const projectId = document.getElementById('filter-contract-project')?.value || '';
  
  let contracts = await getAll('contracts');
  const companies = await getAll('companies');
  const projects = await getAll('projects');
  
  if (query) {
    contracts = contracts.filter(c => 
      (c.contractNumber && c.contractNumber.toLowerCase().includes(query)) ||
      companies.some(co => String(co.id) === String(c.companyId) && co.companyCn && co.companyCn.toLowerCase().includes(query))
    );
  }
  if (status) contracts = contracts.filter(c => c.status === status);
  if (projectId) contracts = contracts.filter(c => String(c.projectId) === projectId);
  
  const container = document.getElementById('contracts-table');
  if (container) container.innerHTML = renderContractTable(contracts, companies, projects);
}

async function createContract(memberId) {
  const member = await getById('projectMembers', memberId);
  if (!member) { showToast('档案不存在', 'error'); return; }
  const project = await getById('projects', String(member.projectId));
  const company = await getById('companies', String(member.companyId));
  
  if (!project) { showToast('项目不存在', 'error'); return; }
  
  // Try to generate contract number
  let contractNumber = '';
  try {
    contractNumber = await generateContractNumber(member.projectId);
  } catch(e) {
    showToast(e.message, 'warning');
  }
  
  const config = project.profitConfig || {};
  
  showModal('创建合同', `
    <div class="form-grid">
      <div class="form-group"><label>合同编号</label><input id="f-contractNumber" class="form-input" value="${contractNumber}" readonly /></div>
      <div class="form-group"><label>模板</label>
        <select id="f-templateKey" class="form-input">
          <option value="">通用合同</option>
          <option value="欧洲智慧能源展专用合同" ${project.englishName === 'The SMARTER E Europe' ? 'selected' : ''}>欧洲智慧能源展专用合同</option>
          <option value="标准展位合同">标准展位合同</option>
          <option value="空地合同">空地合同</option>
          <option value="联合参展合同">联合参展合同</option>
        </select></div>
      <div class="form-group"><label>状态</label>
        <select id="f-status" class="form-input"><option>草稿</option><option>待确认</option></select></div>
      <div class="form-group"><label>币种</label><input id="f-currency" class="form-input" value="CNY" /></div>
      <div class="form-group"><label>展位费小计</label><input id="f-boothSubtotal" class="form-input" type="number" step="0.01" /></div>
      <div class="form-group"><label>其他费用小计</label><input id="f-otherFeeSubtotal" class="form-input" type="number" step="0.01" /></div>
      <div class="form-group"><label>合同总金额</label><input id="f-totalAmount" class="form-input" type="number" step="0.01" /></div>
      <div class="form-group full-width"><label>费用明细(JSON)</label><textarea id="f-feeLines" class="form-input" rows="4">[]</textarea></div>
      <div class="form-group full-width"><label>付款计划(JSON)</label><textarea id="f-paymentTerms" class="form-input" rows="3">{}</textarea></div>
    </div>
  `, async (overlay) => {
    const totalAmountInput = overlay.querySelector('#f-totalAmount').value.trim();
    const totalAmount = totalAmountInput !== '' ? parseFloat(totalAmountInput) : (boothSubtotal + otherFeeSubtotal);
    const boothSubtotal = parseFloat(overlay.querySelector('#f-boothSubtotal').value) || 0;
    const otherFeeSubtotal = parseFloat(overlay.querySelector('#f-otherFeeSubtotal').value) || 0;
    
    let feeLines = [];
    try { feeLines = JSON.parse(overlay.querySelector('#f-feeLines').value); } catch(e) {}
    let paymentTerms = {};
    try { paymentTerms = JSON.parse(overlay.querySelector('#f-paymentTerms').value); } catch(e) {}
    
    const contract = {
      id: generateId(),
      projectId: member.projectId,
      companyId: member.companyId,
      contractNumber: overlay.querySelector('#f-contractNumber').value.trim() || contractNumber,
      templateKey: overlay.querySelector('#f-templateKey').value,
      version: 1,
      status: overlay.querySelector('#f-status').value,
      currency: overlay.querySelector('#f-currency').value,
      boothSubtotal: boothSubtotal,
      otherFeeSubtotal: otherFeeSubtotal,
      totalAmount: totalAmount,
      totalAmountUppercase: amountToChinese(totalAmount),
      boothSnapshot: '{}',
      partySnapshot: '{}',
      feeLines: JSON.stringify(feeLines),
      paymentTerms: JSON.stringify(paymentTerms),
      templateSnapshot: '{}',
      signedAt: '',
      createdAt: now(),
      updatedAt: now()
    };
    await put('contracts', contract);
    
    // Update member contract info
    member.contractStatus = contract.status === '草稿' ? '草稿' : contract.status;
    member.contractNumber = contract.contractNumber;
    member.contractAmount = contract.totalAmount;
    member.updatedAt = now();
    await put('projectMembers', member);
    await openMemberDetail(memberId);
  });

async function viewContract(contractId) {
  const contract = await getById('contracts', contractId);
  if (!contract) { showToast('合同不存在', 'error'); return; }
  
  const company = await getById('companies', String(contract.companyId));
  const project = await getById('projects', String(contract.projectId));
  
  let feeLines = [];
  try { feeLines = JSON.parse(contract.feeLines || '[]'); } catch(e) {}
  let paymentTerms = {};
  try { paymentTerms = JSON.parse(contract.paymentTerms || '{}'); } catch(e) {}
  let boothSnapshot = {};
  try { boothSnapshot = JSON.parse(contract.boothSnapshot || '{}'); } catch(e) {}
  let partySnapshot = {};
  try { partySnapshot = JSON.parse(contract.partySnapshot || '{}'); } catch(e) {}
  
  let html = `<div class="panel">
    <div class="panel-header">
      <h2>📝 合同详情</h2>
      <button class="btn btn-sm" onclick="navigateTo('contracts')">返回合同中心</button>
    </div>
    <div class="panel-body">
      <div class="detail-grid">
        <div class="detail-item"><label>合同编号</label><span><strong>${esc(contract.contractNumber)}</strong></span></div>
        <div class="detail-item"><label>企业</label><span>${esc(company ? company.companyCn : '')}</span></div>
        <div class="detail-item"><label>项目</label><span>${esc(project ? project.name : '')}</span></div>
        <div class="detail-item"><label>展会名称</label><span>${esc(project ? project.name : '')}</span></div>
        <div class="detail-item"><label>展会时间</label><span>${fmtDate(project ? project.startDate : '')} - ${fmtDate(project ? project.endDate : '')}</span></div>
        <div class="detail-item"><label>展会地点</label><span>${esc(project ? project.location : '')}</span></div>
        <div class="detail-item"><label>模板</label><span>${esc(contract.templateKey)}</span></div>
        <div class="detail-item"><label>状态</label><span class="badge badge-${getContractStatusClass(contract.status)}">${esc(contract.status)}</span></div>
        <div class="detail-item"><label>版本</label><span>${contract.version}</span></div>
        <div class="detail-item"><label>币种</label><span>${esc(contract.currency)}</span></div>
        <div class="detail-item"><label>展位费小计</label><span>¥${fmt(contract.boothSubtotal)}</span></div>
        <div class="detail-item"><label>其他费用</label><span>¥${fmt(contract.otherFeeSubtotal)}</span></div>
        <div class="detail-item"><label>合同总金额</label><span style="font-size:1.2em;color:var(--accent);font-weight:bold">¥${fmt(contract.totalAmount)}</span></div>
        <div class="detail-item"><label>大写</label><span>${esc(contract.totalAmountUppercase)}</span></div>
        <div class="detail-item"><label>签署日期</label><span>${fmtDate(contract.signedAt)}</span></div>
        <div class="detail-item"><label>创建时间</label><span>${fmtDate(contract.createdAt)}</span></div>
      </div>
      
      <h4 class="mt-2">费用明细</h4>
      <div class="table-container">
        ${feeLines.length > 0 ? `
          <table class="data-table">
            <thead><tr><th>类型</th><th>项目</th><th>数量</th><th>单位</th><th>单价</th><th>金额</th></tr></thead>
            <tbody>
              ${feeLines.map(f => `<tr><td>${esc(f.kind||'')}</td><td>${esc(f.label||'')}</td><td>${f.quantity||0}</td><td>${esc(f.unit||'')}</td><td>¥${fmt(f.unitPrice)}</td><td>¥${fmt((f.quantity||0)*(f.unitPrice||0))}</td></tr>`).join('')}
            </tbody>
          </table>
        ` : '<p class="text-muted">暂无费用明细</p>'}
      </div>
      
      <div style="margin-top:16px">
        <button class="btn btn-primary" onclick="exportContractPDF('${contractId}')">📄 导出合同PDF</button>
        <button class="btn" onclick="editContract('${contractId}')">编辑合同</button>
      </div>
    </div>
  </div>`;
  
  document.getElementById('content-area').innerHTML = html;
}

async function editContract(contractId) {
  const contract = await getById('contracts', contractId);
  if (!contract) { showToast('合同不存在', 'error'); return; }
  
  showModal('编辑合同', `
    <div class="form-grid">
      <div class="form-group"><label>合同编号</label><input id="f-contractNumber" class="form-input" value="${esc(contract.contractNumber)}" /></div>
      <div class="form-group"><label>状态</label>
        <select id="f-status" class="form-input">
          ${['草稿','待确认','已生成','已发送','待回签','已签订','履行中','已完成','已取消','已作废'].map(s => `<option value="${s}" ${contract.status===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>展位费</label><input id="f-boothSubtotal" class="form-input" type="number" step="0.01" value="${contract.boothSubtotal||0}" /></div>
      <div class="form-group"><label>其他费用</label><input id="f-otherFeeSubtotal" class="form-input" type="number" step="0.01" value="${contract.otherFeeSubtotal||0}" /></div>
      <div class="form-group"><label>总金额</label><input id="f-totalAmount" class="form-input" type="number" step="0.01" value="${contract.totalAmount||0}" /></div>
      <div class="form-group"><label>签署日期</label><input id="f-signedAt" class="form-input" type="date" value="${fmtDate(contract.signedAt)}" /></div>
      <div class="form-group full-width"><label>费用明细</label><textarea id="f-feeLines" class="form-input" rows="4">${contract.feeLines||'[]'}</textarea></div>
      <div class="form-group full-width"><label>付款计划</label><textarea id="f-paymentTerms" class="form-input" rows="3">${contract.paymentTerms||'{}'}</textarea></div>
    </div>
  `, async (overlay) => {
    const totalAmountInput = overlay.querySelector('#f-totalAmount').value.trim();
    const totalAmount = totalAmountInput !== '' ? parseFloat(totalAmountInput) : 0;
    contract.contractNumber = overlay.querySelector('#f-contractNumber').value.trim();
    contract.status = overlay.querySelector('#f-status').value;
    contract.boothSubtotal = parseFloat(overlay.querySelector('#f-boothSubtotal').value) || 0;
    contract.otherFeeSubtotal = parseFloat(overlay.querySelector('#f-otherFeeSubtotal').value) || 0;
    contract.totalAmount = totalAmount;
    contract.totalAmountUppercase = amountToChinese(totalAmount);
    contract.signedAt = overlay.querySelector('#f-signedAt').value;
    contract.feeLines = overlay.querySelector('#f-feeLines').value.trim();
    contract.paymentTerms = overlay.querySelector('#f-paymentTerms').value.trim();
    contract.updatedAt = now();
    
    await put('contracts', contract);
    
    // Sync with member
    const members = await getByIndex('projectMembers', 'companyId', String(contract.companyId));
    const member = members.find(m => String(m.projectId) === String(contract.projectId));
    if (member) {
      member.contractStatus = contract.status;
      member.contractNumber = contract.contractNumber;
      member.contractAmount = contract.totalAmount;
      member.updatedAt = now();
      await put('projectMembers', member);
    }
  });
}

async function exportContractPDF(contractId) {
  showToast('合同导出功能已就绪。请使用浏览器的"打印"功能(Ctrl+P 或 Cmd+P)导出为PDF。', 'info');
}
