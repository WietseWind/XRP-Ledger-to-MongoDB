const fileSystem = require('fs')
const JSONStream = require('JSONStream')
const WebSocket = require('ws')
// const ws = new WebSocket('wss://rippled.xrptipbot.com')
const ws = new WebSocket('ws://127.0.0.1')
const MongoClient = require('mongodb').MongoClient

setTimeout(function () {
  // Kill after 20 minutes on hang
  process.exit(1) 
}, 60 * 1000 * 20)

var db = null
var mongo = null
var collection = null
MongoClient.connect('mongodb://127.0.0.1:27017', function(err, client) {
  mongo = client
  console.log('Connected to MongoDB');
  db = client.db('ripple')
  collection = db.collection('escrow')
})

var ledger = null
var calls = 0
var records = 0
var lastMarker = ''

var filename = 'escrow_data.json'
const type = 'escrow'

var transformStream = JSONStream.stringify('[', ', ', ']') // '[\n', ',\n', '\n]\n' // false
var outputStream = fileSystem.createWriteStream(__dirname + "/" + filename)
transformStream.pipe(outputStream)
outputStream.on(
  "finish",
  function handleFinish () {
    console.log('Done! wrote records:', records)
    collection.deleteMany({ '__lastLedger.seq' : { $ne: ledger.seq } })
    fileSystem.copyFileSync(__dirname + "/" + filename, "/var/www/html/download/" + (new Date().toISOString().replace(/[:-]/g, '').replace(/\..+/, '')) + "." + filename)
    mongo.close()
    process.exit(0)
  }
)

function send (r) {
  calls++
  ws.send(JSON.stringify(r))
}

ws.on('open', function open () {
  send({
    command: "server_info"
  })
})
 
ws.on('message', function incoming (data) {
  const r = JSON.parse(data)
  var req = {
    command: "ledger_data",
    ledger: '',
    type: type,
    limit: 100000
  }

  if (ledger === null) {
    ledger = r.result.info.validated_ledger
    req.ledger = ledger.hash
    console.log('Starting for ledger', ledger.seq, ledger.hash)
    send(req)
  } else {
    if (r.status && r.status === 'success' && r.type && r.type === 'response') {
      if (r.result.state !== null) {
        r.result.state.forEach((i) => {
          transformStream.write(i)
          collection.findAndModify({
            PreviousTxnID: i.PreviousTxnID
          }, [
            [ '_id', 'asc' ]
          ], {
            $set: Object.assign(i, { __lastUpdate: new Date(), __lastLedger: ledger, Amount: parseFloat ( parseInt(i.Amount) / 1000 / 1000 ) })
          }, {
            upsert: true
          }, function (err, result) {
            if (err) console.log(err)
            // Mongo done.
          })
          records++
        })
        console.log('#', r.result.state.length, records)
      }
      
      if (calls % 1000 === 0) {
        console.log('')
        console.log(' ++++++++ Calls:', calls)
        console.log('')
      }

      if (typeof r.result.marker === 'undefined' || r.result.marker === null || r.result.marker === lastMarker) {
        // No new marker
        console.log('')
        console.log('Done! Finishing write...')
        console.log('')

        transformStream.end()
      } else {
        // Continue 
        req.marker = r.result.marker
        lastMarker = req.marker
        send(req)  
      }
    } else {
      throw new Error('Non success / response')
    }
  }
})
