# 🔧 Troubleshooting Guide - Data Tidak Muncul di Tabel

## ❌ Problem: Data Blok Tidak Muncul di Halaman Penyimpanan Data Transaksi

Jika Anda sudah menginput data tapi tabel tidak menampilkan apa-apa, ikuti langkah troubleshooting berikut:

---

## 📋 Checklist Dasar

### 1. ✅ Pastikan Server Gateway Berjalan

**Cek apakah server sudah running:**
```bash
# Windows Command Prompt
netstat -ano | findstr :5176
```

**Output yang diharapkan:**
```
TCP    0.0.0.0:5176     0.0.0.0:0     LISTENING     12345
```

**Jika tidak ada output** = Server TIDAK berjalan!

**Solusi - Jalankan Server:**
```bash
cd c:\xampp\htdocs\evaluasi-raft-hlf\web
npm start
```

**Server akan menampilkan:**
```
Gateway listening on http://0.0.0.0:5176
```

---

### 2. ✅ Test Endpoint /api/catatan

**Buka browser dan akses:**
```
http://localhost:5176/api/catatan
```

**Response yang diharapkan:**
```json
{
  "fetchedAt": "2025-11-17T...",
  "overallStatus": "healthy",
  "results": [
    {
      "targetId": "channel-standard",
      "label": "Fabric 2 RAFT Standard",
      "status": "healthy",
      "records": [
        {
          "reportId": "RPT-2024-00001",
          "timestamp": "...",
          "substance": "...",
          ...
        }
      ]
    }
  ]
}
```

**Jika muncul error atau blank:**
- Server tidak berjalan → Kembali ke langkah 1
- Network tidak berjalan → Lanjut ke langkah 3

---

### 3. ✅ Pastikan Blockchain Network Berjalan

**Cek container Docker yang berjalan:**
```bash
docker ps
```

**Harus ada container dengan nama:**
- `peer0.org1.fabric2.standard.com`
- `peer0.org1.fabric2.variant.com`
- `peer0.org1.fabric3.standard`
- `peer0.org1.fabric3.variant`
- `orderer`, `ca`, dll

**Jika tidak ada container:**

1. **Jalankan network** melalui halaman web:
   - Buka: http://localhost:5176/penelitian/pelaksanaan-simulasi/menjalankan-network
   - Klik tombol "Start Network" untuk network yang diinginkan

2. **ATAU jalankan manual via terminal:**
   ```bash
   # Fabric 2 Standard
   cd c:\xampp\htdocs\evaluasi-raft-hlf\fabric-2\raft-standard\network
   ./network.sh up createChannel -ca -c fabric2-channel-standard
   ./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript -c fabric2-channel-standard
   ```

---

### 4. ✅ Pastikan Ada Data di Blockchain

**Cek browser console (F12 → Console tab):**

Buka halaman:
```
http://localhost:5176/penelitian/pelaksanaan-simulasi/penyimpanan-data-transaksi
```

**Console log yang diharapkan:**
```
📊 API Response /api/catatan: {fetchedAt: "...", results: [...]}
📋 Results: Array(4)
🔍 Total networks fetched: 4
📋 All networks status:
  1. [healthy] Fabric 2 RAFT Standard
     - Has records: Yes
     - Record count: 50
  2. [healthy] Fabric 2 RAFT Variant
     - Has records: Yes
     - Record count: 30
  ...
📦 Networks with records (any status): 2
✅ Healthy networks with data: 2
  1. Fabric 2 RAFT Standard - 50 records
  2. Fabric 2 RAFT Variant - 30 records
```

**Jika "Record count: 0"** → Belum ada data, lanjut ke langkah 5

---

### 5. ✅ Input Data Simulasi

**Jika belum ada data:**

1. Buka halaman input data:
   ```
   http://localhost:5176/penelitian/pelaksanaan-simulasi/input-data-simulasi
   ```

2. Pilih beban simulasi (Light/Medium/Heavy)

3. Centang network yang ingin menerima data

4. Klik "Eksekusi Simulasi"

5. Tunggu sampai proses selesai

6. Refresh halaman Penyimpanan Data Transaksi

---

## 🐛 Advanced Debugging

### A. Network Status "unhealthy" tapi ada data

**Console log menunjukkan:**
```
📦 Networks with records (any status): 2
✅ Healthy networks with data: 0
⚠️  Found networks with records but not healthy. Showing anyway for debugging.
```

**Penjelasan:**
- Network pernah berjalan dan menerima data
- Tapi sekarang network sedang offline
- **Data tetap akan ditampilkan** untuk debugging

**Solusi:**
- Data akan tetap muncul di tabel
- Untuk membuat network "healthy" lagi, restart network

---

### B. CORS Error di Browser Console

**Error:**
```
Access to fetch at 'http://localhost:5176/api/catatan' from origin 'null' has been blocked by CORS policy
```

**Penyebab:**
- Membuka file HTML langsung (file:///)
- Bukan melalui server (http://localhost:5176)

**Solusi:**
- SELALU akses melalui: `http://localhost:5176/...`
- JANGAN buka file HTML langsung dari explorer

---

### C. Empty Array di Response

**Response:**
```json
{
  "results": []
}
```

**Kemungkinan penyebab:**
1. Network belum pernah berjalan
2. File crypto/certificates tidak ada
3. Path network salah di konfigurasi

**Solusi:**
```bash
# Cek apakah folder network ada
ls c:\xampp\htdocs\evaluasi-raft-hlf\fabric-2\raft-standard\network

# Cek apakah folder organizations ada
ls c:\xampp\htdocs\evaluasi-raft-hlf\fabric-2\raft-standard\network\organizations
```

Jika folder tidak ada → Jalankan network dulu (langkah 3)

---

### D. Status "incomplete"

**Response:**
```json
{
  "status": "incomplete",
  "message": "Material kriptografi tidak lengkap."
}
```

**Penyebab:**
- Network pernah dijalankan tapi tidak sempurna
- Certificates/keys hilang atau corrupt

**Solusi:**
```bash
# Shutdown network
cd c:\xampp\htdocs\evaluasi-raft-hlf\fabric-2\raft-standard\network
./network.sh down

# Re-up network
./network.sh up createChannel -ca -c fabric2-channel-standard
./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript -c fabric2-channel-standard
```

---

## 🔍 Step-by-Step Verification

### Quick Test Script

Jalankan script verifikasi yang sudah disediakan:

```bash
cd c:\xampp\htdocs\evaluasi-raft-hlf\web
node verify-server.js
```

**Output Success:**
```
✅ Server is running!
✅ /api/check-network is working!
   Found 4 network(s):
   1. ✅ Fabric 2 RAFT Standard (channel-standard) - healthy
      Block Height: 57
   2. ✅ Fabric 2 RAFT Variant (channel-variant) - healthy
      Block Height: 37
✅ /api/catatan is working!
   Found 4 network(s):
   1. ✅ Fabric 2 RAFT Standard (channel-standard)
      Status: healthy
      Records: 50
      Sample Record:
        - Report ID: RPT-2024-00001
        - Substance: Agraria (Pertanahan dan Tata Ruang)
        - Status: pending
   2. ✅ Fabric 2 RAFT Variant (channel-variant)
      Status: healthy
      Records: 30

   📊 Total Records Across All Networks: 80

✅ All checks passed! Server is ready.
```

---

## 📊 Common Scenarios

### Scenario 1: Pertama Kali Setup

**Langkah:**
1. ✅ Jalankan server gateway
2. ✅ Jalankan minimal 1 network
3. ✅ Input data simulasi
4. ✅ Buka halaman penyimpanan data transaksi
5. ✅ Data muncul di tabel

---

### Scenario 2: Setelah Restart Komputer

**Yang perlu dijalankan ulang:**
1. ✅ Docker Desktop (jika mati)
2. ✅ Blockchain networks
3. ✅ Server gateway

**Catatan:** Data di blockchain **TIDAK HILANG** selama container tidak di-remove

---

### Scenario 3: Network Sudah Berjalan Tapi Data Tidak Muncul

**Debug steps:**

1. **Cek server logs** (terminal yang menjalankan `npm start`):
   ```
   Pastikan tidak ada error saat fetch /api/catatan
   ```

2. **Cek browser console**:
   ```
   Lihat response dari /api/catatan
   Pastikan ada data di array "records"
   ```

3. **Test query langsung ke blockchain**:
   ```bash
   # Masuk ke dalam peer container
   docker exec -it peer0.org1.fabric2.standard.com bash

   # Query chaincode
   peer chaincode query -C fabric2-channel-standard -n pelaporan -c '{"Args":["GetAllCatatan"]}'
   ```

---

## 🆘 Masih Bermasalah?

### Collect Debug Information

```bash
# 1. Cek server status
netstat -ano | findstr :5176

# 2. Cek Docker containers
docker ps

# 3. Test API
curl http://localhost:5176/api/catatan

# 4. Cek logs
# Lihat terminal yang menjalankan npm start
```

### Reset Complete

Jika semua cara di atas tidak berhasil:

```bash
# 1. Stop semua networks
cd c:\xampp\htdocs\evaluasi-raft-hlf\fabric-2\raft-standard\network
./network.sh down

cd c:\xampp\htdocs\evaluasi-raft-hlf\fabric-2\raft-variant\network
./network.sh down

cd c:\xampp\htdocs\evaluasi-raft-hlf\fabric-3\raft-standard\network
./network.sh down

cd c:\xampp\htdocs\evaluasi-raft-hlf\fabric-3\raft-variant\network
./network.sh down

# 2. Clean Docker
docker system prune -a

# 3. Restart dari awal
# Jalankan network → Start server → Input data → Check halaman
```

---

## 📝 Prevention Tips

1. **Selalu cek server running** sebelum akses aplikasi
2. **Jangan shutdown Docker Desktop** saat network sedang running
3. **Gunakan verify-server.js** untuk quick check
4. **Monitor browser console** untuk early detection
5. **Backup data penting** (jika ada) sebelum network down

---

## ✅ Success Indicators

Tanda-tanda sistem berjalan normal:

- ✅ Server listening di port 5176
- ✅ Endpoint /api/catatan return data
- ✅ Browser console tidak ada error
- ✅ Docker containers running
- ✅ Tabel menampilkan data per fabric
- ✅ Modal detail bisa dibuka
- ✅ Refresh button bekerja

---

**Jika masih ada masalah, cek file:**
- `INTEGRATION_GUIDE.md` - Untuk detail integrasi
- `web/logs/network-check.log` - Untuk error logs
- Browser Console (F12) - Untuk frontend errors
