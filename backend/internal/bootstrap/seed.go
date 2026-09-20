package bootstrap

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"kerjo/backend/internal/platform/database"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var workers = []database.Worker{
	{ID: "wk_1", Name: "Siti Aminah", Category: "Bersih-bersih", Role: "Bersih-bersih Rumah", ExperienceLabel: "3 tahun", ExperienceYears: 3, DistanceKM: 2.1, PayAmount: 35000, PayUnit: "/jam", Rating: 4.9, JobsCompleted: 31, Verified: true, Bio: "Rapi, teliti, dan selalu tepat waktu. Berpengalaman bersih-bersih rumah dan apartemen."},
	{ID: "wk_2", Name: "Bambang Hartono", Category: "Tukang", Role: "Tukang / Handyman", ExperienceLabel: "7 tahun", ExperienceYears: 7, DistanceKM: 4.5, PayAmount: 150000, PayUnit: "/hari", Rating: 4.7, JobsCompleted: 58, Verified: true, Bio: "Bisa perbaikan listrik, keran, cat, dan renovasi ringan. Kerja bersih dan rapi."},
	{ID: "wk_3", Name: "Dedi Kurniawan", Category: "Supir", Role: "Supir Pribadi", ExperienceLabel: "5 tahun", ExperienceYears: 5, DistanceKM: 1.8, PayAmount: 3500000, PayUnit: "/bulan", Rating: 4.8, JobsCompleted: 19, Verified: true, Bio: "SIM A & B, hafal jalan kota. Sopan, sabar, dan siap antar jemput keluarga."},
	{ID: "wk_4", Name: "Rina Wulandari", Category: "Pengasuh Anak", Role: "Pengasuh Anak / Babysitter", ExperienceLabel: "4 tahun", ExperienceYears: 4, DistanceKM: 3.0, PayAmount: 2800000, PayUnit: "/bulan", Rating: 5.0, JobsCompleted: 14, Verified: true, Bio: "Sayang anak, telaten, dan paham gizi balita."},
	{ID: "wk_5", Name: "Agus Setiawan", Category: "Kuli Bangunan", Role: "Kuli Bangunan", ExperienceLabel: "2 tahun", ExperienceYears: 2, DistanceKM: 5.2, PayAmount: 130000, PayUnit: "/hari", Rating: 4.5, JobsCompleted: 22, Verified: true, Bio: "Kuat, rajin, dan tahan kerja lapangan."},
	{ID: "wk_6", Name: "Wati Lestari", Category: "Masak", Role: "Masak / Catering Rumahan", ExperienceLabel: "6 tahun", ExperienceYears: 6, DistanceKM: 2.7, PayAmount: 250000, PayUnit: "/acara", Rating: 4.9, JobsCompleted: 40, Verified: true, Bio: "Masakan rumahan enak dan higienis."},
	{ID: "wk_7", Name: "Joko Prasetyo", Category: "Kurir", Role: "Kurir / Delivery", ExperienceLabel: "1 tahun", ExperienceYears: 1, DistanceKM: 1.2, PayAmount: 25000, PayUnit: "/pengiriman", Rating: 4.6, JobsCompleted: 65, Verified: true, Bio: "Motor sendiri, cepat dan amanah."},
	{ID: "wk_8", Name: "Yuni Astuti", Category: "Kebun", Role: "Tukang Kebun", ExperienceLabel: "Baru", DistanceKM: 3.8, PayAmount: 100000, PayUnit: "/hari", IsNew: true, Bio: "Baru mulai di kerjo.id, semangat dan mau belajar. Suka merawat tanaman dan taman."},
	{ID: "wk_9", Name: "Slamet Riyadi", Category: "Bersih-bersih", Role: "ART Harian", ExperienceLabel: "8 tahun", ExperienceYears: 8, DistanceKM: 2.4, PayAmount: 120000, PayUnit: "/hari", Rating: 4.8, JobsCompleted: 72, Verified: true, Bio: "Serba bisa urus rumah dan bisa dipercaya."},
	{ID: "wk_10", Name: "Nur Hidayah", Category: "Bersih-bersih", Role: "Cleaning Service Kos/Kantor", ExperienceLabel: "2 tahun", ExperienceYears: 2, DistanceKM: 4.0, PayAmount: 40000, PayUnit: "/jam", Rating: 4.7, JobsCompleted: 28, Verified: true, Bio: "Spesialis bersih kos dan kantor."},
}

var jobs = []database.Job{
	{ID: "jb_1", Business: "Keluarga Santoso", Title: "Butuh ART Harian", Category: "Bersih-bersih", PayAmount: 120000, PayUnit: "/hari", DistanceKM: 2.0, JobType: "Harian", MinExperienceLabel: "Min. 1 tahun", Description: "Cari ART harian untuk bersih-bersih rumah, cuci, dan setrika."},
	{ID: "jb_2", Business: "Toko Bangunan Jaya", Title: "Kuli Angkut Barang", Category: "Kuli Bangunan", PayAmount: 140000, PayUnit: "/hari", DistanceKM: 3.5, JobType: "Harian", MinExperienceLabel: "Min. Tidak wajib", Description: "Butuh tenaga angkut material bangunan."},
	{ID: "jb_3", Business: "Rumah Tangga Wijaya", Title: "Supir Antar Jemput Anak", Category: "Supir", PayAmount: 3200000, PayUnit: "/bulan", DistanceKM: 1.9, JobType: "Part-time", MinExperienceLabel: "Min. 3 tahun", Description: "Antar jemput anak sekolah pagi dan siang."},
	{ID: "jb_4", Business: "Warung Bu Yanti", Title: "Bantu Masak & Bersih-bersih", Category: "Masak", PayAmount: 100000, PayUnit: "/hari", DistanceKM: 2.5, JobType: "Harian", MinExperienceLabel: "Min. Tidak wajib", Description: "Bantu masak menu warung dan beres-beres dapur."},
	{ID: "jb_5", Business: "Kos Melati", Title: "Cleaning Service Mingguan", Category: "Bersih-bersih", PayAmount: 350000, PayUnit: "/minggu", DistanceKM: 4.1, JobType: "Part-time", MinExperienceLabel: "Min. 1 tahun", Description: "Bersihkan area kos setiap minggu."},
	{ID: "jb_6", Business: "Keluarga Pratama", Title: "Pengasuh Anak Full-time", Category: "Pengasuh Anak", PayAmount: 2700000, PayUnit: "/bulan", DistanceKM: 3.2, JobType: "Full-time", MinExperienceLabel: "Min. 2 tahun", Description: "Menjaga dua anak dengan sabar."},
	{ID: "jb_7", Business: "Ekspedisi Cepat", Title: "Kurir Motor Harian", Category: "Kurir", PayAmount: 150000, PayUnit: "/hari", DistanceKM: 1.4, JobType: "Harian", MinExperienceLabel: "Min. Tidak wajib", Description: "Antar paket area kota."},
	{ID: "jb_8", Business: "Perumahan Griya Asri", Title: "Tukang Kebun Bulanan", Category: "Kebun", PayAmount: 800000, PayUnit: "/bulan", DistanceKM: 3.7, JobType: "Part-time", MinExperienceLabel: "Min. Tidak wajib", Description: "Rawat taman perumahan."},
	{ID: "jb_9", Business: "Pak Hasan", Title: "Tukang Renovasi Dapur", Category: "Tukang", PayAmount: 180000, PayUnit: "/hari", DistanceKM: 5.0, JobType: "Gig", MinExperienceLabel: "Min. 3 tahun", Description: "Renovasi dapur dan instalasi air."},
	{ID: "jb_10", Business: "Catering Sedap", Title: "Bantu Masak Acara Weekend", Category: "Masak", PayAmount: 200000, PayUnit: "/acara", DistanceKM: 2.8, JobType: "Gig", MinExperienceLabel: "Min. 2 tahun", Description: "Bantu produksi catering akhir pekan."},
}

var reviewComments = []string{
	"Kerjanya rapi dan tepat waktu, recommended banget!",
	"Ramah, sopan, dan hasilnya memuaskan.",
	"Cepat tanggap dan amanah. Terima kasih ya!",
	"Telaten dan detail, kerjaannya bersih sekali.",
}

func Seed(ctx context.Context, db *gorm.DB, logger *slog.Logger) error {
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		for i := range workers {
			workers[i].ExperienceBucket = experienceBucket(workers[i].ExperienceYears)
			workers[i].CreatedAt, workers[i].UpdatedAt = now, now
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&workers[i]).Error; err != nil {
				return fmt.Errorf("seed worker %s: %w", workers[i].ID, err)
			}
			if workers[i].Verified {
				for reviewIndex := 0; reviewIndex < 2; reviewIndex++ {
					rating := int(mathRound(workers[i].Rating))
					review := database.Review{
						ID:       "rev_seed_" + workers[i].ID + "_" + fmt.Sprint(reviewIndex),
						WorkerID: workers[i].ID, Author: "Pengguna Kerjo", Rating: rating,
						Comment: reviewComments[(i+reviewIndex)%len(reviewComments)], DisplayDate: "2024", CreatedAt: now,
					}
					if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&review).Error; err != nil {
						return err
					}
				}
			}
		}
		for i := range jobs {
			jobs[i].Role = jobs[i].Title
			jobs[i].ExperienceBucket = jobExperienceBucket(jobs[i].MinExperienceLabel)
			jobs[i].ScreeningQuestions = []string{}
			jobs[i].PhotoURLs = []string{}
			jobs[i].WorkersNeeded = 1
			jobs[i].CreatedAt, jobs[i].UpdatedAt = now, now
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&jobs[i]).Error; err != nil {
				return fmt.Errorf("seed job %s: %w", jobs[i].ID, err)
			}
		}
		logger.InfoContext(ctx, "seed data ensured", "workers", len(workers), "jobs", len(jobs))
		return nil
	})
}

func experienceBucket(years int) string {
	switch {
	case years <= 0:
		return "baru"
	case years <= 2:
		return "1-2"
	case years < 5:
		return "3-5"
	default:
		return "5+"
	}
}

func jobExperienceBucket(label string) string {
	switch label {
	case "Min. Baru":
		return "baru"
	case "Min. 1 tahun", "Min. 2 tahun":
		return "1-2"
	case "Min. 3 tahun":
		return "3-5"
	case "Min. 5 tahun":
		return "5+"
	default:
		return "any"
	}
}

func mathRound(value float64) float64 {
	return float64(int(value + 0.5))
}
