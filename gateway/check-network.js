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
            console.error('Run the test network with: cd ../raft-standard/network && ./network.sh up createChannel -c channel-standard -ca');
            console.error('  (use ../raft-variant/network if you are relying on the variant Fabric network)');
            console.error('Deploy the chaincode with: ./network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Failed to check network health');
        console.error(error);
        process.exit(1);
    }
}

main();
