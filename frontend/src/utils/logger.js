const LOG_LEVEL = process.env.REACT_APP_LOG_LEVEL || 'INFO';

const logger = {
  debug: (...args) => {
    if (LOG_LEVEL === 'DEBUG') {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args) => {
    if (['DEBUG', 'INFO'].includes(LOG_LEVEL)) {
      console.log('[INFO]', ...args);
    }
  },
  error: (...args) => {
    console.error('[ERROR]', ...args);
  }
};

export default logger;
