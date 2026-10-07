const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.resolve(__dirname, '../../logs');
fs.mkdirSync(logsDir, { recursive: true });

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}] ${message}`)
);

const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 7
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      level: 'info',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 7
    })
  ]
});

const SENSITIVE_KEYS = new Set(['password', 'cardno', 'token', 'authorization']);

function maskBody(body) {
  if (!body || typeof body !== 'object') return body;
  const out = Array.isArray(body) ? [...body] : { ...body };
  for (const key of Object.keys(out)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) out[key] = '***';
  }
  return out;
}

function httpLogger(req, res, durationMs) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  let summary = '';
  if (req.body && Object.keys(req.body).length) {
    summary = ` body=${JSON.stringify(maskBody(req.body))}`;
  }
  logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms ip=${ip}${summary}`);
}

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => httpLogger(req, res, Date.now() - start));
  next();
}

module.exports = { logger, httpLogger, requestLogger };
