import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsRoot = path.resolve(__dirname, '../logs');
const summaryFilePath = path.resolve(logsRoot, 'simulation-summary.json');

function createEmptySummary() {
    return {
        updatedAt: null,
        networks: {},
        transactions: [],
    };
}

function normalizeTimestamp(value) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
}

function selectEarliestTimestamp(current, candidate) {
    const normalizedCandidate = normalizeTimestamp(candidate);
    if (!normalizedCandidate) {
        return current ?? null;
    }

    const normalizedCurrent = normalizeTimestamp(current);
    if (!normalizedCurrent) {
        return normalizedCandidate;
    }

    return normalizedCandidate < normalizedCurrent
        ? normalizedCandidate
        : normalizedCurrent;
}

function selectLatestTimestamp(current, candidate) {
    const normalizedCandidate = normalizeTimestamp(candidate);
    if (!normalizedCandidate) {
        return current ?? null;
    }

    const normalizedCurrent = normalizeTimestamp(current);
    if (!normalizedCurrent) {
        return normalizedCandidate;
    }

    return normalizedCandidate > normalizedCurrent
        ? normalizedCandidate
        : normalizedCurrent;
}

function normalizeBlockNumber(blockNumber) {
    if (blockNumber === null || blockNumber === undefined) {
        return null;
    }

    if (typeof blockNumber === 'bigint') {
        return blockNumber <= BigInt(Number.MAX_SAFE_INTEGER)
            ? Number(blockNumber)
            : blockNumber.toString();
    }

    if (typeof blockNumber === 'number' && Number.isFinite(blockNumber)) {
        return blockNumber;
    }

    if (typeof blockNumber === 'string') {
        const trimmed = blockNumber.trim();
        if (!trimmed) {
            return null;
        }

        const parsed = Number.parseInt(trimmed, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }

        return trimmed;
    }

    return null;
}

function formatBlockLabel(normalizedBlockNumber) {
    if (normalizedBlockNumber === null || normalizedBlockNumber === undefined) {
        return null;
    }

    if (typeof normalizedBlockNumber === 'number' && Number.isFinite(normalizedBlockNumber)) {
        return `#${normalizedBlockNumber}`;
    }

    return `#${normalizedBlockNumber}`;
}

async function ensureLogsDirectory() {
    await fs.mkdir(logsRoot, { recursive: true });
}

async function readSummaryFile() {
    try {
        const content = await fs.readFile(summaryFilePath, 'utf8');
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object') {
            parsed.networks = parsed.networks && typeof parsed.networks === 'object'
                ? parsed.networks
                : {};

            parsed.transactions = Array.isArray(parsed.transactions)
                ? parsed.transactions
                : [];

            Object.values(parsed.networks).forEach(network => {
                if (!network || typeof network !== 'object') {
                    return;
                }

                network.blocks = network.blocks && typeof network.blocks === 'object'
                    ? network.blocks
                    : {};
                network.blockCount = Number.isFinite(network.blockCount)
                    ? network.blockCount
                    : Object.keys(network.blocks).length;
                if (!network.lastBlockLabel && network.lastBlockNumber !== undefined && network.lastBlockNumber !== null) {
                    network.lastBlockLabel = formatBlockLabel(network.lastBlockNumber);
                }
            });
            return parsed;
        }
        return createEmptySummary();
    } catch (error) {
        if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
            return createEmptySummary();
        }
        throw error;
    }
}

async function writeSummaryFile(summary) {
    await ensureLogsDirectory();
    const payload = JSON.stringify(summary, null, 2);
    await fs.writeFile(summaryFilePath, `${payload}\n`, 'utf8');
}

function inferScopeFromResult(result) {
    if (!result) {
        return null;
    }

    if (result.scope) {
        return result.scope;
    }

    const { targetId, label } = result;
    const normalizedId = typeof targetId === 'string' ? targetId.toLowerCase() : '';
    const normalizedLabel = typeof label === 'string' ? label.toLowerCase() : '';

    if (normalizedId.includes('fabric3') || normalizedLabel.includes('fabric 3')) {
        return 'fabric-3';
    }

    if (normalizedId.includes('fabric2')) {
        return 'fabric-2';
    }

    return null;
}

function ensureNetworkSummary(summary, result) {
    if (!summary || !result || !result.targetId) {
        return null;
    }

    const networks = summary.networks;
    const existing = networks[result.targetId];

    if (existing && typeof existing === 'object') {
        return existing;
    }

    const scope = inferScopeFromResult(result);

    const networkSummary = {
        id: result.targetId,
        label: result.label || result.targetId,
        channel: result.channel || null,
        scope: scope || null,
        totalCount: 0,
        successCount: 0,
        failureCount: 0,
        totalLatencyMs: 0,
        totalProcessingTimeMs: 0,
        processingCount: 0,
        totalPayloadBytes: 0,
        totalResultBytes: 0,
        lastUpdatedAt: null,
        lastStatus: null,
        lastMessage: null,
        lastTransactionId: null,
        blocks: {},
        blockCount: 0,
        lastBlockNumber: null,
        lastBlockLabel: null,
        lastBlockUpdatedAt: null,
        firstStartedAt: null,
        lastCompletedAt: null,
    };

    networks[result.targetId] = networkSummary;
    return networkSummary;
}

function applyResultToSummary(networkSummary, result) {
    if (!networkSummary || !result) {
        return;
    }

    if (result.label) {
        networkSummary.label = result.label;
    }

    if (result.channel) {
        networkSummary.channel = result.channel;
    }

    if (result.scope) {
        networkSummary.scope = result.scope;
    } else if (!networkSummary.scope) {
        const inferredScope = inferScopeFromResult(result);
        if (inferredScope) {
            networkSummary.scope = inferredScope;
        }
    }

    networkSummary.totalCount = (networkSummary.totalCount || 0) + 1;

    const hasLatency = typeof result.latencyMs === 'number' && Number.isFinite(result.latencyMs);

    if (result.status === 'success') {
        networkSummary.successCount = (networkSummary.successCount || 0) + 1;
        if (hasLatency) {
            networkSummary.totalLatencyMs = (networkSummary.totalLatencyMs || 0) + result.latencyMs;
        }
    } else {
        networkSummary.failureCount = (networkSummary.failureCount || 0) + 1;
    }

    if (hasLatency) {
        networkSummary.totalProcessingTimeMs = (networkSummary.totalProcessingTimeMs || 0) + result.latencyMs;
        networkSummary.processingCount = (networkSummary.processingCount || 0) + 1;
    }

    if (typeof result.payloadSizeBytes === 'number' && Number.isFinite(result.payloadSizeBytes)) {
        networkSummary.totalPayloadBytes = (networkSummary.totalPayloadBytes || 0) + result.payloadSizeBytes;
    }

    if (typeof result.resultSizeBytes === 'number' && Number.isFinite(result.resultSizeBytes)) {
        networkSummary.totalResultBytes = (networkSummary.totalResultBytes || 0) + result.resultSizeBytes;
    }

    networkSummary.firstStartedAt = selectEarliestTimestamp(networkSummary.firstStartedAt, result.startedAt);
    networkSummary.lastCompletedAt = selectLatestTimestamp(networkSummary.lastCompletedAt, result.completedAt);

    if (result.completedAt) {
        networkSummary.lastUpdatedAt = result.completedAt;
    } else if (result.processedAt) {
        networkSummary.lastUpdatedAt = result.processedAt;
    } else {
        networkSummary.lastUpdatedAt = new Date().toISOString();
    }

    if (result.status) {
        networkSummary.lastStatus = result.status;
    }

    if (result.message) {
        networkSummary.lastMessage = result.message;
    }

    if (result.transactionId) {
        networkSummary.lastTransactionId = result.transactionId;
    }

    const rawBlockNumber = result.commitStatus?.blockNumber ?? result.blockNumber ?? null;
    const normalizedBlock = normalizeBlockNumber(rawBlockNumber);

    if (normalizedBlock !== null) {
        if (!networkSummary.blocks || typeof networkSummary.blocks !== 'object') {
            networkSummary.blocks = {};
        }

        const blockKey = typeof normalizedBlock === 'number' ? String(normalizedBlock) : String(normalizedBlock);
        const existingBlock = networkSummary.blocks[blockKey];

        const blockSummary = existingBlock && typeof existingBlock === 'object'
            ? existingBlock
            : {
                blockNumber: normalizedBlock,
                blockLabel: formatBlockLabel(normalizedBlock),
                totalCount: 0,
                successCount: 0,
                failureCount: 0,
                totalLatencyMs: 0,
                totalProcessingTimeMs: 0,
                processingCount: 0,
                totalPayloadBytes: 0,
                totalResultBytes: 0,
                firstStartedAt: null,
                lastCompletedAt: null,
                lastUpdatedAt: null,
                lastStatus: null,
                lastMessage: null,
                lastTransactionId: null,
            };

        blockSummary.totalCount = (blockSummary.totalCount || 0) + 1;
        if (result.status === 'success') {
            blockSummary.successCount = (blockSummary.successCount || 0) + 1;
            if (typeof result.latencyMs === 'number' && Number.isFinite(result.latencyMs)) {
                blockSummary.totalLatencyMs = (blockSummary.totalLatencyMs || 0) + result.latencyMs;
            }
        } else {
            blockSummary.failureCount = (blockSummary.failureCount || 0) + 1;
        }

        if (hasLatency) {
            blockSummary.totalProcessingTimeMs = (blockSummary.totalProcessingTimeMs || 0) + result.latencyMs;
            blockSummary.processingCount = (blockSummary.processingCount || 0) + 1;
        }

        if (typeof result.payloadSizeBytes === 'number' && Number.isFinite(result.payloadSizeBytes)) {
            blockSummary.totalPayloadBytes = (blockSummary.totalPayloadBytes || 0) + result.payloadSizeBytes;
        }

        if (typeof result.resultSizeBytes === 'number' && Number.isFinite(result.resultSizeBytes)) {
            blockSummary.totalResultBytes = (blockSummary.totalResultBytes || 0) + result.resultSizeBytes;
        }

        if (networkSummary.lastUpdatedAt) {
            blockSummary.lastUpdatedAt = networkSummary.lastUpdatedAt;
        }
        if (result.status) {
            blockSummary.lastStatus = result.status;
        }
        if (result.message) {
            blockSummary.lastMessage = result.message;
        }
        if (result.transactionId) {
            blockSummary.lastTransactionId = result.transactionId;
        }

        blockSummary.firstStartedAt = selectEarliestTimestamp(blockSummary.firstStartedAt, result.startedAt);
        blockSummary.lastCompletedAt = selectLatestTimestamp(blockSummary.lastCompletedAt, result.completedAt);

        networkSummary.blocks[blockKey] = blockSummary;
        networkSummary.blockCount = Object.keys(networkSummary.blocks).length;
        networkSummary.lastBlockNumber = normalizedBlock;
        networkSummary.lastBlockLabel = blockSummary.blockLabel;
        networkSummary.lastBlockUpdatedAt = blockSummary.lastUpdatedAt;
    }
}

let updateQueue = Promise.resolve();

function enqueueSummaryTask(task) {
    const next = updateQueue.then(task);
    updateQueue = next.catch(() => {});
    return next;
}

export async function appendSimulationResults(results) {
    if (!Array.isArray(results) || results.length === 0) {
        return loadSimulationSummary();
    }

    const operation = async () => {
        const summary = await readSummaryFile();

        if (!Array.isArray(summary.transactions)) {
            summary.transactions = [];
        }

        results.forEach((result) => {
            const networkSummary = ensureNetworkSummary(summary, result);
            if (!networkSummary) {
                return;
            }
            applyResultToSummary(networkSummary, result);

            // Store individual transaction details
            const transaction = {
                transactionId: result.transactionId || null,
                targetId: result.targetId || null,
                targetLabel: result.label || null,
                channel: result.channel || null,
                scope: result.scope || null,
                status: result.status || null,
                message: result.message || null,
                latencyMs: result.latencyMs || null,
                payloadSizeBytes: result.payloadSizeBytes || null,
                resultSizeBytes: result.resultSizeBytes || null,
                blockNumber: result.commitStatus?.blockNumber ?? result.blockNumber ?? null,
                commitCode: result.commitStatus?.code ?? null,
                commitCodeName: result.commitStatus?.codeName ?? null,
                commitSuccessful: result.commitStatus?.successful ?? null,
                startedAt: result.startedAt || null,
                completedAt: result.completedAt || null,
                recordedAt: new Date().toISOString(),
                payload: result.payload || null,
                errorMessage: result.errorMessage || null,
                errorStack: result.errorStack || null,
            };

            summary.transactions.push(transaction);
        });

        summary.updatedAt = new Date().toISOString();
        await writeSummaryFile(summary);
        return summary;
    };

    return enqueueSummaryTask(operation);
}

export async function loadSimulationSummary() {
    await updateQueue.catch(() => {});
    return readSummaryFile();
}

export function getSummaryFilePath() {
    return summaryFilePath;
}

export async function clearSimulationData(targetId = null) {
    const operation = async () => {
        const summary = await readSummaryFile();

        if (targetId) {
            // Clear data for specific network
            if (summary.networks && summary.networks[targetId]) {
                console.log(`[Clear Data] Clearing simulation data for network: ${targetId}`);
                delete summary.networks[targetId];
            }

            // Clear transactions for specific network
            if (Array.isArray(summary.transactions)) {
                const beforeCount = summary.transactions.length;
                summary.transactions = summary.transactions.filter(tx => tx.targetId !== targetId);
                const afterCount = summary.transactions.length;
                console.log(`[Clear Data] Removed ${beforeCount - afterCount} transactions for network: ${targetId}`);
            }
        } else {
            // Clear all simulation data
            console.log('[Clear Data] Clearing all simulation data');
            summary.networks = {};
            summary.transactions = [];
        }

        summary.updatedAt = new Date().toISOString();
        await writeSummaryFile(summary);
        return summary;
    };

    return enqueueSummaryTask(operation);
}

export async function updateNetworkBlockHeights(networkChecks) {
    if (!Array.isArray(networkChecks) || networkChecks.length === 0) {
        return loadSimulationSummary();
    }

    const operation = async () => {
        const summary = await readSummaryFile();

        networkChecks.forEach((check) => {
            if (!check || !check.targetId) {
                return;
            }

            const networkSummary = ensureNetworkSummary(summary, check);
            if (!networkSummary) {
                return;
            }

            // Update block height from network check
            if (check.blockHeight !== null && check.blockHeight !== undefined) {
                const rawBlockHeight = check.blockHeight;
                let actualBlockHeight;

                if (typeof rawBlockHeight === 'bigint') {
                    actualBlockHeight = rawBlockHeight <= BigInt(Number.MAX_SAFE_INTEGER)
                        ? Number(rawBlockHeight)
                        : Number(rawBlockHeight.toString());
                } else if (typeof rawBlockHeight === 'number') {
                    actualBlockHeight = rawBlockHeight;
                } else if (typeof rawBlockHeight === 'string') {
                    actualBlockHeight = Number.parseInt(rawBlockHeight, 10);
                } else {
                    actualBlockHeight = null;
                }

                // Detect network restart: if current network block height is less than stored block height
                // and there's existing transaction data, the network was likely restarted
                if (actualBlockHeight !== null && !isNaN(actualBlockHeight)) {
                    const storedBlockNumber = networkSummary.lastBlockNumber;
                    const hasStoredData = storedBlockNumber !== null &&
                                         storedBlockNumber !== undefined &&
                                         (networkSummary.totalCount > 0 || Object.keys(networkSummary.blocks || {}).length > 0);

                    // Network restart detected: new block height is significantly lower than stored
                    // (allowing for small variations but detecting clear restarts)
                    if (hasStoredData && actualBlockHeight < storedBlockNumber && (storedBlockNumber - actualBlockHeight) > 5) {
                        console.log(`[Network Restart Detected] ${check.targetId}: block height dropped from ${storedBlockNumber} to ${actualBlockHeight}. Clearing local data...`);

                        // Clear all data for this network
                        networkSummary.totalCount = 0;
                        networkSummary.successCount = 0;
                        networkSummary.failureCount = 0;
                        networkSummary.totalLatencyMs = 0;
                        networkSummary.totalProcessingTimeMs = 0;
                        networkSummary.processingCount = 0;
                        networkSummary.totalPayloadBytes = 0;
                        networkSummary.totalResultBytes = 0;
                        networkSummary.blocks = {};
                        networkSummary.blockCount = 0;
                        networkSummary.lastBlockNumber = null;
                        networkSummary.lastBlockLabel = null;
                        networkSummary.lastBlockUpdatedAt = null;
                        networkSummary.firstStartedAt = null;
                        networkSummary.lastCompletedAt = null;
                        networkSummary.lastTransactionId = null;

                        // Clear all transactions for this network
                        if (Array.isArray(summary.transactions)) {
                            summary.transactions = summary.transactions.filter(tx => tx.targetId !== check.targetId);
                        }
                    }
                }

                // Subtract 7 blocks (genesis/setup blocks) to get simulation block count
                if (actualBlockHeight !== null && !isNaN(actualBlockHeight) && actualBlockHeight >= 7) {
                    networkSummary.blockCount = actualBlockHeight - 7;
                    networkSummary.lastBlockNumber = actualBlockHeight - 1; // Zero-indexed
                    networkSummary.lastBlockLabel = formatBlockLabel(actualBlockHeight - 1);
                    networkSummary.lastBlockUpdatedAt = check.timestamp || new Date().toISOString();
                }
            }

            // Update last check status
            if (check.status) {
                networkSummary.lastStatus = check.status;
            }
            if (check.message) {
                networkSummary.lastMessage = check.message;
            }

            networkSummary.lastUpdatedAt = check.timestamp || new Date().toISOString();
        });

        summary.updatedAt = new Date().toISOString();
        await writeSummaryFile(summary);
        return summary;
    };

    return enqueueSummaryTask(operation);
}
