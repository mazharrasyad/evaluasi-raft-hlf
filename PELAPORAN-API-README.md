# API Gateway untuk Data Pelaporan - Hyperledger Fabric

API Gateway standalone untuk mengelola data pelaporan di Hyperledger Fabric dengan dukungan multi-network (Fabric 2 & Fabric 3, RAFT Standard & Variant).

## Fitur Utama

- ✅ CRUD Operations untuk data pelaporan
- ✅ Multi-network support (4 jaringan Fabric)
- ✅ Blockchain information endpoints
- ✅ Hash verification dan chain integrity checks
- ✅ Transaction history tracking
- ✅ Health monitoring
- ✅ CORS enabled
- ✅ RESTful API design

## Prasyarat

Pastikan Anda telah:
1. Menjalankan network Hyperledger Fabric
2. Deploy chaincode pelaporan
3. Install dependencies: `npm install`

## Menjalankan API Gateway

```bash
# Dari root directory project
node pelaporan-api.js

# Atau dengan custom port
PORT=3200 node pelaporan-api.js
```

Default port: **3100**

## Available Networks

API ini mendukung 4 jaringan Fabric:

| Network Key | Network ID | Description |
|------------|------------|-------------|
| `fabric-2-standard` | `channel-standard` | Fabric 2 RAFT Standard |
| `fabric-2-variant` | `channel-variant` | Fabric 2 RAFT Variant |
| `fabric-3-standard` | `channel-fabric3-standard` | Fabric 3 RAFT Standard |
| `fabric-3-variant` | `channel-fabric3-variant` | Fabric 3 RAFT Variant |

**Default network:** `fabric-2-standard` (channel-standard)

## API Endpoints

### 1. Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "error": false,
  "message": "All networks are healthy",
  "data": {
    "status": "healthy",
    "networks": [
      {
        "network": "fabric-2-standard",
        "networkId": "channel-standard",
        "label": "Fabric 2 RAFT Standard",
        "status": "healthy",
        "peerEndpoint": "localhost:7051"
      }
    ],
    "timestamp": "2025-01-18T10:00:00.000Z"
  }
}
```

### 2. List Available Networks

```http
GET /api/networks
```

**Response:**
```json
{
  "error": false,
  "message": "Available networks",
  "total_data": 4,
  "data": [
    {
      "key": "fabric-2-standard",
      "networkId": "channel-standard",
      "label": "Fabric 2 RAFT Standard",
      "channel": "fabric2-channel-standard",
      "chaincode": "pelaporan",
      "fabricVersion": "fabric-2",
      "variant": "raft-standard",
      "peerEndpoint": "localhost:7051"
    }
  ]
}
```

### 3. Blockchain Info

```http
GET /api/blockchain/info?network=fabric-2-standard
```

**Response:**
```json
{
  "error": false,
  "message": "Blockchain info retrieved successfully",
  "data": {
    "network": {
      "networkId": "channel-standard",
      "label": "Fabric 2 RAFT Standard",
      "channelName": "fabric2-channel-standard",
      "chaincodeName": "pelaporan",
      "fabricVersion": "fabric-2",
      "variant": "raft-standard",
      "mspId": "Org1MSP",
      "peerEndpoint": "localhost:7051"
    },
    "blockchain": {
      "currentBlockHash": "abc123...",
      "previousBlockHash": "def456...",
      "genesisHash": "gen789...",
      "blockHeight": 10,
      "transactionCount": 25
    },
    "timestamp": "2025-01-18T10:00:00.000Z"
  }
}
```

### 4. Get All Pelaporan Records

```http
GET /api/pelaporan?network=fabric-2-standard
```

**Response:**
```json
{
  "error": false,
  "message": "success",
  "network": {
    "networkId": "channel-standard",
    "label": "Fabric 2 RAFT Standard",
    "channel": "fabric2-channel-standard"
  },
  "total_data": 2,
  "totalBlocks": 5,
  "source": "blockchain_blocks",
  "data": [
    {
      "id": "REPORT-001",
      "reportId": "REPORT-001",
      "substance": "Sample Substance",
      "status": "active",
      "timestamp": "2025-01-18T10:00:00.000Z",
      "blockchainMetadata": {
        "transactionId": "abc123...",
        "blockNumber": 3,
        "blockTimestamp": "2025-01-18T10:00:00.000Z"
      }
    }
  ]
}
```

### 5. Get Pelaporan by ID

```http
GET /api/pelaporan/:id?network=fabric-2-standard
```

**Example:**
```bash
curl http://localhost:3100/api/pelaporan/REPORT-001?network=fabric-2-standard
```

**Response:**
```json
{
  "error": false,
  "message": "success",
  "network": {
    "networkId": "channel-standard",
    "label": "Fabric 2 RAFT Standard",
    "channel": "fabric2-channel-standard"
  },
  "total_data": 1,
  "data": {
    "id": "REPORT-001",
    "reportId": "REPORT-001",
    "substance": "Sample Substance"
  }
}
```

### 6. Get Pelaporan Hash

```http
GET /api/pelaporan/:id/hash?network=fabric-2-standard
```

**Response:**
```json
{
  "error": false,
  "message": "Record hash retrieved successfully",
  "data": {
    "id": "REPORT-001",
    "currentHash": "abc123def456...",
    "shortHash": "abc123def456",
    "previousHash": "xyz789...",
    "dataSize": 1024,
    "timestamp": "2025-01-18T10:00:00.000Z",
    "blockchain": {
      "networkId": "channel-standard",
      "label": "Fabric 2 RAFT Standard",
      "channelName": "fabric2-channel-standard",
      "chaincodeName": "pelaporan",
      "mspId": "Org1MSP",
      "blockNumber": 3,
      "transactionId": "abc123..."
    }
  }
}
```

### 7. Get Pelaporan History

```http
GET /api/pelaporan/:id/history?network=fabric-2-standard
```

**Response:**
```json
{
  "error": false,
  "message": "Record history retrieved successfully",
  "total_data": 2,
  "data": [
    {
      "txId": "abc123...",
      "timestamp": "2025-01-18T09:00:00.000Z",
      "action": "CREATE",
      "blockNumber": 2,
      "value": { /* record data */ },
      "hash": "def456..."
    },
    {
      "txId": "xyz789...",
      "timestamp": "2025-01-18T10:00:00.000Z",
      "action": "UPDATE",
      "blockNumber": 5,
      "value": { /* updated record data */ },
      "hash": "ghi012..."
    }
  ]
}
```

### 8. Create Pelaporan Record

```http
POST /api/pelaporan?network=fabric-2-standard
Content-Type: application/json

{
  "reportId": "REPORT-001",
  "substance": "Test Substance",
  "status": "active",
  "additionalData": "..."
}
```

**Response:**
```json
{
  "error": false,
  "message": "Record successfully created in blockchain",
  "network": {
    "networkId": "channel-standard",
    "label": "Fabric 2 RAFT Standard",
    "channel": "fabric2-channel-standard"
  },
  "total_data": 1,
  "data": {
    "reportId": "REPORT-001",
    "substance": "Test Substance",
    "blockchainMetadata": {
      "networkId": "channel-standard",
      "label": "Fabric 2 RAFT Standard",
      "channel": "fabric2-channel-standard",
      "submittedAt": "2025-01-18T10:00:00.000Z",
      "completedAt": "2025-01-18T10:00:05.000Z"
    }
  }
}
```

### 9. Update Pelaporan Record

```http
PUT /api/pelaporan/:id?network=fabric-2-standard
Content-Type: application/json

{
  "substance": "Updated Substance",
  "status": "updated"
}
```

**Response:**
```json
{
  "error": false,
  "message": "Record successfully updated in blockchain",
  "network": {
    "networkId": "channel-standard",
    "label": "Fabric 2 RAFT Standard",
    "channel": "fabric2-channel-standard"
  },
  "total_data": 1,
  "data": {
    "id": "REPORT-001",
    "reportId": "REPORT-001",
    "substance": "Updated Substance",
    "status": "updated",
    "updatedAt": "2025-01-18T11:00:00.000Z"
  }
}
```

### 10. Verify Blockchain Chain

```http
GET /api/blockchain/verify-chain?network=fabric-2-standard
```

**Response:**
```json
{
  "error": false,
  "message": "Hash chain is valid",
  "data": {
    "chainStatus": "VALID",
    "totalBlocks": 10,
    "tamperedBlocks": 0,
    "blocks": [
      {
        "blockNumber": 1,
        "currentHash": "abc123...",
        "previousHash": "gen000...",
        "transactionId": "tx001...",
        "isValid": true,
        "status": "✅ VALID"
      }
    ]
  }
}
```

### 11. Fix Blockchain Chain

```http
POST /api/blockchain/fix-chain?network=fabric-2-standard
```

**Response:**
```json
{
  "error": false,
  "message": "Hash chain has been fixed - All blocks are now valid",
  "data": {
    "chainStatus": "FIXED",
    "totalBlocks": 10,
    "fixedBlocks": 10,
    "blocks": [
      {
        "blockNumber": 1,
        "currentHash": "abc123...",
        "previousHash": "gen000...",
        "transactionId": "tx001...",
        "isValid": true,
        "status": "🔧 FIXED"
      }
    ]
  }
}
```

## Usage Examples

### Using cURL

```bash
# Health check
curl http://localhost:3100/api/health

# List networks
curl http://localhost:3100/api/networks

# Get all records from Fabric 2 Standard
curl http://localhost:3100/api/pelaporan?network=fabric-2-standard

# Get specific record
curl http://localhost:3100/api/pelaporan/REPORT-001?network=fabric-2-standard

# Create new record
curl -X POST http://localhost:3100/api/pelaporan?network=fabric-2-standard \
  -H "Content-Type: application/json" \
  -d '{
    "reportId": "REPORT-001",
    "substance": "Test Substance",
    "status": "active"
  }'

# Update record
curl -X PUT http://localhost:3100/api/pelaporan/REPORT-001?network=fabric-2-standard \
  -H "Content-Type: application/json" \
  -d '{
    "substance": "Updated Substance",
    "status": "completed"
  }'

# Get blockchain info
curl http://localhost:3100/api/blockchain/info?network=fabric-2-standard

# Verify blockchain
curl http://localhost:3100/api/blockchain/verify-chain?network=fabric-2-standard
```

### Using JavaScript/Fetch

```javascript
// Get all records
fetch('http://localhost:3100/api/pelaporan?network=fabric-2-standard')
  .then(res => res.json())
  .then(data => console.log(data));

// Create record
fetch('http://localhost:3100/api/pelaporan?network=fabric-2-standard', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reportId: 'REPORT-001',
    substance: 'Test Substance',
    status: 'active'
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

## Query Parameters

Semua endpoint mendukung query parameter `network` untuk memilih jaringan:

```
?network=fabric-2-standard
?network=fabric-2-variant
?network=fabric-3-standard
?network=fabric-3-variant
```

Jika tidak disediakan, akan menggunakan **fabric-2-standard** sebagai default.

## Error Handling

Semua error response menggunakan format konsisten:

```json
{
  "error": true,
  "message": "Error description",
  "total_data": 0,
  "data": null
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (invalid input)
- `404` - Not Found (record not found)
- `500` - Internal Server Error
- `503` - Service Unavailable (network unhealthy)

## Architecture

```
┌─────────────────┐
│   Client App    │
└────────┬────────┘
         │
         │ HTTP/REST
         │
┌────────▼────────────────────┐
│   Pelaporan API Gateway     │
│   (pelaporan-api.js)        │
│                             │
│  - Express Server           │
│  - CORS enabled             │
│  - Multi-network routing    │
└────────┬────────────────────┘
         │
         │ Uses
         │
┌────────▼────────────────────┐
│   Fabric Gateway Module     │
│   (fabric-gateway.js)       │
│                             │
│  - submitTransaction()      │
│  - queryRecords()           │
│  - queryAllTransactions()   │
└────────┬────────────────────┘
         │
         │ gRPC
         │
┌────────▼────────────────────┐
│   Hyperledger Fabric        │
│   - Fabric 2 Standard       │
│   - Fabric 2 Variant        │
│   - Fabric 3 Standard       │
│   - Fabric 3 Variant        │
│                             │
│   Chaincode: pelaporan      │
└─────────────────────────────┘
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3100
lsof -i :3100

# Or use different port
PORT=3200 node pelaporan-api.js
```

### Network Connection Errors

1. Pastikan network Fabric sudah running
2. Periksa konfigurasi di `web/src/fabric-gateway.js`
3. Cek file sertifikat dan key di direktori network

### Empty Data Response

1. Pastikan chaincode sudah di-deploy
2. Pastikan ada data di blockchain (coba POST terlebih dahulu)
3. Cek logs server untuk error details

## Development

### Adding New Endpoints

Edit `pelaporan-api.js` dan tambahkan endpoint baru:

```javascript
app.get('/api/custom-endpoint', async (req, res) => {
  try {
    const networkId = getNetworkId(req);
    // Your logic here
    res.json({
      error: false,
      message: "Success",
      data: result
    });
  } catch (err) {
    res.status(500).json({
      error: true,
      message: err.message,
      data: null
    });
  }
});
```

### Adding New Networks

Edit NETWORKS constant:

```javascript
const NETWORKS = {
  'fabric-2-standard': 'channel-standard',
  'fabric-2-variant': 'channel-variant',
  'fabric-3-standard': 'channel-fabric3-standard',
  'fabric-3-variant': 'channel-fabric3-variant',
  'my-new-network': 'channel-my-network' // Add here
};
```

## License

Sesuai dengan lisensi project evaluasi-raft-hlf.

## Support

Untuk pertanyaan atau issue, silakan buat issue di repository project.
