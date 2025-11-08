# Evaluasi Hyperledger Fabric RAFT

Repositori ini menyiapkan empat paket lengkap untuk mengevaluasi konsensus RAFT pada Hyperledger Fabric:

- `fabric-2/raft-standard` – baseline Fabric v2 mengikuti pola `test-network` resmi.
- `fabric-2/raft-variant` – varian Fabric v2 dengan parameter operasi yang dimodifikasi untuk eksplorasi lanjutan.
- `fabric-3/raft-standard` – baseline Fabric v3 dengan artefak terbaru dan struktur serupa versi 2.
- `fabric-3/raft-variant` – varian Fabric v3 yang memisahkan penamaan jaringan, port, dan konfigurasi kanal agar dapat berjalan paralel dengan paket standar.

Direktori `web/` melengkapi paket di atas dengan antarmuka sederhana untuk memeriksa jaringan yang sedang berjalan.

## Struktur Direktori

```
.
├── fabric-2/
│   ├── raft-standard/
│   │   ├── bin/
│   │   ├── chaincode/
│   │   ├── config/
│   │   ├── env.sh
│   │   └── network/
│   └── raft-variant/
│       ├── bin/
│       ├── chaincode/
│       ├── config/
│       ├── env.sh
│       └── network/
├── fabric-3/
│   ├── raft-standard/
│   │   ├── bin/
│   │   ├── chaincode/
│   │   ├── config/
│   │   ├── env.sh
│   │   └── network/
│   └── raft-variant/
│       ├── bin/
│       ├── chaincode/
│       ├── config/
│       ├── env.sh
│       └── network/
├── web/
└── readme.md
```

Setiap paket Fabric berisi utilitas `env.sh` yang menambahkan `bin/` ke `PATH`, menetapkan `FABRIC_CFG_PATH` ke folder `config/`, dan mengatur `COMPOSE_PROJECT_NAME` agar stack Docker tidak saling bertabrakan.

## Ringkasan Paket

### Fabric 2 RAFT Standard
- **Binari & konfigurasi**: memakai rilis Fabric v2.5.8 dan CA v1.5.10; seluruh artefak tersimpan di `bin/` dan `config/`.
- **Chaincode**: contoh Node.js `pelaporan` dalam `chaincode/pelaporan/`.
- **Network scripts**: `network/` menyertakan `network.sh`, `scripts/`, `organizations/`, `configtx/`, serta tooling pemantauan di `prometheus-grafana/`.
- **Parameter default**: `network/network.config` menyiapkan `CHANNEL_NAME=fabric2-channel-standard`, database `leveldb`, dan chaincode `pelaporan` sequence 1 dengan dukungan Chaincode-as-a-Service (`CCAAS_DOCKER_RUN=true`).

Paket ini mereplikasi alur standar dokumentasi Hyperledger Fabric untuk pengujian dasar RAFT pada v2.

### Fabric 2 RAFT Variant
- **Tujuan**: menyediakan baseline yang sama dengan paket standar namun dengan konfigurasi agresif untuk eksperimen (lebih banyak retry, delay lebih panjang, dan variasi komponen).
- **Perbedaan utama**: `network.config` mengganti `CRYPTO` menjadi Certificate Authorities, default database `couchdb`, channel `fabric2-channel-variant`, chaincode `pelaporanVariant` dengan sequence otomatis, serta koleksi privat `collections_config.json`.
- **Tuning orderer terkini**: profil RAFT kini memakai batching berlatensi rendah untuk skenario laporan masif Indonesia — `BatchTimeout=1s`, `MaxMessageCount=50`, `PreferredMaxBytes=4MB`, `AbsoluteMaxBytes=20MB` baik pada artefak `config/` maupun `network/configtx/`.
- **Sarana eksperimen**: struktur `network/` identik sehingga mudah melakukan A/B testing, sementara nilai default memudahkan simulasi high-availability, endorsement policy kustom (`OR('Org1MSP.member','Org2MSP.member')`), dan penonaktifan CCAAS (`CCAAS_DOCKER_RUN=false`).

### Fabric 3 RAFT Standard
- **Binari & konfigurasi**: memaketkan rilis Fabric v3.0 dan CA v2.0, lengkap dengan `env.sh` untuk menyiapkan lingkungan.
- **Chaincode**: contoh Node.js `pelaporan` yang sama sehingga perbandingan lintas versi tetap konsisten.
- **Network scripts**: adaptasi skrip resmi `test-network` v3 dengan dukungan BFT opsional (`./network.sh -bft`), monitoring (`prometheus-grafana/`), dan dokumentasi lanjutan di `network/README.md`.
- **Parameter default**: channel `fabric3-channel-standard`, chaincode `pelaporanV3` sequence 1, dan opsi CCAAS aktif secara default.

Paket ini menjadi dasar untuk memahami perubahan Fabric 3 tanpa meninggalkan pola kerja versi sebelumnya.

### Fabric 3 RAFT Variant
- **Fokus**: memungkinkan dua jaringan v3 berjalan bersamaan dengan memisahkan nama proyek Docker (`COMPOSE_PROJECT_NAME=raftvariant`) dan pemetaan port host.
- **Parameter default**: `network.config` menggunakan channel `fabric3-channel-variant` dengan konfigurasi chaincode identik terhadap varian standar, sehingga perbedaan utama berada pada orkestrasi dan topologi.
- **Tuning orderer terkini**: konfigurasi RAFT mengikuti pola optimasi Fabric 2 untuk beban laporan tinggi — `BatchTimeout=1s`, `MaxMessageCount=50`, `PreferredMaxBytes=4MB`, `AbsoluteMaxBytes=20MB` diselaraskan pada `config/configtx.yaml` dan `network/configtx/configtx.yaml`.
- **Port & penamaan**: dokumentasi `fabric-3/raft-variant/README.md` merinci penyesuaian port (mis. orderer 8255→8055, peer Org1 7353→7153) serta suffix jaringan `.fabric3.variant` agar tidak bertabrakan dengan paket `raft-standard`.
- **Eksperimen lanjutan**: tetap mendukung opsi BFT dan CCAAS sehingga Anda dapat membandingkan perilaku RAFT terhadap baseline dengan cepat.

## Cara Menggunakan
1. Pilih paket yang ingin diuji (`fabric-2` atau `fabric-3`, `raft-standard` atau `raft-variant`) lalu muat lingkungan:
   ```bash
   cd fabric-3/raft-variant
   source env.sh
   ```
2. Masuk ke `network/` dan gunakan `network.sh` untuk mengelola jaringan:
   ```bash
   cd network
   ./network.sh up
   ./network.sh createChannel
   ./network.sh deployCC -ccn pelaporan -ccl node -ccp ../chaincode/pelaporan
   ```
   Sesuaikan parameter `-ccn` dengan nama chaincode default paket yang dipakai (misalnya `pelaporanVariant` untuk `fabric-2/raft-variant`).
3. Ubah nilai di `network/network.config` sesuai kebutuhan (nama channel, jalur chaincode, opsi CCAAS, dsb.) kemudian jalankan ulang `network.sh` untuk menerapkan perubahan.
4. Setelah pengujian selesai, hentikan jaringan dengan `./network.sh down`.
5. Gunakan utilitas web untuk pemeriksaan tambahan:
   ```bash
   cd /workspace/web
   npm install
   npm run check-network
   npm run app.js   # alias: npm run start
   ```

Struktur yang sejajar antara setiap paket memudahkan Anda menilai dampak perubahan konfigurasi RAFT antar versi Fabric secara sistematis.
