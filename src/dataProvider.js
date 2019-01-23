const fs = require('fs');
const fsP = fs.promises;
const stream = require('stream');

const DATA_PATH = 'gamedata';
const api = require('./apiProvider');
const loginHandler = require('./loginHandler');

// in-memory data cache for champions and runes
let data = null;
// contains promise if getData is already loading things
let loadingPromise = null;
// stores full path to data cache of current version
let path;
// current version of cached stuffs
let version;
// used to check whether or not the cached data is up to date
let prevDataVersion;
// whether or not the data we curently have is of the current version
// false causes a re-fetch of version data, and if the version did change,
// a re-fetch of all cached data
let dataIsCurrent = false;
let versionIsCurrent = false;

/**
 * Get current version of the client
 * @return {String}
 */
async function getCurrentVersion() {
  if (versionIsCurrent) return version;
  let build = await api.wampRequest('GET /system/v1/builds');
  version = build.version;
  versionIsCurrent = true;
  path = `${DATA_PATH}/${version}/`;
  return version;
}

/**
 * Load data from disk or the League Client in case of an update
 * @return {Object}
 */
async function loadData() {
  if (dataIsCurrent) return data;
  // ensure we have the data of the current version
  await getCurrentVersion();
  if (version === prevDataVersion) {
    dataIsCurrent = true;
    return data;
  }
  // update cached data
  let out = {};
  try {
    out.champions = JSON.parse(await fsP.readFile(path + 'champions.json'));
    out.perks = JSON.parse(await fsP.readFile(path + 'perks.json'));
    out.perkStyles = JSON.parse(await fsP.readFile(path + 'perkStyles.json'));
  } catch (err) {
    await loginHandler.waitForLogin();
    let summoner = await api.wampRequest('GET /lol-summoner/v1/current-summoner');
    let summonerId = summoner.summonerId;
    let p = await Promise.all([
      api.wampRequest(`GET /lol-champions/v1/inventories/${summonerId}/champions`),
      api.wampRequest('GET /lol-perks/v1/perks'),
      api.wampRequest('GET /lol-perks/v1/styles')
    ]);
    out.champions = p[0];
    out.perks = p[1];
    out.perkStyles = p[2];
    // run this later
    (async () => {
      try {
        await fsP.mkdir(path);
      } catch (err) {
        // it already exists, do nothing
      }
      fsP.writeFile(path + 'champions.json', JSON.stringify(out.champions, null, 2));
      fsP.writeFile(path + 'perks.json', JSON.stringify(out.perks, null, 2));
      fsP.writeFile(path + 'perkStyles.json', JSON.stringify(out.perkStyles, null, 2));
    })();
  }
  prevDataVersion = version;
  dataIsCurrent = true;
  data = out;
  return out;
}

/**
 * Get League of Legends item data
 * Currently returns champions, perks, perkStyles
 * @return {Object}
 */
async function getData() {
  if (loadingPromise) return await loadingPromise;
  if (data && dataIsCurrent) return data;
  // data isn't loaded or might not be current
  loadingPromise = loadData();
  await loadingPromise;
  loadingPromise = null;
  return data;
}

/** Clear cache of dataProvider */
function forceUpdate() {
  versionIsCurrent = false;
  dataIsCurrent = false;
}

api.on('wsConnect', () => forceUpdate());

module.exports = { getCurrentVersion, getData, forceUpdate };
