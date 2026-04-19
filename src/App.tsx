import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type ProfileRow = {
  id: string;
  display_name: string;
  updated_at: string;
};

export default function App() {
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState("");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [status, setStatus] = useState<string>("Starting...");

  async function signInWithDiscord() {
    setStatus("Redirecting to Discord...");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: window.location.origin,
      }
    });
    if (error) setStatus("Discord sign-in failed: " + error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setStatus("Signed out.");
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setMyUserId(session?.user?.id ?? null);
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

      if (!cancelled) {
        setMyUserId(data.session?.user?.id ?? null);
        setStatus(data.session?.user ? "Connected." : "Not signed in.");
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
      const {data, error} = await supabase
          .from("profiles")
          .select("id, display_name, updated_at")
          .order("updated_at", {ascending: false});

      if (error) {
        setStatus("DB error: " + error.message);
        return;
      }

      if (!cancelled) setProfiles(data ?? []);

      // Also load existing name (if already set)
      const ownName = (data ?? []).find((p) => p.id === myUserId);
      if (ownName && !cancelled) setMyName(ownName.display_name);
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
                  .select("id, display_name, updated_at")
                  .order("updated_at", {ascending: false});

              setProfiles(data ?? []);
            }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myUserId]);

  const canSave = useMemo(() => myName.trim().length > 0, [myName]);

  // 4) Save display name
  async function saveName() {

    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id ?? null;

    if (!uid) {
      setStatus("Not signed in yet");
      return;
    }

    const name = myName.trim();
    if (!name) return;

    setStatus("Saving name...");

    const {error} = await supabase.from("profiles").upsert({
          id: uid,
          display_name: name,
          updated_at: new Date().toISOString(),
        },
        { onConflict : "id" }
    );

    if (error) {
      setStatus("Save failed: " + error.message);
      return;
    }

    setStatus("Saved successfully!");
  }

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
          <h2>Your profile</h2>
          <div style={{fontSize: 12, opacity: 0.8}}>User ID: {myUserId}</div>

          <div style={{marginTop: 8}}>
            <label>
              Display name:
              <input
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                  style={{marginLeft: 8, padding: 6, width: 240}}
                  placeholder="Name"
              />
            </label>

            <button
                onClick={saveName}
                disabled={!canSave}
                style={{marginLeft: 8, padding: "6px 10px"}}
            >
              Save
            </button>
          </div>
        </div>

        <div style={{marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8}}>
          <h2>Connected players (from Supabase)</h2>
          <ul>
            {profiles.map((p) => (
                <li key={p.id}>
                  <strong>{p.display_name}</strong>{" "}
                  <span style={{fontSize: 12, opacity: 0.7}}>
                    ({p.id === myUserId ? "you" : "other"})
                  </span>
                </li>
            ))}
          </ul>
        </div>
      </div>
  );
}