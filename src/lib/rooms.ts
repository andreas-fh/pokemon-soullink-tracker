import { supabase } from "../supabase";
import type { GameId } from "../data/games";
import type { ProfileRow, RoomRow } from "../types";

export async function loadRoomByCode(code: string): Promise<RoomRow | null> {
    const {data, error} = await supabase
        .from("rooms")
        .select("id, code, name, game, created_by, created_at")
        .eq("code", code)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as RoomRow) ?? null;
}

export async function createRoom(params: {
    code: string;
    name: string;
    game: GameId;
    created_by: string;
}): Promise<RoomRow> {
    const { data, error } = await supabase
        .from("rooms")
        .insert({
            code: params.code,
            name: params.name,
            game: params.game,
            created_by: params.created_by,
        })
        .select("id, code, name, game, created_by, created_at")
        .single();

    if (error) throw new Error(error.message);
    return data as RoomRow;
}

export async function joinRoom(params: { roomId: string; userId: string}): Promise<void> {
    const { error } = await supabase.from("room_members").upsert(
        {
            room_id: params.roomId,
            user_id: params.userId,
        },
        { onConflict: "room_id, user_id" }
    );

    if (error) throw new Error(error.message);
}

export async function leaveRoom(params: { roomId: string; userId: string }): Promise<void> {
    const { error } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", params.roomId)
        .eq("userId", params.userId)

    if (error) throw new Error(error.message);
}

export async function countRoomMembers(roomId: string): Promise<number> {
    const { count, error } = await supabase
        .from("room_members")
        .select("*", { count: "exact", head: true})
        .eq("room_id", roomId);

    if (error) throw new Error(error.message);
    return count ?? 0;
}

export async function loadRoomMembersProfiles(roomId: string): Promise<ProfileRow[]> {
    const { data: members, error: memErr } = await supabase
        .from("room_members")
        .select("user_id")
        .eq("room_id", roomId)

    if (memErr) throw new Error(memErr.message);

    const ids = (members ?? []).map((m) => m.user_id as string);
    if (ids.length === 0) return [];

    const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id, discord_username, discord_avatar_url, updated_at")
        .in("id", ids)
        .order("updated_at", { ascending: false });

    if (profErr) throw new Error(profErr.message);
    return (profs ?? []) as ProfileRow[];
}