import { supabase } from "../supabase";
import type { AttemptRow } from "../types";

export async function listAttempts(roomId: string): Promise<AttemptRow[]> {
    const {data, error} = await supabase
        .from("attempts")
        .select("id, room_id, attempt_number, name, created_by, created_at")
        .eq("room_id", roomId)
        .order("attempt_number", {ascending: true});

    if (error) throw new Error(error.message);
    return (data ?? []) as AttemptRow[];
}

export async function createAttempt(params: {
    roomId: string;
    attemptNumber: number;
    name: string;
    created_by: string;
}): Promise<AttemptRow> {
    const { data, error } = await supabase
        .from("attempts")
        .insert({
            room_id: params.roomId,
            attempt_number: params.attemptNumber,
            name: params.name,
            created_by: params.created_by
        })
        .select("id, room_id, attempt_number, name, created_by, created_at")
        .single();

    if (error) throw new Error(error.message);
    return data as AttemptRow;
}

export async function getMaxAttemptNumber(roomId: string): Promise<number> {
    const { data, error } = await supabase
        .from("attempts")
        .select("attempt_number")
        .eq("room_id", roomId)
        .order("attempt_number", { ascending: false })
        .limit(1);

    if (error) throw new Error(error.message);
    const row = (data ?? [])[0] as { attempt_number: number } | undefined;
    return row?.attempt_number ?? 0;
}