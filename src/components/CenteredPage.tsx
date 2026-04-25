import type { ReactNode } from "react";

export function CenteredPage({ children }: { children: ReactNode }) {
    return (
        <div
            style={{
                fontFamily: "system-ui",
                padding: 16,
                maxWidth: 900,
                margin: "0 auto",
                textAlign: "center",
            }}
        >
            {children}
        </div>
    );
}