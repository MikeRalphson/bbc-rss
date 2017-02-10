var sdk = require('bbcparse/nitroSdk.js');
var api = require('bbcparse/nitroApi/api.js');

var common = require('./common.js');
var twitterMap = require('./twittermap.js');

var host = 'programmes.api.bbc.com';
var apikey = process.env.nitrokey || 'key';

function pubDate(item) {
	var result = item.updated_time;
	if (item.availability && item.availability.version_types &&
		item.availability.version_types.version_type) {
		result = item.availability.version_types.version_type.start;
	}
	return result;
}

function cacheKey(payload) {
	return payload.domain+'/'+payload.prefix+'/'+payload.feed;
}

function saveNitroProgramme(payload,item) {
	if (item.item_type != 'episode') return;
	if ((payload.timeStamp - new Date(pubDate(item))) > payload.options.limit) return;

    var prefix = (payload.prefix == 'available' ? '' : payload.prefix);
    if (prefix == 'upcoming') {
        prefix = 'Upcoming: ';
        if (item.availability && item.availability.version_types && item.availability.version_types.version_type) {
            if (item.availability.version_types.version_type.start) {
                var start = new Date(item.availability.version_types.version_type.start);
				var offset = 0;
				if (item.version && item.version.duration) {
					offset = sdk.iso8601durationToSeconds(item.version.duration);
				}
				if ((offset == 0) && item.available_versions && item.available_versions.version) {
					for (var v of item.available_versions.version) {
						if (offset == 0) offset = sdk.iso8601durationToSeconds(v.duration);
					}
				}
				if (offset > 0) {
					start = new Date(start - (offset * 1000)); // to msec
				}
                prefix = start.toString().substr(0,21)+' ';
            }
        }

    }

    var twitter = twitterMap.midToTwitter(item.master_brand.mid);

    var ancestors = '';
    if (item.ancestor_titles) {
        for (var a of item.ancestor_titles) {
            ancestors += (ancestors ? ': ' : '') + a.title;
        }
    }
    if (item.presentation_title && item.presentation_title.startsWith('Episode')) {
        ancestors += ' ('+item.presentation_title+')';
    }
    if (ancestors) ancestors += ' ';

	var suffix = '';
	if (item.genre_groupings && item.genre_groupings.genre_group) {
		for (var genre of item.genre_groupings.genre_group) {
			if (genre.id == 'C00035') suffix = '#scifi';
			if (genre.id == 'C00025') suffix = '#horror';
			if (genre.id == 'C00032') suffix = '#psych';
			if ((genre.id == 'C00193') || (genre.id == 'C00196')) suffix = '#comedy';
		}
	}

    var p = {};
    p.title = (prefix + ancestors + (item.title ? item.title : '') + ' ' + twitter + ' ' + suffix).trim();
    p.pid = item.pid;
    p.actual_start = pubDate(item);
	if (item.synopses) {
		if (payload.options.short) {
			if (p.title.toLowerCase().indexOf('podcast')>=0) return;
			p.long_synopsis = item.synopses.short;
		}
		else {
   			p.long_synopsis = item.synopses.long ? item.synopses.long :
        		item.synopses.medium ? item.synopses.medium : item.synopses.short;
		}
	}
    p.image = {};
    p.image.pid = item.images.image.href.split('=')[1];
	p.media_type = item.media_type;

    payload.results.push(p);
}

function processResults(payload,obj) {
    if (obj.nitro && obj.nitro.results && obj.nitro.results.items) {
        for (var i of obj.nitro.results.items) {
            saveNitroProgramme(payload,i);
        }
    }
    if (obj.nitro && obj.nitro.pagination && obj.nitro.pagination.next) {
        var newQuery = sdk.queryFrom(obj.nitro.pagination.next.href,true);
        sdk.make_request(host,api.nitroProgrammes,apikey,newQuery,{},function(obj){
            processResults(payload,obj);
        },
        function(err){
            common.finish(payload);
        });
    }
    else {
		if (payload.options.cache) {
			var entry = {};
			entry.results = payload.results;
			entry.timeStamp = payload.timeStamp;
			var key = cacheKey(payload);
			if (!payload.options.cache[key]) {
				console.log('Caching '+entry.results.length+' items for '+key);
			}
			payload.options.cache[key] = entry;
		}
		else {
        	common.finish(payload);
		}
    }
}

function programmesByCategory(req,res,options) {

//params are:
// service: rss or cache
// domain: radio, tv or both
// mode: genre, format, env or pid
// category:string
//options are:
// mode: string, overrides req.params.mode
// availability: string

	if (!options.mode) options.mode = req.params.mode;
	if (!options.limit) options.limit = common.MONTH;

    var payload = {};
    payload.res = res;
    payload.finish = common.finish;
    payload.domain = req.params.domain; //original not modified
    payload.feed = req.params.category; // use from params once /progs goes away
	payload.params = req.params;
	payload.options = options;
    payload.results = [];
    payload.inFlight = 0;
 	payload.prefix = (options.availability == 'available' ? 'available' : 'upcoming');
 	payload.pidprefix = (options.availability == 'available' ? 'PID:' : 'uPID:');
	payload.xmlOffset = 1; // 1 character already sent
	payload.timeStamp = new Date();

	res.set('Content-Type', 'text/xml');
	res.write('<');

    var query = options.query || sdk.newQuery();
    query.add(api.fProgrammesPageSize,50,true);
    query.add(api.mProgrammesAncestorTitles);
    query.add(api.mProgrammesAvailableVersions);
    query.add(api.fProgrammesAvailability,options.availability);
    query.add(api.mProgrammesAvailability);
    query.add(api.mProgrammesGenreGroupings);
    query.add(api.fProgrammesAvailabilityEntityTypeEpisode);
    //query.add(api.xProgrammesEmbargoedInclude);

	if (options.mode != 'accessibility') {
		var feed = req.params.category;
		if (options.mode == 'env') {
			feed = process.env[feed] || '';
			//console.log(feed);
		}
		var feeds = feed.split(',');
		if ((options.mode == 'pid') || (options.mode == 'env')) {
			for (var feed of feeds) {
				//console.log(feed);
				query.add(api.fProgrammesDescendantsOf,feed);
			}
		}
		else if (options.mode == 'format') {
			for (var feed of feeds) {
    			query.add(api.fProgrammesFormat,feed);
			}
		}
		else {
			for (var feed of feeds) {
    			query.add(api.fProgrammesGenre,feed);
			}
		}
	}
    query.add(api.mProgrammesImages);
    query.add(api.mProgrammesDuration);

	if (req.params.category == 'signed') {
		query.add(api.fProgrammesSignedExclusive);
	}
	if (req.params.category == 'audiodescribed') {
		query.add(api.fProgrammesAudioDescribedTrue);
	}

	if (req.params.domain == 'tv') {
		query.add(api.fProgrammesMediaTypeAudioVideo);
	}
	else if (req.params.domain == 'radio') {
		query.add(api.fProgrammesMediaTypeAudio);
	}

	if (payload.options.cache) {
		var key = cacheKey(payload);
		if (payload.options.cache[key]) {
			payload.results = payload.options.cache[key].results;
		}
		common.finish(payload);
		payload.results = [];
	}

    sdk.make_request(host,api.nitroProgrammes,apikey,query,{},function(obj){
        processResults(payload,obj);
    },
    function(err){
        common.finish(payload);
    });

    common.updateHitCounter();

    return true;
}

module.exports = {
    programmesByCategory : programmesByCategory
};
