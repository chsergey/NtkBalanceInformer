(function (root, name, object) {

    root[name] = object.init();

})(window, 'ntkBalance', (function () {

    'use strict';

    var widget = {

        lastUpdate: false,

        balanceInfo: {
            name: '',
            contractId: '',
            balance: null,
            days2BlockStr: '',
            debetBound: '',
            errorCode: 0
        },

        errorMessages: {
            0: '',
            1: 'Неправильный логин или пароль.',
            300: 'Введите логин и пароль в настройках.',
	        1000: 'Ошибка связи. Повторите запрос позднее.',
            1503: 'Ошибка сервера. Повторите запрос через несколько секунд.',
	        100500: 'Неизвестная ошибка((( Напишите разработчику.'
        },

        options: {
            alarm: {
                name: 'ntkBalanceAlarm',
                params: {
                    periodInMinutes: 90
                }
            },
            api: {
                url: 'https://api.novotelecom.ru/billing/',
                method: 'userInfo',
                clientVersion: 2
            }
        },

        init: function () {
            _createAlarm(this.options.alarm.name, this.options.alarm.params);
            _subscribeOnAlarms(_alarmsCallback);

            return this.updateBalanceInfo();
        },

        updateBalanceInfo: function () {
	        chrome.storage.sync.get(['login', 'password'], function(items) {
                if(items.login && items.password) {
                    _processingUpdate(items);
                } else if(!items.login || !items.password) {
                    widget.setError(300);
                }
            });

            return this;
        },

        isUpdatedToday: function () {
            var result = true;

            if(!this.lastUpdate || (this.lastUpdate && (_isYesterday(this.lastUpdate)))) {
                result = false;
            }

            this.lastUpdate = new Date;

            return result;
        },

        getVersion: function() {
            return _getManifest().version;
        },

	    getCurrentBalanceInfo: function () {
			return this.balanceInfo;
	    },

	    setLastUpdate: function (date) {
		    this.lastUpdate = date;

		    return this;
	    },

        setError: function (code) {
            _setBalance(null);
            _showBalanceInfo();
            this.balanceInfo.errorCode = code || 100500;

            return this;
        }
    };

    function _processingUpdate (credentials) {
        if(widget.isUpdatedToday()) {
            return true;
        }

        _showBalanceInfo();

        var xhr = new XMLHttpRequest();
        xhr.open('GET', _getApiUrl(credentials), true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                if(xhr.status === 200) {
                    if(_parseResponse(xhr.responseXML)) {
                        _showBalanceInfo();
                    }
                } else {
                    widget.setLastUpdate(false).setError(xhr.status + 1000);
                }
            }
        };
        xhr.send();
    }

    function _parseResponse(response) {

        if(!response) return false;

        for(var i in widget.balanceInfo) {
            if(widget.balanceInfo.hasOwnProperty(i)) {
                widget.balanceInfo[i] = _getXmlElementText(response, i);
                if('errorCode' === i && parseInt(widget.balanceInfo[i]) > 0) {
                    widget.setError(widget.balanceInfo[i]);
                }
            }
        }

        return parseInt(widget.balanceInfo.errorCode) === 0;
    }

    function _getApiUrl(credentials) {
        var url = widget.options.api.url + '?method=' + widget.options.api.method + '&',
            params = [
                'login='         + credentials.login,
                'passwordHash='  + credentials.password,
                'clientVersion=' + widget.options.api.clientVersion,
                'extVersion='    + widget.getVersion()
            ];

        return url + params.join('&');
    }

    function _createAlarm(name, params) {
        chrome.alarms.create(name, params);
    }

    function _subscribeOnAlarms(callback) {
        chrome.alarms.onAlarm.addListener(callback);
    }

    function _showBalanceInfo() {
        chrome.browserAction.setTitle(_getTitle());
        chrome.browserAction.setBadgeBackgroundColor(_getBadgeBackgroundColor());
        chrome.browserAction.setBadgeText(_getBalanceForBadge());
    }

    function _getBalance() {
        return widget.balanceInfo.balance;
    }

    function _getDaysString() {
        return widget.balanceInfo.days2BlockStr;
    }

    function _setBalance(value) {
        widget.balanceInfo.balance = value;

        return widget;
    }

    function _getBadgeBackgroundColor() {
        var balance = parseInt(_getBalance());

        return {
            color: (isNaN(balance) || balance > 0)
                ? [  0, 150, 0, 255]
                : [150,   0, 0, 255]
        }
    }

    function _getBalanceForBadge() {
        var balance = _getBalance();

        if(balance === null || balance === '') {
            balance = '...';
        } else if(parseInt(balance) > 9999) {
            balance = '>9999';
        } else {
            balance = parseFloat(balance).toFixed(0);
        }

        return {
            text: balance
        }
    }
	
	function _getTitle() {
        var balance = _getBalance();

		return {
			title: balance !== null
                ? ('Ваш баланс: ' + parseFloat(balance).toFixed(2) + ' руб.\r\n' + _getDaysString())
                : 'Электронный город.\r\nНажмите чтобы обновить баланс'
		};
	}
	
    function _getManifest() {
        return chrome.runtime.getManifest();
    }

    function _alarmsCallback(alarm) {
        if(alarm.name === widget.options.alarm.name) {
            widget.updateBalanceInfo();
        }
    }

    function _getXmlElementText(xml, tagname) {
        var element = xml.getElementsByTagName(tagname)[0];

        return element ? element.textContent.trim() : '';
    }

    function _isYesterday(date) {
        var yesterday = (function(d){ d.setDate(d.getDate() - 1); return d;})(new Date),
            comp_funcs = ['getDate', 'getMonth', 'getFullYear'],
            result = true;

        for(var i in comp_funcs) {
            if(comp_funcs.hasOwnProperty(i)) {
                result = result && (yesterday[comp_funcs[i]]() == date[comp_funcs[i]]());
            }
        }

        return result;
    }

    return widget;
})());
