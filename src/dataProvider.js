const fs = require('fs');
const fsP = fs.promises;
const debug = require('debug')('api:dataProvider');

const DATA_PATH = 'gamedata';
const api = require('./apiProvider');
const loginHandler = require('./loginHandler');
const misc = require('./misc');

// in-memory data cache for champions and runes
let data = null;
// contains promise if getData is already loading things
let loadingPromise = null;
// stores full path to data cache of current version
let path = null;
// current version of cached stuffs
let version = null;
// used to check whether or not the cached data is up to date
let prevDataVersion = null;
// whether or not the data we curently have is of the current version
// false causes a re-fetch of version data, and if the version did change,
// a re-fetch of all cached data
let dataIsCurrent = false;
let versionIsCurrent = false;

/**
 * Get champion data from the client, retrying if not yet available
 * @return {Object}
 */
async function getChampionData() {
  let summoner = await api.wampRequest('GET /lol-summoner/v1/current-summoner');
  let summonerId = summoner.summonerId;
  debug(`fetching champion data (${summonerId})`);
  let championsUrl = `/lol-champions/v1/inventories/${summonerId}/champions`;
  try {
    return await api.wampRequest('GET ' + championsUrl);
  } catch (err) {
    if (err.code === 'Disconnected') throw err;
    debug(`failed to fetch champion data (${err.code}: ${err.description}), waiting for event`);
    let [, data] = await misc.waitForEvent(api, 'OnJsonApiEvent-' + championsUrl);
    debug('got champions data from event');
    return data;
  }
}

/**
 * Get current version of the client
 * @return {String}
 */
async function getCurrentVersion() {
  if (versionIsCurrent) return version;
  let build = await api.wampRequest('GET /system/v1/builds');
  version = build.version;
  debug('version ' + version);
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
  debug('loading data');
  // ensure we have the data of the current version
  await getCurrentVersion();
  if (version === prevDataVersion) {
    debug('current data matches version');
    dataIsCurrent = true;
    return data;
  }
  debug(`data does not match version (${prevDataVersion} ${version})`);
  // update cached data
  let out = {};
  try {
    out.champions = JSON.parse(await fsP.readFile(path + 'champions.json'));
    out.perks = JSON.parse(await fsP.readFile(path + 'perks.json'));
    out.perkStyles = JSON.parse(await fsP.readFile(path + 'perkStyles.json'));
    debug('data loaded successfully from filesystem cache');
  } catch (err) {
    debug('failed to load from filesystem, loading from client');
    await loginHandler.waitForLogin();
    let p;
    try {
      p = await Promise.all([
        getChampionData(),
        api.wampRequest('GET /lol-perks/v1/perks'),
        api.wampRequest('GET /lol-perks/v1/styles')
      ]);
    } catch (err) {
      debug(`failed to load data from client (${err.code}: ${err.description})`);
      throw err;
    }
    out.champions = p[0];
    out.perks = p[1];
    out.perkStyles = p[2];
    debug('data loaded from client');
    // we don't have to wait for any of this
    (async () => {
      try {
        await fsP.mkdir(path);
      } catch (err) {
        // it already exists, do nothing
      }
      fsP.writeFile(path + 'champions.json', JSON.stringify(out.champions, null, 2));
      fsP.writeFile(path + 'perks.json', JSON.stringify(out.perks, null, 2));
      fsP.writeFile(path + 'perkStyles.json', JSON.stringify(out.perkStyles, null, 2));
      debug('data cached to filesystem');
    })();
  }
  // try to save a copy of the swagger api docs
  (async () => {
    try {
      await fsP.stat(path + 'openapi.json');
    } catch (err) {
      let openapi;
      try {
        openapi = await api.wampRequest('GET /swagger/v3/openapi.json');
        fsP.writeFile(path + 'openapi.json', JSON.stringify(openapi, null, 2));
        debug('saving api documentation');
      } catch (err) {
        // swagger isn't enabled
        // put "enable_swagger: true" after the "---" line in
        // RADS/projects/league_client/releases/<latest release>/deploy/system.yaml
        // then restart
        debug('swagger is not enabled');
      }
    }
  })();
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
  debug('forcing data update');
  versionIsCurrent = false;
  dataIsCurrent = false;
}

api.on('wsConnect', () => forceUpdate());

module.exports = { getCurrentVersion, getData, forceUpdate };
