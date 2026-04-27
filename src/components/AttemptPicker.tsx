import type { AttemptRow } from "../types";

export type AttemptSelection =
    | { type: "attempt"; attemptId: string }
    | { type: "overall" };

export function AttemptPicker(props: {
    attempts: AttemptRow[];
    selection: AttemptSelection;
    onSelect: (selection: AttemptSelection) => void;
    onCreateNew: () => void | Promise<void>;
}) {
    const value = props.selection.type === "overall" ? "__overall__" :
        props.selection.attemptId;

    return (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <h2>Attempts</h2>

            <div style={{ maxWidth: "min(520px, 100%)", margin: "0 auto", textAlign: "left"}}>
                <label>
                    View:
                    <select
                        value={value}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (v === "__overall__") props.onSelect({ type: "overall" });
                            else props.onSelect({ type: "attempt", attemptId: v });
                        }}
                        style={{ display: "block", width: "100%", maxWidth: "100%", boxSizing: "border-box", padding: 8, marginTop: 4 }}
                    >
                        <option value="__overall__">Overall Statistics</option>

                        <optgroup label="Attempt">
                            {props.attempts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    Attempt {a.attempt_number}
                                    {a.name ? ` - ${a.name}` : ""}
                                </option>
                            ))}
                        </optgroup>
                    </select>
                </label>

                <button onClick={props.onCreateNew} style={{ marginTop: 12, padding: "8px 12px" }}>
                    New attempt
                </button>
            </div>
        </div>
    );
}