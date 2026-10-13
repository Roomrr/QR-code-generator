import React, { useState } from "react";
import {
  QrCode,
  ArrowLeft,
  Download,
  Copy,
  Check,
  Link,
  X,
  ShieldCheck,
  Upload,
  Globe,
  LoaderCircle,
  Info,
  RefreshCw,
} from "lucide-react";
import { resizeLogo } from "../qr";
import { qrSchema, contrast } from "../../shared/design";
import { QRPreview, IconButton } from "./ui";

export function Editor({ record, config, onBack, onSave, onDownload }) {
  const [name, setName] = useState(record.name || ""),
    [destination, setDestination] = useState(record.destination || ""),
    [folder, setFolder] = useState(record.folder || ""),
    [active, setActive] = useState(record.active ?? true),
    [design, setDesign] = useState(record.design),
    [tab, setTab] = useState("style"),
    [check, setCheck] = useState({ status: "checking" }),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [format, setFormat] = useState("png"),
    [copied, setCopied] = useState(false);
  const url =
    record.redirect_url ||
    `${config?.qrBaseUrl || window.location.origin}/r/000000000000000000000`;
  const patch = (key, value) => setDesign((d) => ({ ...d, [key]: value }));
  const dirty =
    !record.id ||
    JSON.stringify({ name, destination, folder, active, design }) !==
      JSON.stringify({
        name: record.name,
        destination: record.destination,
        folder: record.folder,
        active: record.active,
        design: record.design,
      });
  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const input = qrSchema.parse({
        name,
        destination,
        folder,
        active,
        design,
      });
      if (check.status !== "valid")
        throw Error("Wait for a scannable preview before saving.");
      await onSave(input);
    } catch (e) {
      setError(e.issues?.map((i) => i.message).join(" ") || e.message);
    } finally {
      setSaving(false);
    }
  }
  async function logo(e) {
    try {
      if (e.target.files[0]) {
        const logo = await resizeLogo(e.target.files[0]);
        setDesign((d) => ({ ...d, logo, errorCorrection: "H" }));
        setError("");
      }
    } catch (e) {
      setError(e.message);
    }
    e.target.value = "";
  }
  function back() {
    if (
      !dirty ||
      window.confirm("Leave the editor and discard unsaved changes?")
    )
      onBack();
  }
  return (
    <>
      <button className="back-link" onClick={back}>
        <ArrowLeft size={16} /> Back to my QR codes
      </button>
      <div className="page-heading editor-heading">
        <div>
          <span className="eyebrow">A CONNECTION, MADE YOURS</span>
          <h1>
            {record.id ? "Edit QR code" : "Create a QR code"}
            <span className="heading-dot">.</span>
          </h1>
          <p>Choose its destination. Give it a little personality.</p>
        </div>
        <span className="dynamic-badge">
          <RefreshCw size={15} /> Dynamic QR code
        </span>
      </div>
      <form onSubmit={submit} className="editor-layout">
        <div className="editor-controls">
          <section className="panel">
            <div className="panel-heading">
              <span className="step-number">01</span>
              <div>
                <h2>The connection</h2>
                <p>Where would you like to take people?</p>
              </div>
            </div>
            <label>
              QR code name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Our summer menu"
                required
                maxLength={100}
              />
            </label>
            <label>
              Destination URL
              <div className="input-icon">
                <Globe size={17} />
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  type="url"
                  required
                  maxLength={2048}
                  placeholder="https://your-website.com"
                />
              </div>
              <small>
                You can change this anytime. Your QR code stays the same.
              </small>
            </label>
            <div className="field-row">
              <label>
                Collection <span className="optional">optional</span>
                <input
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. Marketing"
                />
              </label>
              <label>
                Status
                <select
                  value={active ? "active" : "paused"}
                  onChange={(e) => setActive(e.target.value === "active")}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </label>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <span className="step-number">02</span>
              <div>
                <h2>The personality</h2>
                <p>A small code with your signature.</p>
              </div>
            </div>
            <div className="editor-tabs">
              {["style", "colors", "logo", "advanced"].map((t) => (
                <button
                  type="button"
                  className={tab === t ? "selected" : ""}
                  key={t}
                  onClick={() => setTab(t)}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            {tab === "style" && (
              <>
                <label>Module pattern</label>
                <div className="pattern-grid">
                  {[
                    ["square", "Classic"],
                    ["rounded", "Rounded"],
                    ["dots", "Dots"],
                    ["extra-rounded", "Soft"],
                    ["classy", "Classy"],
                    ["classy-rounded", "Elegant"],
                  ].map(([value, label]) => (
                    <button
                      type="button"
                      className={design.dots === value ? "selected" : ""}
                      key={value}
                      onClick={() => patch("dots", value)}
                    >
                      <div className={`pattern-sample ${value}`}>
                        {Array.from({ length: 16 }, (_, i) => (
                          <i key={i} />
                        ))}
                      </div>
                      <span>{label}</span>
                      {design.dots === value && <Check size={13} />}
                    </button>
                  ))}
                </div>
                <div className="field-row">
                  <label>
                    Corner markers
                    <select
                      value={design.corners}
                      onChange={(e) => patch("corners", e.target.value)}
                    >
                      <option value="square">Square</option>
                      <option value="extra-rounded">Soft square</option>
                      <option value="dot">Circle</option>
                    </select>
                  </label>
                  <label>
                    Corner centers
                    <select
                      value={design.cornerDots}
                      onChange={(e) => patch("cornerDots", e.target.value)}
                    >
                      <option value="dot">Circle</option>
                      <option value="square">Square</option>
                    </select>
                  </label>
                </div>
                <div className="inline-tip">
                  <Info size={16} /> Simple shapes give your code the best
                  chance to scan.
                </div>
              </>
            )}
            {tab === "colors" && (
              <>
                <div className="field-row">
                  {[
                    ["foreground", "QR color"],
                    ["background", "Background"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <div className="color-input">
                        <input
                          aria-label={label}
                          type="color"
                          value={design[key]}
                          onChange={(e) => patch(key, e.target.value)}
                        />
                        <span>{design[key].toUpperCase()}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <label>Curated palettes</label>
                <div className="palette-grid">
                  {[
                    ["Forest", "#263d2c", "#ffffff"],
                    ["Ink", "#172126", "#ffffff"],
                    ["Terracotta", "#853e2c", "#fff8f0"],
                    ["Indigo", "#393677", "#f5f4ff"],
                    ["Berry", "#733551", "#fff5f8"],
                    ["Ocean", "#1c5061", "#f4fbff"],
                  ].map(([label, fg, bg]) => (
                    <button
                      type="button"
                      key={label}
                      onClick={() =>
                        setDesign((d) => ({
                          ...d,
                          foreground: fg,
                          background: bg,
                        }))
                      }
                    >
                      <span style={{ background: bg, color: fg }}>
                        <QrCode size={25} />
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="inline-tip">
                  <ShieldCheck size={16} /> Contrast ratio:{" "}
                  {contrast(design.foreground, design.background).toFixed(1)}:1.
                  Dark modules on a light background scan best.
                </div>
              </>
            )}
            {tab === "logo" && (
              <>
                <label className="upload-area">
                  <Upload size={26} />
                  <strong>
                    {design.logo
                      ? "Replace your logo"
                      : "Add your brand to the center"}
                  </strong>
                  <span>PNG, JPG, or WebP · up to 5 MB</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={logo}
                  />
                </label>
                {design.logo && (
                  <div className="logo-current">
                    <img src={design.logo} alt="Current logo" />
                    <span>Logo embedded in your QR design</span>
                    <button
                      type="button"
                      onClick={() => patch("logo", "")}
                      aria-label="Remove logo"
                    >
                      <X size={17} />
                    </button>
                  </div>
                )}
                <label>
                  Logo size{" "}
                  <span className="range-value">
                    {Math.round(design.logoSize * 100)}%
                  </span>
                  <input
                    type="range"
                    min="0.1"
                    max="0.22"
                    step="0.01"
                    value={design.logoSize}
                    onChange={(e) => patch("logoSize", Number(e.target.value))}
                  />
                </label>
                <div className="inline-tip">
                  <ShieldCheck size={16} /> Logos use high error correction and
                  a limited size to protect scannability.
                </div>
              </>
            )}
            {tab === "advanced" && (
              <>
                <div className="field-row">
                  <label>
                    Dimensions
                    <select
                      value={design.size}
                      onChange={(e) => patch("size", Number(e.target.value))}
                    >
                      {[256, 512, 1024, 2048].map((v) => (
                        <option value={v} key={v}>
                          {v} × {v} px
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Error correction
                    <select
                      value={design.errorCorrection}
                      disabled={!!design.logo}
                      onChange={(e) => patch("errorCorrection", e.target.value)}
                    >
                      {[
                        ["L", "Low · L"],
                        ["M", "Medium · M"],
                        ["Q", "Quartile · Q"],
                        ["H", "High · H"],
                      ].map(([v, l]) => (
                        <option value={v} key={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Requested margin{" "}
                  <span className="range-value">{design.margin} px</span>
                  <input
                    type="range"
                    min="0"
                    max={Math.min(128, design.size / 4)}
                    value={design.margin}
                    onChange={(e) => patch("margin", Number(e.target.value))}
                  />
                </label>
                <div className="inline-tip">
                  <Info size={16} /> A minimum quiet zone of four modules is
                  always preserved. SVG exports scale without losing sharpness.
                </div>
              </>
            )}
          </section>
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <div className="save-row">
            <button className="button secondary" type="button" onClick={back}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={saving || check.status !== "valid"}
            >
              {saving ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Check size={17} />
              )}{" "}
              {record.id ? "Save changes" : "Create QR code"}
            </button>
          </div>
        </div>
        <aside className="preview-panel">
          <div className="preview-heading">
            <span>LIVE PREVIEW</span>
            <span className="live-label">
              <span className="status-dot" /> Updates as you go
            </span>
          </div>
          <div className="editor-preview">
            <QRPreview url={url} design={design} onState={setCheck} />
          </div>
          <div
            className={`scan-check ${check.status === "invalid" ? "invalid" : ""}`}
          >
            {check.status === "checking" ? (
              <LoaderCircle size={16} className="spin" />
            ) : check.status === "valid" ? (
              <ShieldCheck size={17} />
            ) : (
              <Info size={17} />
            )}
            <span>
              {check.status === "checking"
                ? "Checking scannability…"
                : check.message}
            </span>
          </div>
          <div className="preview-caption">
            <h3>{name || "Your next connection"}</h3>
            <p>
              {design.size} × {design.size} px <span>·</span>{" "}
              {design.errorCorrection} error correction
            </p>
          </div>
          {record.id ? (
            <div className="permanent-link">
              <label>YOUR PERMANENT LINK</label>
              <div>
                <span title={url}>{url}</span>
                <IconButton
                  label="Copy permanent link"
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      setError(
                        "Clipboard unavailable. Select and copy the displayed URL.",
                      );
                    }
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </IconButton>
              </div>
              <small>
                This is what your QR code contains. It never changes.
              </small>
            </div>
          ) : (
            <div className="preview-placeholder">
              <Link size={16} /> Your permanent link is assigned when you create
              this code.
            </div>
          )}
          <div className="download-row">
            <select
              aria-label="Export format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option value="png">PNG image</option>
              <option value="svg">SVG vector</option>
              <option value="pdf">PDF document</option>
            </select>
            <button
              type="button"
              className="button primary"
              disabled={
                !record.id || dirty || check.status !== "valid" || saving
              }
              onClick={() => onDownload(record, format)}
            >
              <Download size={17} /> Download
            </button>
          </div>
          <p className="preview-footnote">
            {dirty
              ? "Save your changes before downloading."
              : "For print, test a scan at the intended size and distance."}
          </p>
        </aside>
      </form>
    </>
  );
}
