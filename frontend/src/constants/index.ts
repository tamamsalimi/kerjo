// Shared constants: categories, filters, icon mapping, formatting helpers.
import type { Filters } from "@/src/types/filters";

export type { Filters } from "@/src/types/filters";

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
  "Staf Toko",
  "Kasir",
  "Gudang/Logistik",
  "Staf Kantor",
  "Sekretaris",
  "Akuntan",
  "Asisten Pribadi",
];

// MaterialDesignIcons name per category
const CATEGORY_ICON: Record<string, string> = {
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
  "Staf Toko": "store",
  Kasir: "cash-register",
  "Gudang/Logistik": "warehouse",
  "Staf Kantor": "office-building",
  Sekretaris: "file-account",
  Akuntan: "calculator",
  "Asisten Pribadi": "account-tie",
};

export function categoryIcon(cat?: string): string {
  if (!cat) return "briefcase";
  return CATEGORY_ICON[cat] || "briefcase";
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

export const EXPERIENCE_LABELS = [
  "Tidak wajib",
  "Baru",
  "1-2 tahun",
  "3-5 tahun",
  "5+ tahun",
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
  max_pay: FILTER_LIMITS.pay.max,
  max_experience: FILTER_LIMITS.experience.max,
};

export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.categories.length > 0) n++;
  if (f.job_type !== "Semua") n++;
  if (f.max_distance < FILTER_LIMITS.distance.max) n++;
  if (f.max_pay < FILTER_LIMITS.pay.max) n++;
  if (f.max_experience < FILTER_LIMITS.experience.max) n++;
  return n;
}

function formatRupiah(amount: number): string {
  return "Rp" + amount.toLocaleString("id-ID");
}

export function formatPay(amount: number, unit: string): string {
  return formatRupiah(amount) + unit;
}
