const fs = require('fs');
const config = require('./config');

class Logger {
  constructor() {
    this.enabled = config.logging.enabled;
    this.logFile = config.logging.logFile;
    this.logLevel = config.logging.logLevel;
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  _shouldLog(level) {
    return this.enabled && this.levels[level] >= this.levels[this.logLevel];
  }

  _formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        try {
          logEntry += `\n${JSON.stringify(data, null, 2)}`;
        } catch (e) {
          logEntry += `\n[Object conversion failed: ${e.message}]`;
        }
      } else {
        logEntry += ` ${data}`;
      }
    }
    
    return logEntry;
  }

  _writeToFile(message) {
    if (this.enabled) {
      fs.appendFileSync(this.logFile, message + '\n');
    }
  }

  debug(message, data) {
    if (this._shouldLog('debug')) {
      const logMessage = this._formatMessage('debug', message, data);
      this._writeToFile(logMessage);
    }
  }

  info(message, data) {
    if (this._shouldLog('info')) {
      const logMessage = this._formatMessage('info', message, data);
      this._writeToFile(logMessage);
    }
  }

  warn(message, data) {
    if (this._shouldLog('warn')) {
      const logMessage = this._formatMessage('warn', message, data);
      this._writeToFile(logMessage);
    }
  }

  error(message, data) {
    if (this._shouldLog('error')) {
      const logMessage = this._formatMessage('error', message, data);
      this._writeToFile(logMessage);
    }
  }
}

module.exports = new Logger();