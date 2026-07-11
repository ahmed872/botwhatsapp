/**
 * قاعدة بيانات الخدمات
 * ------------------------------------------------------------------
 * كل خدمة تحتوي على:
 *   id        : معرّف فريد
 *   name      : اسم الخدمة كما يظهر للعميل
 *   price     : السعر بالريال (من قائمة أسعار المكتب). قد يكون رقم أو نص للحالات الخاصة.
 *   time      : المدة التقريبية للتنفيذ (اختياري)
 *   questions : أسئلة يطرحها البوت قبل طلب المستندات (اختياري)
 *   documents : المستندات المطلوبة من العميل
 *
 * الأقسام:
 *   business  : خدمات الأعمال والمنشآت
 *   citizens  : خدمات المواطنين
 *   workers   : خدمات العمال والمقيمين
 */

const sections = {
  business: {
    id: 'business',
    emoji: '1️⃣',
    title: 'خدمات الأعمال والمنشآت',
    services: [
      {
        id: 'b_commercial_register',
        name: 'فتح سجل تجاري',
        price: 100,
        time: '30 دقيقة تقريباً',
        questions: [
          'نوع النشاط؟',
          'مؤسسة أم شركة؟',
          'الاسم التجاري المطلوب؟',
        ],
        documents: [
          'هوية المالك أو الإقامة',
          'رقم الجوال المسجل بأبشر',
          'العنوان الوطني',
        ],
      },
      {
        id: 'b_labor_office',
        name: 'فتح ملف مكتب عمل',
        price: 50,
        documents: ['السجل التجاري', 'العنوان الوطني', 'بيانات المنشأة'],
      },
      {
        id: 'b_qiwa',
        name: 'فتح ملف قوى',
        price: 50,
        documents: [
          'السجل التجاري',
          'بيانات صاحب المنشأة',
          'رقم الجوال المسجل بأبشر',
        ],
      },
      {
        id: 'b_zakat',
        name: 'فتح ملف زكاة',
        price: 50,
        documents: ['السجل التجاري', 'هوية المالك', 'البريد الإلكتروني'],
      },
      {
        id: 'b_gosi',
        name: 'فتح ملف التأمينات',
        price: 50,
        documents: ['السجل التجاري', 'العنوان الوطني', 'بيانات المنشأة'],
      },
      {
        id: 'b_chamber',
        name: 'فتح ملف الغرفة التجارية',
        price: 50,
        documents: ['السجل التجاري', 'بيانات المنشأة'],
      },
      {
        id: 'b_transfer_sponsorship',
        name: 'نقل كفالة على مؤسسة',
        price: 150,
        questions: [
          'هل تمت موافقة العامل؟',
          'هل توجد موافقة من صاحب العمل الحالي؟',
        ],
        documents: [
          'إقامة العامل',
          'جواز السفر',
          'السجل التجاري',
          'رقم المنشأة',
        ],
      },
      {
        id: 'b_municipal_issue',
        name: 'إصدار رخصة بلدية',
        price: 150,
        documents: ['عقد إيجار أو صك', 'السجل التجاري', 'العنوان الوطني'],
      },
      {
        id: 'b_municipal_renew',
        name: 'تجديد رخصة بلدية',
        price: 75,
        documents: ['رقم الرخصة', 'السجل التجاري'],
      },
      {
        id: 'b_visa_issue',
        name: 'إصدار تأشيرة مؤسسة',
        price: 50,
        documents: ['رقم المنشأة', 'السجل التجاري'],
      },
      {
        id: 'b_visa_delegate',
        name: 'تفويض تأشيرة',
        price: 300,
        documents: ['رقم التأشيرة', 'بيانات العامل'],
      },
      {
        id: 'b_mudad_file',
        name: 'فتح ملف مدد',
        price: 50,
        documents: ['بيانات المنشأة', 'السجل التجاري'],
      },
      {
        id: 'b_mudad_link',
        name: 'ربط العمال بمدد',
        price: 25,
        documents: ['بيانات العامل', 'رقم المنشأة'],
      },
      {
        id: 'b_mudad_salaries',
        name: 'تحويل رواتب مدد',
        price: 50,
        documents: ['ملف الرواتب', 'بيانات الموظفين'],
      },
      {
        id: 'b_vat_file',
        name: 'رفع ضريبة',
        price: 50,
        documents: ['ملف المبيعات', 'ملف المشتريات'],
      },
      {
        id: 'b_vat_installment',
        name: 'خطة تقسيط ضريبة',
        price: 50,
        documents: ['رقم المكلف', 'قيمة المديونية'],
      },
      {
        id: 'b_transfer_full',
        name: 'نقل سجل تجاري كامل',
        price: 1500,
        documents: ['بيانات البائع', 'بيانات المشتري', 'السجل التجاري'],
      },
      {
        id: 'b_add_saudi',
        name: 'إضافة سعودي بالتأمينات',
        price: 50,
        documents: ['الهوية الوطنية', 'المسمى الوظيفي', 'الراتب'],
      },
      {
        id: 'b_remove_saudi',
        name: 'فصل سعودي بالتأمينات',
        price: 25,
        documents: ['الهوية الوطنية', 'تاريخ الفصل'],
      },
      {
        id: 'b_absence_report',
        name: 'بلاغ تغيب',
        price: 50,
        documents: ['إقامة العامل', 'رقم الحدود'],
      },
      {
        id: 'b_chamber_attest',
        name: 'تصديق الغرفة التجارية',
        price: 50,
        documents: ['المستند المراد تصديقه'],
      },
      {
        id: 'b_cancel_file',
        name: 'شطب سجل / قوى / زكاة / ضريبة / تأمينات',
        price: 50,
        questions: ['أي ملف تريد شطبه؟ (سجل / قوى / زكاة / ضريبة / تأمينات)'],
        documents: ['السجل التجاري', 'بيانات المنشأة'],
      },
    ],
  },

  citizens: {
    id: 'citizens',
    emoji: '2️⃣',
    title: 'خدمات المواطنين',
    services: [
      {
        id: 'c_agency',
        name: 'إصدار وكالة',
        price: 50,
        documents: ['الهوية الوطنية', 'بيانات الوكيل'],
      },
      {
        id: 'c_agency_multi',
        name: 'وكالة متعددة',
        price: 25,
        documents: ['بيانات جميع الوكلاء'],
      },
      {
        id: 'c_heirs',
        name: 'حصر ورثة',
        price: 25,
        documents: ['شهادة الوفاة', 'هويات الورثة'],
      },
      {
        id: 'c_deed_update',
        name: 'تحديث الصك',
        price: 100,
        documents: ['الصك', 'الهوية الوطنية'],
      },
      {
        id: 'c_rulings',
        name: 'إحكام',
        price: 100,
        documents: ['الصك أو المستندات المتوفرة', 'موقع العقار'],
      },
      {
        id: 'c_development_bank',
        name: 'بنك التنمية',
        price: 'من 100 إلى 150 (حسب الحكومي / بكفيل)',
        documents: ['الهوية', 'تعريف الراتب', 'بيانات الكفيل (إن وجد)'],
      },
      {
        id: 'c_citizen_account',
        name: 'حساب المواطن',
        price: 50,
        documents: ['الهوية', 'بيانات الدخل', 'رقم الآيبان'],
      },
      {
        id: 'c_social_security',
        name: 'الضمان الاجتماعي',
        price: 50,
        documents: ['الهوية', 'بيانات الدخل', 'بيانات السكن'],
      },
      {
        id: 'c_national_address',
        name: 'العنوان الوطني',
        price: 25,
        documents: ['الهوية الوطنية'],
      },
      {
        id: 'c_bank_account',
        name: 'فتح حساب بنكي',
        price: 50,
        documents: ['الهوية الوطنية'],
      },
      {
        id: 'c_accident_claim',
        name: 'مطالبة حادث',
        price: 75,
        documents: ['تقرير الحادث', 'التأمين', 'الهوية'],
      },
      {
        id: 'c_first_home',
        name: 'إعفاء المسكن الأول',
        price: 50,
        documents: ['الهوية', 'عقد الشراء'],
      },
      {
        id: 'c_passport_renew',
        name: 'تجديد جواز سعودي',
        price: 35,
        documents: ['الهوية الوطنية'],
      },
      {
        id: 'c_id_renew',
        name: 'تجديد بطاقة الأحوال',
        price: 35,
        documents: ['الهوية الوطنية'],
      },
      {
        id: 'c_education_register',
        name: 'تسجيل جامعة / ماجستير / نور',
        price: 'من 50 إلى 75 (حسب المرحلة)',
        questions: [
          'الاسم؟',
          'المؤهل؟',
          'الخبرات؟',
          'المهارات؟',
          'صورة شخصية (اختياري - أرسلها أو اكتب "تخطي")',
        ],
        documents: ['الشهادات', 'الهوية', 'السيرة الذاتية'],
      },
      {
        id: 'c_qiyas',
        name: 'قياس',
        price: 50,
        documents: ['الهوية', 'بيانات الاختبار'],
      },
      {
        id: 'c_rehab',
        name: 'التأهيل الشامل',
        price: 50,
        documents: ['التقارير الطبية'],
      },
      {
        id: 'c_tamheer',
        name: 'تمهير',
        price: 60,
        documents: ['الهوية', 'المؤهل'],
      },
      {
        id: 'c_hafiz',
        name: 'حافز',
        price: 60,
        documents: ['الهوية'],
      },
      {
        id: 'c_wusool',
        name: 'وصول',
        price: 50,
        documents: ['بيانات العمل'],
      },
      {
        id: 'c_car_insurance',
        name: 'تأمين سيارة',
        price: 60,
        documents: ['الاستمارة', 'الهوية'],
      },
    ],
  },

  workers: {
    id: 'workers',
    emoji: '3️⃣',
    title: 'خدمات العمال والمقيمين',
    services: [
      {
        id: 'w_absher',
        name: 'فتح أبشر',
        price: 20,
        documents: ['الإقامة', 'الجوال'],
      },
      {
        id: 'w_exit_reentry',
        name: 'خروج وعودة',
        price: 20,
        documents: ['الإقامة'],
      },
      {
        id: 'w_iqama_renew',
        name: 'تجديد إقامة',
        price: 20,
        documents: ['الإقامة', 'الجواز', 'التأمين الطبي'],
      },
      {
        id: 'w_iqama_issue',
        name: 'إصدار إقامة',
        price: 30,
        documents: ['الجواز', 'التأشيرة', 'التأمين'],
      },
      {
        id: 'w_work_permit',
        name: 'إصدار رخصة عمل',
        price: 25,
        documents: ['رقم الإقامة'],
      },
      {
        id: 'w_family_visit',
        name: 'زيارة عائلية',
        price: 'الفرد 25 (تصديق الزيارة)',
        documents: ['الإقامة', 'بيانات الزائرين'],
      },
      {
        id: 'w_visit_attest',
        name: 'تصديق زيارة',
        price: 25,
        documents: ['رقم الطلب'],
      },
      {
        id: 'w_visit_insurance',
        name: 'تأمين زيارة',
        price: '50 لـ 3 شهور / 100 للسنة',
        documents: ['رقم الجواز', 'مدة الزيارة'],
      },
      {
        id: 'w_traffic_appointment',
        name: 'حجز موعد مرور',
        price: 15,
        documents: ['الهوية أو الإقامة'],
      },
      {
        id: 'w_prosecution_appointment',
        name: 'حجز موعد النيابة العامة',
        price: 35,
        documents: ['الهوية أو الإقامة'],
      },
      {
        id: 'w_najiz_print',
        name: 'طباعة قضية ناجز',
        price: 25,
        documents: ['رقم القضية'],
      },
      {
        id: 'w_promissory_note',
        name: 'تنفيذ سند لأمر',
        price: 75,
        documents: ['سند الأمر', 'بيانات المنفذ ضده'],
      },
      {
        id: 'w_engineers_renew',
        name: 'تجديد هيئة المهندسين',
        price: 50,
        documents: ['رقم العضوية', 'الإقامة'],
      },
      {
        id: 'w_domestic_visa',
        name: 'تأشيرة عمالة منزلية',
        price: 100,
        documents: ['الهوية أو الإقامة', 'إثبات القدرة المالية'],
      },
      {
        id: 'w_electricity',
        name: 'خدمات الكهرباء',
        price: 'من 50 إلى 75 (حسب الخدمة)',
        documents: ['عقد الإيجار أو الصك', 'الهوية أو الإقامة'],
      },
    ],
  },
};

/** إرجاع خدمة عبر معرّفها من كل الأقسام */
function findServiceById(serviceId) {
  for (const section of Object.values(sections)) {
    const svc = section.services.find((s) => s.id === serviceId);
    if (svc) return { service: svc, section };
  }
  return null;
}

module.exports = { sections, findServiceById };
