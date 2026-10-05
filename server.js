import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3002;

app.get('/', (req, res) => {
    res.sendFile(`${__dirname}/index.html`);
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
