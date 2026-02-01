# Panduan Fabric 3 RAFT Variant

Panduan ini membantu Anda menyiapkan jaringan Hyperledger Fabric v3 berbasis konsensus RAFT dengan struktur yang serupa dengan paket `fabric-3/raft-standard`, tetapi dengan penamaan komponen, jaringan Docker, serta pemetaan port yang dibedakan sehingga bisa dijalankan bersamaan tanpa bentrok.

## Struktur Direktori
- **bin/** – berisi binary CLI terbaru (peer, orderer, configtxgen, dsb.) yang siap dipakai untuk membangun artefak jaringan.
- **chaincode/pelaporan/** – contoh chaincode Node.js untuk skenario pencatatan digital lengkap dengan `package.json` dan data contoh.
- **config/** – kumpulan berkas konfigurasi (`configtx.yaml`, `core.yaml`, `orderer.yaml`) yang menjadi acuan saat menghasilkan genesis block maupun profil kanal.
- **env.sh** – skrip utilitas untuk menambahkan `bin/` ke `PATH`, menetapkan `FABRIC_CFG_PATH`, serta nama proyek `docker-compose` yang konsisten.
- **network/** – adaptasi skrip `test-network` Fabric 3 yang menangani pembuatan sertifikat, penyusunan channel, deployment chaincode, dan monitoring.

## Persiapan Lingkungan
1. Masuk ke direktori akar paket dan muat variabel lingkungan:
   ```bash
   cd fabric-3/raft-variant
   source env.sh
   ```
2. Pastikan Docker (atau Podman) aktif karena skrip `network.sh` memanfaatkan container untuk seluruh komponen jaringan.
3. Jika diperlukan, sesuaikan parameter default di `network/network.config` (misalnya jalur chaincode, nama channel, atau bahasa chaincode). Secara bawaan nama channel sudah diganti menjadi `fabric3-channel-variant`.

## Menjalankan Jaringan RAFT
1. Nyalakan jaringan dasar dua organisasi dengan satu peer per organisasi dan tiga orderer RAFT. Seluruh container, volume, dan network akan menggunakan sufiks `.fabric3.variant` atau `fabric3_raft_variant_net` sehingga tidak berbenturan dengan paket `raft-standard`:
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

## Pemetaan Port Host

Untuk menghindari tabrakan dengan paket `raft-standard`, beberapa port container dipetakan ulang ke host sebagai berikut:

- Orderer utama: `8255->8055`, admin `8253->8053`, operasi `9743->9543`.
- Peer Org1: `7353->7153`, operasi `9744->9544`.
- Peer Org2: `9553->9153`, operasi `9745->9545`.
- Layanan CA: Org1 `7354->7054`, Org2 `8354->8054`, Orderer `9354->9054`.
- CouchDB (opsional): Org1 `6384->5984`, Org2 `8384->5984`.
- Stack observabilitas: Prometheus `9190->9090`, Grafana `3100->3000`, cAdvisor `8180->8080`, Node Exporter `9200->9100`.

## Kustomisasi Lanjutan
- Gunakan opsi `-bft` pada `network.sh` jika ingin menguji konsensus BFT yang juga disediakan oleh skrip Fabric 3. Komposisi BFT dalam paket ini sudah memakai port host unik (`8252-8258`, `9255-9259`, `9743-9748`) agar tidak bentrok dengan varian standar.
- File `network.config` menyertakan parameter `CC_SEQUENCE`, `CC_END_POLICY`, serta `CCAAS_DOCKER_RUN` untuk eksperimen lanjutan (misalnya Chaincode-as-a-Service).
- Direktori `prometheus-grafana/` dan skrip pemantauan lain di bawah `network/` dapat diaktifkan untuk observabilitas. Container pemantauan telah diberi nama khusus dan memetakan port host ke `9190`, `3100`, `8180`, dan `9200`.

## Referensi Tambahan
Dokumentasi rinci perintah `network.sh`, dukungan Podman, dan tutorial Chaincode-as-a-Service tersedia di `network/README.md`. Gunakan referensi tersebut untuk memahami seluruh variasi operasi yang disediakan skrip.
