import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as grpc from '@grpc/grpc-js';
import { connect, signers } from '@hyperledger/fabric-gateway';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use PROJECT_ROOT environment variable if set, otherwise use relative path from __dirname
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '../..');

// Network configuration mapping
const NETWORK_CONFIGS = {
    'channel-standard': {
        label: 'Fabric 2 RAFT Standard',
        fabricVersion: 'fabric-2',
        variant: 'raft-standard',
        channel: 'fabric2-channel-standard',
        chaincode: 'pelaporan',
        peerEndpoint: 'localhost:7051',
        peerHostAlias: 'peer0.org1.fabric2.standard.com',
        orgPath: 'org1.standard.com',
        mspId: 'Org1MSP',
    },
    'channel-variant': {
        label: 'Fabric 2 RAFT Variant',
        fabricVersion: 'fabric-2',
        variant: 'raft-variant',
        channel: 'fabric2-channel-variant',
        chaincode: 'pelaporan',
        peerEndpoint: 'localhost:7052',
        peerHostAlias: 'peer0.org1.fabric2.variant.com',
        orgPath: 'org1.variant.com',
        mspId: 'Org1MSP',
    },
    'channel-fabric3-standard': {
        label: 'Fabric 3 RAFT Standard',
        fabricVersion: 'fabric-3',
        variant: 'raft-standard',
        channel: 'fabric3-channel-standard',
        chaincode: 'pelaporan',
        peerEndpoint: 'localhost:7153',
        peerHostAlias: 'peer0.org1.fabric3.standard',
        orgPath: 'org1.fabric3.standard',
        mspId: 'Org1MSP',
    },
    'channel-fabric3-variant': {
        label: 'Fabric 3 RAFT Variant',
        fabricVersion: 'fabric-3',
        variant: 'raft-variant',
        channel: 'fabric3-channel-variant',
        chaincode: 'pelaporan',
        peerEndpoint: 'localhost:7353',
        peerHostAlias: 'peer0.org1.fabric3.variant',
        orgPath: 'org1.fabric3.variant',
        mspId: 'Org1MSP',
    },
};

/**
 * Get network configuration by network ID
 */
export function getNetworkConfig(networkId) {
    const config = NETWORK_CONFIGS[networkId];
    if (!config) {
        throw new Error(`Unknown network ID: ${networkId}`);
    }
    return config;
}

/**
 * Create gRPC client for peer connection
 */
async function createGrpcClient(config) {
    const peerEndpoint = config.peerEndpoint;
    const peerHostAlias = config.peerHostAlias;

    // Read TLS certificate
    const networkDir = path.join(PROJECT_ROOT, config.fabricVersion, config.variant, 'network');
    const tlsCertPath = path.join(
        networkDir,
        'organizations/peerOrganizations',
        config.orgPath,
        'peers',
        peerHostAlias,
        'tls/ca.crt'
    );

    let tlsRootCert;
    try {
        tlsRootCert = await fs.readFile(tlsCertPath);
    } catch (error) {
        throw new Error(`Failed to read TLS certificate at ${tlsCertPath}: ${error.message}`);
    }

    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);

    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

/**
 * Create identity for signing transactions
 */
async function createIdentity(config) {
    const networkDir = path.join(PROJECT_ROOT, config.fabricVersion, config.variant, 'network');

    // Read certificate
    const certPath = path.join(
        networkDir,
        'organizations/peerOrganizations',
        config.orgPath,
        'users/User1@' + config.orgPath,
        'msp/signcerts/cert.pem'
    );

    let certificate;
    try {
        certificate = await fs.readFile(certPath);
    } catch (error) {
        throw new Error(`Failed to read certificate at ${certPath}: ${error.message}`);
    }

    return {
        mspId: config.mspId,
        credentials: certificate,
    };
}

/**
 * Create signer for signing transactions
 */
async function createSigner(config) {
    const networkDir = path.join(PROJECT_ROOT, config.fabricVersion, config.variant, 'network');

    // Read private key
    const keyDirPath = path.join(
        networkDir,
        'organizations/peerOrganizations',
        config.orgPath,
        'users/User1@' + config.orgPath,
        'msp/keystore'
    );

    let files;
    try {
        files = await fs.readdir(keyDirPath);
    } catch (error) {
        throw new Error(`Failed to read keystore directory at ${keyDirPath}: ${error.message}`);
    }

    if (!files || files.length === 0) {
        throw new Error(`No private key files found in keystore directory at ${keyDirPath}`);
    }

    const keyPath = path.join(keyDirPath, files[0]);
    let privateKeyPem;
    try {
        privateKeyPem = await fs.readFile(keyPath, 'utf8');
    } catch (error) {
        throw new Error(`Failed to read private key at ${keyPath}: ${error.message}`);
    }

    if (!privateKeyPem) {
        throw new Error(`Private key content is empty at ${keyPath}`);
    }

    return signers.newPrivateKeySigner(privateKeyPem);
}

/**
 * Connect to Fabric Gateway
 */
export async function connectToGateway(networkId) {
    const config = getNetworkConfig(networkId);

    try {
        const client = await createGrpcClient(config);
        const identity = await createIdentity(config);
        const signer = await createSigner(config);

        const gateway = connect({
            client,
            identity,
            signer,
        });

        return {
            gateway,
            config,
            client,
        };
    } catch (error) {
        throw new Error(`Failed to connect to ${config.label}: ${error.message}`);
    }
}

/**
 * Submit a transaction to create a record
 */
export async function submitTransaction(networkId, record) {
    let connection = null;

    try {
        connection = await connectToGateway(networkId);
        const { gateway, config, client } = connection;

        // Get network and contract
        const network = gateway.getNetwork(config.channel);
        const contract = network.getContract(config.chaincode);

        // Submit transaction and get commit status
        const proposal = contract.newProposal('CreateCatatan');
        proposal.addArguments([record.id, JSON.stringify(record)]);

        const transaction = await proposal.endorse();
        const commit = await transaction.submit();

        // Get transaction ID
        const txId = transaction.getTransactionId();

        // Wait for commit and get block info
        const status = await commit.getStatus();
        const blockNumber = status.blockNumber;

        // Get result from transaction
        const resultBytes = transaction.getResult();
        const resultString = new TextDecoder().decode(resultBytes);
        const result = JSON.parse(resultString);

        // Close connection
        gateway.close();
        client.close();

        return {
            success: true,
            result,
            networkId,
            recordId: record.id,
            transactionId: txId,
            blockNumber: blockNumber.toString(),
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        // Close connection if it was opened
        if (connection) {
            try {
                connection.gateway.close();
                connection.client.close();
            } catch (closeError) {
                console.error('Error closing connection:', closeError);
            }
        }

        return {
            success: false,
            error: error.message,
            networkId,
            recordId: record.id,
        };
    }
}

/**
 * Submit multiple transactions to multiple networks
 */
export async function submitToNetworks(record, targetNetworkIds) {
    const results = [];

    for (const networkId of targetNetworkIds) {
        try {
            const result = await submitTransaction(networkId, record);
            results.push(result);
        } catch (error) {
            results.push({
                success: false,
                error: error.message,
                networkId,
                recordId: record.id,
            });
        }
    }

    return results;
}
