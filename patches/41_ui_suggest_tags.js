/* Tombloo Hacks
 * Suggest Tags
 *
 * 使いたい人が使えばいい機能だし著しくかっこ悪くなるので,
 * 本家にcommitするのではなくpatchという形で
 */

addAround(QuickPostForm.prototype, 'createForm', function(proceed, args, target, methodName){
  function getSuggestingTags (){
    return doXHR(HatenaBookmark.POST_URL,{
      redirectionLimit: 0,
      sendContent: {
        mode : 'confirm',
        url  : target.params.itemUrl,
      }
    }).addCallback(function(res){
      if(!res.responseText.match(/var otherTags ?=(.*);/))
        throw new Error('AUTH_FAILD');
      return reduce(function(memo, tag){
        memo.push({
          name      : tag,
          frequency : -1,
        });
        return memo;
      }, Components.utils.evalInSandbox(RegExp.$1, Components.utils.Sandbox('http://b.hatena.ne.jp/')), []);
    });
  }

  var result = proceed(args);
  var tagsTextbox = $x('.//xul:textbox[@name="tags"]', result.firstChild);
  if(!tagsTextbox) return result;
  var rows = $x('.//xul:rows', result.firstChild);
  var row = currentDocument().createElementNS(XUL_NS, 'row');
  var label = currentDocument().createElementNS(XUL_NS, 'label');
  var loading = currentDocument().createElementNS(XUL_NS, 'label');
  loading.setAttribute('value', 'Loading...');
  var box = currentDocument().createElementNS(XUL_NS, 'description');
  label.setAttribute('value', 'Suggestion');
  box.setAttribute('name', 'Suggestion');
  box.setAttribute('style',
      <>
      line-height: 200%;
      overflow-x: hidden;
      min-height:60px;
      </>);
  box.flex = '1';

  box.appendChild(loading);
  row.appendChild(label);
  row.appendChild(box);
  rows.appendChild(row);

  getSuggestingTags().addCallback(function(info){
    var tb = tagsTextbox.textbox,
        can_memo = {},
        df = currentDocument().createDocumentFragment(),
        memo = {};
    QuickPostForm.candidates.forEach(function(o){ can_memo[o.value.toLowerCase()] = o.value});
    if(!info.length) return loading.setAttribute('value', 'no tags');
    info.forEach(function(data){
      var t = currentDocument().createElementNS(XUL_NS, 'label');
      memo[data.name] = t,
      t.selected = false;
      t.setAttribute('value', data.name);
      t.setAttribute('style', 'cursor:pointer;');
      var name = can_memo[data.name.toLowerCase()];
      if(name){
        t.setAttribute('value', name);
        t.style.border = '1px dotted black';
      }
      t.addEventListener('click', tagListener, false);
      df.appendChild(t);
    });
    function select(tag){
      tag.style.backgroundColor = 'darkgray';
      tag.selected = true;
    }
    function disselect(tag){
      tag.style.backgroundColor = '';
      tag.selected = false;
    }
    function addWord(word){
      tb.injectCandidate(word, true);
    }
    function removeWord(word){
      var used = tb.value.substring(0, tb.getCurrentWord().start).split(tb.delimiter);
      var index = used.indexOf(word);
      if(index != -1)
        used.splice(index, 1);
      tb.value = used.join(tb.delimiter);
    }
    function resetTags(){
      for(var i in memo)
        disselect(memo[i]);
    }
    function tagListener(e){
      if(this.selected){
        disselect(this);
        removeWord(this.value);
      } else {
        select(this);
        addWord(this.value);
      }
    }
    function textListener(e){
      resetTags();
      var used = tb.value.substring(0, tb.getCurrentWord().start).split(tb.delimiter);
      used.forEach(function(word){
        if(word.toLowerCase() in memo) select(memo[word.toLowerCase()]);
      });
    }
    tb.addEventListener('input', textListener, false);
    box.removeChild(loading);
    box.appendChild(df);
    addBefore(target.notification, 'close', function(){
      tb.removeEventListener('input', textListener, false);
      for(var ts in memo)
        memo[ts].removeEventListener('click', tagListener, false);
    });

  })
  .addErrback(function(e){
    log(e);
    loading.setAttribute('value', 'This page has been already bookmarked.');
  });

  return result;
});
