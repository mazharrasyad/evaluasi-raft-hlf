import express from 'express';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

import { checkNetworkHealth } from './network-check.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFileAsync = promisify(execFile);

const logsRoot = path.resolve(__dirname, '../logs');
const networkShutdownLogPath = path.resolve(logsRoot, 'network-shutdown.log');
const networkStartupLogPath = path.resolve(logsRoot, 'network-start.log');
const EXEC_MAX_BUFFER = 20 * 1024 * 1024;

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
        label: 'Jaringan RAFT Standard',
        directory: path.resolve(__dirname, '../../raft-standard/network'),
    },
    {
        label: 'Jaringan RAFT Variant',
        directory: path.resolve(__dirname, '../../raft-variant/network'),
    },
];

const NETWORK_START_TARGETS = [
    {
        label: 'Jaringan RAFT Standard',
        directory: path.resolve(__dirname, '../../raft-standard/network'),
        channel: 'channel-standard',
        commands: [
            {
                label: 'Mulai jaringan',
                args: ['up', 'createChannel', '-c', 'channel-standard', '-ca'],
                displayCommand: './network.sh up createChannel -c channel-standard -ca',
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
                    'channel-standard',
                ],
                displayCommand:
                    './network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript -c channel-standard',
            },
        ],
    },
    {
        label: 'Jaringan RAFT Variant',
        directory: path.resolve(__dirname, '../../raft-variant/network'),
        channel: 'channel-variant',
        commands: [
            {
                label: 'Mulai jaringan',
                args: ['up', 'createChannel', '-c', 'channel-variant', '-ca'],
                displayCommand: './network.sh up createChannel -c channel-variant -ca',
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
                    'channel-variant',
                ],
                displayCommand:
                    './network.sh deployCC -ccn pelaporan -ccp ../chaincode/pelaporan -ccl javascript -c channel-variant',
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

async function executeNetworkShutdown({ label, directory }) {
    const scriptPath = path.resolve(directory, 'network.sh');

    try {
        await fs.access(directory, fsConstants.R_OK | fsConstants.X_OK);
    } catch (error) {
        const failureResult = {
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

async function executeNetworkStartup({ label, directory, commands }) {
    const scriptPath = path.resolve(directory, 'network.sh');
    const commandList = Array.isArray(commands) ? commands : [];

    try {
        await fs.access(directory, fsConstants.R_OK | fsConstants.X_OK);
    } catch (error) {
        const failureResult = {
            label,
            networkDir: directory,
            status: 'not_found',
            message: 'Direktori jaringan tidak ditemukan atau tidak dapat diakses.',
            error: error instanceof Error ? error.message : String(error),
        };

        await logNetworkStartupFailure(failureResult);

        return failureResult;
    }

    try {
        await fs.access(scriptPath, fsConstants.X_OK);
    } catch (error) {
        const failureResult = {
            label,
            networkDir: directory,
            status: 'not_found',
            message: 'Berkas network.sh tidak ditemukan atau tidak dapat dijalankan.',
            error: error instanceof Error ? error.message : String(error),
        };

        await logNetworkStartupFailure(failureResult);

        return failureResult;
    }

    if (!commandList.length) {
        const failureResult = {
            label,
            networkDir: directory,
            status: 'error',
            message: 'Tidak ada perintah yang dikonfigurasi untuk menyalakan jaringan.',
        };

        await logNetworkStartupFailure(failureResult);

        return failureResult;
    }

    const steps = [];
    let hasSuccess = false;

    for (const command of commandList) {
        const stepResult = {
            label: command.label,
            displayCommand: command.displayCommand,
            args: Array.isArray(command.args) ? command.args : [],
        };

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

            const failureResult = {
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
            }

            await logNetworkStartupFailure(failureResult);

            return failureResult;
        }
    }

    const successResult = {
        label,
        networkDir: directory,
        status: 'success',
        steps,
    };

    return successResult;
}

const app = express();
app.disable('x-powered-by');

const staticRoot = path.resolve(__dirname, '../public');
const viewsRoot = path.resolve(staticRoot, 'view');

const viewFiles = {
    dashboard: path.resolve(viewsRoot, 'dashboard.html'),
    kesehatanJaringan: path.resolve(viewsRoot, 'kesehatan-jaringan.html'),
    simulasiData: path.resolve(viewsRoot, 'simulasi-data.html'),
    wilayahDataset: path.resolve(viewsRoot, 'wilayah-indonesia.html'),
};

app.use(express.static(staticRoot));

app.get('/', (req, res) => {
    res.sendFile(viewFiles.dashboard);
});

app.get('/kesehatan-jaringan', (req, res) => {
    res.sendFile(viewFiles.kesehatanJaringan);
});

app.get('/simulasi-data', (req, res) => {
    res.sendFile(viewFiles.simulasiData);
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

app.post('/api/start-network', async (req, res) => {
    const requestedAt = new Date().toISOString();
    const results = [];

    const dockerFailure = await ensureDockerAvailable();
    if (dockerFailure) {
        for (const target of NETWORK_START_TARGETS) {
            const failureResult = {
                label: target.label,
                networkDir: target.directory,
                status: dockerFailure.status,
                ...dockerFailure,
            };

            await logNetworkStartupFailure(failureResult);
            results.push(failureResult);
        }

        const completedAt = new Date().toISOString();

        res.json({
            requestedAt,
            completedAt,
            overallStatus: 'error',
            dependencyStatus: 'docker_unavailable',
            results,
        });

        return;
    }

    for (const target of NETWORK_START_TARGETS) {
        const result = await executeNetworkStartup(target);
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
    });
});

app.post('/api/shutdown-network', async (req, res) => {
    const requestedAt = new Date().toISOString();
    const results = [];

    const dockerFailure = await ensureDockerAvailable();
    if (dockerFailure) {
        for (const target of NETWORK_SHUTDOWN_TARGETS) {
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
        });

        return;
    }

    for (const target of NETWORK_SHUTDOWN_TARGETS) {
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
    });
});

app.get('/wilayah-indonesia', (req, res) => {
    res.sendFile(viewFiles.wilayahDataset);
});

app.get('*', (req, res) => {
    res.sendFile(viewFiles.dashboard);
});

const PORT = process.env.PORT || 5176;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Gateway listening on http://${HOST}:${PORT}`);
});
