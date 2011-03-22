update(Date, {
	TIME_SECOND : 1000,
	TIME_MINUTE : 1000 * 60,
	TIME_HOUR   : 1000 * 60 * 60,
	TIME_DAY    : 1000 * 60 * 60 * 24,
})

if(typeof(update)=='undefined'){
	function update(t, s){
		for(var p in s)
			t[p] = s[p];
		return t;
	}
}

Math.hypot = function(x, y){
	return Math.sqrt(x*x + y*y);
}

update(Number.prototype, {
	pad : function(len, ch){
		return ('' + this).pad(len, ch || '0');
	},
	toHexString : function(){
		return ('0' + this.toString(16)).slice(-2);
	},
});

update(String.prototype, {
	contains : function(str){
		return this.indexOf(str) != -1;
	},
	
	startsWith : function(s){
		return this.indexOf(s) == 0;
	},
	
	pad :function(len, ch){
		len = len-this.length;
		if(len<=0) return this;
		return (ch || ' ').repeat(len) + this;
	},
	
	indent : function(num, c){
		c = c || ' ';
		return this.replace(/^/mg, c.repeat(num))
	},
	
	link: function(href){
		return '<a href="' + href + '">' + this + '</a>';
	},
	
	trim : function(){
		return this.replace(/^\s+|\s+$/g, '');
	},
	
	wrap : function(c){
		return c+this+c;
	},
	
	repeat : function(n){
		return new Array(n+1).join(this);
	},
	
	extract : function(re, group){
		group = group==null? 1 : group;
		var res = this.match(re);
		return res ? res[group] : '';
	},
	
	decapitalize : function(){
		return this.substr(0, 1).toLowerCase() + this.substr(1);
	},
	
	capitalize : function(){
		return this.substr(0, 1).toUpperCase() + this.substr(1);
	},
	
	toByteArray : function(charset){
		return new UnicodeConverter(charset).convertToByteArray(this, {});
	},
	
	md5 : function(charset){
		var crypto = new CryptoHash(CryptoHash.MD5);
		var data = this.toByteArray(charset);
		crypto.update(data, data.length);
		
		return crypto.finish(false).split('').map(function(char){
			return char.charCodeAt().toHexString();
		}).join('');
	},
	
	sha1 : function(charset){
		var crypto = new CryptoHash(CryptoHash.SHA1);
		var data = this.toByteArray(charset);
		crypto.update(data, data.length);
		
		return crypto.finish(true);
	},
	
	extract : function(re, group){
		group = group==null? 1 : group;
		var res = this.match(re);
		return res ? res[group] : '';
	},
	
	convertToUnicode : function(charset){
		return new UnicodeConverter(charset).ConvertToUnicode(this);
	},
	
	convertFromUnicode : function(charset){
		return new UnicodeConverter(charset).ConvertFromUnicode(this);
	},
	
	trimTag : function(){
		return this.replace(/<!--[\s\S]+?-->/gm, '').replace(/<[\s\S]+?>/gm, '');
	},
	
	includesFullwidth : function(){
		return (/[^ -~｡-ﾟ]/).test(this);
	},
	
	// http://code.google.com/p/kanaxs/
	toHiragana : function(){
		var c, i = this.length, a = [];
		
		while(i--){
			c = this.charCodeAt(i);
			a[i] = (0x30A1 <= c && c <= 0x30F6) ? c - 0x0060 : c;
		};
		
		return String.fromCharCode.apply(null, a);
	},
	
	toKatakana : function(){
		var c, i = this.length, a = [];
		
		while(i--){
			c = this.charCodeAt(i);
			a[i] = (0x3041 <= c && c <= 0x3096) ? c + 0x0060 : c;
		};
		
		return String.fromCharCode.apply(null, a);
	},
	
	toRoma : function(){
		var res = '';
		var s = this.toKatakana();
		for(var i = 0, kana, table = String.katakana ; i < s.length ; i += kana.length){
			kana = s.substr(i, 2);
			roma = table[kana];
			
			if(!roma){
				kana = s.substr(i, 1);
				roma = table[kana];
			}
			
			if(!roma){
				roma = kana;
			}
			
			res += roma;
		}
		res = res.replace(/ltu(.)/g, '$1$1');
		
		return res;
	},
});
