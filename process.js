var fs = require('fs');
var util = require('util');

var s = fs.readFileSync('pub/index.html','utf8').split('\r').join('').split('\n');
var redirects = [];
var o = [];

for (var l of s) {
	if ((l.indexOf('/rss/radio/')>0) || (l.indexOf('/rss/tv/')>0)) {
		var c = l.split('"');
		var n = c[c.length-2];
		if ((n.indexOf('genre')>0) || (n.indexOf('format')>0)) {
			var g = n.split('/').pop().replace('.rss','');
			console.log(n+' '+g);
/*
/rss/both/upcoming/format/PT015.rss PT015
  /rss/tv/formats/talentshows.rss
*/
			var r = [];
			for (var i of c) {
			  if (i.indexOf('/rss/radio/')>=0) {
			  	console.log('  '+i);
				var redirect = {};
				redirect.from = i;
				if (n.indexOf('genre')>0) {
					i = '/rss/radio/available/genre/'+g+'.rss';
				}
				else {
					i = '/rss/radio/available/format/'+g+'.rss';
				}
				redirect.to = i;
				redirects.push(redirect);
			  }
			  if (i.indexOf('/rss/tv/')>=0) {
			  	console.log('  '+i);
				var redirect = {};
				redirect.from = i;
				if (n.indexOf('genre')>0) {
					i = '/rss/tv/available/genre/'+g+'.rss';
				}
				else {
					i = '/rss/tv/available/format/'+g+'.rss';
				}
				redirect.to = i;
				redirects.push(redirect);
			  }
			  r.push(i);
			}
			l = r.join('"');
		}
	}
	o.push(l);
}

fs.writeFileSync('pub/index.new',o.join('\n'),'utf8');
fs.writeFileSync('redirect.json',JSON.stringify(redirects,null,2),'utf8');
