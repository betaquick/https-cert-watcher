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
 * @param {import('http').RequestListener} listener
 * @param {number} debounceMS Time to debounce cert refresh in milliseconds
 * @returns {import('https'.Server)} reloading https server
 */
function createServer(certOpts = {}, listener, debounceMS) {
  function createContext() {
    return tls.createSecureContext(certOpts);
  }

  const server = https.createServer(createContext(), listener);

  function reloadSecureContext() {
    debounce(() => {
      server.setSecureContext(createContext());
    }, debounceMS || 1000);
  }

  /**
   * @param {Array<string>} files Array of file paths to watch
   */
  function watchForCertFileChanges(files) {
    files.forEach(([path]) => {
      fs.watch(path, reloadSecureContext);
    });
  }

  reloadSecureContext(server);

  const filesToWatch = [
    certOpts.ca, certOpts.cert, certOpts.crl, certOpts.key,
  ].filter((x) => !!x);

  watchForCertFileChanges(filesToWatch);

  process.on('exit', () => filesToWatch.forEach((filePath) => fs.unwatchFile(filePath)));

  return server;
}

module.exports = {
  createServer
};
