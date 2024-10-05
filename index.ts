import { Hono } from "hono";
import { cache } from "hono/cache";
import flatten from "lodash.flatten";
import safeJsonParse from "safe-json-parse/tuple";

import dayjs from "dayjs";
import "dayjs/locale/es";

// internals
import {
	toTitleCase,
	fixName,
	fixFeatures,
	getImdbInfo,
	emojifier,
} from "./utils";

// dayjs
dayjs.locale("es");

const app = new Hono();

app.use(
	"*",
	cache({
		cacheName: "cinemark-cache",
		cacheControl: "max-age=3600",
	}),
);

app.get("/cinemas", async (c) => {
	const response = await fetch(
		"https://www.cinemarkhoyts.com.ar/ws/Billboard_WWW_202410051054157566.js",
	);
	const code = await response.text();
	const [err, json] = safeJsonParse(code.slice(15, -1));

	if (err) {
		return c.json({ error: "Failed to parse JSON" }, 500);
	}

	const data = json.Cinemas.map(
		({
			Id,
			Name,
			Address,
			Features,
			decLatitude,
			decLongitude,
			URLGoogleMaps,
		}) => ({
			cinemaId: Id,
			value: Name,
			label: fixName(Name),
			latitude: decLatitude,
			longitude: decLongitude,
			tags: [
				{ tag: Address, link: URLGoogleMaps },
				{
					tag: fixFeatures(Features),
					link: "https://www.cinemarkhoyts.com.ar/formatos",
				},
			],
		}),
	);

	return c.json(data);
});

app.get("/movies", async (c) => {
	const response = await fetch(
		"https://www.cinemarkhoyts.com.ar/ws/Billboard_WWW_202410051054157566.js",
	);
	const code = await response.text();
	const [err, json] = safeJsonParse(code.slice(15, -1));

	if (err) {
		return c.json({ error: "Failed to parse JSON" }, 500);
	}

	const premieres = json.Films.filter(
		({ AttributeList: attributes }) =>
			!attributes.length ||
			(attributes.includes(0) &&
				!attributes.includes(2) &&
				!attributes.includes(3)),
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
					minAge: Rating.split(" ")[0],
					description: Description,
					duration: `${Duration} minutos`,
					category: Category,
					emoji: emojifier(Category),
					isPremiere: AttributeList.includes(0),
					poster: URLPoster,
					youTubeId: URLTrailerYoutube.split(".be/")[1],
					inCinemas: CinemaList,
					cast: PersonList.reduce(
						(cast, { Type, Name }) => {
							if (Type === "D") {
								cast.directors.push(Name);
							} else if (Type === "A") {
								cast.actors.push(Name);
							}
							return cast;
						},
						{ directors: [], actors: [] } as {
							directors: string[];
							actors: string[];
						},
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

	const sortedByPremiere = data.sort(
		(a, b) => Number(b.isPremiere) - Number(a.isPremiere),
	);

	return c.json(sortedByPremiere);
});

app.get("/movie/:movieId/:cinemaId", async (c) => {
	const response = await fetch(
		"https://www.cinemarkhoyts.com.ar/ws/Billboard_WWW_202410051054157566.js",
	);
	const code = await response.text();
	const [err, json] = safeJsonParse(code.slice(15, -1));

	if (err) {
		return c.json({ error: "Failed to parse JSON" }, 500);
	}

	const { movieId, cinemaId } = c.req.param();

	const data = json.Films.filter(({ Id }) => Id === movieId).map(
		({ Name, MovieList }) => ({
			name: toTitleCase(Name),
			shows: MovieList.filter(({ CinemaList }) =>
				CinemaList.some(({ Id }) => Id === Number(cinemaId)),
			).map(
				({ Format, Version, CinemaList }) =>
					CinemaList.filter(({ Id }) => Id === Number(cinemaId)).map(
						({ Id: cinemaId, SessionList }) =>
							SessionList.map(
								({ Id: sessionId, Feature: featureId, Dtm: timestamp }) => ({
									timestamp,
									date: dayjs(timestamp).format("dddd D [de] MMMM"),
									time: dayjs(timestamp).format("HH[:]mm"),
									link: `https://tickets.cinemarkhoyts.com.ar/NSTicketing/?CinemaId=${cinemaId}&SessionId=${sessionId}&FeatureId=${featureId}`,
									format: toTitleCase(Format)
										.split(" ")
										.map((value, index) =>
											index === 0 ? value.toUpperCase() : value,
										)
										.join(" "),
									version: toTitleCase(Version),
								}),
							),
					)[0],
			),
		}),
	)[0];

	const flattenData = {
		...data,
		shows: flatten(data.shows).sort((a, b) =>
			dayjs(a.timestamp).isAfter(dayjs(b.timestamp)) ? 1 : -1,
		),
	};

	return c.json(flattenData);
});

export default app;
