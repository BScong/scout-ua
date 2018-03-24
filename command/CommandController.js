var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());
var VerifyToken = require('../VerifyToken');
var read = require('readability-js');
var rp = require('request-promise');

var jwt = require('jsonwebtoken');
var config = require('../config');

const pocketRecOptions = {
  uri: 'https://getpocket.cdn.mozilla.net/v3/firefox/global-recs?'
      + 'count=3&version=3&consumer_key='
      + process.env.POCKET_KEY,
  method: 'GET'
};

const getOptions = {
  uri: 'https://getpocket.com/v3/get',
  method: 'POST',
  body: '',
  headers: {'Content-Type': 'application/json; charset=UTF-8',
            'X-Accept': 'application/json'}
};

const summaryLink = 'https://api.smmry.com?SM_API_KEY=' + 
  process.env.SM_API_KEY + '&SM_URL=';
console.log('SummaryLink Creation is: ' + summaryLink);
const summaryOptions = {
  uri: '',
  method: 'GET',
  body: '',
  headers: {'Content-Type': 'application/json; charset=UTF-8',
            'X-Accept': 'application/json'}
};

router.post('/intent', VerifyToken, function(req, res) {
    console.log(req.body.cmd);
    var token = req.headers['x-access-token'];
    if (!token) return res.status(401).send({ 
      auth: false, message: 'No token provided.' });
    
    jwt.verify(token, config.secret, function(err) {
      if (err) return res.status(500).send({
         auth: false, message: 'Failed to authenticate token.' });

      var command = req.body.cmd;
    
      res.setHeader('Content-Type', 'application/json');
      switch(command) {
      case 'GetPocketList':
        getOptions.body = JSON.stringify(getBody);
        rp(getOptions)
          .then(function(body) {
            var titles = '';
            var jsonBody = JSON.parse(body);
            if(jsonBody.status == '1') {
              console.log('Status is successful');    
              console.log('Length is: ' + jsonBody.list.length);
              Object.keys(jsonBody.list).forEach(key => {
                console.log(jsonBody.list[key].resolved_title);
                titles += jsonBody.list[key].resolved_title + '.  ';
              });

              res.status(200).send(JSON.stringify({ text: titles }));
            }
          })
          .catch(function(err) {
            res.status(404).send(JSON.stringify({ text: 'Wow.  Amazing.  ' }));
            console.log('Failed to get to pocket');
            console.log(err);
          });
        break;
      case 'ReadPocketArticle':
        var getBody = {
          'consumer_key': '75081-21a26943be96172d3714c290',
          'access_token': 'bc13dc5c-4dc3-0ca8-d826-41a852',
          'search': req.body.searchTerms
        };
        getOptions.body = JSON.stringify(getBody);
        rp(getOptions)
          .then(function(body) {
            var titles = '';
            var url = '';
            var jsonBody = JSON.parse(body);
            if(jsonBody.status == '1') {
              Object.keys(jsonBody.list).forEach(key => {
                console.log(jsonBody.list[key].resolved_title);
                titles = jsonBody.list[key].resolved_title + '.  ';
                url = jsonBody.list[key].given_url;
              });
              console.log('URL is:  ' + url);
    
              read(url, function(err, article) {
                var speechText = titles + article.content.text();
                console.log(speechText);
                res.status(200).send(JSON.stringify({ text: speechText }));
              });
            } else {
              console.log('Searching for the article failed to find a match');
              throw 'NoSearchMatch';
            }
          })
          .catch(reason => {
            console.log('caught an error: ', reason );
            let errSpeech = ''
            switch(reason) {
              case 'NoSearchMatch':
                errSpeech = 'Unable to find a matching article.' +
                  '  Try another phrase.';
                break;
              default:
                errSpeech = 'There was an error finding the article.'
                break;
            }
            res.status(404).send(JSON.stringify({ text: errSpeech }));
          });
        break;
      case 'SummarizePocketArticle':
        getOptions.body = JSON.stringify(getBody);
        rp(getOptions)
          .then(function(body) {
            var url = '';
            var jsonBody = JSON.parse(body);
            if(jsonBody.status == '1') {
              console.log('Length is: ' + jsonBody.list.length);
              Object.keys(jsonBody.list).forEach(key => {
                console.log(jsonBody.list[key].resolved_title);
                url = jsonBody.list[key].given_url;
              });
              // Format for the summarization engine and send
              summaryOptions.uri = summaryLink + url;
              return rp(summaryOptions);
            } else {
              console.log('Searching for the article failed to find a match');
              throw 'NoSearchMatch';
            }
        })
        .then(function(summaryBody) {
          console.log('Got the summary back from summary engine');
          let jsonBody = JSON.parse(summaryBody);
          let textToSpeak = 'Here is a summary of: ' + 
            jsonBody.sm_api_title + '.  ' +
            jsonBody.sm_api_content;
          console.log('Summary is:  ' + textToSpeak);
          res.status(200).send(JSON.stringify({ text: textToSpeak }));
        })
        .catch(reason => {
          console.log('caught an error: ', reason );
          let errSpeech = '';
          switch(reason) {
            case 'NoSearchMatch':
              errSpeech = 'Unable to find a matching article.  ' +
                'Try another phrase.';
              break;
            default:
              errSpeech = 'There was an error finding the article.';
              break;
          }
          res.status(404).send(JSON.stringify({ text: errSpeech }));
        });
    
        break;
      case 'ScoutHeadlines':
        console.log('Processing ScoutHeadlines: ' + process.env.POCKET_KEY);
        rp(pocketRecOptions)
          .then(function(body) {
            var jsonBody = JSON.parse(body);
            if(jsonBody.status == '1') {
              let summLoop = function() {
                let promiseArray = [];
                Object.keys(jsonBody.recommendations).forEach(key => {
                  summaryOptions.uri = summaryLink + 
                    jsonBody.recommendations[key].url;
                    console.log('Summary link is: ' + summaryLink);
                    console.log('Summary uri is: ' + summaryOptions.uri);
                  promiseArray.push(rp(summaryOptions)
                    .then(function(sumResults) {
                    return sumResults;
                  }));
                });
                return Promise.all(promiseArray);
              }
              
              let sumRes = summLoop();
              sumRes.then(function(sumVal) {
                let textResponse = '';
                sumVal.forEach(function(element) {
                  var sumBody = JSON.parse(element);
                  // Link up the response text for all summaries
                  textResponse += 'Here is a summary of: ' + 
                    sumBody.sm_api_title + '.  ' +
                    sumBody.sm_api_content;
                });
                res.status(200).send(JSON.stringify({ text: textResponse }));
              })
              .catch(function(err) {
                res.status(500).send(JSON.stringify({ text: 'Summary Engine error' }));
              });
            } else {
              throw 'NoSearchMatch';
            }
          })
          .catch(reason => {
            console.log('caught an error: ', reason );
            let errSpeech = ''
            switch(reason) {
              case 'NoSearchMatch':
                errSpeech = 'Unable to find a matching article.' +
                  '  Try another phrase.';
                break;
              default:
                errSpeech = 'There was an error finding the article.'
                break;
            }
            res.status(404).send(JSON.stringify({ text: errSpeech }));
          });
        break;
      default:
        break;
      }
    });
  });

  module.exports = router;