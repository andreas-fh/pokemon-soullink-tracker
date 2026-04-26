import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

import type { AttemptRow, EncounterPickRow, EncounterRow, ProfileRow, RoomRow} from "./types";
import type { GameId } from "./data/games";
import { upsertDiscordProfile } from "./lib/authProfile";
import {
  countRoomMembers,
  getOrCreateRoom,
  joinRoom,
  leaveRoom,
  loadRoomByCode,
  loadRoomMembersProfiles,
} from "./lib/rooms";
import { createAttempt, listAttempts} from "./lib/attempts";
import { addEncounter, loadEncounterPicks, loadEncounters} from "./lib/encounters";
import { getPokemonOptionsUpToGen, type PokemonOption } from "./lib/pokeapi";

import { CenteredPage } from "./components/CenteredPage";
import { RoomJoinCreate } from "./components/RoomJoinCreate";
import { PlayersList } from "./components/PlayersList";
import { AttemptPicker } from "./components/AttemptPicker";
import { EncountersPanel } from "./components/EncountersPanel";
import { getGameData } from "./data";

export default function App() {
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Starting...");

  const [currentRoom, setCurrentRoom] = useState<RoomRow | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);

  const [encounters, setEncounters] = useState<EncounterRow[]>([]);
  const [picks, setPicks] = useState<EncounterPickRow[]>([]);

  const [pokemonOptions, setPokemonOptions] = useState<PokemonOption[]>([]);

  const activeAttempt = useMemo(
      () => attempts.find((a) => a.id === activeAttemptId) ?? null,
      [attempts, activeAttemptId]
  );

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
    setCurrentRoom(null);
    setProfiles([]);
    setAttempts([]);
    setActiveAttemptId(null);
    setEncounters([]);
    setPicks([]);
    setStatus("Signed out.");
  }

  // Auth sync
  useEffect(() => {
    const {data: sub} = supabase.auth.onAuthStateChange((_event, session) => {
      setMyUserId(session?.user?.id ?? null);
      if (session?.user) {
        void (async () => {
          const res = await upsertDiscordProfile();
          if (!res.ok) setStatus("Profile save failed: " + res.message);
          else setStatus("Connected.");
        })();
      } else {
        setStatus("Not signed in.");
        setCurrentRoom(null);
        setProfiles([]);
        setAttempts([]);
        setActiveAttemptId(null);
        setEncounters([]);
        setPicks([]);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Load session on start
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
        const res = await upsertDiscordProfile();
        if (!res.ok) setStatus("Profile save failed: " + res.message);
        else setStatus("Connected.");
      } else {
        setStatus("Not signed in.");
      }
    }

    void loadExistingSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshMembers(roomId: string) {
    try {
      const profs = await loadRoomMembersProfiles(roomId);
      setProfiles(profs);
    } catch (e) {
      setStatus("Load members failed: " + (e as Error).message);
    }
  }

  async function refreshAttempts(roomId: string) {
    try {
      const list = await listAttempts(roomId);
      setAttempts(list);

      // Auto select first attempt if none selected
      if (!activeAttemptId && list.length > 0) {
        setActiveAttemptId(list[0]?.id ?? null);
      }

      // if selected attempt no longer exists
      if (activeAttemptId && !list.some((a) => a.id === activeAttemptId)) {
        setActiveAttemptId(list[0]?.id ?? null);
      }
    } catch (e) {
      setStatus("Load attempts failed: " + (e as Error).message);
    }
  }

  async function refreshEncounters(attemptId: string) {
    try {
      const encs = await loadEncounters(attemptId);
      setEncounters(encs);

      const ids = encs.map((e) => e.id);
      const ps = await loadEncounterPicks(ids);
      setPicks(ps);
    } catch (e) {
      setStatus("Load encounters failed: " + (e as Error).message);
    }
  }

  async function onCreateRoom(args: { code: string; name: string; game: GameId }) {
    if (!myUserId) {
      setStatus("Not signed in.");
      return;
    }
    if (!args.code) {
      setStatus("Enter a room code (e.g. ABC123)");
      return;
    }

    setStatus("Creating room...");

    try {
      const { room, created } = await getOrCreateRoom({
        code: args.code,
        name: args.name.trim() || "My Soullink",
        game: args.game,
        created_by: myUserId,
      });

      const memberCount = await countRoomMembers(room.id);
      if (memberCount >= 3) {
        setStatus("This room already has 3 players");
        return;
      }

      setCurrentRoom(room);
      await joinRoom({roomId: room.id, userId: myUserId});
      await refreshMembers(room.id);
      await refreshAttempts(room.id);

      setStatus(created ? "Room created." : "Room already exists - joined it.")
    } catch (e) {
      setStatus("Create room failed: " + (e as Error).message);
    }
  }

  async function onJoinRoom(args: { code: string }) {
    if (!myUserId) {
      setStatus("Not signed in.");
      return;
    }
    if (!args.code) {
      setStatus("Enter a room code!");
      return;
    }

    setStatus("Joining room...");

    try {
      const room = await loadRoomByCode(args.code);
      if (!room) {
        setStatus(`No room found with code "${args.code}".`);
        return;
      }

      const memberCount = await countRoomMembers(args.code);
      if (memberCount >= 3) {
        setStatus("This room already has 3 players.");
        return;
      }

      setCurrentRoom(room);
      await joinRoom({roomId: room.id, userId: myUserId});
      await refreshMembers(room.id);
      await refreshAttempts(room.id);

      setStatus("Joined room.");
    } catch (e) {
      setStatus("Join room failed: " + (e as Error).message);
    }
  }

  async function onLeaveRoom() {
    if (!myUserId || !currentRoom?.id) return;

    setStatus("Leaving room...");
    try {
      await leaveRoom({roomId: currentRoom.id, userId: myUserId});
      setCurrentRoom(null);
      setProfiles([]);
      setAttempts([]);
      setActiveAttemptId(null);
      setEncounters([]);
      setPicks([]);
      setStatus("Left room.");
    } catch (e) {
      setStatus("Leave failed: " + (e as Error).message);
    }
  }

  async function onCreateAttempt(args: { attemptNumber: number }) {
    if (!myUserId || !currentRoom?.id) return;

    setStatus("Creating attempt...");
    try {
      const a = await createAttempt({
        roomId: currentRoom.id,
        attemptNumber: args.attemptNumber,
        name: "",
        created_by: myUserId,
      });

      await refreshAttempts(currentRoom.id);
      setActiveAttemptId(a.id);
      setStatus("Attempt created.");
    } catch (e) {
      setStatus("Create attempt failed: " + (e as Error).message);
    }
  }

  async function onSelectAttempt(attemptId: string) {
    setActiveAttemptId(attemptId);
  }

  async function onAddEncounter(args: {
    routeId: string;
    nickname: string;
    picks: { userId: string; pokemon: string }[];
  }) {
    if (!myUserId || !activeAttempt?.id) return;

    setStatus("Adding encounter...");
    try {
      await addEncounter({
        attemptId: activeAttempt.id,
        routeId: args.routeId,
        nickname: args.nickname,
        created_by: myUserId,
        picks: args.picks,
      });

      await refreshEncounters(activeAttempt.id);
      setStatus("Encounter added.");
    } catch (e) {
      setStatus("Add encounter failed: " + (e as Error).message);
    }
  }

  // Realtime: room members
  useEffect(() => {
    if (!currentRoom?.id) return;

    const channel = supabase
        .channel("room-members-realtime")
        .on(
            "postgres_changes",
            {event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${currentRoom.id}`},
            async () => {
              await refreshAttempts(currentRoom.id);
            }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoom?.id]);

  // Realtime: attempts
  useEffect(() => {
    if (!currentRoom?.id) return;

    const channel = supabase
        .channel("attempts-realtime")
        .on(
            "postgres_changes",
            {event: "*", schema: "public", table: "attempts", filter: `room_id=eq.${currentRoom.id}`},
            async () => {
              await refreshAttempts(currentRoom.id);
            }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoom?.id]);

  // Load encounters when attempt changes
  useEffect(() => {
    if (!activeAttemptId) return;

    const channel = supabase
        .channel("encounters-realtime")
        .on(
            "postgres_changes",
            {event: "*", schema: "public", table: "encounters", filter: `attempt_id=eq.${activeAttemptId}`},
            async () => {
              await refreshEncounters(activeAttemptId);
            }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeAttemptId]);

  useEffect(() => {
    let cancelled = false;

    async function loadPokemon() {
      try {
        const options = await getPokemonOptionsUpToGen(5);
        if (!cancelled) setPokemonOptions(options);
      } catch (e) {
        if (!cancelled) setStatus("Failed to load Pokémon list: " + (e as Error).message);
      }
    }

    void loadPokemon();
    return () => {
      cancelled = true;
    }
  }, []);

  // If not signed in, prompt discord
  if (!myUserId) {
    return (
        <CenteredPage>
          <h1>Soullink Tracker</h1>
          <p>
            <strong>Status:</strong> {status}
          </p>
          <button onClick={signInWithDiscord} style={{padding: "8px 12px"}}>
            Sign in with Discord
          </button>
        </CenteredPage>
    );
  }

  // UI if signed in
  return (
      <CenteredPage>
        <h1>Soullink Tracker</h1>

        <p>
          <strong>Status:</strong> {status}
        </p>

        <div style={{display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap"}}>
          <button onClick={signOut} style={{padding: "6px 10px"}}>
            Sign out
          </button>

          {currentRoom ? (
              <button onClick={onLeaveRoom} style={{padding: "6px 10px"}}>
                Leave room
              </button>
          ) : null}
        </div>

        {!currentRoom ? (
            <RoomJoinCreate onCreate={onCreateRoom} onJoin={onJoinRoom}/>
        ) : (
            <>
              <div style={{marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8}}>
                <h2>Current room</h2>
                <div>
                  <strong>{currentRoom.name}</strong> (code: <code>{currentRoom.code}</code>)
                </div>
                <div style={{marginTop: 6, fontSize: 12, opacity: 0.75}}>
                  Game: <strong>{currentRoom.game}</strong>
                </div>
              </div>

              <PlayersList profiles={profiles} myUserId={myUserId}/>

              <AttemptPicker
                  attempts={attempts}
                  activeAttemptId={activeAttemptId}
                  onSelect={onSelectAttempt}
                  onCreate={onCreateAttempt}
              />

              {activeAttempt ? (
                  <EncountersPanel
                      gameData={getGameData(currentRoom.game)}
                      pokemonOptions={pokemonOptions}
                      requiredPicksCount={profiles.length}
                      profiles={profiles}
                      myUserId={myUserId}
                      encounters={encounters}
                      picks={picks}
                      onAddEncounter={onAddEncounter}
                  />
              ) : (
                  <div style={{marginTop: 16, fontSize: 12, opacity: 0.75}}>
                    Create/select an attempt to start adding encounters.
                  </div>
              )}
            </>
        )}
      </CenteredPage>
  );
}
