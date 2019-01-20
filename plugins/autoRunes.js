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

  api.on('event-/lol-champ-select/v1/session', async (type, session) => {
    for (let action2 of session.actions) {
      for (let action of action2) {
        // only do stuff for the local player
        if (action.actorCellId !== session.localPlayerCellId) continue;
        // only update runes on champion pick
        // in future, may need to change to lock
        if (action.type !== 'pick') continue;
        let champion = data.champions.filter(a => a.id === action.championId)[0];
        // no need to update as it is already set to the right one
        if (champion.id === autoCurrentChampionId) continue;
        let runePage;
        try {
          runePage = JSON.parse(await fs.promises.readFile(`${RUNES_PATH}/${champion.name}.json`));
        } catch (err) {
          console.log(err);
          continue;
        }
        if (typeof runePage.primaryStyleId === 'string') {
          runePage = await runesToId.compileRunePage(runePage);
        }
        Object.assign(runePage, { name: `auto (${champion.name})` });
        await api.request('PUT', '/lol-perks/v1/pages/' + pageId, {
          body: runePage
        });
        autoCurrentChampionId = champion.id;
        console.log('Auto-updating rune page for ' + champion.name);
      }
    }
  });
};
