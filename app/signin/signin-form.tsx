"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "enter" | "confirm-create";

export default function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/";
  const [pin, setPin] = useState("");
  const [mode, setMode] = useState<Mode>("enter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(create: boolean) {
    setLoading(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin, ...(create ? { create: true } : {}) }),
      });
    } catch {
      setLoading(false);
      setError("Network error. Try again.");
      return;
    }
    const data = await res.json().catch(() => ({}) as { ok?: boolean; reason?: string });
    setLoading(false);

    if (data.ok) {
      router.push(from);
      router.refresh();
      return;
    }
    if (data.reason === "unknown_pin") {
      setMode("confirm-create");
      return;
    }
    if (data.reason === "bootstrap_failed") {
      setError("Couldn't set up the account. Try again.");
      return;
    }
    setError("Enter a 4–12 digit PIN.");
  }

  function submitEnter(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length < 4) {
      setError("Enter a 4–12 digit PIN.");
      return;
    }
    void post(false);
  }

  function resetToEnter() {
    setMode("enter");
    setPin("");
    setError(null);
  }

  return (
    <main className="min-h-dvh flex items-stretch justify-center" style={{ background: "var(--bp-bg)" }}>
      <div
        className="w-full max-w-[420px] flex flex-col"
        style={{ padding: "120px 28px 60px", justifyContent: "space-between" }}
      >
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-extrabold text-lg"
              style={{ background: "var(--bp-accent)", color: "#fff", letterSpacing: -1 }}
            >
              BP
            </div>
            <div className="text-[28px] font-extrabold tracking-[-0.03em]">BenchPilot</div>
          </div>
          <div className="text-sm" style={{ color: "var(--bp-text-muted)" }}>
            Lifting tracker
          </div>
        </div>

        {mode === "enter" ? (
          <form onSubmit={submitEnter} className="flex flex-col gap-3.5 mt-12">
            <div className="eyebrow ml-1">PIN</div>
            <div
              className="surface flex items-center px-5 font-mono text-2xl tracking-[6px]"
              style={{
                height: 64,
                background: "var(--bp-surface)",
                border: "1px solid var(--bp-border)",
                borderRadius: 16,
              }}
            >
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                value={pin}
                maxLength={12}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ""));
                  setError(null);
                }}
                placeholder="••••"
                className="bg-transparent outline-none flex-1 text-white font-mono"
                style={{ letterSpacing: 6 }}
                data-testid="pin-input"
              />
            </div>
            {error ? (
              <div style={{ color: "var(--bp-accent)", fontSize: 13 }} data-testid="auth-error">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full font-bold transition-transform active:scale-[0.985]"
              style={{
                height: 64,
                borderRadius: 16,
                background: "var(--bp-accent)",
                color: "#fff",
                fontSize: 17,
                border: "none",
                cursor: "pointer",
              }}
              data-testid="signin-submit"
            >
              {loading ? "Unlocking…" : "Continue"}
            </button>
            <div
              className="text-center mt-1"
              style={{ color: "var(--bp-text-faint)", fontSize: 12 }}
            >
              New here? Enter a PIN to create an account.
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3.5 mt-12">
            <div className="eyebrow ml-1">New account</div>
            <div
              className="surface"
              style={{
                background: "var(--bp-surface)",
                border: "1px solid var(--bp-border)",
                borderRadius: 16,
                padding: "18px 18px",
              }}
            >
              <div className="text-[15px] font-semibold">No account uses that PIN yet.</div>
              <div className="text-sm mt-1.5" style={{ color: "var(--bp-text-muted)" }}>
                Create a new account with this PIN? You&apos;ll get a fresh 14-week program.
                Keep the PIN safe — it&apos;s the only way back in.
              </div>
            </div>
            {error ? (
              <div style={{ color: "var(--bp-accent)", fontSize: 13 }} data-testid="auth-error">
                {error}
              </div>
            ) : null}
            <button
              type="button"
              disabled={loading}
              onClick={() => void post(true)}
              className="w-full font-bold transition-transform active:scale-[0.985]"
              style={{
                height: 64,
                borderRadius: 16,
                background: "var(--bp-accent)",
                color: "#fff",
                fontSize: 17,
                border: "none",
                cursor: "pointer",
              }}
              data-testid="create-account"
            >
              {loading ? "Creating…" : "Create account"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={resetToEnter}
              className="w-full font-semibold"
              style={{
                height: 52,
                borderRadius: 16,
                background: "transparent",
                color: "var(--bp-text-muted)",
                fontSize: 15,
                border: "1px solid var(--bp-border)",
                cursor: "pointer",
              }}
              data-testid="use-different-pin"
            >
              Use a different PIN
            </button>
          </div>
        )}

        <div
          className="text-center font-mono mt-12"
          style={{ color: "var(--bp-text-faint)", fontSize: 11 }}
        >
          v1.0
        </div>
      </div>
    </main>
  );
}
