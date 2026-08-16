import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { connectDB } from './config/db.js';
import routes from './routes/index.js';
import { setupSocket } from './socket.js';
import { notFound, errorHandler } from './middleware/error.js';
import { seedIfEmpty } from './seed.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/api', routes(io));
app.use(notFound);
app.use(errorHandler);

setupSocket(io);

const PORT = process.env.PORT || 5000;

async function start() {
  const mongo = await connectDB();
  await seedIfEmpty(mongo);
  server.listen(PORT, () => {
    console.log(`[server] Super Toto Local API running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
