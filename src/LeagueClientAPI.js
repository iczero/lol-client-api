const LCUConnector = require('lcu-connector');
const WebSocket = require('ws');
const EventEmitter = require('events');
const request = require('request-promise');

const messageTypes = {
  WELCOME: 0,
  PREFIX: 1,
  CALL: 2,
  CALLRESULT: 3,
  CALLERROR: 4,
  SUBSCRIBE: 5,
  UNSUBSCRIBE: 6,
  PUBLISH: 7,
  EVENT: 8
};

/** Represents an API client for the League of Legneds client API */
class LeagueClientAPI extends EventEmitter {
  /**
   * The constructor
   * @param {String} exePath Path to LeagueClient.exe
   */
  constructor(exePath) {
    super();
    this.exePath = exePath;
    this.connector = new LCUConnector(exePath);
    this.connectionData = null;
    this.wsConnection = null;

    this._init();
  }
  /**
   * Initializes async stuff
   */
  _init() {
    this.connector.start();
    this.connector.on('connect', this._onLockfileExists.bind(this));
    this.connector.on('disconnect', this._onLockfileGone.bind(this));
  }
  /**
   * Called internally when lcu-connector finds a lockfile
   * @param {Object} data
   */
  _onLockfileExists(data) {
    this.connectionData = data;
    this.urlPrefix = `${data.protocol}://127.0.0.1:${data.port}`;
    this.connectWs(data);
    this.emit('connect');
  }
  /**
   * Called internally when the lockfile is deleted
   */
  _onLockfileGone() {
    this.emit('disconnect');
    this.connectionData = null;
    this.urlPrefix = null;
  }
  /** Attempt to connect to the websocket server */
  connectWs() {
    let data = this.connectionData;
    if (!data) return;
    this.wsConnection = new WebSocket(`ws${data.protocol === 'https' ? 's' : ''}://127.0.0.1:${data.port}`, {
      headers: {
        'Authorization': 'Basic ' +
          Buffer.from('riot:' + data.password).toString('base64')
      },
      rejectUnauthorized: false
    });
    this.wsConnection
      .on('open', () => {
        this.emit('wsConnect');
        // subscribe to events
        this.wsConnection.send(JSON.stringify([5, 'OnJsonApiEvent']));
      })
      .on('close', code => {
        this.emit('wsDisconnect', code);
        this.wsConnection = null;
      })
      .on('error', err => {
        // because the server isn't up yet
        this.emit('wsError', err);
        // retry
        setTimeout(() => this.connectWs(data), 1000);
      })
      .on('message', this._handleWsMessage.bind(this));
  }
  /**
   * Handles a websocket message
   * @param {Object} message
   */
  _handleWsMessage(message) {
    try {
      message = JSON.parse(message);
    } catch (err) {
      // the first message sent is an empty string
    }
    let [type, ...data] = message;
    if (!type) return;
    switch (type) {
      // TODO: deal with other types
      case messageTypes.EVENT: {
        let event = data[1];
        this.emit('event', event);
        this.emit('event-' + event.uri, event.eventType, event.data);
        break;
      }
    }
  }
  /**
   * Make an API request
   * @param {String} method HTTP method
   * @param {String} endpoint API endpoint
   * @param {Object} options Additional options to request()
   * @return {Object} The result of the request
   */
  async request(method, endpoint, options) {
    return await request({
      method,
      url: this.urlPrefix + endpoint,
      json: true,
      headers: {
        'Accept': 'application/json'
      },
      auth: {
        user: 'riot',
        pass: this.connectionData.password
      },
      rejectUnauthorized: false,
      ...options
    });
  }
}

LeagueClientAPI.messageTypes = messageTypes;

module.exports = LeagueClientAPI;
