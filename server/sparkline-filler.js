const fetch = require('node-fetch')
const MongoClient = require('mongodb').MongoClient

console.log('Connecting to mongo')

const ConnectDatabase = new Promise((resolve, reject) => {
  MongoClient.connect('mongodb://127.0.0.1:27017', (err, client) => {
    console.log('mongo connected')
    const db = client.db('ripple')
    const collection = db.collection('richstats')
    resolve({
      client,
      db,
      collection
    })
  })
})

const main = async () => {
  const mongo = await ConnectDatabase
  console.log('Fetching data')
  const richlist = await fetch('http://localhost:4000/api/richlist').then(async r => await r.json())
  const top100 = await fetch('http://localhost:4000/api/wallet-toplist/100/0').then(async r => await r.json())
  const output = {
    meta: {
      numberAccounts: richlist.accounts,
      ledgerClosedAt: new Date(richlist.datamoment),
      ledgerHash: '',
      ledgerIndex: 0,
      existingXRP: richlist.totalCoins / 1000000
    },
    top100Balance: top100.map(r => r.Balance).reduce((a, b) => a + b, 0),
    accountPercentageBalance: (await Promise.all(Object.keys(richlist.pct).map(async k => {
      const prevMax = richlist.pct[Object.keys(richlist.pct)[Object.keys(richlist.pct).indexOf(k) - 1]] || 999999999
      const numberAccounts = await fetch('http://localhost:4000/api/wallet-toplist/' + richlist.pct[k] + '/' + prevMax).then(async r => await r.json())
      return {
        percentage: Number(k.slice(3).replace(/p/, '.')),
        numberAccounts: numberAccounts.length,
        balanceEqGt: Math.round(richlist.pct[k])
      }
    }))).reduce((a, b) => {
      a.push(Object.assign(b, {
        numberAccounts: a.map(r => r.numberAccounts).reduce((c, d) => c + d, 0) + b.numberAccounts
      }))
      return a
    }, []),
    accountNumberBalanceRange: Object.keys(richlist.has).map(k => {
      return {
        numberAccounts: richlist.has[k].accounts,
        balanceFrom: Number(k.slice(3)),
        balanceTo: Number((Object.keys(richlist.has)[Object.keys(richlist.has).indexOf(k) - 1] || 'has999999999').slice(3)),
        balanceSum: richlist.has[k].balanceSum
      }
    })
  }
  console.log('Dataset ready, inserting to Mongo')
  mongo.collection.insertOne(output, (err, res) => {
    if (err) throw err
    console.log('Inserted document')
    mongo.client.close()
  })
  // console.log(richlist)
  // console.log(output)
}

main()
