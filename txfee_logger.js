const WebSocket = require('ws')
const ws = new WebSocket('wss://s1.ripple.com')

function send (r) {
}

ws.on('open', function open () {
  ws.send(JSON.stringify({ command: "subscribe", streams: [ 'transactions' ] }))
})

let txcount = 0
let totalfee = 0

ws.on('message', function incoming (data) {
  const r = JSON.parse(data)
  if (typeof r.transaction !== 'undefined') {
    txcount++
    totalfee += parseInt(r.transaction.Fee)
    console.log(txcount, r.transaction.Fee, totalfee, Math.round(totalfee / txcount))
  }
})
