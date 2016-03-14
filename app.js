var express = require('express');
var app = express();

//var client = require('redis').createClient(process.env.REDIS_URL);

var dictionary = {
  "blah": ["blub", "bubbeln"],
  "blah2": ["blub2", "bubbeln2"]
}

app.use(express.static(__dirname + '/public'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));

function withDictionary(cb) {
  if (dictionary) {
    cb(dictionary);
  } else {
    //TODO get dictionary from database
  }
}

app.get('/dictionary', function(req, res) {
  withDictionary(function(dictionary) {
    res.json(dictionary);
  });
});

app.push('/translation/:latin/:german', function(req, res) {
  const latin = req.params.latin,
    german = req.params.german;
  dictionary[latin] = german.split(",");
});



app.listen(process.env.PORT || 3000);
