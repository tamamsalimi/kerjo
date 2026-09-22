// Shared constants: categories, filters, icon mapping, formatting helpers.
import type { Filters } from "@/src/types/filters";

export type { Filters } from "@/src/types/filters";

export const CATEGORIES = [
  "Bersih-bersih",
  "Tukang",
  "Teknisi Listrik",
  "Teknisi AC",
  "Tukang Ledeng",
  "Tukang Las",
  "Bengkel",
  "Supir",
  "Pengasuh Anak",
  "Kuli Bangunan",
  "Masak",
  "Barista",
  "Pelayan",
  "Baker",
  "Kurir",
  "Kebun",
  "Petani",
  "Peternakan",
  "Perikanan",
  "Laundry",
  "Housekeeping",
  "Penjahit",
  "Beauty/Salon",
  "Perawat/Caregiver",
  "Satpam",
  "Petugas Parkir",
  "Desain",
  "Admin/Sosmed",
  "Sales/Marketing",
  "Resepsionis",
  "HR/Recruitment",
  "Data Entry",
  "Menulis",
  "Tutor",
  "Guru",
  "Fotografi/Video",
  "Web Dev",
  "IT Support",
  "CS",
  "Staf Toko",
  "Kasir",
  "Gudang/Logistik",
  "Packing",
  "Operator Produksi",
  "Quality Control",
  "Staf Kantor",
  "Sekretaris",
  "Akuntan",
  "Asisten Pribadi",
  "Crew",
  "Event Organizer",
  "Hotel/Hospitality",
];

export type CategoryGroup = {
  name: string;
  icon: string;
  categories: string[];
};

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { name: "Rumah & Perawatan", icon: "home-heart", categories: ["Bersih-bersih", "Housekeeping", "Laundry", "Pengasuh Anak", "Perawat/Caregiver"] },
  { name: "Tukang & Teknisi", icon: "hammer-wrench", categories: ["Tukang", "Teknisi Listrik", "Teknisi AC", "Tukang Ledeng", "Tukang Las", "Bengkel", "Kuli Bangunan"] },
  { name: "Transport & Logistik", icon: "motorbike", categories: ["Supir", "Kurir", "Gudang/Logistik", "Packing", "Petugas Parkir"] },
  { name: "Makanan & Hospitality", icon: "chef-hat", categories: ["Masak", "Barista", "Pelayan", "Baker", "Hotel/Hospitality", "Crew", "Event Organizer"] },
  { name: "Pertanian", icon: "sprout", categories: ["Kebun", "Petani", "Peternakan", "Perikanan"] },
  { name: "Kecantikan", icon: "face-woman-shimmer", categories: ["Beauty/Salon", "Penjahit"] },
  { name: "Keamanan", icon: "shield-account", categories: ["Satpam"] },
  { name: "Kantor & Admin", icon: "office-building", categories: ["Admin/Sosmed", "Sales/Marketing", "Resepsionis", "HR/Recruitment", "Data Entry", "Menulis", "Staf Kantor", "Sekretaris", "Akuntan", "Asisten Pribadi", "CS"] },
  { name: "Pendidikan", icon: "school", categories: ["Tutor", "Guru"] },
  { name: "Kreatif & IT", icon: "laptop", categories: ["Desain", "Fotografi/Video", "Web Dev", "IT Support"] },
  { name: "Retail & Produksi", icon: "store", categories: ["Staf Toko", "Kasir", "Operator Produksi", "Quality Control"] },
];

export function categoryGroupOf(category?: string): CategoryGroup | undefined {
  if (!category) return undefined;
  return CATEGORY_GROUPS.find((group) => group.categories.includes(category));
}

// MaterialDesignIcons name per category
const CATEGORY_ICON: Record<string, string> = {
  "Bersih-bersih": "broom",
  Tukang: "hammer-wrench",
  "Teknisi Listrik": "flash",
  "Teknisi AC": "air-conditioner",
  "Tukang Ledeng": "pipe-wrench",
  "Tukang Las": "welding",
  Bengkel: "car-wrench",
  Supir: "car",
  "Pengasuh Anak": "baby-carriage",
  "Kuli Bangunan": "wall",
  Masak: "chef-hat",
  Barista: "coffee",
  Pelayan: "room-service",
  Baker: "bread-slice",
  Kurir: "motorbike",
  Kebun: "flower",
  Petani: "sprout",
  Peternakan: "cow",
  Perikanan: "fish",
  Laundry: "washing-machine",
  Housekeeping: "bed",
  Penjahit: "sewing-machine",
  "Beauty/Salon": "face-woman-shimmer",
  "Perawat/Caregiver": "hospital-box",
  Satpam: "shield-account",
  "Petugas Parkir": "parking",
  Desain: "palette",
  "Admin/Sosmed": "cellphone-text",
  "Sales/Marketing": "bullhorn",
  Resepsionis: "desk",
  "HR/Recruitment": "account-search",
  "Data Entry": "keyboard",
  Menulis: "pencil",
  Tutor: "school",
  Guru: "human-male-board",
  "Fotografi/Video": "camera",
  "Web Dev": "laptop",
  "IT Support": "monitor-wrench",
  CS: "headset",
  "Staf Toko": "store",
  Kasir: "cash-register",
  "Gudang/Logistik": "warehouse",
  Packing: "package-variant",
  "Operator Produksi": "factory",
  "Quality Control": "clipboard-check",
  "Staf Kantor": "office-building",
  Sekretaris: "file-account",
  Akuntan: "calculator",
  "Asisten Pribadi": "account-tie",
  Crew: "account-group",
  "Event Organizer": "calendar-star",
  "Hotel/Hospitality": "room-service",
};

export function categoryIcon(cat?: string): string {
  if (!cat) return "briefcase";
  if (CATEGORY_ICON[cat]) return CATEGORY_ICON[cat];
  const group = CATEGORY_GROUPS.find((item) => item.name === cat);
  return group?.icon || "briefcase";
}

export function conversationRole(entityType?: string) {
  if (entityType === "worker") {
    return { label: "Pekerja", icon: "account-hard-hat" };
  }
  if (entityType === "job") {
    return { label: "Lowongan", icon: "briefcase" };
  }
  return { label: "Chat Kerjo", icon: "chat-processing" };
}

export const JOB_TYPES = ["Harian", "Part-time", "Full-time", "Gig"];

export const EMPLOYER_TYPES = [
  { value: "pribadi", label: "Pribadi", icon: "account" },
  { value: "usaha_perusahaan", label: "Usaha/Perusahaan", icon: "office-building" },
] as const;

export function employerTypeLabel(value?: string): string {
  return value === "usaha_perusahaan" || value === "agency" || value === "agensi"
    ? "Usaha/Perusahaan"
    : "Pribadi";
}

export const EXPERIENCE_LABELS = [
  "Tidak wajib",
  "Baru",
  "1-2 tahun",
  "3-5 tahun",
  "5+ tahun",
];

export const EDUCATION_LEVELS = [
  "SD/sederajat",
  "SMP/sederajat",
  "SMA/SMK/sederajat",
  "D1",
  "D2",
  "D3",
  "D4",
  "S1",
  "S2",
  "S3",
];

export const TYPE_OPTIONS = [
  { value: "Semua", label: "Semua" },
  ...JOB_TYPES.map((t) => ({ value: t, label: t })),
];

export const FILTER_LIMITS = {
  distance: { min: 1, max: 50 },
  pay: { min: 0, max: 10_000_000 },
  experience: { min: 0, max: 10 },
} as const;

export const DEFAULT_FILTERS: Filters = {
  categories: [],
  job_type: "Semua",
  max_distance: FILTER_LIMITS.distance.max,
  min_pay: FILTER_LIMITS.pay.min,
  max_pay: FILTER_LIMITS.pay.max,
  min_experience: FILTER_LIMITS.experience.min,
  max_experience: FILTER_LIMITS.experience.max,
};

export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.categories.length > 0) n++;
  if (f.job_type !== "Semua") n++;
  if (f.max_distance < FILTER_LIMITS.distance.max) n++;
  if (f.min_pay > FILTER_LIMITS.pay.min || f.max_pay < FILTER_LIMITS.pay.max) n++;
  if (f.min_experience > FILTER_LIMITS.experience.min || f.max_experience < FILTER_LIMITS.experience.max) n++;
  return n;
}

function formatRupiah(amount: unknown): string | null {
  const numericAmount = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(numericAmount)) return null;
  return "Rp" + numericAmount.toLocaleString("id-ID");
}

export function formatPay(amount: unknown, unit?: string): string {
  const formatted = formatRupiah(amount);
  return formatted ? formatted + (unit ?? "") : "Bayaran belum dicantumkan";
}
