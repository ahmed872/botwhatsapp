/**
 * نقطة تشغيل بوت الواتساب.
 * يعتمد على whatsapp-web.js (يعمل بمسح كود QR مرة واحدة).
 *
 * التشغيل:  npm start
 * أول مرة: امسح كود QR الظاهر في الطرفية من واتساب على جوالك
 *          (الإعدادات → الأجهزة المرتبطة → ربط جهاز).
 */

const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const { handleMessage } = require('./bot/flow');
const store = require('./data/store');

// رقم واتساب الموظف لاستقبال إشعارات الطلبات الجديدة (اختياري).
// اضبطه في متغير البيئة EMPLOYEE_NUMBER بصيغة الدولة، مثال: 9665XXXXXXXX
const EMPLOYEE_NUMBER = process.env.EMPLOYEE_NUMBER || '';

// مجلد حفظ المستندات المرسلة
const MEDIA_DIR = path.join(__dirname, 'data', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '..', '.wwebjs_auth') }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  },
});

client.on('qr', (qr) => {
  console.log('\n📱 امسح كود QR التالي من واتساب (الأجهزة المرتبطة):\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('✅ تم التوثيق بنجاح.');
});

client.on('ready', () => {
  console.log('🚀 البوت جاهز ويعمل الآن. في انتظار رسائل العملاء...');
});

client.on('auth_failure', (msg) => {
  console.error('❌ فشل التوثيق:', msg);
});

client.on('disconnected', (reason) => {
  console.warn('⚠️ تم قطع الاتصال:', reason);
});

/**
 * حفظ وسائط الرسالة على القرص وإرجاع اسم الملف، أو null عند الفشل.
 */
async function saveMedia(message) {
  try {
    const media = await message.downloadMedia();
    if (!media || !media.data) return null;
    const ext = (media.mimetype && media.mimetype.split('/')[1]) || 'bin';
    const safeExt = ext.split(';')[0];
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    fs.writeFileSync(path.join(MEDIA_DIR, fileName), media.data, 'base64');
    return fileName;
  } catch (err) {
    console.error('تعذّر حفظ الوسائط:', err.message);
    return null;
  }
}

/**
 * إشعار الموظف بطلب جديد (إن تم ضبط رقمه).
 */
async function notifyEmployee(request) {
  if (!EMPLOYEE_NUMBER) return;
  const c = request.customer || {};
  const lines = [
    '🔔 *طلب جديد*',
    '',
    `🔖 ${request.id}`,
    `📄 الخدمة: ${request.serviceName}`,
    `💰 السعر: ${typeof request.price === 'number' ? request.price + ' ريال' : request.price}`,
    '',
    '👤 بيانات العميل:',
    `الاسم: ${c.name || '-'}`,
    `الجوال: ${c.phone || '-'}`,
    `الهوية/الإقامة: ${c.idNumber || '-'}`,
    `المدينة: ${c.city || '-'}`,
    `عدد المستندات المرفقة: ${request.documentsCount || 0}`,
  ];
  if (request.answers && request.answers.length) {
    lines.push('', '📝 الإجابات:');
    request.answers.forEach((qa) => lines.push(`- ${qa.question} ${qa.answer}`));
  }
  try {
    const jid = `${EMPLOYEE_NUMBER}@c.us`;
    await client.sendMessage(jid, lines.join('\n'));
  } catch (err) {
    console.error('تعذّر إشعار الموظف:', err.message);
  }
}

// نتتبع عدد الطلبات قبل/بعد كل رسالة لاكتشاف الطلبات الجديدة وإشعار الموظف
client.on('message', async (message) => {
  try {
    // تجاهل رسائل المجموعات ورسائل النظام
    if (message.from.endsWith('@g.us') || message.isStatus) return;

    const chatId = message.from;

    // حفظ الوسائط إن وجدت
    let mediaSaved = null;
    if (message.hasMedia) {
      mediaSaved = await saveMedia(message);
    }

    const before = store.getRequestsByChat(chatId).length;

    const replies = handleMessage(chatId, {
      text: message.body || '',
      hasMedia: message.hasMedia,
      mediaSaved,
    });

    for (const reply of replies) {
      if (reply && reply.trim()) {
        await client.sendMessage(chatId, reply);
      }
    }

    // إن زاد عدد الطلبات فهذا يعني إنشاء طلب جديد → إشعار الموظف
    const after = store.getRequestsByChat(chatId);
    if (after.length > before) {
      const newest = after[after.length - 1];
      await notifyEmployee(newest);
    }
  } catch (err) {
    console.error('خطأ أثناء معالجة الرسالة:', err);
  }
});

client.initialize();
