# Evaluasi Konsensus RAFT pada Hyperledger Fabric

Repositori ini berisi artefak yang digunakan untuk mengevaluasi kinerja mekanisme konsensus RAFT di jaringan Hyperledger Fabric. Dua skenario diuji:

1. **Rancangan Standar** yang mengikuti konfigurasi bawaan Fabric Samples dengan sedikit penyesuaian.
2. **Rancangan Kustom** yang memodifikasi topologi dan parameter jaringan untuk meniru beban produksi.

## Latar Belakang

Hyperledger Fabric menggunakan RAFT sebagai mekanisme konsensus crash-fault tolerant sejak rilis 1.4.1. Evaluasi dilakukan untuk memahami karakteristik throughput dan latensi ketika jaringan diskalakan serta untuk menilai stabilitas pemilihan pemimpin (leader election) di bawah kondisi berbeda. Seluruh eksperimen memanfaatkan skrip otomatis yang disertakan dalam direktori `bin/`, konfigurasi jaringan di `config/`, serta chaincode contoh di `chaincode/`.

## Rancangan Standar

Rancangan standar didasarkan pada contoh *Fabric Test Network* (`test-network`) dengan tiga *ordering node* RAFT dan dua organisasi peer.

- **Topologi**: 3 orderer (`orderer1.example.com`–`orderer3.example.com`), 2 peer per organisasi, 1 channel aplikasi.
- **Parameter Penting**:
  - `BatchTimeout`: 2s
  - `BatchSize.MaxMessageCount`: 10
  - `SnapshotIntervalSize`: 20 MB
- **Metodologi Uji**:
  - Gunakan skrip `bin/network.sh up` untuk men-deploy jaringan standar.
  - Jalankan beban transaksi melalui `gateway/submit_tx.js` dengan variasi tingkat *throughput* (TPS 50, 100, 200).
  - Catat metrik melalui `bin/collect-metrics.sh` yang memanfaatkan `peer channel getinfo` dan log orderer.
- **Hasil Ringkas**:
  - Latensi end-to-end stabil pada 1,5–2,2 detik hingga 150 TPS.
  - Throughput maksimal tercapai sekitar 180 TPS sebelum peningkatan latensi signifikan.
  - Pemilihan pemimpin jarang terjadi kecuali ketika node sengaja dihentikan.

## Rancangan Kustom

Rancangan kustom memperluas jaringan dengan fokus pada skalabilitas dan toleransi gangguan.

- **Perbedaan Utama**:
  - Menambah organisasi ketiga dengan dua peer tambahan (total 6 peer).
  - Meningkatkan klaster RAFT menjadi 5 orderer dan mengaktifkan `TLS` mutual.
  - Mengubah parameter `BatchTimeout` menjadi 1s dan `BatchSize.MaxMessageCount` menjadi 20.
  - Mengaktifkan *State Database* CouchDB untuk semua peer.
- **Metodologi Uji**:
  - Deploy jaringan menggunakan `network-origin/docker-compose-custom.yaml` melalui skrip `bin/network.sh up custom`.
  - Gunakan generator beban di `gateway/benchmark/` untuk skenario baca/tulis 70/30 dengan variasi TPS (200–600).
  - Simulasikan kegagalan orderer melalui `bin/failover.sh` untuk mengukur waktu pemulihan RAFT.
  - Pantau metrik dengan Prometheus dan Grafana (konfigurasi di `config/monitoring/`).
- **Hasil Ringkas**:
  - Throughput stabil di kisaran 320–350 TPS dengan latensi rata-rata 2,8 detik.
  - Failover pemimpin membutuhkan 3–5 detik hingga transaksi kembali diproses.
  - CouchDB menambah latensi baca namun meningkatkan fleksibilitas kueri.

## Cara Mengulang Eksperimen

1. Instal dependensi Fabric (Docker, Docker Compose, Node.js, Go).
2. Ekspor variabel `PATH` agar mencakup `bin/` Fabric.
3. Jalankan `bin/network.sh up` untuk rancangan standar atau `bin/network.sh up custom` untuk rancangan kustom.
4. Deploy chaincode dari direktori `chaincode/` menggunakan skrip gateway.
5. Gunakan `gateway/benchmark/run.sh` untuk memulai pengujian dan simpan log pada `api.log`.

## Referensi

- [Hyperledger Fabric RAFT Ordering Service](https://hyperledger-fabric.readthedocs.io/en/latest/orderer/ordering_service.html)
- [Fabric Test Network](https://hyperledger-fabric.readthedocs.io/en/latest/test_network.html)
- [RAFT Consensus Paper](https://raft.github.io/raft.pdf)
