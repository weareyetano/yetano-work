import type { LogLevel } from './config.js'

type LogFields = Readonly<Record<string, unknown>>

export interface Logger {
  child(fields: LogFields): Logger
  debug(message: string, fields?: LogFields): void
  error(message: string, fields?: LogFields): void
  info(message: string, fields?: LogFields): void
  warn(message: string, fields?: LogFields): void
}

const levels: Record<LogLevel, number> = {
  debug: 10,
  error: 40,
  info: 20,
  warn: 30,
}

export function createLogger(level: LogLevel, baseFields: LogFields = {}): Logger {
  const threshold = levels[level]

  const write = (entryLevel: LogLevel, message: string, fields: LogFields = {}) => {
    if (levels[entryLevel] < threshold) return

    const entry = JSON.stringify({
      ...baseFields,
      ...fields,
      level: entryLevel,
      message,
      timestamp: new Date().toISOString(),
    })

    if (entryLevel === 'error') {
      console.error(entry)
    } else if (entryLevel === 'warn') {
      console.warn(entry)
    } else {
      console.log(entry)
    }
  }

  return {
    child: (fields) => createLogger(level, { ...baseFields, ...fields }),
    debug: (message, fields) => write('debug', message, fields),
    error: (message, fields) => write('error', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
  }
}
