var sdk = require('bbcparse/nitroSdk.js');
var api = require('bbcparse/nitroApi/api.js');

var common = require('./common.js');
var twitterMap = require('./twittermap.js');

var host = 'programmes.api.bbc.com';
var key = process.env.nitrokey || 'key';

function saveNitroProgramme(payload,item) {
	if (item.item_type != 'episode') return;
    var prefix = (payload.prefix == 'available' ? '' : payload.prefix);
    if (prefix.startsWith('upcoming')) {
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
		}
	}

    var p = {};
    p.title = (prefix + ancestors + (item.title ? item.title : '') + ' ' + twitter + ' ' + suffix).trim();
    p.pid = item.pid;
    p.actual_start = item.updated_time;
	if (item.synopses) {
   		p.long_synopsis = item.synopses.long ? item.synopses.long : 
        item.synopses.medium ? item.synopses.medium : item.synopses.short;
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
        sdk.make_request(host,api.nitroProgrammes,key,newQuery,{},function(obj){
            processResults(payload,obj);
        },
        function(err){
            common.finish(payload);
        });
    }
    else {
        common.finish(payload);
    }
}

function programmesByCategory(req,res,format,availability,signed,audiodescribed) {
    var payload = {};
    payload.res = res;
    payload.finish = common.finish;
    payload.domain = req.params.domain; //original not modified
    payload.feed = req.params.feed;
    payload.results = [];
    payload.inFlight = 0;
 	payload.prefix = (availability == 'available' ? availability : 'upcoming');

    var query = sdk.newQuery();
    query.add(api.fProgrammesPageSize,30,true);
    query.add(api.mProgrammesAncestorTitles);
    query.add(api.mProgrammesAvailableVersions);
    query.add(api.fProgrammesAvailability,availability);
    query.add(api.mProgrammesAvailability);
    query.add(api.mProgrammesGenreGroupings);
    query.add(api.fProgrammesAvailabilityEntityTypeEpisode);
    query.add(api.xProgrammesEmbargoedInclude);
	if ((!signed) && (!audiodescribed)) {
		var feeds = req.params.feed.split(',');
		if (format) {
   		 	payload.prefix += 'fmt';
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

	if (signed) {
		query.add(api.fProgrammesSignedExclusive);
	}
	if (audiodescribed) {
		query.add(api.fProgrammesAudioDescribedTrue);
	}

	if (req.params.domain == 'tv') {
		query.add(api.fProgrammesMediaTypeAudioVideo);
	}
	else if (req.params.domain == 'radio') {
		query.add(api.fProgrammesMediaTypeAudio);
	}

    sdk.make_request(host,api.nitroProgrammes,key,query,{},function(obj){
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
