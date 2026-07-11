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

const flow = require('./bot/flow');

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
    // لاستخدام متصفح Chrome المثبت على الجهاز بدل المتصفح المرفق،
    // اضبط متغير البيئة CHROME_PATH بمسار chrome.exe
    executablePath: process.env.CHROME_PATH || undefined,
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
  const clientNumber = (request.chatId || '').replace('@c.us', '');
  const lines = [
    '🔔 *طلب جديد*',
    '',
    `🔖 ${request.id}`,
    `📄 الخدمة: ${request.serviceName}`,
    `💰 السعر: ${typeof request.price === 'number' ? request.price + ' ريال' : request.price}`,
    `📱 رقم واتساب العميل: ${clientNumber}`,
    `📎 عدد المستندات المرفقة: ${request.documentsCount || 0}`,
  ];
  try {
    const jid = `${EMPLOYEE_NUMBER}@c.us`;
    await client.sendMessage(jid, lines.join('\n'));
  } catch (err) {
    console.error('تعذّر إشعار الموظف:', err.message);
  }
}

// قنوات يستخدمها محرك المحادثة للتأكيد التلقائي بعد آخر مستند
flow.registerSender((chatId, text) => client.sendMessage(chatId, text));
flow.registerNotifier(notifyEmployee);

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

    const replies = flow.handleMessage(chatId, {
      text: message.body || '',
      hasMedia: message.hasMedia,
      mediaSaved,
    });

    for (const reply of replies) {
      if (reply && reply.trim()) {
        await client.sendMessage(chatId, reply);
      }
    }
  } catch (err) {
    console.error('خطأ أثناء معالجة الرسالة:', err);
  }
});

/**
 * تشغيل البوت مع إعادة المحاولة تلقائياً.
 * خطأ "Execution context was destroyed" وأمثاله كثيراً ما يكون مؤقتاً
 * (إعادة تحميل صفحة واتساب ويب أثناء التشغيل) وينجح في المحاولة التالية.
 */
const MAX_INIT_ATTEMPTS = 3;

async function startWithRetry(attempt = 1) {
  try {
    await client.initialize();
  } catch (err) {
    console.error(`\n❌ فشل التشغيل (محاولة ${attempt}/${MAX_INIT_ATTEMPTS}):`, err.message);
    try {
      await client.destroy();
    } catch (_) {
      /* المتصفح قد يكون مغلقاً بالفعل */
    }
    if (attempt >= MAX_INIT_ATTEMPTS) {
      console.error(
        [
          '',
          'توقف البوت بعد عدة محاولات. جرّب الآتي بالترتيب:',
          '1. احذف مجلدي .wwebjs_auth و .wwebjs_cache ثم شغّل npm start وامسح QR من جديد.',
          '2. حدّث المكتبة: npm install whatsapp-web.js@latest',
          '3. تأكد من اتصال الإنترنت وأن الجهاز لا يمنع تشغيل المتصفح.',
        ].join('\n')
      );
      process.exit(1);
    }
    console.log('🔄 إعادة المحاولة خلال 5 ثوانٍ...');
    setTimeout(() => startWithRetry(attempt + 1), 5000);
  }
}

startWithRetry();
