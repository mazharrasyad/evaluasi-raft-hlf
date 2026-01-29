import express from 'express';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

import { checkNetworkHealth, getAllBlocks, getAllCatatan, getBlocksWithSimulationData } from './network-check.js';
import { loadFabricDescriptions } from './fabric-description.js';
import { submitToNetworks, submitTransaction, queryRecordsFromNetwork, queryAllTransactionsFromBlocks } from './fabric-gateway.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFileAsync = promisify(execFile);

const logsRoot = path.resolve(__dirname, '../logs');
const networkShutdownLogPath = path.resolve(logsRoot, 'network-shutdown.log');
const networkStartupLogPath = path.resolve(logsRoot, 'network-start.log');
const EXEC_MAX_BUFFER = 20 * 1024 * 1024;

const dataRoot = path.resolve(__dirname, '../data');
const simulationsDataPath = path.resolve(dataRoot, 'simulations.jsonl');
const throughputDataPath = path.resolve(dataRoot, 'throughput-metrics.jsonl');

// In-memory storage untuk simulasi yang sedang berjalan
const activeSimulations = new Map();

const networkOperationEmitter = new EventEmitter();
networkOperationEmitter.setMaxListeners(0);

// Helper functions for JSONL data storage
async function appendSimulationData(data) {
    try {
        await fs.mkdir(dataRoot, { recursive: true });
        const jsonLine = JSON.stringify(data) + '\n';
        await fs.appendFile(simulationsDataPath, jsonLine, 'utf8');
    } catch (error) {
        console.error('Failed to append simulation data:', error);
        throw error;
    }
}

async function readSimulationData() {
    try {
        const fileContent = await fs.readFile(simulationsDataPath, 'utf8');
        const lines = fileContent.trim().split('\n').filter(Boolean);
        return lines.map(line => JSON.parse(line));
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist yet, return empty array
            return [];
        }
        console.error('Failed to read simulation data:', error);
        throw error;
    }
}

async function clearSimulationData() {
    try {
        await fs.mkdir(dataRoot, { recursive: true });
        await fs.writeFile(simulationsDataPath, '', 'utf8');
    } catch (error) {
        console.error('Failed to clear simulation data:', error);
        throw error;
    }
}

// Helper functions untuk throughput metrics storage
async function appendThroughputData(data) {
    try {
        await fs.mkdir(dataRoot, { recursive: true });
        const jsonLine = JSON.stringify(data) + '\n';
        await fs.appendFile(throughputDataPath, jsonLine, 'utf8');
    } catch (error) {
        console.error('Failed to append throughput data:', error);
        throw error;
    }
}

async function readThroughputData() {
    try {
        const fileContent = await fs.readFile(throughputDataPath, 'utf8');
        const lines = fileContent.trim().split('\n').filter(Boolean);
        return lines.map(line => JSON.parse(line));
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        console.error('Failed to read throughput data:', error);
        throw error;
    }
}

async function clearThroughputData() {
    try {
        await fs.mkdir(dataRoot, { recursive: true });
        await fs.writeFile(throughputDataPath, '', 'utf8');
    } catch (error) {
        console.error('Failed to clear throughput data:', error);
        throw error;
    }
}

// =============================================================================
// METRICS HELPER FUNCTIONS
// =============================================================================

// Container patterns for each network
const CONTAINER_PATTERNS = {
    'channel-fabric3-standard': {
        orderers: ['orderer.fabric3.standard', 'orderer2.fabric3.standard', 'orderer3.fabric3.standard'],
        peers: ['peer0.org1.fabric3.standard', 'peer0.org2.fabric3.standard']
    },
    'channel-fabric3-variant': {
        orderers: ['orderer.fabric3.variant', 'orderer2.fabric3.variant', 'orderer3.fabric3.variant', 'orderer4.fabric3.variant', 'orderer5.fabric3.variant'],
        peers: ['peer0.org1.fabric3.variant', 'peer0.org2.fabric3.variant']
    }
};

/**
 * Collect Docker container stats for a specific container
 */
async function collectDockerStats(containerName) {
    try {
        const { stdout } = await execFileAsync('docker', [
            'stats',
            '--no-stream',
            '--format',
            '{"container":"{{.Container}}","name":"{{.Name}}","cpu":"{{.CPUPerc}}","memory":"{{.MemUsage}}","netIO":"{{.NetIO}}","blockIO":"{{.BlockIO}}"}',
            containerName
        ]);

        const stats = JSON.parse(stdout.trim());

        // Parse CPU percentage
        const cpuPercent = parseFloat(stats.cpu.replace('%', '')) || 0;

        // Parse memory usage (format: "123.4MiB / 1.952GiB")
        const memMatch = stats.memory.match(/([0-9.]+)([A-Za-z]+)/);
        let memoryMB = 0;
        if (memMatch) {
            const value = parseFloat(memMatch[1]);
            const unit = memMatch[2].toLowerCase();
            if (unit.startsWith('g')) {
                memoryMB = value * 1024;
            } else if (unit.startsWith('m')) {
                memoryMB = value;
            } else if (unit.startsWith('k')) {
                memoryMB = value / 1024;
            }
        }

        // Parse block I/O (format: "1.23MB / 4.56MB")
        const ioMatch = stats.blockIO.match(/([0-9.]+)([A-Za-z]+)\s*\/\s*([0-9.]+)([A-Za-z]+)/);
        let ioMBps = 0;
        if (ioMatch) {
            const readValue = parseFloat(ioMatch[1]);
            const readUnit = ioMatch[2].toLowerCase();
            const writeValue = parseFloat(ioMatch[3]);
            const writeUnit = ioMatch[4].toLowerCase();

            let readMB = 0, writeMB = 0;
            if (readUnit.startsWith('g')) readMB = readValue * 1024;
            else if (readUnit.startsWith('m')) readMB = readValue;
            else if (readUnit.startsWith('k')) readMB = readValue / 1024;

            if (writeUnit.startsWith('g')) writeMB = writeValue * 1024;
            else if (writeUnit.startsWith('m')) writeMB = writeValue;
            else if (writeUnit.startsWith('k')) writeMB = writeValue / 1024;

            ioMBps = readMB + writeMB;
        }

        return {
            containerName,
            cpuPercent,
            memoryMB,
            ioMBps,
            timestamp: new Date().toISOString(),
            raw: stats
        };
    } catch (error) {
        return null;
    }
}

/**
 * Collect resource usage for blockchain containers of a specific network
 */
async function collectResourceUsage(networkId) {
    const pattern = CONTAINER_PATTERNS[networkId];
    if (!pattern) {
        return {
            timestamp: new Date().toISOString(),
            orderers: [],
            peers: [],
            cpuPercent: 0,
            memoryMB: 0,
            ioMBps: 0
        };
    }

    const snapshot = {
        timestamp: new Date().toISOString(),
        orderers: [],
        peers: [],
        cpuPercent: 0,
        memoryMB: 0,
        ioMBps: 0
    };

    // Collect stats for all containers
    const allContainers = [...pattern.orderers, ...pattern.peers];
    const statsPromises = allContainers.map(containerName => collectDockerStats(containerName));
    const results = await Promise.all(statsPromises);

    let totalCPU = 0;
    let totalMemory = 0;
    let totalIO = 0;
    let count = 0;

    results.forEach(stat => {
        if (stat) {
            if (stat.containerName.includes('orderer')) {
                snapshot.orderers.push(stat);
            } else if (stat.containerName.includes('peer')) {
                snapshot.peers.push(stat);
            }

            totalCPU += stat.cpuPercent;
            totalMemory += stat.memoryMB;
            totalIO += stat.ioMBps;
            count++;
        }
    });

    if (count > 0) {
        snapshot.cpuPercent = totalCPU / count;
        snapshot.memoryMB = totalMemory;
        snapshot.ioMBps = totalIO;
    }

    return snapshot;
}

/**
 * Calculate metrics from records
 * Metrics include: throughput, latency, resource usage, fault tolerance
 */
function calculateMetricsFromRecords(records, resourceSnapshot = null) {
    const metrics = {
        throughput: {
            totalTransactions: 0,
            successfulTransactions: 0,
            failedTransactions: 0,
            transactionsPerSecond: 0,
            durationSeconds: 0,
            startTimestamp: null,
            endTimestamp: null
        },
        latency: {
            averageLatencyMs: 0,
            minLatencyMs: 0,
            maxLatencyMs: 0,
            p50LatencyMs: 0,
            p95LatencyMs: 0,
            p99LatencyMs: 0,
            transactionLatencies: []
        },
        resourceUsage: {
            averageCPU: 0,
            averageMemory: 0,
            peakCPU: 0,
            peakMemory: 0,
            totalIO: 0,
            ordererCount: 0,
            peerCount: 0
        },
        faultTolerance: {
            successRate: 0,
            failureCount: 0,
            nodeFailures: [],
            recoveryTimeMs: 0
        },
        throughputPerData: []
    };

    if (!records || records.length === 0) {
        return metrics;
    }

    // Calculate throughput and latency from records
    const latencies = [];
    let startTime = null;
    let endTime = null;
    const throughputDataPoints = [];
    const cpuUsages = [];
    const memoryUsages = [];
    const failureRecords = [];

    records.forEach((record, index) => {
        metrics.throughput.totalTransactions++;

        // Check if transaction was successful (records in blockchain are successful)
        const isSuccess = record.success !== false && record.status !== 'failed';
        if (isSuccess) {
            metrics.throughput.successfulTransactions++;
        } else {
            metrics.throughput.failedTransactions++;
        }

        // PRIORITIZE: Extract latency from record.data_latency if available
        let latencyMs = 0;
        let submittedAt = null;
        let completedAt = null;

        if (record.data_latency && record.data_latency.totalLatency !== undefined) {
            // Use pre-calculated latency from simulation data
            latencyMs = record.data_latency.totalLatency;

            // Get timing from data_throughput if available
            if (record.data_throughput) {
                submittedAt = record.data_throughput.submittedAt || record.submittedAt || record.timestamp;
                completedAt = record.data_throughput.completedAt || record.completedAt;
            } else {
                submittedAt = record.submittedAt || record.timestamp;
                completedAt = record.completedAt;
            }
        } else {
            // Fallback: Calculate latency from submittedAt and completedAt
            submittedAt = record.submittedAt || record.networkMetadata?.submittedAt || record.timestamp;
            completedAt = record.completedAt || record.networkMetadata?.completedAt || record.blockchainMetadata?.blockTimestamp;

            if (submittedAt && completedAt) {
                const submitTime = new Date(submittedAt).getTime();
                const completeTime = new Date(completedAt).getTime();
                latencyMs = completeTime - submitTime;
            }
        }

        if (latencyMs >= 0 && submittedAt) {
            const submitTime = new Date(submittedAt).getTime();
            const completeTime = completedAt ? new Date(completedAt).getTime() : submitTime + latencyMs;

            latencies.push({
                recordId: record.reportId || record.id,
                latencyMs,
                submittedAt,
                completedAt: completedAt || new Date(completeTime).toISOString()
            });

            // Track start and end times
            if (!startTime || submitTime < startTime) {
                startTime = submitTime;
                metrics.throughput.startTimestamp = submittedAt;
            }
            if (!endTime || completeTime > endTime) {
                endTime = completeTime;
                metrics.throughput.endTimestamp = completedAt || new Date(completeTime).toISOString();
            }

            // Collect data point for throughput per data
            throughputDataPoints.push({
                index: index + 1,
                recordId: record.reportId || record.id,
                submittedAt,
                completedAt: completedAt || new Date(completeTime).toISOString(),
                submitTime,
                completeTime,
                latencyMs: latencyMs >= 0 ? latencyMs : 0,
                success: isSuccess
            });
        }

        // Extract resource usage from record.data_resource_usage if available
        if (record.data_resource_usage) {
            if (record.data_resource_usage.cpuUsagePercent !== undefined) {
                cpuUsages.push(record.data_resource_usage.cpuUsagePercent);
            }
            if (record.data_resource_usage.memoryUsageMB !== undefined) {
                memoryUsages.push(record.data_resource_usage.memoryUsageMB);
            }
        }

        // Extract fault tolerance data from record.data_fault_tolerance if available
        if (record.data_fault_tolerance && record.data_fault_tolerance.failureType) {
            failureRecords.push({
                recordId: record.reportId || record.id,
                failureType: record.data_fault_tolerance.failureType,
                severity: record.data_fault_tolerance.severity,
                errorCode: record.data_fault_tolerance.errorCode,
                recoveryTimeMs: record.data_fault_tolerance.recoveryTimeMs,
                affectedComponent: record.data_fault_tolerance.affectedComponent
            });
        }
    });

    // Calculate throughput TPS
    if (startTime && endTime) {
        metrics.throughput.durationSeconds = (endTime - startTime) / 1000;
        if (metrics.throughput.durationSeconds > 0) {
            metrics.throughput.transactionsPerSecond =
                metrics.throughput.totalTransactions / metrics.throughput.durationSeconds;
        }
    }

    // Calculate latency statistics
    if (latencies.length > 0) {
        const sortedLatencies = latencies.map(l => l.latencyMs).sort((a, b) => a - b);

        metrics.latency.averageLatencyMs =
            sortedLatencies.reduce((sum, lat) => sum + lat, 0) / sortedLatencies.length;
        metrics.latency.minLatencyMs = sortedLatencies[0];
        metrics.latency.maxLatencyMs = sortedLatencies[sortedLatencies.length - 1];

        // Calculate percentiles
        const p50Index = Math.floor(sortedLatencies.length * 0.50);
        const p95Index = Math.floor(sortedLatencies.length * 0.95);
        const p99Index = Math.floor(sortedLatencies.length * 0.99);

        metrics.latency.p50LatencyMs = sortedLatencies[p50Index] || 0;
        metrics.latency.p95LatencyMs = sortedLatencies[p95Index] || 0;
        metrics.latency.p99LatencyMs = sortedLatencies[p99Index] || 0;

        // Include transaction latencies for detailed analysis
        metrics.latency.transactionLatencies = latencies;
    }

    // Calculate resource usage from records first, then fallback to snapshot
    if (cpuUsages.length > 0) {
        metrics.resourceUsage.averageCPU = cpuUsages.reduce((sum, v) => sum + v, 0) / cpuUsages.length;
        metrics.resourceUsage.peakCPU = Math.max(...cpuUsages);
    }
    if (memoryUsages.length > 0) {
        metrics.resourceUsage.averageMemory = memoryUsages.reduce((sum, v) => sum + v, 0) / memoryUsages.length;
        metrics.resourceUsage.peakMemory = Math.max(...memoryUsages);
    }

    // If no resource data from records, use snapshot
    if (resourceSnapshot && (cpuUsages.length === 0 || memoryUsages.length === 0)) {
        const ordererCPUs = resourceSnapshot.orderers.map(o => o.cpuPercent).filter(v => v !== undefined);
        const ordererMems = resourceSnapshot.orderers.map(o => o.memoryMB).filter(v => v !== undefined);
        const peerCPUs = resourceSnapshot.peers.map(p => p.cpuPercent).filter(v => v !== undefined);
        const peerMems = resourceSnapshot.peers.map(p => p.memoryMB).filter(v => v !== undefined);

        const allCPUs = [...ordererCPUs, ...peerCPUs];
        const allMems = [...ordererMems, ...peerMems];

        if (cpuUsages.length === 0 && allCPUs.length > 0) {
            metrics.resourceUsage.averageCPU = allCPUs.reduce((sum, v) => sum + v, 0) / allCPUs.length;
            metrics.resourceUsage.peakCPU = Math.max(...allCPUs);
        }
        if (memoryUsages.length === 0 && allMems.length > 0) {
            metrics.resourceUsage.averageMemory = allMems.reduce((sum, v) => sum + v, 0) / allMems.length;
            metrics.resourceUsage.peakMemory = Math.max(...allMems);
        }

        metrics.resourceUsage.totalIO = resourceSnapshot.ioMBps || 0;
        metrics.resourceUsage.ordererCount = resourceSnapshot.orderers.length;
        metrics.resourceUsage.peerCount = resourceSnapshot.peers.length;
        metrics.resourceUsage.snapshot = resourceSnapshot;
    }

    // Calculate fault tolerance metrics
    metrics.faultTolerance.successRate =
        metrics.throughput.totalTransactions > 0
            ? (metrics.throughput.successfulTransactions / metrics.throughput.totalTransactions) * 100
            : 0;
    metrics.faultTolerance.failureCount = metrics.throughput.failedTransactions;
    metrics.faultTolerance.nodeFailures = failureRecords;

    // Calculate average recovery time from fault records
    if (failureRecords.length > 0) {
        const recoveryTimes = failureRecords
            .map(f => f.recoveryTimeMs)
            .filter(t => t !== undefined && t > 0);
        if (recoveryTimes.length > 0) {
            metrics.faultTolerance.recoveryTimeMs =
                recoveryTimes.reduce((sum, t) => sum + t, 0) / recoveryTimes.length;
        }
    }

    // Calculate throughput per data with timeFromStartSeconds
    if (startTime && throughputDataPoints.length > 0) {
        // Sort by submitTime untuk urutan yang benar
        throughputDataPoints.sort((a, b) => a.submitTime - b.submitTime);

        // Calculate timeFromStartSeconds untuk setiap data point
        metrics.throughputPerData = throughputDataPoints.map((dp, idx) => ({
            index: idx + 1,
            recordId: dp.recordId,
            timeFromStartSeconds: (dp.submitTime - startTime) / 1000,
            latencyMs: dp.latencyMs,
            success: dp.success
        }));
    }

    return metrics;
}

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
        id: 'fabric3-standard',
        label: 'Fabric 3 Raft Network',
        directory: path.resolve(__dirname, '../../fabric-3/raft-standard/network'),
    },
    {
        id: 'fabric3-variant',
        label: 'Fabric 3 SmartBFT Network',
        directory: path.resolve(__dirname, '../../fabric-3/raft-variant/network'),
    },
];

const NETWORK_START_TARGETS = [
    {
        id: 'fabric3-standard',
        label: 'Fabric 3 Raft Network',
        directory: path.resolve(__dirname, '../../fabric-3/raft-standard/network'),
        channel: 'fabric3-channel-standard',
        commands: [
            {
                label: 'Start network and create channel',
                args: ['up', 'createChannel', '-c', 'fabric3-channel-standard'],
                displayCommand: './network.sh up createChannel -c fabric3-channel-standard',
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
        label: 'Fabric 3 SmartBFT Network',
        directory: path.resolve(__dirname, '../../fabric-3/raft-variant/network'),
        channel: 'fabric3-channel-variant',
        commands: [
            {
                label: 'Start network and create channel',
                args: ['up', 'createChannel', '-c', 'fabric3-channel-variant'],
                displayCommand: './network.sh up createChannel -c fabric3-channel-variant',
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
    listApi: path.resolve(viewsRoot, 'list-api.html'),
    research: {
        overview: path.resolve(viewsRoot, 'penelitian/gambaran-umum.html'),
        environmentSetup: path.resolve(viewsRoot, 'penelitian/pembangunan-lingkungan-uji.html'),
        experimentDesign: path.resolve(viewsRoot, 'penelitian/rancangan-eksperimen.html'),
        simulationExecution: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/index.html'),
        simulationSubsections: {
            menjalankanNetwork: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/menjalankan-network.html'),
            pembuatanDataSimulasi: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/pembuatan-data-simulasi.html'),
            pengeksekusianSimulasiTransaksi: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/pengeksekusian-simulasi-transaksi.html'),
            penyimpananDataTransaksi: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/penyimpanan-data-transaksi.html'),
            penampilanHasil: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/penampilan-hasil.html'),
        },
        dataProcessing: path.resolve(viewsRoot, 'penelitian/pengolahan-data.html'),
        dataProcessingSubsections: {
            pengumpulanValidasiLog: path.resolve(viewsRoot, 'penelitian/pengolahan-data/pengumpulan-validasi-log.html'),
            pengolahanNilaiRataRataGrafik: path.resolve(viewsRoot, 'penelitian/pengolahan-data/pengolahan-nilai-rata-rata-grafik.html'),
        },
        dataAnalysis: path.resolve(viewsRoot, 'penelitian/analisis-data/index.html'),
        dataAnalysisSubsections: {
            throughput: path.resolve(viewsRoot, 'penelitian/analisis-data/throughput.html'),
            latency: path.resolve(viewsRoot, 'penelitian/analisis-data/latency.html'),
            resourceUsage: path.resolve(viewsRoot, 'penelitian/analisis-data/resource-usage.html'),
            faultTolerance: path.resolve(viewsRoot, 'penelitian/analisis-data/fault-tolerance.html'),
        },
        evaluasiHasil: path.resolve(viewsRoot, 'penelitian/evaluasi-hasil/index.html'),
        evaluasiHasilSubsections: {
            ringkasanHasil: path.resolve(viewsRoot, 'penelitian/evaluasi-hasil/ringkasan-hasil.html'),
            algoritmaRaft: path.resolve(viewsRoot, 'penelitian/evaluasi-hasil/algoritma-raft/index.html'),
            algoritmaRaftV3Standar: path.resolve(viewsRoot, 'penelitian/evaluasi-hasil/algoritma-raft/fabric-v3-raft-standar.html'),
            algoritmaRaftV3SmartBft: path.resolve(viewsRoot, 'penelitian/evaluasi-hasil/algoritma-raft/fabric-v3-smartbft.html'),
        },
    },
};

app.use(express.static(staticRoot));
app.use(express.json({ limit: '2mb' }));

app.get('/', (req, res) => {
    res.sendFile(viewFiles.home);
});

app.get('/list-api', (req, res) => {
    res.sendFile(viewFiles.listApi);
});

app.get('/penelitian/gambaran-umum', (req, res) => {
    res.sendFile(viewFiles.research.overview);
});

app.get('/penelitian/gambaran-umum/algoritma-raft', (req, res) => {
    res.redirect(302, '/penelitian/gambaran-umum');
});

app.get('/penelitian/gambaran-umum/algoritma-smartbft', (req, res) => {
    res.redirect(302, '/penelitian/gambaran-umum');
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

app.get('/penelitian/pelaksanaan-simulasi/pengeksekusian-simulasi-transaksi', (req, res) => {
    res.sendFile(viewFiles.research.simulationSubsections.pengeksekusianSimulasiTransaksi);
});

app.get('/penelitian/pelaksanaan-simulasi/penyimpanan-data-transaksi', (req, res) => {
    res.sendFile(viewFiles.research.simulationSubsections.penyimpananDataTransaksi);
});

app.get('/penelitian/pelaksanaan-simulasi/penampilan-hasil', (req, res) => {
    res.sendFile(viewFiles.research.simulationSubsections.penampilanHasil);
});

app.get('/penelitian/pengolahan-data', (req, res) => {
    res.sendFile(viewFiles.research.dataProcessing);
});

app.get('/penelitian/pengolahan-data/pengumpulan-validasi-log', (req, res) => {
    res.sendFile(viewFiles.research.dataProcessingSubsections.pengumpulanValidasiLog);
});

app.get('/penelitian/pengolahan-data/pengolahan-nilai-rata-rata-grafik', (req, res) => {
    res.sendFile(viewFiles.research.dataProcessingSubsections.pengolahanNilaiRataRataGrafik);
});

app.get('/penelitian/analisis-data', (req, res) => {
    res.sendFile(viewFiles.research.dataAnalysis);
});

app.get('/penelitian/analisis-data/throughput', (req, res) => {
    res.sendFile(viewFiles.research.dataAnalysisSubsections.throughput);
});

app.get('/penelitian/analisis-data/latency', (req, res) => {
    res.sendFile(viewFiles.research.dataAnalysisSubsections.latency);
});

app.get('/penelitian/analisis-data/resource-usage', (req, res) => {
    res.sendFile(viewFiles.research.dataAnalysisSubsections.resourceUsage);
});

app.get('/penelitian/analisis-data/fault-tolerance', (req, res) => {
    res.sendFile(viewFiles.research.dataAnalysisSubsections.faultTolerance);
});

app.get('/penelitian/evaluasi-hasil', (req, res) => {
    res.sendFile(viewFiles.research.evaluasiHasil);
});

app.get('/penelitian/evaluasi-hasil/ringkasan-hasil', (req, res) => {
    res.sendFile(viewFiles.research.evaluasiHasilSubsections.ringkasanHasil);
});

app.get('/penelitian/evaluasi-hasil/algoritma-raft', (req, res) => {
    res.sendFile(viewFiles.research.evaluasiHasilSubsections.algoritmaRaft);
});

app.get('/penelitian/evaluasi-hasil/algoritma-raft/fabric-v3-raft-standar', (req, res) => {
    res.sendFile(viewFiles.research.evaluasiHasilSubsections.algoritmaRaftV3Standar);
});

app.get('/penelitian/evaluasi-hasil/algoritma-raft/fabric-v3-smartbft', (req, res) => {
    res.sendFile(viewFiles.research.evaluasiHasilSubsections.algoritmaRaftV3SmartBft);
});

app.get('/penelitian/evaluasi-hasil/pembahasan-algoritma-raft', (req, res) => {
    res.redirect(302, '/penelitian/evaluasi-hasil/algoritma-raft');
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

app.get('/api/network-operations/stream', (req, res) => {
    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

    // Get client operation ID from query parameter for filtering
    const rawClientOperationId = req.query.clientOperationId;
    const clientOperationId = typeof rawClientOperationId === 'string'
        ? rawClientOperationId.trim().slice(0, 200)
        : null;

    // Send initial comment to establish connection
    res.write(': connected\n\n');

    // Event handler for network operations with filtering support
    const eventHandler = (payload) => {
        try {
            // Filter events by clientOperationId if provided
            // This allows multiple concurrent operations without event mixing
            if (clientOperationId && payload.clientOperationId) {
                // Only send events matching this client's operation ID
                if (payload.clientOperationId !== clientOperationId) {
                    return;
                }
            }

            const data = JSON.stringify(payload);
            res.write(`data: ${data}\n\n`);
        } catch (error) {
            console.error('Error sending SSE event:', error);
        }
    };

    // Register event listener
    networkOperationEmitter.on('event', eventHandler);

    // Handle client disconnect
    req.on('close', () => {
        networkOperationEmitter.off('event', eventHandler);
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

    // Execute network startups in parallel for better performance
    // Each network is independent and can be started simultaneously
    const startupPromises = selectedTargets.map(target =>
        executeNetworkStartup(target, operationContext)
    );
    const parallelResults = await Promise.all(startupPromises);
    results.push(...parallelResults);

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

    // Execute network shutdowns in parallel for better performance
    // Each network is independent and can be stopped simultaneously
    const shutdownPromises = selectedTargets.map(target =>
        executeNetworkShutdown(target)
    );
    const parallelResults = await Promise.all(shutdownPromises);
    results.push(...parallelResults);

    const completedAt = new Date().toISOString();
    const successCount = results.filter(result => result.status === 'success').length;
    const overallStatus = successCount === results.length
        ? 'success'
        : successCount > 0
            ? 'partial'
            : 'error';

    // Clear all simulation data after successful shutdown

    res.json({
        requestedAt,
        completedAt,
        overallStatus,
        results,
        networkType: normalizedNetworkType,
    });
});

// ============================================================================
// FABRIC-SPECIFIC API ENDPOINTS
// ============================================================================
// These endpoints allow direct interaction with specific fabric networks

// Fabric 3 RAFT Standard - POST endpoint
app.post('/api/fabric-3/raft-standard/pelaporan', async (req, res) => {
    const submittedAt = new Date().toISOString();
    const networkId = 'channel-fabric3-standard';

    try {
        const record = req.body;

        // Validate input
        if (!record || typeof record !== 'object') {
            return res.status(400).json({
                submittedAt,
                completedAt: new Date().toISOString(),
                success: false,
                error: 'Record data is required',
            });
        }

        // Submit to specific network
        const result = await submitTransaction(networkId, record);

        const completedAt = new Date().toISOString();

        res.json({
            submittedAt,
            completedAt,
            success: result.success,
            networkId,
            label: 'Fabric 3 Raft',
            result,
        });
    } catch (error) {
        console.error('Error submitting to Fabric 3 Raft:', error);
        res.status(500).json({
            submittedAt,
            completedAt: new Date().toISOString(),
            success: false,
            networkId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

// Fabric 3 RAFT Standard - GET endpoint
app.get('/api/fabric-3/raft-standard/pelaporan', async (req, res) => {
    const fetchedAt = new Date().toISOString();
    const networkId = 'channel-fabric3-standard';

    try {
        // Mengambil data dari state database
        const result = await queryRecordsFromNetwork(networkId);

        // Collect resource usage dari Docker containers
        const resourceSnapshot = await collectResourceUsage(networkId);

        // Calculate metrics dari records
        const metrics = calculateMetricsFromRecords(result.records, resourceSnapshot);

        const completedAt = new Date().toISOString();

        res.json({
            fetchedAt,
            completedAt,
            success: result.success,
            networkId,
            label: 'Fabric 3 Raft',
            count: result.count,
            records: result.records,
            // Data metrics terpisah untuk kemudahan analisis
            data_throughput: metrics.throughput,
            data_latency: metrics.latency,
            data_resource_usage: metrics.resourceUsage,
            data_fault_tolerance: metrics.faultTolerance
        });
    } catch (error) {
        console.error('Error querying from Fabric 3 Raft:', error);
        res.status(500).json({
            fetchedAt,
            completedAt: new Date().toISOString(),
            success: false,
            networkId,
            error: error instanceof Error ? error.message : String(error),
            count: 0,
            records: [],
            data_throughput: null,
            data_latency: null,
            data_resource_usage: null,
            data_fault_tolerance: null
        });
    }
});

// Fabric 3 RAFT Variant - POST endpoint
app.post('/api/fabric-3/raft-variant/pelaporan', async (req, res) => {
    const submittedAt = new Date().toISOString();
    const networkId = 'channel-fabric3-variant';

    try {
        const record = req.body;

        // Validate input
        if (!record || typeof record !== 'object') {
            return res.status(400).json({
                submittedAt,
                completedAt: new Date().toISOString(),
                success: false,
                error: 'Record data is required',
            });
        }

        // Submit to specific network
        const result = await submitTransaction(networkId, record);

        const completedAt = new Date().toISOString();

        res.json({
            submittedAt,
            completedAt,
            success: result.success,
            networkId,
            label: 'Fabric 3 SmartBFT',
            result,
        });
    } catch (error) {
        console.error('Error submitting to Fabric 3 SmartBFT:', error);
        res.status(500).json({
            submittedAt,
            completedAt: new Date().toISOString(),
            success: false,
            networkId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

// Fabric 3 RAFT Variant - GET endpoint
app.get('/api/fabric-3/raft-variant/pelaporan', async (req, res) => {
    const fetchedAt = new Date().toISOString();
    const networkId = 'channel-fabric3-variant';

    try {
        // Mengambil data dari state database
        const result = await queryRecordsFromNetwork(networkId);

        // Collect resource usage dari Docker containers
        const resourceSnapshot = await collectResourceUsage(networkId);

        // Calculate metrics dari records
        const metrics = calculateMetricsFromRecords(result.records, resourceSnapshot);

        const completedAt = new Date().toISOString();

        res.json({
            fetchedAt,
            completedAt,
            success: result.success,
            networkId,
            label: 'Fabric 3 SmartBFT',
            count: result.count,
            records: result.records,
            // Data metrics terpisah untuk kemudahan analisis
            data_throughput: metrics.throughput,
            data_latency: metrics.latency,
            data_resource_usage: metrics.resourceUsage,
            data_fault_tolerance: metrics.faultTolerance
        });
    } catch (error) {
        console.error('Error querying from Fabric 3 SmartBFT:', error);
        res.status(500).json({
            fetchedAt,
            completedAt: new Date().toISOString(),
            success: false,
            networkId,
            error: error instanceof Error ? error.message : String(error),
            count: 0,
            records: [],
            data_throughput: null,
            data_latency: null,
            data_resource_usage: null,
            data_fault_tolerance: null
        });
    }
});

// ============================================================================
// METRICS API ENDPOINTS - Untuk pengukuran throughput per data
// ============================================================================

// POST /api/metrics/simulation/start - Memulai simulasi baru
app.post('/api/metrics/simulation/start', async (req, res) => {
    const startedAt = new Date().toISOString();

    try {
        const { loadCategory, totalTransactions, targetNetworks } = req.body;

        // Generate unique simulation ID
        const simulationId = `sim-${Date.now()}-${randomUUID().slice(0, 8)}`;

        // Create simulation record
        const simulation = {
            simulationId,
            startedAt,
            loadCategory: loadCategory || 'unknown',
            totalTransactions: totalTransactions || 0,
            targetNetworks: targetNetworks || [],
            status: 'running',
            transactions: [],
            completedAt: null,
            metrics: null
        };

        // Store in memory
        activeSimulations.set(simulationId, simulation);

        res.json({
            success: true,
            simulationId,
            startedAt,
            message: 'Simulation started successfully'
        });
    } catch (error) {
        console.error('Error starting simulation:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

// POST /api/metrics/simulation/:simulationId/transaction - Mencatat transaksi
app.post('/api/metrics/simulation/:simulationId/transaction', async (req, res) => {
    const { simulationId } = req.params;
    const recordedAt = new Date().toISOString();

    try {
        const simulation = activeSimulations.get(simulationId);

        if (!simulation) {
            return res.status(404).json({
                success: false,
                error: 'Simulation not found'
            });
        }

        const { txId, networkId, submittedAt, completedAt, success, error: txError } = req.body;

        // Calculate latency
        const submitTime = new Date(submittedAt).getTime();
        const completeTime = new Date(completedAt).getTime();
        const latencyMs = completeTime - submitTime;

        // Calculate time from simulation start
        const simulationStartTime = new Date(simulation.startedAt).getTime();
        const timeFromStartMs = submitTime - simulationStartTime;
        const timeFromStartSeconds = timeFromStartMs / 1000;

        // Transaction record
        const transactionRecord = {
            index: simulation.transactions.length + 1,
            txId,
            networkId,
            submittedAt,
            completedAt,
            latencyMs,
            timeFromStartMs,
            timeFromStartSeconds,
            success: success !== false,
            error: txError || null,
            recordedAt
        };

        // Add to simulation
        simulation.transactions.push(transactionRecord);

        res.json({
            success: true,
            simulationId,
            transactionIndex: transactionRecord.index,
            latencyMs,
            timeFromStartSeconds
        });
    } catch (error) {
        console.error('Error recording transaction:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

// POST /api/metrics/simulation/:simulationId/complete - Menyelesaikan simulasi
app.post('/api/metrics/simulation/:simulationId/complete', async (req, res) => {
    const { simulationId } = req.params;
    const completedAt = new Date().toISOString();

    try {
        const simulation = activeSimulations.get(simulationId);

        if (!simulation) {
            return res.status(404).json({
                success: false,
                error: 'Simulation not found'
            });
        }

        // Update simulation status
        simulation.status = 'completed';
        simulation.completedAt = completedAt;

        // Calculate metrics per network
        const networkMetrics = {};
        const transactions = simulation.transactions;

        // Group transactions by network
        transactions.forEach(tx => {
            if (!networkMetrics[tx.networkId]) {
                networkMetrics[tx.networkId] = {
                    networkId: tx.networkId,
                    transactions: [],
                    totalTransactions: 0,
                    successfulTransactions: 0,
                    failedTransactions: 0,
                    latencies: [],
                    throughputPerData: []
                };
            }

            const nm = networkMetrics[tx.networkId];
            nm.transactions.push(tx);
            nm.totalTransactions++;

            if (tx.success) {
                nm.successfulTransactions++;
            } else {
                nm.failedTransactions++;
            }

            if (tx.latencyMs >= 0) {
                nm.latencies.push(tx.latencyMs);
            }

            // Throughput per data: waktu (detik) dari awal simulasi sampai transaksi selesai
            nm.throughputPerData.push({
                index: tx.index,
                txId: tx.txId,
                timeFromStartSeconds: tx.timeFromStartSeconds,
                latencyMs: tx.latencyMs,
                success: tx.success
            });
        });

        // Calculate overall metrics for each network
        Object.values(networkMetrics).forEach(nm => {
            // Sort throughputPerData by index
            nm.throughputPerData.sort((a, b) => a.index - b.index);

            // Calculate latency stats
            if (nm.latencies.length > 0) {
                const sorted = [...nm.latencies].sort((a, b) => a - b);
                nm.averageLatencyMs = sorted.reduce((a, b) => a + b, 0) / sorted.length;
                nm.minLatencyMs = sorted[0];
                nm.maxLatencyMs = sorted[sorted.length - 1];
                nm.p50LatencyMs = sorted[Math.floor(sorted.length * 0.50)] || 0;
                nm.p95LatencyMs = sorted[Math.floor(sorted.length * 0.95)] || 0;
                nm.p99LatencyMs = sorted[Math.floor(sorted.length * 0.99)] || 0;
            }

            // Calculate TPS
            if (nm.transactions.length > 0) {
                const startTime = Math.min(...nm.transactions.map(t => new Date(t.submittedAt).getTime()));
                const endTime = Math.max(...nm.transactions.map(t => new Date(t.completedAt).getTime()));
                nm.durationSeconds = (endTime - startTime) / 1000;
                nm.transactionsPerSecond = nm.durationSeconds > 0
                    ? nm.totalTransactions / nm.durationSeconds
                    : 0;
            }

            // Cleanup large data
            delete nm.latencies;
            delete nm.transactions;
        });

        // Overall simulation metrics
        const allLatencies = transactions.map(t => t.latencyMs).filter(l => l >= 0);
        const sortedLatencies = [...allLatencies].sort((a, b) => a - b);

        simulation.metrics = {
            throughput: {
                totalTransactions: transactions.length,
                successfulTransactions: transactions.filter(t => t.success).length,
                failedTransactions: transactions.filter(t => !t.success).length,
                transactionsPerSecond: 0,
                durationSeconds: 0
            },
            latency: {
                averageLatencyMs: sortedLatencies.length > 0
                    ? sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length
                    : 0,
                minLatencyMs: sortedLatencies[0] || 0,
                maxLatencyMs: sortedLatencies[sortedLatencies.length - 1] || 0,
                p50LatencyMs: sortedLatencies[Math.floor(sortedLatencies.length * 0.50)] || 0,
                p95LatencyMs: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0,
                p99LatencyMs: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0
            },
            resourceUsage: {
                averageCPU: 0,
                averageMemory: 0,
                totalIO: 0
            },
            networkMetrics
        };

        // Calculate overall TPS
        if (transactions.length > 0) {
            const startTime = Math.min(...transactions.map(t => new Date(t.submittedAt).getTime()));
            const endTime = Math.max(...transactions.map(t => new Date(t.completedAt).getTime()));
            simulation.metrics.throughput.durationSeconds = (endTime - startTime) / 1000;
            simulation.metrics.throughput.transactionsPerSecond =
                simulation.metrics.throughput.durationSeconds > 0
                    ? transactions.length / simulation.metrics.throughput.durationSeconds
                    : 0;
        }

        // Save to file storage
        const throughputRecord = {
            simulationId: simulation.simulationId,
            startedAt: simulation.startedAt,
            completedAt: simulation.completedAt,
            loadCategory: simulation.loadCategory,
            targetNetworks: simulation.targetNetworks,
            metrics: simulation.metrics,
            throughputPerData: Object.fromEntries(
                Object.entries(networkMetrics).map(([networkId, nm]) => [
                    networkId,
                    nm.throughputPerData
                ])
            )
        };

        await appendThroughputData(throughputRecord);

        // Remove from active simulations after some time
        setTimeout(() => {
            activeSimulations.delete(simulationId);
        }, 60000); // Keep for 1 minute for potential queries

        res.json({
            success: true,
            simulationId,
            completedAt,
            metrics: simulation.metrics,
            message: 'Simulation completed and metrics saved'
        });
    } catch (error) {
        console.error('Error completing simulation:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

// GET /api/metrics/simulation/:simulationId - Mengambil data simulasi
app.get('/api/metrics/simulation/:simulationId', async (req, res) => {
    const { simulationId } = req.params;

    try {
        // Check active simulations first
        const activeSimulation = activeSimulations.get(simulationId);
        if (activeSimulation) {
            return res.json({
                success: true,
                simulation: activeSimulation,
                source: 'active'
            });
        }

        // Check file storage
        const allData = await readThroughputData();
        const simulation = allData.find(s => s.simulationId === simulationId);

        if (simulation) {
            return res.json({
                success: true,
                simulation,
                source: 'stored'
            });
        }

        res.status(404).json({
            success: false,
            error: 'Simulation not found'
        });
    } catch (error) {
        console.error('Error getting simulation:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

// GET /api/metrics/simulations - Mengambil semua data simulasi
app.get('/api/metrics/simulations', async (req, res) => {
    try {
        const allData = await readThroughputData();

        // Optional filters
        const { loadCategory, networkId, limit } = req.query;

        let filtered = allData;

        if (loadCategory) {
            filtered = filtered.filter(s => s.loadCategory === loadCategory);
        }

        if (networkId) {
            filtered = filtered.filter(s =>
                s.targetNetworks && s.targetNetworks.includes(networkId)
            );
        }

        // Sort by date descending
        filtered.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

        // Apply limit
        if (limit && !isNaN(parseInt(limit))) {
            filtered = filtered.slice(0, parseInt(limit));
        }

        res.json({
            success: true,
            count: filtered.length,
            simulations: filtered
        });
    } catch (error) {
        console.error('Error getting simulations:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

// GET /api/metrics/throughput-per-data - Mengambil data throughput per data untuk grafik
app.get('/api/metrics/throughput-per-data', async (req, res) => {
    try {
        const allData = await readThroughputData();

        // Optional filters
        const { loadCategory, networkId } = req.query;

        let filtered = allData;

        if (loadCategory) {
            filtered = filtered.filter(s => s.loadCategory === loadCategory);
        }

        // Build throughput per data per network
        const networkThroughput = {};

        filtered.forEach(simulation => {
            if (simulation.throughputPerData) {
                Object.entries(simulation.throughputPerData).forEach(([netId, dataPoints]) => {
                    // Filter by networkId if specified
                    if (networkId && netId !== networkId) return;

                    if (!networkThroughput[netId]) {
                        networkThroughput[netId] = {
                            networkId: netId,
                            simulations: []
                        };
                    }

                    networkThroughput[netId].simulations.push({
                        simulationId: simulation.simulationId,
                        loadCategory: simulation.loadCategory,
                        startedAt: simulation.startedAt,
                        completedAt: simulation.completedAt,
                        dataPoints
                    });
                });
            }
        });

        res.json({
            success: true,
            networks: Object.values(networkThroughput)
        });
    } catch (error) {
        console.error('Error getting throughput per data:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

// DELETE /api/metrics/clear - Menghapus semua data metrics (untuk reset)
app.delete('/api/metrics/clear', async (req, res) => {
    try {
        await clearThroughputData();
        activeSimulations.clear();

        res.json({
            success: true,
            message: 'All metrics data cleared'
        });
    } catch (error) {
        console.error('Error clearing metrics:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

// API List - Returns metadata of all available API endpoints
app.get('/api/list', (req, res) => {
    const apiEndpoints = [
        {
            category: 'Network Operations',
            endpoints: [
                {
                    method: 'GET',
                    path: '/api/check-network',
                    description: 'Cek kesehatan semua Fabric networks',
                    response: '{ checkedAt, overallStatus, results[] }'
                },
                {
                    method: 'POST',
                    path: '/api/start-network',
                    description: 'Menyalakan Fabric networks',
                    body: '{ networkType: string (optional) }',
                    response: '{ requestedAt, completedAt, overallStatus, operationId, results[] }'
                },
                {
                    method: 'POST',
                    path: '/api/shutdown-network',
                    description: 'Mematikan Fabric networks',
                    body: '{ networkType: string (optional) }',
                    response: '{ requestedAt, completedAt, overallStatus, results[] }'
                }
            ]
        },
        {
            category: 'Fabric 3 Raft',
            endpoints: [
                {
                    method: 'POST',
                    path: '/api/fabric-3/raft-standard/pelaporan',
                    description: 'Submit reporting data ke Fabric 3 Raft',
                    body: 'reporting record object',
                    response: '{ submittedAt, completedAt, success, networkId, result }'
                },
                {
                    method: 'GET',
                    path: '/api/fabric-3/raft-standard/pelaporan',
                    description: 'Query semua transactions dari Fabric 3 Raft',
                    response: '{ fetchedAt, success, networkId, count, records[], totalBlocks }'
                }
            ]
        },
        {
            category: 'Fabric 3 SmartBFT',
            endpoints: [
                {
                    method: 'POST',
                    path: '/api/fabric-3/raft-variant/pelaporan',
                    description: 'Submit reporting data ke Fabric 3 SmartBFT',
                    body: 'reporting record object',
                    response: '{ submittedAt, completedAt, success, networkId, result }'
                },
                {
                    method: 'GET',
                    path: '/api/fabric-3/raft-variant/pelaporan',
                    description: 'Query semua transactions dari Fabric 3 SmartBFT',
                    response: '{ fetchedAt, success, networkId, count, records[], totalBlocks }'
                }
            ]
        }
    ];

    const totalEndpoints = apiEndpoints.reduce((sum, cat) => sum + cat.endpoints.length, 0);

    res.json({
        fetchedAt: new Date().toISOString(),
        success: true,
        totalCategories: apiEndpoints.length,
        totalEndpoints: totalEndpoints,
        version: '1.0.0',
        serverInfo: {
            framework: 'Express.js',
            nodeVersion: process.version,
            port: PORT,
            host: HOST
        },
        categories: apiEndpoints
    });
});

app.get('*', (req, res) => {
    res.sendFile(viewFiles.home);
});

const PORT = process.env.PORT || 5176;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Gateway listening on http://${HOST}:${PORT}`);
});
