var http = require('http');
var https = require('https');
var url = require('url');
var pg = require('pg');

var j2x = require('jgexml/json2xml.js');

const bbc = 'www.bbc.co.uk';

var connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/main';
connectionString = connectionString + '?ssl=true';

function hasHeader(header, headers) {
	// snaffled from request module
	var headers = Object.keys(headers || this.headers),
		lheaders = headers.map(function (h) {return h.toLowerCase();});
	header = header.toLowerCase();
	for (var i=0;i<lheaders.length;i++) {
		if (lheaders[i] === header) return headers[i];
	}
	return false;
}

function getJSON(options, onResult) {

	var prot = options.port == 443 ? https : http;
	console.log(options.path);
	options.headers.Connection = 'keep-alive';
	var req = prot.request(options, function(res) {
		var output = '';
		console.log(options.host + ':' + res.statusCode);
		res.setEncoding('utf8');

		res.on('data', function (chunk) {
			output += chunk;
		});

		res.on('end', function() {
			var obj = {};
			if (res.statusCode >= 300 && res.statusCode < 400 && hasHeader('location', res.headers)) {
				// handle redirects, as per request module
				var location = res.headers[hasHeader('location', res.headers)];
				var locUrl = url.parse(location);
				options.path = locUrl.pathname;
				options.host = locUrl.host;
				console.log('Redirecting to '+options.path);
				getJSON(options, onResult);
			}
			else {
				if (res.statusCode == 200) {
					obj = {}
					try {
						obj = JSON.parse(output);
					}
					catch (err) {
					}
				}
				onResult(res.statusCode, obj);
			}
		});
	});

	req.on('error', function(err) {
		//res.send('error: ' + err.message);
	});

	req.end();
}

function finish(payload) {
	console.log('final '+payload.results.length);

	var feed = {};
	var rss = {};
	rss['@version'] = "2.0";
	rss.channel = {};
	rss.channel.title = 'BBC RSS programmes feed - '+payload.feed;
	rss.channel.link = 'http://bbc-rss.herokuapp.com/rss/'+(payload.domain ? payload.domain+'/' : '')+encodeURIComponent(payload.feed)+'.rss';
	rss.channel.description = 'Unofficial BBC iPlayer feeds';
	rss.channel.webMaster = 'mike.ralphson@gmail.com (Mike Ralphson)';
	rss.channel.pubDate = new Date().toUTCString();
	rss.channel.generator = 'bbcparse by Mermade Software';
	rss.channel.item = [];

	for (var j=0;j<payload.results.length;j++) {
		var p = payload.results[j];

		var domain = payload.orgDomain ? payload.orgDomain : payload.domain;

		if ((domain != 'tv') || (p.media_type != 'audio')) {
			var d = new Date(p.first_broadcast_date);
			var title = (p.display_titles ? p.display_titles.title +
				(p.display_titles.subtitle ? ' / ' + p.display_titles.subtitle : '') : p.title);
			if (p.parent) {
				title = p.parent.title + ' / ' + title;
			}

			var i = {};
			i.title = title;
			i.link = 'http://bbc.co.uk/programmes/'+p.pid;
			i.description = p.long_synopsis ? p.long_synopsis : (p.medium_synopsis ? p.medium_synopsis : p.short_synopsis);
			i.category = p.media_type ? p.media_type : (domain == 'radio' ? 'audio' : 'audio_video');
			i.guid = {};
			i.guid["@isPermaLink"] = 'false';
			i.guid[""] = 'PID:' + p.pid;
			i.pubDate = d.toUTCString();
			if (i.pubDate == 'Invalid Date') {
				i.pubDate = p.first_broadcast_date; // raw
			}

			if (!i.description) {
				i.description = i.title;
			}

			rss.channel.item.push(i);
		}
	}

	feed.rss = rss;
	s = j2x.getXml(feed,'@','',2);

	payload.res.set('Content-Type', 'text/xml');
	payload.res.send(s);
}

function clear(pid,payload) {
	var undone = false;
	for (var i=0;i<payload.source.length;i++) {
		if (payload.source[i].pid == pid) {
			payload.source[i].done = true;
		}
		if (payload.source[i].done == false) {
			undone = true;
		}
	}
	if (!undone) {
		finish(payload);
	}
}

function list(payload,parent) {
	//. path = '/programmes/'+obj.pid+'/episodes/player.json'
	//. path = '/programmes/'+obj.pid+'/children.json'
	var options = {
		host: bbc,
		port: 80,
		path: '/programmes/'+parent.pid+'/children.json',
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		}
	};
	getJSON(options,function(stateCode,obj) {
		if (stateCode == 200) {
			//console.log(JSON.stringify(obj,null,2));
			for (var i in obj.children.programmes) {
				process.stdout.write('.');
				var p = obj.children.programmes[i];
				if ((p.type == 'episode') || (p.type == 'clip')) {
					p.parent = parent;
					if (p.available_until) {
						payload.results.push(p);
					}
				}
				else {
					console.log('Recursing to '+p.pid);
					var job = {};
					job.pid = p.pid;
					job.done = false;
					payload.source.push(job);
					list(payload,p);
				}
			}
		}
		else {
			console.log('Inner '+parent.pid+' '+stateCode);
		}
		clear(parent.pid,payload);
	});
}

module.exports = {
	/**
	 * getJSON:  REST get request returning JSON object(s)
	 * @param options: http options object
	 * @param callback: callback to pass the results JSON object(s) back
	 */
	getJSON : getJSON,

	updateHitCounter : function() {
		try {
			var client = new pg.Client(connectionString);
			client.connect();
			var query = client.query("UPDATE hitcounter SET hit = hit+1 WHERE app = 'bbc-rss'");
			query.on('end', function() { client.end(); });
		}
		catch (e) {
		}
	},

	getHitCounter : function(callback) {
		try {
			var client = new pg.Client(connectionString);
			client.connect();
			var query = client.query("SELECT hit FROM hitcounter WHERE app = 'bbc-rss'");
			query.on('row', function(row) {
				callback(row);
			});
			query.on('end', function() {
				client.end();
			});
		}
		catch (e) {
			var hit = {};
			hit.hit = 0;
			callback(hit);
		}
	},

	bbc: bbc,

	list : list,

	finish : finish,

	clear : clear

};