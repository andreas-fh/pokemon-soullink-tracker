const CACHE_KEY_PREFIX = "pokeapi.national_dex_upto_gen.";

export type PokemonOption = {
    id: number, // National dex #
    name: string, // Name
    spriteUrl: string;
};

type GenerationResponse = {
    pokemon_species: Array<{ name: string; url: string}>;
};

function toTitleCase(name: string): string {
    return name
        .split("-")
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
        .join(" ");
}

function dexIdFromSpeciesUrl(url: string): number {
    const m = url.match(/\/pokemon-species\/(\d+)\/?$/);
    if (!m) throw new Error("Could not parse species id from url: " + url);
    return Number(m[1]);
}

function spriteUrlFromDexId(id: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function cacheKey(maxGen: number): string {
    return `${CACHE_KEY_PREFIX}${maxGen}.v1`;
}

export async function getPokemonOptionsUpToGen(maxGen: number): Promise<PokemonOption[]> {
    const key = cacheKey(maxGen);

    const cached = localStorage.getItem(key);
    if (cached) {
        try {
            const parsed = JSON.parse(cached) as { options: PokemonOption[] };
            if (Array.isArray(parsed.options) && parsed.options.length > 0) return parsed.options;
        } catch {
            // ignore
        }
    }

    // Fetch generations 1 to maxGen and union the species into a map keyed by national dex #
    const responses = await Promise.all(
        Array.from({ length: maxGen }, (_, i) => i + 1).map(async (gen) => {
            const res = await fetch(`https://pokeapi.co/api/v2/generation/${gen}`);
            if (!res.ok) throw new Error(`PokeAPI error for gen ${gen}: ${res.status} ${res.statusText}`);
            return (await res.json()) as GenerationResponse;
        })
    );

    const byId = new Map<number, PokemonOption>();

    for (const json of responses) {
        for (const s of json.pokemon_species ?? []) {
            const id = dexIdFromSpeciesUrl(s.url);
            if (!byId.has(id)) {
                byId.set(id, { id, name: toTitleCase(s.name), spriteUrl: spriteUrlFromDexId(id) });
            }
        }
    }

    const options = Array.from(byId.values()).sort((a, b) => a.id- b.id);

    localStorage.setItem(key, JSON.stringify({ options }));

    return options;
}