const fs = require('fs');
const fsP = fs.promises;

const DATA_PATH = 'gamedata';
const api = require('./apiProvider');

let data = null;
// contains promise if getData is already loading things
let loadingPromise = null;

/**
 * Load data from disk or the League Client in case of an update
 * @return {Object}
 */
async function loadData() {
  let out = {};
  let build = await api.request('GET', '/system/v1/builds');
  let version = build.version;
  let path = `${DATA_PATH}/${version}/`;
  try {
    out.champions = JSON.parse(await fsP.readFile(path + 'champions.json'));
    out.perks = JSON.parse(await fsP.readFile(path + 'perks.json'));
    out.perkStyles = JSON.parse(await fsP.readFile(path + 'perkStyles.json'));
  } catch (err) {
    let summoner = await api.request('GET', '/lol-summoner/v1/current-summoner');
    let summonerId = summoner.summonerId;
    let p = await Promise.all([
      api.request('GET', `/lol-champions/v1/inventories/${summonerId}/champions`),
      api.request('GET', '/lol-perks/v1/perks'),
      api.request('GET', '/lol-perks/v1/styles')
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
  return out;
}

/**
 * Get League of Legends item data
 * Currently returns champions, perks, perkStyles
 * @return {Object}
 */
async function getData() {
  if (loadingPromise) return await loadingPromise;
  if (data) return data;
  // data isn't loaded yet
  loadingPromise = loadData();
  data = await loadingPromise;
  loadingPromise = null;
  return data;
}

/** Clear cache of dataProvider */
function forceUpdate() {
  data = false;
}

module.exports = { getData, forceUpdate };
