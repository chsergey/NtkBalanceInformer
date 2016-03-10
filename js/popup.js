(function (root, name, object) {

    document.addEventListener('DOMContentLoaded', function () {
		root[name] = object.init();
    });

})(window, 'ntkBalancePopup', (function() {

    'use strict';

    var popup = {

		core: chrome.extension.getBackgroundPage()['w'],
		templates: {
			contract: {
				node: '#contractTemplate',
				variables: []
			}
		},
		commonControls: {
			wrappers: {
				contracts: {
					_selector: '#contracts'
				}
			},
	        buttons: {
		        btnSettings: {
					_selector: '#popup-open-settings',
			        _event: 'openSettings'
		        },
		        btnRefreshAll: {
					_selector: '#popup-refresh',
			        _event: 'refreshAll'
		        }
	        }
        },
		dynamicControls: {
			buttons: {
				btnRefreshContract: {
					_selector: '.contract-refresh',
					_event: 'onRefreshContract'
				}
			}
		},

        init: function() {

			addCustomMethods2HTMLElement();
			initBaseTemplatesObjects();
			initControls(this.commonControls);

			this.renderAll();

			initControls(this.dynamicControls, '#contracts');

            return this;
        },

		renderAll: function () {
			this.core.mdl
				.getContracts()
				.then((contracts) => {
					contracts.map((contract) => {
						popup.renderContract(contract);
					});
				});

			//this.renderContract(239864);

			return this;
		},

		renderContract: function (contract) {
			var $contract_template = popup.templates.contract.node.cloneNode(true);

			$contract_template.setAttribute('id', 'contract_' + contract + Math.random()*10000);
			$contract_template.setAttribute('contract', contract + Math.random()*10000);

			popup.templates.contract.variables.map((variableName) => {
				$contract_template.t(
					variableName,
					popup.reformer.getVariableValue(contract, variableName)
				);
			});

			popup.commonControls.wrappers.contracts.appendChild($contract_template);

			return this;
		},

		onRefreshContract: function (event) {
			console.log('refreshing', this.parentNode.getAttribute('contract'));
		},

		openSettings: function () {
			chrome.tabs.create({url: 'options.html'});
		}
    };

	function $(selector, context) {

		return document.querySelector((context ? context + ' ' : '') + selector);
	}

	function $$(selector, context) {

		return document.querySelectorAll((context ? context + ' ' : '') + selector);
	}

	function processError(contract, errorData) {
		console.error(contract, errorData);
	}

	// TODO variable events
	function initControls(controls, context) {
		Object.keys(controls).map((type) => {
			Object.keys(controls[type]).map((control) => {
				var selector = controls[type][control]._selector,
					event = controls[type][control]._event;

				controls[type][control] = $$(selector, context);

				if(controls[type][control].length
					&& event
					&& popup.hasOwnProperty(event)
					&& popup[event] instanceof Function)
				{
					[].map.call(controls[type][control], (object) => {
						object.addEventListener('click', popup[event]);
					});
				}

				if(controls[type][control].length === 1) {
					controls[type][control] = controls[type][control][0];
				}

				if(controls[type][control].length === 0) {
					controls[type][control] = null;
				}
			});
		});
	}

	function initBaseTemplatesObjects() {
		Object.keys(popup.templates).map((name) => {
			popup.templates[name].node = $(popup.templates[name].node).cloneNode(true);
			popup.templates[name].variables = popup.templates[name].node.getVariables();
		});
	}

	function addCustomMethods2HTMLElement() {
		HTMLElement.prototype.display = function(value) {
			this.style.display = value;
			return this;
		};

		HTMLElement.prototype.html = function(value) {
			if(value) {
				this.innerHTML = value;
				return this;
			}

			return this.innerHTML;
		};

		HTMLElement.prototype.t = function(variableName, value) {

			return this.html(this.innerHTML.replace('{' + variableName + '}', value));
		};

		HTMLElement.prototype.getVariables = function() {
			return this
				.innerHTML
				.match(/{(.+)}/g)
				.map((value) => {
					return value.replace(/{|}/g, '');
				});
		};

		return popup;
	}

	popup.reformer = new function Reformer() {
		/**
		 *  Variable name : formatter function
		 */
		this.formatters = {
			'dynamic.balance': (v) => {
				return v.toLocaleString();
			},
			'updated': (v) => {
				return v.toLocaleString().replace(', ', ', в ');
			}
		};

		this.formatVariableValue = function (name, value) {
			if( value !== null && value !== undefined
				&& this.formatters.hasOwnProperty(name)
				&& this.formatters[name] instanceof Function)
			{
				return this.formatters[name](value);
			}

			return value;
		};

		this.getVariableValue = function (contract, variableName) {

			return this.formatVariableValue(
				variableName,
				popup.core.mdl.getContractDataEx(contract, variableName)
			);
		};
	};

	return popup;

})());