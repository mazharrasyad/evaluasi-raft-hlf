# Quick Start Guide - Pelaporan API Gateway

Panduan cepat untuk menjalankan API Gateway Pelaporan.

## Prerequisites

1. ✅ Node.js 18 atau lebih tinggi
2. ✅ Hyperledger Fabric network sudah running
3. ✅ Chaincode pelaporan sudah di-deploy

## Langkah 1: Install Dependencies

```bash
npm install
```

Atau jika menggunakan dependencies dari web/:

```bash
cd web && npm install && cd ..
```

## Langkah 2: Jalankan API Gateway

### Opsi A: Menggunakan npm script

```bash
npm start
```

### Opsi B: Menggunakan node langsung

```bash
node pelaporan-api.js
```

### Opsi C: Menggunakan shell script

```bash
./run-pelaporan-api.sh
```

### Opsi D: Custom port

```bash
PORT=3200 npm start
# atau
PORT=3200 node pelaporan-api.js
# atau
./run-pelaporan-api.sh 3200
```

## Langkah 3: Test API

### Test 1: Health Check

```bash
curl http://localhost:3100/api/health
```

Expected response:
```json
{
  "error": false,
  "message": "All networks are healthy",
  "data": { ... }
}
```

### Test 2: List Networks

```bash
curl http://localhost:3100/api/networks
```

### Test 3: Get All Records

```bash
curl http://localhost:3100/api/pelaporan?network=fabric-2-standard
```

### Test 4: Create Record

```bash
curl -X POST http://localhost:3100/api/pelaporan?network=fabric-2-standard \
  -H "Content-Type: application/json" \
  -d '{
    "reportId": "TEST-001",
    "substance": "Test Substance",
    "status": "active",
    "description": "Test record from API"
  }'
```

Expected response:
```json
{
  "error": false,
  "message": "Record successfully created in blockchain",
  "network": { ... },
  "total_data": 1,
  "data": { ... }
}
```

### Test 5: Get Record by ID

```bash
curl http://localhost:3100/api/pelaporan/TEST-001?network=fabric-2-standard
```

### Test 6: Get Record Hash

```bash
curl http://localhost:3100/api/pelaporan/TEST-001/hash?network=fabric-2-standard
```

### Test 7: Get Record History

```bash
curl http://localhost:3100/api/pelaporan/TEST-001/history?network=fabric-2-standard
```

### Test 8: Update Record

```bash
curl -X PUT http://localhost:3100/api/pelaporan/TEST-001?network=fabric-2-standard \
  -H "Content-Type: application/json" \
  -d '{
    "substance": "Updated Substance",
    "status": "completed",
    "description": "Updated test record"
  }'
```

### Test 9: Blockchain Info

```bash
curl http://localhost:3100/api/blockchain/info?network=fabric-2-standard
```

### Test 10: Verify Blockchain

```bash
curl http://localhost:3100/api/blockchain/verify-chain?network=fabric-2-standard
```

## Available Networks

| Network Key | Port | Description |
|------------|------|-------------|
| `fabric-2-standard` | 7051 | Fabric 2 RAFT Standard |
| `fabric-2-variant` | 7052 | Fabric 2 RAFT Variant |
| `fabric-3-standard` | 7153 | Fabric 3 RAFT Standard |
| `fabric-3-variant` | 7353 | Fabric 3 RAFT Variant |

## Testing Different Networks

```bash
# Fabric 2 Standard (default)
curl http://localhost:3100/api/pelaporan?network=fabric-2-standard

# Fabric 2 Variant
curl http://localhost:3100/api/pelaporan?network=fabric-2-variant

# Fabric 3 Standard
curl http://localhost:3100/api/pelaporan?network=fabric-3-standard

# Fabric 3 Variant
curl http://localhost:3100/api/pelaporan?network=fabric-3-variant
```

## Complete Test Script

Save this as `test-api.sh`:

```bash
#!/bin/bash

API_URL="http://localhost:3100"
NETWORK="fabric-2-standard"

echo "Testing Pelaporan API Gateway"
echo "=============================="
echo ""

echo "1. Health Check"
curl -s "$API_URL/api/health" | python3 -m json.tool
echo ""

echo "2. List Networks"
curl -s "$API_URL/api/networks" | python3 -m json.tool
echo ""

echo "3. Create Record"
curl -s -X POST "$API_URL/api/pelaporan?network=$NETWORK" \
  -H "Content-Type: application/json" \
  -d '{
    "reportId": "TEST-'$(date +%s)'",
    "substance": "Test Substance",
    "status": "active"
  }' | python3 -m json.tool
echo ""

echo "4. Get All Records"
curl -s "$API_URL/api/pelaporan?network=$NETWORK" | python3 -m json.tool
echo ""

echo "Done!"
```

Make it executable:
```bash
chmod +x test-api.sh
./test-api.sh
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3100
lsof -i :3100

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3200 npm start
```

### Network Connection Error

1. Check if Fabric network is running:
   ```bash
   docker ps
   ```

2. Check peer endpoints:
   ```bash
   netstat -an | grep 7051
   netstat -an | grep 7052
   ```

3. Verify certificates exist:
   ```bash
   ls -la fabric-2/raft-standard/network/organizations/peerOrganizations/
   ```

### Cannot Find Module Error

```bash
# Install dependencies
npm install

# Or use web dependencies
cd web && npm install && cd ..
```

### Empty Response / No Data

1. Make sure chaincode is deployed
2. Try creating a record first (POST)
3. Check server logs for errors

## Environment Variables

```bash
# Custom port
export PORT=3200

# Custom project root (if needed)
export PROJECT_ROOT=/path/to/evaluasi-raft-hlf

# Run API
npm start
```

## Using with Postman

1. Import collection from Postman
2. Set base URL: `http://localhost:3100`
3. Set network parameter in query: `?network=fabric-2-standard`
4. Test all endpoints

## Production Deployment

For production, consider:

1. Use process manager (PM2):
   ```bash
   npm install -g pm2
   pm2 start pelaporan-api.js --name "pelaporan-api"
   pm2 save
   pm2 startup
   ```

2. Use reverse proxy (nginx):
   ```nginx
   location /api/ {
       proxy_pass http://localhost:3100;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
   }
   ```

3. Enable HTTPS
4. Add rate limiting
5. Add authentication/authorization

## Next Steps

1. ✅ API running successfully
2. Read full documentation: `PELAPORAN-API-README.md`
3. Integrate with your application
4. Monitor and maintain

## Support

For issues or questions, refer to:
- Full documentation: `PELAPORAN-API-README.md`
- Project repository
- Issue tracker
