const api = require('./apiProvider');
const misc = require('./misc');
const config = require('../config');
const debug = require('debug')('api:loginHandler');

// we aren't logged in yet, but i am lazy and don't feel like typing the body of
// resetLoginStatus twice
let isLoggedIn = true;
let loginWaitDeferred;
let loginState;
let hasReceivedState = false;

/** Try login with credentials from config */
async function doLogin() {
  if (isLoggedIn) return true;
  if (!config.autoLogin) return false;
  // don't retry wrong credentials
  if (config.autoLogin.failed) return false;
  debug('attempting login');
  let result = await api.wampRequest('POST /lol-login/v1/session', {
    username: config.autoLogin.username,
    password: config.autoLogin.password
  });
  // login failed
  if (result.error) {
    debug('login failed');
    config.autoLogin.failed = true;
    return false;
  }
  // login didn't fail, at least
  debug('login did not fail');
  return true;
}

/** Reset logged-in state */
function resetLoginStatus() {
  if (!isLoggedIn) return;
  let rejectError = new Error('WebSocket disconnected');
  rejectError.code = 'Disconnected';
  rejectError.description = 'Disconnect while waiting for login';
  if (loginWaitDeferred) loginWaitDeferred.reject(rejectError);
  debug(`reset: state ${loginState} => null`);
  hasReceivedState = false;
  isLoggedIn = false;
  loginState = null;
  loginWaitDeferred = new misc.Deferred();
  loginWaitDeferred.promise.then(a => isLoggedIn = true);
}

/** If we haven't yet receieved a login session event, update the current state */
let getInitialState = misc.runOnce(async function getInitialState() {
  debug('doing initial fetch of state');
  try {
    let session = await api.wampRequest('GET /lol-login/v1/session');
    debug(`initial fetch: state ${loginState} => ${session.state}`);
    loginState = session.state;
    hasReceivedState = true;
    if (session.connected) return loginWaitDeferred.resolve();
  } catch (err) {
    // do nothing
    debug('initial fetch: ' + err.message);
  }
});

/**
 * Wait for the user to log in, or do it for them if credentials are provided
 */
async function waitForLogin() {
  if (isLoggedIn) return;
  try {
    if (!hasReceivedState) await getInitialState();
    if (!loginState) await doLogin();
  } catch (err) {
    debug(`failed to login (${err.code}: ${err.description})`);
    throw err;
  }
  await loginWaitDeferred.promise;
}

api.on('wsDisconnect', () => resetLoginStatus());
api.on('OnJsonApiEvent-/lol-login/v1/session', (type, session) => {
  hasReceivedState = true;
  if (type === 'Delete') return resetLoginStatus();
  debug(`event update: state ${loginState} => ${session.state}`);
  loginState = session.state;
  if (isLoggedIn) return;
  if (session.connected) return loginWaitDeferred.resolve();
});

resetLoginStatus();

module.exports = {
  waitForLogin,
  resetLoginStatus,
  // for debugging purposes, mostly
  get loginState() {
    return loginState;
  }
};
