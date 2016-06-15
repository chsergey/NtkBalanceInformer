(function (root, name, object) {

    document.addEventListener('DOMContentLoaded', function () {
		root[name] = object.init();
    });

})(window, 'ntkBalancePopup', (function() {

    'use strict';

	/**
	 * @todo rewrite in ES6
     */
	var popup = {

		core: chrome.extension.getBackgroundPage()['ntkBalance'],
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
			initControls(this.commonControls, false, true);

			this.renderAll()
				.then(() => {				
					initControls(this.dynamicControls, '#contracts', false);
				});

            return this;
        },

		renderAll: function () {
			
			return this.core.mdl
				.getContracts()
				.then((contracts) => {
					contracts.map((contract) => {
						popup.renderContract(contract);
					});
				});
		},

		renderContract: function (contract, once) {
			var $contract_template = popup.templates.contract.node.cloneNode(true);

			$contract_template.setAttribute('id', 'contract_' + contract);
			$contract_template.setAttribute('contract', contract);

			popup.templates.contract.variables.map((variableName) => {
				$contract_template.t(
					variableName,
					popup.reformer.getVariableValue(contract, variableName)
				);
			});
			if(!once) {
				popup.commonControls.wrappers.contracts.appendChild($contract_template);
				return this;
			}

			return $contract_template;
		},

		onRefreshContract: function () {
			let wrapper = this.parentNode,
				loader = wrapper.getElementsByClassName('loader')[0],
				contract = wrapper.getAttribute('contract');

			loader.style.display = 'block';
			popup.core.updateContract(contract)
				.then(() => {
					setTimeout(() => {
						let new_wrapper = popup.renderContract(contract, true);
						wrapper.html(new_wrapper.html());
						initControls(popup.dynamicControls, '#' + wrapper.getAttribute('id'), false);
						loader.style.display = 'none';
					}, 1000);
				});
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
	function initControls(controls, context, save) {
		Object.keys(controls).map((type) => {
			Object.keys(controls[type]).map((control) => {
				let selector = controls[type][control]._selector,
					event = controls[type][control]._event,
					elements = $$(selector, context);

				if(save) {
					controls[type][control] = elements;
				}

				if(elements.length
					&& event
					&& popup.hasOwnProperty(event)
					&& popup[event] instanceof Function)
				{
					[].map.call(elements, (object) => {
						object.addEventListener('click', popup[event]);
					});
				}

				if(save && elements.length === 1) {
					controls[type][control] = elements[0];
				}

				if(save && elements.length === 0) {
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
				return  v ? v.toFixed(2).toLocaleString() : null;
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