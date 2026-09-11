export interface TemplateDefinition {
  id: string;
  nameAr: string;
  nameEn: string;
  category: "simple" | "modern" | "pos" | "classic" | "bilingual";
  primaryColor: string;
  accentColor: string;
  isBilingual: boolean;
  isRoll?: boolean;
  descriptionAr: string;
}

export const TEMPLATES_REGISTRY: Record<string, TemplateDefinition> = {
  simple_red: {
    id: "simple_red",
    nameAr: "نموذج بسيط أحمر",
    nameEn: "Simple Red",
    category: "simple",
    primaryColor: "#991B1B",
    accentColor: "#7F1D1D",
    isBilingual: false,
    descriptionAr: "تصميم بسيط وأنيق بترويسة حمراء داكنة وجدول بيانات محاسبي واضح",
  },
  simple_gray: {
    id: "simple_gray",
    nameAr: "نموذج بسيط رمادي",
    nameEn: "Simple Gray",
    category: "simple",
    primaryColor: "#475569",
    accentColor: "#334155",
    isBilingual: false,
    descriptionAr: "تصميم كلاسيكي هادئ بألوان رمادية فحمية للمنشآت الرسمية",
  },
  simple_clean: {
    id: "simple_clean",
    nameAr: "الشكل البسيط",
    nameEn: "Simple Clean",
    category: "simple",
    primaryColor: "#1E293B",
    accentColor: "#0F172A",
    isBilingual: false,
    descriptionAr: "تصميم فائق البساطة بخطوط هندسية أنيقة وكثافة بيانات عالية",
  },
  modern_red: {
    id: "modern_red",
    nameAr: "أحمر حديث",
    nameEn: "Modern Red",
    category: "modern",
    primaryColor: "#E11D48",
    accentColor: "#BE123C",
    isBilingual: false,
    descriptionAr: "تصميم عصري جذاب بشريط بيانات علوي ملوّن وشارة حالة بارزة",
  },
  classic: {
    id: "classic",
    nameAr: "نموذج كلاسيكي",
    nameEn: "Classic Traditional",
    category: "classic",
    primaryColor: "#1E3A8A",
    accentColor: "#172554",
    isBilingual: false,
    descriptionAr: "تصميم رسمي بإطارات مزدوجة كلاسيكية وترتيب تقليدي محكم",
  },
  pos_color: {
    id: "pos_color",
    nameAr: "نموذج لون نقطة البيع",
    nameEn: "POS Color Receipt",
    category: "pos",
    primaryColor: "#0284C7",
    accentColor: "#0369A1",
    isBilingual: false,
    isRoll: true,
    descriptionAr: "إيصال حراري ملون مقاس 80 مم مخصص لنقاط البيع مع باركود",
  },
  bilingual_zatca: {
    id: "bilingual_zatca",
    nameAr: "فاتورة إلكترونية ثنائية اللغة",
    nameEn: "Bilingual ZATCA E-Invoice",
    category: "bilingual",
    primaryColor: "#0F766E",
    accentColor: "#134E4A",
    isBilingual: true,
    descriptionAr: "فاتورة ضريبية متوافقة بالكامل مع هيئة الزكاة والضريبة والجمارك باللغتين العربية والإنجليزية",
  },
  modern_positive_red: {
    id: "modern_positive_red",
    nameAr: "حديث أحمر إيجابي",
    nameEn: "Modern Positive Red",
    category: "modern",
    primaryColor: "#DC2626",
    accentColor: "#991B1B",
    isBilingual: false,
    descriptionAr: "تصميم أحمر قرمزي إيجابي مع شريط عميل عريض وشريط علوي أنيق",
  },
  modern_sky_blue: {
    id: "modern_sky_blue",
    nameAr: "حديث أزرق سماوي",
    nameEn: "Modern Sky Blue",
    category: "modern",
    primaryColor: "#0284C7",
    accentColor: "#0369A1",
    isBilingual: false,
    descriptionAr: "تصميم حديث مفعم بالحيوية باللون الأزرق السماوي المريح للعين",
  },
  simple_blue: {
    id: "simple_blue",
    nameAr: "نموذج بسيط أزرق",
    nameEn: "Simple Blue",
    category: "simple",
    primaryColor: "#2563EB",
    accentColor: "#1D4ED8",
    isBilingual: false,
    descriptionAr: "تصميم محاسبي بسيط بترويسة زرقاء ملكية وإطارات نظيفة",
  },
  simple_white: {
    id: "simple_white",
    nameAr: "نموذج بسيط أبيض",
    nameEn: "Simple White",
    category: "simple",
    primaryColor: "#0F172A",
    accentColor: "#334155",
    isBilingual: false,
    descriptionAr: "تصميم فائق الوضوح بخلفية بيضاء نقية وتوفير في حبر الطباعة",
  },
  simple_yellow: {
    id: "simple_yellow",
    nameAr: "نموذج بسيط أصفر",
    nameEn: "Simple Yellow",
    category: "simple",
    primaryColor: "#D97706",
    accentColor: "#B45309",
    isBilingual: false,
    descriptionAr: "تصميم بألوان عنبرية ذهبية دافئة تعطي طابعاً احترافياً مميزاً",
  },
  modern_green: {
    id: "modern_green",
    nameAr: "نموذج حديث أخضر",
    nameEn: "Modern Green",
    category: "modern",
    primaryColor: "#059669",
    accentColor: "#047857",
    isBilingual: false,
    descriptionAr: "تصميم حديث باللون الأخضر الزمردي المتناسق مع الهوية السعودية",
  },
  pos_monochrome: {
    id: "pos_monochrome",
    nameAr: "نموذج نقطة بيع أحادي اللون",
    nameEn: "POS Monochrome Thermal",
    category: "pos",
    primaryColor: "#000000",
    accentColor: "#111827",
    isBilingual: false,
    isRoll: true,
    descriptionAr: "إيصال حراري أسود وأبيض 100% متوافق مع كافة طابعات الفواتير الحرارية 80 مم",
  },
  simple_black: {
    id: "simple_black",
    nameAr: "نموذج بسيط أسود",
    nameEn: "Simple Black",
    category: "simple",
    primaryColor: "#000000",
    accentColor: "#18181B",
    isBilingual: false,
    descriptionAr: "تصميم أسود داكن فخم عالي التباين مناسب للطباعة الليزرية",
  },
  modern_orange: {
    id: "modern_orange",
    nameAr: "نموذج حديث برتقالي",
    nameEn: "Modern Orange",
    category: "modern",
    primaryColor: "#EA580C",
    accentColor: "#C2410C",
    isBilingual: false,
    descriptionAr: "تصميم حيوي برتقالي جذاب للشركات والمتاجر العصرية",
  },
  modern_gray: {
    id: "modern_gray",
    nameAr: "نموذج حديث رمادي",
    nameEn: "Modern Slate Gray",
    category: "modern",
    primaryColor: "#4B5563",
    accentColor: "#374151",
    isBilingual: false,
    descriptionAr: "تصميم رمادي حديث متوازن يجمع بين الطابع الرسمي والجمالي",
  },
};

export const TEMPLATES_LIST: TemplateDefinition[] = Object.values(TEMPLATES_REGISTRY);
export const DEFAULT_TEMPLATE: TemplateDefinition = TEMPLATES_REGISTRY.simple_red!;

export function getTemplateById(id?: string | null): TemplateDefinition {
  if (id && id in TEMPLATES_REGISTRY) {
    const found = TEMPLATES_REGISTRY[id];
    if (found) return found;
  }
  return DEFAULT_TEMPLATE;
}



