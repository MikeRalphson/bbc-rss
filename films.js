const nitro = require('bbcparse/nitroSdk.js');
const x2j = require('jgexml/xml2json.js');
const j2x = require('jgexml/json2xml.js');
const moment = require('moment-timezone');

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
	rss.channel.title = 'Film4 RSS programmes feed - '+category;
	rss.channel.link = 'http://bbc-rss.herokuapp.com/rss/film4/'+category+'.rss';
	rss.channel["atom:link"] = {};
	rss.channel["atom:link"]["@rel"] = 'self';
	rss.channel["atom:link"]["@href"] = rss.channel.link;
	rss.channel["atom:link"]["@type"] = 'application/rss+xml';
	rss.channel.description = 'Unofficial Film4 RSS feeds';
	rss.channel.webMaster = 'mike.ralphson@gmail.com (Mike Ralphson)';
	rss.channel.pubDate = new Date().toUTCString();
	rss.channel.generator = 'openSky by Mermade Software http://github.com/mermade/opensky';
	rss.channel.item = [];

    if (obj.channels && obj.channels.program) {
        for (let prog of obj.channels.program) {
            if ((prog.genre === "6") && (prog.subgenre === "8")) {

/*
{"eventid":"5660","channelid":"4044","date":"01\/02\/18","start":"1517496300000","dur":"6600","title":"The Day the Earth Stood Still","shortDesc":"(1951) Sci-fi classic starring Michael Rennie. An alien called Klaatu visits Earth to warn humans to stop warring or risk destroying the planet. But, inevitably, he's met with hostility.","genre":"6","subgenre":"8","edschoice":"false","parentalrating":{"k":"1","v":"U "},"widescreen":"","sound":{"k":"3","v":"Digital surround sound"},"remoteRecordable":"true","record":"1","scheduleStatus":"NOT_STARTED","blackout":"false","movielocator":"null"}
*/

		        var i = {};
		        i.title = prog.title;
                i.link = 'http://www.channel4.com/programmes/'+encodeURIComponent((prog.title.toLowerCase().split(' ').join('-')));
		        i.pubDate = new Date(new Number(prog.start)).toUTCString();
                let prefix = moment(i.pubDate).tz('Europe/London').format('ddd MMM Do HH:mm z ');
		        i.description = prefix+' on @Film4 '+prog.shortDesc;
		        i.category = 'audio_video';
		        i.guid = {};
		        i.guid["@isPermaLink"] = 'false';
		        i.guid[""] = 'SKYevent:' + prog.channelid+'/'+prog.eventid;
		        rss.channel.item.push(i);
            }
        }
    }
	feed.rss = rss;
	s = j2x.getXml(feed,'@','',2);

	res.set('Content-Type', 'text/xml');
	res.send(s);
}

module.exports = {

	getCategory : function (req,res) {
        let day = new Date();
        let dateStr = day.toISOString().slice(0, 16).split('-').join('').split(':').join('').replace('T','');

// http://epgservices.sky.com/tvlistings-proxy/TVListingsProxy/tvlistings.json?detail=2&dur=2880&time=201801311300&channels=4044
		var query = nitro.newQuery();
        query.add('detail',2);
        query.add('dur',2880);
        query.add('time',dateStr);
        query.add('channels',4044);
		var options = {};

		nitro.make_request('epgservices.sky.com','/tvlistings-proxy/TVListingsProxy/tvlistings.json','',query,options,function(obj){
            respond('scifi',obj,res);
		},function(stateCode,obj){
            respond('scifi',{},res);
		});

	}

};
