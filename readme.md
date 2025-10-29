# Evaluasi Hyperledger Fabric RAFT

Repositori ini berisi dua set sumber daya untuk mengevaluasi konsensus RAFT pada Hyperledger Fabric:

- **fabric-2/raft-standard** – konfigurasi dan artefak standar sesuai dokumentasi resmi Hyperledger Fabric.
- **fabric-2/raft-variant** – variasi konfigurasi yang memungkinkan eksperimen terhadap parameter jaringan dan komponen tertentu.
- **fabric-3/raft-standard** – pembaruan baseline untuk Fabric v3 yang mempertahankan pola direktori v2 sekaligus membawa default terbaru dari skrip `test-network` resmi.

Selain dua paket utama tersebut, terdapat direktori pendukung untuk skrip utilitas dan antarmuka web.

## Struktur Direktori

```
.
├── bin/
├── fabric-2/
│   ├── raft-standard/
│   │   ├── chaincode/
│   │   ├── config/
│   │   └── network/
│   └── raft-variant/
│       ├── chaincode/
│       ├── config/
│       └── network/
├── fabric-3/
│   └── raft-standard/
│       ├── chaincode/
│       ├── config/
│       └── network/
└── web/
```

### Direktori Pendukung
- **bin/** – berisi binary CLI Hyperledger Fabric yang dibutuhkan oleh kedua skenario RAFT.
- **web/** – modul antarmuka web untuk memantau atau mengelola jaringan percobaan.

## RAFT Standard
Direktori `fabric-2/raft-standard/` menyediakan baseline jaringan Fabric dengan konsensus RAFT standar. Komponennya terdiri dari:

- **chaincode/** – contoh chaincode yang digunakan dalam jaringan standar.
- **config/** – contoh profil konfigurasi `configtx` dan parameter kanal bawaan.
- **network/** – skrip dan template docker-compose untuk memulai jaringan standar, termasuk:
  - `network.sh`, `monitordocker.sh`, dan folder `scripts/` untuk orkestrasi jaringan.
  - folder `organizations/` dan `configtx/` untuk artefak MSP serta konfigurasi genesis.
  - dukungan monitoring (folder `prometheus-grafana/`) dan dokumentasi tambahan.

Gunakan struktur ini ketika ingin mereplikasi perilaku RAFT sesuai praktik resmi Hyperledger Fabric.

## Fabric 3 RAFT Standard
Direktori `fabric-3/raft-standard/` menyajikan baseline terbaru berbasis Fabric v3 dengan struktur yang familiar:

- **bin/** – kumpulan binary CLI terbaru hasil distribusi Fabric v3. Pastikan direktori ini masuk ke dalam variabel `PATH` atau jalankan skrip `env.sh` di akar direktori untuk mengekspor `PATH`, `FABRIC_CFG_PATH`, dan `COMPOSE_PROJECT_NAME` secara otomatis.
- **chaincode/** – contoh chaincode Node.js `pelaporan` yang dapat dijadikan baseline aplikasi saat menguji Fabric 3.
- **config/** – templat konfigurasi `core.yaml`, `orderer.yaml`, dan artefak lain yang digunakan oleh jaringan v3.
- **network/** – adaptasi skrip `test-network` resmi Fabric 3. Di dalamnya tersedia:
  - `network.sh` dan `scripts/` untuk orkestrasi penuh jaringan RAFT dua organisasi dengan tiga orderer.
  - `network.config` yang menyimpan parameter default seperti nama kanal (`channel-standard`), jalur chaincode (ubah dari default `../asset-transfer-basic/chaincode-go` ke `../chaincode/pelaporan` bila ingin memakai chaincode bawaan repo), serta opsi deployment seperti `deployCC` dan `deployCCAAS`.
  - Dokumentasi `README.md` yang menjelaskan alur `up`, `createChannel`, hingga `deployCC`, serta dukungan `podman`.

Paket ini dapat digunakan sebagai starting point ketika ingin membandingkan perilaku RAFT di Fabric 3 terhadap baseline Fabric 2 tanpa mengubah kebiasaan kerja tim.

## RAFT Variant
Direktori `fabric-2/raft-variant/` memiliki struktur yang sama dengan paket standar agar mudah dibandingkan, namun isinya dioptimalkan untuk eksperimen atau penyesuaian lebih lanjut:

- **chaincode/** – ruang untuk chaincode alternatif atau versi modifikasi yang digunakan dalam skenario uji.
- **config/** – konfigurasi yang dapat diubah untuk mengevaluasi parameter RAFT (misalnya jumlah orderer, timeout, atau kanal khusus).
- **network/** – salinan skrip jaringan dengan penyesuaian yang memudahkan perbandingan terhadap baseline, termasuk folder `configtx/`, `organizations/`, dan utilitas orkestrasi lainnya.

Variasi ini memudahkan Anda melakukan A/B testing terhadap perubahan pada layer konsensus maupun komponen jaringan lainnya tanpa mengubah baseline standar.

## Cara Menggunakan
1. Pastikan binary pada direktori `bin/` sudah dapat dieksekusi di lingkungan Anda.
2. Pilih skenario `fabric-2/raft-standard`, `fabric-2/raft-variant`, atau baseline terbaru `fabric-3/raft-standard`.
3. Ubah konfigurasi yang diperlukan di dalam folder `config/` dan `network/` pada skenario tersebut.
4. Jalankan skrip `network.sh` di masing-masing direktori `network/` untuk menyalakan atau mematikan jaringan uji.
5. Setelah jaringan siap, jalankan pemeriksaan integrasi dengan perintah:
   ```bash
   npm run check-network
   ```
6. Untuk menguji antarmuka web, masuk ke direktori `web/` dan jalankan server pengembangan:
   ```bash
   cd web
   npm run src/app.js
   ```

Struktur yang sejajar antara standar dan variasi memungkinkan Anda melacak dampak perubahan secara terpisah, sehingga evaluasi terhadap performa atau ketahanan RAFT dapat dilakukan dengan lebih sistematis.
