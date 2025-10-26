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
const mspUser = 'User1@org1.example.com';
const channelName = 'channel-standard';
const chaincodeName = 'pelaporan';
const networkConfigurations = [
    {
        label: 'RAFT Standard',
        networkDir: path.resolve(__dirname, '../../raft-standard/network'),
        instructions: {
            up: 'cd ../raft-standard/network && ./network.sh up createChannel -c channel-standard -ca',
            deploy: './network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript'
        }
    },
    {
        label: 'RAFT Variant',
        networkDir: path.resolve(__dirname, '../../raft-variant/network'),
        instructions: {
            up: 'cd ../raft-variant/network && ./network.sh up createChannel -c channel-standard -ca',
            deploy: './network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript'
        }
    }
];
const peerEndpoint = 'localhost:7051';
const peerHostAlias = 'peer0.org1.example.com';

async function readFirstVisibleFile(directory) {
    const entries = await fs.readdir(directory);
    const candidate = entries.find(entry => !entry.startsWith('.'));
    if (!candidate) {
        throw new Error(`Folder ${directory} tidak berisi berkas yang diperlukan.`);
    }
    return path.join(directory, candidate);
}

async function checkSingleNetwork({ label, networkDir, instructions }) {
    const timestamp = new Date().toISOString();
    const baseResult = {
        label,
        networkDir,
        channel: channelName,
        chaincode: chaincodeName,
        peer: peerEndpoint,
        instructions,
        timestamp
    };

    if (!existsSync(networkDir)) {
        return {
            ...baseResult,
            status: 'not_found',
            message: 'Direktori jaringan tidak ditemukan.'
        };
    }

    const cryptoPath = path.resolve(networkDir, 'organizations/peerOrganizations/org1.example.com');
    const userPath = path.resolve(cryptoPath, `users/${mspUser}/msp`);
    const keyDirPath = path.resolve(userPath, 'keystore');
    const certDirPath = path.resolve(userPath, 'signcerts');
    const tlsCertPath = path.resolve(cryptoPath, 'peers/peer0.org1.example.com/tls/ca.crt');

    const requiredPaths = [
        { path: cryptoPath, description: 'Material kriptografi tidak ditemukan.' },
        { path: userPath, description: `Identitas ${mspUser} tidak ditemukan.` },
        { path: keyDirPath, description: 'Direktori keystore kosong atau tidak tersedia.' },
        { path: certDirPath, description: 'Direktori sertifikat tidak tersedia.' },
        { path: tlsCertPath, description: 'Berkas TLS CA tidak ditemukan.' }
    ];

    const missing = requiredPaths.filter(entry => !existsSync(entry.path));
    if (missing.length) {
        return {
            ...baseResult,
            status: 'incomplete',
            message: missing[0].description
        };
    }

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
        const certFile = await readFirstVisibleFile(certDirPath);
        const credentials = await fs.readFile(certFile);
        return { mspId, credentials };
    }

    async function newSigner() {
        const keyFile = await readFirstVisibleFile(keyDirPath);
        const privateKeyPem = await fs.readFile(keyFile);
        const privateKey = crypto.createPrivateKey(privateKeyPem);
        return signers.newPrivateKeySigner(privateKey);
    }

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

        await contract.evaluateTransaction('GetAllCatatan');

        return {
            ...baseResult,
            status: 'healthy'
        };
    } catch (error) {
        return {
            ...baseResult,
            status: 'unhealthy',
            message: error.message || 'Terjadi kesalahan saat mengakses chaincode.'
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

async function checkNetworkHealth() {
    const results = [];
    for (const config of networkConfigurations) {
        // eslint-disable-next-line no-await-in-loop
        const result = await checkSingleNetwork(config);
        results.push(result);
    }
    return results;
}

export { checkNetworkHealth };
