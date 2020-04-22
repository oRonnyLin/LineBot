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

function calculateAverage (arr, field) {
  let count = 0
  const reducerFuncBase = (acu, cur) => {
    if (!isFinite(cur) || cur === undefined) {
      return acu
    } else {
      count++
      return acu + cur
    }
  }
  const result = arr.reduce((acu, cur) => { return reducerFuncBase(acu, cur[field]) }, 0) / count
  return result
}

function readCSVFile () {
  return new Promise((resolve, reject) => {
    let prevDataBC = null
    let prevDataCA = null
    const resultBC = []
    const resultCA = []
    fs.createReadStream('test.csv')
      .pipe(csv())
      .on('data', (data) => {
        const { pruid, date, prname, numconf, numprob, numtested, numrecover, percentrecover, numtoday, percentoday } = data
        if (pruid === '59' || pruid === '1') { // BC & Canada
          const curData = {
            date: date,
            name: prname,
            numconf: parseInt(numconf) + parseInt(numprob),
            numtested: parseInt(numtested),
            numrecover: parseInt(numrecover),
            percentrecover: parseFloat(percentrecover),
            numtoday: parseInt(numtoday),
            percentoday: parseInt(percentoday)
          }
          if (pruid === '59') {
            if (prevDataBC) {
              curData.newCasesToday = curData.numconf - prevDataBC.numconf
              curData.newRecover = curData.numrecover - prevDataBC.numrecover
              curData.newTested = curData.numtested - prevDataBC.numtested
              curData.percentCase = ((curData.newCasesToday / prevDataBC.numconf) * 100)
              curData.percentRec = ((curData.newRecover / prevDataBC.numrecover) * 100)
              curData.positiveRate = ((curData.newCasesToday / curData.newTested) * 100)
            }
            prevDataBC = curData
            resultBC.push(curData)
          } else if (pruid === '1') {
            if (prevDataCA) {
              curData.newCasesToday = curData.numconf - prevDataCA.numconf
              curData.newRecover = curData.numrecover - prevDataCA.numrecover
              curData.newTested = curData.numtested - prevDataCA.numtested
              curData.percentCase = ((curData.newCasesToday / prevDataCA.numconf) * 100)
              curData.percentRec = ((curData.newRecover / prevDataCA.numrecover) * 100)
              curData.positiveRate = ((curData.newCasesToday / curData.newTested) * 100)
            }
            prevDataCA = curData
            resultCA.push(curData)
          }
        }
      })
      .on('end', () => {
        const data = {
          bc: resultBC[resultBC.length - 1],
          ca: resultCA[resultCA.length - 1]
        }
        // data.bc.avgDailyCases = calculateAverage(resultBC, 'newCasesToday')
        // data.bc.avgDailyRecover = calculateAverage(resultBC, 'newRecover')
        // data.bc.avgTested = calculateAverage(resultBC, 'newTested')
        // data.bc.avgDailyCasePercent = calculateAverage(resultBC, 'percentCase')
        // data.bc.avgDailyRecPercent = calculateAverage(resultBC, 'percentRec')
        data.bc.avgPosRate = calculateAverage(resultBC, 'positiveRate')
        data.bc.avgDailyCaseIncasePercent = calculateAverage(resultBC, 'percentCase')
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
        const content = [
          `🚑${data.bc.newCasesToday} 🧬${data.bc.newTested} 💚${data.bc.newRecover}`,
          `恢復率: ${data.bc.percentrecover.toFixed(2)} %`,
          `當日確診率: ${data.bc.positiveRate.toFixed(2)} %`,
          `確診率平均: ${data.bc.avgPosRate.toFixed(2)} %`,
          `確診量增長百分比: ${data.bc.avgDailyCaseIncasePercent.toFixed(2)} %`
        ]
        message.text = content.join('\n')
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
