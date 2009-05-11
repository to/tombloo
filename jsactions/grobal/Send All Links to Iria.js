var T = Components.classes['@brasil.to/tombloo-service;1'].getService().wrappedJSObject;
T.executeWSH(function(ls){
	WScript.CreateObject('Iria.IriaApi').addUrl(ls, 1);
}, Array.join(document.getElementsByTagName('a'), '\n'), true);
