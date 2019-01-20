const LeagueClientAPI = require('./LeagueClientAPI');

const config = require('../config.js');

module.exports = new LeagueClientAPI(config.exePath);
