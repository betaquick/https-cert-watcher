const fs = require('fs');
const https = require('https');

function debounce(callback, timeout) {
  let timer;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(callback, timeout, ...args);
  };
}

const defaultLogger = {
  // eslint-disable-next-line no-console
  info: console.log,
  // eslint-disable-next-line no-console
  debug: console.log
};

/**
 *
 * @param {() => import('tls').SecureContext} serverOptsFactory A function that creates the server context
 * @param {Array<string>} paths paths to key filesF
 * @param {import('http').RequestListener} listener
 * @param {number} debounceMS Time to debounce cert refresh in milliseconds
 * @param {{ info: (...args) => void, debug: (...args) => void }=} logger A logger to use
 * @returns {import('https'.Server)} reloading https server
 */
function createServer(serverOptsFactory = () => ({}), paths = [], listener, debounceMS, logger = defaultLogger) {
  function createContext() {
    return serverOptsFactory();
  }

  const server = https.createServer(createContext(), listener);
  let shouldHandleFileChange = true;

  server.once('close', () => {
    shouldHandleFileChange = false;
    paths.forEach((path) => {
      logger.info('Unwatching file ', path);
      fs.unwatchFile(path);
    });
  });

  const reloadSecureContext = debounce(() => {
    if (!shouldHandleFileChange) return;
    logger.info('Setting servers secure context');
    server.setSecureContext(createContext());
  }, debounceMS || 1000);

  function watchForCertFileChanges() {
    paths.forEach((path) => {
      logger.info('Watching ', path);
      fs.watch(path, { persistent: false }, () => {
        if (shouldHandleFileChange) reloadSecureContext();
      });
    });
  }

  watchForCertFileChanges();

  return server;
}

module.exports = {
  createServer
};
