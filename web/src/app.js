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

async function ensureDockerAvailable() {
    try {
        await execFileAsync('docker', ['version']);
        return null;
    } catch (error) {
        const stdout = error?.stdout ? String(error.stdout) : undefined;
        const stderr = error?.stderr ? String(error.stderr) : undefined;
        const isMissingBinary = error?.code === 'ENOENT';

        return {
            command: 'docker version',
            status: isMissingBinary ? 'dependency_missing' : 'error',
            message: isMissingBinary
                ? 'Perintah docker tidak ditemukan di server gateway.'
                : 'Gagal menjalankan perintah docker version.',
            resolution: 'Pastikan Docker terpasang, service docker berjalan, dan user memiliki akses ke Docker CLI.',
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

const app = express();
app.disable('x-powered-by');

const staticRoot = path.resolve(__dirname, '../public');
const viewsRoot = path.resolve(staticRoot, 'view');

const viewFiles = {
    dashboard: path.resolve(viewsRoot, 'dashboard.html'),
    kesehatanJaringan: path.resolve(viewsRoot, 'kesehatan-jaringan.html'),
    ruteServer: path.resolve(viewsRoot, 'rute-server.html'),
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

app.get('/rute-server', (req, res) => {
    res.sendFile(viewFiles.ruteServer);
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
