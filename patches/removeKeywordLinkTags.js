convertToHTMLString.SAFE_ATTRIBUTES += ',class'

addAround(grobal, 'convertToHTMLString', function(proceed, args){
	var res = proceed(args);
	
	// 不要要素の除去も行うか?(safe=true)
	if(args[1])
		res = res.replace(/<a[^>]*class="o?keyword"[^>]*>(.+?)<\/a>/gmi, '$1').replace(/ ?class=".*?"/g, '');
	
	return res;
});
