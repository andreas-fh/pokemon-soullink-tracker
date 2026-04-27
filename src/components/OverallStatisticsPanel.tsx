export function OverallStatisticsPanel() {
    return (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <h2>Overall Statistics</h2>

            <div style={{ width: "min(520px, 100%)", margin: "0 auto", textAlign: "left" }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>
                        <strong>Total deaths:</strong> (todo)
                    </li>
                    <li>
                        <strong>Deaths per person:</strong> (todo)
                    </li>
                    <li>
                        <strong>% of runs that made it past Gym 1:</strong> (todo)
                    </li>
                    <li>
                        <strong>% of runs that made it past Gym 2</strong> (todo)
                    </li>
                </ul>
            </div>
        </div>
    );
}