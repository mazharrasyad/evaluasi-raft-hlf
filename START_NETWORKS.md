# 🚀 Cara Menjalankan Blockchain Networks

## ⚠️ MASALAH YANG ANDA ALAMI

Berdasarkan response API:
```json
{
  "status": "incomplete",
  "message": "Material kriptografi tidak lengkap."
}
```

**Artinya:** Network belum pernah di-up, sehingga folder `organizations` (yang berisi certificates) tidak ada!

---

## ✅ SOLUSI: Jalankan Networks

### **Opsi 1: Via Web Interface (RECOMMENDED)** 🌐

1. **Pastikan server gateway berjalan:**
   ```bash
   cd c:\xampp\htdocs\evaluasi-raft-hlf\web
   npm start
   ```

2. **Buka halaman:**
   ```
   http://localhost:5176/penelitian/pelaksanaan-simulasi/menjalankan-network
   ```

3. **Klik tombol "Start Network"** untuk setiap network yang ingin dijalankan:
   - Fabric 2 RAFT Standard
   - Fabric 2 RAFT Variant
   - Fabric 3 RAFT Standard
   - Fabric 3 RAFT Variant

4. **Tunggu sampai proses selesai** (biasanya 2-3 menit per network)

---

### **Opsi 2: Via Command Line** 💻

#### **A. Fabric 2 RAFT Standard**

```bash
cd c:\xampp\htdocs\evaluasi-raft-hlf\fabric-2\raft-standard\network

# Start network & create channel
./network.sh up createChannel -ca -c fabric2-channel-standard

# Deploy chaincode
./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript -c fabric2-channel-standard
```

#### **B. Fabric 2 RAFT Variant**

```bash
cd c:\xampp\htdocs\evaluasi-raft-hlf\fabric-2\raft-variant\network

# Start network & create channel
./network.sh up createChannel -ca -c fabric2-channel-variant

# Deploy chaincode
./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript -c fabric2-channel-variant
```

#### **C. Fabric 3 RAFT Standard**

```bash
cd c:\xampp\htdocs\evaluasi-raft-hlf\fabric-3\raft-standard\network

# Start network & create channel
./network.sh up createChannel -c fabric3-channel-standard

# Deploy chaincode
./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl node -c fabric3-channel-standard
```

#### **D. Fabric 3 RAFT Variant**

```bash
cd c:\xampp\htdocs\evaluasi-raft-hlf\fabric-3\raft-variant\network

# Start network & create channel
./network.sh up createChannel -c fabric3-channel-variant

# Deploy chaincode
./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl node -c fabric3-channel-variant
```

---

## 📋 Checklist Setelah Start Network

Setelah menjalankan network, verify bahwa:

### 1. ✅ Docker Containers Running

```bash
docker ps
```

**Harus ada containers:**
- `peer0.org1.fabric2.standard.com` (jika Fabric 2 Standard)
- `peer0.org1.fabric2.variant.com` (jika Fabric 2 Variant)
- `peer0.org1.fabric3.standard` (jika Fabric 3 Standard)
- `peer0.org1.fabric3.variant` (jika Fabric 3 Variant)
- `orderer...` containers
- `ca...` containers (jika menggunakan -ca)

### 2. ✅ Organizations Folder Ada

```bash
# Fabric 2 Standard
ls c:\xampp\htdocs\evaluasi-raft-hlf\fabric-2\raft-standard\network\organizations

# Fabric 2 Variant
ls c:\xampp\htdocs\evaluasi-raft-hlf\fabric-2\raft-variant\network\organizations

# dst...
```

**Harus ada subfolder:**
- `ordererOrganizations`
- `peerOrganizations`

### 3. ✅ Certificates Ada

```bash
# Check certificates (contoh Fabric 2 Standard)
ls c:\xampp\htdocs\evaluasi-raft-hlf\fabric-2\raft-standard\network\organizations\peerOrganizations\org1.standard.com\users\User1@org1.standard.com\msp\signcerts

# Harus ada file .pem
```

### 4. ✅ Server Gateway Dapat Connect

**Test endpoint:**
```
http://localhost:5176/api/check-network
```

**Response yang diharapkan:**
```json
{
  "results": [
    {
      "status": "healthy",
      "label": "Fabric 2 RAFT Standard",
      ...
    }
  ]
}
```

---

## 🐛 Troubleshooting

### Error: "docker command not found"

**Windows:**
1. Install Docker Desktop
2. Restart terminal setelah install
3. Verify: `docker --version`

### Error: "network.sh: Permission denied"

**Git Bash (Windows):**
```bash
chmod +x network.sh
```

### Error: Network already running

**Shutdown dulu:**
```bash
cd c:\xampp\htdocs\evaluasi-raft-hlf\fabric-2\raft-standard\network
./network.sh down
```

Lalu start ulang dengan perintah di atas.

### Error saat Deploy Chaincode

**Check logs:**
```bash
# Lihat logs peer
docker logs peer0.org1.fabric2.standard.com

# Lihat logs orderer
docker logs orderer.fabric2.standard.com
```

---

## 🔄 Restart Network (Jika Ada Masalah)

Jika network bermasalah, coba restart:

```bash
# 1. Stop network
cd c:\xampp\htdocs\evaluasi-raft-hlf\fabric-2\raft-standard\network
./network.sh down

# 2. Clean docker
docker system prune -f

# 3. Start ulang
./network.sh up createChannel -ca -c fabric2-channel-standard
./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript -c fabric2-channel-standard
```

---

## ⏱️ Timeline

- **Start Network:** ~1-2 menit
- **Deploy Chaincode:** ~1 menit
- **Total per network:** ~2-3 menit

Jika ada 4 networks, total waktu: **~8-12 menit**

---

## 📊 Setelah Network Running

### 1. Verify dengan verify-server.js

```bash
cd c:\xampp\htdocs\evaluasi-raft-hlf\web
node verify-server.js
```

**Output sukses:**
```
✅ Server is running!
✅ /api/check-network is working!
   1. ✅ Fabric 2 RAFT Standard - healthy
   2. ✅ Fabric 2 RAFT Variant - healthy
✅ /api/catatan is working!
```

### 2. Input Data Simulasi

```
http://localhost:5176/penelitian/pelaksanaan-simulasi/input-data-simulasi
```

1. Pilih beban (Light/Medium/Heavy)
2. Centang networks yang sudah running
3. Klik "Eksekusi Simulasi"
4. Tunggu sampai selesai

### 3. Lihat Data

```
http://localhost:5176/penelitian/pelaksanaan-simulasi/penyimpanan-data-transaksi
```

**Data akan muncul di tabel per fabric network!** 🎉

---

## 💡 Tips

1. **Jalankan minimal 1 network dulu** untuk testing
2. **Pastikan Docker Desktop running** sebelum start network
3. **Gunakan Git Bash di Windows** untuk jalankan network.sh
4. **Monitor resource** - setiap network butuh ~2GB RAM
5. **Jangan shutdown Docker** saat network sedang running

---

## 🆘 Still Having Issues?

Check:
1. Docker Desktop running
2. Port tidak bentrok (7051, 7052, 7153, 7353)
3. Disk space cukup (~10GB untuk 4 networks)
4. Git Bash installed (untuk Windows)
5. Server gateway running

**Jika masih error, collect logs:**
```bash
docker logs peer0.org1.fabric2.standard.com > peer.log
docker logs orderer.fabric2.standard.com > orderer.log
```

Dan check error message di logs.
