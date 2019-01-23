// random useful stuff

/** Basically Promise.deferred() */
class Deferred {
  /** The constructor */
  constructor() {
    let resolveFn;
    let rejectFn;
    this.promise = new Promise(function deferredHandler(resolve, reject) {
      resolveFn = resolve;
      rejectFn = reject;
    });
    this.resolve = resolveFn;
    this.reject = rejectFn;
  }
}

/**
 * Ensure an async function innerFn only has one instance running at a time
 * @param {AsyncFunction} innerFn
 * @return {AsyncFunction}
 */
function runOnce(innerFn) {
  let currentPromise = null;
  return async function runOnceWrapped(...args) {
    if (currentPromise) return await currentPromise;
    currentPromise = innerFn(...args);
    let result = await currentPromise;
    currentPromise = null;
    return result;
  };
}

module.exports = {
  Deferred,
  runOnce
};
