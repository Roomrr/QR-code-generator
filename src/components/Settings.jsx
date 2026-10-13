import React, { useState } from "react";
import {
  Settings,
  Download,
  ShieldCheck,
  Upload,
  Globe,
  Info,
} from "lucide-react";
import { api, saveJSON } from "../api";

export function SettingsPage({
  config,
  user,
  notify,
  onImport,
  accessAllowed = true,
}) {
  const [busy, setBusy] = useState(false),
    [pending, setPending] = useState(null),
    [error, setError] = useState("");
  async function exportData() {
    setBusy(true);
    try {
      saveJSON(
        await api("/export"),
        `relay-${new Date().toISOString().slice(0, 10)}.json`,
      );
      notify("Workspace export downloaded");
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }
  async function selectImport(e) {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024)
        throw Error("Choose an export under 20 MB.");
      const data = JSON.parse(await file.text());
      if (
        data.format !== "relay-account-v1" ||
        !Array.isArray(data.codes) ||
        !Array.isArray(data.scans)
      )
        throw Error("Choose a valid Relay workspace export.");
      setPending(data);
      setError("");
    } catch (e) {
      notify(e.message, true);
    }
    e.target.value = "";
  }
  async function restore() {
    setBusy(true);
    setError("");
    try {
      const result = await api("/import", { method: "POST", body: pending });
      await onImport();
      setPending(null);
      notify(
        `Imported ${result.importedCodes} QR codes and ${result.importedScans} scans.`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BUILT TO BELONG TO YOU</span>
          <h1>
            Settings & data<span className="heading-dot">.</span>
          </h1>
          <p>Your workspace, wherever you call home.</p>
        </div>
      </div>
      <div className="settings-layout">
        <section className="panel">
          <div className="panel-heading">
            <span className="setting-icon">
              <Globe />
            </span>
            <div>
              <h2>Your permanent domain</h2>
              <p>The home of every new QR code.</p>
            </div>
          </div>
          <div className="domain-display">
            <ShieldCheck size={20} />
            <code>{config?.qrBaseUrl}</code>
          </div>
          <p className="body-copy">
            New codes use this redirect domain. Existing codes retain their
            original permanent URLs, even when your server or configuration
            changes.
          </p>
          <div className="inline-tip">
            <Info size={17} /> Configure your domain using{" "}
            <code>QR_BASE_URL</code> on the server. Keep every original redirect
            domain pointing to the active deployment.
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <span className="setting-icon">
              <Download />
            </span>
            <div>
              <h2>Take your workspace with you</h2>
              <p>Every design, destination, and connection.</p>
            </div>
          </div>
          <p className="body-copy">
            Export your QR codes, embedded logos, and scan history as a portable
            JSON file. Original identifiers and permanent URLs are preserved.
          </p>
          <div className="settings-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={exportData}
            >
              <Download size={17} /> Export workspace
            </button>
            <label
              className={`button secondary ${busy || !accessAllowed ? "disabled" : ""}`}
            >
              <Upload size={17} /> Import workspace
              <input
                type="file"
                accept=".json,application/json"
                hidden
                onChange={selectImport}
                disabled={busy || !accessAllowed}
              />
            </label>
          </div>
          <small className="muted">
            Imports require active management access and add new codes. Existing
            IDs are never overwritten. Full database backups also preserve
            accounts; see README.md.
          </small>
        </section>
        <section className="panel migration-guide">
          <span className="eyebrow">A SIMPLE HANDOVER</span>
          <h2>A new server. The same connections.</h2>
          <ol>
            {[
              [
                "Back up your data",
                "Export the full database with the included backup tool. Keep your environment configuration securely.",
              ],
              [
                "Set up your new home",
                "Deploy the frontend, API, and database using Docker Compose, then restore your backup into the empty database.",
              ],
              [
                "Keep your permanent domain",
                "Point the original QR redirect domain to the new server. Configure HTTPS before switching DNS.",
              ],
              [
                "Test and make the switch",
                "Scan an existing code and verify its destination. Keep the previous server available until DNS changes finish.",
              ],
            ].map(([heading, body]) => (
              <li key={heading}>
                <strong>{heading}</strong>
                <p>{body}</p>
              </li>
            ))}
          </ol>
          <div className="inline-tip">
            <ShieldCheck size={17} /> Printed codes depend on their original
            domain. Retain ownership and keep it active.
          </div>
        </section>
        <section className="panel account-panel">
          <h2>Your account</h2>
          <div>
            <span>Name</span>
            <strong>{user.name}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{user.email}</strong>
          </div>
          <div>
            <span>Workspace</span>
            <strong>Personal · PostgreSQL</strong>
          </div>
          <p className="body-copy">
            Your account owns its QR codes. Management and exports are available
            only when signed in.
          </p>
        </section>
      </div>
      {pending && (
        <div className="modal-backdrop">
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
          >
            <h2 id="import-title">Bring your connections home.</h2>
            <p>
              Import {pending.codes.length} QR codes and {pending.scans.length}{" "}
              scan records? Their original URLs are preserved. For printed codes
              to work, their domains must point to this deployment.
            </p>
            {error && <div className="error-banner">{error}</div>}
            <div className="dialog-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setPending(null)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={restore}
              >
                {busy ? "Importing…" : "Import workspace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
