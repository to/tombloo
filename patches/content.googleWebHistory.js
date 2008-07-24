connect(grobal, 'content-ready', function(win){
	GoogleWebHistory.post(win.location.href);
});
