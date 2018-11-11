const fetch = require('node-fetch')
const capitalize = require('lodash.capitalize')

const toTitleCase = string =>
  string
    .split(' ')
    .map(capitalize)
    .join(' ')

const fixName = name => {
  if (name === 'Hoyts Nuevocentro') return 'Hoyts Nuevo Centro'
  if (name === 'Cinemark Tortugas') return 'Cinemark Tortuguitas'
  if (name === 'Hoyts Moron') return 'Hoyts Morón'
  if (name === 'Cinemark Neuquen') return 'Cinemark Neuquén'

  return name
}

const getImdbInfo = async title => {
  const currentYear = new Date().getFullYear()

  const apiKey = '59d3174235953c532caf53f23c2d4c30'
  const baseUrl = 'https://api.themoviedb.org/3/search/movie'
  const options = `&page=1&include_adult=false&year=${currentYear}`

  const endpoint = `${baseUrl}?api_key=${apiKey}&query=${encodeURI(title)}${options}`

  const res = await fetch(endpoint)
  const data = await res.json()

  if (data.total_results === 0 || data.total_results > 1) return

  const [movie] = data.results

  const { title: name, vote_average: votes, poster_path: posterPath, original_language: originalLanguage } = movie

  const baseImageUrl = 'https://image.tmdb.org/t/p'
  const withWidth = width => `w${width}`

  const poster = `${baseImageUrl}/${withWidth(300)}/${posterPath}`

  const language = originalLanguage === 'en' ? 'en' : 'es'

  return { name, language, votes, poster }
}

module.exports = { toTitleCase, fixName, getImdbInfo }
