import React, { useState } from "react";
import {
  QrCode,
  ArrowUpRight,
  Link,
  ArrowRight,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { api } from "../api";
import { defaultDesign } from "../../shared/design";
import { QRPreview } from "./ui";

export function Auth({ config, onLogin, error, initialMode = "login" }) {
  const [register, setRegister] = useState(initialMode === "register"),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(""),
    [pending, setPending] = useState(null),
    [credentials, setCredentials] = useState(null),
    [cooldown, setCooldown] = useState(0);
  React.useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(
      () => setCooldown((c) => Math.max(0, c - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function resend() {
    setBusy(true);
    setErr("");
    try {
      const response = await api("/auth/resend", {
        method: "POST",
        body: credentials,
      });
      setCooldown(response.resendAfterSeconds);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (pending) {
        onLogin(
          await api("/auth/verify", {
            method: "POST",
            body: { email: pending.email, code: data.code },
          }),
        );
      } else {
        const response = await api(
          register ? "/auth/register" : "/auth/login",
          { method: "POST", body: data },
        );
        if (response.verificationRequired) {
          setPending(response);
          setCredentials({ email: data.email, password: data.password });
          setCooldown(response.resendAfterSeconds || 0);
        } else onLogin(response);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-icon">
            <QrCode />
          </span>
          relay<span className="brand-dot">.</span>
        </div>
        <div>
          <span className="eyebrow">
            A LITTLE CODE. A WORLD OF POSSIBILITIES.
          </span>
          <h1>
            Connections that
            <br />
            keep going.
          </h1>
          <p>
            Create a code once. Change where it goes.
            <br />
            Make every connection look like you.
          </p>
          <div className="auth-visual">
            <div className="floating-label">
              <span className="status-dot" /> Always connected
            </div>
            <QRPreview
              url="https://example.com/r/your-permanent-link"
              design={defaultDesign}
            />
            <div className="visual-caption">
              <Link size={17} /> One code. Endless destinations.{" "}
              <ArrowUpRight size={18} />
            </div>
          </div>
        </div>
        <small>YOUR LINKS. YOUR DATA. YOUR HOME.</small>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <a className="back-link" href="/">
            ← Back to home
          </a>
          <span className="eyebrow">WELCOME TO RELAY</span>
          <h2>
            {pending
              ? "Check your inbox."
              : register
                ? "Your next connection starts here."
                : "Good to have you back."}
          </h2>
          <p>
            {pending
              ? `Enter the six-digit verification code sent to ${pending.email}. Your free account is activated after verification.`
              : register
                ? "Create your account to start making dynamic QR codes."
                : "Sign in to your workspace and keep things moving."}
          </p>
          {pending ? (
            <label>
              Verification code
              <input
                name="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                placeholder="000000"
              />
            </label>
          ) : (
            <>
              {register && (
                <label>
                  Your name
                  <input
                    name="name"
                    required
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Alex Morgan"
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  name="email"
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  required
                  type="password"
                  minLength={register ? 8 : 1}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={
                    register ? "At least 8 characters" : "Enter your password"
                  }
                />
              </label>
            </>
          )}
          {(err || error) && <div className="error-banner">{err || error}</div>}
          <button className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                {pending
                  ? "Verify email"
                  : register
                    ? "Create account"
                    : "Sign in"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          {pending && (
            <p className="auth-switch">
              <button
                type="button"
                disabled={busy || cooldown > 0}
                onClick={resend}
              >
                {cooldown
                  ? `Resend in ${cooldown}s`
                  : "Resend verification code"}
              </button>
              <br />
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setCredentials(null);
                  setRegister(false);
                }}
              >
                Use another account
              </button>
            </p>
          )}
          {!pending && config?.registration && (
            <p className="auth-switch">
              {register ? "Already have an account?" : "New here?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setRegister(!register);
                  setErr("");
                }}
              >
                {register ? "Sign in" : "Create an account"}
              </button>
            </p>
          )}
          <div className="auth-assurance">
            <ShieldCheck size={17} /> A workspace you own, wherever you host it.
          </div>
        </form>
      </section>
    </div>
  );
}
