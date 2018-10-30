const express = require('express')
const cors = require('cors')({ origin: true })
const apicache = require('apicache')
const fetch = require('node-fetch')

const app = express()
const cache = apicache.middleware

app.use(cors)

app.get('*', cache('6 hours'), async (req, res) => {
  const response = await fetch('https://cinemark-220917.appspot.com')
  const data = await response.json()

  res.send(data)
})

app.listen(process.env.PORT || 8080, err => {
  if (err) return console.error(err)
})
