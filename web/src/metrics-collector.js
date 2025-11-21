import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataRoot = path.resolve(__dirname, '../data');
const metricsDataPath = path.resolve(dataRoot, 'simulation-metrics.jsonl');

/**
 * Struktur data untuk simulation metrics
 */
export class SimulationMetrics {
    constructor(simulationId, config = {}) {
        this.simulationId = simulationId;
        this.startTime = new Date().toISOString();
        this.endTime = null;
        this.config = {
            loadCategory: config.loadCategory || 'light',
            totalTransactions: config.totalTransactions || 0,
            targetNetworks: config.targetNetworks || [],
        };

        // 1. Throughput metrics
        this.throughput = {
            totalTransactions: 0,
            successfulTransactions: 0,
            failedTransactions: 0,
            startTimestamp: null,
            endTimestamp: null,
            durationSeconds: 0,
            transactionsPerSecond: 0,
            peakTPS: 0,
            averageTPS: 0,
            perNetworkTPS: {} // TPS per network
        };

        // 2. Latency metrics
        this.latency = {
            transactions: [], // Array of {txId, submittedAt, completedAt, latencyMs, networkId}
            averageLatencyMs: 0,
            minLatencyMs: 0,
            maxLatencyMs: 0,
            p50LatencyMs: 0, // median
            p95LatencyMs: 0,
            p99LatencyMs: 0,
            perNetworkLatency: {} // Average latency per network
        };

        // 3. Resource usage metrics
        this.resourceUsage = {
            snapshots: [], // Array of resource snapshots over time
            orderers: [], // Resource usage for orderer nodes
            peers: [], // Resource usage for peer nodes
            averageCPU: 0,
            averageMemory: 0,
            peakCPU: 0,
            peakMemory: 0,
            averageIO: 0
        };

        // 4. Fault tolerance metrics
        this.faultTolerance = {
            nodeFailures: [], // Array of {nodeId, failedAt, recoveredAt, impactedTransactions}
            recoveryTimes: [], // Array of recovery durations in ms
            averageRecoveryTimeMs: 0,
            dataConsistencyChecks: [], // Array of consistency check results
            transactionsDuringFailure: 0,
            successRateDuringFailure: 0
        };

        // Metadata
        this.metadata = {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'running' // running, completed, failed
        };
    }

    /**
     * Record a transaction submission and completion
     */
    addTransaction(txData) {
        const { txId, networkId, submittedAt, completedAt, success, error } = txData;

        this.throughput.totalTransactions++;
        if (success) {
            this.throughput.successfulTransactions++;
        } else {
            this.throughput.failedTransactions++;
        }

        // Calculate latency
        const submittedTime = new Date(submittedAt).getTime();
        const completedTime = new Date(completedAt).getTime();
        const latencyMs = completedTime - submittedTime;

        this.latency.transactions.push({
            txId,
            networkId,
            submittedAt,
            completedAt,
            latencyMs,
            success
        });

        // Update timestamps
        if (!this.throughput.startTimestamp || submittedTime < new Date(this.throughput.startTimestamp).getTime()) {
            this.throughput.startTimestamp = submittedAt;
        }
        if (!this.throughput.endTimestamp || completedTime > new Date(this.throughput.endTimestamp).getTime()) {
            this.throughput.endTimestamp = completedAt;
        }

        this.metadata.updatedAt = new Date().toISOString();
    }

    /**
     * Calculate final metrics
     */
    calculateMetrics() {
        // Calculate throughput
        if (this.throughput.startTimestamp && this.throughput.endTimestamp) {
            const startTime = new Date(this.throughput.startTimestamp).getTime();
            const endTime = new Date(this.throughput.endTimestamp).getTime();
            this.throughput.durationSeconds = (endTime - startTime) / 1000;

            if (this.throughput.durationSeconds > 0) {
                this.throughput.transactionsPerSecond =
                    this.throughput.totalTransactions / this.throughput.durationSeconds;
                this.throughput.averageTPS = this.throughput.transactionsPerSecond;
            }
        }

        // Calculate latency statistics
        if (this.latency.transactions.length > 0) {
            const latencies = this.latency.transactions
                .filter(tx => tx.success)
                .map(tx => tx.latencyMs)
                .sort((a, b) => a - b);

            if (latencies.length > 0) {
                this.latency.averageLatencyMs =
                    latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
                this.latency.minLatencyMs = latencies[0];
                this.latency.maxLatencyMs = latencies[latencies.length - 1];

                // Calculate percentiles
                const p50Index = Math.floor(latencies.length * 0.50);
                const p95Index = Math.floor(latencies.length * 0.95);
                const p99Index = Math.floor(latencies.length * 0.99);

                this.latency.p50LatencyMs = latencies[p50Index] || 0;
                this.latency.p95LatencyMs = latencies[p95Index] || 0;
                this.latency.p99LatencyMs = latencies[p99Index] || 0;
            }

            // Calculate per-network latency
            const networkLatencies = {};
            this.latency.transactions.forEach(tx => {
                if (tx.success) {
                    if (!networkLatencies[tx.networkId]) {
                        networkLatencies[tx.networkId] = [];
                    }
                    networkLatencies[tx.networkId].push(tx.latencyMs);
                }
            });

            Object.keys(networkLatencies).forEach(networkId => {
                const lats = networkLatencies[networkId];
                this.latency.perNetworkLatency[networkId] =
                    lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
            });
        }

        // Calculate per-network TPS
        const networkTransactions = {};
        this.latency.transactions.forEach(tx => {
            if (!networkTransactions[tx.networkId]) {
                networkTransactions[tx.networkId] = {
                    count: 0,
                    startTime: null,
                    endTime: null
                };
            }

            const txStart = new Date(tx.submittedAt).getTime();
            const txEnd = new Date(tx.completedAt).getTime();

            if (!networkTransactions[tx.networkId].startTime ||
                txStart < networkTransactions[tx.networkId].startTime) {
                networkTransactions[tx.networkId].startTime = txStart;
            }
            if (!networkTransactions[tx.networkId].endTime ||
                txEnd > networkTransactions[tx.networkId].endTime) {
                networkTransactions[tx.networkId].endTime = txEnd;
            }

            networkTransactions[tx.networkId].count++;
        });

        Object.keys(networkTransactions).forEach(networkId => {
            const net = networkTransactions[networkId];
            const durationSec = (net.endTime - net.startTime) / 1000;
            if (durationSec > 0) {
                this.throughput.perNetworkTPS[networkId] = net.count / durationSec;
            }
        });

        // Calculate resource usage averages
        if (this.resourceUsage.snapshots.length > 0) {
            const cpuValues = [];
            const memValues = [];
            const ioValues = [];

            this.resourceUsage.snapshots.forEach(snapshot => {
                if (snapshot.cpuPercent !== undefined) cpuValues.push(snapshot.cpuPercent);
                if (snapshot.memoryMB !== undefined) memValues.push(snapshot.memoryMB);
                if (snapshot.ioMBps !== undefined) ioValues.push(snapshot.ioMBps);
            });

            if (cpuValues.length > 0) {
                this.resourceUsage.averageCPU = cpuValues.reduce((sum, v) => sum + v, 0) / cpuValues.length;
                this.resourceUsage.peakCPU = Math.max(...cpuValues);
            }

            if (memValues.length > 0) {
                this.resourceUsage.averageMemory = memValues.reduce((sum, v) => sum + v, 0) / memValues.length;
                this.resourceUsage.peakMemory = Math.max(...memValues);
            }

            if (ioValues.length > 0) {
                this.resourceUsage.averageIO = ioValues.reduce((sum, v) => sum + v, 0) / ioValues.length;
            }
        }

        // Calculate fault tolerance metrics
        if (this.faultTolerance.recoveryTimes.length > 0) {
            this.faultTolerance.averageRecoveryTimeMs =
                this.faultTolerance.recoveryTimes.reduce((sum, t) => sum + t, 0) /
                this.faultTolerance.recoveryTimes.length;
        }

        this.metadata.updatedAt = new Date().toISOString();
    }

    /**
     * Mark simulation as completed
     */
    complete() {
        this.endTime = new Date().toISOString();
        this.metadata.status = 'completed';
        this.calculateMetrics();
    }

    /**
     * Convert to JSON
     */
    toJSON() {
        return {
            simulationId: this.simulationId,
            startTime: this.startTime,
            endTime: this.endTime,
            config: this.config,
            throughput: this.throughput,
            latency: this.latency,
            resourceUsage: this.resourceUsage,
            faultTolerance: this.faultTolerance,
            metadata: this.metadata
        };
    }
}

/**
 * Save metrics to JSONL file
 */
export async function saveMetrics(metrics) {
    try {
        await fs.mkdir(dataRoot, { recursive: true });
        const jsonLine = JSON.stringify(metrics.toJSON()) + '\n';
        await fs.appendFile(metricsDataPath, jsonLine, 'utf8');
        console.log(`✅ Metrics saved for simulation ${metrics.simulationId}`);
    } catch (error) {
        console.error('❌ Failed to save metrics:', error);
        throw error;
    }
}

/**
 * Read all metrics from JSONL file
 */
export async function readAllMetrics() {
    try {
        const fileContent = await fs.readFile(metricsDataPath, 'utf8');
        const lines = fileContent.trim().split('\n').filter(Boolean);
        return lines.map(line => JSON.parse(line));
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        console.error('❌ Failed to read metrics:', error);
        throw error;
    }
}

/**
 * Get metrics by simulation ID
 */
export async function getMetricsBySimulationId(simulationId) {
    const allMetrics = await readAllMetrics();
    return allMetrics.find(m => m.simulationId === simulationId);
}

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
        console.warn(`⚠️  Failed to collect stats for ${containerName}:`, error.message);
        return null;
    }
}

/**
 * Collect resource usage for all blockchain containers
 */
export async function collectResourceUsage(networkIds = []) {
    const containerPatterns = {
        'channel-standard': {
            orderers: ['orderer.fabric2.standard.com', 'orderer2.fabric2.standard.com', 'orderer3.fabric2.standard.com'],
            peers: ['peer0.org1.fabric2.standard.com', 'peer0.org2.fabric2.standard.com']
        },
        'channel-variant': {
            orderers: ['orderer.fabric2.variant.com', 'orderer2.fabric2.variant.com', 'orderer3.fabric2.variant.com', 'orderer4.fabric2.variant.com', 'orderer5.fabric2.variant.com'],
            peers: ['peer0.org1.fabric2.variant.com', 'peer0.org2.fabric2.variant.com']
        },
        'channel-fabric3-standard': {
            orderers: ['orderer.fabric3.standard', 'orderer2.fabric3.standard', 'orderer3.fabric3.standard'],
            peers: ['peer0.org1.fabric3.standard', 'peer0.org2.fabric3.standard']
        },
        'channel-fabric3-variant': {
            orderers: ['orderer.fabric3.variant', 'orderer2.fabric3.variant', 'orderer3.fabric3.variant', 'orderer4.fabric3.variant', 'orderer5.fabric3.variant'],
            peers: ['peer0.org1.fabric3.variant', 'peer0.org2.fabric3.variant']
        }
    };

    const snapshot = {
        timestamp: new Date().toISOString(),
        orderers: [],
        peers: [],
        cpuPercent: 0,
        memoryMB: 0,
        ioMBps: 0
    };

    const containersToMonitor = new Set();

    // Collect containers based on network IDs
    if (networkIds.length === 0) {
        // Monitor all containers
        Object.values(containerPatterns).forEach(pattern => {
            pattern.orderers.forEach(c => containersToMonitor.add(c));
            pattern.peers.forEach(c => containersToMonitor.add(c));
        });
    } else {
        // Monitor only specified networks
        networkIds.forEach(networkId => {
            const pattern = containerPatterns[networkId];
            if (pattern) {
                pattern.orderers.forEach(c => containersToMonitor.add(c));
                pattern.peers.forEach(c => containersToMonitor.add(c));
            }
        });
    }

    // Collect stats for all containers
    const statsPromises = Array.from(containersToMonitor).map(containerName =>
        collectDockerStats(containerName)
    );

    const results = await Promise.all(statsPromises);

    let totalCPU = 0;
    let totalMemory = 0;
    let totalIO = 0;
    let count = 0;

    results.forEach(stat => {
        if (stat) {
            // Categorize by container type
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
 * Monitor resources periodically during simulation
 */
export class ResourceMonitor {
    constructor(metrics, networkIds, intervalMs = 5000) {
        this.metrics = metrics;
        this.networkIds = networkIds;
        this.intervalMs = intervalMs;
        this.intervalId = null;
        this.isRunning = false;
    }

    async start() {
        if (this.isRunning) {
            console.warn('⚠️  Resource monitor already running');
            return;
        }

        this.isRunning = true;
        console.log(`🔍 Starting resource monitor (interval: ${this.intervalMs}ms)`);

        // Collect initial snapshot
        const snapshot = await collectResourceUsage(this.networkIds);
        this.metrics.resourceUsage.snapshots.push(snapshot);
        this.metrics.resourceUsage.orderers.push(...snapshot.orderers);
        this.metrics.resourceUsage.peers.push(...snapshot.peers);

        // Start periodic collection
        this.intervalId = setInterval(async () => {
            try {
                const snapshot = await collectResourceUsage(this.networkIds);
                this.metrics.resourceUsage.snapshots.push(snapshot);
                this.metrics.resourceUsage.orderers.push(...snapshot.orderers);
                this.metrics.resourceUsage.peers.push(...snapshot.peers);

                console.log(`📊 Resource snapshot: CPU ${snapshot.cpuPercent.toFixed(2)}%, ` +
                           `Memory ${snapshot.memoryMB.toFixed(2)}MB, ` +
                           `I/O ${snapshot.ioMBps.toFixed(2)}MB/s`);
            } catch (error) {
                console.error('❌ Failed to collect resource snapshot:', error);
            }
        }, this.intervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.isRunning = false;
            console.log('✅ Resource monitor stopped');
        }
    }
}

/**
 * Record a node failure event
 */
export function recordNodeFailure(metrics, nodeId, failedAt) {
    const failure = {
        nodeId,
        failedAt,
        recoveredAt: null,
        impactedTransactions: 0,
        recoveryTimeMs: null
    };

    metrics.faultTolerance.nodeFailures.push(failure);
    return failure;
}

/**
 * Record a node recovery event
 */
export function recordNodeRecovery(metrics, nodeId, recoveredAt) {
    const failure = metrics.faultTolerance.nodeFailures.find(
        f => f.nodeId === nodeId && !f.recoveredAt
    );

    if (failure) {
        failure.recoveredAt = recoveredAt;
        const failTime = new Date(failure.failedAt).getTime();
        const recoverTime = new Date(recoveredAt).getTime();
        failure.recoveryTimeMs = recoverTime - failTime;

        metrics.faultTolerance.recoveryTimes.push(failure.recoveryTimeMs);

        console.log(`✅ Node ${nodeId} recovered in ${failure.recoveryTimeMs}ms`);
    }
}

/**
 * Check data consistency across networks
 */
export function recordConsistencyCheck(metrics, checkResult) {
    metrics.faultTolerance.dataConsistencyChecks.push({
        timestamp: new Date().toISOString(),
        ...checkResult
    });
}
