    (function(w, h, o) {

        w[h] = o;

    })(window, 'w', function initializing() {

        'use strict';

        var DEBUG = true;
        var self = {

            api: {},
            cron: {},
            mdl: {},
            opts: {},
            manifest: chrome.runtime.getManifest(),
            options: {},
            methods: {
                'static': {
                    name: 'getStaticInfo',
                    params: {
                        force: false
                    }
                },
                'dynamic': {
                    name: 'getDynamicInfo',
                    params: {}
                }
            },
            error: null,
            errors: {
                emptySettings: 'Нет договоров',
                cronError: 'Не удалось запустить обновление по расписанию'
            },

            init: function(api, cron, mdl, opts) {

                this.api  = api.create({
                    //url: 'https://api.novotelecom.ru/user/v1/',
                    url: ' http://london-app:8490/user/v1/',
                    responseType: 'json',
                    clientId: 'chromeExtension_' + this.manifest.version
                });

                this.cron = cron.create({
                    name: 'ntkBalanceAlarm',
                    params: {
                        periodInMinutes: 90
                    }
                });

                this.mdl = mdl.create();
                this.opts = opts.create();

                //this.startCron();

                return this;
            },

            /**
             * Init cron and start initial update
             * @returns {Promise}
             */
            startCron: function () {
                return this.cron
                    .clearAll()
                    .then(() => {
                        return self.cron.add();
                    })
                    .then((alarmName) => {
                        return self.cron.addListener(alarmName, self, 'onCron');
                    })
                    .then(
                        (result) => {
                            // first call this.onCron()
                            result.obj[result.methodName](true);
                        },
                        (error) => {
                            self.cron.clear(error.msg);
                            throw _getError.call(self, 'cronError');
                        })
                    .catch(self.setError);
            },

            /**
             * Cron callback
             * @param {boolean} [initial]
             */
            onCron: function(initial) {
                if(initial) {
                    _log('Initial update all contracts', this.initialUpdateAllContracts());
                } else {
                    _log('Updating all contracts by cron', this.updateAll());
                }
            },

            /**
             * update all registered contracts
             * @returns {Promise}
             */
            updateAll: function () {

                return self.mdl.getContracts()
                    .then((contracts) => {
                        return contracts.map((contract) => {
                            return self.updateContract(contract);
                        });
                    })
                    .catch(self.setError);
            },

            /**
             * Cold start. Read all contracts from settings,
             * fill model with credentials, login each in api,
             * get data from api with token
             * @returns {Promise}
             */
            initialUpdateAllContracts: function () {

                return this.fillModelWithCredentials()
                    .then((contracts) => {
                        return Object.keys(contracts).map((contract) => {
                            return self.api
                                .login({
                                    userName: contract,
                                    password: contracts[contract].pwd
                                })
                                .then((token) => {
                                    self.mdl.setContractData(contract, 'token', token);
                                    return self.updateContract(contract);
                                })
                                .catch((error) => {
                                    _log('Error ', error);
                                    return error;
                                });
                        });
                    })
                    .catch(() => {
                        debugger;
                    });
            },

            /**
             * Update one contract
             * @param {int} contract
             * @returns {Promise}
             */
            updateContract: function (contract) {

                return self.mdl
                    .getContractData(contract)
                    .then((data) => {

                        if(data.token) {
                            return data.token;
                        }
                        if(data.params) {
                            return self.api.login({userName: contract, password: data.params.pwd});
                        }

                        throw _getError.call(self.mdl, 'contractCredentialsEmpty');
                    })
                    .then((token) => {
                        self.mdl.setContractData(contract, 'token', token);

                        return Promise.all(self._callMethods(contract, token))
                            .then((calls) => {
                                self.mdl
                                    .setContractData(contract, 'updated', new Date)
                                    .delContractData(contract, 'error');

                                return calls;
                            });
                    })
                    .catch((error) => {
                        //invalid token
                        if(error.code == 2) {
                            console.log('invalid token error')
                        }
                        self.mdl.setContractData(contract, 'error', error);
                        return error;
                    });
            },

            _callMethods: function (contract, token) {
                return Object.keys(self.methods).map((method) => {
                    var methodName = self.methods[method].name,
                        methodParams = self.methods[method].params;

                    return self.api
                        .setToken(token)
                        .callMethod(methodName, methodParams)
                        .then((info) => {
                            self.mdl.setContractData(contract, method, info);
                            return info;
                        })
                        .catch((error) => {
                            _log('Contract', contract, 'method', methodName, 'error', error);
                            self.mdl.setContractData(contract, 'error', error);
                            throw error;
                        });
                })
            },

            fillModelWithCredentials: function() {

                return self.opts
                    .read()
                    .then((options) => {

                        Object.keys(options.contracts).map((contract) => {
                            self.mdl.setContractData(contract, 'params', options.contracts[contract]);
                            self.mdl.setContractData(contract, 'contractId', contract);
                        });

                        return options.contracts;
                    });
            },

            setError: function(error) {
                _log('Widget error', error);
                self.error = error;
            }
        };

        /**
         * Object factory
         * @param component
         * @private
         * @returns {object}
         */
        function _c(component) {
            var ext = {
                options: {
                    value: {},
                    writable: true
                },
                getOpt: {
                    value:  function(name) {
                        return this.options[name];
                    }
                },
                create: {
                    value: function(options) {
                        this.options = options || {};
                        (this.init = this.init || function() {}).bind(this)();

                        return this;
                    },
                    writable: true
                }
            };

            return Object.create(Object.defineProperties(component, ext));
        }

        /**
         *
         * @param code
         * @param msg
         * @returns {{code: *, msg: *}}
         * @private
         */
        function _getError(code, msg) {
            return {
                code: code,
                msg: msg || this.errors[code]
            }
        }

        function _log() {
            if(DEBUG) {
                Function.apply.call(console.log, console, arguments);
            }
        }

        return self.init(
            // API
            _c({
                token: null,

                /**
                 * Send XHR request
                 * @param {string} url
                 * @param {string} [method] - HTTP method
                 * @returns {Promise}
                 */
                sendRequest: function(url, method) {
                    var xhr = new XMLHttpRequest,
                        responseType = this.getOpt('responseType');

                    xhr.getResponse = function(key) {

                        return this.response
                            ? (key ? this.response.response[key] : this.response.response)
                            : null;
                    };

                    xhr.errors = {
                        'requestFailed': 'Ошибка связи'
                    };

                    xhr.getError = function() {
                        if(this.status == 0) return _getError.call(this, 'requestFailed');
                        if(this.status != 200) return _getError(xhr.status, xhr.statusText);

                        return this.getResponse('error');
                    };

                    if(responseType) {
                        xhr.responseType = responseType;
                        url = url + (url[url.length-1]  == '/' ? '?' : '&') + responseType;
                    }

                    return new Promise(function(resolve, reject) {
                        xhr.open(method || 'POST', url, true);
                        xhr.onload = function() {
                            if(this.status == 200) {
                                if(this.getResponse('error')) {
                                    reject(this.getError());
                                } else {
                                    resolve(this.getResponse());
                                }
                            } else {
                                reject(this.getError());
                            }
                        };
                        xhr.onerror = function() { reject(this.getError()); };
                        xhr.send();
                    });
                },

                /**
                 * Generate URL to API with get params from object
                 * @param {string} method
                 * @param {object} params
                 * @returns {*}
                 */
                createUrl: function(method, params) {
                    var url = this.getUrl() + method;
                    if(params) {
                        url = url + '?' + this.serialize(params);
                    }

                    return url;
                },

                /**
                 * Get URL with trailing slash
                 * @returns {string}
                 */
                getUrl: function() {
                    var url = this.getOpt('url');

                    return url + (url[url.length-1] == '/' ? '' : '/');
                },

                /**
                 * Get serialized string from object
                 * @param object
                 * @returns {string}
                 */
                serialize: function(object) {
                    return Object.keys(object).map(function(key) {
                        return key + '=' + encodeURIComponent(object[key]);
                    }).join('&');
                },

                /**
                 * Call abstract API method with params
                 * @param {string} method
                 * @param {object} params
                 * @returns {Promise}
                 */
                callMethod: function callMethod(method, params) {
                    params = params || {};

                    _log('Calling "' + method + '(',  params, ')"');

                    if(this[method] instanceof Function) {

                        return this[method](params);
                    } else {

                        params.token = this.getToken();

                        return this.sendRequest(
                            this.createUrl(method, params)
                        );
                    }
                },

                /**
                 *
                 * @param params object {userName: string, password: string}
                 * @returns {Promise}
                 */
                login: function login(params) {
                    params.clientId = this.getOpt('clientId');

                    return this.sendRequest(this.createUrl('login', params))
                        .then((response) => {

                            return response.token;
                        }).catch((error) => {
                            _log(error);
                            if(DEBUG) throw error;
                        });
                },

                /**
                 * Token setter
                 * @param token
                 * @returns self.api
                 */
                setToken: function(token) {
                    this.token = token;

                    return this;
                },

                /**
                 * Token getter
                 * @returns {string|null}
                 */
                getToken: function() {

                    return this.token;
                }
            }),

            // Cron
            _c({
                init: function()
                {
                   if(DEBUG) this.findAll().then((alarms) => {
                       _log('All registered alarms:', alarms);
                   });
                },

                add: function(name, params) {
                    name = name || this.getOpt('name');
                    params = params || this.getOpt('params');

                    return Promise.resolve({
                        then: (resolve, reject) => {
                            chrome.alarms.create(name, params);
                            resolve(name);
                        }
                    });
                },

                addListener: function (alarmName, obj, methodName) {

                    return new Promise((resolve, reject) => {
                            if(obj[methodName] && obj[methodName] instanceof Function) {
                                chrome.alarms.onAlarm.addListener(function (alarm) {
                                    if(alarm.name == alarmName) {
                                        obj[methodName]();
                                    }
                                });
                                resolve({
                                    obj: obj,
                                    methodName: methodName
                                });
                            } else {
                                reject(_getError(methodName + ' is not a Function', alarmName));
                            }
                    });
                },

                find: function(name) {
                    return new Promise((resolve, reject) => {
                        chrome.alarms.get(name, function(alarm) { if(alarm) { resolve(alarm); } else { reject(false); } });
                    });
                },

                clear: function(name) {
                    return new Promise((resolve, reject) => {
                        chrome.alarms.clear(name, (result) => { if(result) { resolve(result); } else { reject(result); } });
                    });
                },

                findAll: function() {

                    return new Promise((resolve, reject) => { chrome.alarms.getAll((alarms) => { resolve(alarms); }); });
                },

                clearAll: function() {

                    return new Promise((resolve, reject) => {
                        chrome.alarms.clearAll((result) => { if(result) { resolve(result); } else { reject(resulst );} });
                    });
                }
            }),

            // Model
            _c({
                data: {},
                errors: {
                    contractNotFoundInModel: 'Нет данных по договору',
                    contractCredentialsEmpty: 'Не найдены авторизационные данные'
                },

                setDataObserver: function(key, callback) {
                    if(this.data[key]) {
                        Object.observe(this.data[key], callback);
                        return true;
                    }

                    return false;
                },

                /**
                 * Get all data in model
                 * @returns {*}
                 */
                getData: function () {

                    return this.data;
                },

                /**
                 *
                 * @param contract
                 * @param key
                 * @param data
                 * @returns this
                 */
                setContractData: function(contract, key, data) {
                    this.data[contract] = this.data[contract] || {};
                    this.data[contract][key] = data;

                    return this;
                },

                /**
                 *
                 * @param contract
                 * @param key
                 * @returns this
                 */
                delContractData: function (contract, key) {
                    delete this.data[contract][key];

                    return this;
                },

                /**
                 * Get contract data by contract number from model
                 * Minimal needs data[contract].credentials.pwd
                 * @param contract
                 * @returns {Promise}
                 */
                getContractData: function (contract) {

                    return new Promise((resolve, reject) => {
                        if(this.data[contract]) {
                            resolve(this.data[contract]);
                        } else {
                            reject(_getError.call(this, 'contractNotFoundInModel'))
                        }
                    });
                },

                /**
                 * Get contract data by key like 'static.client.name'
                 * @param contract
                 * @param key
                 * @returns {*}
                 */
                getContractDataEx: function(contract, key) {

                    var data = this.data[contract];

                    if(!data || !key) {
                        return null;
                    }

                    return key.split('.').reduce((upper, lower) => upper[lower], data);
                },

                /**
                 * Get contracts numbers from model
                 * @returns {Promise}
                 */
                getContracts: function () {
                    var contracts = Object.keys(this.getData());

                    return new Promise((resolve, reject) => {
                        if (contracts.length) {
                            resolve(contracts);
                        } else {
                            reject(_getError.call(self, 'emptyContracts'));
                        }
                    });
                },

                deleteContract: function (contract) {
                    if(this.data[contract]) {
                        delete this.data[contract];
                    }
                }
            }),

            // Options
            _c({
                init: function() {
                    if(DEBUG) chrome.storage.onChanged.addListener(function(changes, namespace) {
                        Object.keys(changes).map(function(key) {
                            var storageChange = changes[key];
                            _log('Storage key "%s" in namespace "%s" changed.', key, namespace,
                                ' Old value was ', storageChange.oldValue,
                                ' new value is ', storageChange.newValue
                            );
                        });
                    });
                },

                /**
                 * Read setting from Chrome Storage (sync)
                 * @link https://developer.chrome.com/extensions/storage
                 * @param {string|[]} [keys] keys to read
                 * @returns {Promise}
                 */
                read: function(keys) {

                    return new Promise(function(resolve, reject) {
                        chrome.storage.sync.get(keys, function(items) {
                            if(chrome.runtime.lastError) {
                                reject(_getError('chromeRuntimeError', chrome.runtime.lastError.message));
                            } else {
                                if(Object.keys(items).length) {
                                    resolve(items);
                                } else {
                                    reject(_getError.call(self, 'emptySettings'));
                                }
                            }
                        });
                    });
                },

                write: function(options) {

                    return new Promise(function(resolve, reject) {
                        chrome.storage.sync.set(options, () => { this.boolCallback(resolve, reject); });
                    }.bind(this));
                },

                clearAll: function () {

                    return new Promise(function(resolve, reject) {
                        chrome.storage.sync.clear(() => { this.boolCallback(resolve, reject); });
                    }.bind(this));
                },

                boolCallback: function (resolve, reject) {
                    if(chrome.runtime.lastError) { reject(chrome.runtime.lastError); } else { resolve(true); }
                }
            })
        );

    }());