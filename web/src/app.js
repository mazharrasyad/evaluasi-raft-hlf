import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { checkNetworkHealth } from './network-check.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

const staticRoot = path.resolve(__dirname, '../public');
const viewsRoot = path.resolve(staticRoot, 'view');

const viewFiles = {
    dashboard: path.resolve(viewsRoot, 'dashboard.html'),
    kesehatanJaringan: path.resolve(viewsRoot, 'kesehatan-jaringan.html'),
    ruteServer: path.resolve(viewsRoot, 'rute-server.html'),
    simulasiData: path.resolve(viewsRoot, 'simulasi-data.html'),
    petaLaporan: path.resolve(viewsRoot, 'peta-laporan.html'),
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

app.get('/peta-laporan', (req, res) => {
    res.sendFile(viewFiles.petaLaporan);
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
