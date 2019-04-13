const fileSystem = require('fs')
const JSONStream = require('JSONStream')
const WebSocket = require('ws')
const ws = new WebSocket('ws://127.0.0.1')
const MongoClient = require('mongodb').MongoClient
const express = require('express')
const fetch = require('node-fetch')
const decimals = 1000000
const max_processing_seconds = 60
let ledger = null

ws.on('message', function incoming (data) {
  const r = JSON.parse(data)
  if (typeof r === 'object' && typeof r.result === 'object' && typeof r.result.closed === 'object') {
    ledger = r
    console.log('WS Message # coins', ledger.result.closed.ledger.total_coins)
  } else {
    console.log('WS Message', r)
  }
})

ws.on('open', function () {
  console.log('WS Connected')
  setInterval(() => { 
    try {
      ws.send(JSON.stringify({ command: 'ledger', full: false, expand: false, transactions: false, accounts: false }))
    } catch (e) {
      console.log('WS error', e)
    }
  }, 10 * 1000)
})

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

router.route('/escrowlist').get(function(req, res) {
  db.collection('escrow').find({}).project({
    _id: false,
    Account: true,
    Amount: true,
    Destination: true,
    DestinationTag: true,
    FinishAfter: true,
    CancelAfter: true,
    Condition: true
  }).toArray((err, data) => {
    res.json(data)
  })
})

router.route('/prtg').get(function(req, res) {
    fetch('https://ledger.exposed/api/richlist').then((r) => {
        return r.json()
    }).then((r) => {
        let output = { prtg: { result: [] } }
        Object.keys(r.has).forEach((f) => {
            output.prtg.result.push({
              channel: "# Accounts @ " + (parseInt(f.substring(3)) / 1000) + 'k+',
              value: r.has[f].accounts,
              CustomUnit: '#'
            })
            output.prtg.result.push({
              channel: "Balance @ " + (parseInt(f.substring(3)) / 1000) + 'k+',
              value: Math.floor(r.has[f].balanceSum),
              CustomUnit: 'XRP'
            })
        })
        Object.keys(r.pct).forEach((f) => {
            if (f.match(/^pct[0-9]+$/)) {
                output.prtg.result.push({
                  channel: "XRP required for " + parseInt(f.substring(3)) + '%',
                  value: Math.ceil(r.pct[f]),
                  CustomUnit: 'XRP'
                })
            }
        })
        res.json(output)
    })
})

router.route('/wallet-toplist/:amount?/:skip?').get(function(req, res) {
  var amount = 0
  var skip = 0

  if (typeof req.params.amount !== 'undefined' && req.params.amount && req.params.amount !== null) {
    amount = parseInt(req.params.amount)
    if (isNaN(amount) || amount > 999 || amount < 1) {
      amount = 10
    }
  }

  if (typeof req.params.skip !== 'undefined' && req.params.skip && req.params.skip !== null) {
    skip = parseInt(req.params.skip)
    if (isNaN(skip) || skip > 999) {
      skip = 0
    }
  }

  collection.find({}).sort({
    Balance: -1
  }).project({
    _id: false,
    Balance: true,
    Account: true
  }).skip(skip).limit(amount).toArray((err, data) => {
    res.json(data)
  })
})

const richlistSpark = () => {
  let dt = new Date()
  dt.setTime(dt.getTime() - (3 * 28 * 24 * 60 * 60 * 1000)) // 3 months of 28 days
  return db.collection('richstats').aggregate([
    {
      $match: {
        'meta.ledgerClosedAt': { '$gte': dt }
      }
    },
    {
      $sort: {
        "meta.ledgerClosedAt": -1
      }
    },
    {
      $project: {
          index: "$meta.ledgerIndex",
          moment: "$meta.ledgerClosedAt",
          percentage: "$accountPercentageBalance"
      }
    },
    {
      $unwind: {
          path : "$percentage"
      }
    },
    {
      $project: {
          _id: false,
          index: true,
          moment: { $dateToString: {
            format: "%Y-%m-%d",
            date: "$moment",
            timezone: 'Europe/Amsterdam'
          } },
          percentage: "$percentage.percentage",
          accounts: "$percentage.numberAccounts",
          balanceEqGt: "$percentage.balanceEqGt"
      }
    },
    {
      $group: {
          _id: {
            date: "$moment",
            percentage: "$percentage"
          },
          index: { $max: "$index" },
          accounts: { $max: "$accounts" },
          balanceEqGt: { $min: "$balanceEqGt" }
      }
    },
    {
      $sort: {
          '_id.date': -1,
          '_id.percentage': 1
      }
    },
    {
      $group: {
        _id: "$_id.date",
        data: { $push: {
          index: "$index",
          balanceEqGt: "$balanceEqGt",
          percentage: "$_id.percentage",
          accounts: "$accounts"
        } }
      }
    }
  ]).sort({
    _id: 1
  })
}

router.route('/richlist-trend').get(function(req, res) {
  richlistSpark().toArray(function(error, d) {
    if (typeof d !== 'undefined' && d !== null && d.length > 0) {
      let results = {}
      d.forEach(i => {
        let r = i._id.replace(/-/g, '')
        results[r] = {}
        i.data.forEach(j => {
          results[r][parseFloat(j.percentage) * 100] = j
        })
      })
      res.json(results)
    } else {
      res.json([])
    }
  })
})

router.route('/richlist-spark').get(function(req, res) {
  richlistSpark().toArray(function(error, d) {
    if (typeof d !== 'undefined' && d !== null && d.length > 0) {
      let results = {}
      d[0].data.forEach(i => {
        let values = []
        d.forEach(r => {
          let record = r.data.filter(l => {
            return l.percentage === i.percentage
          })
          if (record.length > 0) {
            values.push({
              date: r._id,
              balanceEqGt: record[0].balanceEqGt,
              accounts: record[0].accounts,
            })
          }
        })
        results[parseFloat(i.percentage) * 100] = {
          date: values.map(r => { return r.date }),
          accounts: values.map(r => { return r.accounts }),
          balanceEqGt: values.map(r => { return r.balanceEqGt })
        }
      })
      res.json(results)
    } else {
      res.json([])
    }
  })
})

router.route('/richlist').get(function(req, res) {
  var responseSent = false
  var requested = 0
  var responded = 0
  var response = {
    error: false,
    message: '',
    accounts: 0,
    datamoment: '',
    totalCoins: parseInt(ledger.result.closed.ledger.total_coins),
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
      has75000: null,
      has50000: null,
      has25000: null,
      has10000: null,
      has5000: null,
      has1000: null,
      has500: null,
      has20: null,
      has0: null
    },
    pct: {
      pct0p01: null,
      pct0p1: null,
      pct0p2: null,
      pct0p5: null,
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
        if (f.match(/^pct[0-9p]+$/)) {
          var amount = parseFloat(f.substring(3).replace(/p/,'.'))
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
        Balance: { $gt: amount }
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
    sum: 0,
    accounts: [],
    numAccounts: 0,
    lt: {
      count: 0,
      percentage: 0,
      amount: 0,
      amountpct: 0,
    },
    eq: {
      count: 0,
      percentage: 0,
      amount: 0,
      amountpct: 0,
    },
    gt: {
      count: 0,
      percentage: 0,
      amount: 0,
      amountpct: 0,
    }
  }

  var responseTimeout = setTimeout(() => {
    res.json({ error: true, message: 'Timeout' })
  }, max_processing_seconds * 1000)

  var countQuery = {}
  collection.count(countQuery, function(error, numOfDocs) {
    response.numAccounts = numOfDocs
    collection.find({ Account: { $in: req.params.account.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ') } }).project({
      Account: true,
      Balance: true,
      __lastUpdate: true,
      Sequence: true
    }).toArray(function (e, d) {
      if (req.params.account.trim().match(/^[0-9]+$/)) {
        response.sum = parseInt(req.params.account)
      }
      if (e) {
        clearTimeout(responseTimeout)
        res.json({ error: true, message: 'Error', details: e })
      } else {
        if (d.length < 1 && response.sum === 0) {
          clearTimeout(responseTimeout)
          res.json({ error: true, message: 'Cannot find account' })
        } else {
          response.accounts = d
          var sendResponse = function () {
            console.log('SendResponse', response)
            if (!responseSent && (response.lt.count > 0 || response.gt.count > 0 || response.eq.count > 0)) {
              console.log(' -- Continue')
              clearTimeout(responseTimeout)
              response.lt.percentage = Math.ceil(response.lt.count / response.numAccounts * decimals) / decimals
              response.gt.percentage = Math.ceil(response.gt.count / response.numAccounts * decimals) / decimals
              response.eq.percentage = Math.ceil(response.eq.count / response.numAccounts * decimals) / decimals
              var amountSum = response.lt.amount + response.gt.amount + response.eq.amount
              response.lt.amountpct = Math.ceil(response.lt.amount / amountSum * decimals) / decimals
              response.gt.amountpct = Math.ceil(response.gt.amount / amountSum * decimals) / decimals
              response.eq.amountpct = Math.ceil(response.eq.amount / amountSum * decimals) / decimals
              res.json(response)
              responseSent = true
            }
          }
          if (response.sum === 0) {
            response.sum = response.accounts.map((a) => {
              return a.Balance
            }).reduce((a, b) => {
              return a + b
            }, 0)
          }

          collection.aggregate([
            { $sort: { Balance: -1 } },
            { $group: {
              _id: { $cond: { if: { $gte : [ "$Balance", response.sum ] }, then: { $cond: { if: { $eq : [ "$Balance", response.sum ] }, then: 'EQ', else: 'GT' } }, else: 'LT' } },
              amount: { $sum: '$Balance' },
              count: { $sum: 1 }
            } }
          ]).toArray(function(error, d) {
            d.forEach((ar) => {
              response[ar._id.toLowerCase()].count = ar.count
              response[ar._id.toLowerCase()].amount = ar.amount
            })
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

