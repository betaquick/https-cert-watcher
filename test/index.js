/* eslint-disable no-unused-expressions */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { expect } = require('chai');
const sinon = require('sinon');
const { createServer } = require('../src');

const promisifyWrite = promisify(fs.writeFile);

const rawBuffers = [
  fs.readFileSync(path.join(__dirname, './keys/good_privkey.pem')),
  fs.readFileSync(path.join(__dirname, './keys/good_cert.pem')),
  fs.readFileSync(path.join(__dirname, './keys/good_chain.pem'))
];

const KeyPaths = [
  path.join(__dirname, './keys/good_privkey.pem'),
  path.join(__dirname, './keys/good_cert.pem'),
  path.join(__dirname, './keys/good_chain.pem')
];

function listener(req, res) {
  res.writeHead(200);
  res.write('Hello World!\n');
  res.end('Goodbye World!\n');
}

const logger = { info: () => {}, debug: console.log };

describe('Tests', () => {
  let sandbox;
  let clock;
  /**
     * @type {import('sinon').SinonSpy}
     */
  let secureContextSpy;

  before(() => {
    sandbox = sinon.createSandbox();
    secureContextSpy = sinon.fake.returns({
      key: fs.readFileSync(path.join(__dirname, './keys/good_privkey.pem')),
      cert: fs.readFileSync(path.join(__dirname, './keys/good_cert.pem'))
    });
    secureContextSpy.resetHistory();
  });

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  /**
   * @type {import('https').Server}
   */
  let server;

  afterEach(() => {
    secureContextSpy.resetHistory();
    clock.restore();
    server.close(() => {
      console.log('closing server');
      // reset file contents
      KeyPaths.forEach((p, index) => {
        fs.writeFileSync(p, rawBuffers[index]);
      });
    });
  });

  after(() => {
    sandbox.restore();
  });

  it('creates server successfully', (done) => {
    server = createServer(secureContextSpy, KeyPaths, listener, 500, logger);

    expect(server).to.not.be.null;
    expect(server).to.not.be.undefined;

    server.listen(9999);

    expect(secureContextSpy.callCount).to.be.eql(1);

    return done();
  });

  it('Reloads context on debounced file change', async () => {
    server = createServer(secureContextSpy, KeyPaths, listener, 500, logger);

    expect(server).to.not.be.null;
    expect(server).to.not.be.undefined;

    server.listen(9999);
    const initCalls = secureContextSpy.callCount;

    await promisifyWrite(KeyPaths[0], '\n\n\n\n', { encoding: 'utf8', flag: 'a' });

    expect(secureContextSpy.callCount - initCalls).to.be.eql(0);
    clock.tick(1000);
    await promisifyWrite(KeyPaths[1], '\n\n\n\n', { encoding: 'utf8', flag: 'a' });
    expect(secureContextSpy.callCount - initCalls).to.be.eql(1);

    clock.tick(500);
    await promisifyWrite(KeyPaths[0], '\n\n\n\n', { encoding: 'utf8', flag: 'a' });

    expect(secureContextSpy.callCount - initCalls).to.be.eql(2);
  });

  it('Ignores unspecified files', async () => {
    server = createServer(secureContextSpy, [KeyPaths[0]], listener, 500, logger);

    expect(server).to.not.be.null;
    expect(server).to.not.be.undefined;

    server.listen(9999);
    const initCalls = secureContextSpy.callCount;
    await promisifyWrite(KeyPaths[1], '\n\n\n\n', { encoding: 'utf8', flag: 'a' });
    clock.tick(550);

    await promisifyWrite(KeyPaths[2], '\n\n\n\n', { encoding: 'utf8', flag: 'as' });
    clock.tick(200);

    expect(secureContextSpy.callCount - initCalls).to.be.eql(0);
  });
});
