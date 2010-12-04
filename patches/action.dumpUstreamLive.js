Tombloo.Service.actions.register({
	name : 'Dump Ustream Live',
	type : 'context',
	icon : 'http://cdn2.ustream.tv/static/images/favicon-blue.ico',
	check : function(ctx){
		return /ustream.tv\/channel\//.test(ctx.href);
	},
	execute : function(ctx){
		var rtmpDump = this.getRtmpDump();
		if(!rtmpDump)
			return;
		
		var dest = this.getDestinationFile(ctx);
		var cid = ctx.document.documentElement.innerHTML.extract(/cid=(.+?)&/);
		var process = new Process(rtmpDump);
		var args = [
		 '-q',
		 '-v',
		 '-r', this.getStreamAddress(cid),
		 '-a', 'ustreamVideo/' + cid,
		 '-f', 'LNX 10,0,45,2',
		 '-y', 'streams/live',
		 '-o', dest.path,
		];
		
		process.run(false, args, args.length);
	},
	getDestinationFile : function(ctx){
		var now = new Date();
		var title = ctx.document.querySelector('.channelTitle').textContent;
		var dest = getDownloadDir();
		dest.append('ustream');
		createDir(dest);
		
		dest.append(validateFileName(
			title + ' [' + 
			now.getFullYear() + '-' + 
			(now.getMonth()+1).pad(2) + '-' + 
			now.getDate().pad(2) + ' ' + 
			now.getHours().pad(2) + '_' + now.getMinutes().pad(2) + 
			'].flv'));
		
		return dest;
	},
	getRtmpDump : function(){
		var path = getPref('action.rtmpdump') || 'c:\\Program Files\\rtmpdump\\rtmpdump.exe';
		var file;
		while(true){
			if(path){
				file = new LocalFile(path);
				if(file.exists()){
					setPref('action.rtmpdump', path);
					break;
				}
				file = null;
			}
			
			path = prompt('rtmpdump location:', path);
			if(!path)
				break;
		}
		
		return file;
	},
	getStreamAddress : function(cid){
		var req = new XMLHttpRequest();
		req.open('GET', 'http://cdngw.ustream.tv/Viewer/getStream/1/' + cid + '.amf', false);
		req.overrideMimeType('text/plain; charset=x-user-defined');
		req.send(null);
		return req.responseText.extract(/(rtmp.+)\u00/);
	},
}, '----');
