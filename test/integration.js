/* eslint-disable no-unused-expressions */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { expect } = require('chai');

const { createServer } = require('../src');

function makeHttpsCall(_port, cb) {
  // unfortunately having issues actually validating the peerCertificate
  // see https://stackoverflow.com/a/39315887/5134605
  // and tls throws ERRCONREFUSED errors
  https.get(`https://localhost:${_port}`, {
    rejectUnauthorized: true,
    requestCert: false
    // ,agent: new Agent({ keepAlive: false }) // default is already false
  })
    .on('response', (resp) => cb(null, resp))
    .on('error', (err) => {
      cb(err, null);
    });
}

describe('Integration Tests', () => {
  let server;
  let port;
  const KeyPaths = [
    path.join(__dirname, './keys/key.pem'),
    path.join(__dirname, './keys/cert.pem')
  ];
  before((done) => {
    function serverOptsFactory() {
      return {
        key: fs.readFileSync(KeyPaths[0]),
        cert: fs.readFileSync(KeyPaths[1]),
        ca: fs.readFileSync(path.join(__dirname, './keys/good_chain.pem'))
      };
    }

    server = createServer(serverOptsFactory, KeyPaths, (req, res) => {
      res.writeHead(200);
      res.write('Hello World!\n');
      res.end('Goodbye World!\n');
    }, 20);

    server.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  after((done) => {
    server.close(() => {
      fs.writeFileSync(KeyPaths[0], fs.readFileSync(path.join(__dirname, './keys/key.pem.bak')));
      fs.writeFileSync(KeyPaths[1], fs.readFileSync(path.join(__dirname, './keys/cert.pem.bak')));
      done();
    });
  });
  it('Switches certs', (done) => {
    makeHttpsCall(port, () => {
      fs.writeFileSync(KeyPaths[0], fs.readFileSync(path.join(__dirname, './keys/good_privkey.pem')));
      fs.writeFileSync(KeyPaths[1], fs.readFileSync(path.join(__dirname, './keys/good_cert.pem')));

      setTimeout(() => {
        makeHttpsCall(port, (err) => {
          expect(err.code).to.eql('ERR_TLS_CERT_ALTNAME_INVALID');
          expect(err.reason).to.eql("Host: localhost. is not in the cert's altnames: DNS:api.gracetreeservices.com");
          done();
        });
      }, 100);
    });
  });
});
