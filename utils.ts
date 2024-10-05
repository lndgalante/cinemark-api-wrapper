import capitalize from "lodash.capitalize";

export function toTitleCase(string: string): string {
	return string.split(" ").map(capitalize).join(" ");
}

export function fixFeatures(features: string): string {
	return features
		.split("|")
		.map((value, index) =>
			index === 0 ? toTitleCase(value) : value.replace("Y", "y"),
		)
		.join("|");
}

export function fixName(name: string): string {
	if (name === "Hoyts Nuevocentro") return "Hoyts Nuevo Centro";
	if (name === "Cinemark Tortugas") return "Cinemark Tortuguitas";
	if (name === "Hoyts Moron") return "Hoyts Morón";
	if (name === "Cinemark Neuquen") return "Cinemark Neuquén";

	return name;
}

type ImdbInfo = {
	name: string;
	votes: string;
	poster: string;
};

export async function getImdbInfo(
	title: string,
): Promise<ImdbInfo | undefined> {
	const currentYear = new Date().getFullYear();

	const apiKey = "59d3174235953c532caf53f23c2d4c30";
	const baseUrl = "https://api.themoviedb.org/3/search/movie";
	const options = `&page=1&include_adult=false&year=${currentYear}`;

	const endpoint = `${baseUrl}?api_key=${apiKey}&query=${encodeURI(title)}${options}`;

	const res = await fetch(endpoint);
	const data = await res.json();

	if (data.total_results === 0 || data.total_results > 1) return;

	const [movie] = data.results;

	const { title: name, vote_average: votes, poster_path: posterPath } = movie;

	const baseImageUrl = "https://image.tmdb.org/t/p";
	function withWidth(width: number): string {
		return `w${width}`;
	}

	const poster = `${baseImageUrl}/${withWidth(300)}/${posterPath}`;

	const votesParsed = String(votes).length === 1 ? `${votes}.0` : `${votes}`;

	return { name, votes: votesParsed, poster };
}

const emojisGenres: Record<string, string> = {
	Drama: "🎭",
	Acción: "💥",
	Terror: "☠️",
	Thriller: "😱",
	Animación: "🦄",
	Aventuras: "🤠",
	Biografia: "✍️",
	Comedia: "😂",
	Policial: "👮‍",
};

export function emojifier(category: string): string {
	return emojisGenres[category] || "";
}
