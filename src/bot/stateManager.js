/**
 * مدير حالة المحادثات.
 * يحتفظ في الذاكرة بحالة كل عميل (أين وصل في المحادثة وما جمعه من بيانات).
 *
 * الحالات (step) الممكنة:
 *   collect_name / collect_phone / collect_id / collect_city  : جمع بيانات العميل
 *   main_menu        : القائمة الرئيسية
 *   section_menu     : قائمة خدمات قسم معيّن
 *   service_questions: طرح أسئلة الخدمة
 *   service_documents: استقبال المستندات
 *   track            : متابعة طلب سابق
 *   human            : وضع التحدث مع موظف
 */

const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      step: 'start',
      sectionId: null,
      serviceId: null,
      questionIndex: 0,
      answers: [],
      documents: [],
      draft: {}, // بيانات مؤقتة أثناء جمع بيانات العميل
    });
  }
  return sessions.get(chatId);
}

function setSession(chatId, patch) {
  const s = getSession(chatId);
  Object.assign(s, patch);
  return s;
}

/** إعادة الجلسة لبداية خدمة جديدة مع الحفاظ على بيانات العميل */
function resetFlow(chatId) {
  const s = getSession(chatId);
  s.sectionId = null;
  s.serviceId = null;
  s.questionIndex = 0;
  s.answers = [];
  s.documents = [];
  return s;
}

module.exports = { getSession, setSession, resetFlow };
