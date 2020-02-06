var express = require('express');
const router = express.Router();
var app = express();
var path = require('path');

app.use(express.static(__dirname + '/public'));

app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
});

var server = app.listen(8080, function() {
	console.log('Web development server running publicly.  Connect to http://localhost:%d/', 8080);
});

app.get('/', function(req, res){
	console.log(path.join(__dirname, 'public/views/index.html'));
	 res.sendFile(path.join(__dirname, 'public/views/welcome.html'));
})
