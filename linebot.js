const express = require('express')
const fs = require('fs')
const https = require('https')
const line = require('@line/bot-sdk')
const bent = require('bent')
const getStreamProvincial = bent('https://health-infobase.canada.ca') // Provincial total confirmed/recovered/deaths
const getStreamRegional = bent('http://www.bccdc.ca')
const csv = require('csv-parser')
const stream = require('stream')

// fetch file at 11:30AM GMT everyday (4:30PM PST)
async function writeFileProvincial () {
  const csvfile = await getStreamProvincial('/src/data/covidLive/covid19.csv')
  const buffer = await csvfile.arrayBuffer()
  fs.writeFileSync('test.csv', buffer)
  console.log('wrote file')
}

function readCSVFile () {
  return new Promise((resolve, reject) => {
    const result = []
    fs.createReadStream('test.csv')
      .pipe(csv())
      .on('data', (data) => {
        const { pruid, date, prname, numconf, numtested, numrecover, percentrecover, numtoday, percentoday } = data
        if (pruid === '59' || pruid === '1') { // BC & Canada
          result.push({
            date: date,
            name: prname,
            numconf: parseInt(numconf),
            numtested: parseInt(numtested),
            numrecover: parseInt(numrecover),
            percentrecover: parseFloat(percentrecover),
            numtoday: parseInt(numtoday),
            percentoday: parseInt(percentoday)
          })
        }
      })
      .on('end', () => {
        const length = result.length
        const bcToday = result[length - 2]
        const bcYesterday = result[length - 4]
        const caToday = result[length - 1]
        const caYesterday = result[length - 3]
        const newCasesToday = bcToday.numconf - bcYesterday.numconf
        const newRecover = bcToday.numrecover - bcYesterday.numrecover
        const newTested = bcToday.numtested - bcYesterday.numtested
        const newCasesTodayca = caToday.numconf - caYesterday.numconf
        const newRecoverca = caToday.numrecover - caYesterday.numrecover
        const newTestedca = caToday.numtested - caYesterday.numtested
        const data = {
          bc: {
            newCaseToday: newCasesToday,
            percentIncreaseCase: ((newCasesToday / bcYesterday.numconf) * 100).toFixed(2),
            newRecover: newRecover,
            percentIncraseRec: ((newRecover / bcYesterday.numrecover) * 100).toFixed(2),
            numTested: newTested,
            positiveRate: ((newCasesToday / newTested) * 100).toFixed(2)
          },
          ca: {
            newCaseToday: newCasesTodayca,
            percentIncreaseCase: ((newCasesTodayca / caYesterday.numconf) * 100).toFixed(2),
            newRecover: newRecoverca,
            percentIncraseRec: ((newRecoverca / caYesterday.numrecover) * 100).toFixed(2),
            numTested: newTestedca,
            positiveRate: ((newCasesTodayca / newTestedca) * 100).toFixed(2)
          }
        }
        resolve(data)
      })
  })
}

async function asyncGetProfileName (event) {
  if (event.source.type !== 'user') return null
  const profile = await client.getProfile(event.source.userId)
  return profile.displayName
}

async function asyncHandleEvent (event) {
  console.log('handle line event: ', event)
  if (event.type !== 'message' || event.message.type !== 'text') return null
  try {
    const displayName = await asyncGetProfileName(event)
    console.log(`${displayName} 說 ${event.message.text}`)
    if (displayName === 'Ronny Lin') {
      const message = {
        type: 'text'
      }
      if (event.message.text === 'write') {
        console.log('fetching and writing csv')
        await writeFileProvincial()
        message.text = 'Done writing'
      } else if (event.message.text === 'covid19') {
        console.log('returning covid19 data')
        const data = await readCSVFile()
        message.text = `Data: ${data}`
      }
      return client.replyMessage(event.replyToken, message)
    }
  } catch (error) {
    console.log('Error in getProfile', error)
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '我在處理訊息時出了問題'
    })
  }
}

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
}
const client = new line.Client(config)
const httpsApp = express()
httpsApp.use(line.middleware(config))

httpsApp.post('/line', (req, res) => {
  Promise
    .all(req.body.events.map(asyncHandleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err)
      res.status(500).end()
    })
})

httpsApp.use((err, req, res, next) => {
  if (err instanceof line.SignatureValidationFailed) {
    res.status(401).send(err.signature)
    return
  } else if (err instanceof line.JSONParseError) {
    res.status(400).send(err.raw)
    return
  }
  next(err) // will throw default 500
})

const optionshttps = {
  key: fs.readFileSync('/home/ubuntu/ssl/private.key', 'utf8'),
  cert: fs.readFileSync('/home/ubuntu/ssl/certificate.crt', 'utf8'),
  ca: fs.readFileSync('/home/ubuntu/ssl/ca_bundle.crt', 'utf8')
}
https.createServer(optionshttps, httpsApp).listen(443, () => console.log('https server ready at 443!'))
