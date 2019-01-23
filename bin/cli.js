const repl = require('repl');
const http = require('http');
const util = require('util');

const api = require('../src/apiProvider');
const config = require('../config.js');

let replServer = repl.start({
  breakEvalOnSigint: true
});
replServer.on('exit', () => process.exit(0));
replServer.context.printEvents = false;

api
.on('connect', () => console.log('Found lockfile'))
.on('disconnect', () => console.log('Lockfile removed'))
.on('wsConnect', async () => {
  console.log('WebSocket events connected');
  // this sorta has to exist or no actual events are given to us
  api.subscribe('OnJsonApiEvent');
  for (let [key, val] of Object.entries(config.plugins)) {
    await require(val)();
    console.log('Started plugin ' + key);
  }
})
.on('wsDisconnect', () => console.log('WebSocket events disconnected'))
.on('OnJsonApiEvent', ev => {
  if (!replServer.context.printEvents) return;
  let out = [];
  out.push(`===== API Event: ${ev.eventType} ${ev.uri}`);
  out.push(util.inspect(ev.data, config.cliInspectOpts));
  out.push('');
  console.log(out.join('\n'));
})
.on('error', err => console.error(err));

replServer.context.api = api;
replServer.context.result = null;
let request = function replDoRequest(method, endpoint, options) {
  api.httpRequest(
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
    let out = [];
    out.push(`===== HTTP Response: ${method} ${endpoint}`);
    let res = result.response;
    out.push(`HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage || ''}`);
    for (let [header, content] of Object.entries(res.headers)) {
      out.push(`${header}: ${content}`);
    }
    out.push('');
    out.push(util.inspect(result.body, config.cliInspectOpts));
    out.push('');
    console.log(out.join('\n'));
    replServer.context.result = result.body;
  });
};
for (let method of http.METHODS) {
  request[method.toLowerCase()] = Function.prototype.bind.call(request, null, method);
}
replServer.context.wrequest = function replDoWampRequest(fnName, ...args) {
  api.wampRequest(fnName, ...args)
  .then(result => {
    let out = [];
    out.push(`===== WAMP Response: ${fnName}`);
    out.push(util.inspect(result, config.cliInspectOpts));
    out.push('');
    console.log(out.join('\n'));
    replServer.context.result = result;
  })
  .catch(error => {
    let out = [];
    out.push(`===== WAMP Error: ${fnName}`);
    out.push(`${error.code}: ${error.description}`);
    out.push('');
    console.log(out.join('\n'));
    replServer.context.result = error;
  });
};

replServer.context.request = request;
