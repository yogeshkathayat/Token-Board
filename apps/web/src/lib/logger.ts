import pino from 'pino';

export interface LogPayload {
  message: string;
  logInfo?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class Logger {
  private static _rootLogger: pino.Logger;
  private readonly _logger: pino.Logger;

  constructor(private readonly context: string) {
    if (!Logger._rootLogger) this._initRootLogger();
    this._logger = Logger._rootLogger.child({ context });
  }

  private _initRootLogger() {
    Logger._rootLogger = pino({
      level: process.env.LOGGER_LEVEL || 'info',
      base: {
        app_name: process.env.APP_NAME!,
        environment: process.env.NODE_ENV!,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label: string) => ({ level: label }),
      },
    });
  }

  private _formatMessage(logMessage: string | LogPayload): object {
    if (typeof logMessage === 'string') {
      return { message: logMessage };
    }

    if (typeof logMessage === 'object' && 'message' in logMessage) {
      const { message, logInfo, metadata } = logMessage;
      return {
        message,
        log_info: logInfo ? JSON.stringify(logInfo) : undefined,
        metadata,
      };
    }

    return { message: JSON.stringify(logMessage) };
  }

  log(message: string | LogPayload) {
    this._logger.info(this._formatMessage(message));
  }

  error(message: string | LogPayload) {
    this._logger.error(this._formatMessage(message));
  }

  warn(message: string | LogPayload) {
    this._logger.warn(this._formatMessage(message));
  }

  debug(message: string | LogPayload) {
    this._logger.debug(this._formatMessage(message));
  }
}
