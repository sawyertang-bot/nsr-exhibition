/**
 * 新丝路会展运营管理平台 - 数据库层
 * 使用 IndexedDB 持久化存储，支持离线使用
 * 对应 V9 schema version 16，共 11 张业务表
 */

const DB_NAME = 'NSR_EOMP';
const DB_VERSION = 16;

const STORES = {
  companies: { keyPath: 'id', indexes: ['companyCn', 'company', 'province', 'city', 'stage', 'priority', 'owner'] },
  companyUpdates: { keyPath: 'companyId', indexes: ['companyCn', 'stage', 'priority', 'owner', 'contractStatus', 'paymentStatus'] },
  manualCompanies: { keyPath: 'id', indexes: ['companyCn', 'company'] },
  projects: { keyPath: 'id', indexes: ['name', 'year', 'status'] },
  projectMembers: { keyPath: 'id', indexes: ['projectId', 'companyId', 'stage', 'priority', 'owner'] },
  boothConfirmations: { keyPath: 'id', indexes: ['projectId', 'companyId', 'boothType', 'status'] },
  contracts: { keyPath: 'id', indexes: ['projectId', 'companyId', 'contractNumber', 'status'] },
  receivables: { keyPath: 'id', indexes: ['projectId', 'companyId', 'contractId', 'status'] },
  paymentRecords: { keyPath: 'id', indexes: ['projectId', 'companyId', 'contractId', 'verificationStatus'] },
  emailLogs: { keyPath: 'id', indexes: ['companyId', 'status'] },
  todos: { keyPath: 'id', indexes: ['projectId', 'companyId', 'status', 'priority', 'dueDate'] },
  systemSettings: { keyPath: 'key' },
  attachments: { keyPath: 'id', indexes: ['companyId', 'projectId', 'category'] }
};

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, config] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: config.keyPath, autoIncrement: name === 'id' ? false : undefined });
          for (const idx of config.indexes) {
            store.createIndex(`by_${idx}`, idx, { unique: false });
          }
        }
      }
    };
  });
}

function getStore(storeName, mode = 'readonly') {
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

// CRUD 操作
async function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getById(storeName, id) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName);
    const index = store.index(`by_${indexName}`);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(storeName, item) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readwrite');
    const request = store.put(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function remove(storeName, id) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readwrite');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readwrite');
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function count(storeName) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 批量导入
async function bulkPut(storeName, items) {
  if (!items || items.length === 0) return 0;
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readwrite');
    let done = 0;
    for (const item of items) {
      const req = store.put(item);
      req.onsuccess = () => {
        done++;
        if (done === items.length) resolve(done);
      };
      req.onerror = () => reject(req.error);
    }
  });
}

// 获取所有数据统计
async function getDataStats() {
  const stats = {};
  for (const name of Object.keys(STORES)) {
    stats[name] = await count(name);
  }
  return stats;
}

// 备份 - 导出所有数据
async function exportAllData() {
  const data = { exportedAt: new Date().toISOString(), version: DB_VERSION };
  for (const name of Object.keys(STORES)) {
    data[name] = await getAll(name);
  }
  return data;
}

// 恢复 - 导入所有数据
async function importAllData(data, clear = true) {
  if (clear) {
    for (const name of Object.keys(STORES)) {
      await clearStore(name);
    }
  }
  for (const [name, items] of Object.entries(data)) {
    if (name === 'exportedAt' || name === 'version') continue;
    if (STORES[name] && Array.isArray(items) && items.length > 0) {
      await bulkPut(name, items);
    }
  }
}
