/**
 * محرك المحادثة.
 * يستقبل رسالة العميل ويقرر الرد المناسب حسب حالته الحالية.
 *
 * التدفق: قائمة رئيسية → قائمة القسم → عرض المستندات المطلوبة
 *         → استقبال المستندات → تأكيد تلقائي (سيتم التواصل خلال 24 ساعة).
 *
 * دالة handleMessage تُرجع مصفوفة من الردود (نصوص) يرسلها index.js بالترتيب.
 * التأكيد التلقائي بعد آخر مستند يُرسل عبر sendFn المسجَّلة من index.js.
 */

const { sections, findServiceById } = require('../config/services');
const messages = require('../config/messages');
const store = require('../data/store');
const { getSession, resetFlow } = require('./stateManager');

const SECTION_ORDER = ['business', 'citizens', 'workers'];

// بعد آخر مستند بهذه المدة يُعتبر الطلب مكتملاً ويُرسل التأكيد تلقائياً
const FINALIZE_DELAY_MS = 30 * 1000;

// المستند المرسل بعد اكتمال الطلب يُضاف للطلب الأخير خلال هذه المدة
const LATE_DOCUMENT_WINDOW_MS = 60 * 60 * 1000;

/* --------------------- قنوات الإرسال (من index.js) --------------------- */

let sendFn = async () => {};
let notifyFn = async () => {};

/** تسجيل دالة إرسال رسالة للعميل (chatId, text) */
function registerSender(fn) {
  sendFn = fn;
}

/** تسجيل دالة إشعار الموظف بطلب جديد (request) */
function registerNotifier(fn) {
  notifyFn = fn;
}

/* ------------------------- أدوات مساعدة ------------------------- */

function normalize(text) {
  // تحويل الأرقام العربية إلى إنجليزية وتشذيب المسافات
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return (text || '')
    .replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString())
    .trim();
}

function buildMainMenu() {
  return messages.welcome;
}

function buildSectionMenu(sectionId) {
  const section = sections[sectionId];
  const lines = [
    `${section.emoji} *${section.title}*`,
    '',
    messages.chooseService,
    '',
  ];
  section.services.forEach((svc, i) => {
    lines.push(`${i + 1}. ${svc.name}`);
  });
  lines.push('');
  lines.push('اكتب *0* للرجوع للقائمة الرئيسية.');
  return lines.join('\n');
}

function buildDocumentsMessage(service) {
  const lines = [`📄 *${service.name}*`, '', messages.askDocumentsIntro, ''];
  service.documents.forEach((d, i) => lines.push(`${i + 1}. ${d}`));
  lines.push('');
  lines.push(messages.sendDocumentsPrompt);
  return lines.join('\n');
}

/* --------------------- إتمام الطلب والتأكيد التلقائي --------------------- */

const finalizeTimers = new Map();

function cancelFinalizeTimer(chatId) {
  const timer = finalizeTimers.get(chatId);
  if (timer) {
    clearTimeout(timer);
    finalizeTimers.delete(chatId);
  }
}

/** جدولة إغلاق الطلب تلقائياً بعد فترة صمت من آخر مستند */
function scheduleFinalize(chatId) {
  cancelFinalizeTimer(chatId);
  finalizeTimers.set(
    chatId,
    setTimeout(() => {
      finalizeTimers.delete(chatId);
      finalizeAndConfirm(chatId).catch((err) =>
        console.error('خطأ أثناء تأكيد الطلب:', err)
      );
    }, FINALIZE_DELAY_MS)
  );
}

/** إنشاء الطلب من الجلسة الحالية */
function finalizeRequest(chatId) {
  const session = getSession(chatId);
  const found = findServiceById(session.serviceId);
  const service = found ? found.service : { name: 'خدمة', price: '-' };

  const request = store.createRequest({
    chatId,
    sectionId: session.sectionId,
    serviceId: session.serviceId,
    serviceName: service.name,
    price: service.price,
    documentsCount: session.documents.length,
    documents: session.documents,
  });

  resetFlow(chatId);
  session.step = 'main_menu';

  return { request, service };
}

/** إغلاق الطلب وإرسال رسالة التأكيد للعميل وإشعار الموظف */
async function finalizeAndConfirm(chatId) {
  cancelFinalizeTimer(chatId);
  const session = getSession(chatId);
  if (session.step !== 'service_documents' || session.documents.length === 0) {
    return;
  }
  const { request, service } = finalizeRequest(chatId);
  await sendFn(chatId, messages.requestSubmitted(request.id, service.name));
  await notifyFn(request);
}

/* ------------------------- المعالج الرئيسي ------------------------- */

/**
 * @param {string} chatId  رقم الواتساب للعميل
 * @param {object} msg     كائن الرسالة { text, hasMedia, mediaSaved }
 * @returns {string[]}     الردود المطلوب إرسالها
 */
function handleMessage(chatId, msg) {
  const text = normalize(msg.text);
  const session = getSession(chatId);

  // أوامر عامة متاحة في أي وقت
  if (text === '0' || /^(القائمة|قائمة|رجوع|بداية)$/i.test(text)) {
    cancelFinalizeTimer(chatId);
    resetFlow(chatId);
    session.step = 'main_menu';
    return [messages.backToMenu, buildMainMenu()];
  }

  switch (session.step) {
    case 'start':
      session.step = 'main_menu';
      return [buildMainMenu()];

    case 'main_menu':
      return handleMainMenu(chatId, text, msg);

    case 'section_menu':
      return handleSectionMenu(chatId, text);

    case 'service_documents':
      return handleServiceDocuments(chatId, msg);

    case 'track':
      return handleTrack(chatId, text);

    default:
      session.step = 'main_menu';
      return [buildMainMenu()];
  }
}

function handleMainMenu(chatId, text, msg) {
  const session = getSession(chatId);

  // مستند وصل بعد اكتمال الطلب → يُضاف للطلب الأخير
  if (msg && msg.hasMedia && msg.mediaSaved) {
    const added = store.appendDocumentToLatest(
      chatId,
      { type: 'media', file: msg.mediaSaved },
      LATE_DOCUMENT_WINDOW_MS
    );
    if (added) return [messages.lateDocumentAdded];
  }

  switch (text) {
    case '1':
    case '2':
    case '3': {
      const sectionId = SECTION_ORDER[Number(text) - 1];
      session.sectionId = sectionId;
      session.step = 'section_menu';
      return [buildSectionMenu(sectionId)];
    }
    case '4':
      session.step = 'track';
      return [messages.trackAsk];
    default:
      return [messages.invalidOption];
  }
}

function handleSectionMenu(chatId, text) {
  const session = getSession(chatId);
  const section = sections[session.sectionId];
  const index = Number(text);

  if (!Number.isInteger(index) || index < 1 || index > section.services.length) {
    return [messages.invalidOption];
  }

  const service = section.services[index - 1];
  session.serviceId = service.id;
  session.documents = [];
  session.step = 'service_documents';
  return [buildDocumentsMessage(service)];
}

function handleServiceDocuments(chatId, msg) {
  const session = getSession(chatId);
  const text = normalize(msg.text);

  // "تم" تغلق الطلب فوراً دون انتظار المؤقت
  if (/^(تم|انتهيت|ارسال|إرسال|خلصت|done)$/i.test(text)) {
    if (session.documents.length === 0) {
      return [
        '⚠️ لم تُرسل أي مستند بعد. يرجى إرسال المستندات المطلوبة أولاً.',
      ];
    }
    cancelFinalizeTimer(chatId);
    const { request, service } = finalizeRequest(chatId);
    notifyFn(request).catch((err) =>
      console.error('تعذّر إشعار الموظف:', err)
    );
    return [messages.requestSubmitted(request.id, service.name)];
  }

  // استقبال مستند (وسائط أو نص)
  if (msg.hasMedia && msg.mediaSaved) {
    session.documents.push({ type: 'media', file: msg.mediaSaved });
    scheduleFinalize(chatId);
    return [messages.documentReceived];
  }

  if (msg.text && msg.text.trim()) {
    session.documents.push({ type: 'text', value: msg.text.trim() });
    scheduleFinalize(chatId);
    return [messages.documentReceived];
  }

  return [messages.sendDocumentsPrompt];
}

function handleTrack(chatId, text) {
  const request = store.getRequest(text);
  if (!request) {
    return [messages.trackNotFound];
  }
  const lines = [
    '📋 *تفاصيل الطلب*',
    '',
    `🔖 رقم الطلب: ${request.id}`,
    `📄 الخدمة: ${request.serviceName}`,
    `📌 الحالة: ${request.status}`,
    `📅 التاريخ: ${new Date(request.createdAt).toLocaleString('ar-EG')}`,
    '',
    'اكتب *0* للرجوع للقائمة الرئيسية.',
  ];
  const session = getSession(chatId);
  session.step = 'main_menu';
  return [lines.join('\n')];
}

module.exports = {
  handleMessage,
  buildMainMenu,
  registerSender,
  registerNotifier,
};
