"use strict";

class NtkBalanceOptions {
    /**
     * Constructor
     */
    constructor() {
        this.controls = {
            msgContracts: {select: '#contracts-list-msg'},
            wrapper: {select: '#wrapper'},
            contractsList: {select: '#contracts-list'},
            menu: {
                select: '.menu-item',
                events: {
                    click: this.onMenuSelected
                }
            },
            btnAddContract: {
                select: '#btnAddContract',
                events: {
                    click: this.onAddContract
                }
            },
            template: {select: '#contract-row-template'}
        };

        this.initControls(null);

        this.views = Array.from(this.controls.wrapper.getElementsByClassName('settings-wrapper'));
        this.updateLocation();

        this.settings = {};
        this.core = chrome.extension.getBackgroundPage()['ntkBalance'];
        this.readSettings();
    }

    /**
     * Initial settings reading
     */
    readSettings() {
        this.core.opts
            .read()
            .then(settings => {
                this.settings = settings;
                return settings.contracts;
            })
            .then(contracts => {
                this.renderContracts(contracts);
            })
            .catch((error) => {
                this.controls.msgContracts.text(error.msg).show();
                console.warn(error);
            });
    }

    /**
     * Render settings after read
     * @param contracts
     */
    renderContracts(contracts) {
        Object.keys(contracts).map(contract => {
            this.addNewContractRow(contract, contracts[contract]);
        });
    }

    /**
     * Add contract
     * @param data
     * @returns {Promise}
     */
    addContract(data) {

        return new Promise((resolve, reject) => {
            let sha1 = new jsSHA('SHA-1', 'TEXT');
            sha1.update(data.password);
            data.password = sha1.getHash('B64');

            this.core.api.login({
                userName: data.contract,
                password: data.password
            }).then(token => {
                this.core.mdl.setContractData(data.contract, 'token', token);
                this.updateSettings(data);
                resolve(data);
            }).catch(error => {
                reject(error.msg);
            });
        });
    }

    /**
     * Remove contract
     * @param contract
     */
    removeContract(contract) {
        if(this.settings.contracts) {
            delete this.settings.contracts[contract];
            this.core.opts.write(this.settings);
            this.core.mdl.deleteContract(contract);
        }
    }

    /**
     * Write settings in DB
     * @param data
     */
    updateSettings(data) {
        if(this.settings.contracts) {
            delete this.settings.contracts[data.contract];
        } else {
            this.settings.contracts = {};
        }
        this.settings.contracts[data.contract] = {
            pwd: data.password,
            def: data.def
        };
        this.core.opts.write(this.settings);
        this.core.updateAll();
    }

    /**
     * Display table
     * @returns {NtkBalanceOptions}
     */
    showContractsTable() {
        this.controls.msgContracts.hide();
        this.controls.contractsList.show('table');

        return this;
    }

    /**
     * Init controls, views, prototypes
     * @returns {NtkBalanceOptions}
     */
    initControls(scope) {
        Object.keys(this.controls).map((key) => {
            var control = this.controls[key],
                elements = control.select[0] == '#'
                    ? [document.getElementById(control.select.slice(1))]
                    : (scope ? scope : document).getElementsByClassName(control.select.slice(1));

            elements = Array.from(elements);

            if(elements.length && elements[0] != null) {
                if(control.events) Object.keys(control.events).map((event) => {
                    elements.map((element) => {
                        var func = control.events[event];
                        element.addEventListener(
                            event,
                            func instanceof Function
                                ? func.call(this)
                                : this[func] instanceof Function ? this[func]() : () => {}
                        );
                    });
                });

                this.controls[key] = elements.length === 1 ? elements[0] : elements;
            }
        });

        return this;
    }

    /**
     * Create new contract row
     * @param {int|string} contract
     * @param {object} settings
     */
    addNewContractRow(contract, settings) {

        var tpl = this.controls.template.cloneNode(true),
            row = new ContractRow(tpl, contract, settings, this);

        row.addTo(this.controls.contractsList);

        this.showContractsTable();
    }

    getRowsCount() {
        return this.controls.contractsList.find('.contract-row').length;
    }

    /**
     * Check and update location hash
     * @param hash
     * @returns {NtkBalanceOptions}
     */
    updateLocation(hash) {

        if(hash) {
            document.location.hash = hash;
        } else {
            this.controls.menu.forEach(li =>
                li.getAttribute('data-target') == document.location.hash.slice(1) && !li.hasClass('active')
                    ? li.click()
                    : null
            );
        }

        return this;
    }

    /**
     * Menu click callback
     * @returns {function()}
     */
    onMenuSelected() {

        return (event) => {
            var item = event.target,
                page_id = item.getAttribute('data-target');

            this.controls.menu.forEach(li => li[item == li ? 'addClass' : 'delClass']('active'));
            this.views.forEach(view => view[view.getAttribute('id') == page_id ? 'addClass' : 'delClass']('active'));
            this.updateLocation(page_id);
        }
    }

    /**
     * Add contract button callback
     * @returns {function()}
     */
    onAddContract() {

        return () => {
            /**
             * max 5 contracts
             * @todo to settings const
             */
            if(this.getRowsCount() <= 2) {
                this.addNewContractRow('', {});
            }
        }
    }
}


/**
 * Contract settings row
 */
class ContractRow {

    constructor(wrapper, contract, settings, core) {
        this.wrapper = wrapper;
        this.contract = contract;
        this.settings = settings || {};
        this.core = core;
        this.controls = {
            contract: {select: '.contract-number'},
            password: {select: '.contract-password'},
            lbl: {select: '.lblContract'},
            accept: {select: '.btnAccept', events: {click: this.onAccept}},
            edit: {select: '.btnEdit', events: {click: this.onEdit}},
            cancel: {select: '.btnCancel', events: {click: this.onCancel}},
            remove: {select: '.btnRemove', events: {click: this.onRemove}},
            mark: {select: '.chkDefault', events: {click: this.onSetDefault}}
        };
        this.wrapper.removeAttribute('id');
        this.setMode(!contract ? 'new' : 'view');
        this.core.initControls.call(this, wrapper);
        this.setLbl(contract);
    }

    setMode(mode) {
        this.mode = mode;
        this.wrapper.delClass('new view edit').addClass(mode);

        if(mode == 'new' || mode == 'edit') {
            setTimeout(() => {
                try {
                    this.controls[mode == 'new' ? 'contract' : 'password'].getInput().focus();
                } catch(e) {}
            }, 100);
        }

        return this;
    }

    addTo(parent) {
        this.wrapper.addClass(this.mode);

        this.controls.mark.checked = this.settings.def;
        this.controls.contract.getInput().value = this.contract;

        parent.appendChild(this.wrapper);

        return this;
    }

    setLbl(contract) {
        this.controls.lbl.text(contract);
        return this;
    }

    disableInputs(mode, passwd_only) {
        let func = mode ? 'disable' : 'enable';
        if(!passwd_only) {
            this.controls.contract.getInput()[func]();
        }
        this.controls.password.getInput()[func]();

        return this;
    }

    clearPasswordInput() {
        this.controls.password.getInput().value = '';
        return this;
    }

    onAccept() {

        return (event) => {
            let error = false;
            let inputs = [
                this.controls.contract.getInput(),
                this.controls.password.getInput()
            ];
            let values = {
                def: this.controls.mark.checked
            };

            inputs.forEach(input => {
                let val = input.value.trim();
                input.delClass('error');
                if(val == '') {
                    error = true;
                    input.addClass('error');
                } else {
                    values[input.getAttribute('data-type')] = val;
                }
            });

            if(error) {
                this.wrapper.find('.error')[0].focus();
            } else {

                event.target.toggleLoading(true);
                this.disableInputs(true);

                this.core.addContract(values)
                    .then((data) => {
                        this.contract = data.contract;
                        this.settings.pwd = data.password;

                        setTimeout(() => {
                            this.clearPasswordInput()
                                .setLbl(data.contract)
                                .disableInputs(false)
                                .setMode('view');
                            event.target.toggleLoading(false);
                        }, 1000);
                    })
                    .catch((error) => {
                        setTimeout(() => {
                            console.warn(error);
                            alert('Ошибка!\r\n' + error);
                            event.target.toggleLoading(false);
                            this.disableInputs(false, this.mode == 'edit');
                        }, 1000);
                    });
            }
        }
    }

    onEdit() {
        return () => {
            this.controls.contract.getInput().disable();
            this.setMode('edit');
        }
    }

    onCancel() {
        return () => {
            this.clearPasswordInput();
            this.setMode('view');
        }
    }

    onRemove() {
        return () => {
            if(this.core.getRowsCount() == 1) {
                return;
            }
            this.core.removeContract(this.contract);
            this.wrapper.remove();
        }
    }

    onSetDefault() {
        return () => {
            this.settings.def = true;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => window.ntkBalanceOptions = new NtkBalanceOptions);

/**
 * Add custom methods
 */
(function extendHtmlElement() {
    HTMLElement.prototype.show = function (mode) {
        this.style.display = mode ? mode : 'block';
        return this;
    };
    HTMLElement.prototype.hide = function () {
        this.style.display = 'none';
        return this;
    };
    HTMLElement.prototype.text = function (text) {
        this.textContent = text;
        return this;
    };
    HTMLElement.prototype.html = function(value) {
        if(value) {
            this.innerHTML = value;
            return this;
        }
        return this.innerHTML;
    };
    HTMLElement.prototype.disable = function () {
        this.setAttribute('disabled', true);
        return this;
    };
    HTMLElement.prototype.enable = function () {
        this.removeAttribute('disabled');
        return this;
    };
    HTMLElement.prototype.hasClass = function (clss) {
        return this.classList.contains(clss);
    };
    HTMLElement.prototype.addClass = function (classes) {
        this.classList.add.apply(this.classList, classes.split(' '));
        return this;
    };
    HTMLElement.prototype.delClass = function (classes) {
        this.classList.remove.apply(this.classList, classes.split(' '));
        return this;
    };
    HTMLElement.prototype.toggleLoading = function (flag) {
        this[flag ? 'disable' : 'enable']()[flag ? 'addClass' : 'delClass']('loading disabled');
        return this;
    };
    HTMLElement.prototype.getInput = function() {
        return this.getElementsByTagName('input')[0];
    };
    HTMLElement.prototype.find = function(selector) {

        return selector[0] == '#'
            ? [this.getElementById(selector.slice(1))]
            : Array.from(this.getElementsByClassName(selector.slice(1)));
    };
})();