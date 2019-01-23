const LCUConnector = require('lcu-connector');
const WebSocket = require('ws');
const EventEmitter = require('events');
const request = require('request-promise');
const misc = require('./misc');
const uuid = require('uuid');

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
    // pending WAMP RPC calls
    this.pendingCalls = new Map();

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
      .on('open', () => this.emit('wsConnect'))
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
      // events
      case messageTypes.EVENT: {
        let [eventType, event] = data;
        this.emit('allEvents', eventType, event);
        this.emit(eventType, event);
        // TODO: handle more event types
        if (eventType === 'OnJsonApiEvent') {
          this.emit(eventType + '-' + event.uri, event.eventType, event.data);
        }
        break;
      }
      // RPC results
      case messageTypes.CALLERROR: {
        let [messageId, code, description] = data;
        let error = new Error('RPC error');
        error.code = code;
        error.description = description;
        let deferred = this.pendingCalls.get(messageId);
        if (!deferred) break; // ?????
        deferred.reject(error);
        break;
      }
      case messageTypes.CALLRESULT: {
        let [messageId, result] = data;
        let deferred = this.pendingCalls.get(messageId);
        if (!deferred) break;
        deferred.resolve(result);
        break;
      }
    }
  }
  /**
   * Subscribe to an event over WAMP
   * @param {String} event Event name
   */
  subscribe(event) {
    this.wsConnection.send(JSON.stringify([
      messageTypes.SUBSCRIBE,
      event
    ]));
  }
  /**
   * Unsubscribe from an event over WAMP
   * @param {String} event Event name
   */
  unsubscribe(event) {
    this.wsConnection.send(JSON.stringify([
      messageTypes.UNSUBSCRIBE,
      event
    ]));
  }
  /**
   * Make an API request
   * @param {String} method HTTP method
   * @param {String} endpoint API endpoint
   * @param {Object} options Additional options to request()
   * @return {Object} The result of the request
   */
  async httpRequest(method, endpoint, options) {
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
  /**
   * Make an API request over WAMP (generally faster and more reliable)
   * @param {String} fnName RPC function name
   * @param  {...any} args Any arguments
   */
  async wampRequest(fnName, ...args) {
    if (!this.wsConnection) throw new Error('Not connected');
    let deferred = new misc.Deferred();
    deferred.requestFnName = fnName;
    let id = uuid();
    this.pendingCalls.set(id, deferred);
    this.wsConnection.send(JSON.stringify([
      messageTypes.CALL,
      id,
      fnName,
      ...args
    ]));
    return await deferred.promise;
  }
}

LeagueClientAPI.messageTypes = messageTypes;

module.exports = LeagueClientAPI;
