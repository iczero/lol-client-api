const dataProvider = require('./dataProvider');

/**
 * Get rune by name
 * @param {String} name Rune name
 * @return {Number}
 */
async function getRuneByName(name) {
  let data = await dataProvider.getData();
  return data.perks.filter(perk => perk.name === name)[0];
}

/**
 * Get rune style by name
 * @param {String} name Rune style name
 */
async function getRuneStyleByName(name) {
  let data = await dataProvider.getData();
  return data.perkStyles.filter(style => style.name === name)[0];
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
