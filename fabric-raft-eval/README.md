# Evaluasi Varian RAFT pada Hyperledger Fabric

## Tujuan Penelitian
Proyek ini mendukung tesis berjudul **"Evaluasi Varian Algoritma Konsensus RAFT pada Hyperledger Fabric melalui Simulasi Beban Transaksi Pelaporan Maladministrasi Masyarakat Indonesia"**. Infrastruktur yang disediakan memungkinkan peneliti membangun jaringan Hyperledger Fabric v3.x, menjalankan chaincode pelaporan maladministrasi, dan mengukur dampak perubahan parameter RAFT terhadap performa jaringan.

## Rancangan Eksperimen
Eksperimen mencakup dua konfigurasi orderer:

- **RAFT Standard**: Menggunakan parameter RAFT bawaan (BatchTimeout 2s, MaxMessageCount 10, PreferredMaxBytes 512KB).
- **RAFT Variant**: Menyesuaikan parameter RAFT untuk throughput tinggi (BatchTimeout 500ms, MaxMessageCount 50, PreferredMaxBytes 2MB).

Setiap konfigurasi diuji menggunakan Hyperledger Caliper dengan tiga beban transaksi:

| Label Beban | Jumlah Transaksi | Target TPS |
|-------------|------------------|------------|
| Light       | 100              | 10         |
| Medium      | 1.000            | 50         |
| Heavy       | 5.000            | 100        |

Caliper mencatat metrik throughput, latensi rata-rata, penggunaan CPU, dan penggunaan memori untuk dianalisis di Bab IV tesis.

## Struktur Proyek
```
fabric-raft-eval/
├── caliper-benchmarks/
│   └── benchmark.yaml
├── caliper-workspace/
│   └── config.yaml
├── network/
│   ├── chaincode/
│   │   └── report_chaincode.go
│   ├── channel-artifacts/
│   ├── config/
│   │   ├── raft_standard_orderer.yaml
│   │   ├── raft_variant_orderer.yaml
│   │   └── current_orderer.yaml (dibuat otomatis oleh skrip)
│   ├── crypto/
│   └── docker/
│       └── docker-compose.yaml
├── results/
│   └── summary.md
└── run_benchmark.sh
```

## Cara Menjalankan Simulasi
Pastikan dependensi berikut tersedia: Docker, Docker Compose, Node.js (untuk Caliper), `jq`, dan Hyperledger Caliper (melalui `npx`). Selanjutnya jalankan:

```bash
./run_benchmark.sh
```

Skrip akan:
1. Menerapkan konfigurasi RAFT untuk skenario yang diuji.
2. Menjalankan jaringan Fabric menggunakan Docker Compose.
3. Mengemas dan menyiapkan chaincode dummy `report`.
4. Menjalankan benchmark Caliper untuk beban Light, Medium, dan Heavy.
5. Mengumpulkan metrik ke folder `results/`.

> **Catatan:** Pembuatan material kriptografi (`crypto/`) dan proses instalasi/commit chaincode masih perlu dilakukan secara manual sebelum menjalankan Caliper.

## Lokasi Hasil Pengujian
Seluruh hasil benchmark tersimpan pada folder `results/`:

- `results/<skenario>/throughput_latency.csv`
- `results/<skenario>/resource_usage.json`
- `results/summary.md`

File-file ini siap digunakan sebagai bahan analisis kuantitatif pada laporan tesis.
