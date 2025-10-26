# Evaluasi Konsensus RAFT pada Hyperledger Fabric

Repositori ini berisi artefak yang digunakan untuk mengevaluasi kinerja mekanisme konsensus RAFT di jaringan Hyperledger Fabric. Dua skenario diuji:

1. **Rancangan Standar** yang mengikuti konfigurasi bawaan Fabric Samples dengan sedikit penyesuaian.
2. **Rancangan Varian** yang memodifikasi topologi dan parameter jaringan untuk meniru beban produksi.

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

## Rancangan Varian

Rancangan varian memperluas jaringan dengan fokus pada skalabilitas dan toleransi gangguan.

- **Topologi**: 5 orderer dalam klaster RAFT, 3 organisasi dengan masing-masing dua peer (total 6 peer), serta 1 channel aplikasi utama.
- **Parameter Penting**:
  - `BatchTimeout`: 1s
  - `BatchSize.MaxMessageCount`: 20
  - Database status menggunakan CouchDB untuk seluruh peer
  - `TLS` mutual diaktifkan pada klaster orderer
- **Metodologi Uji**:
  - Deploy jaringan menggunakan `network-origin/docker-compose-variant.yaml` melalui skrip `bin/network.sh up variant`.
  - Gunakan generator beban di `gateway/benchmark/` untuk skenario baca/tulis 70/30 dengan variasi TPS (200–600).
  - Simulasikan kegagalan orderer melalui `bin/failover.sh` untuk mengukur waktu pemulihan RAFT.
  - Pantau metrik dengan Prometheus dan Grafana (konfigurasi di `config/monitoring/`).
- **Hasil Ringkas**:
  - Throughput stabil di kisaran 320–350 TPS dengan latensi rata-rata 2,8 detik.
  - Failover pemimpin membutuhkan 3–5 detik hingga transaksi kembali diproses.
  - CouchDB menambah latensi baca namun meningkatkan fleksibilitas kueri.

## Cara Menjalankan Ulang Eksperimen

1. Instal dependensi Fabric (Docker, Docker Compose, Node.js, Go) serta aktifkan Docker daemon.
2. Ekspor variabel `PATH` agar mencakup utilitas Fabric binaries (`configtxgen`, `peer`, `orderer`).

### Menjalankan Rancangan Standar

1. Jalankan jaringan standar:
   ```bash
   cd raft-standard/network
   ./network.sh up createChannel -c channel-standard -ca
   ```
2. Deploy chaincode Pelaporan dari direktori `chaincode/pelaporan`:
   ```bash
   ./network.sh deployCC -c channel-standard -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript
   ```
3. Jalankan gateway untuk mengirim transaksi uji:
   ```bash
   cd ../../gateway
   npm install
   npm run start
   ```
4. Dari akar repositori, kumpulkan metrik menggunakan skrip otomatisasi:
   ```bash
   bin/collect-metrics.sh
   ```
   atau jalankan benchmark terotomatisasi:
   ```bash
   gateway/benchmark/run.sh
   ```
5. Setelah selesai, hentikan jaringan dengan menjalankan perintah berikut dari direktori `raft-standard/network`:
   ```bash
   ./network.sh down
   ```

### Menjalankan Rancangan Varian

Rancangan varian memerlukan perluasan topologi bawaan. Gunakan langkah berikut sebagai panduan:

1. Gandakan file `raft-standard/network/compose/compose-test-net.yaml` untuk membuat berkas docker-compose khusus (mis. `compose-variant.yaml`) dan tambahkan layanan orderer serta peer tambahan sesuai kebutuhan varian.
2. Perbarui `raft-standard/config/configtx.yaml` dan `raft-standard/network/organizations/cryptogen/crypto-config-orderer.yaml` agar memasukkan identitas orderer tambahan yang akan digunakan oleh klaster RAFT.
3. Setelah penyesuaian selesai, jalankan jaringan varian dengan perintah:
   ```bash
   cd raft-standard/network
   COMPOSE_FILE_BASE=compose-variant.yaml ./network.sh up createChannel -c channel-varian -ca -s couchdb
   ```
   Opsi `-s couchdb` mengaktifkan database CouchDB pada seluruh peer sebagaimana didefinisikan dalam rancangan.
4. Deploy chaincode yang sama atau khusus varian menggunakan perintah `./network.sh deployCC` sebagaimana pada rancangan standar, namun arahkan parameter channel ke `channel-varian`.
5. Jalankan beban transaksi dari `gateway/benchmark/` untuk mensimulasikan rasio baca/tulis 70/30:
   ```bash
   cd ../../gateway/benchmark
   ./run.sh --profile mix --tps 400
   ```
   Sesuaikan parameter `--tps` untuk mengevaluasi throughput yang berbeda.
6. Kumpulkan metrik menggunakan skrip otomatisasi yang sama:
   ```bash
   ../../bin/collect-metrics.sh --profile variant
   ```
   atau akses dashboard Prometheus/Grafana yang dikonfigurasi di `raft-standard/network/prometheus-grafana/` untuk pemantauan visual.
7. Setelah eksperimen selesai, hentikan seluruh layanan varian dari direktori `raft-standard/network`:
   ```bash
   ./network.sh down
   ```

## Referensi

- [Hyperledger Fabric RAFT Ordering Service](https://hyperledger-fabric.readthedocs.io/en/latest/orderer/ordering_service.html)
- [Fabric Test Network](https://hyperledger-fabric.readthedocs.io/en/latest/test_network.html)
- [RAFT Consensus Paper](https://raft.github.io/raft.pdf)
