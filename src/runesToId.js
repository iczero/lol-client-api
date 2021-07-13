const dataProvider = require('./dataProvider');

/**
 * Get rune by name
 * @param {String} name Rune name
 * @return {Number}
 */
async function getRuneByName(name) {
  let data = await dataProvider.getData();
  let runeDesc = data.perks.filter(perk => perk.name === name)[0];
  if (!runeDesc) throw new Error('Invalid rune name: ' + name);
  return runeDesc;
}

/**
 * Get rune style by name
 * @param {String} name Rune style name
 */
async function getRuneStyleByName(name) {
  let data = await dataProvider.getData();
  let styleDesc = data.perkStyles.filter(style => style.name === name)[0];
  if (!styleDesc) throw new Error('Invalid rune style name: ' + name);
  return styleDesc;
}

/**
 * Output object with rune names changed to their IDs
 * @param {Object} src
 */
async function compileRunePage(src) {
  let out = {};
  if (typeof src.primaryStyleId === 'string') {
    out.primaryStyleId = (await getRuneStyleByName(src.primaryStyleId)).id;
  } else out.primaryStyleId = src.primaryStyleId;
  out.selectedPerkIds = [];
  for (let perk of src.selectedPerkIds) {
    if (typeof perk === 'string') {
      out.selectedPerkIds.push((await getRuneByName(perk)).id);
    } else out.selectedPerkIds.push(perk);
  }
  if (typeof src.subStyleId === 'string') {
    out.subStyleId = (await getRuneStyleByName(src.subStyleId)).id;
  } else out.subStyleId = src.subStyleId;
  return out;
}

module.exports = { getRuneByName, getRuneStyleByName, compileRunePage };
