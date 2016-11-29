var c4 = require('openc4/c4Api/c4Api.js');
var nitro = require('bbcparse/nitroSdk.js');
var j2x = require('jgexml/json2xml.js');

function respond(category,obj,res) {
	var feed = {};
	var rss = {};
	rss['@version'] = '2.0';
	rss["@xmlns:atom"] = 'http://www.w3.org/2005/Atom';
	rss.channel = {};
	rss.channel.title = 'ITV RSS programmes feed - '+category;
	rss.channel.link = 'http://bbc-rss.herokuapp.com/rss/itv/'+category+'.rss';
	rss.channel["atom:link"] = {};
	rss.channel["atom:link"]["@rel"] = 'self';
	rss.channel["atom:link"]["@href"] = rss.channel.link;
	rss.channel["atom:link"]["@type"] = 'application/rss+xml';
	rss.channel.description = 'Unofficial ITV Hub RSS feeds';
	rss.channel.webMaster = 'mike.ralphson@gmail.com (Mike Ralphson)';
	rss.channel.pubDate = new Date().toUTCString();
	rss.channel.generator = 'openItv by Mermade Software http://github.com/mermade/openItv';
	rss.channel.item = [];

	var e = obj._embedded.programmes;

	for (var j=0;j<e.length;j++) {
		var p = e[j];

		var d = new Date(p._embedded.latestProduction.broadcastDateTime.original);
		var title = p.title;
		var id = p.id;
		if (p._embedded.latestProduction.episodeTitle) {
			title += ' / '+p._embedded.latestProduction.episodeTitle;
			id = p._embedded.latestProduction.episodeId;
		}

		var i = {};
		i.title = title;
		i.link = 'http://www.itv.com/hub/x/'+id.split('/').join('a');
		i.description = p.synopses.epg;
		i.category = 'audio_video';
		i.guid = {};
		i.guid["@isPermaLink"] = 'false';
		i.guid[""] = 'ITVH:' + id;
		i.pubDate = d.toUTCString();

		if (!i.description) {
			i.description = p.synopses.ninety||i.title;
		}

		var imageUrl = p._embedded.latestProduction._links.image.href;
		// http://mercury.itv.com/samsung/production/image?q={quality}&format={image_format}&w={width}&h={height}&blur={blur}&bg={bg}&productionId=2%2F4776%2F0001%23001
		imageUrl = imageUrl.replace('{quality}','90');
		imageUrl = imageUrl.replace('{image_format}','jpg');
		imageUrl = imageUrl.replace('{width}','320');
		imageUrl = imageUrl.replace('{height}','180');
		imageUrl = imageUrl.replace('{blur}','0');
		imageUrl = imageUrl.replace('{bg}','0');
		
		i.enclosure = {};
		i.enclosure["@url"] = imageUrl;
		i.enclosure["@length"] = 15026;
		i.enclosure["@type"] = 'image/jpeg';

		rss.channel.item.push(i);
	}

	feed.rss = rss;
	s = j2x.getXml(feed,'@','',2);

	res.set('Content-Type', 'text/xml');
	res.send(s);
}

module.exports = {

	getCategory : function (req,res) {
		//http://discovery.hubsvc.itv.com/platform/itvonline/samsung/programmes?category=Comedy&broadcaster=itv		
		var cat = req.params.category;
		var query = nitro.newQuery();
		var safeCat = cat.split('+').join(' ');
		query.add('category',decodeURIComponent(safeCat),false);
		query.add('broadcaster','itv');

		var options = {};
		options.headers = {
			Accept: 'application/vnd.itv.hubsvc.programme.v3+hal+json; charset=UTF-8'
		};

		nitro.make_request('discovery.hubsvc.itv.com','/platform/itvonline/samsung/programmes','',query,options,function(obj){
			var json = {};
			try {
				json = JSON.parse(obj); // because of the non-standard Accept header
			}
			catch (ex) {
				console.log(ex.message);
			}
			respond(cat,json,res);
		},function(stateCode,obj){
			console.log('error '+stateCode);
			respond(cat,{},res);
		});

	}

};