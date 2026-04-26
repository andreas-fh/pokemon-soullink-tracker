import { useMemo, useState } from "react";
import type { GameData } from "../data";
import { routeLabel } from "../data";
import type { EncounterPickRow, EncounterRow, ProfileRow } from "../types";
import type { PokemonOption } from "../lib/pokeapi";

export function EncountersPanel(props: {
    gameData: GameData;
    pokemonOptions: PokemonOption[];
    requiredPicksCount: number;
    profiles: ProfileRow[];
    myUserId: string;
    encounters: EncounterRow[];
    picks: EncounterPickRow[];
    onAddEncounter: (args: {
        routeId: string;
        nickname: string;
        picks: { userId: string; pokemon: string }[];
    }) => void | Promise<void>;
}) {
    const [showAdd, setShowAdd] = useState(false);
    const [routeId, setRouteId] = useState(props.gameData.routes[0]?.id ?? "");
    const [nickname, setNickname] = useState("");
    const [pickByUserId, setPickByUserId] = useState<Record<string, string>>({});
    
    // If game changes reset routeId to first route of game
    useMemo(() => {
        // eslint-disable-next-line react-hooks/set-state-in-render
        setRouteId(props.gameData.routes[0]?.id ?? "");
    }, [props.gameData]);

    const pickFor = (encounterId: string, userId: string): string | null =>
        props.picks.find((p) => p.encounter_id === encounterId && p.user_id === userId)?.pokemon ?? null;

    const participating = useMemo(() => {
        return props.profiles
            .map((p) => p.id)
            .filter((uid) => Boolean(pickByUserId[uid]?.trim()));
    }, [pickByUserId, props.profiles]);

    const canSave = useMemo(() => {
        return (
            Boolean(routeId) &&
            nickname.trim().length > 0 &&
            participating.length === props.requiredPicksCount
        );
    }, [nickname, participating.length, props.requiredPicksCount, routeId]);

    function findPokemon(name: string): PokemonOption | undefined {
        const n = name.trim().toLowerCase();
        return props.pokemonOptions.find((p) => p.name.toLowerCase() === n);
    }

    return (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <h2>Encounters</h2>

            <button onClick={() => setShowAdd((v) => !v)} style={{ padding: "8px 12px" }}>
                {showAdd ? "Close" : "Add encounter"}
            </button>

            {showAdd ? (
                <div style={{ marginTop: 12, display: "grid", gap: 10, justifyItems: "center" }}>
                    <div style={{ width: "min(520px, 100%)", textAlign: "left" }}>
                        <label>
                            Route:
                            <select
                                value={routeId}
                                onChange={(e) => setRouteId(e.target.value)}
                                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
                                >
                                {props.gameData.routes.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label style={{ display: "block", marginTop: 10 }}>
                            Nickname
                            <input
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                placeholder="e.g. DJ Trump"
                                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
                                />
                        </label>

                        <div style={{ marginTop: 10 }}>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>
                                Pokémon per player ({props.requiredPicksCount} / {props.requiredPicksCount})
                            </div>

                            {props.profiles.map((p) => {
                                const selectedName = pickByUserId[p.id] ?? "";
                                const selected = findPokemon(selectedName);

                                return (
                                    <label key={p.id} style={{display: "block", marginTop: 8}}>
                                        {p.discord_username ?? "(unknown)"} {p.id === props.myUserId ? "(you)" : ""}:
                                        <div style={{display: "flex", gap: 10, alignItems: "center", marginTop: 4}}>
                                            <input
                                                value={selectedName}
                                                onChange={(e) =>
                                                    setPickByUserId((prev) => ({
                                                        ...prev,
                                                        [p.id]: e.target.value,
                                                    }))
                                                }
                                                list="pokemon-options"
                                                placeholder="Start typing (e.g. Bulbasaur)"
                                                style={{flex: 1, padding: 8}}
                                            />

                                            {selected ? (
                                                <img src={selected.spriteUrl} alt={selected.name} width={72} height={72}/>
                                            ) : (
                                                <div style={{width: 72, height: 72}}/>
                                            )}
                                        </div>
                                    </label>
                                );
                            })}

                            <datalist id="pokemon-options">
                                {props.pokemonOptions.map((mon) => (
                                    <option key={mon.id} value={mon.name} />
                                ))}
                            </datalist>
                        </div>

                        <button
                            disabled={!canSave}
                            onClick={async () => {
                                const picks = participating.map((uid) => ({
                                    userId: uid,
                                    pokemon: pickByUserId[uid]!,
                                }));

                                await props.onAddEncounter({
                                    routeId,
                                    nickname: nickname.trim(),
                                    picks,
                                });

                                setNickname("");
                                setPickByUserId({});
                                setShowAdd(false);
                            }}
                            style={{ marginTop: 12, padding: "8px 12px" }}
                            >
                            Save encounter
                        </button>

                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                            Selected players: {participating.length} / {props.requiredPicksCount}
                        </div>
                    </div>
                </div>
            ) : null}

            <div style={{ marginTop: 12, textAlign: "left"}}>
                {props.encounters.length === 0 ? (
                    <div style={{ fontSize: 12, opacity: 0.75 }}> No encounters yet.</div>
                ) : (
                    <ul style={{ paddingLeft: 18 }}>
                        {props.encounters.map((e) => (
                            <li key={e.id} style={{ marginBottom: 10 }}>
                                <div>
                                    <strong>{routeLabel(props.gameData, e.route_id)}</strong> - nickname:{" "}
                                    <strong>{e.nickname}</strong>
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.85 }}>
                                    {props.profiles
                                        .map((p) => {
                                            const mon = pickFor(e.id, p.id);
                                            return mon ? `${p.discord_username ?? "(unknown)"} (${mon})` : null;
                                        })
                                        .filter(Boolean)
                                        .join(" | ")}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
