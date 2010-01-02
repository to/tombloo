if(AppInfo.OS.startsWith('WIN')){
	Tombloo.Service.actions.register({
		name : 'iTunes - EQ Toggle',
		type : 'menu',
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
}
