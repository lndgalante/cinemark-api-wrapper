const microCors = require('micro-cors')
const cache = require('micro-cacheable')
const fetch = require('node-fetch')

const cors = microCors()

module.exports = cache(
  6 * 60 * 60 * 1000,
  cors(async (req, res) => {
    const response = await fetch('https://cinemark-220917.appspot.com')
    const data = await response.json()

    return data
  })
)
