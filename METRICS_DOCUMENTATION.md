# Dokumentasi Sistem Pengumpulan Metrics Simulasi

## Ringkasan

Sistem ini mengumpulkan metrics dari simulasi transaksi blockchain untuk menganalisis performa jaringan Hyperledger Fabric dengan konsensus RAFT. Data yang dikumpulkan meliputi:

1. **Throughput** - Laju transaksi per detik (TPS)
2. **Latency** - Waktu latensi per transaksi (ms)
3. **Resource Usage** - Penggunaan CPU, memori, dan I/O
4. **Fault Tolerance** - Ketahanan terhadap kegagalan node

## Arsitektur

### File Utama

1. **`web/src/metrics-collector.js`**
   - Modul untuk mengumpulkan dan menyimpan metrics
   - Class `SimulationMetrics` untuk struktur data
   - Class `ResourceMonitor` untuk monitoring resource secara periodik
   - Fungsi untuk mengumpulkan stats dari Docker containers

2. **`web/src/app.js`**
   - API endpoints untuk metrics:
     - `POST /api/metrics/simulation/start` - Memulai simulasi baru
     - `POST /api/metrics/simulation/:simulationId/transaction` - Merekam transaksi
     - `POST /api/metrics/simulation/:simulationId/complete` - Menyelesaikan simulasi
     - `GET /api/metrics/simulation/:simulationId` - Mendapatkan metrics simulasi
     - `GET /api/metrics/simulations` - Mendapatkan semua simulasi
     - `GET /api/metrics/resource-usage` - Mendapatkan snapshot resource usage

3. **`web/public/view/penelitian/pelaksanaan-simulasi/pengeksekusian-simulasi-transaksi.html`**
   - Halaman untuk menjalankan simulasi
   - Terintegrasi dengan API metrics untuk tracking otomatis

### Storage

Metrics disimpan dalam format JSONL (JSON Lines) di:
```
web/data/simulation-metrics.jsonl
```

Setiap baris adalah satu simulasi dalam format JSON.

## Struktur Data Metrics

### 1. Throughput

```javascript
{
  totalTransactions: 0,        // Total transaksi yang disubmit
  successfulTransactions: 0,   // Transaksi yang berhasil
  failedTransactions: 0,       // Transaksi yang gagal
  startTimestamp: null,        // Waktu transaksi pertama
  endTimestamp: null,          // Waktu transaksi terakhir
  durationSeconds: 0,          // Durasi total (detik)
  transactionsPerSecond: 0,    // TPS rata-rata
  peakTPS: 0,                  // TPS puncak
  averageTPS: 0,               // TPS rata-rata
  perNetworkTPS: {}            // TPS per network
}
```

**Cara Pengukuran:**
- TPS = Total Transaksi / Durasi (detik)
- Durasi dihitung dari transaksi pertama sampai transaksi terakhir selesai
- TPS dihitung per network dan secara keseluruhan

### 2. Latency

```javascript
{
  transactions: [],            // Array detail transaksi
  averageLatencyMs: 0,         // Latency rata-rata (ms)
  minLatencyMs: 0,             // Latency minimum (ms)
  maxLatencyMs: 0,             // Latency maksimum (ms)
  p50LatencyMs: 0,             // Median latency (ms)
  p95LatencyMs: 0,             // Percentile 95 (ms)
  p99LatencyMs: 0,             // Percentile 99 (ms)
  perNetworkLatency: {}        // Latency rata-rata per network
}
```

**Cara Pengukuran:**
- Latency = waktu `completedAt` - waktu `submittedAt`
- Dihitung untuk setiap transaksi individual
- Statistik dihitung dari semua transaksi yang berhasil

**Detail Transaksi:**
```javascript
{
  txId: "RPT-2025-00001",
  networkId: "channel-standard",
  submittedAt: "2025-01-21T10:30:00.000Z",
  completedAt: "2025-01-21T10:30:02.150Z",
  latencyMs: 2150,
  success: true
}
```

### 3. Resource Usage

```javascript
{
  snapshots: [],               // Array snapshot resource
  orderers: [],                // Resource usage orderer nodes
  peers: [],                   // Resource usage peer nodes
  averageCPU: 0,               // CPU rata-rata (%)
  averageMemory: 0,            // Memory rata-rata (MB)
  peakCPU: 0,                  // CPU puncak (%)
  peakMemory: 0,               // Memory puncak (MB)
  averageIO: 0                 // I/O rata-rata (MB/s)
}
```

**Cara Pengukuran:**
- Resource monitoring berjalan setiap 5 detik selama simulasi
- Menggunakan `docker stats` untuk mengambil data dari containers
- Data diambil untuk semua orderer dan peer nodes yang aktif

**Format Snapshot:**
```javascript
{
  timestamp: "2025-01-21T10:30:00.000Z",
  cpuPercent: 45.2,
  memoryMB: 512.5,
  ioMBps: 2.3,
  orderers: [
    {
      containerName: "orderer.fabric2.standard.com",
      cpuPercent: 42.1,
      memoryMB: 256.2,
      ioMBps: 1.1,
      timestamp: "2025-01-21T10:30:00.000Z"
    }
  ],
  peers: [
    {
      containerName: "peer0.org1.fabric2.standard.com",
      cpuPercent: 48.3,
      memoryMB: 256.3,
      ioMBps: 1.2,
      timestamp: "2025-01-21T10:30:00.000Z"
    }
  ]
}
```

### 4. Fault Tolerance

```javascript
{
  nodeFailures: [],            // Array kegagalan node
  recoveryTimes: [],           // Array waktu pemulihan (ms)
  averageRecoveryTimeMs: 0,    // Waktu pemulihan rata-rata
  dataConsistencyChecks: [],   // Array hasil consistency check
  transactionsDuringFailure: 0,// Transaksi saat terjadi kegagalan
  successRateDuringFailure: 0  // Success rate saat kegagalan
}
```

**Format Node Failure:**
```javascript
{
  nodeId: "orderer2.fabric2.standard.com",
  failedAt: "2025-01-21T10:35:00.000Z",
  recoveredAt: "2025-01-21T10:35:45.000Z",
  impactedTransactions: 15,
  recoveryTimeMs: 45000
}
```

## Cara Penggunaan

### 1. Menjalankan Simulasi dengan Metrics

Simulasi akan otomatis mengumpulkan metrics ketika Anda menjalankan transaksi di halaman **Pengeksekusian Simulasi Transaksi**.

**Langkah-langkah:**

1. Buka halaman `/penelitian/pelaksanaan-simulasi/pengeksekusian-simulasi-transaksi`
2. Pilih kategori beban (Ringan/Sedang/Tinggi)
3. Masukkan jumlah transaksi
4. Klik "Generate Data"
5. Pilih network target
6. Klik "Submit ke Network Terpilih"
7. Metrics akan otomatis dikumpulkan dan ditampilkan setelah selesai

### 2. Mengakses Metrics via API

#### a. Mendapatkan Metrics Simulasi Tertentu

```bash
GET /api/metrics/simulation/:simulationId
```

**Response:**
```json
{
  "fetchedAt": "2025-01-21T10:40:00.000Z",
  "success": true,
  "simulationId": "abc-123-def-456",
  "status": "completed",
  "metrics": {
    "simulationId": "abc-123-def-456",
    "startTime": "2025-01-21T10:30:00.000Z",
    "endTime": "2025-01-21T10:35:00.000Z",
    "config": {
      "loadCategory": "medium",
      "totalTransactions": 1000,
      "targetNetworks": ["channel-standard", "channel-variant"]
    },
    "throughput": { /* ... */ },
    "latency": { /* ... */ },
    "resourceUsage": { /* ... */ },
    "faultTolerance": { /* ... */ }
  }
}
```

#### b. Mendapatkan Semua Simulasi

```bash
GET /api/metrics/simulations
```

**Response:**
```json
{
  "fetchedAt": "2025-01-21T10:40:00.000Z",
  "success": true,
  "count": 5,
  "simulations": [
    { /* simulasi 1 */ },
    { /* simulasi 2 */ },
    // ...
  ]
}
```

#### c. Mendapatkan Resource Usage Saat Ini

```bash
GET /api/metrics/resource-usage?networks=channel-standard,channel-variant
```

**Response:**
```json
{
  "fetchedAt": "2025-01-21T10:40:00.000Z",
  "success": true,
  "snapshot": {
    "timestamp": "2025-01-21T10:40:00.000Z",
    "cpuPercent": 45.2,
    "memoryMB": 1024.5,
    "ioMBps": 5.3,
    "orderers": [ /* ... */ ],
    "peers": [ /* ... */ ]
  }
}
```

### 3. Menggunakan Programmatically

```javascript
// Import modules
import {
    SimulationMetrics,
    saveMetrics,
    getMetricsBySimulationId,
    ResourceMonitor
} from './metrics-collector.js';

// 1. Mulai simulasi baru
const metrics = new SimulationMetrics('my-simulation-id', {
    loadCategory: 'medium',
    totalTransactions: 1000,
    targetNetworks: ['channel-standard']
});

// 2. Start resource monitoring
const monitor = new ResourceMonitor(metrics, ['channel-standard'], 5000);
await monitor.start();

// 3. Rekam transaksi
metrics.addTransaction({
    txId: 'RPT-2025-00001',
    networkId: 'channel-standard',
    submittedAt: '2025-01-21T10:30:00.000Z',
    completedAt: '2025-01-21T10:30:02.150Z',
    success: true
});

// 4. Selesaikan simulasi
monitor.stop();
metrics.complete();

// 5. Simpan ke file
await saveMetrics(metrics);

// 6. Baca kembali
const saved = await getMetricsBySimulationId('my-simulation-id');
console.log(saved);
```

## Visualisasi Data

Data metrics yang dikumpulkan dapat divisualisasikan di halaman:

- **Halaman 4.5 - Pengolahan Data**
  - Grafik Throughput (TPS vs Waktu)
  - Grafik Latency (Histogram, Percentiles)
  - Grafik Resource Usage (CPU, Memory, I/O)
  - Analisis Fault Tolerance

## Contoh Grafik yang Dapat Dibuat

### 1. Grafik Throughput
- **X-axis:** Waktu (detik)
- **Y-axis:** Transaksi per detik (TPS)
- **Data:** `metrics.throughput.transactionsPerSecond`
- **Per Network:** `metrics.throughput.perNetworkTPS`

### 2. Grafik Latency Distribution
- **Histogram:**
  - X-axis: Latency range (ms)
  - Y-axis: Frekuensi
  - Data: `metrics.latency.transactions`

- **Box Plot:**
  - Min, P25, P50 (median), P75, Max
  - Data: `metrics.latency.minLatencyMs`, `p50LatencyMs`, dll.

### 3. Grafik Resource Usage
- **Line Chart:**
  - X-axis: Waktu
  - Y-axis: CPU/Memory/IO
  - Data: `metrics.resourceUsage.snapshots`

- **Stacked Area Chart:**
  - Per orderer dan peer
  - Data: `metrics.resourceUsage.orderers`, `peers`

### 4. Fault Tolerance Analysis
- **Timeline:**
  - Node failures dan recoveries
  - Data: `metrics.faultTolerance.nodeFailures`

- **Bar Chart:**
  - Recovery times per node
  - Data: `metrics.faultTolerance.recoveryTimes`

## Troubleshooting

### Metrics tidak tercatat

**Penyebab:**
- Simulasi ID tidak valid
- API endpoint tidak dapat diakses

**Solusi:**
- Periksa console browser untuk error messages
- Pastikan server web berjalan
- Periksa network tab di developer tools

### Resource monitoring tidak berjalan

**Penyebab:**
- Docker tidak tersedia
- Container tidak berjalan
- Permissions issue

**Solusi:**
```bash
# Periksa Docker
docker ps

# Periksa permissions
docker stats --no-stream

# Pastikan containers berjalan
docker ps | grep orderer
docker ps | grep peer
```

### Data tidak tersimpan

**Penyebab:**
- Directory `web/data` tidak ada
- Permission issue

**Solusi:**
```bash
# Buat directory
mkdir -p web/data

# Periksa permissions
ls -la web/data
chmod 755 web/data
```

## Lokasi File Data

- **Metrics:** `web/data/simulation-metrics.jsonl`
- **Format:** JSONL (satu JSON object per baris)
- **Encoding:** UTF-8

## Best Practices

1. **Jalankan monitoring resource** sebelum memulai simulasi untuk baseline
2. **Tunggu beberapa detik** setelah simulasi sebelum stop monitoring untuk capture data lengkap
3. **Gunakan simulationId yang unik** untuk setiap run
4. **Backup data metrics** secara berkala
5. **Monitor disk space** karena metrics dapat menghasilkan data besar untuk simulasi besar

## Referensi Parameter

### Load Category

| Kategori | Transaksi | Target TPS | Use Case |
|----------|-----------|------------|----------|
| Ringan   | 100-500   | 10-20 TPS  | Testing dasar, development |
| Sedang   | 1000-3000 | 50-100 TPS | Production normal load |
| Tinggi   | 5000-10000| 200-500 TPS| Stress testing, peak load |

### Network IDs

| Display Name        | Network ID               | Port  |
|---------------------|--------------------------|-------|
| Fabric 2 Standard   | channel-standard         | 7051  |
| Fabric 2 Variant    | channel-variant          | 7052  |
| Fabric 3 Standard   | channel-fabric3-standard | 7153  |
| Fabric 3 Variant    | channel-fabric3-variant  | 7353  |

## Kontak

Untuk pertanyaan atau issues terkait metrics collection, silakan hubungi tim development atau buat issue di repository.
