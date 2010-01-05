Tombloo.Service.actions.register([
	{
		type : 'menu',
		name : 'Export Tombloo Config',
		
		execute : function(){
			var picker = new FilePicker(window, this.name, FilePicker.modeSave);
			picker.defaultString = 'tombloo.config';
			
			if(picker.show() != FilePicker.returnCancel){
				var prefs = {};
				PrefService.getChildList('extensions.tombloo.', {}).forEach(function(key){
					prefs[key] = getPrefValue(key);
				});
				putContents(picker.file, uneval(prefs));
				
				notify(this.name, 'Exported', notify.ICON_INFO);
			}
		}
	},
	{
		type    : 'menu',
		name    : 'Import Tombloo Config',
		
		execute : function(){
			var picker = new FilePicker(window, this.name, FilePicker.modeOpen);
			picker.defaultString = 'tombloo.config';
			
			if(picker.show() != FilePicker.returnCancel){
				var prefs = eval(getContents(picker.file, 'UTF-8'));
				items(prefs).forEach(function([key, value]){
					setPrefValue(key, value);
				});
				
				notify(this.name, 'Imported', notify.ICON_INFO);
			}
		}
	}
]);
