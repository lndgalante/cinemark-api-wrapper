const express = require('express')
const cors = require('cors')({ origin: true })
const apicache = require('apicache')
const safeParse = require('safe-json-parse/tuple')

const fetch = require('node-fetch')
const dayjs = require('dayjs')

require('dayjs/locale/es')
dayjs.locale('es')

const { toTitleCase, fixName, fixFeatures, getImdbInfo } = require('./utils')

const app = express()
const cache = apicache.middleware

app.use(cors)

app.get('/cinemas', cache('24 hours'), async (req, res) => {
  const response = await fetch('https://www.cinemarkhoyts.com.ar/billboard.ashx')
  const code = await response.text()
  const [err, json] = safeParse(code.slice(15, -1))

  const data = json.Cinemas.map(({ Id, Name, Address, Features, decLatitude, decLongitude, URLGoogleMaps }) => ({
    cinemaId: Id,
    value: Name,
    label: fixName(Name),
    latitude: decLatitude,
    longitude: decLongitude,
    tags: [
      { tag: Address, link: URLGoogleMaps },
      { tag: fixFeatures(Features), link: 'https://www.cinemarkhoyts.com.ar/formatos' },
    ],
  }))

  res.send(data)
})

app.get('/movies', cache('3 hours'), async (req, res) => {
  const response = await fetch('https://www.cinemarkhoyts.com.ar/billboard.ashx')
  const code = await response.text()
  const [err, json] = safeParse(code.slice(15, -1))

  const premieres = json.Films.filter(
    ({ AttributeList: attributes }) => attributes.includes(0) && !attributes.includes(3)
  )

  const data = await Promise.all(
    premieres.map(
      async ({
        Id,
        Name,
        Rating,
        Description,
        Duration,
        Category,
        URLPoster,
        URLTrailerYoutube,
        PersonList,
        CinemaList,
      }) => {
        const data = {
          movieId: Id,
          language: 'es',
          name: toTitleCase(Name),
          minAge: Rating.split(' ')[0],
          description: Description,
          duration: `${Duration} minutos`,
          category: Category,
          poster: URLPoster,
          youTubeId: URLTrailerYoutube.split('.be/')[1],
          inCinemas: CinemaList,
          cast: PersonList.reduce(
            (cast, { Type, Name }) => {
              if (Type === 'D') {
                cast.directors.push(Name)
                return cast
              }
              if (Type === 'A') {
                cast.actors.push(Name)
                return cast
              }
            },
            { directors: [], actors: [] }
          ),
        }

        try {
          const imdbInfo = await getImdbInfo(Name)
          return { ...data, ...imdbInfo }
        } catch (error) {
          return data
        }
      }
    )
  )

  res.send(data)
})

app.get('/movie', cache('15 minutes'), async (req, res) => {
  const response = await fetch('https://www.cinemarkhoyts.com.ar/billboard.ashx')
  const code = await response.text()
  const [err, json] = safeParse(code.slice(15, -1))

  const { movieId, cinemaId } = req.query

  const data = json.Films.filter(({ Id }) => Id === movieId).map(({ Name, MovieList }) => ({
    name: toTitleCase(Name),
    shows: MovieList.filter(({ CinemaList }) => CinemaList.some(({ Id }) => Id === Number(cinemaId))).map(
      ({ Format, Version, CinemaList }) => ({
        format: toTitleCase(Format)
          .split(' ')
          .map((value, index) => (index === 0 ? value.toUpperCase() : value))
          .join(' '),
        version: toTitleCase(Version),
        cinemas: CinemaList.filter(({ Id }) => Id === Number(cinemaId)).map(({ Id: cinemaId, SessionList }) =>
          SessionList.map(({ Id: sessionId, Feature: featureId, Dtm }) => ({
            date: dayjs(Dtm).format('dddd D [de] MMMM'),
            time: dayjs(Dtm).format('HH[:]mm'),
            link: `https://tickets.cinemarkhoyts.com.ar/NSTicketing/?CinemaId=${cinemaId}&SessionId=${sessionId}&FeatureId=${featureId}`,
          }))
        )[0],
      })
    ),
  }))[0]

  res.send(data)
})

app.listen(process.env.PORT || 8080, err => {
  if (err) return console.error(err)
})
