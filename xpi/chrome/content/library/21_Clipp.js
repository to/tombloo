if(typeof(models)=='undefined')
	this.models = models = new Repository();

var Clipp = {
	name: 'Clipp',
	ICON: 'chrome://tombloo/skin/item.ico',
	CLIPP_URL: 'http://clipp.in/',

	check: function(ps) {
		return (/(photo|quote|link|video)/).test(ps.type) && !ps.file;
	},
	post: function(ps) {
		var endpoint = this.CLIPP_URL + 'bookmarklet/add';
		var self = this;

		return self.postForm(function() {
			return self.getForm(endpoint).addCallback(function(form) {
				update(form, self[ps.type.capitalize()].convertToForm(ps));

				self.appendTags(form, ps);

				if (ps.type == 'video' && !form.embed_code) {
					// embed_tagを取得してformに設定する
					var address = form.address;
					return request(address).addCallback(function(res) {
						var doc = convertToHTMLDocument(res.responseText);
						var uri = createURI(address);
						var host = uri ? uri.host : '';
						if (host.match('youtube.com')) {
							form.embed_code = $x('id("embed_code")/@value', doc) || '';
						}
						return request(endpoint, { sendContent: form });
					});
				}
				return request(endpoint, { sendContent: form });
			});
		});
	},
	getForm: function(url) {
		return request(url).addCallback(function(res) {
			var doc = convertToHTMLDocument(res.responseText);
			return formContents(doc);
		});
	},
	appendTags: function(form, ps) {
		return update(form, {
			tags: (ps.tags && ps.tags.length) ? joinText(ps.tags, ',') : ''
		});
	},
	favor: function(ps) {
		// メモをreblogフォームの適切なフィールドの末尾に追加する
		var form = ps.favorite.form;
		items(this[ps.type.capitalize()].convertToForm({
			description: ps.description
		})).forEach(function([name, value]) {
			if (!value) return;
			form[name] += value;
		});

		this.appendTags(form, ps);

		return this.postForm(function() {
			return request(ps.favorite.endpoint, { sendContent: form });
		});
	},
	postForm: function(fn) {
		var CLIPP_URL = this.CLIPP_URL;
		var d = succeed();
		d.addCallback(fn);
		d.addCallback(function(res) {
			var url = res.channel.URI.asciiSpec.replace(/\?.*/,'');
			switch (true) {
			case url == CLIPP_URL + 'bookmarklet/add':
				return;
			case url == CLIPP_URL + 'bookmarklet/account/login':
				throw new Error(getMessage('error.notLoggedin'));
			default:
				if (url.match(/edit\/\d+$/)) addTab(url);
				error(res);
				throw new Error('Error posting entry.');
			}
		});
		return d;
	}
};

Clipp.Link = {
	convertToForm: function(ps) {
		return {
			title: ps.item,
			address: ps.itemUrl,
			description: escapeHTML(ps.description)
		};
	}
};

Clipp.Quote = {
	convertToForm: function(ps) {
		return {
			title: ps.item,
			address: ps.itemUrl,
			quote: ps.body ? ps.body.replace(/\n/g, '<br>') : '',
			description: escapeHTML(ps.description)
		};
	}
};

Clipp.Photo = {
	convertToForm: function(ps) {
		return {
			title: ps.item,
			address: ps.pageUrl,
			image_address: ps.itemUrl,
			description: joinText([
				(ps.item ? ps.item.link(ps.pageUrl) : '') + (ps.author ? ' (via ' + ps.author.link(ps.authorUrl) + ')' : ''),
				'<p>' + escapeHTML(ps.description) + '</p>' ], '')
		};
	}
};

Clipp.Video = {
	convertToForm: function(ps) {
		return {
			title: ps.item,
			address: ps.pageUrl,
			embed_code: ps.body || '',
			description: joinText([
				(ps.item ? ps.item.link(ps.pageUrl) : '') + (ps.author ? ' (via ' + ps.author.link(ps.authorUrl) + ')' : ''),
				'<p>' + escapeHTML(ps.description) + '</p>' ], '')
		};
	}
};

models.register(Clipp);
