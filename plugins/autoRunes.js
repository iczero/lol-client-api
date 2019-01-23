const fs = require('fs');

const RUNES_PATH = 'runes';
const api = require('../src/apiProvider');
const dataProvider = require('../src/dataProvider');
const runesToId = require('../src/runesToId');
const loginHandler = require('../src/loginHandler');

module.exports = async function start() {
  await loginHandler.waitForLogin();
  let data = await dataProvider.getData();
  let runePages = await api.wampRequest('GET /lol-perks/v1/pages');
  let pageId = runePages.filter(a => a.name.startsWith('auto '))[0].id;
  let autoCurrentChampionId = -1;
  let prevSelectedChampionId = -1;

  let handler = async (type, session) => {
    if (type === 'Delete') return;
    let selectedChampionId;
    for (let action2 of session.actions) {
      for (let action of action2) {
        // only do stuff for the local player
        if (action.actorCellId !== session.localPlayerCellId) continue;
        // only update runes on champion pick
        if (action.type !== 'pick') continue;
        selectedChampionId = action.championId;
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
    try {
      await api.wampRequest('PUT /lol-perks/v1/pages/' + pageId, runePage);
    } catch (err) {
      console.error(`Error while setting rune page for ${champion.name} (check validity?)`);
      console.error(`${err.code}: ${err.description}`);
    }
    autoCurrentChampionId = champion.id;
    console.log('Auto-updating rune page for ' + champion.name);
  };
  api.on('OnJsonApiEvent-/lol-champ-select/v1/session', handler);
  api.once('wsDisconnect', () => {
    api.removeListener('OnJsonApiEvent-/lol-champ-select/v1/session', handler);
  });
};
