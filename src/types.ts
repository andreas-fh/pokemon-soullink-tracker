import type { GameId } from "./data/games";

export type ProfileRow = {
    id: string;
    discord_username: string;
    discord_avatar_url: string;
    updated_at: string;
};

export type RoomRow = {
    id: string;
    code: string;
    name: string;
    game: GameId;
    created_by: string;
    created_at: string;
};

export type AttemptRow = {
    id: string;
    room_id: string;
    attempt_number: number;
    name: string;
    created_by: string;
    created_at: string;
}

export type EncounterRow = {
    id: string;
    attempt_id: string;
    route_id: string;
    nickname: string;
    created_by: string;
    created_at: string;
};

export type EncounterPickRow = {
    encounter_id: string;
    user_id: string;
    pokemon: string;
};

export type DiscordUserMetadata = {
    global_name?: string;
    preferred_username?: string;
    full_name?: string;
    name?: string;
    user_name?: string;
    avatar_url?: string;
    picture?: string;
};