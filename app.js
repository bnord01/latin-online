'use strict';
// Enable deletion of phrases
const ENABLE_REMOVE = true;
// List of levels available for phrases
const LEARN_LEVELS = [3, 14, 42];

var express = require('express');
var app = express();

var bodyParser = require('body-parser')
app.use(bodyParser.json());

var redis = require('redis');
var Promise = require("bluebird");
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

var client = redis.createClient(process.env.REDIS_URL || "redis://redis:6379");

var fs = require("fs")
var multer = require('multer')
var upload = multer({
	dest: 'uploads/'
})

var moment = require('moment');

var dictionary;
var learnset;

withDictionary(dic => console.log(`Loaded dictionary with ${Object.keys(dic).length} entries.`));

app.use(express.static(__dirname + '/public'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));

function withDictionary(cb) {
	if (dictionary) {
		cb(dictionary);
	} else {
		dictionary = {};
		client.smembersAsync("phrases").then(res => {
			let promises = [];
			for (let key of res) {
				promises.push(client.smembersAsync("phrase-" + key).then(val => {
					dictionary[key] = val;
				}))
			}
			Promise.all(promises).then(() => cb(dictionary))
		})
	}
}

function getKeys(match, all_keys, cursor) {
	all_keys = all_keys || []
	cursor = cursor || '0'
	return client.scanAsync(
		cursor,
		'match', match,
        'count', 100
	).then(res => {
		let next_cursor = res[0]
		let keys = res[1]
		// console.log(`Result for ${cursor}: next_cursor: ${next_cursor}, keys: ${keys.toString()}`)
		if (next_cursor === '0') {
			return all_keys.concat(keys)
		} else {
			return getKeys(match, all_keys.concat(keys), next_cursor);
		}
	})
}

app.get('/dictionary', function(req, res) {
	withDictionary(dic => {
		res.json(dic);
	});
});

app.get('/learnset', function(req, res) {
	getKeys('learnset:correct:*').then(correct => {
        console.log(`Correct keys: [${correct}]`)
		return client.sdiffAsync(['phrases'].concat(correct))
	}).then(learnset => {
        console.log(`Learnset size: ${learnset.length}`)
		res.json(learnset)
	})
})

app.get('/reset_learnset', function(req, res) {
	getKeys('learnset:*').then(keys => {
		console.log(`Keys to delete: ${keys.length}`)
		return client.delAsync(keys)
	}).then(del_res => {
		console.log(`Deletion result: ${del_res}`)
        withDictionary(dict =>{
            let mult = client.multi()
            for(let phrase in dict) {
                mult = mult.set(`learnset:level:${phrase}`,0)
            }
            mult.execAsync().then(ins_res => {
        		console.log(`Insertion result: ${ins_res}`);
        		res.end("Successfully deleted and recreated learnsets.")
        	})
        })
		//return client.sunionstoreAsync('learnset:level:' + LEARN_LEVELS[0], 'phrases')
	})
})

app.post('/correct',function(req,res){
    const phrase = req.body.phrase
    const day = moment().format('YYYYMMDD')
    client.getAsync(`learnset:level:${phrase}`).then(old_lvl => {
        let lvl = Math.min(old_lvl+1,LEARN_LEVELS.length - 1)
        console.log(`Updating level ${old_lvl} -> ${lvl} for "${phrase}"`)
        return client.multi()
            .sadd(`learnset:correct:${lvl}:${day}`,phrase)
            .expire(`learnset:correct:${lvl}:${day}`,LEARN_LEVELS[lvl]*3600*24)
            .set(`learnset:level:${phrase}`,lvl)
            .execAsync()
    }).then(r => {
        console.log(`Update learn level result: ${r}`)
        res.end("Successfully updated learn level")
    })
})

app.post('/incorrect',function(req,res){
    const phrase = req.body.phrase
    client.getAsync(`learnset:level:${phrase}`).then(old_lvl =>{
        let lvl = Math.max(old_lvl-1,0)
        console.log(`Updating level ${old_lvl} -> ${lvl} for "${phrase}"`)
        return client.setAsync(`learnset:level:${phrase}`,lvl)
    }).then(r => {
        console.log(`Update learn level result: ${r}`)
        res.end("Successfully updated learn level")
    })
})


app.get('/download', function(req, res) {
	withDictionary(dict => {
		res.set('Content-Disposition', 'attachment; filename="dictionary.json"')
		res.set('Content-Type', 'application/json')
		let replacer = app.get('json replacer');
		let body = JSON.stringify(dict, replacer, 2);
		res.send(body);
	})
});

app.post('/translation', function(req, res) {
	const latin = req.body.latin;
	const german = req.body.german.split(",").map(x => x.trim());
	withDictionary(dict => {
		if (!dict[latin]) {
			dict[latin] = german
			client.multi()
				.sadd("phrases", latin)
				.sadd("phrase-" + latin, german)
				.exec();
			res.end()
		} else {
			res.status(409).end()
		}
	})
});

app.post('/remove', function(req, res) {
	if (ENABLE_REMOVE) {
		const latin = req.body.latin;
		delete dictionary[latin];
		client.srem("phrases", latin)
		client.del("phrase-" + latin)
		res.end()
	} else {
		res.status(403).end()
	}
});

app.post('/upload', upload.single('dictionary'), function(req, res) {
	let result = JSON.parse(fs.readFileSync(req.file.path))
	withDictionary(dict => {
		for (let latin in result) {
			if (!dict[latin]) {
				dict[latin] = result[latin]
				client.multi()
					.sadd("phrases", latin)
					.sadd("phrase-" + latin, result[latin])
					.exec();
			}
		}
	})
	res.end()
});


app.listen(process.env.PORT || 3000);
