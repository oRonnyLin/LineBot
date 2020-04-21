const express = require('express')
const fs = require('fs')
const https = require('https')
const line = require('@line/bot-sdk')

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
}

const client = new line.Client(config)

const httpsApp = express()
// const httpsRouter = express.Router()

// httpsRouter.post('/', function (req, res) {
//   console.log('verify line webhook called')
//   res.status(200).send('Verification endpoint status 200')
// })
// httpsRouter.get('/test', async function (req, res) {
//   console.log('test line webhook called')
//   const responseBody = {
//     data: 'cool'
//   }
//   return res.json(responseBody)
// })
httpsApp.use(line.middleware(config))

httpsApp.post('/line', (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err)
      res.status(500).end()
    })
})

function getProfileName (event) {
  return new Promise((resolve, reject) => {
    if (event.source.type !== 'user') return resolve(null)
    client.getProfile(event.source.userId)
      .then((profile) => {
        console.log(profile.displayName)
        resolve(profile.displayName)
      })
      .catch((err) => {
        reject(new Error('something went wrong when calling getProfile ', err))
      })
  })
}

async function asyncGetProfileName (event) {
  if (event.source.type !== 'user') return null
  const profile = await client.getProfile(event.source.userId)
  return profile.displayName
}

function handleEvent (event) {
  console.log('handle line event: ', event)

  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null)
  }

  asyncGetProfileName(event)
    .then((displayName) => {
      console.log(`${displayName} 說 ${event.message.text}`)

      const echo = { type: 'text', text: `${displayName} 說 ${event.message.text}` }
      return client.replyMessage(event.replyToken, echo)
    })
    .catch((err) => {
      console.log('Error in getProfile', err)
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '我在處理訊息時出了問題'
      })
    })

  // create a echoing text message

  // use reply API
}
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
