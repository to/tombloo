Tombloo.Service.actions.register(	{
	name : 'Download Viva-Radio',
	icon : 'http://www.viva-radio.com/favicon.ico',
	execute : function(){
		var self = this;
		
		var ZONE = 9;
		var BASE_URL = 'http://www.viva-radio.com';
		var DIR = createDir('viva-radio', getDownloadDir());
		
		getArtists().
		addCallback(selectArtist).
		addCallback(getPlaylists).
		addCallback(selectPlaylists).
		addCallback(function(playlists){
			return deferredForEach(playlists, function(playlist){
				return getTracks(playlist).addCallback(function(tracks){
					putTracks(tracks);
					
					return deferredForEach(tracks, downloadTrack);
				});
			}).addCallback(function(){
				var artist = playlists[0].artist;
				notify(self.name, 'END: ' + artist.name + ' - ' + artist.title, notify.ICON_DOWNLOAD);
			});
		}).addErrback(function(e){
			error(e);
		});
		
		
		// ----[application]----------------
		function getArtists(){
			return request(BASE_URL + '/xml/getcontribs_live.php', {
				queryString : {
					tzone : ZONE,
				},
			}).addCallback(function(res){
				var xml = convertToXML(res.responseText.replace(/&/g, '&amp;'));
				
				return map(function(c){
					return {
						id    : c.showid,
						name  : c.showdj,
						title : c.showtitle,
					}
				}, xml..contributor);
			});
		}
		
		function selectArtist(artists){
			var table = {};
			artists.forEach(function(a){
				table[a.name + ' - ' + a.title] = a;
			});
			
			var key = input({'Artists' : keys(table)});
			if(!key)
				throw 'END';
			
			return table[key];
		}
		
		function getPlaylists(artist){
			return request(BASE_URL + '/xml/getartist_live.php', {
				queryString : {
					aid   : artist.id,
					tzone : ZONE,
				},
			}).addCallback(function(res){
				var xml = convertToXML(res.responseText.replace(/&/g, '&amp;'));
				
				return map(function(pl){
					return {
						name        : pl.playlistname,
						id          : pl.playlistid,
						description : pl.playlistdescription,
						
						artist      : artist,
					}
				}, xml..playlist);
			});
		}
		
		function selectPlaylists(playlists){
			var num = 1;
			var msg = [
				'====[' + playlists[0].artist.title + ']====',
				map(function(pl){
					return (num++) + '\t' + pl.name + '\n' + pl.description;
				}, playlists).join('\n\n'),
				'Input index number(e.g. 1,2,4-6)'].join('\n\n');
			
			var targets = prompt(msg);
			if(!targets)
				throw 'END';
			
			return parseNumbers(targets).map(function(i){
				return playlists[i-1];
			});
		}
		
		function getTracks(playlist){
			return request(BASE_URL + '/xml/getshow.php', {
				queryString : {
					aid      : playlist.artist.id,
					tzone    : ZONE,
					playlist : playlist.id,
				},
			}).addCallback(function(res){
				var xml = convertToXML(res.responseText.replace(/&/g, '&amp;'));
				
				var num = 1;
				var tracks = [];
				forEach(xml..track, function(t){
					var url = encodeURI(t.location);
					if(url.match('artist/2/')) // Advertising
						return;
					
					tracks.push({
						number   : num++,
						url      : url,
						artist   : t.artist,
						name     : t.song,
						
						playlist : playlist,
					});
				});
				
				return tracks;
			});
		}
		
		function putTracks(tracks){
			var file = DIR.clone();
			var playlist = tracks[0].playlist;
			file.append(playlist.artist.id + ' - ' + playlist.id + '.txt');
			
			var title = playlist.artist.title;
			title = ((playlist.name.indexOf(title)==0)? '' : (title + ' - ')) + playlist.name;
			putContents(file, tracks.map(function(track){
				return [
					track.number, 
					track.artist, 
					track.name, title, 
					'Web', 
					BASE_URL + '/index.php?contributor=' + playlist.artist.id
				].join('\t');
			}).join('\n'));
		}
		
		function downloadTrack(track){
			var key = [track.playlist.artist.id, track.playlist.id, pad(track.number, 3, '0')].join(' - ');
			
			var file = DIR.clone();
			file.append(key + '.mp3');
			
			return download(track.url, file, true);
		}
		
		
		// ----[utility]----------------
		function parseNumbers(txt){
			return flattenArray(txt.replace(/ /g, '').split(',').map(function(i){
				if(!(/-/.test(i))) 
					return i;
				
				var nums = i.split('-').map(function(j){return 1 * j});
				return list(range(nums[0], nums[1] + 1));
			}));
		}
		
		function pad(str, len, ch){
			return (new Array(len - (''+str).length + 1).join(ch)) + str;
		}
		
		function convertToXML(text){
			return new XML(text.replace(/<\?.*\?>/gm,'').replace(/<!xml .*?>/gm, '').replace(/xmlns=".*?"/,''));
		}
	},
}, '----');
