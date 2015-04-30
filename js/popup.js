(function (root, name, object) {

    document.addEventListener('DOMContentLoaded', function () {
        root[name] = object.init();
    });

})(window, 'ntkBalancePopup', (function() {

    'use strict';

    var popup = {

        controls: {
	        fields: {
		        lblBalance: {o: 'balance'},
				lblFio: {o: 'fio'},
				lblContract: {o: 'contract'},
				lblDays2Block: {o: 'days2block'},
				lblBalance2Block: {o: 'balance2block'},
				lblErrorMessage: {o: 'error-message'}
	        },
	        buttons: {
		        btnSettings: {
			        o: 'popup-open-settings',
			        e: 'openSettings'
		        },
		        btnRefresh: {
			        o: 'popup-refresh',
			        e: 'refreshBalance'
		        }
	        }
        },

        init: function() {
			try {

				_initControls();

				var widget = this.getWidget();

				var	balanceInfo = widget.getCurrentBalanceInfo();

				if(balanceInfo.errorCode && parseInt(balanceInfo.errorCode) > 0) {
					this.controls.fields.lblErrorMessage.o.innerHTML = widget.errorMessages[balanceInfo.errorCode];

					return this;
				}

				this.controls.fields.lblBalance.o.innerHTML = parseFloat(balanceInfo.balance).toFixed(2).toString();
				this.controls.fields.lblFio.o.innerHTML = balanceInfo.name;
				this.controls.fields.lblContract.o.innerHTML = balanceInfo.contractId;
				this.controls.fields.lblDays2Block.o.innerHTML = balanceInfo.days2BlockStr;
				this.controls.fields.lblBalance2Block.o.innerHTML = balanceInfo.debetBound;

				this.hideErrors();

			} catch(e){}

            return this;
        },

		hideErrors: function () {
			this.setDisplay('div.error', 'none').setDisplay('div.success', 'block');
		},
	    
	    openSettings: function () {

		   return function() {
			   chrome.tabs.create({url: 'options.html'});
		   }
	    },
	    
	    refreshBalance: function () {
			var widget = this.getWidget();

		    return function() {
				widget.setLastUpdate(false).updateBalanceInfo();
			    window.close();
		    }
	    },

		getWidget: function () {
			var bg = chrome.extension.getBackgroundPage();

			return bg['ntkBalance'];
		},

		setDisplay: function (selector, display) {
			var elements = document.querySelectorAll(selector);

			for(var i in elements) {
				if(elements.hasOwnProperty(i) && elements[i].style) {
					elements[i].style.display = display;
				}
			}

			return this;
		}
    };

	// @todo DRY!
	function _initControls() {
		for(var i in popup.controls) {
			if(popup.controls.hasOwnProperty(i)) {
				for(var j in popup.controls[i]) {
					if(popup.controls[i].hasOwnProperty(j)) {
						popup.controls[i][j].o = document.getElementById(popup.controls[i][j].o);
						if(popup.controls[i][j].o
							&& popup.controls[i][j].e
							&& popup.hasOwnProperty(popup.controls[i][j].e)
							&& popup[popup.controls[i][j].e] instanceof Function)
						{
							popup.controls[i][j].o.addEventListener('click', popup[popup.controls[i][j].e].call(popup));
						}
					}
				}
			}
		}
	}

	return popup;
})());