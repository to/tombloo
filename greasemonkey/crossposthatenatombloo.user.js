// ==UserScript==
// @name           Cross Post Hatena / Tombloo
// @namespace      http://userscripts.org/users/7010
// @include        http://b.hatena.ne.jp/add?mode=confirm*
// ==/UserScript==

GM_addStyle(<><![CDATA[
	#xpost img{
		cursor : pointer;
		-moz-opacity: 0.1;
	}
	.XPOST_enable{
		-moz-opacity: 1 !important;
	}
]]></>);

$x('//div[@class="info"]/table/tbody')[0].appendChild(dom(<tr id="xpost">
	<td class="label" >ポスト先</td>
	<td>
		<img name="Delicious" src="data:image/gif,GIF89a%10%00%10%00%91%00%00%00%00%00%FF%FF%FF%DD%DD%DD%00%00%FF!%F9%04%00%00%00%00%00%2C%00%00%00%00%10%00%10%00%00%02*%8Co%A3%AB%88%CC%DC%81K%26%3Al%C0%D9r%FDy%18%40%96%A4%80%A6%A8i%AA*%5B%BA)%7C%CA%02%0D%D87%AD%E3%3Do%2B%00%00%3B" />
		<img name="GoogleBookmarks" src="data:image/gif,GIF89a%10%00%10%00%A2%00%00%00%00%8A%FF%FF%FF%002%AC%002%FA2j%FA2%AC2%AC%AC%FA%FA2%00!%F9%04%00%00%00%00%00%2C%00%00%00%00%10%00%10%00%00%03E8%B5%DC%3E!%CA9%0F%94%86%88!%88%91%96D%5C%92%00Da%40%10%14%15%1AB%EBB%B0%5CA%9D%0DB%9A%8E%F21_j%F0%99h%88%81%E1%A9%05%F8%A4%02%A6b%E9g%04l%06XV%92%E4%DB%3A%BE%8CC%02%00%3B" />
		<img name="Tumblr" src="data:image/gif,GIF89a%10%00%10%00%91%00%00%13%14%17Y%5C_-08%F0%F0%F0!%F9%04%00%00%00%00%00%2C%00%00%00%00%10%00%10%00%00%02%40%94%8F%08%20%E1%0F!%0B)%AD0M%7C7%8B%01%86%A0%00%60M%03%02c0%60%26%C5.c%E9z%8B%3A%90%F7%7B%C8%F9%5D%F2%E8f%3B%9BO%D79%DDD%C8%17%10%D2%9C%00%A7E%DAfC%CD%02%0B%00%3B" />
		<img name="Twitter" src="data:image/gif,GIF89a%10%00%10%00%91%03%00%AF%FF%FF%00%FF%FF%FF%FF%FF%FF%FF%FF!%F9%04%01%00%00%03%00%2C%00%00%00%00%10%00%10%00%00%02%40%DC%84h%CB%07%FFDc%08%AAi%04%8C%20%01%AAm%DBe%3C%01p%A6A%20-B%8A%C6%EB%97%A1%EB%8D%B7%C7%3B'%9A%EE%B8u%7C%0D%84%D0G%0A%0AEE%9C%F3%04z%0A%8B%1A)%B0%14%12%B5%0A%00%3B" />
	</td>
</tr>));


var imgs = $x('id("xpost")//img');
imgs.forEach(function(i){
	i.addEventListener('click', function(){
		i.className = i.className? '' : 'XPOST_enable';
	}, false);
});


var pref = load('pref');
for(var p in pref){
	if(pref[p])
		$x('id("xpost")//img[@name="'+p+'"]')[0].className = 'XPOST_enable';
}


$x('id("edit_form")')[0].addEventListener('submit', function(e){
	var fs = getFields(e.target);
	var ps  = {
		type   : 'link',
		title  : fs.title,
		source : fs.url,
		body   : fs.comment.replace(/^(\[.+?\])+/, ''),
		tags   : (fs.comment.match(/^(\[.+?\])+/, '') || [''])[0].replace(/(^\[|\]$)/g, '').split(']['),
	};
	
	imgs.forEach(function(img, i){
		if(img.className)
			GM_Tombloo[img.name].post(ps);
		
		pref[img.name] = !!img.className;
	});
	save('pref', pref);
}, false);


// -- [Utility] ------------------------------------------------------
function $x(exp, ctx){
	ctx = ctx || document;
	var res = document.evaluate(exp, ctx, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
	for(var i, nodes = [] ; i=res.iterateNext() ; nodes.push(i));
	return nodes;
}

function getFields(ctx){
	var fields = {};
	$x('.//*[name()="INPUT" or name()="TEXTAREA"]', ctx).forEach(function(elm){
		fields[elm.name] = elm.value;
	});
	return fields;
}

function dom(xml){
	var elm = document.createElement('table');
	elm.innerHTML = xml.toXMLString();
	return elm.firstChild.tagName.toLowerCase()=='tbody'? elm.firstChild.firstChild : elm.firstChild;
}

function load(key){
	return eval(decodeURIComponent(GM_getValue(key))) || {};
}

function save(key, value){
	GM_setValue(key, encodeURIComponent(value.toSource()))
}
