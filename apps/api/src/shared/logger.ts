import pino from 'pino';

// PII scrubbing — paths listed here are redacted from all log output.
// Extend this list as new PII fields are identified.
const PII_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'body.password',
  'body.email',
  'body.phone',
  'body.date_of_birth',
  'body.iban',
];

export function createLogger(level: string) {
  return pino({
    level,
    redact: {
      paths: PII_PATHS,
      censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
}
