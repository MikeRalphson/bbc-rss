var common = require('./common');

function ss_child(payload,parent) {
	//. http://www.bbc.co.uk/programmes/b0557671.json
	var options = {
		host: 'www.bbc.co.uk',
		port: 80,
		path: '/programmes/'+parent.pid+'.json',
		method: 'GET',
		headers: {
			'Accept': 'application/json'
		}
	};
	common.getJSON(options,function(stateCode,obj) {
		if (stateCode == 200) {
			var p = obj.programme;
			if ((p.type == 'episode') || (p.type == 'clip')) {
				p.parent = parent;
				payload.results.push(p);
			}
			else {
				console.log('Recursing to '+p.pid);
				//var job = {};
				//job.pid = p.pid;
				//job.done = false;
				//payload.source.push(job);
				//common.list(payload,p);
			}
		}
		else {	
			console.log(options.host);
			console.log('Inner '+parent.pid+' '+stateCode);
		}
		common.clear(parent.pid,payload);
	});
}

function ss_children(obj,payload) {
	payload.source = [];
	payload.results = [];

	var any = false;

	var input = obj[1];

	for (var i=0;i<input.length;i++) {
		o = input[i];
		for (var j=0;j<o.tleo.length;j++) {
			p = o.tleo[j];
			if (p.pid && p.type) {
				any = true;
				console.log('Children: '+p.type+' '+p.pid);
				var job = {};
				job.done = false;
				job.pid = p.pid;
				payload.source.push(job);
				if ((p.type == 'episode') || (p.type == 'clip')) {
					ss_child(payload,p);
				}
				else if ((p.type == 'brand') || (p.type == 'series')) {
					payload.source.pop(); // as we're not doing this job currently
					//common.list(payload,p);
				}
			}
		}
	}
	if (!any) {
		common.finish(payload);
	}
	return payload.results;
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

module.exports = {

	searchSuggest : function(req,res) {
		var options = {
			host: 'search-suggest.api.bbci.co.uk',
			port: 80,
			path: '/search-suggest/suggest',
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			}
		};

		options.path += '?apikey='+process.env.searchsuggestkey || 'key';
		options.path += '&q='+encodeURIComponent(req.params.search);
		options.path += '&scope=all';
		options.path += '&format=bigscreen-2';
		//options.path += '&mediatype=audio';
		options.path += '&mediaset=pc';

		common.getJSON(options,function(stateCode,obj) {
			if (stateCode == 200) {
				var payload = {};
				payload.res = res;
				payload.finish = common.finish;
				payload.orgDomain = req.params.domain; //original not modified
				payload.domain = 'custom';
				payload.prefix = 'custom';
				payload.feed = req.params.search;
				payload.params = {};
				payload.options = {};
				ss_children(obj,payload);
			}
			else {
				var data = {};
				data.stateCode = stateCode;
				res.render('fnf',data);
			}
		});
	}

};
