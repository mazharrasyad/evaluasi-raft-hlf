# Web Draft BAB IV — Grounding Codex

> **Status**: Draft web berbasis prompt. Semua angka/hasil menggunakan placeholder dan **tidak mengarang data**.

---

## 🌐 Web Outline (Single Page)

Berikut adalah rancangan web (struktur konten + elemen visual) untuk menampilkan **grounding BAB IV**. Seluruh konten disusun ulang menjadi format web, **tanpa mengubah makna** dari prompt asli.

---

### 0) Hero / Ringkasan Cepat

**Judul:**
> Grounding Codex untuk BAB IV (Hasil dan Pembahasan)

**Subjudul:**
> Perbandingan konsensus **Raft vs SmartBFT** pada **Hyperledger Fabric** (Ordering Service)

**CTA (Call to Action):**
- 📄 **Unduh Dokumen Grounding** (placeholder)
- 🧩 **Lihat Struktur BAB IV**

---

## 1) Tujuan Dokumen Ini
Dokumen ini menjadi **landasan (grounding)** untuk penggunaan **Codex** saat menyusun **BAB IV (Hasil dan Pembahasan)** agar:

- Konsisten dengan **rumusan masalah, tujuan, batasan, kerangka konsep, dan hipotesis** yang sudah ditetapkan pada BAB I–BAB III.
- Mengikuti **metodologi, instrumentasi, rancangan arsitektur, serta langkah penelitian** pada BAB III.
- Menghindari “narasi baru” yang tidak ada di BAB I–III (misalnya memperluas scope, menambah komponen arsitektur, atau mengarang angka hasil).

> **Prinsip utama:** Output Codex untuk BAB IV harus menjelaskan **apa yang dilakukan, bagaimana dilakukan, data apa yang dihasilkan, dan keluaran tahap** — bukan paragraf generik.

---

## 2) Identitas Penelitian (Ringkas)

**Fokus penelitian:**
> Analisis perbandingan kinerja algoritma konsensus **Raft** dan **SmartBFT** pada **Hyperledger Fabric** (permissioned blockchain), khususnya pada **ordering service**.

**Rumusan masalah inti:**
- Apakah terdapat perbedaan kinerja antara **Raft** dan **SmartBFT** pada Hyperledger Fabric ketika diuji pada skenario dan lingkungan yang sebanding?

**Tujuan penelitian (intinya):**
- Mengukur dan menganalisis kinerja Raft dan SmartBFT berdasarkan parameter: **throughput, latency, resource usage, fault tolerance**.
- Mengidentifikasi perbedaan karakteristik kinerja yang dipengaruhi oleh mekanisme konsensus.
- Menyajikan implikasi pemilihan konsensus untuk kebutuhan sistem blockchain permissioned berbasis Fabric.

---

## 3) Ruang Lingkup & Batasan (Wajib Dipatuhi di BAB IV)

**Batasan wajib:**
1. Platform hanya **Hyperledger Fabric** (permissioned blockchain).
2. Fokus pembahasan pada **ordering service** dan mekanisme konsensus **Raft vs SmartBFT**.
3. Beban sistem menggunakan **transaksi dummy (synthetic workload)**, bukan data riil.
4. Parameter evaluasi: **throughput, latency, resource usage, fault tolerance**.
5. Tidak menambahkan metrik/variabel baru tanpa dasar BAB I–III.

**Catatan konsistensi fault tolerance:**
- Tidak boleh klaim pengujian fault tolerance luas jika tidak dilakukan.
- Boleh menganalisis fault tolerance **berdasarkan skenario gangguan terbatas** yang benar-benar diuji.

---

## 4) Kerangka Konsep (Dasar Logika Pembahasan)

**Relasi sebab-akibat (Flow):**
- Konsensus **Raft / SmartBFT** diterapkan pada **ordering service**.
- Ordering service menjalankan:
  - pengurutan transaksi,
  - batching,
  - pembentukan blok,
  - distribusi blok ke peer.
- Perbedaan proses → berdampak pada:
  - **throughput**, **latency**, **resource usage**, **fault tolerance**.

> Pola pembahasan wajib: **hasil → interpretasi teknis → kaitkan ke ordering service → simpulkan trade-off**.

---

## 5) Hipotesis yang Harus Dijawab (BAB IV)

- **H1 (Throughput):** Terdapat perbedaan throughput antara Raft dan SmartBFT.
- **H2 (Latency):** Terdapat perbedaan latency antara Raft dan SmartBFT.
- **H3 (Resource Usage):** Terdapat perbedaan penggunaan resource (CPU/memori) antara Raft dan SmartBFT.
- **H4 (Fault Tolerance):** Terdapat perbedaan karakteristik fault tolerance antara Raft dan SmartBFT sesuai ruang lingkup pengujian.

> **Catatan:** Keputusan “diterima/ditolak” harus berdasarkan data, **tidak boleh dibuat-buat**.

---

## 6) Metode Penelitian (Landasan BAB IV)

**Jenis:** eksperimen kuantitatif berbasis **benchmarking**.

**Objek uji:**
- Network A: ordering service konsensus **Raft**
- Network B: ordering service konsensus **SmartBFT**

**Pengumpulan data:** observasi sistem & pencatatan otomatis selama pengujian.

**Parameter dicatat:** throughput (TPS), latency, resource usage (CPU/mem), fault tolerance (sesuai skenario gangguan).

---

## 7) Instrumentasi & Lingkungan Uji

**Environment:**
- **Laptop (development environment)**: instalasi, konfigurasi, persiapan network config.
- **VPS Ubuntu 24.04 LTS (deployment/testing environment)**: menjalankan network uji & eksperimen.

> Tidak boleh menyatakan semua pengujian dilakukan di laptop.

---

## 8) Arsitektur Sistem Pengujian

**Patokan arsitektur:**
1. Dua jaringan **terpisah**:
   - **Network A:** Raft
   - **Network B:** SmartBFT
2. Parameter dasar **setara** untuk perbandingan adil.
3. Beban via **dummy transactions**.
4. Dummy dikirim via **web prototype / transaction generator**.
5. Data hasil dari **logging/monitoring**.

---

## 9) Definisi Parameter (Konsisten)

| Parameter | Definisi |
|---|---|
| Throughput (TPS) | Jumlah transaksi sukses per satuan waktu |
| Latency | Selisih waktu dari pengiriman hingga konfirmasi |
| Resource Usage | Ringkasan penggunaan CPU & memori |
| Fault Tolerance | Kemampuan bertahan terhadap gangguan sesuai skenario uji |

---

## 10) Struktur BAB IV (4.1–4.6)

Setiap subbab **wajib** memuat:
- Tujuan tahap
- Langkah yang dilakukan
- Kontrol fairness
- Data yang dihasilkan
- Keluaran tahap (artefak)

### 4.1 Penetapan Skenario Pengujian Sistem
**Tujuan:** merumuskan skenario uji & variasi beban.  
**Artefak visual:** Tabel skenario uji.

| Variasi Beban | Jumlah Transaksi | Concurrency | Jumlah Percobaan | Catatan |
|---|---|---|---|---|
| Rendah | {JUMLAH_TRANSAKSI_RENDAH} | {CONCURRENCY_LEVEL} | {JUMLAH_PERCOBAAN} | Placeholder |
| Sedang | {JUMLAH_TRANSAKSI_SEDANG} | {CONCURRENCY_LEVEL} | {JUMLAH_PERCOBAAN} | Placeholder |
| Tinggi | {JUMLAH_TRANSAKSI_TINGGI} | {CONCURRENCY_LEVEL} | {JUMLAH_PERCOBAAN} | Placeholder |

---

### 4.2 Implementasi Lingkungan Pengujian Blockchain
**Tujuan:** menyiapkan environment sesuai rancangan.  
**Artefak visual:** Tabel spesifikasi + screenshot network up.

| Komponen | Detail (Placeholder) |
|---|---|
| Fabric Version | {VERSI_FABRIC} |
| VPS OS | Ubuntu 24.04 LTS |
| Orderer | Raft / SmartBFT |
| Channel | sesuai konfigurasi jaringan |

---

### 4.3 Eksekusi Transaksi Dummy sebagai Beban Sistem
**Tujuan:** menjalankan transaksi dummy via web prototype.  
**Artefak visual:** Screenshot web generator + format payload.

```
Dummy Transaction Payload (placeholder):
{
  "id": "<tx-id>",
  "timestamp": "<timestamp>",
  "payload": "<dummy-data>"
}
```

---

### 4.4 Pelaksanaan Pengujian & Pencatatan Aktivitas Sistem
**Tujuan:** eksekusi benchmark + logging.  
**Artefak visual:** Screenshot monitoring CPU/mem + potongan log.

```
[LOG] {TIMESTAMP} | orderer: batch=... | tx=... | status=...
```

---

### 4.5 Pengelompokan Data Kinerja Sistem
**Tujuan:** menyusun dataset final untuk analisis.  
**Artefak visual:** tabel rekap dataset.

| Parameter | Raft | SmartBFT |
|---|---|---|
| Throughput (TPS) | {TPS_RAFT} | {TPS_SMARTBFT} |
| Latency (ms) | {LATENCY_RAFT} | {LATENCY_SMARTBFT} |
| CPU (%) | {CPU_RAFT} | {CPU_SMARTBFT} |
| Mem (MB) | {MEM_RAFT} | {MEM_SMARTBFT} |
| Fault Tolerance | {HASIL_FAULT} | {HASIL_FAULT} |

---

### 4.6 Analisis Kinerja Algoritma Konsensus
**Tujuan:** membandingkan hasil dan menyimpulkan trade-off.  
**Artefak visual:** grafik perbandingan + tabel ringkasan.

**Pola analisis:**
- Temuan → alasan teknis → implikasi → trade-off.

---

## 11) Placeholder Standar (Wajib Dipakai)
Gunakan placeholder berikut **tanpa mengarang angka**:

- `{VERSI_FABRIC}`
- `{JUMLAH_TRANSAKSI_RENDAH}`, `{JUMLAH_TRANSAKSI_SEDANG}`, `{JUMLAH_TRANSAKSI_TINGGI}`
- `{CONCURRENCY_LEVEL}`, `{JUMLAH_PERCOBAAN}`
- `{BLOCK_SIZE}`, `{BATCH_TIMEOUT}`
- `{TPS_RAFT}`, `{TPS_SMARTBFT}`
- `{LATENCY_RAFT}`, `{LATENCY_SMARTBFT}`
- `{CPU_RAFT}`, `{CPU_SMARTBFT}`
- `{MEM_RAFT}`, `{MEM_SMARTBFT}`
- `{SKENARIO_FAULT}`, `{HASIL_FAULT}`

---

## 12) Aturan “Do / Don’t”

### ✅ Do
- Alur eksperimen repeatable: skenario → setup → eksekusi → logging → grouping → analisis.
- Tekankan fair comparison (beban identik, prosedur sama).
- Hubungkan hasil ke ordering service (order → batch → block → distribute).
- Pola pembahasan: **temuan → alasan teknis → implikasi**.

### ❌ Don’t
- Jangan mengarang angka/hasil/tabel.
- Jangan menambah komponen arsitektur baru.
- Jangan memperluas scope fault tolerance.
- Jangan menambah metrik baru.

---

## 13) Prompt Codex (Template)

> Tulis BAB IV (4.1–4.6) berdasarkan rancangan BAB I–BAB III tesis perbandingan kinerja konsensus Raft dan SmartBFT pada Hyperledger Fabric. Ikuti urutan subbab: 4.1 skenario uji, 4.2 implementasi lingkungan, 4.3 eksekusi transaksi dummy, 4.4 pengujian & pencatatan aktivitas, 4.5 pengelompokan data, 4.6 analisis komparatif. Arsitektur uji: laptop sebagai development environment, VPS Ubuntu 24.04 LTS sebagai deployment/testing environment, dua network terpisah (Raft vs SmartBFT), beban transaksi dummy dikirim via web prototype sebagai client. Parameter analisis: throughput, latency, resource usage (CPU/mem), fault tolerance sesuai scope. Jangan membuat angka hasil; gunakan placeholder. Setiap subbab wajib menyebut tujuan, langkah, kontrol fairness, data yang direkam, keluaran tahap, serta rekomendasi minimal 1 gambar/tabel yang akan ditampilkan pada web.

---

## 14) Sumber Grounding
Grounding ini disusun berdasarkan naskah tesis **BAB I–BAB III** (dokumen revisi tesis yang Anda kirim).
