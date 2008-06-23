{
/**	
 *
 *  HTTP.Request is in the Public Domain. 
 *
 * opts
 *		async		returns async input stream.
 *		headers		additional http request headers.
 *		onStartRequest
 *		onDataAvailable
 *		onStopRequest
 *		notificationCallbacks
 */
var VERSION = "0.1.0";
function HTTP(){ }
HTTP.Request = function (uri, opts) {

	this.uri = uri;
	this.opts = opts || {};
//	this.channel = null;
	const CC = Components.classes;
	const CI = Components.interfaces;
	this.ios = CC["@mozilla.org/network/io-service;1"].getService(CI.nsIIOService);

	this.request_channel = null;
	this.response_body = null;

	this.multipartChunk = '';

	this.create_string_input_stream = function ( ) {
		return CC["@mozilla.org/io/string-input-stream;1"].
				createInstance(CI.nsIStringInputStream);
	};
	
	var self = this;
	[ 'onStopRequest', 'onDataAvailable', 'onStartRequest' ].forEach( function (n) {
		if ( self.opts[n] )
			self[n] = self.opts[n];
	} );
}
HTTP.Request.boundary = 'DEADBEEF_DEADBEEF';
HTTP.Request.prototype.onDataAvailable = function (req, context, stream, offset, length) {
	var ss = Components.classes['@mozilla.org/scriptableinputstream;1'].
					createInstance(Components.interfaces.nsIScriptableInputStream);
	ss.init(stream);
	this.response_body += ss.read(length);
}
HTTP.Request.prototype.onStartRequest = function () {
	this.response_body = '';
}
HTTP.Request.prototype.onStopRequest = function (request, context, statusCode) {
}

HTTP.Request.query = function (params) {
	var pairs = [];

	if ( typeof params == 'string' ) {
		return params;
	}
	
	for (var n in params ) {
		pairs.push ( [ n, encodeURIComponent(params[n]) ].join('=') );
	}
	return pairs.join("&");
}

HTTP.Request.createStringStream = function (chunk) {
	var sis = Components.classes["@mozilla.org/io/string-input-stream;1"].
	            createInstance(Components.interfaces.nsIStringInputStream);
	sis.setData(chunk, chunk.length);
	return sis;
}
HTTP.Request.prototype.createStreamFromChunk = function () {
	var is =  HTTP.Request.createStringStream(this.multipartChunk); 
	this.multipartChunk = "";
	return is;
}
HTTP.Request.prototype.addChunk = function (multiplexStream) {
	if ( this.multipartChunk ) {
		var sis = this.createStreamFromChunk();
		multiplexStream.appendStream(sis);
	}
}
// must place streams last.
// I dont know why but any streams added after adding nsIBufferedInput,
// these streams do not appears in HTTP request packet.
HTTP.Request.prototype.set_multipart_params = function () {
	var post_data_stream = Components.classes["@mozilla.org/io/multiplex-input-stream;1"].
	            createInstance(Components.interfaces.nsIMultiplexInputStream);

	var pairs = [];
	for (var name in this.params ) {
		var streams = [];
		var value = this.params[name];

		if ( value.localfile ) {
			streams = this.create_stream_from_file(name, value);
		} else if ( value.stream ) {
			streams = this.create_stream(name, value.stream, value);
		} else {
			this.multipartChunk +=
				"--" + HTTP.Request.boundary + '\r\n' +
				'Content-Disposition: form-data; name="' + name + '"\r\n' +
				'\r\n' + value + '\r\n';
		}
		streams.forEach( function (s) {
			post_data_stream.appendStream(s);
		} );
	}

	this.multipartChunk += '--' + HTTP.Request.boundary + '--\r\n';
	this.addChunk(post_data_stream);

	var mime_stream = Components.classes["@mozilla.org/network/mime-input-stream;1"]
			.createInstance(Components.interfaces.nsIMIMEInputStream);

	var content_type = "multipart/form-data; boundary=" + HTTP.Request.boundary;
	mime_stream.addHeader("Content-Type", content_type);
	mime_stream.addContentLength = true;
	mime_stream.setData(post_data_stream);
	return mime_stream;
}

HTTP.Request.prototype.create_stream = function (param_name, input, stream_params) {
	this.multipartChunk +=  "--" + HTTP.Request.boundary + '\r\n' +
							'Content-Disposition: form-data; name="' +
							param_name + '";';
	if ( stream_params.filename ) {
		this.multipartChunk += ' filename="' + stream_params.filename + '"\r\n';
	}
	if ( stream_params.contentType ) {
		this.multipartChunk += "Content-Type: " + stream_params.contentType + '\r\n';
		this.multipartChunk += '\r\n';
	}

	var sis = this.createStreamFromChunk();
	var buffered_stream = Cc["@mozilla.org/network/buffered-input-stream;1"].
				createInstance(Ci.nsIBufferedInputStream);

	buffered_stream.init(input, 4096);

	this.multipartChunk += '\r\n';

	return [sis, buffered_stream ];
}

HTTP.Request.prototype.create_stream_from_file = function (param_name, params) {
	var localfile = HTTP.Request.Util.open_file(params.filename);
	var uploadfile_uri = this.ios.newFileURI( localfile );
	var channel = this.ios.newChannelFromURI( uploadfile_uri );
	var input = channel.open();
	return this.create_stream(param_name, input, params );
}
HTTP.Request.prototype.setup_channel = function (uri) {
	var uri = this.ios.newURI(this.uri, 'UTF-8', null);
	this.request_channel = this.ios.newChannelFromURI(uri);
}

HTTP.Request.prototype.set_params = {
	GET: function () {
		var query = HTTP.Request.query(this.params);
		if ( query != '' ) {
			this.uri += ( ( this.uri.indexOf('?') >= 0) ? '&' : '?' ) + query; 
		}
		this.setup_channel();
	},
	POST: function () {
		var content_type = this.opts.content_type || this.opts.contentType;
		var post_data_stream;
		if ( this.opts.rawStream ) {
			post_data_stream = this.opts.rawStream;
		} else if ( this.opts.multipart ) {
			//content_type = null;
			post_data_stream = this.set_multipart_params();
		} else {
			content_type |= 'application/x-www-form-urlencoded';
			var query = HTTP.Request.query(this.params);
			post_data_stream = this.create_string_input_stream();
			post_data_stream.setData(query, query.length);
			//post_data_stream = sis;
		}

		this.setup_channel();
		this.request_channel.QueryInterface(Components.interfaces.nsIUploadChannel);
		this.request_channel.setUploadStream(post_data_stream, content_type, -1);
	},
}

HTTP.Request.prototype.send_request = function (method, params) {
	this.params = params;
	var fn = this.set_params[method];
	fn.apply(this);

	this.request_channel.QueryInterface( Components.interfaces.nsIHttpChannel);
	this.request_channel.requestMethod = method;
	this.request_channel.notificationCallbacks = this.opts.notificationCallbacks;
	
	var response_input_stream = ( this.opts.async ) ?
			this.request_channel.asyncOpen(this, this) :
			this.request_channel.open() ;

	if ( ! this.opts.async ) {
		var ss = Components.classes['@mozilla.org/scriptableinputstream;1'].
						createInstance(Components.interfaces.nsIScriptableInputStream);
		ss.init(response_input_stream);
		this.response_body = '';
		var n;
		while ( n = ss.available() ) {
			this.response_body += ss.read(n);
		}
		return this.response_body;
	}
}

HTTP.Request.prototype.get = function (params) {
	return this.send_request('GET', params);
}
HTTP.Request.prototype.post = function (params) {
	return this.send_request('POST', params);
}

HTTP.Request.Util = {
	open_file: function (filename) {
		var file = Components.classes["@mozilla.org/file/local;1"]
							.createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(filename);
		return file;
	},
	deferredAsyncRequest: function(method, uri, opts, params) {
		var d = new MochiKit.Async.Deferred(  );

		opts = opts || {};
		opts.async = true;
		opts.onStopRequest = function (request, context, statusCode) {
			d.callback( [this, request, context, statusCode] );
		};

		var req = new HTTP.Request( uri, opts );
		req[method.toLowerCase()](params);

		return d;
	}
}

}


var MetaWeblogAPI = function () {
	Components.utils.import("resource://gre/modules/ISO8601DateUtils.jsm");

	var me = function (username, password, endpint) {
		this.username = username;
		this.password = password;
		this.endpint = endpint;
	};

	function param (value) {
		var p = <param/>;
		if ( typeof(value) == 'string' ||
				typeof(value) == 'number') {
			p.value.string = value;
		} else if ( value instanceof Array) {
			var data = p.value.array.data = <data/>;
			value.forEach( function (item) {
				var v = <value/>;
				var s = <string/>;
				v.appendChild(s);
				s.appendChild(item);
				data.appendChild(v);
			} );
		} else if ( typeof(value) == 'boolean' ) {
			p.value.boolean = value;
		} else if ( value instanceof Date ) {
			var d = <dateTime.iso8601/>;
			d.string = ISO8601DateUtils.create(value);
			p = d;
		} else if ( typeof(value) == 'xml' ) {
			p.value = <value/>;
			p.value.appendChild(value);
		} else if ( value instanceof Object ) {
			var v = <value/>;
			v.struct = <struct/>;
			for ( var i in value ) {
				
			}
			keys(value).forEach ( function (name) {
				var m = <member/>;
				m.appendChild(
					<name/>.appendChild(name) + param(value[name]).value
				);
				v.struct.appendChild(m);
			} );
			p.appendChild(v);
		} else {
			throw "unexpected param type." + typeof(value);
		}
		return p;
	};

	function base64(bits) {
		var b64 = <base64/>;
		b64.appendChild(bits);
		return b64;
	}

	me.deferredGetBase64EncodedContent = function (uri) {
		var d = new MochiKit.Async.Deferred(  );

		var ios = Components.classes["@mozilla.org/network/io-service;1"]
						.getService(Components.interfaces.nsIIOService);
		var uri = ios.newURI(uri, 'UTF-8', null);
		var channel = ios.newChannelFromURI( uri );
		channel.QueryInterface(Components.interfaces.nsIHttpChannel);

		var chunk = "";
		var b64 = "";
		channel.asyncOpen( {
			onStartRequest: function(request, context ) {
			},
			onDataAvailable: function  ( request , context , inputStream , offset , count )  {
				var bs = Components.classes["@mozilla.org/binaryinputstream;1"]
											.createInstance(Components.interfaces.nsIBinaryInputStream);
				bs.setInputStream(inputStream);
				var bytes = bs.readBytes(count);
				chunk += bytes;
				if ( chunk.length % 3 ) {
					b64 += btoa(chunk);
					chunk = "";
				}
			},
			onStopRequest: function ( request , context , statusCode ) {
				b64 += btoa(chunk);
				d.callback( [channel, b64] );
			}
		}, null  );
		return d;
	}

	me.prototype.request = function (method, e4x) {
		var methodName = (<methodName/>).appendChild("metaWeblog." + method);
		var params = (<params/>).appendChild(
			param(1) +
			param(this.username) +
			param(this.password) +
			e4x
		);

		var methodCall = <methodCall/>;
		methodCall.appendChild(methodName + params);

		var xmlheader = '<?xml version="1.0" encoding="UTF-8"?>\n';
		var body = xmlheader + methodCall.toString();

		return HTTP.Request.Util.deferredAsyncRequest(
			"post", this.endpint, {contentType: "text/xml"}, body
		);
	};

	me.prototype.newPost = function (title, body, categories) {
		return this.request(
			'newPost',
			param( {
				description: body,
				dateCreated: (new Date()).toString(),
				title: title,
				categories: categories
			} ) +
			param(1)
		);
	};
	me.prototype.deferredNewMediaObject = function (uri, name, path) {
		var self = this;
		return me.deferredGetBase64EncodedContent(uri).addCallback( function (args) {
			var channel = args[0];
			var b64 = args[1];

			var contentType = channel.contentType;

			var filename;
			if ( name ) {
				filename = name;
			} else {
				if ( uri.match( /\/([\/]+?)$/ ) ) {
					filename = $1;
				} else {
					filename = Date.now() + "." + contentType.split(/\//).pop();
				}
			}
			filename = path ? path.match(/\/$/) ? path + filename : path + '/' + filename : filename;

			return self.newMediaObject(filename, b64, contentType).addCallback( function (args) {
				var body = args[0].response_body;
				var xml = new XML( body.replace(/^.+?>/, '') );
				if ( xml.fault.length() )
					throw( [xml..int, xml..string].join(" ") );
				return xml;
			} );
		} ).addCallback( function (xml) {
			var permalink = xml..name.(function::text() == 'url' ).parent()..string;
			return permalink.toString();
		} );
	};
	me.prototype.newMediaObject = function (name, bits, type) {
		return this.request(
			'newMediaObject',
			param( {
				name: name,
				bits: base64(bits),
				type: type
			} )
		);
	};

	return me;
}.call(this);

var MetaWeblog = {
	prefix: 'tombloo:metaWeblog:',
	prefKeyEndPoint: 'posters.MetaWeblog.endpoint',
	prefKeyMediaPath: 'posters.MetaWeblog.mediapath',
	endpoint: null,
	post: function (params) {
		this.endpoint = getPref(this.prefKeyEndPoint);
		if ( !this.endpoint ) {
			var fullkey = ("extensions.tombloo." + this.prefKeyEndPoint).quote();
			throw "Set API endpoint in " + fullkey + " at about:config to use MetaWeblog poster.";
		}

		var lm = Components.classes["@mozilla.org/login-manager;1"]
						.getService(Components.interfaces.nsILoginManager);
		
		var mediapath = getPref(this.prefKeyMediaPath);
		var endpointUri = createURI(this.endpoint);
		var hostname = endpointUri.prePath;
		var formSubmitURL = endpointUri.prePath;
		var logins = lm.findLogins({}, this.prefix + hostname, this.prefix + formSubmitURL, null);
		var loginInfo = logins.shift();
		if ( ! loginInfo ) {
			var ps = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
			var [user, pass] = [{ value : null }, { value : null }];
			var ret = ps.promptUsernameAndPassword(
				window, formSubmitURL, "tombloo metaWeblog poster", user, pass, null, {});
			if(ret){
				var nsLoginInfo = new Components.Constructor(
					"@mozilla.org/login-manager/loginInfo;1", Ci.nsILoginInfo, "init");
				loginInfo = new nsLoginInfo(
					this.prefix + hostname, this.prefix + formSubmitURL, null, user.value, pass.value, '', '');
				lm.addLogin(loginInfo);
			}
			if ( ! loginInfo ) {
				throw "No login infomation found. Please make Firefox remeber your login information at " + this.endpointUri.replace(/\bxmlrpc\b/, 'wp-login');
			}
		}

		var mw = new MetaWeblogAPI(loginInfo.username, loginInfo.password, this.endpoint);
		return mw.deferredNewMediaObject(params.source, '', mediapath).addCallback( function (permalink) {
				params.source = permalink;
				var c = MetaWeblog[capitalize(params.type)].convertToForm(params);
				return mw.newPost(c.title, c.body, ["reblog", params.type]).addCallback( function (args) {
					ConsoleService.logStringMessage(args[0].params);
					var body = args[0].response_body;
					ConsoleService.logStringMessage(body);
					var xml = new XML( body.replace(/^.+?>/, '') );
					if ( xml.fault.length() )
						throw( [xml..int, xml..string].join(" ") );
					ConsoleService.logStringMessage(xml);
					return xml;
				} );
			} );
	}
}

MetaWeblog.Link = {
	convertToForm : function(m){
		return {
			title : m.title,
			body : '<div class="tombloo_link">' + m.title.link(m.href) + "</div>",
		};
	}
}

MetaWeblog.Quote = {
	convertToForm : function(m){
		var body = '<blockquote ' + [
							'class="tombloo_quote"',
							'cite="' + m.href + '"',
							'title="' + m.title + '"'
						].join(" ")
					'>' + m.body + '<cite>' + m.title.link(m.href) + '</cite>' +
					'</blockquote>';
		return {
			title : m.title,
			body : body
		};
	}
}

MetaWeblog.Photo = {
	convertToForm : function(m){
		return {
			title : m.title,
			body : '<div class="tombloo_photo"><img src=' + m.source.quote() + ' />' +
					'<p class="tombloo_photo">' + m.body + '</p></div>',
		};
	}
}

Tombloo.Service.posters['MetaWeblog'] = function (ctx, params) {
	if ( MetaWeblog[ String(params.type).capitalize() ] ) {
		return MetaWeblog.post(params);
	} else {
		return succeed();
	}
}


