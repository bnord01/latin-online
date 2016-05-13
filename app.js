'use strict';
// Enable deletion of phrases
const ENABLE_REMOVE = true;
// List of levels available for phrases
const LEARN_LEVELS = [0, 1, 3, 7, 14, 28, 42];

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

var dictionary = client.smembersAsync("phrases").then(res => {
    let promises = []
    let dict = {}
    for (let key of res) {
        promises.push(client.smembersAsync("phrase-" + key).then(val => {
            dict[key] = val;
        }))
    }
    return Promise.all(promises).then(() => dict)
});


dictionary.then(dic => console.log(`Loaded dictionary with ${Object.keys(dic).length} entries.`));

app.use(express.static(__dirname + '/public'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));

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
    dictionary.then(dic => {
        console.log(`Sending dictionary with ${Object.keys(dic).length} keys.`)
        res.json(dic);
    });
});

app.get('/learnset', function(req, res) {
    getKeys('learnset:correct:*').then(correct => {
        console.log(`Correct keys: [${correct}]`)
        return client.sdiffAsync(['phrases'].concat(correct))
    }).then(learnset => {
        console.log(`Returning learnset of size: ${learnset.length}`)
        res.json(learnset)
    })
})

app.get('/reset_learnset', function(req, res) {
    getKeys('learnset:*').then(keys => {
        console.log(`Keys to delete: ${keys.length}`)
        return client.delAsync(keys)
    }).then(del_res => {
        console.log(`Deletion result: ${del_res}`)
        res.end("Successfully deleted learnsets.")
    })
})

app.post('/correct', function(req, res) {
    const phrase = req.body.phrase
    const day = moment().format('YYYYMMDD')
    client.getAsync(`learnset:level:${phrase}`).then(old_lvl => {
        old_lvl = parseInt(old_lvl) || 0
        let lvl = Math.min(old_lvl + 1, LEARN_LEVELS.length - 1)
        let expire = moment().startOf('day').add(3, 'hours').add(LEARN_LEVELS[lvl], 'days').unix()
        console.log(`Updating level ${old_lvl} -> ${lvl} for "${phrase}"`)
        return client.multi()
            .sadd(`learnset:correct:${lvl}:${day}`, phrase)
            .expireat(`learnset:correct:${lvl}:${day}`, expire)
            .set(`learnset:level:${phrase}`, lvl)
            .execAsync()
    }).then(r => {
        console.log(`Update learn level result: ${r} for "${phrase}"`)
        res.end("Successfully updated learn level")
    })
})

app.post('/incorrect', function(req, res) {
    const phrase = req.body.phrase
    client.getAsync(`learnset:level:${phrase}`).then(old_lvl => {
        old_lvl = parseInt(old_lvl) || 0
        let lvl = Math.max(old_lvl - 1, 0)
        console.log(`Updating level ${old_lvl} -> ${lvl} for "${phrase}"`)
        return client.setAsync(`learnset:level:${phrase}`, lvl)
    }).then(r => {
        console.log(`Update learn level result: ${r} for "${phrase}"`)
        res.end("Successfully updated learn level")
    })
})


app.get('/download', function(req, res) {
    dictionary.then(dict => {
        res.set('Content-Disposition', 'attachment; filename="dictionary.json"')
        res.set('Content-Type', 'application/json')
        let replacer = app.get('json replacer');
        let body = JSON.stringify(dict, replacer, 2);
        console.log(`Sending dictionary for download with ${Object.keys(dict).length} keys.`)
        res.send(body);
    })
});

app.post('/translation', function(req, res) {
    const latin = req.body.latin;
    const german = req.body.german.split(",").map(x => x.trim());
    dictionary.then(dict => {
        if (!dict[latin]) {
            console.log(`Adding translation ${latin} : [${german}]`)
            dict[latin] = german
            client.multi()
                .sadd("phrases", latin)
                .sadd("phrase-" + latin, german)
                .exec();
            res.end()
        } else {
            console.log(`Phrase ${latin} already existed, ignoring query.`)
            res.status(409).end()
        }
    })
});

app.post('/remove', function(req, res) {
    if (ENABLE_REMOVE) {
        const latin = req.body.latin;
        dictionary.then(dict => {
            delete dict[latin];
        })
        client.srem("phrases", latin)
        client.del("phrase-" + latin)
        console.log(`Removed phrase ${latin} from database.`)
        res.end()
    } else {
        console.log(`Didn't remove phrase ${latin} from database because ENABLE_REMOVE is not set.`)
        res.status(403).end()
    }
});

app.post('/upload', upload.single('dictionary'), function(req, res) {
    let result = JSON.parse(fs.readFileSync(req.file.path))
    dictionary.then(dict => {
        let count_add = 0;
        let count_ig = 0;
        for (let latin in result) {
            if (!dict[latin]) {
                count_add++
                dict[latin] = result[latin]
                client.multi()
                    .sadd("phrases", latin)
                    .sadd("phrase-" + latin, result[latin])
                    .exec();
            } else {
                count_ig++
            }
        }
        console.log(`Added ${count_add} entries to the dictionary, ${count_ig} duplicates ignored.`)
    }).then(() => res.redirect("/"))
});

app.get('/skipday', function(req, res) {
    getKeys('learnset:correct:*').then(correct => {
        console.log(`Keys to update ttl: [${correct}]`)
        return Promise.all(correct.map(key => {
            return client.ttlAsync(key).then(
                ttl => {
                    if (ttl > 0) {
                        console.log(`Updating ttl from ${ttl} to ${ttl+(24*3600)} for key ${key}.`)
                        return client.expireAsync(key, ttl + (24 * 3600))
                    } else {
                        console.log(`Non positive ttl ${ttl} for key ${key}`)
                        return -3
                    }
                }
            )
        }))
    }).then(result => {
        console.log(`Updated ${result.length} keys: [${result}]`)
        res.json(result)
    })
})

app.get('/learnstats', function(req, res) {
    getKeys('learnset:correct:*').then(correct => {
        console.log(`Keys in learnset for stats: [${correct}]`)
        return Promise.all(correct.map(key => client.multi().ttl(key).scard(key).execAsync().then(r => [key,r])))
    }).then(result => {
        console.log(`Stats result ${result.length}: [${result}]`)
        res.json(result)
    })
})

app.get('/fulldownload', function(req, res) {
    client.smembersAsync("phrases").then(res => {
        let promises = []
        let dict = {}
        for (let key of res) {
            promises.push(client.multi().get(`learnset:level:${phrase}`).smembers("phrase-" + key).execAsync().then(val => {
                dict[key] = val;
            }))
        }
        return Promise.all(promises).then(() => dict)
    }).then(dict => {
        res.set('Content-Disposition', 'attachment; filename="dictionary.json"')
        res.set('Content-Type', 'application/json')
        let replacer = app.get('json replacer');
        let body = JSON.stringify(dict, replacer, 2);
        console.log(`Sending dictionary for download with ${Object.keys(dict).length} keys.`)
        res.send(body);
    })
});

app.listen(process.env.PORT || 3000);
