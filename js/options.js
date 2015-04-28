(function (root, name, object) {

    document.addEventListener('DOMContentLoaded', function () {
        root[name] = object.init();
    });

})(window, 'ntkBalanceOptions', (function() {

    'use strict';

    var options = {

        controls: {
            buttons: {
                btnClose: {
                    o: 'options-btn-close',
                    e: 'closeTab'
                },
                btnSave: {
                    o: 'options-btn-save',
                    e: 'saveOptions'
                }
            },

            fields: {
                login: {o: 'options-login'},
                password: {o: 'options-password'}
            }
        },

        init: function () {
            initControls();
	        this.controls.fields.login.o.focus();

            return this.restoreOptions();
        },

        restoreOptions: function () {
            var self = this;

            chrome.storage.sync.get(['login', 'password'], function(items) {
                self.setCredentials(
                    items.login || '',
                    items.password || ''
                );
            });

            return this;
        },

        saveOptions: function () {
            var self = this;

            return function () {
                var txtPassword = self.controls.fields.password.o,
                    password = self.md5(txtPassword.value),
                    txtLogin = self.controls.fields.login.o,
                    login = txtLogin.value;

                if(!login) {
                    txtLogin.focus();
                    return;
                }

                if(!password) {
                    txtPassword.focus();
                    return;
                }

                self.controls.fields.password.o.value = '';

                chrome.storage.sync.set(
                    {
                        login: login,
                        password: password
                    }, function () {
                        alert('Настройки успешно сохранены. Можно закрыть окно.');
                        chrome.extension.getBackgroundPage()['ntkBalance'].setLastUpdate(false).updateBalanceInfo();
                    }
                );
            }
        },
        
        setCredentials: function (login, password) {
            this.controls.fields.login.o.value = login;
            this.controls.fields.password.o.value = password;
        },

        closeTab: function () {

            return function () {
                chrome.tabs.getCurrent(function(tab) {
                    chrome.tabs.remove(tab.id, function() { });
                });
            }
        },

        md5: function (data) {

            return md5(data);
        }
    };

    // @todo DRY!
    function initControls() {
        for(var i in options.controls) {
            if(options.controls.hasOwnProperty(i)) {
                for(var j in options.controls[i]) {
                    if(options.controls[i].hasOwnProperty(j)) {
                        options.controls[i][j].o = document.getElementById(options.controls[i][j].o);
                        if(options.controls[i][j].o
                            && options.controls[i][j].e
                            && options.hasOwnProperty(options.controls[i][j].e)
                            && options[options.controls[i][j].e] instanceof Function)
                        {
                            options.controls[i][j].o.addEventListener('click', options[options.controls[i][j].e].call(options));
                        }
                    }
                }
            }
        }
    }

    return options;
})());
