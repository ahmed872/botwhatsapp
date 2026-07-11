/**
 * طبقة تخزين بسيطة تعتمد على ملفات JSON.
 * تحفظ العملاء والطلبات في مجلد data/.
 *
 * ملاحظة: مناسبة لحجم صغير (عشرات الطلبات يومياً). لو كبر الحجم
 * يمكن استبدالها بقاعدة بيانات (SQLite/Mongo) دون تغيير باقي الكود.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8').trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`خطأ في قراءة ${file}:`, err.message);
    return fallback;
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`خطأ في كتابة ${file}:`, err.message);
  }
}

/* ----------------------------- العملاء ----------------------------- */

/** حفظ/تحديث بيانات عميل. المفتاح هو رقم الواتساب (chatId). */
function saveCustomer(chatId, data) {
  const customers = readJson(CUSTOMERS_FILE, {});
  customers[chatId] = {
    ...(customers[chatId] || {}),
    ...data,
    chatId,
    updatedAt: new Date().toISOString(),
  };
  writeJson(CUSTOMERS_FILE, customers);
  return customers[chatId];
}

function getCustomer(chatId) {
  const customers = readJson(CUSTOMERS_FILE, {});
  return customers[chatId] || null;
}

/* ----------------------------- الطلبات ----------------------------- */

/** توليد رقم طلب متسلسل بصيغة REQ-XXXX */
function nextRequestId() {
  const meta = readJson(path.join(DATA_DIR, 'meta.json'), { lastRequest: 1000 });
  meta.lastRequest = (meta.lastRequest || 1000) + 1;
  writeJson(path.join(DATA_DIR, 'meta.json'), meta);
  return `REQ-${meta.lastRequest}`;
}

/** إنشاء طلب جديد وحفظه. يُرجع كائن الطلب. */
function createRequest(request) {
  const requests = readJson(REQUESTS_FILE, {});
  const id = nextRequestId();
  const record = {
    id,
    status: 'قيد المراجعة',
    createdAt: new Date().toISOString(),
    ...request,
  };
  requests[id] = record;
  writeJson(REQUESTS_FILE, requests);
  return record;
}

function getRequest(requestId) {
  const requests = readJson(REQUESTS_FILE, {});
  return requests[requestId.trim().toUpperCase()] || null;
}

/** إرجاع كل طلبات عميل معيّن */
function getRequestsByChat(chatId) {
  const requests = readJson(REQUESTS_FILE, {});
  return Object.values(requests).filter((r) => r.chatId === chatId);
}

module.exports = {
  saveCustomer,
  getCustomer,
  createRequest,
  getRequest,
  getRequestsByChat,
};
