var url = require('url');
var ejs = require('ejs');
var cheerio = require('cheerio');
var common = require('./common');
var nitro = require('bbcparse/nitroSdk.js');
var api = require('bbcparse/nitroApi/api.js');

//http://www.developerdrive.com/2012/07/creating-a-slider-control-with-the-html5-range-input/

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
			var html = '<html><head><title></title>';
			html += '<link rel="stylesheet" href="/css/pure.css">';
			html += '</head><body>';
			html += '<h1>Programme Segment information</h1>';
			html += '<table border="1" class="pure-table pure-table-striped"><thead><tr><td>Artist</td><td>Performer</td><td>Track</td></tr></thead><tbody>';
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
			html += '</tbody></table></body></html>';
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

function getVersions(req,res,pid,raw) {
	var query = nitro.newQuery();
	query.add(api.fProgrammesPageSize,1,true)
		.add(api.mProgrammesAncestorTitles)
		.add(api.mProgrammesAvailableVersions)
		.add(api.fProgrammesPid,pid)
		.add(api.fProgrammesAvailabilityAvailable)
		.add(api.mProgrammesAvailability); // has a dependency on 'availability'

	var api_key = process.env.nitrokey || 'key';

	nitro.make_request('programmes.api.bbc.com',api.nitroProgrammes,api_key,query,{},function(obj){
		var s = '<html><head><title>PID Inspector</title>';
		s += '<link rel="stylesheet" href="/css/pure.css">';
		s += '</head><body>';

		if ((obj.nitro.results.items && obj.nitro.results.items.length == 1) && (!raw)) {
			var item = obj.nitro.results.items[0];
			var title = '';
			for (var t in item.ancestor_titles) {
				title += item.ancestor_titles[t].title + ' / ';
			}
			title += item.title;
			s += '<h1>'+title+'</h1>';
			s += '<table border="2" cellpadding="5" class="pure-table pure-table-striped"><thead><tr><td>Version</td><td>MediaSet Name</td><td>Information</td></tr></thead>';

			if (item.available_versions.version) {
				for (var v in item.available_versions.version) {
					var version = item.available_versions.version[v];
					var vpid = version.pid;
					var vtext = version.types.type[0];

					//console.log(vpid+' '+vtext);

					if (version.availabilities) {
						for (var a in version.availabilities.availability) {
							var avail = version.availabilities.availability[a];

							if (avail.media_sets) {
								for (var m in avail.media_sets.media_set) {
									var mediaset = avail.media_sets.media_set[m];

									var mstext = mediaset.name;
									//var link = 'http://open.live.bbc.co.uk/mediaselector/5/select/version/2.0/vpid/{vpid}/format/json/mediaset/{mediaSet}/proto/http';
									var link = '/msProxy/vpid/{vpid}/format/json/mediaset/{mediaSet}/proto/http';
									link = link.replace('{vpid}',vpid);
									link = link.replace('{mediaSet}',mstext);
									link = '<a href="'+link+'">MediaSelector</a>'

									if (avail.status != 'available') {
										link = avail.status;
									}

									s += '<tr><td>'+vpid+' '+vtext+'</td>';
									s += '<td>'+mstext+'</td>';
									s += '<td>'+link+'</td></tr>';
								}
							}

						}
					}

				}
			}

			s+= '</table>';
		}
		else {
			s += '<pre>';
			s += (JSON.stringify(obj.nitro.results,null,2));
			s += '</pre>';
		}
		s += '</body></html>';
		res.send(s);
		//console.log(JSON.stringify(obj,null,2));
	});
}

function clone(obj) {
	return JSON.parse(JSON.stringify(obj));
}

function processResponses(res,r,title) {
	var s = '<html><head><title>PID Inspector</title>';
	s += '<link rel="stylesheet" href="/css/pure.css">';
	s += '</head><body>';

	var seen = [];

	var out = [];

	s += '<h1>'+title+'</h1>';
	s += '<table border="2" cellpadding="5" class="pure-table pure-table-striped"><thead><tr><td>MediaSet Name</td>';
	s += '<td>Height</td>';
	s += '<td>Width</td>';
	s += '<td>BitRate</td>';
	s += '<td>Type</td>';
	s += '<td>Encoding</td>';
	s += '<td>Priority</td>';
	s += '<td>Size</td>';
	s += '<td>Link</td>';
	s += '</tr></thead>';

	for (var ms in r) {
		var mediaSet = r[ms];
		for (var m in mediaSet.media) {
			var media = mediaSet.media[m];
			for (var c in media.connection) {
				var conn = media.connection[c];

				var u = url.parse(conn.href);

				if (seen.indexOf(u.path) < 0) {
					seen.push(u.path);

					var flat = clone(media);
					delete flat.connection;

					flat = Object.assign({},flat,conn);
					flat.mediaSet = ms;

					out.push(flat);

					var size = 0;
					var suffix = '';
					if (flat.media_file_size) {
						size = flat.media_file_size;
						suffix = 'b';
						if (size>1024) {
							size = Math.floor(size/1024);
							suffix = 'Kb';
						}
						if (size>1024) {
							size = Math.floor(size/1024);
							suffix = 'Mb';
						}
						if (size>1024) {
							size = Math.floor(size/1024);
							suffix = 'Gb';
						}
					}

					s += '<tr><td>' + ms + '</td>';
					s += '<td>' + (flat.height ? flat.height : 'n/a') + '</td>';
					s += '<td>' + (flat.width ? flat.width : 'n/a') + '</td>';
					s += '<td>' + flat.bitrate + '</td>';
					s += '<td>' + flat.type + '</td>';
					s += '<td>' + flat.encoding + '</td>';
					s += '<td>' + flat.priority + '</td>';
					s += '<td>' + (size ? (size + suffix) : 'n/a') + '</td>';
					s += '<td><a href="' + flat.href + '">' + flat.protocol + '+' + flat.transferFormat + '://' + flat.supplier + '</a></td>';
					s += '</tr>';

				}

			}
		}
	}

	s += '</table>';

	s += '<pre>';
	s += JSON.stringify(out,null,2);
	s += '</pre></body></html>';
	res.send(s);
}

function analyseVersions(req,res,pid,raw) {
	var query = nitro.newQuery();
	query.add(api.fProgrammesPageSize,1,true)
		.add(api.mProgrammesAncestorTitles)
		.add(api.mProgrammesAvailableVersions)
		.add(api.fProgrammesPid,pid)
		.add(api.fProgrammesAvailabilityAvailable)
		.add(api.mProgrammesAvailability); // has a dependency on 'availability'

	var api_key = process.env.nitrokey || 'key';

	nitro.make_request('programmes.api.bbc.com',api.nitroProgrammes,api_key,query,{},function(obj){

		if (obj.nitro.results.items && obj.nitro.results.items.length == 1) {
			var item = obj.nitro.results.items[0];
			var title = '';
			for (var t in item.ancestor_titles) {
				title += item.ancestor_titles[t].title + ' / ';
			}
			title += item.title;

			var item = obj.nitro.results.items[0];
			var title = '';
			for (var t in item.ancestor_titles) {
				title += item.ancestor_titles[t].title + ' / ';
			}
			title += item.title;

			//s += '<h1>'+title+'</h1>';
			//s += '<table border="2" cellpadding="5" class="pure-table pure-table-striped"><thead><tr><td>Version</td><td>MediaSet Name</td><td>Information</td></tr></thead>';

			var responses = {};

			if (item.available_versions.version) {
				for (var v in item.available_versions.version) {
					var version = item.available_versions.version[v];
					var vpid = version.pid;
					var vtext = version.types.type[0];

					if ((vtext.toLowerCase() == 'original') && (version.availabilities)) {
						for (var a in version.availabilities.availability) {
							var avail = version.availabilities.availability[a];

							if ((avail.media_sets) && (avail.status == 'available')) {
								var depth = avail.media_sets.media_set.length;
								console.log(depth);
								for (var m in avail.media_sets.media_set) {
									var mediaset = avail.media_sets.media_set[m];

									var mstext = mediaset.name;

									var link = '/mediaselector/5/select/version/2.0/vpid/{vpid}/format/json/mediaset/{mediaSet}/proto/http';
									link = link.replace('{vpid}',vpid);
									link = link.replace('{mediaSet}',mstext);

									var settings = {};
									settings.payload = {};
									settings.payload.mediaSet = mstext;

									var query = nitro.newQuery();
									nitro.make_request('open.live.bbc.co.uk',link,'',query,settings,function(obj,payload){
										responses[payload.mediaSet] = obj;
										depth--;
										if ((depth<=0) || (nitro.getRequests()<=0)) {
											processResponses(res,responses,title);
										}
									},function(stateCode,err){
										depth--;
										if ((depth<=0) || (nitro.getRequests()<=0)) {
											processResponses(res,responses,title);
										}
									});

								}
							}

						}
					}

				}
			}

		}
		else {
			processResponses(res,obj.nitro.results);
		}
	});
}

function extractPids(req,res,urlObject,raw) {
	var options = {
		host: urlObject.host,
		port: urlObject.port,
		path: urlObject.path,
		method: 'GET',
		headers: {
			'Accept': 'text/html'
		}
	};
	var html = common.getHTML(options,function(stateCode,body){

		var s = '<html><head><title>PID breakdown</title>';
	    s += '<link rel="stylesheet" href="/css/pure.css">';
		s += '<link rel="stylesheet" type="text/css" href="/css/smart-green.css" media="screen">';

		s += '</head><body>';
		s += '<div class="smart-green">';
		s += '<h1>PID Breakdown</h1>';

		var $ = cheerio.load(body);

		var results = [];
		var log = '';

		$("script").each(function(i,e){
			var text = $(e).text();
			if (text.indexOf('{"meta":{')>=0) {
				var content = '{"meta":{'+text.split('{"meta":{')[1];
				//content = content.substr(0,content.length-3);
				content = content.replace('); });','');
				var obj = {};
				try {
					var obj = JSON.parse(content);
					if (obj.body.media.pid) {
						var result = {};
						result.title = obj.body.title;
						result.pid = obj.body.media.pid;
						result.url = 'http://www.bbc.co.uk/programmes/'+result.pid;
						result.vpid = 'n/a';
						result.image = obj.body.media.holdingImageUrl;
						result.duration = obj.body.media.duration;
						results.push(result);
					}
					for (var p in obj.body.promos) {
						var promo = obj.body.promos[p];
						var result = {};
						result.title = promo.title;
						result.url = 'http://www.bbc.co.uk'+promo.url;
						result.image = promo.image.href;
						result.pid = promo.asset.media.pid ? promo.asset.media.pid : 'n/a';
						result.vpid = 'n/a';
						result.duration = promo.asset.media.duration;
						results.push(result);
					}
				}
				catch (ex) {
				}

				//log += JSON.stringify(obj,null,2)+'\n';
				//log += text+'\n';
			}
		});

		$("figure").each(function (){
			var e = this;

			var playable = $(e).attr('data-playable');
			if (playable) {
				var opt = {};
				try {
					opt = JSON.parse(playable);
					var result = {};
					result.title = opt.settings.playlistObject.title;
					result.url = opt.settings.externalEmbedUrl;
					result.pid = opt.settings.statsObject.clipPID;
					result.vpid = opt.settings.playlistObject.items[0].vpid;
					result.image = opt.otherSettings.unProcessedImageUrl;
					if (!result.pid) {
						result.pid = '<a href="/pidlookup.html?vpid='+result.vpid+'">Needs lookup</a>';
					}
					results.push(result);
				}
				catch (e) {
					log += '\n'+e;
				}
				log += '<pre>'+JSON.stringify(opt,null,2)+'</pre>';
			}
		});

		/*
		<div class="video">
		<div class="emp" data-pid="p023317q" data-poster-template="http://ichef.bbci.co.uk/images/ic/$recipe/p0249p99.jpg" data-version-pid="p0233186" data-guidance=""><p class="emp__message--no-js">You need to have JavaScript enabled to view this video clip.</p></div>
		<p class="caption k-type-body-article">Bang Goes the Theory presenters Jem and Dallas use a 340m plastic tubing coiled to experience the speed of sound</p>
		</div>
		*/

		$("div .video").each(function (i,e){
			var div2 = $(e).children("div .emp").first();
			var result = {};
			result.duration = 'n/a';
			result.image = $(div2).attr('data-poster-template').replace('$recipe','640x360');
			result.pid = $(div2).attr('data-pid');
			result.vpid = $(div2).attr('data-version-pid');
			result.title = $(e).children("p").first().text();
			result.url = 'http://www.bbc.co.uk/programmes/'+result.pid;
			results.push(result);
		});

		s += '<table border="1" class="pure-table pure-table-striped"><thead><tr><td>Title</td><td>PID</td><td>VPID</td><td>Image</td>';
		s += '<td>Durn</td></tr></thead>';
		for (var r in results) {
			var result = results[r];
			s += '<tr><td><a href="'+result.url+'">'+result.title+'</a></td><td>'+result.pid+'</td><td>'+result.vpid+'</td>';
			s += '<td><a href="'+result.image+'">Image</a></td><td>'+result.duration+'</td></tr>';
		}
		s += '</table>';
		s += '</div>';

		if (log) {
			s += '<pre>'+log+'</pre>';
		}

		s += '</body></html>';

		res.send(s);
	});
}

module.exports = {

	processPid :  function(req,res) {
		result = false;
		var pid = req.query.txtPid;
		var link;

		if (pid) {
			var pids = pid.split('/');
			for (var p in pids) {
				if (pids[p].match('^([0-9,a-d,f-h,j-n,p-t,v-z]){8,}$')) {
					pid = pids[p];
					result = true;
				}
			}

			if ((!result) && ((typeof req.query.btnExtract !== 'undefined'))) {
				link = url.parse(pid);
				result = ((link.protocol == 'http:') || (link.protocol == 'https:'));
			}

			if (result) {
				var raw = (typeof req.query.raw !== 'undefined');
				console.log('Looking for pid '+pid+' raw:'+raw);
				if (typeof req.query.btnSegments !== 'undefined') {
					var segments = getSegments(req,res,pid);
				}
				else if (typeof req.query.btnVersions !== 'undefined') {
					var versions = getVersions(req,res,pid,raw);
				}
				else if (typeof req.query.btnAnalyse !== 'undefined') {
					var versions = analyseVersions(req,res,pid,raw);
				}
				else if (typeof req.query.btnExtract !== 'undefined') {
					var pids = extractPids(req,res,link,raw);
				}
				else {
					result = false;
				}
			}
		}
		return result;
	}

};