/**
 * 数据导入模块 - 从V9备份CSV文件导入数据到IndexedDB
 * 支持：HTTP fetch (开发服务器) 和 文件上传 (file:// 协议)
 */

// CSV 解析器
function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === '\n' && !inQuotes) { lines.push(current); current = ''; }
    else if (ch === '\r' && !inQuotes) { /* skip */ }
    else { current += ch; }
  }
  if (current) lines.push(current);
  if (lines.length === 0) return [];
  
  const headers = parseLine(lines[0]);
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      let val = values[idx] || '';
      if (val && (val.startsWith('{') || val.startsWith('['))) { try { val = JSON.parse(val); } catch(e) {} }
      if (typeof val === 'string' && !isNaN(val) && val !== '' && !/^\d{4}-\d{2}-\d{2}/.test(val) && !val.startsWith('0')) {
        const num = Number(val);
        if (!isNaN(num) && isFinite(num)) val = num;
      }
      row[h.trim()] = val;
    });
    result.push(row);
  }
  return result;
}

function parseLine(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

async function importCSVToStore(csvText, storeName, transformFn) {
  const rows = parseCSV(csvText);
  if (rows.length > 0) {
    const firstKey = Object.keys(rows[0])[0];
    if (firstKey?.charCodeAt(0) === 65279) {
      const newKey = firstKey.replace(/^\uFEFF/, '');
      rows.forEach(r => { r[newKey] = r[firstKey]; delete r[firstKey]; });
    }
  }
  
  const items = rows.map(transformFn || (row => {
    row.id = String(row.id || Date.now() + Math.random());
    row.updatedAt = row.updatedAt || new Date().toISOString();
    return row;
  }));
  
  if (items.length > 0) {
    await clearStore(storeName);
    await bulkPut(storeName, items);
  }
  return items.length;
}

// ============ 文件上传导入 ============
async function importFromFiles(files) {
  const fileMap = {};
  for (const file of files) {
    fileMap[file.name] = file;
  }
  
  let importLog = [];
  
  async function processFile(filename, storeName, transformFn) {
    const file = fileMap[filename];
    if (!file) return 0;
    try {
      const text = await file.text();
      const count = await importCSVToStore(text, storeName, transformFn);
      return count;
    } catch(e) {
      throw new Error(`导入${filename}失败: ${e.message}`);
    }
  }

  // 系统设置
  try {
    const count = await processFile('系统设置及业务归属.csv', 'systemSettings', row => ({
      key: row.key, value: row.value, updatedAt: row.updatedAt || new Date().toISOString()
    }));
    importLog.push(`系统设置: ${count} 条`);
  } catch(e) { importLog.push(e.message); }

  // 企业库
  try {
    const count = await processFile('企业库-内置基础数据.csv', 'companies', row => ({
      id: String(row.id), company: row.company||'', companyCn: row.companyCn||'',
      booth: row.booth||'', exhibition: row.exhibition||'', province: row.province||'', city: row.city||'',
      regionType: row.regionType||'', website: row.website||'', email: row.email||'', phone: row.phone||'',
      contactName: row.contactName||'', contactStatus: row.contactStatus||'', contactSource: row.contactSource||'',
      years: row.years||'', stage: row.stage||'', priority: row.priority||'', owner: row.owner||'',
      lastContact: row.lastContact||'', nextFollowUp: row.nextFollowUp||'', intendedArea: row.intendedArea||'',
      notes: row.notes||'', hasGuangdongAffiliate: row.hasGuangdongAffiliate||false,
      exhibitions: row.exhibitions||'', officialProfileUrl: row.officialProfileUrl||'',
      officialAddress: row.officialAddress||'', productGroups: row.productGroups||'',
      contactEmail: row.contactEmail||'', contactPhone: row.contactPhone||'', profileExtra: row.profileExtra||'',
      updatedAt: new Date().toISOString()
    }));
    importLog.push(`企业库: ${count} 条`);
  } catch(e) { importLog.push(e.message); }

  // 企业补充资料
  try {
    const count = await processFile('企业补充资料.csv', 'companyUpdates', row => ({
      companyId: String(row.companyId), companyCn: row.companyCn||'',
      website: row.website||'', contactStatus: row.contactStatus||'', contactSource: row.contactSource||'',
      industry: row.industry||'', industryTags: row.industryTags||'', stage: row.stage||'', priority: row.priority||'',
      owner: row.owner||'', contactName: row.contactName||'', contactPhone: row.contactPhone||'', contactEmail: row.contactEmail||'',
      intendedArea: row.intendedArea||'', intentionType: row.intentionType||'', lastContact: row.lastContact||'',
      nextFollowUp: row.nextFollowUp||'', notes: row.notes||'', contractStatus: row.contractStatus||'',
      contractNumber: row.contractNumber||'', contractAmount: row.contractAmount||'',
      depositAmount: row.depositAmount||'', depositPaidDate: row.depositPaidDate||'',
      applicationStatus: row.applicationStatus||'', balanceAmount: row.balanceAmount||'',
      balanceDueDate: row.balanceDueDate||'', paymentStatus: row.paymentStatus||'', contractNotes: row.contractNotes||'',
      profileExtra: row.profileExtra||'', updatedAt: row.updatedAt||new Date().toISOString()
    }));
    importLog.push(`企业补充资料: ${count} 条`);
  } catch(e) { importLog.push(e.message); }

  // 人工新增企业
  try { const c = await processFile('人工新增企业.csv', 'manualCompanies', row => ({
    id: String(row.id), normalizedName: row.normalizedName||'', company: row.company||'',
    companyCn: row.companyCn||'', payload: row.payload||{}, createdAt: row.createdAt||new Date().toISOString(),
    updatedAt: row.updatedAt||new Date().toISOString()
  })); importLog.push(`人工新增: ${c} 条`); } catch(e) { importLog.push(e.message); }

  // 项目资料
  try {
    const count = await processFile('项目资料.csv', 'projects', row => {
      let pc = {}; try { pc = typeof row.profitConfig==='string'?JSON.parse(row.profitConfig):(row.profitConfig||{}); } catch(e) {}
      let sr = []; try { sr = typeof row.subsidyRequirements==='string'?JSON.parse(row.subsidyRequirements):(row.subsidyRequirements||[]); } catch(e) {}
      return {
        id: String(row.id), name: row.name||'', englishName: row.englishName||'', sortOrder: row.sortOrder||0,
        year: row.year||'', industry: row.industry||'', location: row.location||'',
        startDate: row.startDate||'', endDate: row.endDate||'', status: row.status||'筹备中',
        targetBooths: row.targetBooths||'', targetArea: row.targetArea||'',
        isYuemaoGlobal: row.isYuemaoGlobal === 'true' || row.isYuemaoGlobal === true,
        subsidyRequirements: sr, isPinned: row.isPinned==='true'||row.isPinned===true,
        archivedAt: row.archivedAt||'', profitConfig: pc, notes: row.notes||'',
        createdAt: row.createdAt||new Date().toISOString(), updatedAt: row.updatedAt||new Date().toISOString()
      };
    });
    importLog.push(`项目资料: ${count} 条`);
  } catch(e) { importLog.push(e.message); }

  // 项目企业业务档案
  try {
    const count = await processFile('企业项目业务档案.csv', 'projectMembers', row => {
      let idata={}; try{idata=typeof row.intentionData==='string'?JSON.parse(row.intentionData):(row.intentionData||{});}catch(e){}
      let fups=[]; try{fups=typeof row.followUps==='string'?JSON.parse(row.followUps):(row.followUps||[]);}catch(e){}
      let pms=[]; try{pms=typeof row.payments==='string'?JSON.parse(row.payments):(row.payments||[]);}catch(e){}
      let bts=[]; try{bts=typeof row.booths==='string'?JSON.parse(row.booths):(row.booths||[]);}catch(e){}
      let pd={}; try{pd=typeof row.profitData==='string'?JSON.parse(row.profitData):(row.profitData||{});}catch(e){}
      let cd={}; try{cd=typeof row.contractData==='string'?JSON.parse(row.contractData):(row.contractData||{});}catch(e){}
      return {
        id: String(row.id||Date.now()+Math.random()), projectId: String(row.projectId), companyId: String(row.companyId),
        stage: row.stage||'', priority: row.priority||'', owner: row.owner||'', businessOwner: row.businessOwner||row.owner||'',
        intentionType: row.intentionType||'', intendedArea: row.intendedArea||'', intendedBoothType: row.intendedBoothType||row.boothType||'',
        intendedBoothCount: row.intendedBoothCount||0, nextFollowUp: row.nextFollowUp||'', notes: row.notes||'',
        contractStatus: row.contractStatus||'未签订', contractNumber: row.contractNumber||'', contractAmount: row.contractAmount||0,
        depositAmount: row.depositAmount||0, depositPaidDate: row.depositPaidDate||'', balanceAmount: row.balanceAmount||0,
        balanceDueDate: row.balanceDueDate||'', paymentStatus: row.paymentStatus||'未收款', contractNotes: row.contractNotes||'',
        boothType: row.boothType||'', boothMaterials: typeof row.boothMaterials==='string'?JSON.parse(row.boothMaterials||'{}'):(row.boothMaterials||{}),
        subsidyMaterials: typeof row.subsidyMaterials==='string'?JSON.parse(row.subsidyMaterials||'{}'):(row.subsidyMaterials||{}),
        rentals: typeof row.rentals==='string'?JSON.parse(row.rentals||'[]'):(row.rentals||[]),
        isGroupTour: row.isGroupTour==='true'||row.isGroupTour===true,
        groupTravel: typeof row.groupTravel==='string'?JSON.parse(row.groupTravel||'{}'):(row.groupTravel||{}),
        intentionData: idata, followUps: fups, payments: pms, booths: bts,
        executionUnlocked: row.executionUnlocked==='true'||row.executionUnlocked===true,
        subsidyEnabled: row.subsidyEnabled==='true'||row.subsidyEnabled===true,
        profitData: pd, contractData: cd, updatedAt: row.updatedAt||new Date().toISOString()
      };
    });
    importLog.push(`企业项目档案: ${count} 条`);
  } catch(e) { importLog.push(e.message); }

  // 确认展位
  try {
    const count = await processFile('确认展位.csv', 'boothConfirmations', row => ({
      id: String(row.id||Date.now()+Math.random()), projectId: String(row.projectId), companyId: String(row.companyId),
      status: row.status||'待确认', boothType: row.boothType||'', area: row.area||'', boothCount: row.boothCount||0,
      hallNumber: row.hallNumber||'', boothNumber: row.boothNumber||'', openingType: row.openingType||'',
      locationNotes: row.locationNotes||'', confirmedAt: row.confirmedAt||'', confirmedBy: row.confirmedBy||'',
      sourceSnapshot: typeof row.sourceSnapshot==='string'?row.sourceSnapshot:JSON.stringify(row.sourceSnapshot||{}),
      unitPrice: 0, totalPrice: 0, updatedAt: row.updatedAt||new Date().toISOString()
    }));
    importLog.push(`确认展位: ${count} 条`);
  } catch(e) { importLog.push(e.message); }

  // 合同
  try {
    const count = await processFile('合同记录.csv', 'contracts', row => ({
      id: String(row.id), projectId: String(row.projectId), companyId: String(row.companyId),
      contractNumber: row.contractNumber||'', templateKey: row.templateKey||'', version: row.version||1,
      status: row.status||'未签订', currency: row.currency||'CNY', boothSubtotal: row.boothSubtotal||0,
      otherFeeSubtotal: row.otherFeeSubtotal||0, totalAmount: row.totalAmount||0,
      totalAmountUppercase: row.totalAmountUppercase||'',
      boothSnapshot: typeof row.boothSnapshot==='string'?row.boothSnapshot:JSON.stringify(row.boothSnapshot||{}),
      partySnapshot: typeof row.partySnapshot==='string'?row.partySnapshot:JSON.stringify(row.partySnapshot||{}),
      feeLines: typeof row.feeLines==='string'?row.feeLines:JSON.stringify(row.feeLines||[]),
      paymentTerms: typeof row.paymentTerms==='string'?row.paymentTerms:JSON.stringify(row.paymentTerms||{}),
      templateSnapshot: typeof row.templateSnapshot==='string'?row.templateSnapshot:JSON.stringify(row.templateSnapshot||{}),
      signedAt: row.signedAt||'', createdAt: row.createdAt||new Date().toISOString(),
      updatedAt: row.updatedAt||new Date().toISOString()
    }));
    importLog.push(`合同记录: ${count} 条`);
  } catch(e) { importLog.push(e.message); }

  // 应收
  try { const c = await processFile('应收记录.csv', 'receivables', row => ({
    id: String(row.id), projectId: String(row.projectId), companyId: String(row.companyId),
    contractId: String(row.contractId||''), category: row.category||'', sourceType: row.sourceType||'',
    sourceId: row.sourceId||'', title: row.title||'', amount: row.amount||0, dueDate: row.dueDate||'',
    status: row.status||'未收', notes: row.notes||'', createdAt: row.createdAt||new Date().toISOString(),
    updatedAt: row.updatedAt||new Date().toISOString()
  })); importLog.push(`应收记录: ${c} 条`); } catch(e) { importLog.push(e.message); }

  // 付款
  try { const c = await processFile('实际付款记录.csv', 'paymentRecords', row => ({
    id: String(row.id), projectId: String(row.projectId), companyId: String(row.companyId),
    contractId: row.contractId||'', receivableId: row.receivableId||'', amount: row.amount||0,
    paidAt: row.paidAt||'', category: row.category||'', purpose: row.purpose||'',
    verificationStatus: row.verificationStatus||'待核对', validityStatus: row.validityStatus||'有效',
    source: row.source||'', legacyKey: row.legacyKey||'', notes: row.notes||'',
    createdAt: row.createdAt||new Date().toISOString(), updatedAt: row.updatedAt||new Date().toISOString()
  })); importLog.push(`付款记录: ${c} 条`); } catch(e) { importLog.push(e.message); }

  // 待办
  try { const c = await processFile('待办事项.csv', 'todos', row => ({
    id: String(row.id), projectId: String(row.projectId), companyId: String(row.companyId),
    title: row.title||'', taskType: row.taskType||'', businessOwner: row.businessOwner||'',
    dueDate: row.dueDate||'', priority: row.priority||'中', status: row.status||'待处理',
    source: row.source||'', notes: row.notes||'', createdAt: row.createdAt||new Date().toISOString(),
    updatedAt: row.updatedAt||new Date().toISOString()
  })); importLog.push(`待办事项: ${c} 条`); } catch(e) { importLog.push(e.message); }

  // 邮件
  try { const c = await processFile('邮件记录.csv', 'emailLogs', row => ({
    id: String(row.id), companyId: String(row.companyId), recipient: row.recipient||'',
    subject: row.subject||'', body: row.body||'', status: row.status||'', error: row.error||'',
    sentAt: row.sentAt||'', createdAt: row.createdAt||new Date().toISOString()
  })); importLog.push(`邮件记录: ${c} 条`); } catch(e) { importLog.push(e.message); }

  return importLog;
}

// ============ HTTP Fetch 导入 (需要服务器环境) ============
async function importFromServer() {
  const backupPath = 'data/backup_v9_20260719/csv';
  let importLog = [];
  
  async function fetchImport(filename, storeName, transformFn) {
    try {
      const resp = await fetch(`${backupPath}/${filename}`);
      const text = await resp.text();
      const count = await importCSVToStore(text, storeName, transformFn);
      return count;
    } catch(e) {
      throw new Error(`${filename}: ${e.message}`);
    }
  }

  try { const c = await fetchImport('系统设置及业务归属.csv', 'systemSettings', r => ({key:r.key,value:r.value,updatedAt:r.updatedAt||now()})); importLog.push(`系统设置: ${c}条`); } catch(e) { importLog.push(e.message); }
  try { const c = await fetchImport('企业库-内置基础数据.csv', 'companies', r => ({
    id: String(r.id), company: r.company||'', companyCn: r.companyCn||'', booth: r.booth||'', exhibition: r.exhibition||'', province: r.province||'', city: r.city||'',
    regionType: r.regionType||'', website: r.website||'', email: r.email||'', phone: r.phone||'', contactName: r.contactName||'',
    contactStatus: r.contactStatus||'', contactSource: r.contactSource||'', years: r.years||'', stage: r.stage||'', priority: r.priority||'', owner: r.owner||'',
    lastContact: r.lastContact||'', nextFollowUp: r.nextFollowUp||'', intendedArea: r.intendedArea||'', notes: r.notes||'',
    hasGuangdongAffiliate: r.hasGuangdongAffiliate||false, exhibitions: r.exhibitions||'', officialProfileUrl: r.officialProfileUrl||'',
    officialAddress: r.officialAddress||'', productGroups: r.productGroups||'', contactEmail: r.contactEmail||'', contactPhone: r.contactPhone||'',
    profileExtra: r.profileExtra||'', updatedAt: now()
  })); importLog.push(`企业库: ${c}条`); } catch(e) { importLog.push(e.message); }
  
  // ... remainder same as file import for other categories
  const importFns = [
    ['企业补充资料.csv', 'companyUpdates', r => ({
      companyId: String(r.companyId), companyCn: r.companyCn||'', website: r.website||'', contactStatus: r.contactStatus||'',
      contactSource: r.contactSource||'', industry: r.industry||'', industryTags: r.industryTags||'', stage: r.stage||'',
      priority: r.priority||'', owner: r.owner||'', contactName: r.contactName||'', contactPhone: r.contactPhone||'',
      contactEmail: r.contactEmail||'', intendedArea: r.intendedArea||'', intentionType: r.intentionType||'',
      lastContact: r.lastContact||'', nextFollowUp: r.nextFollowUp||'', notes: r.notes||'', contractStatus: r.contractStatus||'',
      contractNumber: r.contractNumber||'', contractAmount: r.contractAmount||'', depositAmount: r.depositAmount||'',
      depositPaidDate: r.depositPaidDate||'', applicationStatus: r.applicationStatus||'', balanceAmount: r.balanceAmount||'',
      balanceDueDate: r.balanceDueDate||'', paymentStatus: r.paymentStatus||'', contractNotes: r.contractNotes||'',
      profileExtra: r.profileExtra||'', updatedAt: r.updatedAt||now()
    })],
    ['人工新增企业.csv', 'manualCompanies', r => ({
      id: String(r.id), normalizedName: r.normalizedName||'', company: r.company||'', companyCn: r.companyCn||'',
      payload: r.payload||{}, createdAt: r.createdAt||now(), updatedAt: r.updatedAt||now()
    })],
    ['项目资料.csv', 'projects', r => {
      let pc={};try{pc=typeof r.profitConfig==='string'?JSON.parse(r.profitConfig):(r.profitConfig||{});}catch(e){}
      let sr=[];try{sr=typeof r.subsidyRequirements==='string'?JSON.parse(r.subsidyRequirements):(r.subsidyRequirements||[]);}catch(e){}
      return {id:String(r.id),name:r.name||'',englishName:r.englishName||'',sortOrder:r.sortOrder||0,year:r.year||'',industry:r.industry||'',location:r.location||'',startDate:r.startDate||'',endDate:r.endDate||'',status:r.status||'筹备中',targetBooths:r.targetBooths||'',targetArea:r.targetArea||'',isYuemaoGlobal:r.isYuemaoGlobal==='true'||r.isYuemaoGlobal===true,subsidyRequirements:sr,isPinned:r.isPinned==='true'||r.isPinned===true,archivedAt:r.archivedAt||'',profitConfig:pc,notes:r.notes||'',createdAt:r.createdAt||now(),updatedAt:r.updatedAt||now()};
    }],
    ['企业项目业务档案.csv', 'projectMembers', r => {
      let idata={},fups=[],pms=[],bts=[],pd={},cd={};
      try{idata=typeof r.intentionData==='string'?JSON.parse(r.intentionData):(r.intentionData||{});}catch(e){}
      try{fups=typeof r.followUps==='string'?JSON.parse(r.followUps):(r.followUps||[]);}catch(e){}
      try{pms=typeof r.payments==='string'?JSON.parse(r.payments):(r.payments||[]);}catch(e){}
      try{bts=typeof r.booths==='string'?JSON.parse(r.booths):(r.booths||[]);}catch(e){}
      try{pd=typeof r.profitData==='string'?JSON.parse(r.profitData):(r.profitData||{});}catch(e){}
      try{cd=typeof r.contractData==='string'?JSON.parse(r.contractData):(r.contractData||{});}catch(e){}
      return {id:String(r.id||Date.now()+Math.random()),projectId:String(r.projectId),companyId:String(r.companyId),stage:r.stage||'',priority:r.priority||'',owner:r.owner||'',businessOwner:r.businessOwner||r.owner||'',intentionType:r.intentionType||'',intendedArea:r.intendedArea||'',intendedBoothType:r.intendedBoothType||r.boothType||'',intendedBoothCount:r.intendedBoothCount||0,nextFollowUp:r.nextFollowUp||'',notes:r.notes||'',contractStatus:r.contractStatus||'未签订',contractNumber:r.contractNumber||'',contractAmount:r.contractAmount||0,depositAmount:r.depositAmount||0,depositPaidDate:r.depositPaidDate||'',balanceAmount:r.balanceAmount||0,balanceDueDate:r.balanceDueDate||'',paymentStatus:r.paymentStatus||'未收款',contractNotes:r.contractNotes||'',boothType:r.boothType||'',boothMaterials:typeof r.boothMaterials==='string'?JSON.parse(r.boothMaterials||'{}'):(r.boothMaterials||{}),subsidyMaterials:typeof r.subsidyMaterials==='string'?JSON.parse(r.subsidyMaterials||'{}'):(r.subsidyMaterials||{}),rentals:typeof r.rentals==='string'?JSON.parse(r.rentals||'[]'):(r.rentals||[]),isGroupTour:r.isGroupTour==='true'||r.isGroupTour===true,groupTravel:typeof r.groupTravel==='string'?JSON.parse(r.groupTravel||'{}'):(r.groupTravel||{}),intentionData:idata,followUps:fups,payments:pms,booths:bts,executionUnlocked:r.executionUnlocked==='true'||r.executionUnlocked===true,subsidyEnabled:r.subsidyEnabled==='true'||r.subsidyEnabled===true,profitData:pd,contractData:cd,updatedAt:r.updatedAt||now()};
    }],
    ['确认展位.csv', 'boothConfirmations', r => ({
      id:String(r.id||Date.now()+Math.random()),projectId:String(r.projectId),companyId:String(r.companyId),status:r.status||'待确认',boothType:r.boothType||'',area:r.area||'',boothCount:r.boothCount||0,hallNumber:r.hallNumber||'',boothNumber:r.boothNumber||'',openingType:r.openingType||'',locationNotes:r.locationNotes||'',confirmedAt:r.confirmedAt||'',confirmedBy:r.confirmedBy||'',sourceSnapshot:typeof r.sourceSnapshot==='string'?r.sourceSnapshot:JSON.stringify(r.sourceSnapshot||{}),unitPrice:0,totalPrice:0,updatedAt:r.updatedAt||now()
    })],
    ['合同记录.csv', 'contracts', r => ({
      id:String(r.id),projectId:String(r.projectId),companyId:String(r.companyId),contractNumber:r.contractNumber||'',templateKey:r.templateKey||'',version:r.version||1,status:r.status||'未签订',currency:r.currency||'CNY',boothSubtotal:r.boothSubtotal||0,otherFeeSubtotal:r.otherFeeSubtotal||0,totalAmount:r.totalAmount||0,totalAmountUppercase:r.totalAmountUppercase||'',boothSnapshot:typeof r.boothSnapshot==='string'?r.boothSnapshot:JSON.stringify(r.boothSnapshot||{}),partySnapshot:typeof r.partySnapshot==='string'?r.partySnapshot:JSON.stringify(r.partySnapshot||{}),feeLines:typeof r.feeLines==='string'?r.feeLines:JSON.stringify(r.feeLines||[]),paymentTerms:typeof r.paymentTerms==='string'?r.paymentTerms:JSON.stringify(r.paymentTerms||{}),templateSnapshot:typeof r.templateSnapshot==='string'?r.templateSnapshot:JSON.stringify(r.templateSnapshot||{}),signedAt:r.signedAt||'',createdAt:r.createdAt||now(),updatedAt:r.updatedAt||now()
    })],
    ['应收记录.csv', 'receivables', r => ({
      id:String(r.id),projectId:String(r.projectId),companyId:String(r.companyId),contractId:String(r.contractId||''),category:r.category||'',sourceType:r.sourceType||'',sourceId:r.sourceId||'',title:r.title||'',amount:r.amount||0,dueDate:r.dueDate||'',status:r.status||'未收',notes:r.notes||'',createdAt:r.createdAt||now(),updatedAt:r.updatedAt||now()
    })],
    ['实际付款记录.csv', 'paymentRecords', r => ({
      id:String(r.id),projectId:String(r.projectId),companyId:String(r.companyId),contractId:r.contractId||'',receivableId:r.receivableId||'',amount:r.amount||0,paidAt:r.paidAt||'',category:r.category||'',purpose:r.purpose||'',verificationStatus:r.verificationStatus||'待核对',validityStatus:r.validityStatus||'有效',source:r.source||'',legacyKey:r.legacyKey||'',notes:r.notes||'',createdAt:r.createdAt||now(),updatedAt:r.updatedAt||now()
    })],
    ['待办事项.csv', 'todos', r => ({
      id:String(r.id),projectId:String(r.projectId),companyId:String(r.companyId),title:r.title||'',taskType:r.taskType||'',businessOwner:r.businessOwner||'',dueDate:r.dueDate||'',priority:r.priority||'中',status:r.status||'待处理',source:r.source||'',notes:r.notes||'',createdAt:r.createdAt||now(),updatedAt:r.updatedAt||now()
    })],
    ['邮件记录.csv', 'emailLogs', r => ({
      id:String(r.id),companyId:String(r.companyId),recipient:r.recipient||'',subject:r.subject||'',body:r.body||'',status:r.status||'',error:r.error||'',sentAt:r.sentAt||'',createdAt:r.createdAt||now()
    })],
  ];
  
  for (const [filename, storeName, transformFn] of importFns) {
    try {
      const c = await fetchImport(filename, storeName, transformFn);
      importLog.push(`${filename}: ${c}条`);
    } catch(e) { importLog.push(e.message); }
  }
  
  return importLog;
}
