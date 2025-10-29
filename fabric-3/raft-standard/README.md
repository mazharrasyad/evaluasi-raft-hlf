# Panduan Fabric 3 RAFT Standard

Panduan ini membantu Anda menyiapkan jaringan Hyperledger Fabric v3 berbasis konsensus RAFT dengan struktur yang serupa dengan paket `fabric-2/raft-standard`. Direktori ini mempertahankan pola resmi `test-network` sehingga transisi dari Fabric 2 ke Fabric 3 dapat dilakukan tanpa banyak perubahan alur kerja.

## Struktur Direktori
- **bin/** – berisi binary CLI terbaru (peer, orderer, configtxgen, dsb.) yang siap dipakai untuk membangun artefak jaringan.
- **chaincode/pelaporan/** – contoh chaincode Node.js untuk skenario pencatatan digital lengkap dengan `package.json` dan data contoh.
- **config/** – kumpulan berkas konfigurasi (`configtx.yaml`, `core.yaml`, `orderer.yaml`) yang menjadi acuan saat menghasilkan genesis block maupun profil kanal.
- **env.sh** – skrip utilitas untuk menambahkan `bin/` ke `PATH`, menetapkan `FABRIC_CFG_PATH`, serta nama proyek `docker-compose` yang konsisten.
- **network/** – adaptasi skrip `test-network` Fabric 3 yang menangani pembuatan sertifikat, penyusunan channel, deployment chaincode, dan monitoring.

## Persiapan Lingkungan
1. Masuk ke direktori akar paket dan muat variabel lingkungan:
   ```bash
   cd fabric-3/raft-standard
   source env.sh
   ```
2. Pastikan Docker (atau Podman) aktif karena skrip `network.sh` memanfaatkan container untuk seluruh komponen jaringan.
3. Jika diperlukan, sesuaikan parameter default di `network/network.config` (misalnya jalur chaincode, nama channel, atau bahasa chaincode).

## Menjalankan Jaringan RAFT
1. Nyalakan jaringan dasar dua organisasi dengan satu peer per organisasi dan tiga orderer RAFT:
   ```bash
   cd network
   ./network.sh up
   ```
2. Buat channel standar (akan otomatis membuat jaringan jika belum aktif):
   ```bash
   ./network.sh createChannel
   ```
3. Deploy chaincode Node.js `pelaporan` dengan mengoverride konfigurasi default:
   ```bash
   ./network.sh deployCC -ccn pelaporan -ccl node -ccp ../chaincode/pelaporan
   ```
4. Jalankan pengujian sederhana terhadap chaincode sesuai kebutuhan, misalnya melalui perintah `peer chaincode invoke` setelah memanggil `setOrgEnv.sh` untuk memuat variabel organisasi.
5. Setelah selesai, hentikan jaringan dan bersihkan container:
   ```bash
   ./network.sh down
   ```

## Kustomisasi Lanjutan
- Gunakan opsi `-bft` pada `network.sh` jika ingin menguji konsensus BFT yang juga disediakan oleh skrip Fabric 3.
- File `network.config` menyertakan parameter `CC_SEQUENCE`, `CC_END_POLICY`, serta `CCAAS_DOCKER_RUN` untuk eksperimen lanjutan (misalnya Chaincode-as-a-Service).
- Direktori `prometheus-grafana/` dan skrip pemantauan lain di bawah `network/` dapat diaktifkan untuk observabilitas.

## Referensi Tambahan
Dokumentasi rinci perintah `network.sh`, dukungan Podman, dan tutorial Chaincode-as-a-Service tersedia di `network/README.md`. Gunakan referensi tersebut untuk memahami seluruh variasi operasi yang disediakan skrip.
