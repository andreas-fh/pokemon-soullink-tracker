import type { ProfileRow } from "../types";

export function PlayersList({ profiles, myUserId }: { profiles: ProfileRow[]; myUserId: string }) {
    return (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <h2>Players in this room</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {profiles.map((p) => (
                    <li
                        key={p.id}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            padding: "8px 0",
                            border: "1px solid #eee",
                        }}
                    >
                        {p.discord_avatar_url ? (
                            <img
                                src={p.discord_avatar_url}
                                alt=""
                                width={32}
                                height={32}
                                style={{ borderRadius: "50%" }}
                            />
                        ) : (
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ddd" }} />
                        )}

                        <div style={{ textAlign: "left" }}>
                            <div style={{ fontWeight: 600 }}>
                                {p.discord_username ?? "(unknown)"}
                                {p.id === myUserId ? (
                                    <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>(you)</span>
                                ) : null}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>{p.id}</div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}