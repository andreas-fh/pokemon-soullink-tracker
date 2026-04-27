import { useMemo, useState } from "react";
import type { AttemptRow } from "../types";

export function AttemptPicker(props: {
    attempts: AttemptRow[];
    activeAttemptId: string | null;
    onSelect: (attemptId: string) => void;
    onCreate: (args: { attemptNumber: number }) => void | Promise<void>;
}) {
    const [attemptNumber, setAttemptNumber] = useState(1);

    const canCreate = useMemo(() => attemptNumber > 0, [attemptNumber]);

    return (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <h2>Attempts</h2>

            <div style={{ maxWidth: "min(520px, 100%)", margin: "0 auto", textAlign: "left"}}>
                <label>
                    Active attempt:
                    <select
                        value={props.activeAttemptId ?? ""}
                        onChange={(e) => props.onSelect(e.target.value)}
                        style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
                    >
                        <option value="" disabled>
                            Select an attempt...
                        </option>
                        {props.attempts.map((a) => (
                            <option key={a.id} value={a.id}>
                                Attempt {a.attempt_number}
                                {a.name ? ` - ${a.name}` : ""}
                            </option>
                        ))}
                    </select>
                </label>

                <div style={{ marginTop: 12, fontWeight: 600 }}>New attempt</div>

                <label style={{ display: "block", marginTop: 8 }}>
                    Attempt number:
                    <input
                        type="number"
                        value={attemptNumber}
                        onChange={(e) => setAttemptNumber(Number(e.target.value))}
                        style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
                        min={1}
                        />
                </label>

                <button
                    disabled={!canCreate}
                    onClick={() => props.onCreate({ attemptNumber})}
                    style={{ marginTop: 10, padding: "8px 12px" }}
                    >
                    New attempt
                </button>
            </div>
        </div>
    );
}