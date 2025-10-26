#!/usr/bin/env node

import { checkNetworkHealth } from './src/network-check.js';

async function main() {
    console.log('Checking Hyperledger Fabric network health...');
    
    try {
        const health = await checkNetworkHealth();
        
        if (health.status === 'healthy') {
            console.log('✅ Network is healthy and ready to use');
            console.log(`Channel: ${health.channel}`);
            console.log(`Chaincode: ${health.chaincode}`);
            console.log(`Peer: ${health.peer}`);
            process.exit(0);
        } else {
            console.error('❌ Network is unhealthy');
            console.error(`Error: ${health.error}`);
            console.error('Please check that the Hyperledger Fabric network is running');
            console.error('Run the test network with: cd ../network-origin && ./network.sh up createChannel -c mychannel -ca');
            console.error('  (use ../network-origin if you are relying on the bundled Fabric sample network)');
            console.error('Deploy the chaincode with: ./network.sh deployCC -ccn catatan-digital -ccp ../chaincode/catatan-digital -ccl javascript');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Failed to check network health');
        console.error(error);
        process.exit(1);
    }
}

main();
