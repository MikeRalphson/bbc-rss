var sdk = require('bbcparse/nitroSdk.js');
var api = require('bbcparse/nitroApi/api.js');

var common = require('./common.js');

var host = 'programmes.api.bbc.com';
var key = process.env.nitrokey || 'key';

function saveNitroProgramme(payload,item) {
    var prefix = payload.prefix;
    if (prefix == 'upcoming') {
        prefix = 'Upcoming: ';
        if (item.availability && item.availability.version_types && item.availability.version_types.version_type) {
            if (item.availability.version_types.version_type.start) {
                var start = new Date(item.availability.version_types.version_type.start);
                prefix = start.toString().substr(0,21)+' ';
            }
        }

    }

    var twitter = '';
    if (item.master_brand.mid == 'bbc_radio_four_extra') twitter = ' @BBCRadio4Extra';
    if (item.master_brand.mid == 'bbc_radio_four') twitter = ' @BBCRadio4';

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

    var p = {};
    p.title = prefix + ancestors + (item.title ? item.title : '') + twitter;
    p.pid = item.pid;
    p.actual_start = item.updated_time;
    p.long_synopsis = item.synopses.long ? item.synopses.long : 
        item.synopses.medium ? item.synopses.medium : item.synopses.short;
    p.image = {};
    p.image.pid = item.images.image.href.split('=')[1];

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

function upcomingByCategory(req,res) {
    var payload = {};
    payload.res = res;
    payload.finish = common.finish;
    payload.domain = req.params.domain; //original not modified
    payload.prefix = 'upcoming';
    payload.feed = req.params.feed;
    payload.results = [];
    payload.inFlight = 0;

/*
programmes.api.bbc.com/nitro/api/programmes?K&page_size=30&mixin=contributions&mixin=duration&mixin=ancestor_titles&
mixin=available_versions&availability=P30D&mixin=availability&availability_entity_type=episode
&genre=C00035
*/
    var query = sdk.newQuery();
    query.add(api.fProgrammesPageSize,30,true);
    query.add(api.mProgrammesAncestorTitles);
    query.add(api.mProgrammesAvailableVersions);
    query.add(api.fProgrammesAvailability,'P30D');
    query.add(api.mProgrammesAvailability);
    query.add(api.fProgrammesAvailabilityEntityTypeEpisode);
    query.add(api.fProgrammesGenre,req.params.feed);
    query.add(api.mProgrammesImages);

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
    upcomingByCategory : upcomingByCategory
};