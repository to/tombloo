// ==UserScript==
// @name           GoogleReader + Tombloo
// @namespace      http://d.hatena.ne.jp/Constellation/
// @description    instead of LDR + Tombloo for GoogleReader
// @include        http://www.google.tld/reader/*
// @author         Constellation
// @version        0.0.1
// ==/UserScript==

GM_addStyle(<><![CDATA[
  .TMBL_posted,
  .TMBL_posted a{
    color : silver !important;
  }
  .TMBL_posted .item_body a{
    color : dimgray !important;
  }
  .TMBL_posted img{
    opacity: 0.5;
  }
]]></>);

var win = unsafeWindow;
var doc = win.document;

window.addEventListener('load', function(e){
  // for memory leak
  window.removeEventListener('load', arguments.callee, false);
  var tombloo = GM_Tombloo.Tombloo.Service;

  document.addEventListener('keyup', function(e){
    // shift-t
    if(e.keyCode == win.KeyEvent.DOM_VK_T && e.shiftKey) share();
  }, false);

  function share(){
    var item = new get_current_item();
    // for Tombloo
    var ctx = update({
      document  : doc,
      window    : win,
      selection : '' + win.getSelection(),
      target    : item.target,
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
        return item.feed.channel.link.indexOf(pattern) != -1;
    })){
      ctx.onImage = true;
      ctx.target = $x('./descendant::img[0]', item.body);
    }
    var ext = tombloo.check(ctx)[0];
    tombloo.share(ctx, ext, ext.name.match(/^Link /));
    addClass(item.parent, 'TMBL_posted');
  }

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
function addClass(e, cl){
  if(!e || !cl) return false;
  e.className
    ? (!~e.className.toLowerCase().split(/\s+/).indexOf(cl.toLowerCase())) && (e.className +=' '+cl)
    : (e.className = cl);
}
function get_current_item(){
  try {
    this.parent = $x('id("current-entry")/descendant::div[contains(concat(" ", normalize-space(@class), " "), " entry-container ")]');
    this.body = $x('id("current-entry")/descendant::div[contains(concat(" ", normalize-space(@class), " "), " item-body ")]');
    this.target = $x('id("current-entry")/descendant::a[contains(concat(" ", normalize-space(@class), " "), " entry-title-link ")]');
    this.feed = { channel:{ } };
    this.feed.channel.link = decodeURIComponent($x('id("current-entry")/descendant::a[contains(concat(" ", normalize-space(@class), " "), " entry-source-title ")]').href.replace(/^.*\/(?=http)/, ''));
  } catch (e) {
    alert(e);
  }
}
