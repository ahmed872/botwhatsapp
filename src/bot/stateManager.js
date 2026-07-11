/**
 * مدير حالة المحادثات.
 * يحتفظ في الذاكرة بحالة كل عميل (أين وصل في المحادثة).
 *
 * الحالات (step) الممكنة:
 *   start            : أول رسالة من العميل
 *   main_menu        : القائمة الرئيسية
 *   section_menu     : قائمة خدمات قسم معيّن
 *   service_documents: استقبال المستندات
 *   track            : متابعة طلب سابق
 */

const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      step: 'start',
      sectionId: null,
      serviceId: null,
      documents: [],
    });
  }
  return sessions.get(chatId);
}

/** إعادة الجلسة لبداية خدمة جديدة */
function resetFlow(chatId) {
  const s = getSession(chatId);
  s.sectionId = null;
  s.serviceId = null;
  s.documents = [];
  return s;
}

module.exports = { getSession, resetFlow };
