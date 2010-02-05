Tombloo.Service.actions.register(	{
	name : 'iTunes - Increment Played Count',
	icon : "data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAMAAAALAAAAFwgICSEHCAggAAAAFAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAAAHQAAAEQwMTKCZGJiuoB7d9uNiIHojISC5npqbNJSSkihFBYZTgAAAAsAAAAAAAAAAAAAAAAAAAAOAAAAOh0cHIh6d3Xgx7ut/+DPuP/q1rz/6dfD/+TFw//krrH/47Oe/7ScfPNCQjuGAAAACwAAAAAAAAADAAAAKzU0NJm6t7T75car/8mEWf/Fe0j/4L+f/+rax//atLb/57Ov//zTq//71Yf/18Z4/1BTRnEAAAAAAAAAAygnJ2PU0sz6/////8+BWP/yhAb/+6AA/8trH//t8fD/477A/+iqiP/XkF//y4JM/97Abf+kqGHsKSotHAQEBQqinpjS///6//z47//dpoL/+sR2//mwTv/GZxX/4+zu/+azr//PdEL/8oQG//ugAP/Hahj/r9mN/4GVgHY+PDpM6OXa//Hs3v/r5Nb/9O/i/96riv/bq4j/vmwt/83C0frKlXv7zZBO//rEdf/5rk3/xWgV/6nz2P+CopW1d3Rzlfj08//h29j/39XO/+PYzP/v39P/5urn9cBsKfGut7urx760xqDBjvWwpXL/vqiD/79uLv+q5+3/fJKWxouNkbXt9/7/0dvo/8/T5v/PyO3/qqvM/uPo69jBaSTYDQEAELayspu9ztfxhcHk/6/m9f+/bi7/zur0/4CKjat+ioqt1/r+/6/Y6v+i1PP/iOT4/2XVr//O6dvcw2gi5IN8eI3SzMnT0cS//NzPzv/d3Oj/v24u/+Tj6v9bW15pW2RpfMH6+/+c7uL/mPnM/439pv+q61D/zbZ7/L1lH/zj4+D35OHa/Pj28v/7+e//9PDm/79uLv/CvLbjEBQYFCUlJyiz9c/5qf+t/6PtiP/L8Xn/9L9m//Wwqf+7ZSL/0ZJm/+GuiP/qyLH/897P//fo2/+/bi7/XUU2cQAAAAAAAAAAY3VlgNj/t//f833/6cZ4/+6tlP/wxtL/vWkm/+mWMf/oiR7/43wN/95wBf/XbQ7/v24u/4EtAD4AAAAAAAAAAAIABAF+h2mK+OqY//vEm//5wbz/69TZ/9J0MP/eikX/4ZJK/+SaTf/lmUX/3H8i/79uLv+GMwAGAAAAAAAAAAAAAAAAAAAAAD89OUKrk4ip3r+94+vb3vjTo4v5z5Rz9cmFW//GfEz/1oBE/9+PTP+vXSX/iS8ABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMVFQ4xMTEmRENDKFE9MSC9bEA3w2s5XLhhMYSmUiSsqlgq1Z49CgUAAAAA8A8AwMAD9saAAfgPAAHgAwAAwAMAAMABAACAAQAAgAAAAAAAAAAAgAAAAAEAAYABgAGAA4ABgAPgAcAD+AEEAA==",
	execute : function(){
		runWSH(function(msg){
			var iTunes = WScript.CreateObject('iTunes.Application');
			var tracks = iTunes.selectedTracks;
			if(!tracks)
				return;
			
			for(var i = 1 ; i <= tracks.count ; i++){
				var track = tracks(i);
				track.PlayedCount = Math.max(0, track.PlayedCount) + 1;
			}
		});
	},
}, '----');
