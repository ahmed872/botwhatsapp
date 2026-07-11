/**
 * محرك المحادثة.
 * يستقبل رسالة العميل ويقرر الرد المناسب حسب حالته الحالية.
 *
 * دالة handleMessage تُرجع مصفوفة من الردود (نصوص) يرسلها index.js بالترتيب.
 */

const { sections, findServiceById } = require('../config/services');
const messages = require('../config/messages');
const store = require('../data/store');
const { getSession, setSession, resetFlow } = require('./stateManager');

const SECTION_ORDER = ['business', 'citizens', 'workers'];

/* ------------------------- أدوات مساعدة ------------------------- */

function normalize(text) {
  // تحويل الأرقام العربية إلى إنجليزية وتشذيب المسافات
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return (text || '')
    .replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString())
    .trim();
}

function formatPrice(price) {
  return typeof price === 'number' ? `${price} ريال` : price;
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
    lines.push(`${i + 1}. ${svc.name} — ${formatPrice(svc.price)}`);
  });
  lines.push('');
  lines.push('اكتب *0* للرجوع للقائمة الرئيسية.');
  return lines.join('\n');
}

function buildServiceIntro(service) {
  const lines = [
    `📄 *${service.name}*`,
    `💰 السعر: ${formatPrice(service.price)}`,
  ];
  if (service.time) lines.push(`⏱️ المدة: ${service.time}`);
  return lines.join('\n');
}

/* ------------------------- بدء الخدمة ------------------------- */

function startService(chatId, service, section) {
  const session = getSession(chatId);
  session.sectionId = section.id;
  session.serviceId = service.id;
  session.questionIndex = 0;
  session.answers = [];
  session.documents = [];

  const replies = [buildServiceIntro(service)];

  if (service.questions && service.questions.length > 0) {
    session.step = 'service_questions';
    replies.push(`❓ ${service.questions[0]}`);
  } else {
    session.step = 'service_documents';
    replies.push(buildDocumentsMessage(service));
  }
  return replies;
}

function buildDocumentsMessage(service) {
  const lines = [messages.askDocumentsIntro, ''];
  service.documents.forEach((d, i) => lines.push(`${i + 1}. ${d}`));
  lines.push('');
  lines.push(messages.sendDocumentsPrompt);
  return lines.join('\n');
}

/* ------------------------- إتمام الطلب ------------------------- */

function finalizeRequest(chatId) {
  const session = getSession(chatId);
  const customer = store.getCustomer(chatId) || {};
  const found = findServiceById(session.serviceId);
  const service = found ? found.service : { name: 'خدمة', price: '-' };

  // ربط الأسئلة بإجاباتها
  const qa = (service.questions || []).map((q, i) => ({
    question: q,
    answer: session.answers[i] || '',
  }));

  const request = store.createRequest({
    chatId,
    customer: {
      name: customer.name,
      phone: customer.phone,
      idNumber: customer.idNumber,
      city: customer.city,
    },
    sectionId: session.sectionId,
    serviceId: session.serviceId,
    serviceName: service.name,
    price: service.price,
    answers: qa,
    documentsCount: session.documents.length,
    documents: session.documents,
  });

  resetFlow(chatId);
  session.step = 'main_menu';

  return { request, service };
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
    resetFlow(chatId);
    session.step = 'main_menu';
    return [messages.backToMenu, buildMainMenu()];
  }

  // وضع التحدث مع موظف: البوت صامت حتى يكتب العميل "بوت"
  if (session.step === 'human') {
    if (/^(بوت|bot)$/i.test(text)) {
      session.step = 'main_menu';
      return [buildMainMenu()];
    }
    return []; // لا يرد البوت، الموظف هو من يرد
  }

  switch (session.step) {
    case 'start':
      return handleStart(chatId);

    case 'collect_name':
      session.draft.name = msg.text.trim();
      session.step = 'collect_phone';
      return [messages.askPhone];

    case 'collect_phone':
      session.draft.phone = text;
      session.step = 'collect_id';
      return [messages.askId];

    case 'collect_id':
      if (!/^(تخطي|تخطى|skip)$/i.test(text)) {
        session.draft.idNumber = text;
      }
      session.step = 'collect_city';
      return [messages.askCity];

    case 'collect_city':
      session.draft.city = msg.text.trim();
      store.saveCustomer(chatId, session.draft);
      session.draft = {};
      session.step = 'main_menu';
      return [messages.dataSaved, buildMainMenu()];

    case 'main_menu':
      return handleMainMenu(chatId, text);

    case 'section_menu':
      return handleSectionMenu(chatId, text);

    case 'service_questions':
      return handleServiceQuestions(chatId, msg);

    case 'service_documents':
      return handleServiceDocuments(chatId, msg);

    case 'track':
      return handleTrack(chatId, text);

    default:
      return handleStart(chatId);
  }
}

function handleStart(chatId) {
  const session = getSession(chatId);
  const customer = store.getCustomer(chatId);

  if (customer && customer.name) {
    // عميل معروف: نعرض القائمة مباشرة
    session.step = 'main_menu';
    return [
      `أهلاً بعودتك ${customer.name} 👋`,
      buildMainMenu(),
    ];
  }

  // عميل جديد: نبدأ بجمع البيانات
  session.step = 'collect_name';
  return [buildMainMenu(), messages.askName];
}

function handleMainMenu(chatId, text) {
  const session = getSession(chatId);

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
    case '5':
      session.step = 'human';
      return [messages.humanHandoff];
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
  return startService(chatId, service, section);
}

function handleServiceQuestions(chatId, msg) {
  const session = getSession(chatId);
  const { service } = findServiceById(session.serviceId);

  // حفظ إجابة السؤال الحالي
  session.answers.push(msg.text.trim());
  session.questionIndex += 1;

  if (session.questionIndex < service.questions.length) {
    return [`❓ ${service.questions[session.questionIndex]}`];
  }

  // انتهت الأسئلة → طلب المستندات
  session.step = 'service_documents';
  return [buildDocumentsMessage(service)];
}

function handleServiceDocuments(chatId, msg) {
  const session = getSession(chatId);
  const text = normalize(msg.text);

  // إنهاء وإرسال الطلب
  if (/^(تم|انتهيت|ارسال|إرسال|done)$/i.test(text)) {
    if (session.documents.length === 0) {
      return [
        '⚠️ لم تُرسل أي مستند بعد. يرجى إرسال المستندات المطلوبة ثم اكتب *تم*.',
      ];
    }
    const { request, service } = finalizeRequest(chatId);
    return [
      messages.requestSubmitted(request.id, service.name),
      buildMainMenu(),
    ];
  }

  // استقبال مستند (وسائط أو نص)
  if (msg.hasMedia && msg.mediaSaved) {
    session.documents.push({ type: 'media', file: msg.mediaSaved });
    return [messages.documentReceived];
  }

  if (msg.text && msg.text.trim()) {
    session.documents.push({ type: 'text', value: msg.text.trim() });
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

module.exports = { handleMessage, buildMainMenu };
