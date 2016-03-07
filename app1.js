var http = require('http');
var https = require('https');
var express = require('express');
var app = express();

var j2x = require('jgexml/json2xml.js');

const bbc = 'www.bbc.co.uk';

/**
 * getJSON:  REST get request returning JSON object(s)
 * @param options: http options object
 * @param callback: callback to pass the results JSON object(s) back
 */
getJSON = function(options, onResult)
{
    //console.log("rest::getJSON");

    var prot = options.port == 443 ? https : http;
	console.log(options.path);
    var req = prot.request(options, function(res) {
        var output = '';
        console.log(options.host + ':' + res.statusCode);
        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            output += chunk;
        });

        res.on('end', function() {
			var obj = {};
			if (res.statusCode == 200) {
				obj = JSON.parse(output);
			}
            onResult(res.statusCode, obj);
        });
    });

    req.on('error', function(err) {
        //res.send('error: ' + err.message);
    });

    req.end();
};

function clear(pid,source,results,res,finish,name) {
	var undone = false;
	for (var i=0;i<source.length;i++) {
		if (source[i].pid == pid) {
			source[i].done = true;
		}
		if (source[i].done == false) {
			undone = true;
		}
	}
	if (!undone) {
		finish(res,results,name);
	}	
}

function list(pid,source,results,res,finish,name,parent) {
	//. path = '/programmes/'+obj.pid+'/episodes/player.json'
	var options = {
		host: bbc,
		port: 80,
		path: '/programmes/'+pid+'/episodes/player.json',
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	};
	getJSON(options,function(stateCode,obj) {
		if (stateCode == 200) {
			//console.log(JSON.stringify(obj,null,2));
			for (var i in obj.episodes) {
				process.stdout.write('.');
				var p = obj.episodes[i].programme;
				if ((p.type == 'episode') || (p.type == 'clip')) {
					p.parent = parent;
					results.push(p);
				}
				else {
					console.log('Recursing to '+p.pid);
					var job = {};
					job.pid = p.pid;
					job.done = false;
					source.push(job);
					list(p.pid,source,results,res,finish,name,p);
				}
			}
		}
		else {
			console.log('Inner '+pid+' '+stateCode);
		}
		clear(pid,source,results,res,finish,name);
	});
}

function children(obj,res,finish,name) {
	var source = [];
	var results = [];
	for (var i=0;i<obj.category_slice.programmes.length;i++) {
		p = obj.category_slice.programmes[i];
		
		if ((p.type == 'episode') || (p.type == 'clip')) {
			results.push(p);
		}
		else if ((p.type == 'brand') || (p.type == 'series')) {
			var job = {};
			job.done = false;
			job.pid = p.pid;
			source.push(job);
			list(p.pid,source,results,res,finish,name,p);
		}
	}
	return results;
}

/*
    "type": "episode",
    "pid": "b007jmt2",
    "position": 5,
    "title": "Episode 5",
    "short_synopsis": "The stalled rocket ship stops Captain Jet and his crew from returning to Earth.",
    "media_type": "audio",
    "duration": 1800,
    "image": {
      "pid": "p01lcb4k"
    },
    "display_titles": {
      "title": "Operation Luna",
      "subtitle": "Episode 5"
    },
    "first_broadcast_date": "2008-08-09T18:00:00+01:00",
    "has_medium_or_long_synopsis": true,
    "has_related_links": false,
    "has_clips": false,
    "has_segment_events": false,
    "ownership": {
      "service": {
        "type": "radio",
        "id": "bbc_radio_four_extra",
        "key": "radio4extra",
        "title": "BBC Radio 4 Extra"
      }
	}
*/

function finish(res,results,name) {

	console.log('final '+results.length);
	
	var feed = {};
	var rss = {};
	rss['@version'] = "2.0";
	rss.channel = {};
	rss.channel.title = 'BBC RSS programmes feed - '+name;
	rss.channel.link = 'http://bbc-rss.herokuapp.com/rss/'+name+'.rss';
	rss.channel.description = 'Unofficial BBC iPlayer feeds';
	rss.channel.webMaster = 'mike.ralphson@gmail.com (Mike Ralphson)';
	rss.channel.pubDate = new Date().toUTCString();
	rss.channel.generator = 'bbcparse by Mermade Software';
	rss.channel.item = [];
	
	for (var j=0;j<results.length;j++) {
		var p = results[j];
		
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
		i.category = p.media_type ? p.media_type : 'audio';
		i.guid = {};
		i.guid["@isPermaLink"] = 'false';
		i.guid[""] = 'PID:' + p.pid;
		i.pubDate = d.toUTCString();
		rss.channel.item.push(i);		
	}
	
	feed.rss = rss;
	s = j2x.getXml(feed,'@','',2);
	
	res.set('Content-Type', 'text/xml');
	res.send(s);
}

app.get('/', function (req, res) {
	res.send('<html><head><title>Hello</title></head><body><h2>Hello World</h2></body></html>\n');
});

app.get('/rss/*', function (req, res) {
	//. http://expressjs.com/en/api.html#req
	//. http://expressjs.com/en/api.html#res
	
	// req.path (string)
	// req.query (object)

	var pe = req.path.split('/');
	var top = pe[2];
	var page = pe[3].split('.');
	var feed = page[0];
	
	var options = {
		host: bbc,
		port: 80,
		path: '/radio/programmes/genres/'+top+'/'+feed+'/player.json',
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	};
	
	console.log(options.path);
	
	getJSON(options,function(stateCode,obj) {
		if (stateCode == 200) {
			feed = top + '/' + feed;
			children(obj,res,finish,feed);
		}
		else {
			res.send('<html><head><title>BBC RSS</title></head><body><h2>Feed not found</h2></body></html>\n');
		}
	});

});

var myport = process.env.PORT || 3000;
if (process.argv.length>2) myport = process.argv[2];

var server = app.listen(myport, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});