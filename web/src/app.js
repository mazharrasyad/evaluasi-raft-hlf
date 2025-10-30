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
    fabric2: {
        dashboard: path.resolve(viewsRoot, 'fabric-2/dashboard.html'),
        networkHealth: path.resolve(viewsRoot, 'fabric-2/kesehatan-jaringan.html'),
        simulasiData: path.resolve(viewsRoot, 'fabric-2/simulasi-data.html'),
        wilayahDataset: path.resolve(viewsRoot, 'fabric-2/wilayah-indonesia.html'),
    },
    fabric3: {
        dashboard: path.resolve(viewsRoot, 'fabric-3/dashboard.html'),
        networkHealth: path.resolve(viewsRoot, 'fabric-3/kesehatan-jaringan.html'),
        simulasiData: path.resolve(viewsRoot, 'fabric-3/simulasi-data.html'),
        wilayahDataset: path.resolve(viewsRoot, 'fabric-3/wilayah-indonesia.html'),
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
    res.redirect(302, '/fabric-2/dashboard');
});

app.get('/dashboard', (req, res) => {
    res.redirect(302, '/fabric-2/dashboard');
});

app.get('/fabric-2/dashboard', (req, res) => {
    res.sendFile(viewFiles.fabric2.dashboard);
});

app.get('/fabric-3/dashboard', (req, res) => {
    res.sendFile(viewFiles.fabric3.dashboard);
});

app.get('/kesehatan-jaringan', (req, res) => {
    res.redirect(302, '/fabric-2/kesehatan-jaringan');
});

app.get('/fabric-2/kesehatan-jaringan', (req, res) => {
    res.sendFile(viewFiles.fabric2.networkHealth);
});

app.get('/fabric-3/kesehatan-jaringan', (req, res) => {
    res.sendFile(viewFiles.fabric3.networkHealth);
});

app.get('/simulasi-data', (req, res) => {
    res.redirect(302, '/fabric-2/simulasi-data');
});

app.get('/fabric-2/simulasi-data', (req, res) => {
    res.sendFile(viewFiles.fabric2.simulasiData);
});

app.get('/fabric-3/simulasi-data', (req, res) => {
    res.sendFile(viewFiles.fabric3.simulasiData);
});

app.get('/wilayah-indonesia', (req, res) => {
    res.redirect(302, '/fabric-2/wilayah-indonesia');
});

app.get('/fabric-2/wilayah-indonesia', (req, res) => {
    res.sendFile(viewFiles.fabric2.wilayahDataset);
});

app.get('/fabric-3/wilayah-indonesia', (req, res) => {
    res.sendFile(viewFiles.fabric3.wilayahDataset);
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
    res.sendFile(viewFiles.fabric2.dashboard);
});

const PORT = process.env.PORT || 5176;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Gateway listening on http://${HOST}:${PORT}`);
});
