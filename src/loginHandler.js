const api = require('./apiProvider');
const misc = require('./misc');
const config = require('../config');

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
  let result = await api.wampRequest('POST /lol-login/v1/session', {
    username: config.autoLogin.username,
    password: config.autoLogin.password
  });
  // login failed
  if (result.error) {
    config.autoLogin.failed = true;
    return false;
  }
  // login didn't fail, at least
  return true;
}

/** Reset logged-in state */
function resetLoginStatus() {
  if (!isLoggedIn) return;
  isLoggedIn = false;
  loginState = null;
  loginWaitDeferred = new misc.Deferred();
  loginWaitDeferred.promise.then(a => isLoggedIn = true);
}

/**
 * Wait for the user to log in, or do it for them if credentials are provided
 */
async function waitForLogin() {
  if (isLoggedIn) return;
  if (!hasReceivedState) {
    // we have not yet received an event for login, so update state
    try {
      let session = await api.wampRequest('GET /lol-login/v1/session');
      loginState = session.state;
      hasReceivedState = true;
      if (session.connected) return loginWaitDeferred.resolve();
    } catch (err) {
      // do nothing
    }
  }
  await doLogin();
  await loginWaitDeferred.promise;
}

api.on('wsDisconnect', () => resetLoginStatus());
api.on('OnJsonApiEvent-/lol-login/v1/session', (type, session) => {
  hasReceivedState = true;
  if (type === 'Delete') return resetLoginStatus();
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
