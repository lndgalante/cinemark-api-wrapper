const ms = require('ms');
const cors = require('cors');
const express = require('express');
const cacheManager = require('cache-manager');
const safeParse = require('safe-json-parse/tuple');
const ExpressCache = require('express-cache-middleware');

const dayjs = require('dayjs');
const fetch = require('node-fetch');
const flatten = require('lodash.flatten');

require('dayjs/locale/es');
dayjs.locale('es');

const { toTitleCase, fixName, fixFeatures, getImdbInfo, emojifier } = require('./utils');

const app = express();
const cacheMiddleware = new ExpressCache(
  cacheManager.caching({
    ttl: 3600,
    store: 'memory',
    max: ms('3 hours'),
  }),
);

cacheMiddleware.attach(app);
app.use(cors({ origin: 'https://estrenos.sh' }));

app.get('/cinemas', async (req, res) => {
  const response = await fetch('https://www.cinemarkhoyts.com.ar/billboard.ashx');
  const code = await response.text();
  const [err, json] = safeParse(code.slice(15, -1));

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
  }));

  res.send(data);
});

app.get('/movies', async (req, res) => {
  const response = await fetch('https://www.cinemarkhoyts.com.ar/billboard.ashx');
  const code = await response.text();
  const [err, json] = safeParse(code.slice(15, -1));

  // We do not include Special or Festival movies
  const premieres = json.Films.filter(
    ({ AttributeList: attributes }) =>
      !attributes.length || (attributes.includes(0) && !attributes.includes(2) && !attributes.includes(3)),
  );

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
        AttributeList,
      }) => {
        const data = {
          movieId: Id,
          name: toTitleCase(Name),
          minAge: Rating.split(' ')[0],
          description: Description,
          duration: `${Duration} minutos`,
          category: Category,
          emoji: emojifier(Category),
          isPremiere: AttributeList.includes(0),
          poster: URLPoster,
          youTubeId: URLTrailerYoutube.split('.be/')[1],
          inCinemas: CinemaList,
          cast: PersonList.reduce(
            (cast, { Type, Name }) => {
              if (Type === 'D') {
                cast.directors.push(Name);
                return cast;
              }
              if (Type === 'A') {
                cast.actors.push(Name);
                return cast;
              }
            },
            { directors: [], actors: [] },
          ),
        };

        try {
          const imdbInfo = await getImdbInfo(Name);
          return { ...data, ...imdbInfo };
        } catch (error) {
          return data;
        }
      },
    ),
  );

  const sortedByPremiere = data.sort((a, b) => b.isPremiere - a.isPremiere);

  res.send(sortedByPremiere);
});

app.get('/movie', async (req, res) => {
  const response = await fetch('https://www.cinemarkhoyts.com.ar/billboard.ashx');
  const code = await response.text();
  const [err, json] = safeParse(code.slice(15, -1));

  const { movieId, cinemaId } = req.query;

  const data = json.Films.filter(({ Id }) => Id === movieId).map(({ Name, MovieList }) => ({
    name: toTitleCase(Name),
    shows: MovieList.filter(({ CinemaList }) => CinemaList.some(({ Id }) => Id === Number(cinemaId))).map(
      ({ Format, Version, CinemaList }) =>
        CinemaList.filter(({ Id }) => Id === Number(cinemaId)).map(({ Id: cinemaId, SessionList }) =>
          SessionList.map(({ Id: sessionId, Feature: featureId, Dtm: timestamp }) => ({
            timestamp,
            date: dayjs(timestamp).format('dddd D [de] MMMM'),
            time: dayjs(timestamp).format('HH[:]mm'),
            link: `https://tickets.cinemarkhoyts.com.ar/NSTicketing/?CinemaId=${cinemaId}&SessionId=${sessionId}&FeatureId=${featureId}`,
            format: toTitleCase(Format)
              .split(' ')
              .map((value, index) => (index === 0 ? value.toUpperCase() : value))
              .join(' '),
            version: toTitleCase(Version),
          })),
        )[0],
    ),
  }))[0];

  const flattenData = {
    ...data,
    shows: flatten(data.shows).sort((a, b) => (dayjs(a.timestamp).isAfter(dayjs(b.timestamp)) ? 1 : -1)),
  };

  res.send(flattenData);
});

app.listen(process.env.PORT || 5050, (err) => {
  if (err) return console.error(err);
});
