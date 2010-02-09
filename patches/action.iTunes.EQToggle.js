Tombloo.Service.actions.register({
	name : 'iTunes - EQ Toggle',
	type : 'menu',
	icon : 'chrome://tombloo/skin/iTunes.ico',
	check : function(){
		var self = this;
		runWSH(function(){
			return WScript.CreateObject('iTunes.Application').EQEnabled;
		}, null, true).addCallback(function(enabled){
			enabled = !!Number(enabled);
			
			self.name = 'iTunes - EQ ' + ((enabled)? 'Off' : 'On');
		});
		
		return true;
	},
	execute : function(){
		runWSH(function(){
			var iTunes = WScript.CreateObject('iTunes.Application');
			iTunes.EQEnabled = !iTunes.EQEnabled;
		});
	},
}, '----');
