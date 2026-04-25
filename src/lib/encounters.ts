import { supabase } from "../supabase";
import type { EncounterPickRow, EncounterRow } from "../types";

export async function loadEncounters(attemptId: string): Promise<EncounterRow[]> {
    const {data, error} = await supabase
        .from("encounters")
        .select("id, attempt_id, route_id, nickname, created_by, created_at")
        .eq("attempt_id", attemptId)
        .order("created_at", {ascending: true});

    if (error) throw new Error(error.message);
    return (data ?? []) as EncounterRow[];
}

export async function loadEncounterPicks(encounterIds: string[]): Promise<EncounterPickRow[]> {
    if (encounterIds.length === 0) return [];

    const { data, error } = await supabase
        .from("encounter_picks")
        .select("encounter_id, user_id, pokemon")
        .in("encounter_id", encounterIds);

    if (error) throw new Error(error.message);
    return (data ?? []) as EncounterPickRow[];
}

export async function addEncounter(params: {
    attemptId: string;
    routeId: string;
    nickname: string;
    created_by: string;
    picks: { userId: string; pokemon: string }[];
}): Promise<void> {
    const { data: enc, error: encError } = await supabase
        .from("encounters")
        .insert({
            attempt_id: params.attemptId,
            route_id: params.routeId,
            nickname: params.nickname,
            created_by: params.created_by,
        })
        .select("id")
        .single();

    if (encError) throw new Error(encError.message);

    const encounterId = (enc as { id: string }).id;

    const { error: picksErr } = await supabase.from("encounter_picks").insert(
        params.picks.map((p) => ({
            encounter_id: encounterId,
            user_id: p.userId,
            pokemon: p.pokemon,
        }))
    );

    if (picksErr) throw new Error(picksErr.message);
}