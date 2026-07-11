/**
 * نقطة تشغيل بوت الواتساب عبر WhatsApp Cloud API الرسمي من ميتا.
 *
 * كيف يعمل:
 *   - ميتا ترسل رسائل العملاء الواردة إلى POST /webhook (ويب هوك).
 *   - البوت يمررها لمحرك المحادثة (flow.js) ويرسل الردود عبر Graph API.
 *
 * الإعداد المطلوب في ملف .env (انظر .env.example):
 *   WHATSAPP_TOKEN   : توكن الوصول من لوحة ميتا
 *   PHONE_NUMBER_ID  : معرّف رقم الواتساب (وليس الرقم نفسه)
 *   VERIFY_TOKEN     : كلمة سر تختارها أنت وتكتبها في إعداد الويب هوك بلوحة ميتا
 *   EMPLOYEE_NUMBER  : (اختياري) رقم واتساب الموظف لإشعارات الطلبات، مثال 9665XXXXXXXX
 *
 * التشغيل: npm start
 */

const fs = require('fs');
const path = require('path');
const express = require('express');

const flow = require('./bot/flow');

const {
  WHATSAPP_TOKEN,
  PHONE_NUMBER_ID,
  VERIFY_TOKEN = 'eservices-bot',
  EMPLOYEE_NUMBER = '',
  GRAPH_API_VERSION = 'v23.0',
  PORT = 3000,
} = process.env;

if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
  console.error(
    '❌ يجب ضبط WHATSAPP_TOKEN و PHONE_NUMBER_ID.\n' +
      'انسخ .env.example إلى .env واملأ القيم من لوحة ميتا (خطوات الإعداد في README).'
  );
  process.exit(1);
}

const GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// مجلد حفظ المستندات المرسلة
const MEDIA_DIR = path.join(__dirname, 'data', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

/* ------------------------- الإرسال عبر Graph API ------------------------- */

async function sendText(to, text) {
  const res = await fetch(`${GRAPH_URL}/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`فشل إرسال الرسالة (${res.status}): ${body}`);
  }
}

/**
 * إشعار الموظف بطلب جديد (إن تم ضبط رقمه).
 * ملاحظة: واتساب يسمح بالرسائل الحرة للموظف فقط خلال 24 ساعة من آخر رسالة
 * أرسلها الموظف لرقم البوت — انظر README لتفاصيل فتح النافذة.
 */
async function notifyEmployee(request) {
  if (!EMPLOYEE_NUMBER) return;
  const lines = [
    '🔔 *طلب جديد*',
    '',
    `🔖 ${request.id}`,
    `📄 الخدمة: ${request.serviceName}`,
    `💰 السعر: ${typeof request.price === 'number' ? request.price + ' ريال' : request.price}`,
    `📱 رقم واتساب العميل: ${request.chatId}`,
    `📎 عدد المستندات المرفقة: ${request.documentsCount || 0}`,
  ];
  try {
    await sendText(EMPLOYEE_NUMBER, lines.join('\n'));
  } catch (err) {
    console.error(
      'تعذّر إشعار الموظف (قد تكون نافذة الـ 24 ساعة مغلقة — أرسل أي رسالة من رقم الموظف لرقم البوت لفتحها):',
      err.message
    );
  }
}

/* ------------------------- استقبال الوسائط ------------------------- */

const MEDIA_TYPES = ['image', 'document', 'video', 'audio', 'sticker'];

/** استخراج معلومات الوسائط من رسالة واردة إن وجدت */
function extractMedia(msg) {
  for (const type of MEDIA_TYPES) {
    if (msg[type] && msg[type].id) {
      return {
        id: msg[type].id,
        filename: msg[type].filename || null,
        caption: msg[type].caption || '',
      };
    }
  }
  return null;
}

/** تحميل وسائط من ميتا وحفظها على القرص. يُرجع اسم الملف أو null. */
async function downloadMedia(media) {
  try {
    const metaRes = await fetch(`${GRAPH_URL}/${media.id}`, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });
    if (!metaRes.ok) throw new Error(`meta ${metaRes.status}`);
    const info = await metaRes.json();

    const fileRes = await fetch(info.url, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });
    if (!fileRes.ok) throw new Error(`download ${fileRes.status}`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    const ext = media.filename
      ? path.extname(media.filename)
      : '.' + (((info.mime_type || '').split('/')[1] || 'bin').split(';')[0]);
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    fs.writeFileSync(path.join(MEDIA_DIR, fileName), buffer);
    return fileName;
  } catch (err) {
    console.error('تعذّر تحميل الوسائط:', err.message);
    return null;
  }
}

/* ------------------------- معالجة الرسائل الواردة ------------------------- */

// ميتا قد تعيد إرسال نفس الويب هوك أكثر من مرة — نتجاهل الرسائل المكررة
const processedIds = new Set();

async function handleIncoming(msg) {
  if (!msg.id || processedIds.has(msg.id)) return;
  processedIds.add(msg.id);
  if (processedIds.size > 5000) processedIds.clear();

  const chatId = msg.from;

  // رسائل الموظف لا تدخل تدفق العملاء (حتى لا يرد عليه البوت بالقوائم)
  if (EMPLOYEE_NUMBER && chatId === EMPLOYEE_NUMBER) return;

  let text = (msg.text && msg.text.body) || '';
  let hasMedia = false;
  let mediaSaved = null;

  const media = extractMedia(msg);
  if (media) {
    hasMedia = true;
    mediaSaved = await downloadMedia(media);
    if (!text) text = media.caption;
  }

  const replies = flow.handleMessage(chatId, { text, hasMedia, mediaSaved });
  for (const reply of replies) {
    if (reply && reply.trim()) {
      await sendText(chatId, reply);
    }
  }
}

/* ------------------------- سيرفر الويب هوك ------------------------- */

const app = express();
app.use(express.json());

// صفحة فحص بسيطة
app.get('/', (req, res) => {
  res.send('🤖 eServices WhatsApp Bot is running');
});

// تحقق ميتا من الويب هوك (يحدث مرة واحدة عند ضبط الرابط في اللوحة)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ تم التحقق من الويب هوك بنجاح.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// استقبال الرسائل من ميتا
app.post('/webhook', (req, res) => {
  // الرد فوراً حتى لا تعيد ميتا الإرسال، ثم المعالجة في الخلفية
  res.sendStatus(200);

  const entries = (req.body && req.body.entry) || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      if (value.messaging_product !== 'whatsapp') continue;
      for (const msg of value.messages || []) {
        handleIncoming(msg).catch((err) =>
          console.error('خطأ أثناء معالجة الرسالة:', err)
        );
      }
    }
  }
});

// قنوات يستخدمها محرك المحادثة للتأكيد التلقائي بعد آخر مستند
flow.registerSender(sendText);
flow.registerNotifier(notifyEmployee);

process.on('unhandledRejection', (err) => {
  console.error('⚠️ خطأ غير معالج (تم تجاوزه):', err && err.message ? err.message : err);
});

app.listen(Number(PORT), () => {
  console.log(`🚀 البوت جاهز ويعمل الآن على المنفذ ${PORT}. في انتظار رسائل العملاء...`);
  console.log(`   رابط الويب هوك: http://localhost:${PORT}/webhook`);
});
