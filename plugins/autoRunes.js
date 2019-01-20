const fs = require('fs');

const RUNES_PATH = 'runes';
const api = require('../src/apiProvider');
const dataProvider = require('../src/dataProvider');
const runesToId = require('../src/runesToId');

let started;

module.exports = async function start() {
  if (started) return;
  started = true;
  let data = await dataProvider.getData();
  let runePages = await api.request('GET', '/lol-perks/v1/pages');
  let pageId = runePages.filter(a => a.name.startsWith('auto '))[0].id;
  let autoCurrentChampionId = -1;
  let prevSelectedChampionId = -1;

  api.on('event-/lol-champ-select/v1/session', async (type, session) => {
    let selectedChampionId;
    for (let slot of session.myTeam) {
      if (slot.cellId === session.localPlayerCellId) {
        selectedChampionId = slot.championId;
        break;
      }
    }

    // no change for champion selection of current player
    if (selectedChampionId === prevSelectedChampionId) return;
    prevSelectedChampionId = selectedChampionId;
    if (selectedChampionId === 0) return;
    // the rune page has already been set to this champion's rune page
    if (selectedChampionId === autoCurrentChampionId) return;
    let champion = data.champions.filter(a => a.id === selectedChampionId)[0];
    let runePage;
    try {
      runePage = JSON.parse(await fs.promises.readFile(`${RUNES_PATH}/${champion.name}.json`));
    } catch (err) {
      return;
    }
    runePage = await runesToId.compileRunePage(runePage);
    Object.assign(runePage, { name: `auto (${champion.name})` });
    await api.request('PUT', '/lol-perks/v1/pages/' + pageId, {
      body: runePage
    });
    autoCurrentChampionId = champion.id;
    console.log('Auto-updating rune page for ' + champion.name);
  });
};
