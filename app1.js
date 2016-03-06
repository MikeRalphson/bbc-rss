var express = require('express');
var app = express();

app.get('/arse', function (req, res) {
  res.send('<html><head><title>Hello</title></head><body><h2>Hello World</h2></body></html>\n');
});

var myport = 8080;
if (process.argv.length>2) myport = process.argv[2];

var server = app.listen(myport, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});