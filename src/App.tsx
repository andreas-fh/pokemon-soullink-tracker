import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type ProfileRow = {
  id: string;
  discord_username: string;
  discord_avatar_url: string;
  updated_at: string;
};

type RunRow = {
  id: string;
  code: string;
  name: string;
  created_by: string;
  created_at: string;
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

  // Run state
  const [runCode, setRunCode] = useState("");
  const [runName, setRunName] = useState("");
  const [currentRun, setCurrentRun] = useState<RunRow | null>(null);

  const normalizedRunCode = useMemo(() => runCode.trim().toUpperCase(), [runCode]);

  async function signInWithDiscord() {
    setStatus("Redirecting to Discord...");
    const {error} = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {redirectTo: window.location.origin},
    });
    if (error) setStatus("Discord sign-in failed: " + error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setCurrentRun(null);
    setProfiles([]);
    setStatus("Signed out.");
  }

  async function upsertDiscordProfile() {
    const {data, error} = await supabase.auth.getSession();
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

    const {error: upsertErr} = await supabase.from("profiles").upsert({
          id: user.id,
          discord_username: discordUsername,
          discord_avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        },
        {onConflict: "id"}
    );

    if (upsertErr) {
      setStatus("Profile save failed: " + upsertErr.message);
      return;
    }
  }

  useEffect(() => {
    const {data: sub} = supabase.auth.onAuthStateChange((_event, session) => {
      setMyUserId(session?.user?.id ?? null);
      if (session?.user) {
        void upsertDiscordProfile();
        setStatus("Connected.");
      } else {
        setStatus("Not signed in.");
        setCurrentRun(null);
        setProfiles([]);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadExistingSession() {
      setStatus("Checking session...");
      const {data, error} = await supabase.auth.getSession();
      if (error) {
        setStatus("Session error: " + error.message);
        return;
      }
      if (cancelled) return;

      const uid = data.session?.user?.id ?? null;
      setMyUserId(uid);

      if (uid) {
        await upsertDiscordProfile();
        setStatus("Connected.");
      } else {
        setStatus("Not signed in.");
      }
    }

    void loadExistingSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadRunByCode(code: string): Promise<RunRow | null> {
    const {data, error} = await supabase
        .from("runs")
        .select("id, code, name, created_by, created_at")
        .eq("code", code)
        .maybeSingle();

    if (error) {
      setStatus("Run lookup failed: " + error.message);
      return null;
    }
    return (data as RunRow) ?? null;
  }

  async function loadRunMembers(runId: string) {
    const {data: members, error: memErr} = await supabase
        .from("run_members")
        .select("user_id")
        .eq("run_id", runId);

    if (memErr) {
      setStatus("Load members failed: " + memErr.message);
      return;
    }

    const ids = (members ?? []).map((m) => m.user_id as string);
    if (ids.length === 0) {
      setProfiles([]);
      return;
    }

    // load profiles for given ids
    const {data: profs, error: profErr} = await supabase
        .from("profiles")
        .select("id, discord_username, discord_avatar_url, updated_at")
        .in("id", ids)
        .order("updated_at", {ascending: false})

    if (profErr) {
      setStatus("Load profiles failed: " + profErr.message);
      return;
    }

    setProfiles((profs ?? []) as ProfileRow[]);
  }

  async function createRun() {
    if (!myUserId) {
      setStatus("Not signed in.");
      return;
    }
    const code = normalizedRunCode;
    if (!code) {
      setStatus("Enter a run code (e.g. ABC123)");
      return;
    }

    setStatus("Creating run...");

    const {data: created, error} = await supabase
        .from("runs")
        .insert({
          code,
          name: runName.trim() || "My Soullink",
          created_by: myUserId,
        })
        .select("id, code, name, created_by, created_at")
        .single();

    if (error) {
      setStatus("Create run failed: " + error.message);
      return;
    }

    const run = created as RunRow;
    setCurrentRun(run);

    await joinRunById(run.id);
  }

  async function joinRun() {
    if (!myUserId) {
      setStatus("Not signed in.");
      return;
    }
    const code = normalizedRunCode;
    if (!code) {
      setStatus("Enter a run code!");
      return;
    }

    setStatus("Joining run...");
    const run = await loadRunByCode(code);
    if (!run) {
      setStatus(`No run found with code "${code}".`);
      return;
    }

    const {count, error: countErr} = await supabase
        .from("run_members")
        .select("*", {count: "exact", head: true})
        .eq("run_id", run.id);

    if (countErr) {
      setStatus("Could not check run size: " + countErr.message);
      return;
    }
    if ((count ?? 0) >= 3) {
      setStatus("This run already has 3 players.");
      return;
    }

    setCurrentRun(run);
    await joinRunById(run.id);
  }

  async function joinRunById(runId: string) {
    if (!myUserId) return;

    const {error} = await supabase.from("run_members").upsert(
        {
          run_id: runId,
          user_id: myUserId,
        },
        {onConflict: "run_id, user_id"}
    );

    if (error) {
      setStatus("Join failed: " + error.message);
      return;
    }

    await loadRunMembers(runId);
    setStatus("Joined run.");
  }

  async function leaveRun() {
    if (!myUserId || !currentRun?.id) return;

    setStatus("Leaving run...");

    const { error } = await supabase
        .from("run_members")
        .delete()
        .eq("run_id", currentRun.id)
        .eq("user_id", myUserId);

    if (error) {
      setStatus("Leave failed: " + error.message);
      return;
    }

    setCurrentRun(null);
    setProfiles([]);
    setStatus("Left run.");
  }

  useEffect(() => {
    if (!currentRun?.id) return;

    const channel = supabase
        .channel("run-members-realtime")
        .on(
            "postgres_changes",
            {event: "*", schema: "public", table: "run_members", filter: `run_id=eq.${currentRun.id}`},
            async () => {
              await loadRunMembers(currentRun.id);
            }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRun?.id]);

  // If not signed in, prompt discord
  if (!myUserId) {
    return (
        <div style={{fontFamily: "system-ui", padding: 16, maxWidth: 700, margin: "0 auto", textAlign: "center"}}>
          <h1>Soullink Tracker</h1>
          <p>
            <strong>Status:</strong> {status}
          </p>
          <button onClick={signInWithDiscord} style={{padding: "8px 12px"}}>
            Sign in with Discord
          </button>
        </div>
    );
  }

  // UI if signed in
  return (
      <div style={{fontFamily: "system-ui", padding: 16, maxWidth: 700, margin: "0 auto", textAlign: "center"}}>
        <h1>Soullink Tracker</h1>

        <p>
          <strong>Status:</strong> {status}
        </p>

        <button onClick={signOut} style={{padding: "6px 10px", marginBottom: 12}}>
          Sign out
        </button>

        <button
            onClick={leaveRun}
            style={{ padding: "6px 10px", marginBottom: 12, marginLeft: 8 }}
        >
          Leave room
        </button>

        {!currentRun ? (
            <div style={{padding: 12, border: "1px solid #ddd", borderRadius: 8}}>
              <h2>Create or Join Run</h2>

              <div style={{display: "grid", gap: 8, maxWidth: 360}}>
                <label>
                  Run code (share with friends):
                  <input
                      value={runCode}
                      onChange={(e) => setRunCode(e.target.value)}
                      placeholder="ABC123"
                      style={{display: "block", width: "100%", padding: 8, marginTop: 4}}
                  />
                </label>

                <label>
                  Run name:
                  <input
                      value={runName}
                      onChange={(e) => setRunName(e.target.value)}
                      placeholder="My Soullink"
                      style={{display: "block", width: "100%", padding: 8, marginTop: 4}}
                  />
                </label>

                <div style={{display: "flex", gap: 8}}>
                  <button onClick={createRun} style={{padding: "8px 12px"}}>
                    Create
                  </button>
                  <button onClick={joinRun} style={{padding: "8px 12px"}}>
                    Join
                  </button>
                </div>

                <div style={{fontSize: 12, opacity: 0.7}}>
                  Up to 3 players per run.
                </div>
              </div>
            </div>
        ) : (
            <>
              <div style={{padding: 12, border: "1px solid #ddd", borderRadius: 8}}>
                <h2>Current run</h2>
                <div>
                  <strong>{currentRun.name}</strong> (code: <code>{currentRun.code}</code>)
                </div>
              </div>

              <div style={{marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8}}>
                <h2>Players in this run</h2>
                <ul style={{listStyle: "none", padding: 0, margin: 0}}>
                  {profiles.map((p) => (
                      <li
                          key={p.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
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
                                style={{borderRadius: "50%"}}
                            />
                        ) : (
                            <div style={{width: 32, height: 32, borderRadius: "50%", background: "#ddd"}}/>
                        )}

                        <div>
                          <div style={{fontWeight: 600, textAlign: "left"}}>
                            {p.discord_username ?? "(unknown)"}
                            {p.id === myUserId ? (
                                <span style={{marginLeft: 8, fontSize: 12, opacity: 0.7, textAlign: "left"}}>(you)</span>
                            ) : null}
                          </div>
                          <div style={{fontSize: 12, opacity: 0.7, textAlign: "left"}}>{p.id}</div>
                        </div>
                      </li>
                  ))}
                </ul>
              </div>
            </>
        )}
      </div>
  );
}