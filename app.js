// codeauthor chetas karnam
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { requestLogger } from './middleware/requestLogger.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import alertsRoutes from './routes/alertsRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import datasetRoutes from './routes/datasetRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { HttpError } from './middleware/errors.js';
import { forwardRequest } from './services/proxyService.js';
import nasaRoutes from './routes/nasaRoutes.js';
dotenv.config();
export const app = express();
const allowedOrigins = [process.env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://0.0.0.0:5173']
    .filter((origin) => Boolean(origin));
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(requestLogger);
app.use((req, _res, next) => {
    const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'];
    if (hasBody && !req.is('application/json'))
        return next(new HttpError(415, 'Content-Type must be application/json'));
    next();
});
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
// Proxy external backend routes so the frontend can use the Node host as a single API surface
app.use('/api/external/python', (req, res) => forwardRequest(req, res, 'http://127.0.0.1:5001'));
app.use('/api/external/java', (req, res) => forwardRequest(req, res, 'http://127.0.0.1:5002'));
app.get('/', (_, res) => {
    res.json({
        status: 'ok',
        service: 'astrahealth-nexus',
        frontend: 'http://localhost:5173',
        health: 'http://localhost:4000/api/health'
    });
});
app.use('/api', dashboardRoutes);
app.use('/api', alertsRoutes);
app.use('/api', telemetryRoutes);
app.use('/api', nasaRoutes);
app.use('/api', datasetRoutes);
app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'astrahealth-nexus' }));
app.use((_req, _res, next) => next(new HttpError(404, 'Endpoint not found')));
app.use(errorHandler);
