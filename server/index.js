const fileSystem = require('fs')
const JSONStream = require('JSONStream')
const WebSocket = require('ws')
const ws = new WebSocket('ws://127.0.0.1')
const MongoClient = require('mongodb').MongoClient
const express = require('express')
const decimals = 1000000
const max_processing_seconds = 5

var app = express()
var bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

var port = process.env.PORT || 4000

var db = null
var mongo = null
var collection = null

var router = express.Router()
router.get('/', function(req, res) {
  res.json({ message: 'Hooray! welcome to our API!' })
})

app.use('/api', router)

router.route('/richlist-index/:account').get(function(req, res) {
  var response = {
    error: false,
    query: req.params.account,
    account: null,
    numAccounts: 0,
    lt: {
      count: null,
      percentage: 0
    },
    eq: {
      count: null,
      percentage: 0
    },
    gt: {
      count: null,
      percentage: 0
    }
  }

  var responseTimeout = setTimeout(() => {
    res.json({ error: true, message: 'Timeout' })
  }, max_processing_seconds * 1000)

  collection.count({}, function(error, numOfDocs) {
    response.numAccounts = numOfDocs
    collection.find({ Account: req.params.account.trim() }, { Balance: true }).toArray(function (e, d) {
      if (e) {
        res.json({ error: true, message: 'Error', details: e })
      } else {
        if (d.length < 1) {
          res.json({ error: true, message: 'Cannot find account' })
        } else {
          response.account = d[0]
          var sendResponse = function () {
            if (response.lt.count !== null && response.gt.count !== null && response.eq.count !== null) {
              clearTimeout(responseTimeout)
              response.lt.percentage = Math.ceil(response.lt.count / response.numAccounts * decimals) / decimals
              response.gt.percentage = Math.ceil(response.gt.count / response.numAccounts * decimals) / decimals
              response.eq.percentage = Math.ceil(response.eq.count / response.numAccounts * decimals) / decimals
              res.json(response)
            }
          }
          collection.find({ Balance: { $lt : d[0].Balance } }, { _id: false, Balance: true }, { Balance: -1 }).count(false, function(e, c) {
            response.lt.count = c
            sendResponse()
          })
          collection.find({ Balance: { $eq : d[0].Balance } }, { _id: false, Balance: true }, { Balance: -1 }).count(false, function(e, c) {
            response.eq.count = c
            sendResponse()
          })
          collection.find({ Balance: { $gt : d[0].Balance } }, { _id: false, Balance: true }, { Balance: -1 }).count(false, function(e, c) {
            response.gt.count = c
            sendResponse()
          })
        }
      }
    })
  })
})

MongoClient.connect('mongodb://127.0.0.1:27017', function(err, client) {
  mongo = client
  console.log('Connected to MongoDB');
  db = client.db('ripple')
  collection = db.collection('account')

  app.listen(port)
  console.log('API magic happens on port', port)
})

