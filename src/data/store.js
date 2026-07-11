/**
 * طبقة تخزين بسيطة تعتمد على ملفات JSON.
 * تحفظ الطلبات في مجلد data/.
 *
 * ملاحظة: مناسبة لحجم صغير (عشرات الطلبات يومياً). لو كبر الحجم
 * يمكن استبدالها بقاعدة بيانات (SQLite/Mongo) دون تغيير باقي الكود.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);
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

/** إرجاع كل طلبات عميل معيّن مرتبة من الأقدم للأحدث */
function getRequestsByChat(chatId) {
  const requests = readJson(REQUESTS_FILE, {});
  return Object.values(requests)
    .filter((r) => r.chatId === chatId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/**
 * إضافة مستند لأحدث طلب للعميل إن كان أُنشئ خلال المدة المحددة.
 * يُرجع الطلب بعد التحديث، أو null إن لم يوجد طلب حديث.
 */
function appendDocumentToLatest(chatId, doc, maxAgeMs) {
  const requests = readJson(REQUESTS_FILE, {});
  const mine = Object.values(requests)
    .filter((r) => r.chatId === chatId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const latest = mine[0];
  if (!latest) return null;
  if (Date.now() - new Date(latest.createdAt).getTime() > maxAgeMs) return null;

  latest.documents = latest.documents || [];
  latest.documents.push(doc);
  latest.documentsCount = latest.documents.length;
  requests[latest.id] = latest;
  writeJson(REQUESTS_FILE, requests);
  return latest;
}

module.exports = {
  createRequest,
  getRequest,
  getRequestsByChat,
  appendDocumentToLatest,
};
