var botID = process.env.GROUPME_BOT_ID;
var HTTPS = require('https');

function sendGroupMeMessage(message) {
	options = {
		hostname: 'api.groupme.com',
		path: '/v3/bots/post',
		method: 'POST'
	};

	body = {
		"text" : message,
		"bot_id" : botID
	};

	//console.log('sending ' + message + ' to ' + botID);

	botReq = HTTPS.request(options, function(res) {
		if(res.statusCode == 202) {
			//neat
		} else {
			console.log('rejecting bad status code ' + res.statusCode);
		}
	});

	botReq.on('error', function(err) {
		console.log('error posting message '  + JSON.stringify(err));
	});
	botReq.on('timeout', function(err) {
		console.log('timeout posting message '  + JSON.stringify(err));
	});
	botReq.end(JSON.stringify(body));
}
