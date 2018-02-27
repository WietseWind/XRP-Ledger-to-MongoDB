const fileSystem = require('fs')
const JSONStream = require('JSONStream')
const WebSocket = require('ws')
const ws = new WebSocket('ws://127.0.0.1')
const MongoClient = require('mongodb').MongoClient
const express = require('express')
const decimals = 1000000
const max_processing_seconds = 5

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    next()
}

var app = express()
var bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(allowCrossDomain)

var port = process.env.PORT || 4000

var db = null
var mongo = null
var collection = null

var router = express.Router()
router.get('/', function(req, res) {
  res.json({ message: 'Hooray! welcome to our API!' })
})

app.use('/api', router)

router.route('/richlist').get(function(req, res) {
  var responseSent = false
  var requested = 0
  var responded = 0
  var response = {
    error: false,
    message: '',
    accounts: 0,
    datamoment: '',
    has: {
      has1000000000: null,
      has500000000: null,
      has100000000: null,
      has20000000: null,
      has10000000: null,
      has5000000: null,
      has1000000: null,
      has500000: null,
      has100000: null,
      has50000: null,
      has10000: null,
      has5000: null,
      has1000: null,
      has500: null
    },
    pct: {
      pct1: null,
      pct2: null,
      pct3: null,
      pct4: null,
      pct5: null,
      pct10: null
    }
  }
  var responseTimeout = setTimeout(() => {
    clearTimeout(responseTimeout)
    response.error = true
    response.message = 'Timeout'
    res.json(response)
  }, max_processing_seconds * 1000 * 5)

  var sendResponse = function () {
    if (!responseSent && requested === responded) {
      clearTimeout(responseTimeout)
      res.json(response)
    }
  }

  requested++
  collection.count({}, function(error, numOfDocs) {
    responded++
    response.accounts = numOfDocs

    Object.keys(response.pct).forEach((f) => {
        if (f.match(/^pct[0-9]+$/)) {
          var amount = parseInt(f.substring(3))
          var amountpct = Math.ceil(numOfDocs / 100 * amount)
          requested++
          collection.aggregate([
            { $sort: { Balance: -1 } },
            { $limit: amountpct },
            { $group: {
              _id: 1,
              minBalance: { $min: '$Balance' },
              minLastUpdate: { $max: '$__lastUpdate' }
            } }
          ]).toArray(function(error, d) {
            response.datamoment = d[0].minLastUpdate
            responded++
            response.pct[f] = d[0].minBalance
            sendResponse()
          })
          lastMax = amount
        }
      })
  })
  var lastMax = null
  Object.keys(response.has).forEach((f) => {
    if (f.match(/^has[0-9]+$/)) {
      var amount = parseInt(f.substring(3))
      var query = {
        Balance: { $gte: amount }
      }
      if (lastMax !== null) {
        query.Balance.$lt = lastMax
      }
      requested++
      collection.aggregate([
        { $match: query },
        { $group: {
          _id: 1,
          count: { $sum : 1 },
          balanceSum: { $sum : '$Balance' }
        } }
      ]).toArray(function(error, d) {
        responded++
        response.has[f] = {
          accounts: d[0].count,
          balanceSum: d[0].balanceSum,
        }
        sendResponse()
      })
      lastMax = amount
    }
  })
})

router.route('/richlist-index/:account/:ignoregt?').get(function(req, res) {
  var responseSent = false
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

  var countQuery = {}
  // if (req.params.ignoregt !== null && typeof req.params.ignoregt !== 'undefined' && req.params.ignoregt.match(/^[0-9]+$/)) {
  //   var ignoreGt = parseInt(req.params.ignoregt)
  //   countQuery.Balance = { $lt: ignoreGt }
  // }
  // console.log(countQuery)
  collection.count(countQuery, function(error, numOfDocs) {
    response.numAccounts = numOfDocs
    collection.find({ Account: req.params.account.trim() }, { Balance: true }).toArray(function (e, d) {
      if (e) {
        clearTimeout(responseTimeout)
        res.json({ error: true, message: 'Error', details: e })
      } else {
        if (d.length < 1) {
          clearTimeout(responseTimeout)
          res.json({ error: true, message: 'Cannot find account' })
        } else {
          response.account = d[0]
          var sendResponse = function () {
            if (!responseSent && response.lt.count !== null && response.gt.count !== null && response.eq.count !== null) {
              clearTimeout(responseTimeout)
              response.lt.percentage = Math.ceil(response.lt.count / response.numAccounts * decimals) / decimals
              response.gt.percentage = Math.ceil(response.gt.count / response.numAccounts * decimals) / decimals
              response.eq.percentage = Math.ceil(response.eq.count / response.numAccounts * decimals) / decimals
              res.json(response)
              responseSent = true
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

