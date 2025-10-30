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
    };
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
        lastUpdatedAt: null,
        lastStatus: null,
        lastMessage: null,
        lastTransactionId: null,
        blocks: {},
        blockCount: 0,
        lastBlockNumber: null,
        lastBlockLabel: null,
        lastBlockUpdatedAt: null,
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

    if (result.status === 'success') {
        networkSummary.successCount = (networkSummary.successCount || 0) + 1;
        if (typeof result.latencyMs === 'number' && Number.isFinite(result.latencyMs)) {
            networkSummary.totalLatencyMs = (networkSummary.totalLatencyMs || 0) + result.latencyMs;
        }
    } else {
        networkSummary.failureCount = (networkSummary.failureCount || 0) + 1;
    }

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
        results.forEach((result) => {
            const networkSummary = ensureNetworkSummary(summary, result);
            if (!networkSummary) {
                return;
            }
            applyResultToSummary(networkSummary, result);
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
