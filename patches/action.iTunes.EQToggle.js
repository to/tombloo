if(AppInfo.OS.startsWith('WIN')){
	Tombloo.Service.actions.register({
		name : 'iTunes - EQ Toggle',
		type : 'menu',
		check : function(){
			var enabled = executeWSH(function(msg){
				return WScript.CreateObject('iTunes.Application').EQEnabled;
			});
			enabled = !!Number(enabled);
			
			this.name = 'iTunes - EQ ' + ((enabled)? 'Off' : 'On');
			
			return true;
		},
		execute : function(){
			executeWSH(function(){
				var iTunes = WScript.CreateObject('iTunes.Application');
				iTunes.EQEnabled = !iTunes.EQEnabled;
			});
		},
	}, '----');
}
