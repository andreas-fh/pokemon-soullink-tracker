import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type ProfileRow = {
  id: string;
  discord_username: string;
  discord_avatar_url: string;
  updated_at: string;
};

type DiscordUserMetadata = {
  preferred_username?: string;
  full_name?: string;
  name?: string;
  user_name?: string;

  avatar_url?: string;
  picture?: string;
}

export default function App() {
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [status, setStatus] = useState<string>("Starting...");

  async function signInWithDiscord() {
    setStatus("Redirecting to Discord...");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: window.location.origin },
    });
    if (error) setStatus("Discord sign-in failed: " + error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setStatus("Signed out.");
  }

  async function upsertDiscordProfile() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setStatus("Session error: " + error.message);
      return;
    }

    const user = data.session?.user;
    if (!user) return;

    const md = user.user_metadata as DiscordUserMetadata;

    const discordUsername =
        md?.preferred_username ??
        md?.full_name ??
        md?.name ??
        md?.user_name ??
        null;

    const avatarUrl =
        md?.avatar_url ??
        md?.picture ??
        null;

    setStatus("Saving Discord Profile...");

    const { error: upsertErr } = await supabase.from("profiles").upsert({
          id: user.id,
          discord_username: discordUsername,
          discord_avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
    );

    if (upsertErr) {
      setStatus("Profile save failed: " + upsertErr.message);
      return;
    }

    setStatus("Connected.");
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setMyUserId(session?.user?.id ?? null);

      if (session?.user) {
        upsertDiscordProfile();
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadExistingSession() {
      setStatus("Checking session...");
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setStatus("Session error: " + error.message);
        return;
      }

      if (cancelled) return;

      const uid = data.session?.user?.id ?? null;
      setMyUserId(uid);

      if (uid) {
        await upsertDiscordProfile();
      } else {
        setStatus("Not signed in.");
      }
    }

    loadExistingSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Load profiles
  useEffect(() => {
    if (!myUserId) return;

    let cancelled = false;

    async function loadProfiles() {
      const { data, error } = await supabase
          .from("profiles")
          .select("id, discord_username, discord_avatar_url, updated_at")
          .order("updated_at", {ascending: false});

      if (error) {
        setStatus("DB error: " + error.message);
        return;
      }

      if (!cancelled) setProfiles((data ?? []) as ProfileRow[]);
    }

    loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [myUserId]);

  // 3) Subscribe to realtime changes
  useEffect(() => {
    if (!myUserId) return;

    const channel = supabase
        .channel("profiles-realtime")
        .on(
            "postgres_changes",
            {event: "*", schema: "public", table: "profiles"},
            async () => {
              const {data} = await supabase
                  .from("profiles")
                  .select("id, discord_username, discord_avatar_url, updated_at")
                  .order("updated_at", {ascending: false});

              setProfiles((data ?? []) as ProfileRow[]);
            })
        .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myUserId]);

  // If not signed in, prompt discord
  if (!myUserId) {
    return (
        <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 700 }}>
          <h1>Soullink Tracker</h1>
          <p>
            <strong>Status:</strong> {status}
          </p>
          <button onClick={signInWithDiscord} style={{ padding: "8px 12px"}}>
            Sign in with Discord
          </button>
        </div>
    );
  }

  // UI if signed in
  return (
      <div style={{fontFamily: "system-ui", padding: 16, maxWidth: 700}}>
        <h1>Soullink Tracker</h1>

        <p>
          <strong>Status:</strong> {status}
        </p>

        <button onClick={signOut} style={{ padding: "6px 10px", marginBottom: 12 }}>
          Sign out
        </button>

        <div style={{padding: 12, border: "1px solid #ddd", borderRadius: 8}}>
          <h2>Players</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0}}>
            {profiles.map((p) => (
                <li
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid #eee",
                }}
                >
                  {p.discord_avatar_url ? (
                      <img
                        src={p.discord_avatar_url}
                        alt=""
                        width={32}
                        height={32}
                        style={{ borderRadius: "100%" }}
                      />
                  ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          backgroundColor: "#ddd",
                        }}
                      />
                  )}

                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {p.discord_username ?? "Unknown discord user"}
                      <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 8}}>
                        {p.id === myUserId ? "(you)" : ""}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{p.id}</div>
                  </div>
                </li>
            ))}
          </ul>
        </div>
      </div>
  );
}