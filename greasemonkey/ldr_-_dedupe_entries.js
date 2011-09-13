// ==UserScript==
// @name         LDR - Dedupe Entries
// @namespace    http://userscripts.org/scripts/show/12248
// @include      http://reader.livedoor.com/reader/*
// ==/UserScript==

// 2011/09/14

GM_addStyle(<><![CDATA[
	.LDE_displayed,
	.LDE_displayed a{
		color : silver !important;
	}
	.LDE_displayed .item_body a{
		color : dimgray !important;
	}
	.LDE_displayed img{
		opacity: 0.3;
	}
]]></>);

// If you want to hide duplicate entry, add url pattern to here.
var filter_feeds = [];

// -- [Application] ----------------------------------------------------------------------
init();

var cache = Cache.getInstance();
cache.keepAlive = 10; // How many days keep old caches

with(unsafeWindow){
	ItemFormatter.TMPL.tmpl = ItemFormatter.TMPL.tmpl.replace(/(\[\[pinned\]\])/, '$1 [[LDE_displayed]]')
	
	addBefore(unsafeWindow, 'touch_all', function(id){
		if(!get_unread.cache.has(id))
			return;
		
		var size = cache.size;
		
		var items = get_unread.cache.get(id).items;
		foreach(items, function(item){
			foreach(getLinks(item), function(link){
				cache.put(link);
			});
		});
	});
	
	register_hook('BEFORE_PRINTFEED', function(feed) {
		if(! subs_item(feed.subscribe_id).unread_count)
			return;
		
		var items = feed.items;
		if(isFilterFeed(feed.channel.link)){
			var limit = Math.floor(Date.now()/1000) - (2 * 24 * 60 * 60);
			for (var i=0,len=items.length; i<len; i++){
				// if(items[i].modified_on < limit || isDisplayed(items[i])){
				if(isDisplayed(items[i])){
					items.splice(i--, 1);
					len--;
				}
			}
		} else {
			foreach(items, function(item){
				if(isDisplayed(item))
					item.LDE_displayed = 'LDE_displayed';
			});
		}
	});
}

function isFilterFeed(link){
	for(var i in filter_feeds)
		if(filter_feeds[i].test(link))
			return true;
	return false;
}

function getLinks(item){
	var res = [item.link.replace(/[\?&;](fr|from|track|ref|FM|c)=.*?([&;]|$)/, '')];
	return item.link.match('.tumblr.com/post/') ?
		res.concat(extractImages(item.body || '')) :
		res;
}

function isDisplayed(item){
	if(!item.link)
		return false;
	
	return getLinks(item).some(function(link){
		return cache.cached(link) || isVisited(link);
	});
}

function extractImages(html){
	var imgs = [];
	html.replace(/img src="(.+?)"/ig, function(){
		imgs.push(RegExp.$1);
	})
	return imgs;
}

window.addEventListener('unload', function() {
	cache.store();
}, true);


// -- [Utility] ----------------------------------------------------------------------
function init(){
	Cache = function(){
		this.load();
	}
	
	Cache.now = function(){
		return Math.floor((new Date()).getTime() / 1000 / 60 / 60 / 24 - 13179); // 2006/1/1
	}
	
	Cache.getInstance = function(){
		if(!Cache.instance) Cache.instance = new Cache();
		return Cache.instance;
	}
	
	Cache.prototype = {
		keepAlive : 10,
		
		get size(){
			var count = 0;
			for(var i in this.cache)count++;
			return count;
		},
		status : function(){
			var stat={};
			for(var i in this.cache){
				var day = this.cache[i];
				stat[day] || (stat[day] = 0);
				stat[day]++
			}
			
			var output = '';
			for(var i in stat)
				output += i + ' : ' + stat[i] + '\n';
			
			alert(
				'size : ' + this.size + '\n' + 
				'keep alive : ' + this.keepAlive + '\n' + 
				'last expire : ' + GM_getValue('Cache.lastExpire') + '\n' + 
				'today : ' + Cache.now() + '\n' + 
				output);
		},
		load : function(){
			this.cache = storage('LDE_cache') || {};
		},
		store : function(keep){
			if(!keep)
				this.expire();
			
			storage('LDE_cache', this.cache);
		},
		cached : function(item){
			return !! this.cache[crc32(item)]
		},
		put : function(item){
			var items = [].concat(item);
			var now = Cache.now();
			for(var i=0,len=items.length ; i<len ; i++){
				this.cache[crc32(items[i])] = now;
			}
		},
		clear : function(){
			this.cache = {};
			this.store();
		},
		expire : function(){
			var now = Cache.now();
			var lastExpire = GM_getValue('Cache.lastExpire') || 0;
			
			if(lastExpire < now){
				var expire = now - this.keepAlive;
				var cache = this.cache;
				
				for (var i in cache)
					if(cache[i] <= expire)
						delete cache[i];
				GM_setValue('Cache.lastExpire', now);
			}
		}
	}
}

function storage(key, value){
	var map = globalStorage[document.domain];
	return (storage = function(key, value){
		if(arguments.length == 1)
			return eval('('+map[key]+')');
		
		if(value!=null){
			map[key] = uneval(value);
			return value;
		}
		
		delete map[key];
	}).apply(null, arguments);
}

function isVisited(url){
	return typeof(GM_Tombloo)=='undefined'? false : GM_Tombloo.FirefoxBookmark.isVisited(url);
}

function addBefore(target, name, before) {
	var original = target[name];
	target[name] = function() {
		before.apply(this, arguments);
		return original.apply(this, arguments);
	}
}

// copied from http://xpoint.ru/forums/programming/javascript/misc/thread/33517.xhtml
function crc32(data) {
	var ch = [
		1026, 1027, 8218, 1107, 8222, 8230, 8224, 8225, 8364, 8240, 1033, 8249, 1034, 1036, 1035, 1039, 
		1106, 8216, 8217, 8220, 8221, 8226, 8211, 8212,    0, 8482, 1113, 8250, 1114, 1116, 1115, 1119, 
		 160, 1038, 1118, 1032,  164, 1168,  166,  167, 1025,  169, 1028,  171,  172,  173,  174, 1031, 
		 176,  177, 1030, 1110, 1169,  181,  182,  183, 1105, 8470, 1108,  187, 1112, 1029, 1109, 1111, 
		1040, 1041, 1042, 1043, 1044, 1045, 1046, 1047, 1048, 1049, 1050, 1051, 1052, 1053, 1054, 1055, 
		1056, 1057, 1058, 1059, 1060, 1061, 1062, 1063, 1064, 1065, 1066, 1067, 1068, 1069, 1070, 1071, 
		1072, 1073, 1074, 1075, 1076, 1077, 1078, 1079, 1080, 1081, 1082, 1083, 1084, 1085, 1086, 1087, 
		1088, 1089, 1090, 1091, 1092, 1093, 1094, 1095, 1096, 1097, 1098, 1099, 1100, 1101, 1102, 1103
	];
	var hash = {};
	for (var i=0; i<ch.length; ++i) hash[ch[i]] = i + 128;
	
	var crc32tab = [
		0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419, 0x706af48f, 0xe963a535, 0x9e6495a3, 
		0x0edb8832, 0x79dcb8a4, 0xe0d5e91e, 0x97d2d988, 0x09b64c2b, 0x7eb17cbd, 0xe7b82d07, 0x90bf1d91, 
		0x1db71064, 0x6ab020f2, 0xf3b97148, 0x84be41de, 0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7, 
		0x136c9856, 0x646ba8c0, 0xfd62f97a, 0x8a65c9ec, 0x14015c4f, 0x63066cd9, 0xfa0f3d63, 0x8d080df5, 
		0x3b6e20c8, 0x4c69105e, 0xd56041e4, 0xa2677172, 0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b, 
		0x35b5a8fa, 0x42b2986c, 0xdbbbc9d6, 0xacbcf940, 0x32d86ce3, 0x45df5c75, 0xdcd60dcf, 0xabd13d59, 
		0x26d930ac, 0x51de003a, 0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423, 0xcfba9599, 0xb8bda50f, 
		0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924, 0x2f6f7c87, 0x58684c11, 0xc1611dab, 0xb6662d3d, 
		
		0x76dc4190, 0x01db7106, 0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f, 0x9fbfe4a5, 0xe8b8d433, 
		0x7807c9a2, 0x0f00f934, 0x9609a88e, 0xe10e9818, 0x7f6a0dbb, 0x086d3d2d, 0x91646c97, 0xe6635c01, 
		0x6b6b51f4, 0x1c6c6162, 0x856530d8, 0xf262004e, 0x6c0695ed, 0x1b01a57b, 0x8208f4c1, 0xf50fc457, 
		0x65b0d9c6, 0x12b7e950, 0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3, 0xfbd44c65, 
		0x4db26158, 0x3ab551ce, 0xa3bc0074, 0xd4bb30e2, 0x4adfa541, 0x3dd895d7, 0xa4d1c46d, 0xd3d6f4fb, 
		0x4369e96a, 0x346ed9fc, 0xad678846, 0xda60b8d0, 0x44042d73, 0x33031de5, 0xaa0a4c5f, 0xdd0d7cc9, 
		0x5005713c, 0x270241aa, 0xbe0b1010, 0xc90c2086, 0x5768b525, 0x206f85b3, 0xb966d409, 0xce61e49f, 
		0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17, 0x2eb40d81, 0xb7bd5c3b, 0xc0ba6cad, 
		
		0xedb88320, 0x9abfb3b6, 0x03b6e20c, 0x74b1d29a, 0xead54739, 0x9dd277af, 0x04db2615, 0x73dc1683, 
		0xe3630b12, 0x94643b84, 0x0d6d6a3e, 0x7a6a5aa8, 0xe40ecf0b, 0x9309ff9d, 0x0a00ae27, 0x7d079eb1, 
		0xf00f9344, 0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb, 0x196c3671, 0x6e6b06e7, 
		0xfed41b76, 0x89d32be0, 0x10da7a5a, 0x67dd4acc, 0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5, 
		0xd6d6a3e8, 0xa1d1937e, 0x38d8c2c4, 0x4fdff252, 0xd1bb67f1, 0xa6bc5767, 0x3fb506dd, 0x48b2364b, 
		0xd80d2bda, 0xaf0a1b4c, 0x36034af6, 0x41047a60, 0xdf60efc3, 0xa867df55, 0x316e8eef, 0x4669be79, 
		0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236, 0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f, 
		0xc5ba3bbe, 0xb2bd0b28, 0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7, 0xb5d0cf31, 0x2cd99e8b, 0x5bdeae1d, 
		
		0x9b64c2b0, 0xec63f226, 0x756aa39c, 0x026d930a, 0x9c0906a9, 0xeb0e363f, 0x72076785, 0x05005713, 
		0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0x0cb61b38, 0x92d28e9b, 0xe5d5be0d, 0x7cdcefb7, 0x0bdbdf21, 
		0x86d3d2d4, 0xf1d4e242, 0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1, 0x18b74777, 
		0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c, 0x8f659eff, 0xf862ae69, 0x616bffd3, 0x166ccf45, 
		0xa00ae278, 0xd70dd2ee, 0x4e048354, 0x3903b3c2, 0xa7672661, 0xd06016f7, 0x4969474d, 0x3e6e77db, 
		0xaed16a4a, 0xd9d65adc, 0x40df0b66, 0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9, 
		0xbdbdf21c, 0xcabac28a, 0x53b39330, 0x24b4a3a6, 0xbad03605, 0xcdd70693, 0x54de5729, 0x23d967bf, 
		0xb3667a2e, 0xc4614ab8, 0x5d681b02, 0x2a6f2b94, 0xb40bbe37, 0xc30c8ea1, 0x5a05df1b, 0x2d02ef8d
	];
	
	return (crc32 = function(data){
		var crc = 0xffffffff;
		for (var i=0; i<data.length; ++i) {
			var cCode = data.charCodeAt(i);
			if (cCode >= 128) cCode = hash[cCode];
			crc = (crc >>> 8) ^ crc32tab[(crc ^ cCode) & 0xff];
		}
		return (crc>>>0).toString(16);
	})(data);
}
