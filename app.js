'use strict';
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

app.post('/translation', function(req, res) {
    const latin = req.body.latin;
    const german = req.body.german.split(",").map(x => x.trim());
    dictionary[latin] = german
    client.sadd("phrases",latin)
    client.sadd("phrase-"+latin, german)
    res.end()
});

app.post('/remove', function(req, res) {
    const latin = req.body.latin;
    delete dictionary[latin];
    client.srem("phrases",latin)
    client.del("phrase-"+latin)
    res.end()
});


app.listen(process.env.PORT || 3000);
