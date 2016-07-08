var common = require('./common');

module.exports = {

	skyProxy : function(req,res) {
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
		s = req.path.replace('/sky','') + s;

		var options = {
			host: 'www.sky.com',
			port: 80,
			path: s,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			}
		};

		console.log(options.path);

		common.getJSON(options,function(stateCode,obj) {
			res.setHeader('Access-Control-Allow-Origin','*');
			if (stateCode == 200) {
				res.send(JSON.stringify(obj,null,2));
			}
			else {
				res.send('Request failed with statusCode; '+stateCode);
			}
		});
	}

};