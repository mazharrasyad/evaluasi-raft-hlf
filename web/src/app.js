import express from 'express';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

import { checkNetworkHealth } from './network-check.js';
import { submitSimulationRecord } from './simulation-ingest.js';
import { loadFabricDescriptions } from './fabric-description.js';
import { appendSimulationResults, loadSimulationSummary } from './simulation-summary-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFileAsync = promisify(execFile);

const logsRoot = path.resolve(__dirname, '../logs');
const networkShutdownLogPath = path.resolve(logsRoot, 'network-shutdown.log');
const networkStartupLogPath = path.resolve(logsRoot, 'network-start.log');
const EXEC_MAX_BUFFER = 20 * 1024 * 1024;

const networkOperationEmitter = new EventEmitter();
networkOperationEmitter.setMaxListeners(0);

function broadcastNetworkOperationEvent(event) {
    if (!event || typeof event !== 'object') {
        return;
    }

    const payload = {
        timestamp: new Date().toISOString(),
        ...event,
    };

    networkOperationEmitter.emit('event', payload);
}

async function logNetworkShutdownFailure(result) {
    try {
        await fs.mkdir(logsRoot, { recursive: true });

        const timestamp = new Date().toISOString();
        const {
            label,
            networkDir,
            command,
            status,
            message,
            resolution,
            error,
            stdout,
            stderr,
        } = result;

        const logLines = [
            `[${timestamp}] Gagal mematikan jaringan: ${label}`,
            `Status: ${status}`,
            `Direktori: ${networkDir ?? '-'}`,
            `Perintah: ${command ?? '-'}`,
        ];

        if (message) {
            logLines.push(`Pesan: ${message}`);
        }

        if (resolution) {
            logLines.push(`Tindakan: ${resolution}`);
        }

        if (error) {
            logLines.push(`Error: ${error}`);
        }

        if (stdout) {
            logLines.push(`STDOUT: ${stdout.trim()}`);
        }

        if (stderr) {
            logLines.push(`STDERR: ${stderr.trim()}`);
        }

        const logEntry = `${logLines.join('\n')}\n\n`;
        await fs.appendFile(networkShutdownLogPath, logEntry, 'utf8');
    } catch (loggingError) {
        console.error('Failed to write network shutdown log:', loggingError);
    }
}

async function logNetworkStartupFailure(result) {
    try {
        await fs.mkdir(logsRoot, { recursive: true });

        const timestamp = new Date().toISOString();
        const {
            label,
            networkDir,
            status,
            message,
            resolution,
            error,
            steps,
        } = result;

        const logLines = [
            `[${timestamp}] Gagal menyalakan jaringan: ${label}`,
            `Status: ${status}`,
            `Direktori: ${networkDir ?? '-'}`,
        ];

        if (message) {
            logLines.push(`Pesan: ${message}`);
        }

        if (resolution) {
            logLines.push(`Tindakan: ${resolution}`);
        }

        if (Array.isArray(steps) && steps.length) {
            steps.forEach((step, index) => {
                const stepLabel = step?.label || `Langkah ${index + 1}`;
                const statusLabel = step?.status || 'unknown';
                logLines.push(`Langkah ${index + 1}: ${stepLabel} — ${statusLabel}`);

                if (step?.displayCommand) {
                    logLines.push(`  Perintah: ${step.displayCommand}`);
                }

                if (step?.message) {
                    logLines.push(`  Pesan: ${step.message}`);
                }

                if (step?.resolution) {
                    logLines.push(`  Tindakan: ${step.resolution}`);
                }

                if (step?.error) {
                    logLines.push(`  Error: ${step.error}`);
                }

                if (step?.stdout) {
                    logLines.push(`  STDOUT: ${String(step.stdout).trim()}`);
                }

                if (step?.stderr) {
                    logLines.push(`  STDERR: ${String(step.stderr).trim()}`);
                }
            });
        }

        if (error) {
            logLines.push(`Error: ${error}`);
        }

        const logEntry = `${logLines.join('\n')}\n\n`;
        await fs.appendFile(networkStartupLogPath, logEntry, 'utf8');
    } catch (loggingError) {
        console.error('Failed to write network startup log:', loggingError);
    }
}

const NETWORK_SHUTDOWN_TARGETS = [
    {
        id: 'standard',
        label: 'RAFT Standard Network',
        directory: path.resolve(__dirname, '../../fabric-2/raft-standard/network'),
    },
    {
        id: 'variant',
        label: 'RAFT Variant Network',
        directory: path.resolve(__dirname, '../../fabric-2/raft-variant/network'),
    },
    {
        id: 'fabric3-standard',
        label: 'Fabric 3 RAFT Standard Network',
        directory: path.resolve(__dirname, '../../fabric-3/raft-standard/network'),
    },
    {
        id: 'fabric3-variant',
        label: 'Fabric 3 RAFT Variant Network',
        directory: path.resolve(__dirname, '../../fabric-3/raft-variant/network'),
    },
];

const NETWORK_START_TARGETS = [
    {
        id: 'standard',
        label: 'RAFT Standard Network',
        directory: path.resolve(__dirname, '../../fabric-2/raft-standard/network'),
        channel: 'fabric2-channel-standard',
        commands: [
            {
                label: 'Start core services',
                args: ['up', '-ca'],
                displayCommand: './network.sh up -ca',
            },
            {
                label: 'Create channel',
                args: ['createChannel', '-c', 'fabric2-channel-standard', '-ca'],
                displayCommand: './network.sh createChannel -c fabric2-channel-standard -ca',
            },
            {
                label: 'Deploy chaincode',
                args: [
                    'deployCC',
                    '-ccn',
                    'pelaporan',
                    '-ccp',
                    '../chaincode/pelaporan',
                    '-ccl',
                    'javascript',
                    '-c',
                    'fabric2-channel-standard',
                ],
                displayCommand:
                    './network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript -c fabric2-channel-standard',
            },
        ],
    },
    {
        id: 'variant',
        label: 'RAFT Variant Network',
        directory: path.resolve(__dirname, '../../fabric-2/raft-variant/network'),
        channel: 'fabric2-channel-variant',
        commands: [
            {
                label: 'Start core services',
                args: ['up', '-ca', '-bft'],
                displayCommand: './network.sh up -ca -bft',
            },
            {
                label: 'Create channel',
                args: ['createChannel', '-c', 'fabric2-channel-variant', '-ca', '-bft'],
                displayCommand: './network.sh createChannel -c fabric2-channel-variant -ca -bft',
            },
            {
                label: 'Deploy chaincode',
                args: [
                    'deployCC',
                    '-ccn',
                    'pelaporan',
                    '-ccp',
                    '../chaincode/pelaporan',
                    '-ccl',
                    'javascript',
                    '-c',
                    'fabric2-channel-variant',
                    '-bft',
                ],
                displayCommand:
                    './network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript -c fabric2-channel-variant -bft',
            },
        ],
    },
    {
        id: 'fabric3-standard',
        label: 'Fabric 3 RAFT Standard Network',
        directory: path.resolve(__dirname, '../../fabric-3/raft-standard/network'),
        channel: 'fabric3-channel-standard',
        commands: [
            {
                label: 'Start core services',
                args: ['up'],
                displayCommand: './network.sh up',
            },
            {
                label: 'Create channel',
                args: ['createChannel', '-c', 'fabric3-channel-standard'],
                displayCommand: './network.sh createChannel -c fabric3-channel-standard',
            },
            {
                label: 'Deploy chaincode',
                args: [
                    'deployCC',
                    '-ccn',
                    'pelaporan',
                    '-ccp',
                    '../chaincode/pelaporan',
                    '-ccl',
                    'node',
                    '-c',
                    'fabric3-channel-standard',
                ],
                displayCommand:
                    './network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl node -c fabric3-channel-standard',
            },
        ],
    },
    {
        id: 'fabric3-variant',
        label: 'Fabric 3 RAFT Variant Network',
        directory: path.resolve(__dirname, '../../fabric-3/raft-variant/network'),
        channel: 'fabric3-channel-variant',
        commands: [
            {
                label: 'Start core services',
                args: ['up'],
                displayCommand: './network.sh up',
            },
            {
                label: 'Create channel',
                args: ['createChannel', '-c', 'fabric3-channel-variant'],
                displayCommand: './network.sh createChannel -c fabric3-channel-variant',
            },
            {
                label: 'Deploy chaincode',
                args: [
                    'deployCC',
                    '-ccn',
                    'pelaporan',
                    '-ccp',
                    '../chaincode/pelaporan',
                    '-ccl',
                    'node',
                    '-c',
                    'fabric3-channel-variant',
                ],
                displayCommand:
                    './network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl node -c fabric3-channel-variant',
            },
        ],
    },
];

const NETWORK_SIMULATION_ENDPOINTS = {
    'fabric2-raft-standard': {
        candidateIds: ['channel-standard', 'standard'],
        scope: 'fabric-2',
        channel: 'fabric2-channel-standard',
        defaultLabel: 'Fabric 2 RAFT Standard',
        labels: ['RAFT Standard Network', 'RAFT Standard', 'Fabric 2 RAFT Standard'],
    },
    'fabric2-raft-variant': {
        candidateIds: ['channel-variant', 'variant'],
        scope: 'fabric-2',
        channel: 'fabric2-channel-variant',
        defaultLabel: 'Fabric 2 RAFT Variant',
        labels: ['RAFT Variant Network', 'RAFT Variant', 'Fabric 2 RAFT Variant'],
    },
    'fabric3-raft-standard': {
        candidateIds: ['channel-fabric3-standard', 'fabric3-standard'],
        scope: 'fabric-3',
        channel: 'fabric3-channel-standard',
        defaultLabel: 'Fabric 3 RAFT Standard',
        labels: ['Fabric 3 RAFT Standard Network', 'Fabric 3 RAFT Standard'],
    },
    'fabric3-raft-variant': {
        candidateIds: ['channel-fabric3-variant', 'fabric3-variant'],
        scope: 'fabric-3',
        channel: 'fabric3-channel-variant',
        defaultLabel: 'Fabric 3 RAFT Variant',
        labels: ['Fabric 3 RAFT Variant Network', 'Fabric 3 RAFT Variant'],
    },
};

function parseTimestampToMs(value) {
    if (!value) {
        return null;
    }

    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
}

function calculateDurationMs(startValue, endValue) {
    const start = parseTimestampToMs(startValue);
    const end = parseTimestampToMs(endValue);

    if (start === null || end === null) {
        return null;
    }

    const duration = end - start;
    return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

function computeThroughput(successCount, durationMs) {
    if (!Number.isFinite(successCount) || successCount <= 0) {
        return null;
    }

    if (!Number.isFinite(durationMs) || durationMs < 0) {
        return null;
    }

    if (durationMs === 0) {
        return successCount;
    }

    return successCount / (durationMs / 1000);
}

function selectEarliestTimestampString(current, candidate) {
    const candidateTime = parseTimestampToMs(candidate);
    if (candidateTime === null) {
        return current ?? null;
    }

    const currentTime = parseTimestampToMs(current);
    if (currentTime === null || candidateTime < currentTime) {
        return new Date(candidateTime).toISOString();
    }

    return current;
}

function selectLatestTimestampString(current, candidate) {
    const candidateTime = parseTimestampToMs(candidate);
    if (candidateTime === null) {
        return current ?? null;
    }

    const currentTime = parseTimestampToMs(current);
    if (currentTime === null || candidateTime > currentTime) {
        return new Date(candidateTime).toISOString();
    }

    return current;
}

function toBlockSummary(block) {
    if (!block || typeof block !== 'object') {
        return null;
    }

    const blockSuccessCount = Number.isFinite(block.successCount) ? block.successCount : 0;
    const blockFailureCount = Number.isFinite(block.failureCount) ? block.failureCount : 0;
    const blockTotalCount = Number.isFinite(block.totalCount)
        ? block.totalCount
        : blockSuccessCount + blockFailureCount;
    const blockTotalLatencyMs = Number.isFinite(block.totalLatencyMs) ? block.totalLatencyMs : 0;
    const blockTotalProcessingTimeMs = Number.isFinite(block.totalProcessingTimeMs)
        ? block.totalProcessingTimeMs
        : blockTotalLatencyMs;
    const blockProcessingCount = Number.isFinite(block.processingCount)
        ? block.processingCount
        : (blockSuccessCount > 0 ? blockSuccessCount : (blockTotalCount > 0 ? blockTotalCount : 0));
    const blockAverageLatencyMs = blockSuccessCount > 0
        ? blockTotalLatencyMs / blockSuccessCount
        : null;
    const blockAverageCommitTimeMs = blockProcessingCount > 0
        ? blockTotalProcessingTimeMs / blockProcessingCount
        : (blockAverageLatencyMs ?? null);
    const blockTotalPayloadBytes = Number.isFinite(block.totalPayloadBytes) ? block.totalPayloadBytes : 0;
    const blockTotalResultBytes = Number.isFinite(block.totalResultBytes) ? block.totalResultBytes : 0;
    const blockAveragePayloadSizeBytes = blockTotalCount > 0 && blockTotalPayloadBytes > 0
        ? blockTotalPayloadBytes / blockTotalCount
        : (blockTotalPayloadBytes > 0 ? blockTotalPayloadBytes : 0);
    const blockAverageResultSizeBytes = blockSuccessCount > 0 && blockTotalResultBytes > 0
        ? blockTotalResultBytes / blockSuccessCount
        : (blockTotalResultBytes > 0 ? blockTotalResultBytes : 0);
    const blockFirstStartedAt = block.firstStartedAt || null;
    const blockLastCompletedAt = block.lastCompletedAt || block.lastUpdatedAt || null;
    const blockObservationDurationMs = calculateDurationMs(blockFirstStartedAt, blockLastCompletedAt);
    const blockThroughput = computeThroughput(blockSuccessCount, blockObservationDurationMs);

    return {
        blockNumber: block.blockNumber ?? null,
        blockLabel: block.blockLabel
            || (block.blockNumber !== undefined && block.blockNumber !== null
                ? `#${block.blockNumber}`
                : null),
        totalCount: blockTotalCount,
        successCount: blockSuccessCount,
        failureCount: blockFailureCount,
        totalLatencyMs: blockTotalLatencyMs,
        averageLatencyMs: blockAverageLatencyMs,
        totalProcessingTimeMs: blockTotalProcessingTimeMs,
        averageCommitTimeMs: blockAverageCommitTimeMs,
        processingCount: blockProcessingCount,
        totalPayloadBytes: blockTotalPayloadBytes,
        totalResultBytes: blockTotalResultBytes,
        averagePayloadSizeBytes: blockAveragePayloadSizeBytes,
        averageResultSizeBytes: blockAverageResultSizeBytes,
        throughput: blockThroughput,
        observationDurationMs: blockObservationDurationMs,
        firstStartedAt: blockFirstStartedAt,
        lastCompletedAt: blockLastCompletedAt,
        lastUpdatedAt: block.lastUpdatedAt || null,
        lastStatus: block.lastStatus || null,
        lastMessage: block.lastMessage || null,
        lastTransactionId: block.lastTransactionId || null,
    };
}

function compareBlockSummaries(a, b) {
    const aNumeric = typeof a.blockNumber === 'number' && Number.isFinite(a.blockNumber)
        ? a.blockNumber
        : null;
    const bNumeric = typeof b.blockNumber === 'number' && Number.isFinite(b.blockNumber)
        ? b.blockNumber
        : null;

    if (aNumeric !== null || bNumeric !== null) {
        if (aNumeric === null) {
            return 1;
        }
        if (bNumeric === null) {
            return -1;
        }
        return aNumeric - bNumeric;
    }

    const aLabel = a.blockLabel || '';
    const bLabel = b.blockLabel || '';
    return aLabel.localeCompare(bLabel);
}

function selectLatestBlock(blockSummaries) {
    return blockSummaries.reduce((latest, current) => {
        if (!current) {
            return latest;
        }
        if (!latest) {
            return current;
        }

        const latestTime = latest.lastUpdatedAt ? Date.parse(latest.lastUpdatedAt) : Number.NaN;
        const currentTime = current.lastUpdatedAt ? Date.parse(current.lastUpdatedAt) : Number.NaN;

        const latestTimeValid = Number.isFinite(latestTime);
        const currentTimeValid = Number.isFinite(currentTime);

        if (latestTimeValid || currentTimeValid) {
            if (!latestTimeValid) {
                return current;
            }
            if (!currentTimeValid) {
                return latest;
            }
            return currentTime >= latestTime ? current : latest;
        }

        const latestNumeric = typeof latest.blockNumber === 'number' && Number.isFinite(latest.blockNumber)
            ? latest.blockNumber
            : Number.NEGATIVE_INFINITY;
        const currentNumeric = typeof current.blockNumber === 'number' && Number.isFinite(current.blockNumber)
            ? current.blockNumber
            : Number.NEGATIVE_INFINITY;

        if (currentNumeric !== latestNumeric) {
            return currentNumeric > latestNumeric ? current : latest;
        }

        const latestLabel = latest.blockLabel || '';
        const currentLabel = current.blockLabel || '';
        return currentLabel.localeCompare(latestLabel) >= 0 ? current : latest;
    }, null);
}

function transformNetworkSummaryItem(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const successCount = Number.isFinite(item.successCount) ? item.successCount : 0;
    const failureCount = Number.isFinite(item.failureCount) ? item.failureCount : 0;
    const totalCount = Number.isFinite(item.totalCount)
        ? item.totalCount
        : successCount + failureCount;
    const totalLatencyMs = Number.isFinite(item.totalLatencyMs) ? item.totalLatencyMs : 0;
    const totalProcessingTimeMs = Number.isFinite(item.totalProcessingTimeMs)
        ? item.totalProcessingTimeMs
        : totalLatencyMs;
    const processingCount = Number.isFinite(item.processingCount)
        ? item.processingCount
        : (successCount > 0 ? successCount : totalCount);
    const averageLatencyMs = successCount > 0
        ? totalLatencyMs / successCount
        : null;
    const averageCommitTimeMs = processingCount > 0
        ? totalProcessingTimeMs / processingCount
        : (averageLatencyMs ?? null);
    const successRate = totalCount > 0
        ? successCount / totalCount
        : null;
    const totalPayloadBytes = Number.isFinite(item.totalPayloadBytes) ? item.totalPayloadBytes : 0;
    const totalResultBytes = Number.isFinite(item.totalResultBytes) ? item.totalResultBytes : 0;
    const averagePayloadSizeBytes = totalCount > 0 && totalPayloadBytes > 0
        ? totalPayloadBytes / totalCount
        : (totalPayloadBytes > 0 ? totalPayloadBytes : 0);
    const averageResultSizeBytes = successCount > 0 && totalResultBytes > 0
        ? totalResultBytes / successCount
        : (totalResultBytes > 0 ? totalResultBytes : 0);

    const blocksRecord = item.blocks && typeof item.blocks === 'object'
        ? item.blocks
        : {};
    const blockSummaries = Object.values(blocksRecord)
        .filter(block => block && typeof block === 'object')
        .map(toBlockSummary)
        .filter(Boolean)
        .sort(compareBlockSummaries);

    const blockCount = Number.isFinite(item.blockCount)
        ? item.blockCount
        : blockSummaries.length;

    const fallbackLatestBlock = selectLatestBlock(blockSummaries);
    const lastBlockNumber = item.lastBlockNumber ?? fallbackLatestBlock?.blockNumber ?? null;
    const lastBlockLabel = item.lastBlockLabel ?? fallbackLatestBlock?.blockLabel ?? null;
    const lastBlockUpdatedAt = item.lastBlockUpdatedAt ?? fallbackLatestBlock?.lastUpdatedAt ?? null;
    const firstStartedAt = item.firstStartedAt || null;
    const lastCompletedAt = item.lastCompletedAt || item.lastUpdatedAt || null;
    const observationDurationMs = calculateDurationMs(firstStartedAt, lastCompletedAt);
    const throughput = computeThroughput(successCount, observationDurationMs);

    return {
        id: item.id || null,
        label: item.label || item.id || 'Jaringan',
        scope: item.scope || null,
        channel: item.channel || null,
        totalCount,
        successCount,
        failureCount,
        averageLatencyMs,
        averageCommitTimeMs,
        successRate,
        totalLatencyMs,
        totalProcessingTimeMs,
        processingCount,
        totalPayloadBytes,
        totalResultBytes,
        averagePayloadSizeBytes,
        averageResultSizeBytes,
        throughput,
        observationDurationMs,
        blockCount,
        blocks: blockSummaries,
        lastBlockNumber,
        lastBlockLabel,
        lastBlockUpdatedAt,
        lastUpdatedAt: item.lastUpdatedAt || null,
        lastStatus: item.lastStatus || null,
        lastMessage: item.lastMessage || null,
        lastTransactionId: item.lastTransactionId || null,
        firstStartedAt,
        lastCompletedAt,
    };
}

function hasNetworkActivity(network) {
    if (!network || typeof network !== 'object') {
        return false;
    }

    const totalCount = Number.isFinite(network.totalCount) ? network.totalCount : 0;
    const successCount = Number.isFinite(network.successCount) ? network.successCount : 0;
    const failureCount = Number.isFinite(network.failureCount) ? network.failureCount : 0;
    const blockCount = Number.isFinite(network.blockCount) ? network.blockCount : 0;
    const blocksRecord = network.blocks && typeof network.blocks === 'object'
        ? network.blocks
        : {};
    const derivedBlockCount = blockCount
        || Object.values(blocksRecord).filter(block => block && typeof block === 'object').length;

    return totalCount > 0 || successCount > 0 || failureCount > 0 || derivedBlockCount > 0;
}

function findNetworkSummaryEntry(networksRecord, config) {
    if (!networksRecord || typeof networksRecord !== 'object') {
        return null;
    }

    if (Array.isArray(config.candidateIds)) {
        for (const candidateId of config.candidateIds) {
            if (candidateId && typeof networksRecord[candidateId] === 'object') {
                return networksRecord[candidateId];
            }
        }
    }

    const entries = Object.values(networksRecord)
        .filter(entry => entry && typeof entry === 'object');

    return entries.find(entry => {
        if (!entry || typeof entry !== 'object') {
            return false;
        }

        if (Array.isArray(config.candidateIds) && config.candidateIds.includes(entry.id)) {
            return true;
        }

        if (config.channel && entry.channel === config.channel) {
            if (!config.scope || entry.scope === config.scope) {
                return true;
            }
        }

        if (Array.isArray(config.labels) && config.labels.length) {
            if (config.labels.includes(entry.label)) {
                if (!config.scope || entry.scope === config.scope) {
                    return true;
                }
            }
        }

        return false;
    }) || null;
}

function createDefaultNetworkRecord(slug, config) {
    const defaultId = Array.isArray(config.candidateIds) && config.candidateIds.length
        ? config.candidateIds[0]
        : slug;

    const defaultLabel = config.defaultLabel
        || (Array.isArray(config.labels) && config.labels.length ? config.labels[0] : defaultId);

    return {
        id: defaultId,
        label: defaultLabel,
        scope: config.scope || null,
        channel: config.channel || null,
        totalCount: 0,
        successCount: 0,
        failureCount: 0,
        totalLatencyMs: 0,
        blocks: {},
        blockCount: 0,
        lastUpdatedAt: null,
        lastStatus: null,
        lastMessage: null,
        lastTransactionId: null,
        lastBlockNumber: null,
        lastBlockLabel: null,
        lastBlockUpdatedAt: null,
    };
}

function applyConfigDefaultsToRecord(record, slug, config) {
    const baseRecord = record ? { ...record } : createDefaultNetworkRecord(slug, config);

    if (!baseRecord.id && Array.isArray(config.candidateIds) && config.candidateIds.length) {
        baseRecord.id = config.candidateIds[0];
    }

    if (!baseRecord.label && config.defaultLabel) {
        baseRecord.label = config.defaultLabel;
    }

    if (!baseRecord.scope && config.scope) {
        baseRecord.scope = config.scope;
    }

    if (!baseRecord.channel && config.channel) {
        baseRecord.channel = config.channel;
    }

    return baseRecord;
}

function buildConfiguredNetworkSummary(slug, config, networksRecord) {
    const matchedNetwork = findNetworkSummaryEntry(networksRecord, config);
    const hasSimulationData = hasNetworkActivity(matchedNetwork);
    const preparedRecord = applyConfigDefaultsToRecord(matchedNetwork, slug, config);
    const networkSummary = transformNetworkSummaryItem(preparedRecord);

    if (networkSummary) {
        networkSummary.slug = slug;
        networkSummary.hasSimulationData = hasSimulationData;
    }

    return { networkSummary, matchedNetwork, hasSimulationData };
}

function getContainerCliVersionCommand() {
    const rawValue = process.env.CONTAINER_CLI?.trim();
    const parts = rawValue ? rawValue.split(/\s+/).filter(Boolean) : [];
    const binary = parts.shift() || 'docker';
    const args = [...parts, 'version'];
    const display = [binary, ...args].join(' ').trim();
    const binaryName = path.basename(binary);
    const friendlyName = binaryName === 'docker' ? 'Docker' : binaryName;

    return {
        binary,
        args,
        display: display || binaryName,
        binaryName,
        friendlyName,
    };
}

async function ensureDockerAvailable() {
    const commandInfo = getContainerCliVersionCommand();

    try {
        await execFileAsync(commandInfo.binary, commandInfo.args);
        return null;
    } catch (error) {
        const stdout = error?.stdout ? String(error.stdout) : undefined;
        const stderr = error?.stderr ? String(error.stderr) : undefined;
        const isMissingBinary = error?.code === 'ENOENT';

        return {
            command: commandInfo.display,
            status: isMissingBinary ? 'dependency_missing' : 'error',
            message: isMissingBinary
                ? `Perintah ${commandInfo.binaryName} tidak ditemukan di server gateway.`
                : `Gagal menjalankan perintah ${commandInfo.display}.`,
            resolution: `Pastikan ${commandInfo.friendlyName} terpasang, layanan terkait berjalan, dan user memiliki akses ke CLI ${commandInfo.friendlyName}.`,
            error: error instanceof Error ? error.message : String(error),
            stdout,
            stderr,
        };
    }
}

async function executeNetworkShutdown({ id, label, directory }) {
    const scriptPath = path.resolve(directory, 'network.sh');

    try {
        await fs.access(directory, fsConstants.R_OK | fsConstants.X_OK);
    } catch (error) {
        const failureResult = {
            targetId: id,
            label,
            networkDir: directory,
            command: './network.sh down',
            status: 'not_found',
            message: 'Direktori jaringan tidak ditemukan atau tidak dapat diakses.',
            error: error instanceof Error ? error.message : String(error),
        };

        await logNetworkShutdownFailure(failureResult);

        return failureResult;
    }

    try {
        await fs.access(scriptPath, fsConstants.X_OK);
    } catch (error) {
        const failureResult = {
            targetId: id,
            label,
            networkDir: directory,
            command: './network.sh down',
            status: 'not_found',
            message: 'Berkas network.sh tidak ditemukan atau tidak dapat dijalankan.',
            error: error instanceof Error ? error.message : String(error),
        };

        await logNetworkShutdownFailure(failureResult);

        return failureResult;
    }

    try {
        const { stdout, stderr } = await execFileAsync('./network.sh', ['down'], {
            cwd: directory,
            maxBuffer: EXEC_MAX_BUFFER,
        });

        return {
            targetId: id,
            label,
            networkDir: directory,
            command: './network.sh down',
            status: 'success',
            stdout,
            stderr,
        };
    } catch (error) {
        const stdout = error?.stdout ? String(error.stdout) : undefined;
        const stderr = error?.stderr ? String(error.stderr) : undefined;

        const failureResult = {
            targetId: id,
            label,
            networkDir: directory,
            command: './network.sh down',
            status: 'error',
            stdout,
            stderr,
            error: error instanceof Error ? error.message : String(error),
        };

        const errorCode = typeof error?.code === 'number' ? error.code : null;
        if (errorCode !== null) {
            failureResult.exitCode = errorCode;
        }

        const dockerNotFoundMessage = 'docker: command not found';
        if (stderr?.includes(dockerNotFoundMessage) || stdout?.includes(dockerNotFoundMessage)) {
            failureResult.message = 'Perintah docker tidak ditemukan saat menjalankan network.sh.';
            failureResult.resolution = 'Pastikan Docker terpasang dan dapat dijalankan oleh user yang menjalankan gateway.';
        } else if (errorCode === 126 || errorCode === 127) {
            failureResult.message = 'Perintah network.sh tidak dapat dijalankan.';
            failureResult.resolution = 'Periksa izin eksekusi berkas network.sh dan pastikan dependensi shell tersedia.';
        } else {
            failureResult.message = 'Perintah ./network.sh down gagal dijalankan.';
            failureResult.resolution = 'Periksa log pemadaman jaringan untuk rincian lebih lanjut.';
        }

        await logNetworkShutdownFailure(failureResult);

        return failureResult;
    }
}

async function executeNetworkStartup({ id, label, directory, commands }, context = {}) {
    const scriptPath = path.resolve(directory, 'network.sh');
    const commandList = Array.isArray(commands) ? commands : [];
    const operationId = typeof context?.operationId === 'string' ? context.operationId : null;
    const clientOperationId = typeof context?.clientOperationId === 'string'
        ? context.clientOperationId
        : null;

    const baseEvent = {
        operationType: 'startup',
        operationId,
        clientOperationId,
        targetLabel: label,
        targetId: id,
        networkDir: directory,
    };

    try {
        await fs.access(directory, fsConstants.R_OK | fsConstants.X_OK);
    } catch (error) {
        const failureResult = {
            targetId: id,
            label,
            networkDir: directory,
            status: 'not_found',
            message: 'Direktori jaringan tidak ditemukan atau tidak dapat diakses.',
            error: error instanceof Error ? error.message : String(error),
        };

        await logNetworkStartupFailure(failureResult);
        broadcastNetworkOperationEvent({
            ...baseEvent,
            phase: 'target_error',
            status: 'not_found',
            message: failureResult.message,
            error: failureResult.error,
        });

        return failureResult;
    }

    try {
        await fs.access(scriptPath, fsConstants.X_OK);
    } catch (error) {
        const failureResult = {
            targetId: id,
            label,
            networkDir: directory,
            status: 'not_found',
            message: 'Berkas network.sh tidak ditemukan atau tidak dapat dijalankan.',
            error: error instanceof Error ? error.message : String(error),
        };

        await logNetworkStartupFailure(failureResult);
        broadcastNetworkOperationEvent({
            ...baseEvent,
            phase: 'target_error',
            status: 'not_found',
            message: failureResult.message,
            error: failureResult.error,
        });

        return failureResult;
    }

    if (!commandList.length) {
        const failureResult = {
            targetId: id,
            label,
            networkDir: directory,
            status: 'error',
            message: 'Tidak ada perintah yang dikonfigurasi untuk menyalakan jaringan.',
        };

        await logNetworkStartupFailure(failureResult);
        broadcastNetworkOperationEvent({
            ...baseEvent,
            phase: 'target_error',
            status: 'error',
            message: failureResult.message,
        });

        return failureResult;
    }

    const steps = [];
    let hasSuccess = false;

    broadcastNetworkOperationEvent({
        ...baseEvent,
        phase: 'target_begin',
        status: 'running',
    });

    for (const command of commandList) {
        const stepResult = {
            label: command.label,
            displayCommand: command.displayCommand,
            args: Array.isArray(command.args) ? command.args : [],
        };

        broadcastNetworkOperationEvent({
            ...baseEvent,
            phase: 'step_begin',
            status: 'running',
            stepLabel: stepResult.label,
            displayCommand: stepResult.displayCommand,
        });

        try {
            const { stdout, stderr } = await execFileAsync('./network.sh', stepResult.args, {
                cwd: directory,
                maxBuffer: EXEC_MAX_BUFFER,
            });

            stepResult.status = 'success';
            stepResult.stdout = stdout;
            stepResult.stderr = stderr;
            steps.push(stepResult);
            hasSuccess = true;

            broadcastNetworkOperationEvent({
                ...baseEvent,
                phase: 'step_success',
                status: 'success',
                stepLabel: stepResult.label,
                displayCommand: stepResult.displayCommand,
                stdout,
                stderr,
            });
        } catch (error) {
            const stdout = error?.stdout ? String(error.stdout) : undefined;
            const stderr = error?.stderr ? String(error.stderr) : undefined;
            const errorCode = typeof error?.code === 'number' ? error.code : null;

            stepResult.status = 'error';
            stepResult.stdout = stdout;
            stepResult.stderr = stderr;
            stepResult.error = error instanceof Error ? error.message : String(error);

            if (stderr?.includes('docker: command not found') || stdout?.includes('docker: command not found')) {
                stepResult.message = 'Perintah docker tidak ditemukan saat menjalankan network.sh.';
                stepResult.resolution = 'Pastikan Docker terpasang dan dapat dijalankan oleh user yang menjalankan gateway.';
            } else if (errorCode === 126 || errorCode === 127) {
                stepResult.message = 'Perintah network.sh tidak dapat dijalankan.';
                stepResult.resolution = 'Periksa izin eksekusi berkas network.sh dan pastikan dependensi shell tersedia.';
            } else {
                stepResult.message = `Perintah ${stepResult.displayCommand || './network.sh'} gagal dijalankan.`;
                stepResult.resolution = 'Periksa log penyalaan jaringan untuk rincian lebih lanjut.';
            }

            steps.push(stepResult);

            broadcastNetworkOperationEvent({
                ...baseEvent,
                phase: 'step_error',
                status: hasSuccess ? 'partial' : 'error',
                stepLabel: stepResult.label,
                displayCommand: stepResult.displayCommand,
                stdout,
                stderr,
                message: stepResult.message,
                resolution: stepResult.resolution,
                error: stepResult.error,
            });

            const failureResult = {
                targetId: id,
                label,
                networkDir: directory,
                status: hasSuccess ? 'partial' : 'error',
                message: stepResult.message,
                resolution: stepResult.resolution,
                error: stepResult.error,
                steps,
            };

            const remainingCommands = commandList.slice(steps.length);
            for (const remaining of remainingCommands) {
                steps.push({
                    label: remaining.label,
                    displayCommand: remaining.displayCommand,
                    status: 'skipped',
                    message: 'Langkah ini dilewati karena perintah sebelumnya gagal.',
                });

                broadcastNetworkOperationEvent({
                    ...baseEvent,
                    phase: 'step_skipped',
                    status: hasSuccess ? 'partial' : 'error',
                    stepLabel: remaining.label,
                    displayCommand: remaining.displayCommand,
                    message: 'Langkah ini dilewati karena perintah sebelumnya gagal.',
                });
            }

            await logNetworkStartupFailure(failureResult);
            broadcastNetworkOperationEvent({
                ...baseEvent,
                phase: 'target_error',
                status: failureResult.status,
                message: failureResult.message,
                resolution: failureResult.resolution,
                error: failureResult.error,
            });

            return failureResult;
        }
    }

    const successResult = {
        targetId: id,
        label,
        networkDir: directory,
        status: 'success',
        steps,
    };

    broadcastNetworkOperationEvent({
        ...baseEvent,
        phase: 'target_complete',
        status: 'success',
    });

    return successResult;
}

const app = express();
app.disable('x-powered-by');

const staticRoot = path.resolve(__dirname, '../public');
const viewsRoot = path.resolve(staticRoot, 'view');

const viewFiles = {
    home: path.resolve(viewsRoot, 'home.html'),
    research: {
        overview: path.resolve(viewsRoot, 'penelitian/gambaran-umum.html'),
        environmentSetup: path.resolve(viewsRoot, 'penelitian/pembangunan-lingkungan-uji.html'),
        experimentDesign: path.resolve(viewsRoot, 'penelitian/rancangan-eksperimen.html'),
        simulationExecution: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi.html'),
        simulationSubsections: {
            menjalankanNetwork: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/menjalankan-network.html'),
            pembuatanDataSimulasi: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/pembuatan-data-simulasi.html'),
            eksekusiSimulasi: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/eksekusi-simulasi.html'),
            pencatatanDataTransaksi: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/pencatatan-data-transaksi.html'),
            penampilanHasil: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/penampilan-hasil.html'),
        },
    },
};

app.use(express.static(staticRoot));
app.use(express.json({ limit: '2mb' }));

app.get('/api/network-operations/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }

    const keepAliveInterval = setInterval(() => {
        res.write(':keep-alive\n\n');
    }, 15000);

    const listener = event => {
        try {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch (error) {
            console.error('Failed to write network operation event:', error);
        }
    };

    networkOperationEmitter.on('event', listener);

    req.on('close', () => {
        clearInterval(keepAliveInterval);
        networkOperationEmitter.off('event', listener);
    });
});

app.get('/', (req, res) => {
    res.sendFile(viewFiles.home);
});

app.get('/penelitian/gambaran-umum', (req, res) => {
    res.sendFile(viewFiles.research.overview);
});

app.get('/penelitian/pembangunan-lingkungan-uji', (req, res) => {
    res.sendFile(viewFiles.research.environmentSetup);
});

app.get('/penelitian/rancangan-eksperimen', (req, res) => {
    res.sendFile(viewFiles.research.experimentDesign);
});
app.get('/penelitian/pelaksanaan-simulasi', (req, res) => {
    res.sendFile(viewFiles.research.simulationExecution);
});

app.get('/penelitian/pelaksanaan-simulasi/menjalankan-network', (req, res) => {
    res.sendFile(viewFiles.research.simulationSubsections.menjalankanNetwork);
});

app.get('/penelitian/pelaksanaan-simulasi/pembuatan-data-simulasi', (req, res) => {
    res.sendFile(viewFiles.research.simulationSubsections.pembuatanDataSimulasi);
});

app.get('/penelitian/pelaksanaan-simulasi/eksekusi-simulasi', (req, res) => {
    res.sendFile(viewFiles.research.simulationSubsections.eksekusiSimulasi);
});

app.get('/penelitian/pelaksanaan-simulasi/pencatatan-data-transaksi', (req, res) => {
    res.sendFile(viewFiles.research.simulationSubsections.pencatatanDataTransaksi);
});

app.get('/penelitian/pelaksanaan-simulasi/penampilan-hasil', (req, res) => {
    res.sendFile(viewFiles.research.simulationSubsections.penampilanHasil);
});

app.get('/dashboard', (req, res) => {
    res.redirect(302, '/');
});

app.get('/api/check-network', async (req, res) => {
    const checkedAt = new Date().toISOString();

    try {
        const rawResults = await checkNetworkHealth();
        const results = Array.isArray(rawResults) ? rawResults : [rawResults];
        const overallStatus = results.length && results.every(item => item.status === 'healthy')
            ? 'healthy'
            : results.some(item => item.status === 'healthy')
                ? 'partial'
                : 'unavailable';

        res.json({
            checkedAt,
            overallStatus,
            results,
        });
    } catch (error) {
        console.error('Failed to check network health:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        const fallbackResult = {
            label: 'Pemeriksaan jaringan',
            networkDir: null,
            channel: null,
            chaincode: null,
            peer: null,
            instructions: null,
            timestamp: checkedAt,
            status: 'error',
            message: errorMessage,
        };

        res.json({
            checkedAt,
            overallStatus: 'unavailable',
            results: [fallbackResult],
            error: errorMessage,
        });
    }
});

app.get('/api/fabric-descriptions', async (req, res) => {
    try {
        const descriptions = await loadFabricDescriptions();

        res.json({
            fetchedAt: new Date().toISOString(),
            descriptions,
        });
    } catch (error) {
        console.error('Failed to load Fabric descriptions:', error);
        const message = error instanceof Error ? error.message : String(error);

        res.status(500).json({
            fetchedAt: new Date().toISOString(),
            error: message,
            descriptions: [],
        });
    }
});

app.get('/api/simulations/summary', async (req, res) => {
    try {
        const rawSummary = await loadSimulationSummary();
        const networksRecord = rawSummary?.networks && typeof rawSummary.networks === 'object'
            ? rawSummary.networks
            : {};

        const usedEntries = new Set();
        const networks = [];

        Object.entries(NETWORK_SIMULATION_ENDPOINTS).forEach(([slug, config]) => {
            const { networkSummary, matchedNetwork } = buildConfiguredNetworkSummary(slug, config, networksRecord);

            if (matchedNetwork && typeof matchedNetwork === 'object') {
                usedEntries.add(matchedNetwork);
            }

            if (networkSummary) {
                networks.push(networkSummary);
            }
        });

        Object.values(networksRecord)
            .filter(entry => entry && typeof entry === 'object' && !usedEntries.has(entry))
            .forEach(entry => {
                const summary = transformNetworkSummaryItem(entry);
                if (summary) {
                    summary.hasSimulationData = hasNetworkActivity(entry);
                    networks.push(summary);
                }
            });

        networks.sort((a, b) => {
            const scopeA = a.scope || '';
            const scopeB = b.scope || '';
            if (scopeA.localeCompare(scopeB) !== 0) {
                return scopeA.localeCompare(scopeB);
            }
            return (a.label || '').localeCompare(b.label || '');
        });

        const overallTotals = networks.reduce((acc, item) => {
            acc.totalCount += item.totalCount || 0;
            acc.successCount += item.successCount || 0;
            acc.failureCount += item.failureCount || 0;
            acc.totalLatencyMs += item.totalLatencyMs || 0;
            acc.totalProcessingTimeMs += item.totalProcessingTimeMs || 0;
            acc.processingCount += item.processingCount || 0;
            acc.totalPayloadBytes += item.totalPayloadBytes || 0;
            acc.totalResultBytes += item.totalResultBytes || 0;
            acc.blockCount += item.blockCount || 0;
            acc.firstStartedAt = selectEarliestTimestampString(acc.firstStartedAt, item.firstStartedAt);
            acc.lastCompletedAt = selectLatestTimestampString(acc.lastCompletedAt, item.lastCompletedAt);
            return acc;
        }, {
            totalCount: 0,
            successCount: 0,
            failureCount: 0,
            totalLatencyMs: 0,
            totalProcessingTimeMs: 0,
            processingCount: 0,
            totalPayloadBytes: 0,
            totalResultBytes: 0,
            blockCount: 0,
            firstStartedAt: null,
            lastCompletedAt: null,
        });

        const averageLatencyMs = overallTotals.successCount > 0
            ? overallTotals.totalLatencyMs / overallTotals.successCount
            : null;
        const averageCommitTimeMs = overallTotals.processingCount > 0
            ? overallTotals.totalProcessingTimeMs / overallTotals.processingCount
            : (averageLatencyMs ?? null);
        const successRate = overallTotals.totalCount > 0
            ? overallTotals.successCount / overallTotals.totalCount
            : null;
        const overallObservationDurationMs = calculateDurationMs(
            overallTotals.firstStartedAt,
            overallTotals.lastCompletedAt,
        );
        const throughput = computeThroughput(overallTotals.successCount, overallObservationDurationMs);
        const averagePayloadSizeBytes = overallTotals.totalCount > 0 && overallTotals.totalPayloadBytes > 0
            ? overallTotals.totalPayloadBytes / overallTotals.totalCount
            : (overallTotals.totalPayloadBytes > 0 ? overallTotals.totalPayloadBytes : 0);
        const averageResultSizeBytes = overallTotals.successCount > 0 && overallTotals.totalResultBytes > 0
            ? overallTotals.totalResultBytes / overallTotals.successCount
            : (overallTotals.totalResultBytes > 0 ? overallTotals.totalResultBytes : 0);

        res.json({
            fetchedAt: new Date().toISOString(),
            updatedAt: rawSummary?.updatedAt || null,
            networks,
            overall: {
                totalCount: overallTotals.totalCount,
                successCount: overallTotals.successCount,
                failureCount: overallTotals.failureCount,
                averageLatencyMs,
                averageCommitTimeMs,
                successRate,
                blockCount: overallTotals.blockCount,
                totalLatencyMs: overallTotals.totalLatencyMs,
                totalProcessingTimeMs: overallTotals.totalProcessingTimeMs,
                processingCount: overallTotals.processingCount,
                totalPayloadBytes: overallTotals.totalPayloadBytes,
                totalResultBytes: overallTotals.totalResultBytes,
                throughput,
                averagePayloadSizeBytes,
                averageResultSizeBytes,
                observationDurationMs: overallObservationDurationMs,
                firstStartedAt: overallTotals.firstStartedAt,
                lastCompletedAt: overallTotals.lastCompletedAt,
            },
        });
    } catch (error) {
        console.error('Failed to load simulation summary:', error);
        const message = error instanceof Error ? error.message : String(error);

        res.status(500).json({
            fetchedAt: new Date().toISOString(),
            error: message,
            networks: [],
            overall: {
                totalCount: 0,
                successCount: 0,
                failureCount: 0,
                averageLatencyMs: null,
                successRate: null,
                blockCount: 0,
            },
        });
    }
});

Object.entries(NETWORK_SIMULATION_ENDPOINTS).forEach(([slug, config]) => {
    app.get(`/api/${slug}`, async (req, res) => {
        try {
            const rawSummary = await loadSimulationSummary();
            const networksRecord = rawSummary?.networks && typeof rawSummary.networks === 'object'
                ? rawSummary.networks
                : {};

            const { networkSummary, hasSimulationData } = buildConfiguredNetworkSummary(
                slug,
                config,
                networksRecord,
            );

            res.json({
                fetchedAt: new Date().toISOString(),
                updatedAt: rawSummary?.updatedAt || null,
                hasSimulationData,
                network: networkSummary,
            });
        } catch (error) {
            console.error(`Failed to load simulation summary for ${slug}:`, error);
            const message = error instanceof Error ? error.message : String(error);

            res.status(500).json({
                fetchedAt: new Date().toISOString(),
                error: message,
                hasSimulationData: false,
                network: null,
            });
        }
    });
});

app.post('/api/start-network', async (req, res) => {
    const requestedAt = new Date().toISOString();
    const results = [];

    const rawClientOperationId = req.get('x-client-operation-id');
    const clientOperationId = typeof rawClientOperationId === 'string'
        ? rawClientOperationId.trim().slice(0, 200)
        : null;
    const operationId = randomUUID();
    const operationContext = { operationId, clientOperationId };

    const rawNetworkType = typeof req.body?.networkType === 'string'
        ? req.body.networkType.trim().toLowerCase()
        : null;
    const selectedTargets = rawNetworkType
        ? NETWORK_START_TARGETS.filter(target => target.id === rawNetworkType)
        : NETWORK_START_TARGETS;

    if (rawNetworkType && selectedTargets.length === 0) {
        const completedAt = new Date().toISOString();
        res.status(400).json({
            requestedAt,
            completedAt,
            overallStatus: 'error',
            operationId,
            clientOperationId,
            error: 'Jaringan yang diminta tidak ditemukan.',
            results: [],
            networkType: rawNetworkType,
        });
        return;
    }

    if (selectedTargets.length === 0) {
        const completedAt = new Date().toISOString();
        res.status(500).json({
            requestedAt,
            completedAt,
            overallStatus: 'error',
            operationId,
            clientOperationId,
            error: 'Tidak ada jaringan yang dikonfigurasi untuk dijalankan.',
            results: [],
        });
        return;
    }

    const targetIds = selectedTargets.map(target => target.id);

    broadcastNetworkOperationEvent({
        operationType: 'startup',
        phase: 'begin',
        status: 'running',
        operationId,
        clientOperationId,
        requestedAt,
        networkType: rawNetworkType,
        targetIds,
    });

    const dockerFailure = await ensureDockerAvailable();
    if (dockerFailure) {
        broadcastNetworkOperationEvent({
            operationType: 'startup',
            phase: 'dependency_error',
            status: dockerFailure.status,
            operationId,
            clientOperationId,
            message: dockerFailure.message,
            resolution: dockerFailure.resolution,
            error: dockerFailure.error,
            networkType: rawNetworkType,
            targetIds,
        });

        for (const target of selectedTargets) {
            const failureResult = {
                targetId: target.id,
                label: target.label,
                networkDir: target.directory,
                status: dockerFailure.status,
                ...dockerFailure,
            };

            await logNetworkStartupFailure(failureResult);
            results.push(failureResult);
        }

        const completedAt = new Date().toISOString();

        broadcastNetworkOperationEvent({
            operationType: 'startup',
            phase: 'complete',
            status: 'error',
            operationId,
            clientOperationId,
            completedAt,
            networkType: rawNetworkType,
            targetIds,
        });

        res.json({
            requestedAt,
            completedAt,
            overallStatus: 'error',
            dependencyStatus: 'docker_unavailable',
            operationId,
            clientOperationId,
            results,
            networkType: rawNetworkType,
        });

        return;
    }

    for (const target of selectedTargets) {
        const result = await executeNetworkStartup(target, operationContext);
        results.push(result);
    }

    const completedAt = new Date().toISOString();
    const successCount = results.filter(result => result.status === 'success').length;
    const overallStatus = successCount === results.length
        ? 'success'
        : successCount > 0
            ? 'partial'
            : 'error';

    broadcastNetworkOperationEvent({
        operationType: 'startup',
        phase: 'complete',
        status: overallStatus,
        operationId,
        clientOperationId,
        completedAt,
        networkType: rawNetworkType,
        targetIds,
    });

    res.json({
        requestedAt,
        completedAt,
        overallStatus,
        operationId,
        clientOperationId,
        results,
        networkType: rawNetworkType,
    });
});

app.post('/api/shutdown-network', async (req, res) => {
    const requestedAt = new Date().toISOString();
    const rawNetworkType = typeof req.body?.networkType === 'string'
        ? req.body.networkType.trim().toLowerCase()
        : null;

    let selectedTargets = NETWORK_SHUTDOWN_TARGETS;
    let normalizedNetworkType = null;

    if (rawNetworkType) {
        const matchingTarget = NETWORK_SHUTDOWN_TARGETS.find(target => target.id === rawNetworkType);

        if (!matchingTarget) {
            const completedAt = new Date().toISOString();

            res.status(400).json({
                requestedAt,
                completedAt,
                overallStatus: 'error',
                error: 'Tipe jaringan tidak dikenal.',
                code: 'unknown_network_type',
            });

            return;
        }

        normalizedNetworkType = matchingTarget.id;
        selectedTargets = [matchingTarget];
    }

    const results = [];

    const dockerFailure = await ensureDockerAvailable();
    if (dockerFailure) {
        for (const target of selectedTargets) {
            const failureResult = {
                label: target.label,
                networkDir: target.directory,
                ...dockerFailure,
            };

            await logNetworkShutdownFailure(failureResult);
            results.push(failureResult);
        }

        const completedAt = new Date().toISOString();

        res.json({
            requestedAt,
            completedAt,
            overallStatus: 'error',
            dependencyStatus: 'docker_unavailable',
            results,
            networkType: normalizedNetworkType,
        });

        return;
    }

    for (const target of selectedTargets) {
        const result = await executeNetworkShutdown(target);
        results.push(result);
    }

    const completedAt = new Date().toISOString();
    const successCount = results.filter(result => result.status === 'success').length;
    const overallStatus = successCount === results.length
        ? 'success'
        : successCount > 0
            ? 'partial'
            : 'error';

    res.json({
        requestedAt,
        completedAt,
        overallStatus,
        results,
        networkType: normalizedNetworkType,
    });
});

app.post('/api/create-channel', async (req, res) => {
    const requestedAt = new Date().toISOString();
    const rawNetworkType = typeof req.body?.networkType === 'string'
        ? req.body.networkType.trim().toLowerCase()
        : null;

    if (!rawNetworkType) {
        res.status(400).json({
            requestedAt,
            completedAt: new Date().toISOString(),
            overallStatus: 'error',
            error: 'Parameter networkType diperlukan.',
        });
        return;
    }

    const target = NETWORK_START_TARGETS.find(t => t.id === rawNetworkType);

    if (!target) {
        res.status(400).json({
            requestedAt,
            completedAt: new Date().toISOString(),
            overallStatus: 'error',
            error: 'Tipe jaringan tidak dikenal.',
        });
        return;
    }

    const dockerFailure = await ensureDockerAvailable();
    if (dockerFailure) {
        const failureResult = {
            targetId: target.id,
            label: target.label,
            networkDir: target.directory,
            status: dockerFailure.status,
            ...dockerFailure,
        };

        await logNetworkStartupFailure(failureResult);

        res.json({
            requestedAt,
            completedAt: new Date().toISOString(),
            overallStatus: 'error',
            dependencyStatus: 'docker_unavailable',
            results: [failureResult],
            networkType: rawNetworkType,
        });
        return;
    }

    const scriptPath = path.resolve(target.directory, 'network.sh');

    try {
        await fs.access(target.directory, fsConstants.R_OK | fsConstants.X_OK);
    } catch (error) {
        res.status(500).json({
            requestedAt,
            completedAt: new Date().toISOString(),
            overallStatus: 'error',
            error: 'Direktori jaringan tidak ditemukan atau tidak dapat diakses.',
        });
        return;
    }

    try {
        await fs.access(scriptPath, fsConstants.X_OK);
    } catch (error) {
        res.status(500).json({
            requestedAt,
            completedAt: new Date().toISOString(),
            overallStatus: 'error',
            error: 'Berkas network.sh tidak ditemukan atau tidak dapat dijalankan.',
        });
        return;
    }

    // Find the createChannel command from the target's commands
    const createChannelCommand = target.commands.find(cmd => cmd.args[0] === 'createChannel');

    if (!createChannelCommand) {
        res.status(500).json({
            requestedAt,
            completedAt: new Date().toISOString(),
            overallStatus: 'error',
            error: 'Perintah createChannel tidak ditemukan untuk jaringan ini.',
        });
        return;
    }

    try {
        const { stdout, stderr } = await execFileAsync('./network.sh', createChannelCommand.args, {
            cwd: target.directory,
            maxBuffer: EXEC_MAX_BUFFER,
        });

        const completedAt = new Date().toISOString();

        res.json({
            requestedAt,
            completedAt,
            overallStatus: 'success',
            results: [{
                targetId: target.id,
                label: target.label,
                networkDir: target.directory,
                command: createChannelCommand.displayCommand,
                status: 'success',
                stdout,
                stderr,
            }],
            networkType: rawNetworkType,
        });
    } catch (error) {
        const stdout = error?.stdout ? String(error.stdout) : undefined;
        const stderr = error?.stderr ? String(error.stderr) : undefined;
        const completedAt = new Date().toISOString();

        res.json({
            requestedAt,
            completedAt,
            overallStatus: 'error',
            results: [{
                targetId: target.id,
                label: target.label,
                networkDir: target.directory,
                command: createChannelCommand.displayCommand,
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
                stdout,
                stderr,
            }],
            networkType: rawNetworkType,
        });
    }
});

app.post('/api/check-channel', async (req, res) => {
    const checkedAt = new Date().toISOString();
    const rawNetworkType = typeof req.body?.networkType === 'string'
        ? req.body.networkType.trim().toLowerCase()
        : null;

    if (!rawNetworkType) {
        res.status(400).json({
            checkedAt,
            status: 'error',
            error: 'Parameter networkType diperlukan.',
        });
        return;
    }

    const target = NETWORK_START_TARGETS.find(t => t.id === rawNetworkType);

    if (!target) {
        res.status(400).json({
            checkedAt,
            status: 'error',
            error: 'Tipe jaringan tidak dikenal.',
        });
        return;
    }

    try {
        // Check if network.sh exists and is executable
        const scriptPath = path.resolve(target.directory, 'network.sh');

        try {
            await fs.access(scriptPath, fsConstants.X_OK);
        } catch {
            res.json({
                checkedAt,
                status: 'inactive',
                message: 'Script network.sh tidak ditemukan.',
            });
            return;
        }

        // Try to check if containers are running for this channel
        const commandInfo = getContainerCliVersionCommand();
        try {
            const { stdout } = await execFileAsync(commandInfo.binary, [
                'ps',
                '--filter', `name=${target.channel}`,
                '--format', '{{.Names}}'
            ], {
                maxBuffer: EXEC_MAX_BUFFER,
            });

            const runningContainers = stdout.trim().split('\n').filter(Boolean);

            if (runningContainers.length > 0) {
                res.json({
                    checkedAt,
                    status: 'active',
                    message: `Channel aktif dengan ${runningContainers.length} container berjalan.`,
                    containers: runningContainers,
                });
            } else {
                res.json({
                    checkedAt,
                    status: 'inactive',
                    message: 'Tidak ada container yang berjalan untuk channel ini.',
                });
            }
        } catch (error) {
            res.json({
                checkedAt,
                status: 'inactive',
                message: 'Gagal memeriksa status container.',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    } catch (error) {
        console.error('Failed to check channel status:', error);
        res.json({
            checkedAt,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

app.post('/api/simulations/records', async (req, res) => {
    const receivedAt = new Date().toISOString();
    const record = req.body?.record;

    if (!record || typeof record !== 'object') {
        res.status(400).json({
            receivedAt,
            error: 'Payload record tidak valid.',
            code: 'invalid_payload',
        });
        return;
    }

    if (!record.id || typeof record.id !== 'string') {
        res.status(400).json({
            receivedAt,
            error: 'Record harus memiliki properti id bertipe string.',
            code: 'invalid_record_id',
        });
        return;
    }

    const targetIds = Array.isArray(req.body?.targetIds) ? req.body.targetIds : undefined;

    try {
        const results = await submitSimulationRecord(record, { targetIds });
        const processedAt = new Date().toISOString();

        try {
            await appendSimulationResults(results);
        } catch (summaryError) {
            console.error('Failed to update simulation summary store:', summaryError);
        }

        res.json({
            receivedAt,
            processedAt,
            recordId: record.id,
            results,
        });
    } catch (error) {
        console.error('Failed to submit simulation record:', error);

        const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
        const errorCode = error?.code || (statusCode === 400 ? 'invalid_request' : 'ingest_failed');
        const message = error instanceof Error
            ? error.message
            : 'Gagal mengirim data simulasi ke jaringan blockchain.';

        res.status(statusCode).json({
            receivedAt,
            error: message,
            code: errorCode,
        });
    }
});

app.get('*', (req, res) => {
    res.sendFile(viewFiles.home);
});

const PORT = process.env.PORT || 5176;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Gateway listening on http://${HOST}:${PORT}`);
});
