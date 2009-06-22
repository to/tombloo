addBefore(models, 'check', function(ps) {
	this.values.forEach(function(m){ m.hasPrivateMode = false; });
});

