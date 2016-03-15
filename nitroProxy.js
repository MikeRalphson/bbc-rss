var common = require('./common');

module.exports = {
	
	nitroProxy : function(req,res) {
		var key = process.env.nitrokey || 'key';
		var s = req.path+'?api_key='+key;
		for (var q in req.query) {
			//console.log(req.query[q]);
			if (Array.isArray(req.query[q])) {
				for (var a=0;a<req.query[q].length;a++) {
					s += '&' + q + '=' + encodeURIComponent(req.query[q][a]);
				}
			}
			else {
				if (q != 'api_key') {
					s += '&' + q + '=' + encodeURIComponent(req.query[q]);
				}
			}
		}

		var options = {
			host: 'programmes.api.bbc.com',
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
			if (stateCode == 200) {
				res.send(JSON.stringify(obj,null,2));
			}
			else {
				res.send('Request failed with statusCode; '+stateCode);
			}
		});
	}

};