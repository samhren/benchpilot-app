"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/";
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setLoading(false);
    if (res.ok) {
      router.push(from);
      router.refresh();
    } else {
      setError("Wrong password.");
      setPw("");
    }
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

        <form onSubmit={submit} className="flex flex-col gap-3.5 mt-12">
          <div className="eyebrow ml-1">Password</div>
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
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••"
              className="bg-transparent outline-none flex-1 text-white font-mono"
              style={{ letterSpacing: 6 }}
              data-testid="password-input"
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
            {loading ? "Unlocking…" : "Unlock"}
          </button>
        </form>

        <div
          className="text-center font-mono mt-12"
          style={{ color: "var(--bp-text-faint)", fontSize: 11 }}
        >
          v1.0 · single user
        </div>
      </div>
    </main>
  );
}
