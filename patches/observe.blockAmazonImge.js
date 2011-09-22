if(grobal.BlockAmazonImge)
	ObserverService.removeObserver(grobal.BlockAmazonImge, 'http-on-modify-request');

grobal.BlockAmazonImge = {
	observe : function(subject, topic, data) {
		(subject instanceof Ci.nsIHttpChannel) && 
			/images-amazon\.com/.test(subject.URI.host) && 
			!/amazon\./.test(subject.referrer.host) && 
			subject.cancel(Cr.NS_ERROR_FAILURE);
	}
};

ObserverService.addObserver(grobal.BlockAmazonImge, 'http-on-modify-request', false);
