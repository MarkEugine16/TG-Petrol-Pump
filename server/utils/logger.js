/**
 * server/utils/logger.js
 * Centralized Winston logger.
 * — Info/debug to console in dev
 * — Errors always written to logs/error.log
 * — Suspicious activity written to logs/security.log
 */

'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs   = require('fs');

// Ensure logs/ directory exists
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const { combine, timestamp, printf, colorize, errors } = format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `[${timestamp}] ${level}: ${stack || message}`;
});

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Always log errors to file
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    // Security events
    new transports.File({
      filename: path.join(logDir, 'security.log'),
      level: 'warn',
    }),
  ],
});

// Console output in non-production
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
  }));
}

/**
 * Log a suspicious/security event with request context.
 * @param {string} event - Short event label
 * @param {import('express').Request} req
 * @param {string} [detail]
 */
logger.security = (event, req, detail = '') => {
  const ip  = req.ip || req.connection?.remoteAddress;
  const ua  = req.get('User-Agent') || 'unknown';
  const msg = `SECURITY [${event}] IP=${ip} UA="${ua}" PATH=${req.path} ${detail}`;
  logger.warn(msg);
};

module.exports = logger;
