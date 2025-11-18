# Troubleshooting: POST Berhasil Tapi GET Kosong

## 🔍 Problem

Data POST ke API pelaporan berhasil (`success: true`), tapi ketika GET dari API yang sama, data kosong (`count: 0, records: []`).

## ✅ Yang Sudah Benar

Dari response POST Anda:
```json
{
  "completedAt": "2025-11-18T05:37:25.600Z",
  "success": true,
  "networkId": "channel-standard",
  "label": "Fabric 2 RAFT Standard",
  "result": {...}
}
```

POST berhasil! Artinya:
- ✅ Network berjalan
- ✅ Chaincode ter-deploy
- ✅ Data dikirim ke blockchain
- ✅ Transaksi berhasil

## 🐛 Kemungkinan Masalah

### 1. **Logging Tidak Terlihat (Paling Mungkin)**

Dengan logging yang sudah ditambahkan, Anda seharusnya melihat output seperti ini di **console server**:

```
🔍 [Fabric 2 RAFT Standard] Reading ALL transactions from blockchain blocks...
   Network: channel-standard (Fabric 2 RAFT Standard)
   Channel: fabric2-channel-standard
   📦 Block 0: 1 envelopes
      🔧 Function: _lifecycle (3 args)
      ⏭️  Skipping function: _lifecycle
   📦 Block 1: 1 envelopes
      🔧 Function: CreateOrUpdateCatatan (3 args)
      ✅ Found record: RPT-2024-00001

✅ [Fabric 2 RAFT Standard] Successfully retrieved 1 transactions from 2 blocks!
   Total blocks read: 2
   Total envelopes: 2
   Total endorser transactions: 2
   Records found: 1
```

**Jika Anda TIDAK melihat log ini**, server belum direstart dengan kode baru.

### 2. **Server Belum Direstart**

**PENTING**: Setelah commit, server harus direstart untuk memuat kode baru.

```bash
# Stop server (Ctrl+C di terminal server)
# Start server lagi
cd /home/user/evaluasi-raft-hlf/web
npm start
```

### 3. **Melihat Log Server**

Pastikan Anda melihat terminal/console dimana server berjalan. Log akan muncul di sana, BUKAN di browser console.

## 🔧 Langkah-langkah Debug

### Step 1: Restart Web Server

```bash
# Di terminal server
cd /home/user/evaluasi-raft-hlf/web
# Ctrl+C untuk stop
npm start
```

### Step 2: Test POST ke 1 Network Saja

1. Buka halaman **"Pengeksekusian Simulasi Transaksi"**
2. Pilih **HANYA "Fabric 2 RAFT Standard"** (uncheck yang lain)
3. Jumlah transaksi: **2**
4. Klik **"Generate & Submit Simulasi"**
5. Tunggu sampai selesai

### Step 3: Lihat Console Log Server

Di terminal server, Anda HARUS melihat log seperti ini:

```
📝 [Fabric 2 RAFT Standard] Preparing to save simulationData to blockchain block...
   Record ID: RPT-2024-00001
   Network: channel-standard (Fabric 2 RAFT Standard)
   Channel: fabric2-channel-standard
💾 [Fabric 2 RAFT Standard] Submitting transaction to create/update record in blockchain...
✅ [Fabric 2 RAFT Standard] SimulationData successfully saved to blockchain block!
   Status: success
   Record ID: RPT-2024-00001
```

Jika log ini muncul, data **PASTI tersimpan**.

### Step 4: Test GET dari Network yang Sama

1. Buka halaman **"Penyimpanan Data Transaksi"**
2. Di section **"API Monitor & Response"**, lihat response dari **Fabric 2 RAFT Standard**
3. Klik **"Toggle Details"** untuk melihat full JSON response
4. Di console server, lihat log:

```
🔍 [Fabric 2 RAFT Standard] Reading ALL transactions from blockchain blocks...
   📦 Block 0: 1 envelopes
      🔧 Function: _lifecycle (3 args)
      ⏭️  Skipping function: _lifecycle
   📦 Block 1: 1 envelopes
      🔧 Function: CreateOrUpdateCatatan (3 args)
      ✅ Found record: RPT-2024-00001
```

### Step 5: Analisis Log

**Jika log menunjukkan:**

#### Scenario A: Found record tapi response kosong
```
✅ Found record: RPT-2024-00001
Records found: 1
```
Tapi response `count: 0`

**Solusi**: Ada bug di kode parsing. Share log lengkapnya.

#### Scenario B: No records found
```
Records found: 0
```

Kemungkinan:
1. **Block hanya berisi genesis block** → Chaincode tidak ter-deploy
2. **Function bukan CreateOrUpdateCatatan** → Chaincode menggunakan function name berbeda

#### Scenario C: Error reading blocks
```
❌ Failed to query transactions from blocks: ...
```

Network/chaincode issue.

## 🛠️ Quick Fixes

### Fix 1: Verify Chaincode Deployed

```bash
# Cek apakah chaincode 'pelaporan' sudah di-deploy
docker ps | grep peer0

# Harus ada 4 container peer:
# peer0.org1.fabric2.standard.com
# peer0.org1.fabric2.variant.com
# peer0.org1.fabric3.standard
# peer0.org1.fabric3.variant

# Cek chaincode container
docker ps | grep pelaporan

# Harus ada 4 container chaincode pelaporan
```

### Fix 2: Verify Network Running

Di halaman "Menjalankan Network", klik **"Check All Networks"**.

Semua network harus menunjukkan status **"Healthy"**.

### Fix 3: Deploy Chaincode Jika Belum

Jika chaincode belum di-deploy:
1. Buka halaman **"Deploy Chaincode"**
2. Deploy chaincode `pelaporan` ke semua network
3. Tunggu sampai selesai
4. Coba POST dan GET lagi

## 📋 Checklist

Sebelum POST data:
- [ ] Server sudah direstart dengan kode terbaru
- [ ] Semua 4 network sudah berjalan (Check All Networks = Healthy)
- [ ] Chaincode `pelaporan` sudah di-deploy ke semua network
- [ ] Terminal server terlihat dan bisa melihat logs

Setelah POST:
- [ ] Response POST menunjukkan `success: true`
- [ ] Log server menunjukkan "SimulationData successfully saved"
- [ ] Ada validation log "Validation successful - data confirmed"

Setelah GET:
- [ ] Log server menunjukkan "Reading ALL transactions from blockchain blocks"
- [ ] Ada log "Found record: ..."
- [ ] Summary menunjukkan "Records found: > 0"

## 🚨 Jika Masih Bermasalah

**Share informasi berikut:**

1. **Log POST** (dari terminal server saat POST):
   ```
   Copy dari "Preparing to save" sampai "successfully saved"
   ```

2. **Log GET** (dari terminal server saat GET):
   ```
   Copy dari "Reading ALL transactions" sampai "Records found"
   ```

3. **Docker containers**:
   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}"
   ```

4. **Response GET dari API Monitor**:
   ```
   Copy JSON response dari browser
   ```

## 💡 Tips

1. **Selalu gunakan network yang SAMA untuk POST dan GET**
   - POST ke Fabric 2 Standard → GET dari Fabric 2 Standard
   - Jangan POST ke Fabric 2 tapi GET dari Fabric 3

2. **Cek API Monitor di halaman Penyimpanan Data Transaksi**
   - Klik "Toggle API Details"
   - Lihat response JSON lengkap
   - Ada debugging info di sana

3. **Restart server setelah code changes**
   - Kode sudah di-update tapi server perlu restart
   - Ctrl+C → npm start

4. **Lihat console log SERVER, bukan browser**
   - Log muncul di terminal dimana `npm start` dijalankan
   - Bukan di browser DevTools console
