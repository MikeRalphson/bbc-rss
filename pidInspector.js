var common = require('./common');

function getSegments(req,res,pid) {

	var s = '/programmes/'+pid+'/segments.json';

	console.log(s);

	var options = {
		host: 'www.bbc.co.uk',
		port: 80,
		path: s,
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		}
	};

	common.getJSON(options,function(stateCode,obj) {
		res.setHeader('Access-Control-Allow-Origin','*');
		if (stateCode == 200) {
			var html = '<html><head><title></title></head><body>';
			html += '<h1>Programme Segment information</h1>';
			html += '<table border="1"><thead><tr><td>Artist</td><td>Performer</td><td>Track</td></tr></thead>';
			for (var se in obj.segment_events) {
				var segment = obj.segment_events[se].segment;
				if (segment.artist && segment.track_title) {
					var gid = segment.primary_contributor ? segment.primary_contributor.musicbrainz_gid : '';
					if (gid) {
						segment.artist = '<a href="http://musicbrainz.org/artist/'+gid+'">'+segment.artist+'</a>';
					}
					var performer = segment.artist;
					if (segment.contributions) {
						performer = '<ul>';
						for (var c in segment.contributions) {
							var cont = segment.contributions[c];
							if (cont.role == 'Performer') {
								performer += '<li><a href="http://musicbrainz.org/artist/'+cont.musicbrainz_gid+'">'+cont.name+'</a></li>';
							}
						}
						performer += '</ul>';
					}
					if (segment.snippet_url) {
						segment.track_title = '<a href="'+segment.snippet_url+'">'+segment.track_title+'</a>';
					}
					html += '<tr><td>'+segment.artist+'</td><td>'+performer+'</td><td>'+segment.track_title+'</td></tr>';
				}
			}
			html += '</table></body></html>';
			res.send(html);
		}
		else if (stateCode == 404) {
			res.sendFile(__dirname+'/pub/pidNoData.html');
		}
		else {
			res.send('Request failed with statusCode; '+stateCode);
		}
	});

}

function getVersions(req,res,pid) {
	res.send('<html><head><title>Coming soon</title></head><body><h1>Coming soon</h1></body></html>');
}

module.exports = {

	processPid :  function(req,res) {
		result = false;
		var pid = req.query.txtPid;
		if (pid) {
			var pids = pid.split('/');
			for (var p in pids) {
				if (pids[p].match('^([0-9,a-d,f-h,j-n,p-t,v-z]){8,}$')) {
					pid = pids[p];
					result = true;
				}
			}
			if (result) {
				console.log('Looking for pid '+pid);
				if (typeof req.query.btnSegments !== 'undefined') {
					getSegments(req,res,pid);
				}
				else if (typeof req.query.btnVersions !== 'undefined') {
					getVersions(req,res,pid);
				}
				else {
					result = false;
				}
			}
		}
		return result;
	}

};