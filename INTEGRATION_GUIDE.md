# Panduan Integrasi Network - Data Blok Simulasi per Fabric

## 📋 Ringkasan

Dokumen ini menjelaskan integrasi antara frontend dan backend untuk menampilkan data blok simulasi per fabric network di halaman **Penyimpanan Data Transaksi**.

## 🔧 Konfigurasi Network

Semua komponen menggunakan **ID network yang konsisten**:

### Network IDs:
1. `channel-standard` → **Fabric 2 RAFT Standard**
2. `channel-variant` → **Fabric 2 RAFT Variant**
3. `channel-fabric3-standard` → **Fabric 3 RAFT Standard**
4. `channel-fabric3-variant` → **Fabric 3 RAFT Variant**

### Mapping Lokasi:

| Network ID | Label | Fabric Version | Channel Name | Peer Endpoint | Network Dir |
|------------|-------|----------------|--------------|---------------|-------------|
| `channel-standard` | Fabric 2 RAFT Standard | fabric-2 | fabric2-channel-standard | localhost:7051 | `fabric-2/raft-standard/network` |
| `channel-variant` | Fabric 2 RAFT Variant | fabric-2 | fabric2-channel-variant | localhost:7052 | `fabric-2/raft-variant/network` |
| `channel-fabric3-standard` | Fabric 3 RAFT Standard | fabric-3 | fabric3-channel-standard | localhost:7153 | `fabric-3/raft-standard/network` |
| `channel-fabric3-variant` | Fabric 3 RAFT Variant | fabric-3 | fabric3-channel-variant | localhost:7353 | `fabric-3/raft-variant/network` |

## 📁 File yang Dimodifikasi

### 1. Backend Files

#### `web/src/network-check.js`
- **Fungsi**: `getAllCatatan()` dan `getAllCatatanFromNetwork()`
- **Endpoint**: Digunakan oleh `/api/catatan`
- **Response Format**:
```json
{
  "fetchedAt": "2025-11-17T...",
  "overallStatus": "healthy",
  "results": [
    {
      "targetId": "channel-standard",
      "label": "Fabric 2 RAFT Standard",
      "networkDir": "/path/to/network",
      "channel": "fabric2-channel-standard",
      "peer": "localhost:7051",
      "timestamp": "2025-11-17T...",
      "status": "healthy",
      "records": [
        {
          "reportId": "RPT-2024-00001",
          "timestamp": "2025-11-17T10:30:00.000Z",
          "substance": "Agraria (Pertanahan dan Tata Ruang)",
          "reporterGroup": "Perorangan",
          "reportedGroup": "Pemerintah Daerah",
          "receivingOffice": "Pusat",
          "description": "...",
          "status": "pending"
        }
      ]
    }
  ]
}
```

#### `web/src/app.js`
- **Endpoint**: `GET /api/catatan` (line 857-884)
- **Fungsi**: Memanggil `getAllCatatan()` dari `network-check.js`

#### `web/src/fabric-gateway.js`
- **Network Config**: Lines 15-60
- **Fungsi**: Mengirim transaksi ke blockchain networks
- **Mapping**: Menggunakan network ID yang sama

### 2. Frontend Files

#### `web/public/js/penyimpanan-data-transaksi.js`
**Perubahan yang Dibuat**:

1. **Network Label Mapping** (Lines 323-329):
```javascript
const submissionNetworkLabels = {
    'channel-standard': 'Fabric 2 RAFT Standard',
    'channel-variant': 'Fabric 2 RAFT Variant',
    'channel-fabric3-standard': 'Fabric 3 RAFT Standard',
    'channel-fabric3-variant': 'Fabric 3 RAFT Variant',
};
```

2. **Enhanced Logging** (Lines 331-346):
- Log API response dari `/api/catatan`
- Log jumlah network yang berhasil diambil
- Log detail setiap network dan jumlah records

3. **Network Table Header** (Lines 355-366):
- Menggunakan label fallback jika label dari API tidak ada
- Format: `networkData.label || submissionNetworkLabels[networkData.targetId] || networkData.targetId`

4. **Debug Console Logs**:
- `📊 API Response /api/catatan`
- `📋 Results`
- `🔍 Total networks fetched`
- `✅ Healthy networks with data`

#### `web/public/js/input-data-simulasi.js`
- **Network Labels**: Lines 99-104
- **Submit Function**: Mengirim ke multiple networks dengan ID yang konsisten

## 🚀 Cara Menjalankan

### 1. Start Server

```bash
cd c:\xampp\htdocs\evaluasi-raft-hlf\web
npm start
```

Server akan berjalan di: `http://localhost:5176`

### 2. Verifikasi Server

Jalankan script verifikasi:

```bash
cd c:\xampp\htdocs\evaluasi-raft-hlf\web
node verify-server.js
```

Output yang diharapkan:
```
✅ Server is running!
✅ /api/check-network is working!
✅ /api/catatan is working!
```

### 3. Akses Aplikasi

1. **Homepage**: http://localhost:5176
2. **Input Data Simulasi**: http://localhost:5176/penelitian/pelaksanaan-simulasi/input-data-simulasi
3. **Penyimpanan Data Transaksi**: http://localhost:5176/penelitian/pelaksanaan-simulasi/penyimpanan-data-transaksi

## 🔍 Flow Data

### Input Data Simulasi → Blockchain:

```
Frontend (input-data-simulasi.js)
  ↓ POST /api/simulations/records
Backend (app.js)
  ↓ submitToNetworks()
Fabric Gateway (fabric-gateway.js)
  ↓ submitTransaction() for each network
Blockchain (Hyperledger Fabric)
  ↓ CreateOrUpdateCatatan
Ledger (menyimpan data per network)
```

### Blockchain → Display Data:

```
Frontend (penyimpanan-data-transaksi.js)
  ↓ GET /api/catatan
Backend (app.js)
  ↓ getAllCatatan()
Network Check (network-check.js)
  ↓ getAllCatatanFromNetwork() for each network
Blockchain (query GetAllCatatan)
  ↓ Return records per network
Frontend
  ↓ Group by targetId
Display (tabel per fabric network)
```

## 🐛 Debugging

### Browser Console

Buka halaman **Penyimpanan Data Transaksi** dan cek console:

1. **API Response**:
```
📊 API Response /api/catatan: {fetchedAt: "...", overallStatus: "...", results: [...]}
```

2. **Network Count**:
```
🔍 Total networks fetched: 4
```

3. **Healthy Networks**:
```
✅ Healthy networks with data: 2
  1. Fabric 2 RAFT Standard - 50 records
  2. Fabric 3 RAFT Standard - 30 records
```

### Server Logs

Check terminal yang menjalankan server:
```bash
Gateway listening on http://0.0.0.0:5176
```

### Common Issues

#### ❌ Server tidak berjalan
**Solusi**:
```bash
cd c:\xampp\htdocs\evaluasi-raft-hlf\web
npm start
```

#### ❌ No data displayed
**Kemungkinan**:
1. Network belum berjalan → Jalankan network di halaman "Menjalankan Network"
2. Belum ada data → Input data di halaman "Input Data Simulasi"
3. Network unhealthy → Restart network atau check logs

#### ❌ Connection Error
**Check**:
1. Port konflik (5176 sudah digunakan)
2. Blockchain network tidak running
3. Credential/certificates tidak tersedia

## 📊 Data Structure

### Record Schema:
```javascript
{
  reportId: "RPT-2024-00001",        // Unique ID
  timestamp: "2025-11-17T10:30:00Z", // ISO 8601
  substance: "Agraria (...)",         // Category
  reporterGroup: "Perorangan",       // Reporter type
  reportedGroup: "Pemerintah Daerah", // Reported entity
  receivingOffice: "Pusat",          // Receiving office
  description: "...",                // Description
  status: "pending"                  // Status: pending/processing/completed
}
```

## ✅ Testing Checklist

- [ ] Server berjalan di port 5176
- [ ] `/api/catatan` returns data
- [ ] Frontend fetch data successfully
- [ ] Data grouped by network (targetId)
- [ ] Each network shows correct label
- [ ] Records displayed in table
- [ ] Modal shows record details
- [ ] Refresh button works
- [ ] Empty state displays correctly
- [ ] Error states handled gracefully

## 📝 Notes

1. **Port**: Server default di **5176**, bukan 3000
2. **Network IDs**: Konsisten di seluruh aplikasi
3. **Status**: `healthy` vs `unhealthy` vs `incomplete`
4. **Records**: Hanya network dengan status `healthy` dan ada records yang ditampilkan
5. **Sorting**: Records diurutkan berdasarkan timestamp descending (terbaru dulu)

## 🔗 Related Files

- `/web/src/app.js` - Express server & API routes
- `/web/src/network-check.js` - Network health & data fetching
- `/web/src/fabric-gateway.js` - Blockchain transaction submission
- `/web/public/js/penyimpanan-data-transaksi.js` - Frontend display logic
- `/web/public/js/input-data-simulasi.js` - Data input logic
- `/web/verify-server.js` - Server verification tool

## 📞 Support

Jika ada masalah, check:
1. Server logs (terminal)
2. Browser console (F12)
3. Network tab (XHR requests)
4. Blockchain network status
