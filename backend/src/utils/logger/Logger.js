/**
 * Logger professionnel pour logging structuré et monitoring
 * Compatible avec ELK Stack, CloudWatch, etc.
 */

class Logger {
  static getTimestamp() {
    return new Date().toISOString();
  }

  static formatLog(level, message, data = {}) {
    return {
      timestamp: this.getTimestamp(),
      level,
      message,
      service: 'sygim-api',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      ...data
    };
  }

  static info(message, data = {}) {
    const log = this.formatLog('INFO', message, data);
    console.log(JSON.stringify(log));
    return log;
  }

  static warn(message, data = {}) {
    const log = this.formatLog('WARN', message, data);
    console.warn(JSON.stringify(log));
    return log;
  }

  static error(message, error, data = {}) {
    const log = this.formatLog('ERROR', message, {
      error: {
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      },
      ...data
    });
    console.error(JSON.stringify(log));
    return log;
  }

  static debug(message, data = {}) {
    if (process.env.NODE_ENV === 'development') {
      const log = this.formatLog('DEBUG', message, data);
      console.debug(JSON.stringify(log));
      return log;
    }
  }

  static performance(operation, duration, data = {}) {
    if (duration > 1000) {
      this.warn(`Performance: ${operation} took ${duration}ms`, data);
    } else {
      this.debug(`${operation} completed in ${duration}ms`, data);
    }
  }
}

module.exports = Logger;
