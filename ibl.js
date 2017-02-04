'use strict';

var http = require('http');
var common = require('./common.js');

// http://ibl.api.bbci.co.uk/ibl/v1/categories/CAT/programmes?rights=mobile&availability=available&api_key=APIKEY

function saveIblProgramme(payload, prog) {
    var p = {};
    p.title = prog.title + (prog.subtitle ? ' / ' + prog.subtitle : '');
    p.pid = prog.id;
    p.long_synopsis = prog.synopses.large ? prog.synopses.large : 
        prog.synopses.medium ? prog.synopses.medium : prog.synopses.small;
    p.media_type = 'audio_video';
    p.actual_start = prog.versions[0].availability.start;
    p.image = {};
    p.image.pid = prog.images.standard.replace('http://ichef.bbci.co.uk/images/ic/{recipe}/','').replace('.jpg','');
    payload.results.push(p);
}

function getCategory(req, res) {

    var basePath = '/ibl/v1/categories/'+req.params.category+'/programmes?rights=mobile&availability=available';

    var options = {};
    options.host = 'ibl.api.bbci.co.uk';
    options.path = basePath;

    common.getJSON(options, function(stateCode, obj) {
        if (stateCode == 200) {
			var payload = {};
			payload.res = res;
			payload.finish = common.finish;
			payload.domain = 'tv';
			payload.prefix = 'accessibility';
			payload.feed = req.params.category;
            payload.results = [];
            payload.inFlight = 0;

            var total = obj.category_programmes.count;
            var page = 1;
            var count = 0;
            for (var e in obj.category_programmes.elements) {
                count++;
                var element = obj.category_programmes.elements[e];
                if (element.type == 'programme_large') {
                    for (var c in element.initial_children) {
                        saveIblProgramme(payload, element.initial_children[c]);
                    }
                }
                else console.log(element.type);
            }
            while (count < total) {
                page++;
                count += obj.category_programmes.per_page;
                options.path = basePath+'&page='+page;
                payload.inFlight++;
                common.getJSON(options, function(stateCode, obj) {
                    payload.inFlight--;
                    if (stateCode == 200) {
                        for (var e in obj.category_programmes.elements) {
                            var element = obj.category_programmes.elements[e];
                            if (element.type == 'programme_large') {
                                for (var c in element.initial_children) {
                                    saveIblProgramme(payload, element.initial_children[c]);
                                }
                            }
                            else console.log(element.type);
                        }
                        if (payload.inFlight <= 0) common.finish(payload);
                    }
                });
            }
            if (payload.inFlight <= 0) common.finish(payload);
		}
		else {
			var data = {};
			data.stateCode = stateCode;
			res.render('fnf',data);
		}
    });

    common.updateHitCounter();

    return true;

}

module.exports = {

    getCategory : getCategory

};