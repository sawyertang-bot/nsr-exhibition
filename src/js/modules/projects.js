/**
 * 项目管理模块
 */
async function renderProjects() {
  const projects = await getAll('projects');
  
  let html = `<div class="panel">
    <div class="panel-header">
      <h2>📋 项目管理 (${projects.length} 个)</h2>
      <button class="btn btn-primary" onclick="showAddProject()">+ 新建项目</button>
    </div>
    <div class="table-container">
      <table class="data-table">
        <thead><tr>
          <th>项目名称</th><th>英文缩写</th><th>年份</th><th>行业</th><th>地点</th>
          <th>展期</th><th>状态</th><th>目标展位</th><th>粤贸全球</th><th>操作</th>
        </tr></thead>
        <tbody>`;
  
  for (const p of projects) {
    const members = (await getByIndex('projectMembers', 'projectId', String(p.id))) || [];
    const contracts = (await getByIndex('contracts', 'projectId', String(p.id))) || [];
    
    html += `<tr>
      <td><strong>${esc(p.name)}</strong></td>
      <td>${esc(p.englishName)}</td>
      <td>${esc(p.year)}</td>
      <td>${esc(p.industry)}</td>
      <td>${esc(p.location)}</td>
      <td>${fmtDate(p.startDate)} - ${fmtDate(p.endDate)}</td>
      <td><span class="badge badge-${p.status === '筹备中' ? 'info' : p.status === '进行中' ? 'success' : p.status === '已完成' ? 'primary' : 'default'}">${esc(p.status)}</span></td>
      <td>${esc(p.targetBooths)}</td>
      <td>${p.isYuemaoGlobal ? '✅ 是' : '❌ 否'}</td>
      <td class="actions">
        <button class="btn btn-xs btn-primary" onclick="navigateTo('project-members',{projectId:'${p.id}'})">企业档案</button>
        <button class="btn btn-xs" onclick="editProject('${p.id}')">编辑</button>
        <button class="btn btn-xs" onclick="showProjectProfit('${p.id}')">核算</button>
      </td>
    </tr>`;
  }
  
  html += `</tbody></table></div></div>`;
  return html;
}

function showAddProject() {
  showModal('新建项目', `
    <div class="form-grid">
      <div class="form-group"><label>项目名称 *</label><input id="f-name" class="form-input" required /></div>
      <div class="form-group"><label>英文缩写 *</label><input id="f-englishName" class="form-input" placeholder="如: TSEE" required /></div>
      <div class="form-group"><label>年份</label><input id="f-year" class="form-input" type="number" value="${new Date().getFullYear()+1}" /></div>
      <div class="form-group"><label>行业</label><input id="f-industry" class="form-input" value="新能源与储能" /></div>
      <div class="form-group"><label>城市/国家</label><input id="f-location" class="form-input" /></div>
      <div class="form-group"><label>开始日期</label><input id="f-startDate" class="form-input" type="date" /></div>
      <div class="form-group"><label>结束日期</label><input id="f-endDate" class="form-input" type="date" /></div>
      <div class="form-group"><label>目标展位数</label><input id="f-targetBooths" class="form-input" type="number" /></div>
      <div class="form-group"><label>目标面积(㎡)</label><input id="f-targetArea" class="form-input" type="number" /></div>
      <div class="form-group"><label>粤贸全球</label>
        <select id="f-isYuemaoGlobal" class="form-input"><option value="true">是</option><option value="false">否</option></select></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f-notes" class="form-input" rows="3"></textarea></div>
    </div>
  `, async (overlay) => {
    const name = overlay.querySelector('#f-name').value.trim();
    if (!name) throw new Error('项目名称必填');
    const englishName = overlay.querySelector('#f-englishName').value.trim();
    if (!englishName) throw new Error('英文缩写必填');
    
    const project = {
      id: generateId(),
      name,
      englishName,
      sortOrder: 0,
      year: overlay.querySelector('#f-year').value,
      industry: overlay.querySelector('#f-industry').value.trim(),
      location: overlay.querySelector('#f-location').value.trim(),
      startDate: overlay.querySelector('#f-startDate').value,
      endDate: overlay.querySelector('#f-endDate').value,
      status: '筹备中',
      targetBooths: overlay.querySelector('#f-targetBooths').value || '',
      targetArea: overlay.querySelector('#f-targetArea').value || '',
      isYuemaoGlobal: overlay.querySelector('#f-isYuemaoGlobal').value === 'true',
      subsidyRequirements: [],
      isPinned: false,
      archivedAt: '',
      profitConfig: {},
      notes: overlay.querySelector('#f-notes').value.trim(),
      createdAt: now(),
      updatedAt: now()
    };
    await put('projects', project);
    navigateTo(AppState.currentTab);
  });
  const p = await getById('projects', projectId);
  if (!p) { showToast('项目不存在', 'error'); return; }
  
  showModal('编辑项目', `
    <div class="form-grid">
      <div class="form-group"><label>项目名称</label><input id="f-name" class="form-input" value="${esc(p.name)}" /></div>
      <div class="form-group"><label>英文缩写</label><input id="f-englishName" class="form-input" value="${esc(p.englishName)}" /></div>
      <div class="form-group"><label>年份</label><input id="f-year" class="form-input" value="${esc(p.year)}" /></div>
      <div class="form-group"><label>行业</label><input id="f-industry" class="form-input" value="${esc(p.industry)}" /></div>
      <div class="form-group"><label>地点</label><input id="f-location" class="form-input" value="${esc(p.location)}" /></div>
      <div class="form-group"><label>开始日期</label><input id="f-startDate" class="form-input" type="date" value="${fmtDate(p.startDate)}" /></div>
      <div class="form-group"><label>结束日期</label><input id="f-endDate" class="form-input" type="date" value="${fmtDate(p.endDate)}" /></div>
      <div class="form-group"><label>目标展位</label><input id="f-targetBooths" class="form-input" value="${esc(p.targetBooths)}" /></div>
      <div class="form-group"><label>目标面积</label><input id="f-targetArea" class="form-input" value="${esc(p.targetArea)}" /></div>
      <div class="form-group"><label>状态</label>
        <select id="f-status" class="form-input">
          <option ${p.status==='筹备中'?'selected':''}>筹备中</option>
          <option ${p.status==='进行中'?'selected':''}>进行中</option>
          <option ${p.status==='已完成'?'selected':''}>已完成</option>
          <option ${p.status==='已归档'?'selected':''}>已归档</option>
        </select></div>
      <div class="form-group"><label>粤贸全球</label>
        <select id="f-isYuemaoGlobal" class="form-input">
          <option value="true" ${p.isYuemaoGlobal?'selected':''}>是</option>
          <option value="false" ${!p.isYuemaoGlobal?'selected':''}>否</option>
        </select></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f-notes" class="form-input" rows="3">${esc(p.notes)}</textarea></div>
    </div>
  `, async (overlay) => {
    p.name = overlay.querySelector('#f-name').value.trim();
    p.englishName = overlay.querySelector('#f-englishName').value.trim();
    p.year = overlay.querySelector('#f-year').value;
    p.industry = overlay.querySelector('#f-industry').value.trim();
    p.location = overlay.querySelector('#f-location').value.trim();
    p.startDate = overlay.querySelector('#f-startDate').value;
    p.endDate = overlay.querySelector('#f-endDate').value;
    p.targetBooths = overlay.querySelector('#f-targetBooths').value;
    p.targetArea = overlay.querySelector('#f-targetArea').value;
    p.status = overlay.querySelector('#f-status').value;
    p.isYuemaoGlobal = overlay.querySelector('#f-isYuemaoGlobal').value === 'true';
    p.notes = overlay.querySelector('#f-notes').value.trim();
    p.updatedAt = now();
    await put('projects', p);
  });
}

async function showProjectProfit(projectId) {
  const p = await getById('projects', projectId);
  if (!p) return;
  const config = p.profitConfig || {};
  
  showModal(`核算方案: ${p.name}`, `
    <div class="form-grid">
      <div class="form-group"><label>核算方案</label><input id="f-schemeType" class="form-input" value="${esc(config.schemeType||'')}" /></div>
      <div class="form-group"><label>独立标准展位/9㎡</label><input id="f-independentPer9" class="form-input" type="number" value="${config.independentPer9||0}" /></div>
      <div class="form-group"><label>中国区标准展位/9㎡</label><input id="f-groupStandardPer9" class="form-input" type="number" value="${config.groupStandardPer9||0}" /></div>
      <div class="form-group"><label>空地/㎡</label><input id="f-rawSpacePerSqm" class="form-input" type="number" value="${config.rawSpacePerSqm||0}" /></div>
      <div class="form-group"><label>报名费默认</label><input id="f-registrationFeeDefault" class="form-input" type="number" value="${config.registrationFeeDefault||2500}" /></div>
      <div class="form-group"><label>会刊费默认</label><input id="f-catalogueFeeDefault" class="form-input" type="number" value="${config.catalogueFeeDefault||2000}" /></div>
      <div class="form-group"><label>结算状态</label><input id="f-settlementStatus" class="form-input" value="${esc(config.settlementStatus||'')}" /></div>
    </div>
  `, async (overlay) => {
    p.profitConfig = {
      ...config,
      schemeType: overlay.querySelector('#f-schemeType').value.trim(),
      independentPer9: Number(overlay.querySelector('#f-independentPer9').value) || 0,
      groupStandardPer9: Number(overlay.querySelector('#f-groupStandardPer9').value) || 0,
      rawSpacePerSqm: Number(overlay.querySelector('#f-rawSpacePerSqm').value) || 0,
      registrationFeeDefault: Number(overlay.querySelector('#f-registrationFeeDefault').value) || 2500,
      catalogueFeeDefault: Number(overlay.querySelector('#f-catalogueFeeDefault').value) || 2000,
      settlementStatus: overlay.querySelector('#f-settlementStatus').value.trim()
    };
    p.updatedAt = now();
    await put('projects', p);
  });
}
