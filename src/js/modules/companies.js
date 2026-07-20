/**
 * 企业库模块
 */
async function renderCompanies() {
  const companies = await getAll('companies');
  const settings = await getAll('systemSettings');
  const settingsMap = {};
  settings.forEach(s => settingsMap[s.key] = s.value);
  
  const owners = (settingsMap.businessOwners || '新丝路').split('\n').filter(Boolean);
  
  let html = `<div class="panel">
    <div class="panel-header">
      <h2>🏢 企业库 (${companies.length} 家)</h2>
      <div class="panel-actions">
        <button class="btn btn-primary" onclick="showAddCompany()">+ 新增企业</button>
        <button class="btn btn-sm" onclick="exportCompanies()">导出CSV</button>
      </div>
    </div>
    
    <!-- 搜索和筛选 -->
    <div class="filter-bar">
      <input type="text" id="company-search" class="search-input" placeholder="搜索企业名称/联系人/电话/邮箱..." oninput="filterCompanies()" />
      <select id="filter-stage" class="filter-select" onchange="filterCompanies()">
        <option value="">全部阶段</option>
        <option>新线索</option><option>已联系</option><option>已报价</option><option>已签约</option><option>已完成</option><option>已放弃</option>
      </select>
      <select id="filter-owner" class="filter-select" onchange="filterCompanies()">
        <option value="">全部归属</option>
        ${owners.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
      </select>
      <select id="filter-priority" class="filter-select" onchange="filterCompanies()">
        <option value="">全部优先级</option>
        <option>高</option><option>中</option><option>低</option>
      </select>
      <select id="filter-province" class="filter-select" onchange="filterCompanies()">
        <option value="">全部地区</option>
        ${[...new Set(companies.map(c => c.province).filter(Boolean))].sort().map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
      </select>
    </div>
    
    <!-- 企业列表 -->
    <div class="table-container" id="companies-table">
      ${renderCompanyTable(companies)}
    </div>
    
    <div class="pagination">
      <span class="text-muted">共 ${companies.length} 家企业</span>
    </div>
  </div>`;
  
  return html;
}

function renderCompanyTable(companies) {
  if (companies.length === 0) {
    return '<p class="text-muted text-center p-4">暂无企业数据</p>';
  }
  
  return `<table class="data-table">
    <thead><tr>
      <th>中文名称</th><th>英文名称</th><th>联系人</th><th>电话</th><th>邮箱</th>
      <th>地区</th><th>阶段</th><th>优先级</th><th>业务归属</th><th>状态</th><th>操作</th>
    </tr></thead>
    <tbody>
      ${companies.map(c => `<tr>
        <td class="company-name" onclick="openCompanyDetail('${c.id}')">${esc(c.companyCn)}</td>
        <td class="text-sm">${esc(c.company)}</td>
        <td>${esc(c.contactName)}</td>
        <td>${esc(c.phone)}</td>
        <td class="text-sm">${esc(c.email)}</td>
        <td>${esc(c.province || '')} ${esc(c.city || '')}</td>
        <td><span class="badge">${esc(c.stage || '未设置')}</span></td>
        <td><span class="badge badge-${c.priority === '高' ? 'danger' : c.priority === '中' ? 'warning' : 'default'}">${esc(c.priority || '-')}</span></td>
        <td>${esc(c.owner || '-')}</td>
        <td>${esc(c.contactStatus || '-')}</td>
        <td class="actions">
          <button class="btn btn-xs" onclick="editCompany('${c.id}')">编辑</button>
          <button class="btn btn-xs btn-danger" onclick="deleteCompany('${c.id}')">删除</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

async function filterCompanies() {
  const query = (document.getElementById('company-search')?.value || '').toLowerCase();
  const stage = document.getElementById('filter-stage')?.value || '';
  const owner = document.getElementById('filter-owner')?.value || '';
  const priority = document.getElementById('filter-priority')?.value || '';
  const province = document.getElementById('filter-province')?.value || '';
  
  const companies = await getAll('companies');
  let filtered = companies;
  
  if (query) {
    filtered = filtered.filter(c => 
      (c.companyCn && c.companyCn.toLowerCase().includes(query)) ||
      (c.company && c.company.toLowerCase().includes(query)) ||
      (c.contactName && c.contactName.toLowerCase().includes(query)) ||
      (c.phone && c.phone.toLowerCase().includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query))
    );
  }
  if (stage) filtered = filtered.filter(c => c.stage === stage);
  if (owner) filtered = filtered.filter(c => c.owner === owner);
  if (priority) filtered = filtered.filter(c => c.priority === priority);
  if (province) filtered = filtered.filter(c => c.province === province);
  
  const container = document.getElementById('companies-table');
  if (container) container.innerHTML = renderCompanyTable(filtered);
}

function showAddCompany() {
  showModal('新增企业', `
    <div class="form-grid">
      <div class="form-group"><label>中文名称 *</label><input id="f-companyCn" class="form-input" required /></div>
      <div class="form-group"><label>英文名称</label><input id="f-company" class="form-input" /></div>
      <div class="form-group"><label>联系人</label><input id="f-contactName" class="form-input" /></div>
      <div class="form-group"><label>电话</label><input id="f-phone" class="form-input" /></div>
      <div class="form-group"><label>邮箱</label><input id="f-email" class="form-input" type="email" /></div>
      <div class="form-group"><label>官网</label><input id="f-website" class="form-input" /></div>
      <div class="form-group"><label>省份</label><input id="f-province" class="form-input" /></div>
      <div class="form-group"><label>城市</label><input id="f-city" class="form-input" /></div>
      <div class="form-group"><label>阶段</label>
        <select id="f-stage" class="form-input"><option>新线索</option><option>已联系</option><option>已报价</option><option>已签约</option><option>已完成</option><option>已放弃</option></select></div>
      <div class="form-group"><label>优先级</label>
        <select id="f-priority" class="form-input"><option>高</option><option>中</option><option>低</option></select></div>
      <div class="form-group"><label>业务归属</label><input id="f-owner" class="form-input" value="新丝路" /></div>
      <div class="form-group"><label>来源</label><input id="f-contactSource" class="form-input" /></div>
      <div class="form-group"><label>地址</label><input id="f-officialAddress" class="form-input" /></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f-notes" class="form-input" rows="3"></textarea></div>
    </div>
  `, async (overlay) => {
    const companyCn = overlay.querySelector('#f-companyCn').value.trim();
    if (!companyCn) throw new Error('中文名称必填');
    
    const company = {
      id: generateId(),
      companyCn,
      company: overlay.querySelector('#f-company').value.trim(),
      contactName: overlay.querySelector('#f-contactName').value.trim(),
      phone: overlay.querySelector('#f-phone').value.trim(),
      email: overlay.querySelector('#f-email').value.trim(),
      website: overlay.querySelector('#f-website').value.trim(),
      province: overlay.querySelector('#f-province').value.trim(),
      city: overlay.querySelector('#f-city').value.trim(),
      stage: overlay.querySelector('#f-stage').value,
      priority: overlay.querySelector('#f-priority').value,
      owner: overlay.querySelector('#f-owner').value.trim(),
      contactSource: overlay.querySelector('#f-contactSource').value.trim(),
      officialAddress: overlay.querySelector('#f-officialAddress').value.trim(),
      notes: overlay.querySelector('#f-notes').value.trim(),
      contactStatus: '待联系',
      booth: '', exhibition: '', regionType: '', years: '',
      hasGuangdongAffiliate: false, productGroups: '', profileExtra: '',
      updatedAt: now()
    };
    await put('companies', company);
    navigateTo('companies');
  });
}

async function editCompany(companyId) {
  const company = await getById('companies', companyId);
  if (!company) { showToast('企业不存在', 'error'); return; }
  
  showModal('编辑企业: ' + company.companyCn, `
    <div class="form-grid">
      <div class="form-group"><label>中文名称 *</label><input id="f-companyCn" class="form-input" value="${esc(company.companyCn)}" required /></div>
      <div class="form-group"><label>英文名称</label><input id="f-company" class="form-input" value="${esc(company.company)}" /></div>
      <div class="form-group"><label>联系人</label><input id="f-contactName" class="form-input" value="${esc(company.contactName)}" /></div>
      <div class="form-group"><label>电话</label><input id="f-phone" class="form-input" value="${esc(company.phone)}" /></div>
      <div class="form-group"><label>邮箱</label><input id="f-email" class="form-input" value="${esc(company.email)}" type="email" /></div>
      <div class="form-group"><label>官网</label><input id="f-website" class="form-input" value="${esc(company.website)}" /></div>
      <div class="form-group"><label>省份</label><input id="f-province" class="form-input" value="${esc(company.province)}" /></div>
      <div class="form-group"><label>城市</label><input id="f-city" class="form-input" value="${esc(company.city)}" /></div>
      <div class="form-group"><label>阶段</label>
        <select id="f-stage" class="form-input">
          ${['新线索','已联系','已报价','已签约','已完成','已放弃'].map(s => `<option ${company.stage === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>优先级</label>
        <select id="f-priority" class="form-input">
          ${['高','中','低'].map(p => `<option ${company.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>业务归属</label><input id="f-owner" class="form-input" value="${esc(company.owner)}" /></div>
      <div class="form-group"><label>来源</label><input id="f-contactSource" class="form-input" value="${esc(company.contactSource)}" /></div>
      <div class="form-group"><label>地址</label><input id="f-officialAddress" class="form-input" value="${esc(company.officialAddress)}" /></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f-notes" class="form-input" rows="3">${esc(company.notes)}</textarea></div>
    </div>
  `, async (overlay) => {
    company.companyCn = overlay.querySelector('#f-companyCn').value.trim();
    if (!company.companyCn) throw new Error('中文名称必填');
    company.company = overlay.querySelector('#f-company').value.trim();
    company.contactName = overlay.querySelector('#f-contactName').value.trim();
    company.phone = overlay.querySelector('#f-phone').value.trim();
    company.email = overlay.querySelector('#f-email').value.trim();
    company.website = overlay.querySelector('#f-website').value.trim();
    company.province = overlay.querySelector('#f-province').value.trim();
    company.city = overlay.querySelector('#f-city').value.trim();
    company.stage = overlay.querySelector('#f-stage').value;
    company.priority = overlay.querySelector('#f-priority').value;
    company.owner = overlay.querySelector('#f-owner').value.trim();
    company.contactSource = overlay.querySelector('#f-contactSource').value.trim();
    company.officialAddress = overlay.querySelector('#f-officialAddress').value.trim();
    company.notes = overlay.querySelector('#f-notes').value.trim();
    company.updatedAt = now();
    
    await put('companies', company);
    
    // 同步更新项目档案中的企业基础信息
    const members = await getByIndex('projectMembers', 'companyId', companyId);
    for (const member of members) {
      member.companyCn = company.companyCn;
      member.updatedAt = now();
      await put('projectMembers', member);
    }
    navigateTo('companies');
  });
}

async function deleteCompany(companyId) {
  const company = await getById('companies', companyId);
  if (!company) return;
  
  if (!confirm(`确定要删除企业"${company.companyCn}"吗？\n\n⚠️ 此操作不可撤销！\n将同时删除该企业的所有项目档案、合同、付款记录和展位信息。\n\n建议将企业标记为"已放弃"而非直接删除。`)) return;
  
  // 级联删除项目档案
  const members = await getByIndex('projectMembers', 'companyId', companyId);
  for (const member of members) {
    await remove('projectMembers', member.id);
  }
  
  // 级联删除合同
  const contracts = await getByIndex('contracts', 'companyId', companyId);
  for (const contract of contracts) {
    await remove('contracts', contract.id);
  }
  
  // 级联删除付款记录
  const payments = await getByIndex('paymentRecords', 'companyId', companyId);
  for (const payment of payments) {
    await remove('paymentRecords', payment.id);
  }
  
  // 级联删除展位确认
  const booths = await getByIndex('boothConfirmations', 'companyId', companyId);
  for (const booth of booths) {
    await remove('boothConfirmations', booth.id);
  }
  
  // 最后删除企业本身
  await remove('companies', companyId);
  showToast(`已删除企业"${company.companyCn}"及关联的 ${members.length} 条档案、${contracts.length} 份合同、${payments.length} 笔付款、${booths.length} 个展位`, 'warning');
  navigateTo('companies');
}

async function exportCompanies() {
  const companies = await getAll('companies');
  const headers = ['中文名称','英文名称','联系人','电话','邮箱','省份','城市','阶段','优先级','业务归属','来源','备注'];
  const rows = companies.map(c => [
    c.companyCn, c.company, c.contactName, c.phone, c.email,
    c.province, c.city, c.stage, c.priority, c.owner, c.contactSource, c.notes
  ]);
  
  const csv = [headers.join(',')].concat(rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','))).join('\n');
  
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `企业库_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('导出成功', 'success');
}
