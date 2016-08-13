var express = require('express');
var app = express();

var common = require('./common');
var pid = require('./pidInspector');
var searchSuggest = require('./searchSuggest');
var ssp = require('./searchSuggestProxy');
var nitro = require('./nitroProxy.js');
var msp = require('./msProxy.js');
var sky = require('./skyProxy.js');

function children(obj,payload) {
	payload.source = [];
	payload.results = [];
	if ((obj.category_slice) && (obj.category_slice.programmes)) {
		for (var i=0;i<obj.category_slice.programmes.length;i++) {
			p = obj.category_slice.programmes[i];

			if ((p.type == 'episode') || (p.type == 'clip')) {
				payload.results.push(p);
				//if (payload.results.length == 1) {
				//	console.log(JSON.stringify(p,null,2));
				//}
			}
			else if ((p.type == 'brand') || (p.type == 'series')) {
				//console.log(JSON.stringify(p,null,2));
				var job = {};
				job.done = false;
				job.pid = p.pid;
				payload.source.push(job);
				common.list(payload,p);
			}
		}
	}
	return payload.results;
}

app.get('/dynamic/hitCounter.js', function(req,res) {
	common.getHitCounter(function(hits) {
		res.send('var hits = '+JSON.stringify(hits)+';');
	});
});

app.get('/', function(req, res) {
	res.sendFile(__dirname+'/pub/index.html');
});

app.get('/favicon.ico', function(req, res) {
	res.sendFile(__dirname+'/favicon.ico');
});
app.get('/browserconfig.xml', function(req,res) {
	res.send('<?xml version="1.0" encoding="utf-8"?><browserconfig><msapplication></msapplication></browserconfig>');
});

app.get('/pid.html', function(req,res) {
	if (Object.keys(req.query).length>0) {
		if (!pid.processPid(req,res)) {
			res.sendFile(__dirname+'/pub/pidNotFound.html');
		}
	}
	else {
		res.sendFile(__dirname+'/pub'+req.path);
	}
});

app.use("/images",  express.static(__dirname + '/pub/images'));
app.use("/css",  express.static(__dirname + '/pub/css'));
app.use("/scripts",  express.static(__dirname + '/pub/scripts'));

app.get('/*.html', function (req, res) {
	res.sendFile(__dirname+'/pub'+req.path);
});

app.get('/suggest', function(req, res) {
	ssp.searchSuggestProxy(req,res);
});

app.get('/nitro/*', function(req, res) {
	nitro.nitroProxy(req,res);
});

app.get('/sky/*', function(req, res) {
	sky.skyProxy(req,res);
});

app.get('/msProxy/*', function(req, res) {
	msp.msProxy(req,res);
});

app.get('/rss/custom/:search.rss', function (req, res) {
	searchSuggest.searchSuggest(req,res);
});

app.get('/rss/:domain/:feed.rss', function (req, res) {
	res.send('Please use /rss/domain/formats/category.rss');
});

app.get('/rss/:domain/:prefix/:feed.rss', function (req, res) {
	//. http://expressjs.com/en/api.html#req
	//. http://expressjs.com/en/api.html#res

	// req.path (string)
	// req.query (object)

	var domain = req.params.domain;
	var prefix = req.params.prefix;
	var feed = req.params.feed;

	if (domain == 'tv') {
		domain = '';
	}
	else {
		domain = '/radio';
	}
	mode = '/genres';
	if (prefix == 'formats') {
		mode = '/formats';
		prefix = '';
	}

	if (feed == 'all') {
		feed = prefix;
		feed = '';
	}

	var options = {
		host: common.bbc,
		port: 80,
		path: domain+'/programmes'+mode+(prefix ? '/'+prefix : '')+(feed ? '/'+feed : '')+'/player.json',
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		}
	};

	common.getJSON(options,function(stateCode,obj) {
		if (stateCode == 200) {
			//feed = (prefix ? prefix : 'formats') + (feed ? '/' + feed : '');
			var payload = {};
			payload.res = res;
			payload.finish = common.finish;
			payload.domain = req.params.domain; //original not modified
			payload.prefix = prefix ? prefix : 'formats';
			payload.feed = feed;
			children(obj,payload);
		}
		else {
			res.send('<html><head><title>BBC RSS</title></head><body><h2>'+stateCode+': Feed not found</h2></body></html>\n');
		}
	});

	//common.updateHitCounter();

});

var myport = process.env.PORT || 3000;
if (process.argv.length>2) myport = process.argv[2];

var server = app.listen(myport, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('RSS / Nitro proxy app listening at http://%s:%s', host, port);
});