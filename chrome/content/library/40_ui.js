function QueryForm(elmForm, params){
	// ユーザー一選択ボックスの作成
	var elmUser = $x('//select[@name="user"]', elmForm);
	appendChildNodes(elmUser,
		Tombloo.Photo.findUsers().map(function(user){
			return OPTION({value:user}, user);
		}))
	
	populateForm(elmForm, params);
	
	// イベント処理
	var submit = bind('submit', elmForm);
	$x('//input[@name="random"]', elmForm).onchange = submit;
	elmUser.onchange = submit;
	
	// ページバーの作成
	var entries = params.random? 0 : Tombloo.Photo.countByUser(params);
	if(entries){
		var pagebar = Pagebar({
			current : params.offset/PER+1,
			entries : entries,
			per : PER,
			max : 10,
		});
		insertSiblingNodesBefore(elmForm.childNodes[0], pagebar);
		
		var elmOffset = $x('//input[@name="offset"]', elmForm);
		elmOffset.value=0;
		connect(pagebar, 'onChange', function(e){
			elmOffset.value = (e.event()-1) * PER;
			submit();
		})
	}
}

// ---- [Widget] -------------------------------------------
function SlidePanel(elmPanel){
	var focusing = false;
	var hovering = false;
	var panel = {
		show : function(){
			elmPanel.style.display = '';
			removeElementClass(elmPanel, 'hidden');
		},
		hide : function(){
			elmPanel.style.display = 'none';
		},
		drawBack : function(){
			addElementClass(elmPanel, 'hidden');
		},
	};
	elmPanel.addEventListener('focus', function(e){
		focusing = true;
		panel.show();
	}, true);
	elmPanel.addEventListener('blur', function(e){
		focusing = false;
		hovering || panel.drawBack();
	}, true);
	elmPanel.addEventListener('mouseover', function(e){
		hovering = true;
		panel.show();
	}, true);
	elmPanel.addEventListener('mouseout', function(e){
		hovering = false;
		focusing || panel.drawBack();
	}, true);
	
	return panel;
}

// current / entries / per / max
function Pagebar(opt){
	var total = Math.ceil(opt.entries/opt.per);
	opt.max = opt.max || opt.entries;
	var step = total <= opt.max ? 1 : total/opt.max;
	
	var tds = <></>;
	var pages = {};
	for(var i=1 ; i<total ; i+=step)
		pages[Math.ceil(i)]=true;
	pages[opt.current] = pages[total] = true;
	
	if(opt.current!=1)
		tds+=<td class="pagination" value={opt.current-1}></td>
	
	keys(pages).sort(function(a,b){return a-b}).forEach(function(page){
		tds+=<td class={(page==opt.current)? 'current' : ''} value={page}>{page}</td>
	})
	
	if(opt.current!=total)
		tds+=<td class="pagination" value={opt.current+1}></td>
	
	var elmPagebar = convertToDOM(<table id="pagebar"><tr>{tds}</tr></table>);
	connect(elmPagebar, 'onclick', function(e){
		var target = e.target();
		if(hasElementClass(target, 'current')) return;
		
		signal(elmPagebar, 'onChange', target.getAttribute('value'));
	})
	return elmPagebar;
}
