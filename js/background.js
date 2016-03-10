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
                emptyContracts: 'Добавьте договор в настройках',
                cronError: 'Не удалось запустить обновление по расписанию'
            },

            init: function(api, cron, mdl, opts) {

                this.api  = api.create({
                    url: 'https://api.novotelecom.ru/user/v1/',
                    responseType: 'json',
                    appId: 'chromeExtension_' + this.manifest.version
                });

                this.cron = cron.create({
                    name: 'ntkBalanceAlarm',
                    params: {
                        periodInMinutes: 1
                    }
                });

                this.mdl = mdl.create();
                this.opts = opts.create();

                this.startCron();

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
                    .catch(self.setError);
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
                        if(data.credentials) {
                            return self.api.login({userName: contract, password: data.credentials.pwd});
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
                            console.log('invalid token error!!!!')
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
                    .then((contracts) => {

                        Object.keys(contracts).map((contract) => {
                            self.mdl.setContractData(contract, 'credentials', contracts[contract]);
                            self.mdl.setContractData(contract, 'contractId', contract);
                        });

                        return contracts;
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
                    params.appId = this.getOpt('appId');

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
                                    reject(_getError.call(self, 'emptyContracts'));
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

    t = {
        cred: {userName: 239864, password: 'kMZd833LfD7m6me/vtOjNGop1QI='},
        c: function() {
            return w.api.callMethod('login', this.cred)
                .then(function(result) {console.log('chain call LOGIN', result.getResponse());return w.api.callMethod('getStaticInfo');})
                .then(function(result) {console.log('chain call STATIC', result.getResponse());return w.api.callMethod('getDynamicInfo')})
                .then(function(result) {console.log('chain call DYNAMIC', result.getResponse());return result;});
        },

        l: function() {
            return w.api.callMethod('login', this.cred).then(this.then, this.ca);
        },

        s: function() {
            return w.api.callMethod('getStaticInfo').then(this.then, this.ca);
        },

        r: function(k) {
            return w.opts.read(k).then(this.then, this.ca);
        },

        w: function(ww) {
            return w.opts.write(ww || {
                239864: 'kMZd833LfD7m6me/vtOjNGop1QI=',
                666666666: btoa('huhui'),
                777777777: btoa('testsetsetset')
            }).then(this.then, this.ca);
        },

        w1: function(ww) {
            return w.opts.write(ww||{
                '239864': {
                    pwd: 'kMZd833LfD7m6me/vtOjNGop1QI='
                }
            }).then(this.then, this.ca);
        },

        cl: function () {
            return w.opts.clearAll().then(this.then, this.ca);
        },

        aladd: function (name) {
            return w.cron
                .add(name || 'customAlarm', {periodInMinutes: 0.1})
                .then((name) => {
                    w.cron.addListener((alarm) => {
                        if(name == alarm.name) {
                            console.log(alarm.name + ' raised', alarm, this);
                        }
                    });

                    return name;
                })
                .then(t.then)
                .catch(t.ca);
        },

        alff: function () {
            return new Promise.resolve({
                then:() => {
                    return 'huen';
                }
            });
        },

        then: function(result) {
            console.log('success test', result);
            return result;
        },

        ca: function(result) {
            console.log('failed test', result);
            throw result;
        },

        a: {
            'static': {
                client: {
                    name: 'FIO FIO FIO'
                }
            },
            dynamic: {
                balance: -100,
                block: {
                    mess: 'BLOCK MESS'
                }
            },
            a: {
                b: {
                    c:'cc',
                    d:'ddd'
                }
            }
        },
        tt: (name) => {

            var result = {};

            name.split('.').map((k) => {
                result = t.a[k] || result[k] || null;
            });

            return result;
        }
    };