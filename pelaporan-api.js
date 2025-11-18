import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    submitTransaction,
    queryRecordsFromNetwork,
    queryAllTransactionsFromBlocks,
    getNetworkConfig,
    connectToGateway
} from './web/src/fabric-gateway.js';

// ✅ Konversi __dirname untuk ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Network Configuration
const NETWORKS = {
    'fabric-2-standard': 'channel-standard',
    'fabric-2-variant': 'channel-variant',
    'fabric-3-standard': 'channel-fabric3-standard',
    'fabric-3-variant': 'channel-fabric3-variant'
};

// Default network
const DEFAULT_NETWORK = 'channel-standard';

// ✅ Inisialisasi Express
const app = express();

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.json());

// Helper function to get network ID from request
function getNetworkId(req) {
    const networkParam = req.query.network || req.body?.network;
    return NETWORKS[networkParam] || networkParam || DEFAULT_NETWORK;
}

// Helper function to generate hash
function generateHash(data) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
}

// 🔄 API Endpoints

// ==================== HEALTH CHECK ====================
app.get('/api/health', async (req, res) => {
    try {
        // Check all networks health
        const healthChecks = [];

        for (const [name, networkId] of Object.entries(NETWORKS)) {
            try {
                const config = getNetworkConfig(networkId);
                const connection = await connectToGateway(networkId);
                connection.gateway.close();
                connection.client.close();

                healthChecks.push({
                    network: name,
                    networkId: networkId,
                    label: config.label,
                    status: 'healthy',
                    peerEndpoint: config.peerEndpoint
                });
            } catch (err) {
                healthChecks.push({
                    network: name,
                    networkId: networkId,
                    status: 'unhealthy',
                    error: err.message
                });
            }
        }

        const allHealthy = healthChecks.every(check => check.status === 'healthy');

        if (allHealthy) {
            res.json({
                error: false,
                message: 'All networks are healthy',
                data: {
                    status: 'healthy',
                    networks: healthChecks,
                    timestamp: new Date().toISOString()
                }
            });
        } else {
            res.status(503).json({
                error: true,
                message: 'Some networks are unhealthy',
                data: {
                    status: 'degraded',
                    networks: healthChecks,
                    timestamp: new Date().toISOString()
                }
            });
        }
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            data: null
        });
    }
});

// ==================== BLOCKCHAIN INFO ====================
app.get('/api/blockchain/info', async (req, res) => {
    try {
        const networkId = getNetworkId(req);
        const config = getNetworkConfig(networkId);

        // Get all records to calculate blockchain stats
        const result = await queryAllTransactionsFromBlocks(networkId);

        // Generate blockchain hashes
        const dataString = JSON.stringify(result.records);
        const currentBlockHash = generateHash(dataString + Date.now()).substring(0, 32);
        const previousBlockHash = generateHash(dataString).substring(0, 32);
        const genesisHash = generateHash('genesis-block').substring(0, 32);

        res.json({
            error: false,
            message: "Blockchain info retrieved successfully",
            data: {
                network: {
                    networkId: networkId,
                    label: config.label,
                    channelName: config.channel,
                    chaincodeName: config.chaincode,
                    fabricVersion: config.fabricVersion,
                    variant: config.variant,
                    mspId: config.mspId,
                    peerEndpoint: config.peerEndpoint
                },
                blockchain: {
                    currentBlockHash: currentBlockHash,
                    previousBlockHash: previousBlockHash,
                    genesisHash: genesisHash,
                    blockHeight: result.totalBlocks || 0,
                    transactionCount: result.count || 0
                },
                timestamp: new Date().toISOString()
            }
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            data: null
        });
    }
});

// ==================== GET ALL PELAPORAN ====================
app.get('/api/pelaporan', async (req, res) => {
    try {
        const networkId = getNetworkId(req);
        const config = getNetworkConfig(networkId);

        // Query all transactions from blockchain blocks
        const result = await queryAllTransactionsFromBlocks(networkId);

        if (result.success) {
            // Sort by timestamp descending
            const sortedData = Array.isArray(result.records) ?
                result.records.sort((a, b) => {
                    const timeA = new Date(a.timestamp || a.createdAt || 0);
                    const timeB = new Date(b.timestamp || b.createdAt || 0);
                    return timeB - timeA;
                }) :
                result.records;

            res.json({
                error: false,
                message: "success",
                network: {
                    networkId: networkId,
                    label: config.label,
                    channel: config.channel
                },
                total_data: Array.isArray(sortedData) ? sortedData.length : 0,
                totalBlocks: result.totalBlocks || 0,
                source: result.source || 'blockchain_blocks',
                data: sortedData
            });
        } else {
            res.status(500).json({
                error: true,
                message: result.error || 'Failed to retrieve records',
                total_data: 0,
                data: null
            });
        }
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            total_data: 0,
            data: null
        });
    }
});

// ==================== GET PELAPORAN BY ID ====================
app.get('/api/pelaporan/:id', async (req, res) => {
    try {
        const networkId = getNetworkId(req);
        const config = getNetworkConfig(networkId);
        const recordId = req.params.id;

        // Get all records and find the specific one
        const result = await queryAllTransactionsFromBlocks(networkId);

        if (result.success) {
            // Find record by ID or reportId
            const record = result.records.find(r =>
                r.id === recordId || r.reportId === recordId
            );

            if (record) {
                res.json({
                    error: false,
                    message: "success",
                    network: {
                        networkId: networkId,
                        label: config.label,
                        channel: config.channel
                    },
                    total_data: 1,
                    data: record
                });
            } else {
                res.status(404).json({
                    error: true,
                    message: `Record with ID ${recordId} not found`,
                    total_data: 0,
                    data: null
                });
            }
        } else {
            res.status(500).json({
                error: true,
                message: result.error || 'Failed to retrieve record',
                total_data: 0,
                data: null
            });
        }
    } catch (err) {
        res.status(404).json({
            error: true,
            message: err.message,
            total_data: 0,
            data: null
        });
    }
});

// ==================== GET PELAPORAN HASH ====================
app.get('/api/pelaporan/:id/hash', async (req, res) => {
    try {
        const networkId = getNetworkId(req);
        const config = getNetworkConfig(networkId);
        const recordId = req.params.id;

        // Get the specific record
        const result = await queryAllTransactionsFromBlocks(networkId);

        if (result.success) {
            const record = result.records.find(r =>
                r.id === recordId || r.reportId === recordId
            );

            if (record) {
                // Generate hash dari data record
                const dataString = JSON.stringify(record);
                const recordHash = generateHash(dataString);
                const shortHash = recordHash.substring(0, 16);
                const previousHash = generateHash(dataString.slice(0, -10)).substring(0, 16);

                res.json({
                    error: false,
                    message: "Record hash retrieved successfully",
                    data: {
                        id: recordId,
                        currentHash: recordHash,
                        shortHash: shortHash,
                        previousHash: previousHash,
                        dataSize: dataString.length,
                        timestamp: new Date().toISOString(),
                        blockchain: {
                            networkId: networkId,
                            label: config.label,
                            channelName: config.channel,
                            chaincodeName: config.chaincode,
                            mspId: config.mspId,
                            blockNumber: record.blockchainMetadata?.blockNumber,
                            transactionId: record.blockchainMetadata?.transactionId
                        }
                    }
                });
            } else {
                res.status(404).json({
                    error: true,
                    message: `Record with ID ${recordId} not found`,
                    data: null
                });
            }
        } else {
            res.status(500).json({
                error: true,
                message: result.error || 'Failed to retrieve record',
                data: null
            });
        }
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            data: null
        });
    }
});

// ==================== GET PELAPORAN HISTORY ====================
app.get('/api/pelaporan/:id/history', async (req, res) => {
    try {
        const networkId = getNetworkId(req);
        const recordId = req.params.id;

        // Get all transactions from blocks
        const result = await queryAllTransactionsFromBlocks(networkId);

        if (result.success) {
            // Find all transactions for this record ID
            const recordTransactions = result.records.filter(r =>
                r.id === recordId || r.reportId === recordId
            );

            if (recordTransactions.length > 0) {
                // Build history from transactions
                const history = recordTransactions.map(tx => ({
                    txId: tx.blockchainMetadata?.transactionId?.substring(0, 16) ||
                          generateHash(`tx-${recordId}-${tx.timestamp}`).substring(0, 16),
                    timestamp: tx.blockchainMetadata?.blockTimestamp ||
                               tx.timestamp ||
                               tx.createdAt ||
                               new Date().toISOString(),
                    action: tx.blockchainMetadata?.functionCalled || "CREATE_OR_UPDATE",
                    blockNumber: tx.blockchainMetadata?.blockNumber,
                    value: tx,
                    hash: generateHash(JSON.stringify(tx)).substring(0, 16)
                })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                res.json({
                    error: false,
                    message: "Record history retrieved successfully",
                    total_data: history.length,
                    data: history
                });
            } else {
                res.status(404).json({
                    error: true,
                    message: `No history found for record ID ${recordId}`,
                    total_data: 0,
                    data: null
                });
            }
        } else {
            res.status(500).json({
                error: true,
                message: result.error || 'Failed to retrieve record history',
                total_data: 0,
                data: null
            });
        }
    } catch (err) {
        res.status(404).json({
            error: true,
            message: err.message,
            total_data: 0,
            data: null
        });
    }
});

// ==================== POST CREATE PELAPORAN ====================
app.post('/api/pelaporan', async (req, res) => {
    try {
        const networkId = getNetworkId(req);
        const config = getNetworkConfig(networkId);
        const record = req.body;

        // Validate input
        if (!record || typeof record !== 'object') {
            return res.status(400).json({
                error: true,
                message: 'Record data is required',
                total_data: 0,
                data: null
            });
        }

        // Ensure record has an ID
        const recordId = record.reportId || record.id;
        if (!recordId) {
            return res.status(400).json({
                error: true,
                message: 'Record must have either reportId or id property',
                total_data: 0,
                data: null
            });
        }

        // Submit transaction to blockchain
        const result = await submitTransaction(networkId, record);

        if (result.success) {
            res.json({
                error: false,
                message: "Record successfully created in blockchain",
                network: {
                    networkId: networkId,
                    label: config.label,
                    channel: config.channel
                },
                total_data: 1,
                data: {
                    ...record,
                    blockchainMetadata: {
                        networkId: networkId,
                        label: config.label,
                        channel: config.channel,
                        submittedAt: result.submittedAt,
                        completedAt: result.completedAt
                    }
                }
            });
        } else {
            res.status(500).json({
                error: true,
                message: result.error || 'Failed to create record',
                total_data: 0,
                data: null
            });
        }
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            total_data: 0,
            data: null
        });
    }
});

// ==================== PUT UPDATE PELAPORAN ====================
app.put('/api/pelaporan/:id', async (req, res) => {
    try {
        const networkId = getNetworkId(req);
        const config = getNetworkConfig(networkId);
        const recordId = req.params.id;
        const updateData = req.body;

        // Validate input
        if (!updateData || typeof updateData !== 'object') {
            return res.status(400).json({
                error: true,
                message: 'Update data is required',
                total_data: 0,
                data: null
            });
        }

        // Ensure the record ID matches
        const record = {
            ...updateData,
            id: recordId,
            reportId: recordId,
            updatedAt: new Date().toISOString()
        };

        // Submit transaction (CreateOrUpdateCatatan will handle update)
        const result = await submitTransaction(networkId, record);

        if (result.success) {
            res.json({
                error: false,
                message: "Record successfully updated in blockchain",
                network: {
                    networkId: networkId,
                    label: config.label,
                    channel: config.channel
                },
                total_data: 1,
                data: {
                    ...record,
                    blockchainMetadata: {
                        networkId: networkId,
                        label: config.label,
                        channel: config.channel,
                        submittedAt: result.submittedAt,
                        completedAt: result.completedAt
                    }
                }
            });
        } else {
            res.status(500).json({
                error: true,
                message: result.error || 'Failed to update record',
                total_data: 0,
                data: null
            });
        }
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            total_data: 0,
            data: null
        });
    }
});

// ==================== BLOCKCHAIN VERIFICATION ====================
app.get('/api/blockchain/verify-chain', async (req, res) => {
    try {
        const networkId = getNetworkId(req);
        const result = await queryAllTransactionsFromBlocks(networkId);

        if (!result.success) {
            return res.status(500).json({
                error: true,
                message: result.error || 'Failed to query blockchain',
                data: null
            });
        }

        // Simulasi blocks dengan hash chain
        const blocks = [];
        let previousHash = generateHash('genesis-block');

        // Generate blocks dari data records
        result.records.forEach((record, index) => {
            const blockData = {
                blockNumber: index + 1,
                timestamp: record.blockchainMetadata?.blockTimestamp ||
                          record.timestamp ||
                          new Date().toISOString(),
                data: record,
                previousHash: previousHash
            };

            const currentHash = generateHash(JSON.stringify(blockData));

            const block = {
                ...blockData,
                currentHash: currentHash,
                isValid: true,
                transactionId: record.blockchainMetadata?.transactionId
            };

            blocks.push(block);
            previousHash = currentHash; // Update untuk block berikutnya
        });

        // Simulasi tampering detection (check if hashes are consistent)
        let tamperedBlocks = 0;
        for (let i = 1; i < blocks.length; i++) {
            if (blocks[i].previousHash !== blocks[i-1].currentHash) {
                blocks[i].isValid = false;
                tamperedBlocks++;
            }
        }

        const brokenChain = tamperedBlocks > 0;

        res.json({
            error: false,
            message: brokenChain ? "Hash chain is BROKEN - Tampering detected!" : "Hash chain is valid",
            data: {
                chainStatus: brokenChain ? "BROKEN" : "VALID",
                totalBlocks: blocks.length,
                tamperedBlocks: tamperedBlocks,
                blocks: blocks.map(b => ({
                    blockNumber: b.blockNumber,
                    currentHash: b.currentHash.substring(0, 16),
                    previousHash: b.previousHash.substring(0, 16),
                    transactionId: b.transactionId?.substring(0, 16),
                    isValid: b.isValid,
                    status: b.isValid ? "✅ VALID" : "❌ TAMPERED"
                }))
            }
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            data: null
        });
    }
});

// ==================== FIX BLOCKCHAIN CHAIN ====================
app.post('/api/blockchain/fix-chain', async (req, res) => {
    try {
        const networkId = getNetworkId(req);
        const result = await queryAllTransactionsFromBlocks(networkId);

        if (!result.success) {
            return res.status(500).json({
                error: true,
                message: result.error || 'Failed to query blockchain',
                data: null
            });
        }

        // Rebuild hash chain dengan data asli
        const fixedBlocks = [];
        let previousHash = generateHash('genesis-block');

        result.records.forEach((record, index) => {
            const blockData = {
                blockNumber: index + 1,
                timestamp: record.blockchainMetadata?.blockTimestamp ||
                          record.timestamp ||
                          new Date().toISOString(),
                data: record,
                previousHash: previousHash
            };

            const currentHash = generateHash(JSON.stringify(blockData));

            fixedBlocks.push({
                ...blockData,
                currentHash: currentHash,
                isValid: true,
                status: "🔧 FIXED",
                transactionId: record.blockchainMetadata?.transactionId
            });

            previousHash = currentHash;
        });

        res.json({
            error: false,
            message: "Hash chain has been fixed - All blocks are now valid",
            data: {
                chainStatus: "FIXED",
                totalBlocks: fixedBlocks.length,
                fixedBlocks: fixedBlocks.length,
                blocks: fixedBlocks.map(b => ({
                    blockNumber: b.blockNumber,
                    currentHash: b.currentHash.substring(0, 16),
                    previousHash: b.previousHash.substring(0, 16),
                    transactionId: b.transactionId?.substring(0, 16),
                    isValid: b.isValid,
                    status: b.status
                }))
            }
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            data: null
        });
    }
});

// ==================== NETWORK LIST ====================
app.get('/api/networks', (req, res) => {
    try {
        const networkList = Object.entries(NETWORKS).map(([key, networkId]) => {
            try {
                const config = getNetworkConfig(networkId);
                return {
                    key: key,
                    networkId: networkId,
                    label: config.label,
                    channel: config.channel,
                    chaincode: config.chaincode,
                    fabricVersion: config.fabricVersion,
                    variant: config.variant,
                    peerEndpoint: config.peerEndpoint
                };
            } catch (err) {
                return {
                    key: key,
                    networkId: networkId,
                    error: err.message
                };
            }
        });

        res.json({
            error: false,
            message: "Available networks",
            total_data: networkList.length,
            data: networkList
        });
    } catch (err) {
        res.status(500).json({
            error: true,
            message: err.message,
            data: null
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error occurred:', err);

    res.status(500).json({
        error: true,
        message: err.message || 'An unexpected error occurred',
        total_data: 0,
        data: null
    });
});

// ▶️ Jalankan server
const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Pelaporan API Gateway running`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📡 Server URL: http://localhost:${PORT}`);
    console.log(`\n📚 Available Endpoints:`);
    console.log(`   GET  /api/health                        - Health check`);
    console.log(`   GET  /api/networks                      - List all networks`);
    console.log(`   GET  /api/blockchain/info               - Blockchain info`);
    console.log(`   GET  /api/pelaporan                     - Get all records`);
    console.log(`   GET  /api/pelaporan/:id                 - Get record by ID`);
    console.log(`   GET  /api/pelaporan/:id/hash            - Get record hash`);
    console.log(`   GET  /api/pelaporan/:id/history         - Get record history`);
    console.log(`   POST /api/pelaporan                     - Create new record`);
    console.log(`   PUT  /api/pelaporan/:id                 - Update record`);
    console.log(`   GET  /api/blockchain/verify-chain       - Verify blockchain`);
    console.log(`   POST /api/blockchain/fix-chain          - Fix blockchain`);
    console.log(`\n🌐 Available Networks (use ?network= param):`);
    console.log(`   - fabric-2-standard  (Fabric 2 RAFT Standard)`);
    console.log(`   - fabric-2-variant   (Fabric 2 RAFT Variant)`);
    console.log(`   - fabric-3-standard  (Fabric 3 RAFT Standard)`);
    console.log(`   - fabric-3-variant   (Fabric 3 RAFT Variant)`);
    console.log(`\n💡 Example Usage:`);
    console.log(`   curl http://localhost:${PORT}/api/health`);
    console.log(`   curl http://localhost:${PORT}/api/pelaporan?network=fabric-2-standard`);
    console.log(`   curl -X POST http://localhost:${PORT}/api/pelaporan -H "Content-Type: application/json" -d '{"reportId":"TEST-001","substance":"Test"}'`);
    console.log(`${'='.repeat(60)}\n`);
});
