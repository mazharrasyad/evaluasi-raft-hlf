#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths to check
const standardNetworkPath = path.resolve(__dirname, '../../fabric-2/raft-standard/network');
const variantNetworkPath = path.resolve(__dirname, '../../fabric-2/raft-variant/network');

const networkCandidates = [
  standardNetworkPath,
  variantNetworkPath
];

async function resolveNetworkPath() {
  for (const candidate of networkCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // continue trying other candidates
    }
  }
  throw new Error('Network directory not found. Please ensure the Fabric test network is generated.');
}

async function checkFiles() {
  console.log('Checking Hyperledger Fabric network files...');

  try {
    const networkPath = await resolveNetworkPath();
    const cryptoPath = path.resolve(networkPath, 'organizations/peerOrganizations/org1.example.com');
    const tlsCertPath = path.resolve(cryptoPath, 'peers/peer0.org1.example.com/tls/ca.crt');

    // Check if network directory exists
    await fs.access(networkPath);
    console.log(`✅ Network directory exists: ${networkPath}`);
    
    // Check if crypto materials directory exists
    await fs.access(cryptoPath);
    console.log(`✅ Crypto materials directory exists: ${cryptoPath}`);
    
    // Check if TLS certificate exists
    await fs.access(tlsCertPath);
    console.log(`✅ TLS certificate exists: ${tlsCertPath}`);
    
    console.log('All required files exist. Network setup appears correct.');
    return true;
  } catch (error) {
    console.error('❌ Network files check failed:');
    console.error(error.message);

    console.log('\nPlease ensure the Hyperledger Fabric network is set up correctly:');
    console.log(`1. Make sure the network is running: cd ${standardNetworkPath} && ./network.sh up -ca && ./network.sh createChannel -c channel-standard -ca`);
    console.log(`   (use ${variantNetworkPath} if you are relying on the variant Fabric network)`);
    console.log(`2. Make sure the chaincode is deployed: cd ${standardNetworkPath} && ./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript`);
    console.log(`   (use ${variantNetworkPath} for the RAFT Variant network when deploying chaincode)`);
    console.log('3. Check that the crypto materials are generated in the correct location');

    return false;
  }
}

// Run the check
checkFiles().then(success => {
  process.exit(success ? 0 : 1);
});
