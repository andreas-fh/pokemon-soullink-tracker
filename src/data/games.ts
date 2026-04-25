export type GameId = "bw";

export type GameDef = {
    id: GameId;
    label: string;
};

export const GAMES: GameDef[] = [
    { id: "bw", label: "Pokémon Black & White" },
];