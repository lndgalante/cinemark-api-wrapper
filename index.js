const cache = require('micro-cacheable')
require('isomorphic-fetch')

module.exports = cache(6 * 60 * 60 * 1000, async (req, res) => {
  const response = await fetch('https://cinemark-220917.appspot.com')
  const data = await response.json()

  return data
})
