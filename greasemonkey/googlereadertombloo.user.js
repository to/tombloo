// ==UserScript==
// @name           GoogleReader + Tombloo
// @namespace      http://d.hatena.ne.jp/Constellation/
// @description    instead of LDR + Tombloo for GoogleReader
// @include        http://www.google.tld/reader/*
// @author         Constellation
// @version        0.0.1
// ==/UserScript==
// porpose : use native code as mush as possible

GM_addStyle(<><![CDATA[
  .TMBL_posted,
  .TMBL_posted a{
    color : silver !important;
  }
  .TMBL_posted .item_body a{
    color : dimgray !important;
  }
  .TMBL_posted img{
    -moz-opacity: 0.5;
  }
]]></>);

var win = unsafeWindow;
var doc = win.document;

window.addEventListener('load', function(e){
  // for memory leak
  window.removeEventListener('load', arguments.callee, false);

  var id = setTimeout(function(){
    clearTimeout(id);
    if(win.o && win.cp && win.P && win.t){
      // 定義部 必要物を持ってくる
      // Native Code
      var o = win.o;//addEventListner
      var cp = win.cp;//KeyEvent Controller
      var P = win.P;//Reader Controller
      var t = win.t;//addClass

      var add = o(cp.Nr, cp);
      var tombloo = GM_Tombloo.Tombloo.Service;

      // main
      add(['shift+t'], function(e){
        // 現在のitem
        var item = P.Fa();
        if(!item) return;
        var parent = $x('descendant::div[contains(concat(" ", @class, " "), " entry-container ")]', item.I);
        var body = $x('descendant::div[contains(concat(" ", @class, " "), " item-body ")]', parent);
        // var target = item.v.Yh;
        var target = item.I;

        // for Tombloo
        var ctx = update({
          document  : doc,
          window    : win,
          selection : '' + win.getSelection(),
          target    : target,
          event     : {},
          title     : null,
          mouse     : null,
          menu      : null,
        }, win.location);

        // FFFFOUND / Flickr / iza newsphoto
        if([
          'flickr.com/',
          'http://ffffound.com',
          'http://www.bighappyfunhouse.com',
          'http://f.hatena.ne.jp',
          'http://lpcoverlover.com',
          'http://www.chicksnbreasts.com',
          '1eb46a2f1f83c340eee10cd49c144625'].some(function(pattern){
            return item.ci.dN.indexOf(pattern) != -1;
        })){
          ctx.onImage = true;
          ctx.target = $x('.//img[1]', body);
        }
        var ext = tombloo.check(ctx)[0];
        tombloo.share(ctx, ext, ext.name.match(/^Link /));
        t(parent, 'TMBL_posted');
      });
    } else {
      id = setTimeout(arguments.callee, 10);
    }
  }, 0);
}, false);

// Utility
function update(t, s){
  for(var p in s)
    t[p] = s[p];
  return t;
}

function $x(exp, context){
  context = context || document;
  return document.evaluate(exp, context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

