import { supabase } from "../supabase";
import type { DiscordUserMetadata } from "../types.ts";

export async function upsertDiscordProfile(): Promise<{ ok: true } | { ok: false; message: string }> {
    const { data, error } = await supabase.auth.getSession();
    if (error) return { ok: false, message: error.message };

    const user = data.session?.user;
    if (!user) return { ok: true }

    const md = user.user_metadata as DiscordUserMetadata;

    const discordUsername =
        md.global_name ?? md.preferred_username ?? md.full_name ?? md.name ?? md.user_name ?? null;

    const avatarUrl = md.avatar_url ?? md.picture ?? null;

    const { error: upsertErr } = await supabase.from("profiles").upsert(
        {
            id: user.id,
            discord_username: discordUsername,
            discord_avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
    );

    if (upsertErr) return { ok: false, message: upsertErr.message };
    return { ok: true };
}