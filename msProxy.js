var url = require('url');
var common = require('./common');

module.exports = {

	msProxy : function(req,res) {
		var s = '';
		for (var q in req.query) {
			if (Array.isArray(req.query[q])) {
				for (var a=0;a<req.query[q].length;a++) {
					s += (s ? '&' : '?') + q + '=' + encodeURIComponent(req.query[q][a]);
				}
			}
			else {
				if (q != 'api_key') {
					s += (s ? '&' : '?') + q + '=' + encodeURIComponent(req.query[q]);
				}
			}
		}
		s = req.path.replace('/msProxy','/mediaselector/5/select/version/2.0') + s;

		var options = {
			host: 'open.live.bbc.co.uk',
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
				s = '<html><head><title>MediaSelector</title></head><body>';

				s += '<pre>';
				delete obj.disclaimer;
				//s += JSON.stringify(obj,null,2);
				s += '</pre>';

				s += '<table border="2" cellpadding="5"><thead><tr>'
				s += '<td>Width</td>';
				s += '<td>Height</td>';
				s += '<td>Bitrate</td>';
				s += '<td>Format</td>';
				s += '<td>Encoding</td>';
				s += '<td>Size</td>';
				s += '<td>Priority</td>';
				s += '<td>Link</td>';
				s += '<td>Host</td>';
				s += '</tr></thead>';

				for (var m in obj.media) {
					var media = obj.media[m];
					var size = '';
					var suffix = '';
					if (media.media_file_size) {
						size = media.media_file_size;
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

					var rowPrefix = '<tr>';
					rowPrefix += '<td>'+(media.width ? media.width : 'n/a')+'</td>';
					rowPrefix += '<td>'+(media.height ? media.height : 'n/a')+'</td>';
					rowPrefix += '<td>'+(media.bitrate ? media.bitrate : 'n/a')+'</td>';
					rowPrefix += '<td>'+media.type+'</td>';
					rowPrefix += '<td>'+(media.encoding ? media.encoding : media.kind)+'</td>';
					rowPrefix += '<td>'+size+suffix+'</td>';

					for (var c in media.connection) {
						var row = rowPrefix;

						var conn = media.connection[c];

						row += '<td>'+conn.priority+'</td>';

						var u = url.parse(conn.href);

						row += '<td><a href="'+conn.href+'">'+conn.protocol+'/'+conn.transferFormat+'@'+conn.supplier+'</a></td>';
						row += '<td>'+u.host+'</td>';

						row += '</tr>';
						s += row;
					}

				}
				s += '</table>';

				s += '</body></html>';
				res.send(s);
			}
			else {
				res.send('Request failed with statusCode; '+stateCode);
			}
		});
	}

};