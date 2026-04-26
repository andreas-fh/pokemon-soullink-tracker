import type {GameId} from "./games";
import {type RouteDef, ROUTES_BW} from "./routes/routes_bw";

export type GameData = {
    routes: RouteDef[];
};

export function getGameData(game: GameId): GameData {
    switch (game) {
        case "bw":
            return { routes: ROUTES_BW };
        default:{
            return game;
        }
    }
}

export function routeLabel(gameData: GameData, routeId: string): string {
    return gameData.routes.find((r) => r.id === routeId)?.name ?? routeId;
}