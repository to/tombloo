Tombloo.Service.actions.register({
	name : 'Download Fishki',
	type : 'context',
	check : function(ctx){
		return ctx.href.match('fishki.net/');
	},
	execute : function(ctx){
		$x('//img[starts-with(@src, "http://de.fishki.net/picsw/")]', ctx.document, true).forEach(function(img){
			if(/tn.jpg/.test(img.src))
				return;
			
			var tokens = img.src.split('/');
			tokens[4] = tokens[4].replace(/(.{2})(.{4})/, '$2$1');
			
			var file = getDownloadDir();
			file.append('fishki');
			createDir(file);
			
			file.append([tokens[4], tokens[5], tokens[7], tokens.pop()].join('-'));
			download(img.src, file);
		});
	},
}, '----');
