/* eslint-disable no-unused-expressions */
/* eslint-disable no-console */
const fs = require('fs');
const tls = require('tls');
const path = require('path');
const { promisify } = require('util');
const { expect } = require('chai');
const sinon = require('sinon');
const { createServer } = require('../src');

const promisifyWrite = promisify(fs.writeFile);
function delayedPromise(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

const rawBuffers = [
  fs.readFileSync(path.join(__dirname, './keys/good_privkey.pem')),
  fs.readFileSync(path.join(__dirname, './keys/good_cert.pem')),
  fs.readFileSync(path.join(__dirname, './keys/good_chain.pem'))
];

const Opts = {
  key: rawBuffers[0],
  cert: rawBuffers[1],
  ca: rawBuffers[2]
};

const KeyPaths = [
  path.join(__dirname, './keys/good_privkey.pem'),
  path.join(__dirname, './keys/good_cert.pem'),
  path.join(__dirname, './keys/good_chain.pem')
];

function listener(req, res) {
  console.log('connect');
  res.writeHead(200);
  res.write('Hello World!\n');
  res.end('Goodbye World!\n');
}

describe('Tests', () => {
  let sandbox;
  /**
     * @type {import('sinon').SinonSpy}
     */
  let secureContextSpy;

  before(() => {
    sandbox = sinon.createSandbox();
    secureContextSpy = sinon.spy(tls.createSecureContext);
    sandbox.stub(tls, 'createSecureContext').callsFake(secureContextSpy);
    secureContextSpy.resetHistory();
  });

  /**
       * @type {import('https').Server}
       */
  let server;

  afterEach(() => {
    server.close();
    console.log('closing server');
    secureContextSpy.resetHistory();
    // reset file contents
    KeyPaths.forEach((p, index) => {
      fs.writeFileSync(p, rawBuffers[index]);
    });
  });

  it('creates server successfully', (done) => {
    server = createServer(Opts, KeyPaths, listener);

    expect(server).to.not.be.null;
    expect(server).to.not.be.undefined;

    server.listen(9999);

    expect(secureContextSpy.getCalls().length).to.be.greaterThan(0);

    return done();
  });

  it('Reloads context on debounced file change', async () => {
    server = createServer(Opts, KeyPaths, listener, 500);

    expect(server).to.not.be.null;
    expect(server).to.not.be.undefined;

    server.listen(9999);
    const initCalls = secureContextSpy.getCalls().length;

    await promisifyWrite(KeyPaths[0], '\n\n\n\n', { encoding: 'utf8', flag: 'a' });

    await delayedPromise(100);
    await promisifyWrite(KeyPaths[0], '\n\n\n\n', { encoding: 'utf8', flag: 'a' });
    await delayedPromise(500);

    await delayedPromise(200);
    await promisifyWrite(KeyPaths[0], '\n\n\n\n', { encoding: 'utf8', flag: 'as' });

    expect(secureContextSpy.getCalls().length - initCalls).to.be.eql(2);
  });

  it('Ignores unspecified files', async () => {
    server = createServer(Opts, [KeyPaths[0]], listener, 500);

    expect(server).to.not.be.null;
    expect(server).to.not.be.undefined;

    server.listen(9999);
    const initCalls = secureContextSpy.getCalls().length;
    await promisifyWrite(KeyPaths[1], '\n\n\n\n', { encoding: 'utf8', flag: 'a' });
    await delayedPromise(550);

    await promisifyWrite(KeyPaths[2], '\n\n\n\n', { encoding: 'utf8', flag: 'as' });
    await delayedPromise(200);

    expect(secureContextSpy.getCalls().length - initCalls).to.be.eql(0);
  });
});
