# Menjalankan Hyperledger Fabric di Windows

## Prerequisites

1. **Docker Desktop for Windows**
   - Download: https://www.docker.com/products/docker-desktop/
   - Pastikan WSL 2 backend enabled
   - Alokasikan minimal **4GB RAM** untuk Docker (Settings > Resources)
   - Aktifkan: Settings > General > **Expose daemon on tcp://localhost:2375 without TLS**

2. **Git for Windows** (dibutuhkan oleh PowerShell script)
   - Download: https://git-scm.com/download/win
   - Pastikan lokasi Git Bash ada (contoh: `C:\\Program Files\\Git\\bin\\bash.exe` atau `D:\\Git\\bin\\bash.exe`)

3. **Node.js** (untuk web application)
   - Download: https://nodejs.org/

4. **jq** (wajib, untuk parsing config channel)
   - Install via PowerShell:
     - `choco install jq`
     - atau `winget install jqlang.jq`

## Quick Start

### Cara 1: PowerShell

```powershell
Set-ExecutionPolicy -Scope Process Bypass
cd D:\laragon\www\evaluasi-raft-hlf
.\start-network.ps1
```

## Stop Network

```powershell
Set-ExecutionPolicy -Scope Process Bypass
cd D:\laragon\www\evaluasi-raft-hlf
.\stop-network.ps1
```

## Network Endpoints

| Network   | Component    | Port  |
|-----------|-------------|-------|
| RAFT      | Peer Org1   | 7153  |
| RAFT      | Peer Org2   | 9153  |
| RAFT      | Orderer     | 8055  |
| SmartBFT  | Peer Org1   | 7353  |
| SmartBFT  | Peer Org2   | 9553  |
| SmartBFT  | Orderer     | 8255  |

## Menjalankan Web Application

Setelah network berjalan:

```bash
cd web
npm install
npm start
```

Buka browser: http://localhost:3000

## Troubleshooting

### Error: "Cannot connect to Docker daemon"
- Pastikan Docker Desktop sudah running
- Restart Docker Desktop

### Error: "execvpe(/bin/bash) failed: No such file or directory"
- Instal Git for Windows (Git Bash) dan pastikan terdeteksi

### Error: "jq: command not found" di Git Bash
- Tutup PowerShell, buka ulang (PATH baru kadang belum terbaca)
- Pastikan `jq` terdeteksi di PowerShell: `jq --version`
- Jika masih gagal, reinstall jq lalu coba ulang

### Error: "dial tcp host.docker.internal:2375: connect: connection refused"
- Aktifkan "Expose daemon on tcp://localhost:2375 without TLS" di Docker Desktop
- Restart Docker Desktop, lalu jalankan ulang script

### Error: "could not build chaincode: ... cannot connect to Docker endpoint"
- Biasanya Docker TCP 2375 belum aktif. Aktifkan opsi di atas dan restart Docker Desktop

### Error: "Port already in use"
```bash
# Stop semua container
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
```

### Error: Network startup sangat lambat
- Tingkatkan RAM Docker (Settings > Resources > Memory)
- Minimal 4GB, recommended 6GB+

### Reset semua
```bash
# Di Git Bash
cd /d/laragon/www/evaluasi-raft-hlf/raft/network
./network.sh down

cd /d/laragon/www/evaluasi-raft-hlf/smartbft/network  
./network.sh down

docker system prune -af
docker volume prune -f
```

## Deploy ke VPS

Setelah berhasil di Windows, copy seluruh folder ke VPS:

```bash
# Di Windows (Git Bash)
rsync -avz --exclude 'node_modules' --exclude '.git' \
  /d/laragon/www/evaluasi-raft-hlf/ \
  root@your-vps-ip:/root/evaluasi-raft-hlf/

# Di VPS
cd /root/evaluasi-raft-hlf
chmod +x raft/network/*.sh raft/network/scripts/*.sh
chmod +x smartbft/network/*.sh smartbft/network/scripts/*.sh

# Start network
cd raft/network && ./network.sh up createChannel -c raft
./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl node -c raft
```

