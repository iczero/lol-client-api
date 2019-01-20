const fs = require('fs');
const fsP = fs.promises;

const DATA_PATH = 'gamedata';
const api = require('./apiProvider');

let data = null;

/**
 * Get data from the League Client
 * Currently returns champions, perks, perkStyles
 * @return {Object}
 */
async function getData() {
  if (data) return data;
  data = {};
  let build = await api.request('GET', '/system/v1/builds');
  let version = build.version;
  let path = `${DATA_PATH}/${version}/`;
  try {
    data.champions = JSON.parse(await fsP.readFile(path + 'champions.json'));
    data.perks = JSON.parse(await fsP.readFile(path + 'perks.json'));
    data.perkStyles = JSON.parse(await fsP.readFile(path + 'perkStyles.json'));
  } catch (err) {
    let summoner = await api.request('GET', '/lol-summoner/v1/current-summoner');
    let summonerId = summoner.summonerId;
    data.champions = await api.request('GET', `/lol-champions/v1/inventories/${summonerId}/champions`);
    data.perks = await api.request('GET', '/lol-perks/v1/perks');
    data.perkStyles = await api.request('GET', '/lol-perks/v1/styles');
    // run this later
    (async () => {
      try {
        fsP.mkdir(path);
      } catch (err) {
        // it already exists, do nothing
      }
      fsP.writeFile(path + 'champions.json', JSON.stringify(data.champions, null, 2));
      fsP.writeFile(path + 'perks.json', JSON.stringify(data.perks, null, 2));
      fsP.writeFile(path + 'perkStyles.json', JSON.stringify(data.perkStyles, null, 2));
    })();
  }
  return data;
}

/** Clear cache of dataProvider */
function forceUpdate() {
  data = false;
}

module.exports = { getData, forceUpdate };
