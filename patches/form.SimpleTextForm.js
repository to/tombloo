(function(){
	var COMMANDS = {
		'm' : Tumblr,
		't' : Twitter,
		'l' : Local,
	}
	var DEFAULT = Twitter;

	registerSheet(<><![CDATA[
		@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);
		@-moz-document url(chrome://tombloo/content/quickPostForm.xul) {
			.window-regular #titlebar > hbox, 
			.window-regular #control {
				display: none;
			}
		}
	]]></>);
	
	connect(grobal, 'form-open', function(win){
		var ps = win.ps;
		if(ps.type != 'regular')
			return;
		
		addElementClass(win.getElement('window'), 'window-' + ps.type);
		
		win.FormPanel.prototype.post = function(){
			var lines = this.descriptionBox.value.split('\n');
			var command = lines.shift();
			var poster = COMMANDS[command];
			if(!poster){
				poster = DEFAULT;
				lines.unshift(command);
			}
			
			Tombloo.Service.post(update(ps, {
				description : lines.join('\n')
			}), poster);
			
			signal(this, 'post');
		};
	});
})();
