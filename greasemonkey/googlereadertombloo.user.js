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
    var item = get_current_item();
    if(!item) return;
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
  var item = {
    parent: null,
    body: null,
    target: null,
    feed: {
      channel: {
        link: null
      }
    }
  }, link;
  try {
    item.parent = $x('id("current-entry")/descendant::div[contains(concat(" ", normalize-space(@class), " "), " entry-container ")]') || null;
    item.body = $x('id("current-entry")/descendant::div[contains(concat(" ", normalize-space(@class), " "), " item-body ")]') || null;
    item.target = $x('id("current-entry")/descendant::a[contains(concat(" ", normalize-space(@class), " "), " entry-title-link ")]') || null;
    link = $x('id("current-entry")/descendant::a[contains(concat(" ", normalize-space(@class), " "), " entry-source-title ")]') || null;
    if(link &&  link.href) item.feed.channel.link = decodeURIComponent(link.href.replace(/^.*\/(?=http)/, ''));
    if(!item.parent || !item.body || !item.target || !item.feed.channel.link){
      throw 'get_current_item error';
    } else {
      return item;
    }
  } catch (e) {
    return null;
  }
}
