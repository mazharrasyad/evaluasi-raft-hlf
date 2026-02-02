#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use PROJECT_ROOT environment variable if set, otherwise use relative path from __dirname
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '../..');

// Define paths to check
const raftNetworkPath = path.join(PROJECT_ROOT, 'raft/network');
const smartbftNetworkPath = path.join(PROJECT_ROOT, 'smartbft/network');

const networkCandidates = [
  raftNetworkPath,
  smartbftNetworkPath
];

const domainByNetworkPath = new Map([
  [raftNetworkPath, 'raft'],
  [smartbftNetworkPath, 'smartbft'],
]);

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
    const domain = domainByNetworkPath.get(networkPath) ?? 'standard.com';
    const orgDomain = `org1.${domain}`;
    const peerHost = `peer0.${orgDomain}`;
    const cryptoPath = path.resolve(networkPath, `organizations/peerOrganizations/${orgDomain}`);
    const tlsCertPath = path.resolve(cryptoPath, `peers/${peerHost}/tls/ca.crt`);

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
    console.log(`1. Make sure the network is running: cd ${standardNetworkPath} && ./network.sh up && ./network.sh createChannel -c raft`);
    console.log(`   (use ${variantNetworkPath} if you are relying on the SmartBFT network with channel smartbft)`);
    console.log(`2. Make sure the chaincode is deployed: cd ${standardNetworkPath} && ./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl node -c raft`);
    console.log(`   (use ${variantNetworkPath} for the SmartBFT network when deploying chaincode with -c smartbft)`);
    console.log('3. Check that the crypto materials are generated in the correct location');

    return false;
  }
}

// Run the check
checkFiles().then(success => {
  process.exit(success ? 0 : 1);
});


