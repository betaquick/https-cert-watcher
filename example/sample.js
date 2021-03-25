const fs = require('fs');
const path = require('path');

const { createServer } = require('../src');

const badOpts = {
  key: fs.readFileSync(path.join(__dirname, '../test//keys/good_privkey.pem')),
  cert: fs.readFileSync(path.join(__dirname, '../test/keys/good_cert.pem')),
  ca: fs.readFileSync(path.join(__dirname, '../test/keys/good_chain.pem'))
};

const badKeyPaths = [
  path.join(__dirname, '../test/keys/good_cert.pem'),
  path.join(__dirname, '../test//keys/good_chain.pem'),
  path.join(__dirname, '../test/keys/good_privkey.pem')
];

const server = createServer(badOpts, badKeyPaths, (req, res) => {
  // eslint-disable-next-line no-console
  console.log('connect');
  res.writeHead(200);
  res.write('Hello World!\n');
  res.end('Goodbye World!\n');
}, 20);

// eslint-disable-next-line no-console
server.listen(9999, () => console.log('Server up: ', server.address()));
