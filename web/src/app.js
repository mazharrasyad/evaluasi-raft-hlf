import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

const staticRoot = path.resolve(__dirname, '..');
const wilayahDataDir = path.resolve(__dirname, '../../wilayah-indonesia');

app.use(express.static(staticRoot));
app.use('/wilayah-data', express.static(wilayahDataDir));

app.get('*', (req, res) => {
    res.sendFile(path.resolve(staticRoot, 'dashboard.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Gateway listening on http://localhost:${PORT}`);
});
