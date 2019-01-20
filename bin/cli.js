const repl = require('repl');
const http = require('http');
const util = require('util');

const api = require('../src/apiProvider');
const config = require('../config.js');
const dataProvider = require('../src/dataProvider');

api
.on('connect', async () => {
  console.log('Found lockfile');
  dataProvider.forceUpdate();
  for (let [key, val] of Object.entries(config.plugins)) {
    await require(val)();
    console.log('Started plugin ' + key);
  }
})
.on('disconnect', () => console.log('Lockfile removed'))
.on('wsConnect', () => console.log('WebSocket events connected'))
.on('wsDisconnect', () => console.log('WebSocket events disconnected'))
.on('event', ev => {
  console.log(`===== Event: ${ev.eventType} ${ev.uri}`);
  console.log(util.inspect(ev.data, config.cliInspectOpts));
  console.log('');
})
.on('error', err => console.error(err));

let replServer = repl.start({
  breakEvalOnSigint: true
});
replServer.on('exit', () => process.exit(0));
replServer.context.api = api;
replServer.context.result = null;
let request = function replDoRequest(method, endpoint, options) {
  api.request(
    method,
    endpoint,
    Object.assign({}, {
      transform(body, response) {
        return { response, body };
      },
      simple: false
    }, options)
  )
  .then(result => {
    console.log(`===== Response: ${method} ${endpoint}`);
    let res = result.response;
    console.log(`HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage || ''}`);
    for (let [header, content] of Object.entries(res.headers)) {
      console.log(`${header}: ${content}`);
    }
    console.log('');
    console.log(util.inspect(result.body, config.cliInspectOpts));
    console.log('');
    replServer.context.result = result.body;
  });
};

for (let method of http.METHODS) {
  request[method.toLowerCase()] = Function.prototype.bind.call(request, null, method);
}

replServer.context.request = request;
