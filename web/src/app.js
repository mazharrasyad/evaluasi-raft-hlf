import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

const staticRoot = path.resolve(__dirname, '../public');
const dashboardFile = path.resolve(staticRoot, 'view', 'dashboard.html');

app.use(express.static(staticRoot));

app.get('/', (req, res) => {
    res.sendFile(dashboardFile);
});

app.get('*', (req, res) => {
    res.sendFile(dashboardFile);
});

const PORT = process.env.PORT || 5176;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Gateway listening on http://${HOST}:${PORT}`);
});
