const express = require('express')
const bodyParser = require('body-parser')
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
httpsApp.use(bodyParser.urlencoded({
  extended: true
}))
httpsApp.use(bodyParser.json())

httpsApp.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', true)
  next()
})
httpsApp.post('/line', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err)
      res.status(500).end()
    })
})

function handleEvent (event) {
  console.log(event)

  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null)
  }

  // create a echoing text message
  const echo = { type: 'text', text: event.message.text }

  // use reply API
  return client.replyMessage(event.replyToken, echo)
}
const optionshttps = {
  key: fs.readFileSync('/home/ubuntu/ssl/private.key', 'utf8'),
  cert: fs.readFileSync('/home/ubuntu/ssl/certificate.crt', 'utf8'),
  ca: fs.readFileSync('/home/ubuntu/ssl/ca_bundle.crt', 'utf8')
}
https.createServer(optionshttps, httpsApp).listen(443, () => console.log('https server ready at 443!'))
