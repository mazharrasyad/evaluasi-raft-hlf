import { connect, signers, hash } from '@hyperledger/fabric-gateway';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import grpc from '@grpc/grpc-js';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert __dirname for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const mspId = 'Org1MSP';
const channelName = 'mychannel';
const chaincodeName = 'pelaporan-standard';
const networkCandidates = [
    path.resolve(__dirname, '../../raft-standard/network'),
    path.resolve(__dirname, '../../raft-variant/network')
];
const networkPath = networkCandidates.find(candidate => existsSync(candidate)) || networkCandidates[0];
const cryptoPath = path.resolve(networkPath, 'organizations/peerOrganizations/org1.example.com');
const keyDirPath = path.resolve(cryptoPath, 'users/User1@org1.example.com/msp/keystore');
const certDirPath = path.resolve(cryptoPath, 'users/User1@org1.example.com/msp/signcerts');
const tlsCertPath = path.resolve(cryptoPath, 'peers/peer0.org1.example.com/tls/ca.crt');
const peerEndpoint = 'localhost:7051';
const peerHostAlias = 'peer0.org1.example.com';

async function newGrpcConnection() {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
        'grpc.keepalive_time_ms': 120000,
        'grpc.keepalive_timeout_ms': 20000,
        'grpc.keepalive_permit_without_calls': true,
        'grpc.http2.max_pings_without_data': 0,
        'grpc.http2.min_time_between_pings_ms': 10000,
        'grpc.http2.min_ping_interval_without_data_ms': 300000
    });
}

async function newIdentity() {
    const [certFile] = await fs.readdir(certDirPath);
    const credentials = await fs.readFile(path.join(certDirPath, certFile));
    return { mspId, credentials };
}

async function newSigner() {
    const [keyFile] = await fs.readdir(keyDirPath);
    const privateKeyPem = await fs.readFile(path.join(keyDirPath, keyFile));
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

/**
 * Check if the network is healthy and responsive
 * @returns {Promise<Object>} Network status information
 */
async function checkNetworkHealth() {
    let client;
    let gateway;
    
    try {
        client = await newGrpcConnection();
        gateway = connect({
            client,
            identity: await newIdentity(),
            signer: await newSigner(),
            hash: hash.sha256,
        });
        
        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);
        
        // Try a simple query to check if chaincode is accessible
        await contract.evaluateTransaction('GetAllCatatan');
        
        return {
            status: 'healthy',
            channel: channelName,
            chaincode: chaincodeName,
            peer: peerEndpoint,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            channel: channelName,
            chaincode: chaincodeName,
            peer: peerEndpoint,
            timestamp: new Date().toISOString()
        };
    } finally {
        if (gateway) {
            gateway.close();
        }
        if (client) {
            client.close();
        }
    }
}

export { checkNetworkHealth };
