(function (root, name, object) {

    document.addEventListener('DOMContentLoaded', function () {
        root[name] = object.init();
    });

})(window, 'ntkBalancePopup', (function() {

    'use strict';

    var popup = {
        controls: {
	        fields: {
		        lblBalance: {
			        o: 'popup-balance'
		        }
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
	        initControls();

	        var balanceString = chrome.extension.getBackgroundPage().ntkBalance.getCurrentBalanceString().replace('\r\n','<br/>');
	        this.controls.fields.lblBalance.o.innerHTML = balanceString;
            return this;
        },
	    
	    openSettings: function () {
		   return function() {
			   chrome.runtime.openOptionsPage();
		   }
	    },
	    
	    refreshBalance: function () {
		    var self = this;
		    return function () {
			    var ntkBalance = chrome.extension.getBackgroundPage().ntkBalance;
			    if(ntkBalance) {
				    ntkBalance.setLastUpdate(false).updateBalanceInfo();
			    }

			    window.close();
		    }
	    }
    };


	function initControls() {
		for(var i in popup.controls) {
			if(popup.controls.hasOwnProperty(i)) {
				for(var j in popup.controls[i]) {
					if(popup.controls[i].hasOwnProperty(j)) {
						popup.controls[i][j].o = document.getElementById(popup.controls[i][j].o);
						if(popup.controls[i][j].e && popup.hasOwnProperty(popup.controls[i][j].e) && popup[popup.controls[i][j].e] instanceof Function) {
							popup.controls[i][j].o.addEventListener('click', popup[popup.controls[i][j].e].call(popup));
						}
					}
				}
			}
		}
	}


	return popup;

})());