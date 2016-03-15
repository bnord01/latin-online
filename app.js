'use strict';

const ENABLE_REMOVE = true;

var express = require('express');
var app = express();

var bodyParser = require('body-parser')
app.use(bodyParser.json());


var redis = require('redis');
var Promise = require("bluebird");
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

var client = redis.createClient(process.env.REDIS_URL || "redis://redis:6379");

var dictionary;

withDictionary(dic => console.log(dic));

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
                promises.push(client.smembersAsync("phrase-"+key).then(val => {
                    dictionary[key] = val;
                }))
            }
            Promise.all(promises).then(() => cb(dictionary))
        })
    }
}

app.get('/dictionary', function(req, res) {
    withDictionary(dic => {
        res.json(dic);
    });
});

app.get('/download',function(req,res) {
    withDictionary(dict => {
        //let buf = new Buffer(JSON.stringify(dict),"utf-8")
        res.set('Content-Disposition', 'attachment; filename="dictionary.json"')
        res.set('Content-Type', 'application/json')
        let replacer = app.get('json replacer');
        let body = JSON.stringify(dict, replacer, 2);
        res.send(body);
        //buf.pipe(res);
    })
});

app.post('/translation', function(req, res) {
    const latin = req.body.latin;
    const german = req.body.german.split(",").map(x => x.trim());
    withDictionary(dict => {
        if(!dict[latin]) {
            dict[latin] = german
            client.multi()
                .sadd("phrases",latin)
                .sadd("phrase-"+latin, german)
                .exec();
            res.end()
        } else {
            res.status(409).end()
        }
    })
});

app.post('/remove', function(req, res) {
    if(ENABLE_REMOVE) {
        const latin = req.body.latin;
        delete dictionary[latin];
        client.srem("phrases",latin)
        client.del("phrase-"+latin)
        res.end()
    } else {
        res.status(403).end()
    }
});


app.listen(process.env.PORT || 3000);
