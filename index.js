'use strict';
var express = require('express');
var compression = require('compression');

var app = express();
app.use(compression());
app.set('view engine', 'ejs');

const common = require('./common');
const progs = require('./progs.js');
const nitro = require('./nitro');
const ibl = require('./ibl');
const pid = require('./pidInspector');
const searchSuggest = require('./searchSuggest');
const ssp = require('./searchSuggestProxy');
const nitroProxy = require('./nitroProxy.js');
const msp = require('./msProxy.js');
const channel4 = require('./channel4.js');
const films = require('./films.js');
const sky = require('./skyProxy.js');
const itv = require('./itv.js');
const netflix = require('./netflix.js');
const redirect = require('./redirect.json');

var globalCache = {};

app.get('/dynamic/hitCounter.js', function(req,res) {
	common.getHitCounter(function(hits) {
		res.send('var hits = '+JSON.stringify(hits)+';');
	});
});

app.get('/', function(req, res) {
	if (req.headers.referer) console.log(req.headers.referer);
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
app.get('/pidLookup.html', function(req,res) {
	if (req.query.vpid) {
		pid.vpidLookup(req,res);
	}
	else {
		res.sendFile(__dirname+'/pub/pidNotFound.html');
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
	nitroProxy.nitroProxy(req,res);
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

app.get('/rss/channel4/:category.rss', function (req, res) {
	channel4.getCategory(req,res);
});
app.get('/rss/channel4/channel/:channel.rss', function (req, res) {
	req.params.category = 'channel/'+req.params.channel;
	delete req.params.channel;
	channel4.getCategory(req,res);
});
app.get('/rss/channel4/derived/:mode.rss', function (req, res) {
	req.params.category = 'derived/'+req.params.mode;
	delete req.params.mode;
	channel4.getCategory(req,res);
});
app.get('/rss/film4/:category.rss', function (req, res) {
    films.getCategory(req,res);
});

app.get('/rss/itv/category/:category.rss', function (req, res) {
	itv.getCategory(req,res);
});

app.get('/rss/netflix/search/:search.rss', function (req, res) {
    netflix.main(req.params.search,0,0,function(xml){ // 1492
      res.setHeader('content-type','text/xml');
      res.end(xml);
    });
});

app.get('/rss/netflix/search/:search/:max.rss', function (req, res) {
    netflix.main(req.params.search,0,req.params.max,function(xml){
      res.setHeader('content-type','text/xml');
      res.end(xml);
    });
});

app.get('/rss/netflix/category/:cat.rss', function (req, res) {
    netflix.main('',req.params.cat,0,function(xml){
      res.setHeader('content-type','text/xml');
      res.end(xml);
    });
});

// ibl
app.get('/rss/tv/accessibility/:category.rss', function(req,res) {
	ibl.getCategory(req, res);
});

// nitro
app.get('/:service/:domain/upcoming/:mode/:category.rss', function (req, res) {
	var options = {availability:'P30D'};
	if (req.params.service == 'cache') {
		options.cache = globalCache;
	}
	nitro.programmesByCategory(req,res,options);
});
app.get('/:service/:domain/available/:mode/:category.rss', function (req, res) {
	var options = {availability:'available'};
	if (req.params.service == 'cache') {
		options.cache = globalCache;
	}
	nitro.programmesByCategory(req,res,options);
});

app.get('/cache/:domain/short/:mode/:category.rss', function (req, res) {
	var options = {availability: 'available'};
	options.cache = globalCache;
	options.limit = common.WEEK;
	options.short = true;
	nitro.programmesByCategory(req,res,options);
});

// compatibility
app.get('/rss/:domain/upcoming/:feed.rss', function (req, res) {
	nitro.programmesByCategory(req,res,{availability:'P30D',mode:'genre'});
});
app.get('/rss/:domain/available/:feed.rss', function (req, res) {
	nitro.programmesByCategory(req,res,{availability:'available',mode:'genre'});
});
// end compatibility

app.get('/rss/:domain/:feed.rss', function (req, res) {
	// redirect for a couple of incorrect feed links, now corrected
	var p = req.path;
	p = p.replace('.rss','/all.rss');
	res.redirect(301,p);
});

app.get('/rss/:domain/pid/:category.rss', function(req, res) {
	//progs.getPid(req,res);
	nitro.programmesByCategory(req,res,{availability:'available',mode:'pid'});
});

app.get('/rss/:domain/:prefix/:feed.rss', function (req, res) {
	var redir = redirect.find(function(e,i,a){
		return e.from == req.path;
	});
	if (redir) {
		res.redirect(301,redir.to);
	}
	else {
		progs.getProgrammes(req,res);
	}
});

var myport = process.env.PORT || 3000;
if (process.argv.length>2) myport = process.argv[2];

var server = app.listen(myport, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('RSS / Nitro proxy app listening at http://%s:%s', host, port);
});

