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
        'grpc.keepalive_time_ms': 120000,
        'grpc.keepalive_timeout_ms': 20000,
        'grpc.keepalive_permit_without_calls': true,
        'grpc.http2.max_pings_without_data': 0,
        'grpc.http2.min_time_between_pings_ms': 10000,
        'grpc.http2.min_ping_interval_without_data_ms': 300000
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
            evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
            endorseOptions: () => ({ deadline: Date.now() + 15000 }),
            submitOptions: () => ({ deadline: Date.now() + 30000 }),
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

        console.log(`📝 [${config.label}] Preparing to save simulationData to blockchain block...`);
        console.log(`   Record ID: ${recordId}`);
        console.log(`   Network: ${networkId} (${config.label})`);
        console.log(`   Channel: ${config.channel}`);

        // Prepare comprehensive data to store in blockchain block
        const comprehensiveData = {
            // Original simulation data
            ...record,
            // Submission metadata
            submittedAt: metadata.submittedAt || submittedAt,
            submittedToNetwork: config.label,
            networkId: networkId,
            // Network configuration metadata
            networkMetadata: {
                channel: config.channel,
                chaincode: config.chaincode,
                fabricVersion: config.fabricVersion,
                variant: config.variant,
                peerEndpoint: config.peerEndpoint,
                label: config.label,
            },
            // Ensure ID fields are consistent
            reportId: recordId,
            id: recordId,
        };

        console.log(`💾 [${config.label}] Submitting transaction to create/update record in blockchain...`);

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

        console.log(`✅ [${config.label}] SimulationData successfully saved to blockchain block!`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Record ID: ${recordId}`);
        console.log(`   Completed at: ${completedAt}`);

        // Validate the data was saved by reading it back
        console.log(`🔍 [${config.label}] Validating data was saved correctly...`);
        try {
            const validationBytes = await contract.evaluateTransaction('ReadCatatan', recordId);
            const validationString = new TextDecoder().decode(validationBytes);
            const savedData = JSON.parse(validationString);

            if (savedData && savedData.reportId === recordId) {
                console.log(`✓ [${config.label}] Validation successful - data confirmed in blockchain!`);
            } else {
                console.warn(`⚠ [${config.label}] Validation warning - data may not match`);
            }
        } catch (validationError) {
            console.warn(`⚠ [${config.label}] Could not validate saved data:`, validationError.message);
        }

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
            channel: config.channel,
            chaincode: config.chaincode,
        };
    } catch (error) {
        console.error(`❌ [${config ? config.label : networkId}] Failed to save simulationData to blockchain:`, error.message);

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
 * Query all transactions from blockchain blocks (reads ALL transactions, including duplicates)
 * @param {string} networkId - The network ID to query from
 * @returns {Promise<Object>} - Object containing success status and all transactions array
 */
export async function queryAllTransactionsFromBlocks(networkId) {
    let connection = null;
    let config = null;
    const queriedAt = new Date().toISOString();

    try {
        config = getNetworkConfig(networkId);
        connection = await connectToGateway(networkId);
        const { gateway, client } = connection;

        // Get network
        const network = gateway.getNetwork(config.channel);

        console.log(`🔍 [${config.label}] Reading ALL transactions from blockchain blocks...`);
        console.log(`   Network: ${networkId} (${config.label})`);
        console.log(`   Channel: ${config.channel}`);

        const allTransactions = [];
        let blockNumber = 0;
        let hasMoreBlocks = true;
        let totalEnvelopes = 0;
        let totalEndorserTransactions = 0;

        // Read blocks sequentially
        while (hasMoreBlocks) {
            try {
                const block = await network.getBlockByNumber(BigInt(blockNumber));
                console.log(`   📦 Block ${blockNumber}: ${block.envelopes.length} envelopes`);

                // Process each envelope (transaction) in the block
                for (const envelope of block.envelopes) {
                    totalEnvelopes++;
                    try {
                        // Get transaction ID and timestamp
                        const txId = envelope.transactionId;
                        const timestamp = envelope.timestamp;

                        // Check if this is a chaincode transaction
                        if (!envelope.isEndorserTransaction) {
                            continue;
                        }

                        totalEndorserTransactions++;

                        // Get chaincode actions
                        const transaction = envelope.transactionPayload;
                        if (!transaction || !transaction.actions) {
                            console.log(`      ⚠️  No actions in transaction ${txId}`);
                            continue;
                        }

                        for (const action of transaction.actions) {
                            try {
                                // Get chaincode input (function name and arguments)
                                const proposal = action.proposal;
                                const chaincodeInput = proposal.chaincodeInput;

                                if (!chaincodeInput || !chaincodeInput.args) {
                                    console.log(`      ⚠️  No chaincode input or args in block ${blockNumber}`);
                                    continue;
                                }

                                // Log raw args for debugging
                                console.log(`      📋 Block ${blockNumber}: ${chaincodeInput.args.length} args`);

                                // Try to decode function name (args[0])
                                let functionName = '';
                                try {
                                    functionName = new TextDecoder().decode(chaincodeInput.args[0]);
                                } catch (decodeError) {
                                    console.log(`      ⚠️  Failed to decode function name:`, decodeError.message);
                                    continue;
                                }

                                console.log(`      🔧 Function: ${functionName} (${chaincodeInput.args.length} args)`);

                                // Only process our chaincode functions
                                if (functionName === 'CreateCatatan' || functionName === 'UpdateCatatan' || functionName === 'CreateOrUpdateCatatan') {
                                    // Ensure we have enough args (function name + record ID + record data)
                                    if (chaincodeInput.args.length < 3) {
                                        console.log(`      ⚠️  Not enough args for ${functionName}: ${chaincodeInput.args.length}`);
                                        continue;
                                    }

                                    // Extract the record ID and data
                                    let recordId = '';
                                    let recordDataStr = '';

                                    try {
                                        recordId = new TextDecoder().decode(chaincodeInput.args[1]);
                                        console.log(`      🔑 Record ID: ${recordId}`);
                                    } catch (idError) {
                                        console.error(`      ❌ Failed to decode record ID:`, idError.message);
                                        continue;
                                    }

                                    try {
                                        recordDataStr = new TextDecoder().decode(chaincodeInput.args[2]);
                                        console.log(`      📄 Data length: ${recordDataStr.length} chars`);
                                    } catch (dataError) {
                                        console.error(`      ❌ Failed to decode record data:`, dataError.message);
                                        continue;
                                    }

                                    if (recordId && recordDataStr) {
                                        try {
                                            const recordData = JSON.parse(recordDataStr);

                                            // Add transaction metadata
                                            const transactionRecord = {
                                                ...recordData,
                                                id: recordId,
                                                reportId: recordData.reportId || recordId,
                                                blockchainMetadata: {
                                                    ...(recordData.blockchainMetadata || {}),
                                                    blockNumber: blockNumber,
                                                    transactionId: txId,
                                                    blockTimestamp: timestamp.toISOString(),
                                                    functionCalled: functionName,
                                                    extractedFromBlock: true,
                                                    channel: config.channel
                                                }
                                            };

                                            allTransactions.push(transactionRecord);
                                            console.log(`      ✅ Found record: ${recordId} - Total: ${allTransactions.length}`);
                                        } catch (parseError) {
                                            console.error(`      ❌ Failed to parse JSON in block ${blockNumber}:`, parseError.message);
                                            console.error(`      Data preview: ${recordDataStr.substring(0, 100)}...`);
                                        }
                                    } else {
                                        console.log(`      ⚠️  Empty recordId or recordDataStr`);
                                    }
                                } else {
                                    console.log(`      ⏭️  Skipping function: ${functionName}`);
                                }
                            } catch (actionError) {
                                console.error(`      ❌ Error processing action in block ${blockNumber}:`, actionError.message);
                                console.error(`      Stack:`, actionError.stack);
                            }
                        }
                    } catch (envError) {
                        console.error(`   Error processing envelope in block ${blockNumber}:`, envError.message);
                    }
                }

                blockNumber++;
            } catch (blockError) {
                // No more blocks available
                hasMoreBlocks = false;
            }
        }

        const completedAt = new Date().toISOString();

        console.log(`\n📊 [${config.label}] Block scan complete!`);
        console.log(`   Total blocks read: ${blockNumber}`);
        console.log(`   Total envelopes: ${totalEnvelopes}`);
        console.log(`   Total endorser transactions: ${totalEndorserTransactions}`);
        console.log(`   Records found from blocks: ${allTransactions.length}`);

        // Fallback: If no records found from blocks, try state database
        if (allTransactions.length === 0 && blockNumber > 1) {
            console.log(`\n⚠️  [${config.label}] No records found from blocks, trying state database...`);

            try {
                const contract = network.getContract(config.chaincode);
                const resultBytes = await contract.evaluateTransaction('GetAllCatatan');
                const resultString = new TextDecoder().decode(resultBytes);

                // Clean up response
                let cleanString = resultString.trim();
                const jsonStartIndex = cleanString.indexOf('[');
                if (jsonStartIndex > 0) {
                    cleanString = cleanString.substring(jsonStartIndex);
                }

                const stateRecords = JSON.parse(cleanString);

                if (Array.isArray(stateRecords) && stateRecords.length > 0) {
                    console.log(`   ✅ Found ${stateRecords.length} records from state database!`);

                    // Close connection
                    gateway.close();
                    client.close();

                    return {
                        success: true,
                        networkId,
                        label: config.label,
                        channel: config.channel,
                        chaincode: config.chaincode,
                        queriedAt,
                        completedAt,
                        count: stateRecords.length,
                        records: stateRecords,
                        source: 'state_database_fallback',
                        totalBlocks: blockNumber,
                        note: 'Data retrieved from state database as fallback'
                    };
                }
            } catch (stateError) {
                console.error(`   ❌ State database fallback also failed:`, stateError.message);
            }
        }

        console.log(`   ✅ Final result: ${allTransactions.length} records`);
        console.log(`   Completed at: ${completedAt}`);

        // Close connection
        gateway.close();
        client.close();

        return {
            success: true,
            networkId,
            label: config.label,
            channel: config.channel,
            chaincode: config.chaincode,
            queriedAt,
            completedAt,
            count: allTransactions.length,
            records: allTransactions,
            source: allTransactions.length > 0 ? 'blockchain_blocks' : 'blockchain_blocks_empty',
            totalBlocks: blockNumber
        };
    } catch (error) {
        console.error(`❌ [${config ? config.label : networkId}] Failed to query transactions from blocks:`, error.message);

        // Close connection if it was opened
        if (connection) {
            try {
                connection.gateway.close();
                connection.client.close();
            } catch (closeError) {
                console.error('Error closing connection:', closeError);
            }
        }

        const completedAt = new Date().toISOString();

        return {
            success: false,
            error: error.message,
            networkId,
            label: config ? config.label : networkId,
            queriedAt,
            completedAt,
            count: 0,
            records: [],
        };
    }
}

/**
 * Query all records from a specific network (from state database - unique keys only)
 * @param {string} networkId - The network ID to query from
 * @returns {Promise<Object>} - Object containing success status and records array
 */
export async function queryRecordsFromNetwork(networkId) {
    let connection = null;
    let config = null;
    const queriedAt = new Date().toISOString();

    try {
        config = getNetworkConfig(networkId);
        connection = await connectToGateway(networkId);
        const { gateway, client } = connection;

        // Get network and contract
        const network = gateway.getNetwork(config.channel);
        const contract = network.getContract(config.chaincode);

        console.log(`🔍 [${config.label}] Querying all records from blockchain...`);
        console.log(`   Network: ${networkId} (${config.label})`);
        console.log(`   Channel: ${config.channel}`);

        // Query all records using GetAllCatatan
        const resultBytes = await contract.evaluateTransaction('GetAllCatatan');
        const resultString = new TextDecoder().decode(resultBytes);

        // Clean up response - remove any console.log output or emoji
        let cleanString = resultString.trim();

        // Try to find JSON array start
        const jsonStartIndex = cleanString.indexOf('[');
        if (jsonStartIndex > 0) {
            cleanString = cleanString.substring(jsonStartIndex);
        }

        // Parse cleaned JSON
        let records = [];
        try {
            records = JSON.parse(cleanString);
        } catch (parseError) {
            console.error('Failed to parse GetAllCatatan response:', cleanString.substring(0, 100));
            throw new Error(`Invalid JSON response from chaincode: ${parseError.message}`);
        }

        const completedAt = new Date().toISOString();

        console.log(`✅ [${config.label}] Successfully retrieved ${records.length} records from blockchain!`);
        console.log(`   Completed at: ${completedAt}`);

        // Close connection
        gateway.close();
        client.close();

        return {
            success: true,
            networkId,
            label: config.label,
            channel: config.channel,
            chaincode: config.chaincode,
            queriedAt,
            completedAt,
            count: records.length,
            records: Array.isArray(records) ? records : [],
        };
    } catch (error) {
        console.error(`❌ [${config ? config.label : networkId}] Failed to query records from blockchain:`, error.message);

        // Close connection if it was opened
        if (connection) {
            try {
                connection.gateway.close();
                connection.client.close();
            } catch (closeError) {
                console.error('Error closing connection:', closeError);
            }
        }

        const completedAt = new Date().toISOString();

        return {
            success: false,
            error: error.message,
            networkId,
            label: config ? config.label : networkId,
            queriedAt,
            completedAt,
            count: 0,
            records: [],
        };
    }
}

/**
 * Submit multiple transactions to multiple networks
 * Saves simulationData to blockchain blocks across all target networks
 */
export async function submitToNetworks(record, targetNetworkIds) {
    const results = [];
    const batchSubmittedAt = new Date().toISOString();
    const recordId = record.reportId || record.id;

    console.log('\n' + '='.repeat(80));
    console.log('📦 SAVING SIMULATIONDATA TO BLOCKCHAIN BLOCKS');
    console.log('='.repeat(80));
    console.log(`Record ID: ${recordId}`);
    console.log(`Target Networks: ${targetNetworkIds.length}`);
    console.log(`Networks: ${targetNetworkIds.join(', ')}`);
    console.log(`Started at: ${batchSubmittedAt}`);
    console.log('='.repeat(80) + '\n');

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

    for (let i = 0; i < targetNetworkIds.length; i++) {
        const networkId = targetNetworkIds[i];
        console.log(`\n[${i + 1}/${targetNetworkIds.length}] Processing network: ${networkId}`);

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

            console.error(`❌ [${label}] Failed to save to network:`, error.message);

            results.push({
                success: false,
                error: error.message,
                networkId,
                label: label,
                recordId: recordId,
                submittedAt: batchSubmittedAt,
                completedAt: new Date().toISOString(),
            });
        }
    }

    const batchCompletedAt = new Date().toISOString();
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log('\n' + '='.repeat(80));
    console.log('✨ SIMULATIONDATA SAVE SUMMARY');
    console.log('='.repeat(80));
    console.log(`Record ID: ${recordId}`);
    console.log(`Total Networks: ${targetNetworkIds.length}`);
    console.log(`✓ Successful: ${successCount}`);
    console.log(`✗ Failed: ${failCount}`);
    console.log(`Completed at: ${batchCompletedAt}`);

    if (successCount > 0) {
        console.log('\n📊 Successfully saved to:');
        results.filter(r => r.success).forEach(r => {
            console.log(`   ✓ ${r.label} (${r.networkId})`);
            console.log(`     Channel: ${r.channel}`);
        });
    }

    if (failCount > 0) {
        console.log('\n⚠️  Failed to save to:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`   ✗ ${r.label} (${r.networkId})`);
            console.log(`     Error: ${r.error}`);
        });
    }

    console.log('='.repeat(80) + '\n');

    return results;
}
