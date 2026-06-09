"use client";

// Catches server/client render errors below the root layout (the (app) layout
// and every page). Without this, a single bad row in a user's data 500s the
// whole screen with the opaque "server-side exception" overlay and no recovery.
// Here the user gets a retry — which re-runs the render after a fix ships — and
// the error code (digest) to report, which maps to the server log line.
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App render error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#0a0a0a",
        color: "#fafafa",
        fontFamily: "system-ui, -apple-system, sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 360, width: "100%" }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
          Something went wrong
        </div>
        <p style={{ marginTop: 10, fontSize: 14, color: "#a1a1aa", lineHeight: 1.5 }}>
          The app hit an error loading this screen. Try again — if it keeps
          happening, share the code below.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 20,
            width: "100%",
            height: 52,
            borderRadius: 14,
            border: "none",
            background: "#ff2f2f",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        {error.digest ? (
          <div
            style={{
              marginTop: 16,
              fontSize: 12,
              color: "#71717a",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            error code: {error.digest}
          </div>
        ) : null}
      </div>
    </div>
  );
}
