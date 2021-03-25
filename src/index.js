const fs = require('fs');
const tls = require('tls');
const https = require('https');

function debounce(callback, timeout) {
  let timer;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(callback, timeout, ...args);
  };
}

/**
 *
 * @param {import('tls').SecureContextOptions} certOpts
 * @param {Array<string>} paths paths to key files
 * @param {import('http').RequestListener} listener
 * @param {number} debounceMS Time to debounce cert refresh in milliseconds
 * @returns {import('https'.Server)} reloading https server
 */
function createServer(certOpts = {}, paths = [], listener, debounceMS) {
  function createContext() {
    return tls.createSecureContext(certOpts);
  }

  const server = https.createServer(createContext(), listener);

  const reloadSecureContext = debounce(() => {
    // eslint-disable-next-line no-console
    console.info('Setting servers secure context');
    server.setSecureContext(createContext());
  }, debounceMS || 1000);

  function watchForCertFileChanges() {
    paths.forEach((path) => {
      // eslint-disable-next-line no-console
      console.info('Watching ', path);
      fs.watchFile(path, () => {
        reloadSecureContext();
      });
    });
  }

  watchForCertFileChanges();

  process.on('exit', () => paths.forEach((filePath) => fs.unwatchFile(filePath)));

  return server;
}

module.exports = {
  createServer
};
