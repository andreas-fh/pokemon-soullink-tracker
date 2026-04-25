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