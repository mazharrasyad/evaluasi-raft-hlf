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
                label: 'Start network and create channel',
                args: ['up', 'createChannel', '-ca', '-c', 'fabric2-channel-standard'],
                displayCommand: './network.sh up createChannel -ca -c fabric2-channel-standard',
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
                label: 'Start network and create channel',
                args: ['up', 'createChannel', '-ca', '-c', 'fabric2-channel-variant'],
                displayCommand: './network.sh up createChannel -ca -c fabric2-channel-variant',
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
                ],
                displayCommand:
                    './network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript -c fabric2-channel-variant',
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
        label: 'Fabric 3 RAFT Variant Network',
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
        simulationExecution: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi.html'),
        simulationSubsections: {
            menjalankanNetwork: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/menjalankan-network.html'),
            pembuatanDataSimulasi: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/pembuatan-data-simulasi.html'),
            pengeksekusianSimulasiTransaksi: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/pengeksekusian-simulasi-transaksi.html'),
            penyimpananDataTransaksi: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/penyimpanan-data-transaksi.html'),
            penampilanHasil: path.resolve(viewsRoot, 'penelitian/pelaksanaan-simulasi/penampilan-hasil.html'),
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

// Fabric 2 RAFT Standard - POST endpoint
app.post('/api/fabric-2/raft-standard/pelaporan', async (req, res) => {
    const submittedAt = new Date().toISOString();
    const networkId = 'channel-standard';

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
            label: 'Fabric 2 RAFT Standard',
            result,
        });
    } catch (error) {
        console.error('Error submitting to Fabric 2 RAFT Standard:', error);
        res.status(500).json({
            submittedAt,
            completedAt: new Date().toISOString(),
            success: false,
            networkId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

// Fabric 2 RAFT Standard - GET endpoint
app.get('/api/fabric-2/raft-standard/pelaporan', async (req, res) => {
    const fetchedAt = new Date().toISOString();
    const networkId = 'channel-standard';

    try {
        // Mengambil data dari state database
        const result = await queryRecordsFromNetwork(networkId);

        res.json({
            fetchedAt,
            completedAt: new Date().toISOString(),
            success: result.success,
            networkId,
            label: 'Fabric 2 RAFT Standard',
            count: result.count,
            records: result.records
        });
    } catch (error) {
        console.error('Error querying from Fabric 2 RAFT Standard:', error);
        res.status(500).json({
            fetchedAt,
            completedAt: new Date().toISOString(),
            success: false,
            networkId,
            error: error instanceof Error ? error.message : String(error),
            count: 0,
            records: [],
        });
    }
});

// Fabric 2 RAFT Variant - POST endpoint
app.post('/api/fabric-2/raft-variant/pelaporan', async (req, res) => {
    const submittedAt = new Date().toISOString();
    const networkId = 'channel-variant';

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
            label: 'Fabric 2 RAFT Variant',
            result,
        });
    } catch (error) {
        console.error('Error submitting to Fabric 2 RAFT Variant:', error);
        res.status(500).json({
            submittedAt,
            completedAt: new Date().toISOString(),
            success: false,
            networkId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

// Fabric 2 RAFT Variant - GET endpoint
app.get('/api/fabric-2/raft-variant/pelaporan', async (req, res) => {
    const fetchedAt = new Date().toISOString();
    const networkId = 'channel-variant';

    try {
        // Mengambil data dari state database
        const result = await queryRecordsFromNetwork(networkId);

        res.json({
            fetchedAt,
            completedAt: new Date().toISOString(),
            success: result.success,
            networkId,
            label: 'Fabric 2 RAFT Variant',
            count: result.count,
            records: result.records
        });
    } catch (error) {
        console.error('Error querying from Fabric 2 RAFT Variant:', error);
        res.status(500).json({
            fetchedAt,
            completedAt: new Date().toISOString(),
            success: false,
            networkId,
            error: error instanceof Error ? error.message : String(error),
            count: 0,
            records: [],
        });
    }
});

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
            label: 'Fabric 3 RAFT Standard',
            result,
        });
    } catch (error) {
        console.error('Error submitting to Fabric 3 RAFT Standard:', error);
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

        res.json({
            fetchedAt,
            completedAt: new Date().toISOString(),
            success: result.success,
            networkId,
            label: 'Fabric 3 RAFT Standard',
            count: result.count,
            records: result.records
        });
    } catch (error) {
        console.error('Error querying from Fabric 3 RAFT Standard:', error);
        res.status(500).json({
            fetchedAt,
            completedAt: new Date().toISOString(),
            success: false,
            networkId,
            error: error instanceof Error ? error.message : String(error),
            count: 0,
            records: [],
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
            label: 'Fabric 3 RAFT Variant',
            result,
        });
    } catch (error) {
        console.error('Error submitting to Fabric 3 RAFT Variant:', error);
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

        res.json({
            fetchedAt,
            completedAt: new Date().toISOString(),
            success: result.success,
            networkId,
            label: 'Fabric 3 RAFT Variant',
            count: result.count,
            records: result.records
        });
    } catch (error) {
        console.error('Error querying from Fabric 3 RAFT Variant:', error);
        res.status(500).json({
            fetchedAt,
            completedAt: new Date().toISOString(),
            success: false,
            networkId,
            error: error instanceof Error ? error.message : String(error),
            count: 0,
            records: [],
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
            category: 'Fabric 2 RAFT Standard',
            endpoints: [
                {
                    method: 'POST',
                    path: '/api/fabric-2/raft-standard/pelaporan',
                    description: 'Submit reporting data ke Fabric 2 RAFT Standard',
                    body: 'reporting record object',
                    response: '{ submittedAt, completedAt, success, networkId, result }'
                },
                {
                    method: 'GET',
                    path: '/api/fabric-2/raft-standard/pelaporan',
                    description: 'Query semua transactions dari Fabric 2 RAFT Standard',
                    response: '{ fetchedAt, success, networkId, count, records[], totalBlocks }'
                }
            ]
        },
        {
            category: 'Fabric 2 RAFT Variant',
            endpoints: [
                {
                    method: 'POST',
                    path: '/api/fabric-2/raft-variant/pelaporan',
                    description: 'Submit reporting data ke Fabric 2 RAFT Variant',
                    body: 'reporting record object',
                    response: '{ submittedAt, completedAt, success, networkId, result }'
                },
                {
                    method: 'GET',
                    path: '/api/fabric-2/raft-variant/pelaporan',
                    description: 'Query semua transactions dari Fabric 2 RAFT Variant',
                    response: '{ fetchedAt, success, networkId, count, records[], totalBlocks }'
                }
            ]
        },
        {
            category: 'Fabric 3 RAFT Standard',
            endpoints: [
                {
                    method: 'POST',
                    path: '/api/fabric-3/raft-standard/pelaporan',
                    description: 'Submit reporting data ke Fabric 3 RAFT Standard',
                    body: 'reporting record object',
                    response: '{ submittedAt, completedAt, success, networkId, result }'
                },
                {
                    method: 'GET',
                    path: '/api/fabric-3/raft-standard/pelaporan',
                    description: 'Query semua transactions dari Fabric 3 RAFT Standard',
                    response: '{ fetchedAt, success, networkId, count, records[], totalBlocks }'
                }
            ]
        },
        {
            category: 'Fabric 3 RAFT Variant',
            endpoints: [
                {
                    method: 'POST',
                    path: '/api/fabric-3/raft-variant/pelaporan',
                    description: 'Submit reporting data ke Fabric 3 RAFT Variant',
                    body: 'reporting record object',
                    response: '{ submittedAt, completedAt, success, networkId, result }'
                },
                {
                    method: 'GET',
                    path: '/api/fabric-3/raft-variant/pelaporan',
                    description: 'Query semua transactions dari Fabric 3 RAFT Variant',
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
