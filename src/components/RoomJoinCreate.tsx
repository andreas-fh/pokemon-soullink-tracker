import { useMemo, useState } from "react";
import { GAMES, type GameId } from "../data/games";

export function RoomJoinCreate(props: {
    onCreate: (args: { code: string; name: string; game: GameId }) => void | Promise<void>;
    onJoin: (args: { code: string }) => void | Promise<void>;
}) {
    const [roomCode, setRoomCode] = useState("");
    const [roomName, setRoomName] = useState("");
    const [game, setGame] = useState<GameId>("bw");

    const normalizedRoomCode = useMemo(() => roomCode.trim().toUpperCase(), [roomCode]);

    const inputStyle: React.CSSProperties = {
        display: "block",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        padding: 8,
        marginTop: 4,
    };

    return (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8}}>
            <h2>Create or Join Room</h2>

            <div style={{ display: "grid", gap: 8, width: "min(420px, 100%)", margin: "0 auto", textAlign: "left"}}>
                <label>
                    Game:
                    <select
                        value={game}
                        onChange={(e) => setGame(e.target.value as GameId)}
                        style={inputStyle}
                    >
                        {GAMES.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Room code (share with friends):
                    <input
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        placeholder="ABC123"
                        style={inputStyle}
                        />
                </label>

                <label>
                    Room name
                    <input
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="My Soullink"
                        style={inputStyle}
                        />
                </label>

                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <button
                        onClick={() => props.onCreate({ code: normalizedRoomCode, name: roomName, game })}
                        style={{ padding: "8px 12px" }}
                    >
                        Create
                    </button>
                    <button
                        onClick={() => props.onJoin({ code: normalizedRoomCode })}
                        style={{ padding: "8px 12px" }}
                        >
                        Join
                    </button>
                </div>

                <div style={{ fontSize: 12, opacity: 0.7, textAlign: "center" }}>
                    Up to 3 players per room.
                </div>
            </div>
        </div>
    );
}