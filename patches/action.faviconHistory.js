Tombloo.Service.actions.register(	{
	name : 'Favicon History',
	execute : function(){
		addTab('about:blank').addCallback(function(win){
			withWindow(win, function(){
				var doc = win.document;
				doc.title = 'Favicon History';
				
				var root = NavHistoryService.executeQuery(
					NavHistoryService.getNewQuery(), 
					NavHistoryService.getNewQueryOptions()).root;
				root.containerOpen = true;
				
				doc.body.appendChild(convertToDOM(<style><![CDATA[
					body {
						margin : 48px;
					}
					img {
						border : 4px solid white;
					}
					img:hover {
						border : 4px solid #DDD;
					}
				]]></style>));
				
				forEach(root, function(node){
					try{
						var uri = createURI(node.uri);
						var src = FaviconService.getFaviconForPage(uri).spec
						var link = doc.body.appendChild(doc.createElement('a'));
						link.href = uri.spec;
						
						var img = link.appendChild(doc.createElement('img'));
						img.src = src;
						
						img.onerror = function(){
							removeElement(img);
						}
					} catch(e){
						// アイコンが見つからないとエラーが発生する
					}
				});
			});
		});
	},
}, '----');
