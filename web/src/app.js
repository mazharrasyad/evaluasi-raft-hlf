import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { checkNetworkHealth } from './network-check.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

const staticRoot = path.resolve(__dirname, '../public');
const dashboardFile = path.resolve(staticRoot, 'view', 'dashboard.html');
const wilayahDatasetFile = path.resolve(staticRoot, 'view', 'wilayah-indonesia.html');

app.use(express.static(staticRoot));

app.get('/', (req, res) => {
    res.sendFile(dashboardFile);
});

app.get('/wilayah-indonesia', (req, res) => {
    res.sendFile(wilayahDatasetFile);
});

app.get('/api/network-status', async (req, res) => {
    try {
        const results = await checkNetworkHealth();
        const payload = Array.isArray(results) ? results : [];
        res.json({
            status: 'ok',
            results: payload
        });
    } catch (error) {
        console.error('Gagal memeriksa kesehatan jaringan:', error);
        res.status(500).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Terjadi kesalahan saat memeriksa jaringan.'
        });
    }
});

app.get('*', (req, res) => {
    res.sendFile(dashboardFile);
});

const PORT = process.env.PORT || 5176;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Gateway listening on http://${HOST}:${PORT}`);
});
