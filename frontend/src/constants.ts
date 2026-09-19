// Shared constants: categories, filters, icon mapping, formatting helpers.

export const CATEGORIES = [
  "Bersih-bersih",
  "Tukang",
  "Supir",
  "Pengasuh Anak",
  "Kuli Bangunan",
  "Masak",
  "Kurir",
  "Kebun",
  "Desain",
  "Admin/Sosmed",
  "Menulis",
  "Tutor",
  "Fotografi/Video",
  "Web Dev",
  "CS",
];

// MaterialDesignIcons name per category
export const CATEGORY_ICON: Record<string, string> = {
  "Bersih-bersih": "broom",
  Tukang: "hammer-wrench",
  Supir: "car",
  "Pengasuh Anak": "baby-carriage",
  "Kuli Bangunan": "wall",
  Masak: "chef-hat",
  Kurir: "motorbike",
  Kebun: "flower",
  Desain: "palette",
  "Admin/Sosmed": "cellphone-text",
  Menulis: "pencil",
  Tutor: "school",
  "Fotografi/Video": "camera",
  "Web Dev": "laptop",
  CS: "headset",
};

export function categoryIcon(cat?: string): string {
  if (!cat) return "briefcase";
  return CATEGORY_ICON[cat] || "briefcase";
}

// Distinct badge background color per category (identity colors, kept constant).
export const CATEGORY_COLOR: Record<string, string> = {
  "Bersih-bersih": "#0EA5A4",
  Tukang: "#D97706",
  Supir: "#2563EB",
  "Pengasuh Anak": "#DB2777",
  "Kuli Bangunan": "#EA580C",
  Masak: "#DC2626",
  Kurir: "#16A34A",
  Kebun: "#059669",
  Desain: "#7C3AED",
  "Admin/Sosmed": "#4F46E5",
  Menulis: "#0D9488",
  Tutor: "#0891B2",
  "Fotografi/Video": "#C026D3",
  "Web Dev": "#0284C7",
  CS: "#E11D48",
};

export function categoryColor(cat?: string): string {
  if (!cat) return "#E62429";
  return CATEGORY_COLOR[cat] || "#E62429";
}

export const JOB_TYPES = ["Harian", "Part-time", "Full-time", "Gig"];

export const EXPERIENCE_LABELS = [
  "Tidak wajib",
  "Baru",
  "1-2 tahun",
  "3-5 tahun",
  "5+ tahun",
];

// Filter option lists (value + label)
export const DISTANCE_OPTIONS = [
  { value: 0, label: "Semua" },
  { value: 2, label: "< 2 km" },
  { value: 5, label: "< 5 km" },
  { value: 10, label: "< 10 km" },
];

export const PAY_OPTIONS = [
  { value: "Semua", label: "Semua" },
  { value: "<100", label: "< Rp100rb" },
  { value: "100-500", label: "Rp100-500rb" },
  { value: "500-2jt", label: "Rp500rb-2jt" },
  { value: ">2jt", label: "> Rp2jt" },
];

export const EXPERIENCE_OPTIONS = [
  { value: "Semua", label: "Semua" },
  { value: "baru", label: "Baru" },
  { value: "1-2", label: "1-2 thn" },
  { value: "3-5", label: "3-5 thn" },
  { value: "5+", label: "5+ thn" },
];

export const TYPE_OPTIONS = [
  { value: "Semua", label: "Semua" },
  ...JOB_TYPES.map((t) => ({ value: t, label: t })),
];

export type Filters = {
  category: string;
  job_type: string;
  max_distance: number;
  pay_bracket: string;
  experience: string;
};

export const DEFAULT_FILTERS: Filters = {
  category: "Semua",
  job_type: "Semua",
  max_distance: 0,
  pay_bracket: "Semua",
  experience: "Semua",
};

export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.job_type !== "Semua") n++;
  if (f.max_distance !== 0) n++;
  if (f.pay_bracket !== "Semua") n++;
  if (f.experience !== "Semua") n++;
  return n;
}

export function formatRupiah(amount: number): string {
  return "Rp" + amount.toLocaleString("id-ID");
}

export function formatPay(amount: number, unit: string): string {
  return formatRupiah(amount) + unit;
}
