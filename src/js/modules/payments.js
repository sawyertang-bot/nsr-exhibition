/**
 * 付款中心模块
 */
async function renderPayments() {
  const payments = await getAll('paymentRecords');
  const companies = await getAll('companies');
  const projects = await getAll('projects');
  
  const totalAmount = payments.filter(p => p.validityStatus !== '已作废').reduce((s, p) => s + (Number(p.amount) || 0), 0);
  
  let html = `<div class="panel">
    <div class="panel-header">
      <h2>💰 付款中心</h2>
      <div class="panel-actions">
        <span class="text-muted">总收款: <strong>¥${fmt(totalAmount)}</strong> (${payments.length} 笔)</span>
      </div>
    </div>
    <div class="filter-bar">
      <select id="filter-payment-project" class="filter-select" onchange="filterPayments()">
        <option value="">全部项目</option>
        ${projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
      </select>
      <select id="filter-payment-status" class="filter-select" onchange="filterPayments()">
        <option value="">全部核对状态</option>
        <option>待核对</option><option>已核对</option>
      </select>
      <select id="filter-payment-category" class="filter-select" onchange="filterPayments()">
        <option value="">全部类型</option>
        <option>意向定金</option><option>展位费</option><option>展位费首款</option><option>展位费中期款</option><option>展位费尾款</option>
        <option>报名费</option><option>会刊费</option><option>增租费</option><option>随团费用</option><option>其他费用</option>
      </select>
    </div>
    <div class="table-container" id="payments-table">
      ${renderPaymentTable(payments, companies, projects)}
    </div>
  </div>`;
  return html;
}

function renderPaymentTable(payments, companies, projects) {
  const validPayments = payments.filter(p => p.validityStatus !== '已作废');
  const total = validPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  
  let html = '';
  if (validPayments.length === 0) {
    html += '<p class="text-muted text-center p-4">暂无付款记录</p>';
  } else {
    html += `<table class="data-table">
      <thead><tr>
        <th>日期</th><th>企业</th><th>项目</th><th>类型</th><th>用途</th>
        <th>金额</th><th>核对</th><th>备注</th><th>操作</th>
      </tr></thead>
      <tbody>`;
    validPayments.forEach(p => {
      const company = companies.find(c => String(c.id) === String(p.companyId));
      const project = projects.find(pr => String(pr.id) === String(p.projectId));
      html += `<tr>
        <td>${fmtDate(p.paidAt)}</td>
        <td>${esc(company ? company.companyCn : '')}</td>
        <td>${esc(project ? project.name : '')}</td>
        <td>${esc(p.category)}</td>
        <td>${esc(p.purpose || '')}</td>
        <td class="amount">¥${fmt(p.amount)}</td>
        <td><span class="badge badge-${p.verificationStatus === '已核对' ? 'success' : 'warning'}">${esc(p.verificationStatus)}</span></td>
        <td>${esc(p.notes || '')}</td>
        <td class="actions">
          <button class="btn btn-xs" onclick="editPayment('${p.id}')">编辑</button>
          <button class="btn btn-xs btn-danger" onclick="voidPayment('${p.id}')">作废</button>
        </td>
      </tr>`;
    });
    html += `</tbody><tfoot><tr><td colspan="5" class="text-right"><strong>合计</strong></td><td class="amount"><strong>¥${fmt(total)}</strong></td><td colspan="3"></td></tr></tfoot></table>`;
  }
  return html;
}

async function filterPayments() {
  const projectId = document.getElementById('filter-payment-project')?.value || '';
  const status = document.getElementById('filter-payment-status')?.value || '';
  const category = document.getElementById('filter-payment-category')?.value || '';
  
  let payments = await getAll('paymentRecords');
  if (projectId) payments = payments.filter(p => String(p.projectId) === projectId);
  if (status) payments = payments.filter(p => p.verificationStatus === status);
  if (category) payments = payments.filter(p => p.category === category);
  
  const companies = await getAll('companies');
  const projects = await getAll('projects');
  
  const container = document.getElementById('payments-table');
  if (container) container.innerHTML = renderPaymentTable(payments, companies, projects);
}

async function editPayment(paymentId) {
  const payment = await getById('paymentRecords', paymentId);
  if (!payment) { showToast('付款记录不存在', 'error'); return; }
  
  showModal('编辑付款记录', `
    <div class="form-grid">
      <div class="form-group"><label>付款日期</label><input id="f-paidAt" class="form-input" type="date" value="${fmtDate(payment.paidAt)}" /></div>
      <div class="form-group"><label>金额</label><input id="f-amount" class="form-input" type="number" step="0.01" value="${payment.amount}" /></div>
      <div class="form-group"><label>类型</label>
        <select id="f-category" class="form-input">
          ${['意向定金','展位费','展位费首款','展位费中期款','展位费尾款','报名费','会刊费','增租费','随团费用','其他费用'].map(c => `<option value="${c}" ${payment.category===c?'selected':''}>${c}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>用途</label><input id="f-purpose" class="form-input" value="${esc(payment.purpose)}" /></div>
      <div class="form-group"><label>核对状态</label>
        <select id="f-verificationStatus" class="form-input">
          <option ${payment.verificationStatus==='待核对'?'selected':''}>待核对</option>
          <option ${payment.verificationStatus==='已核对'?'selected':''}>已核对</option>
        </select></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f-notes" class="form-input" rows="2">${esc(payment.notes)}</textarea></div>
    </div>
  `, async (overlay) => {
    payment.paidAt = overlay.querySelector('#f-paidAt').value;
    payment.amount = parseFloat(overlay.querySelector('#f-amount').value) || 0;
    payment.category = overlay.querySelector('#f-category').value;
    payment.purpose = overlay.querySelector('#f-purpose').value.trim();
    payment.verificationStatus = overlay.querySelector('#f-verificationStatus').value;
    payment.notes = overlay.querySelector('#f-notes').value.trim();
    payment.updatedAt = now();
    await put('paymentRecords', payment);
    
    // 同步更新 member 付款状态
    const memberPayments = await getByIndex('paymentRecords', 'companyId', String(payment.companyId));
    const projPayments = memberPayments.filter(p => String(p.projectId) === String(payment.projectId) && p.validityStatus !== '已作废');
    const totalPaid = projPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const members = await getByIndex('projectMembers', 'companyId', String(payment.companyId));
    const member = members.find(m => String(m.projectId) === String(payment.projectId));
    if (member) {
      const contractAmount = Number(member.contractAmount) || 0;
      if (totalPaid <= 0) member.paymentStatus = '未收款';
      else if (totalPaid < contractAmount) member.paymentStatus = '部分收款';
      else if (Math.abs(totalPaid - contractAmount) < 0.01) member.paymentStatus = '已收全款';
      else member.paymentStatus = '多收款';
      member.updatedAt = now();
      await put('projectMembers', member);
    }
    
    showToast('付款记录已更新', 'success');
  });
}

async function voidPayment(paymentId) {
  const payment = await getById('paymentRecords', paymentId);
  if (!payment) { showToast('付款记录不存在', 'error'); return; }
  
  if (!confirm(`确定要作废这笔付款吗？\n\n金额: ¥${fmt(payment.amount)}\n日期: ${fmtDate(payment.paidAt)}\n\n作废后该记录将保留但标记为无效。`)) return;
  
  payment.validityStatus = '已作废';
  payment.updatedAt = now();
  await put('paymentRecords', payment);
  
  // 同步更新 member 付款状态
  const memberPayments = await getByIndex('paymentRecords', 'companyId', String(payment.companyId));
  const projPayments = memberPayments.filter(p => String(p.projectId) === String(payment.projectId) && p.validityStatus !== '已作废');
  const totalPaid = projPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const members = await getByIndex('projectMembers', 'companyId', String(payment.companyId));
  const member = members.find(m => String(m.projectId) === String(payment.projectId));
  if (member) {
    const contractAmount = Number(member.contractAmount) || 0;
    if (totalPaid <= 0) member.paymentStatus = '未收款';
    else if (totalPaid < contractAmount) member.paymentStatus = '部分收款';
    else if (Math.abs(totalPaid - contractAmount) < 0.01) member.paymentStatus = '已收全款';
    else member.paymentStatus = '多收款';
    member.updatedAt = now();
    await put('projectMembers', member);
  }
  
  showToast('付款记录已作废', 'warning');
  navigateTo('payments');
}
