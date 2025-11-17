import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as grpc from '@grpc/grpc-js';
import { connect, signers, hash } from '@hyperledger/fabric-gateway';
import crypto from 'crypto';

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

    // Read certificate directory
    const certDirPath = path.join(
        networkDir,
        'organizations/peerOrganizations',
        config.orgPath,
        'users/User1@' + config.orgPath,
        'msp/signcerts'
    );

    let files;
    try {
        files = await fs.readdir(certDirPath);
    } catch (error) {
        throw new Error(`Failed to read signcerts directory at ${certDirPath}: ${error.message}`);
    }

    // Find first non-hidden file
    const certFile = files.find(f => !f.startsWith('.'));
    if (!certFile) {
        throw new Error(`No certificate files found in directory at ${certDirPath}`);
    }

    const certPath = path.join(certDirPath, certFile);
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

    // Find first non-hidden file
    const keyFile = files.find(f => !f.startsWith('.'));
    if (!keyFile) {
        throw new Error(`No valid private key files found in keystore directory at ${keyDirPath}`);
    }

    const keyPath = path.join(keyDirPath, keyFile);
    let privateKeyPem;
    try {
        privateKeyPem = await fs.readFile(keyPath);
    } catch (error) {
        throw new Error(`Failed to read private key at ${keyPath}: ${error.message}`);
    }

    if (!privateKeyPem) {
        throw new Error(`Private key content is empty at ${keyPath}`);
    }

    // Create private key object using crypto module
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
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
            hash: hash.sha256,
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
 * @param {string} networkId - The network ID to submit to
 * @param {object} record - The record data to submit
 * @param {object} metadata - Additional metadata about the submission
 */
export async function submitTransaction(networkId, record, metadata = {}) {
    let connection = null;
    let config = null;
    const submittedAt = new Date().toISOString();

    try {
        config = getNetworkConfig(networkId);
        connection = await connectToGateway(networkId);
        const { gateway, client } = connection;

        // Get network and contract
        const network = gateway.getNetwork(config.channel);
        const contract = network.getContract(config.chaincode);

        // Use reportId as the ID (frontend sends reportId, not id)
        const recordId = record.reportId || record.id;
        if (!recordId) {
            throw new Error('Record must have either reportId or id property');
        }

        // Prepare comprehensive data to store in blockchain
        const comprehensiveData = {
            // Original simulation data
            ...record,
            // Submission metadata
            submittedAt: metadata.submittedAt || submittedAt,
            submittedToNetwork: config.label,
            networkId: networkId,
            // Ensure ID fields are consistent
            reportId: recordId,
            id: recordId,
        };

        // Submit transaction using CreateOrUpdateCatatan to handle both new and existing records
        const resultBytes = await contract.submitTransaction(
            'CreateOrUpdateCatatan',
            recordId,
            JSON.stringify(comprehensiveData)
        );

        const completedAt = new Date().toISOString();

        // Parse result
        const resultString = new TextDecoder().decode(resultBytes);
        const result = JSON.parse(resultString);

        // Close connection
        gateway.close();
        client.close();

        return {
            success: true,
            result,
            networkId,
            label: config.label,
            recordId: recordId,
            submittedAt,
            completedAt,
            timestamp: completedAt,
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

        const recordId = record.reportId || record.id;
        const completedAt = new Date().toISOString();

        return {
            success: false,
            error: error.message,
            networkId,
            label: config ? config.label : networkId,
            recordId: recordId,
            submittedAt,
            completedAt,
        };
    }
}

/**
 * Submit multiple transactions to multiple networks
 */
export async function submitToNetworks(record, targetNetworkIds) {
    const results = [];
    const batchSubmittedAt = new Date().toISOString();

    // Prepare shared metadata for all submissions
    const metadata = {
        submittedAt: batchSubmittedAt,
        totalNetworks: targetNetworkIds.length,
        targetNetworks: targetNetworkIds.map(id => {
            try {
                const config = getNetworkConfig(id);
                return { id, label: config.label };
            } catch (e) {
                return { id, label: id };
            }
        }),
    };

    for (const networkId of targetNetworkIds) {
        try {
            const result = await submitTransaction(networkId, record, metadata);
            results.push(result);
        } catch (error) {
            // Get config safely for label
            let label = networkId;
            try {
                const config = getNetworkConfig(networkId);
                label = config.label;
            } catch (e) {
                // Use networkId as fallback
            }

            results.push({
                success: false,
                error: error.message,
                networkId,
                label: label,
                recordId: record.reportId || record.id,
                submittedAt: batchSubmittedAt,
                completedAt: new Date().toISOString(),
            });
        }
    }

    return results;
}
