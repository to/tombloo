Tombloo.Service.actions.register(	{
	name : 'Send Links to Iria',
	type : 'context',
	execute : function(ctx){
		// Open(FileName As String, Flag As Long)
		// [Flag: 0:IRI 1:IRI追加 2:List 3:CRC 4:WRG 5:GRX]
		
		// [Flag: 0:通常 1:選択ウィンドウ]
		runWSH(function(ls){
			WScript.CreateObject('Iria.IriaApi').addUrl(ls, 1);
		}, Array.join(ctx.document.links, '\n'));
	},
}, '----');
