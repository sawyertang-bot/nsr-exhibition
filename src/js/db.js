/**
 * 新丝路会展运营管理平台 - 数据库层
 * 使用 IndexedDB 持久化存储，支持离线使用
 * 对应 V9 schema version 16，共 11 张业务表
 */

const DB_NAME = 'NSR_EOMP';
const DB_VERSION = 17; // 递增版本以强制刷新 schema

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

    request.onerror = () => {
      const err = request.error;
      console.error('IndexedDB open error:', err);
      if (err && err.name === 'VersionError') {
        reject(new Error('数据库版本冲突，请清除浏览器数据后重试'));
      } else {
        reject(err);
      }
    };

    request.onblocked = () => {
      reject(new Error('数据库被其他标签页阻塞，请关闭其他标签页后重试'));
    };

    request.onsuccess = () => {
      db = request.result;
      db.onerror = (e) => console.error('IndexedDB runtime error:', e.target.error);
      resolve(db);
    };

    request.onupgradeneeded = (e) => {
      try {
        const db = e.target.result;
        const transaction = e.target.transaction;

        // 如果存在旧 schema 不兼容的 store，先清理
        const existingStores = Array.from(db.objectStoreNames);
        const expectedStores = Object.keys(STORES);
        for (const storeName of existingStores) {
          if (!expectedStores.includes(storeName)) {
            try { db.deleteObjectStore(storeName); } catch (_) {}
          }
        }

        for (const [name, config] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: config.keyPath });
            for (const idx of config.indexes) {
              store.createIndex(`by_${idx}`, idx, { unique: false });
            }
          }
        }
      } catch (err) {
        console.error('Upgradeneeded error:', err);
        throw err;
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
