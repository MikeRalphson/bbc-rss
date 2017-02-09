var common = require('./common.js');

const bbc = 'www.bbc.co.uk';

function children(obj,payload) {
    var deferred = 0;
    payload.source = [];
    payload.results = [];
    if ((obj.category_slice) && (obj.category_slice.programmes)) {
        for (var i=0;i<obj.category_slice.programmes.length;i++) {
            var p = obj.category_slice.programmes[i];

            if ((p.type == 'episode') || (p.type == 'clip')) {
                payload.results.push(p);
                //if (payload.results.length == 1) {
                //  console.log(JSON.stringify(p,null,2));
                //}
            }
            else if ((p.type == 'brand') || (p.type == 'series')) {
                //console.log(JSON.stringify(p,null,2));
                deferred++;
                var job = {};
                job.done = false;
                job.pid = p.pid;
                payload.source.push(job);
                list(payload,p);
            }
        }
    }
    if (deferred<=0) {
        console.log('Empty or all episodes');
        common.finish(payload);
    }
    return payload.results;
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
	common.getJSON(options,function(stateCode,obj) {
		if (stateCode == 200) {
			//console.log(JSON.stringify(parent,null,2));
			//console.log(JSON.stringify(obj,null,2));
			for (var i in obj.children.programmes) {
				//process.stdout.write('.');
				var p = obj.children.programmes[i];
				p.ancestor = parent;
				if ((p.type == 'episode') || (p.type == 'clip')) {
					if (p.available_until) {
						//console.log(JSON.stringify(p,null,2));
						payload.results.push(p);
					}
				}
				else {
					// brand or series
					//console.log('Recursing to '+p.pid);
					//console.log(JSON.stringify(p,null,2));
					var job = {};
					job.pid = p.pid;
					job.done = false;
					payload.source.push(job);
					list(payload,p);
				}
			}
		}
		else {
			var ecc = (parent.expected_child_count ? parent.expected_child_count : 0);
			if (ecc>0) console.log('Inner '+parent.pid+' '+stateCode+' '+parent.title+' ecc: '+ecc);
		}
		common.clear(parent.pid,payload);
	});
}


function getProgrammes(req,res) {
	//. http://expressjs.com/en/api.html#req
	//. http://expressjs.com/en/api.html#res

	// req.path (string)
	// req.query (object)
	//console.log(req.path);
	//for (var h in req.headers) {
	//	console.log(h+': '+req.headers[h]);
	//}

	var domain = req.params.domain;
	var prefix = req.params.prefix;
	var feed = req.params.feed;

	if (domain == 'tv') {
		domain = '';
	}
	else {
		domain = '/radio';
	}
	var mode = '/genres';
	if (prefix == 'formats') {
		mode = '/formats';
		prefix = '';
	}

	if (feed == 'all') {
		feed = prefix;
		feed = '';
	}

	var options = {
		host: bbc,
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
			var data = {};
			data.stateCode = stateCode;
			res.render('fnf',data);
		}
	});

	common.updateHitCounter();
}

function getPid(req,res) {
	var payload = {};
	payload.res = res;
	payload.finish = common.finish;
	payload.domain = req.params.domain; //original not modified
	payload.prefix = 'pid';
	payload.feed = req.params.pid;
	payload.source = [];
	payload.results = [];
	var job = {};
	job.done = false;
	job.pid = req.params.pid;
	payload.source.push(job);
	var p = {};
	p.pid = req.params.pid;
	list(payload,p);
}

module.exports = {
	children : children,
	list : list,
	bbc : bbc,
	getProgrammes : getProgrammes,
	getPid : getPid
};

