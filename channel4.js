var c4 = require('openc4/c4Api/c4Api.js');
var nitro = require('bbcparse/nitroSdk.js');
var x2j = require('jgexml/xml2json.js');
var j2x = require('jgexml/json2xml.js');

function toArray(o) {
	if (!Array.isArray(o)) {
		var a = [];
		if (typeof o != 'undefined') a.push(o);
		return a;
	}
	return o;
}

function respond(category,obj,res) {
	var feed = {};
	var rss = {};
	rss['@version'] = '2.0';
	rss["@xmlns:atom"] = 'http://www.w3.org/2005/Atom';
	rss.channel = {};
	rss.channel.title = 'Channel4 RSS programmes feed - '+category;
	rss.channel.link = 'http://bbc-rss.herokuapp.com/rss/channel4/'+category+'.rss';
	rss.channel["atom:link"] = {};
	rss.channel["atom:link"]["@rel"] = 'self';
	rss.channel["atom:link"]["@href"] = rss.channel.link;
	rss.channel["atom:link"]["@type"] = 'application/rss+xml';
	rss.channel.description = 'Unofficial Channel4/All4 RSS feeds';
	rss.channel.webMaster = 'mike.ralphson@gmail.com (Mike Ralphson)';
	rss.channel.pubDate = new Date().toUTCString();
	rss.channel.generator = 'openc4 by Mermade Software http://github.com/mermade/openc4';
	rss.channel.item = [];

	var e = obj.feed ? toArray(obj.feed.entry) : [];

	for (var j=0;j<e.length;j++) {
		var p = e[j];

		var d = new Date(p.updated);
		var title = p.title["#text"];

		var i = {};
		i.title = title;
		i.link = p.link[0]["@href"];
		i.description = p["dc:relation.ShortSynopsis"];
		i.category = 'audio_video';
		i.guid = {};
		i.guid["@isPermaLink"] = 'false';
		i.guid[""] = 'BSWT:' + p["dc:relation.BrandWebSafeTitle"];
		i.pubDate = d.toUTCString();

		if (!i.description) {
			i.description = i.title;
		}

		if (p["media:content"] && p["media:content"]["media:thumbnail"]) {
			i.enclosure = {};
			i.enclosure["@url"] = p["media:content"]["media:thumbnail"]["@url"];
			i.enclosure["@length"] = 15026;
			i.enclosure["@type"] = 'image/jpeg';
		}

		rss.channel.item.push(i);
	}

	feed.rss = rss;
	s = j2x.getXml(feed,'@','',2);

	res.set('Content-Type', 'text/xml');
	res.send(s);
}

module.exports = {

	getCategory : function (req,res) {
		var query = nitro.newQuery();
		query.add(c4.commonPlatformC4,'',false);
        query.add('apikey',process.env.C4_API_KEY);

		var options = {};
		options.headers = {
			Accept: 'application/xml',
			'X-C4-API-Key': process.env.C4_API_KEY
		};
		//options.api_key_name = 'apikey';

		var cat = req.params.category;

		nitro.make_request('api.channel4.com',c4.getCategories4od(cat),'',query,options,function(obj){
			var json = x2j.xml2json(obj);
			respond(cat,json,res);
		},function(stateCode,obj){
			respond(cat,{},res);
		});

	}

};
