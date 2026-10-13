import React, { useState, useEffect } from "react";
import {
  QrCode,
  ChartNoAxesCombined,
  ArrowUpRight,
  ArrowLeft,
  Link,
  ScanLine,
  Globe,
  LoaderCircle,
  Info,
} from "lucide-react";
import { api } from "../api";
import { Stat, numbers } from "./ui";

export function AnalyticsOverview({ codes, total, onSelect }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE STORY BEHIND THE SCANS</span>
          <h1>
            Analytics<span className="heading-dot">.</span>
          </h1>
          <p>See where your connections are taking you.</p>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          label="Lifetime scans"
          value={numbers(total)}
          icon={ScanLine}
          detail="All successful redirect visits"
        />
        <Stat
          label="Codes with scans"
          value={codes.filter((q) => q.total_scans > 0).length}
          icon={QrCode}
          detail="Connections already in motion"
        />
        <Stat
          label="Active destinations"
          value={codes.filter((q) => q.active).length}
          icon={Link}
          detail="Open for the next visitor"
        />
      </div>
      <section className="panel analytics-panel">
        <div className="section-heading">
          <h2>QR code performance</h2>
          <span className="muted">Select a code to see its history</span>
        </div>
        {codes.length ? (
          <div className="performance-list">
            {[...codes]
              .sort((a, b) => b.total_scans - a.total_scans)
              .map((q) => (
                <button key={q.id} onClick={() => onSelect(q)}>
                  <span className="performance-icon">
                    <QrCode size={21} />
                  </span>
                  <div>
                    <strong>{q.name}</strong>
                    <small>{q.destination}</small>
                  </div>
                  <span className={`status ${q.active ? "active" : "paused"}`}>
                    {q.active ? "Active" : "Paused"}
                  </span>
                  <strong>
                    {numbers(q.total_scans)} <small>scans</small>
                  </strong>
                  <ArrowUpRight size={18} />
                </button>
              ))}
          </div>
        ) : (
          <div className="empty-state small">
            <ChartNoAxesCombined size={35} />
            <h2>Your story is just getting started.</h2>
            <p>Create a QR code and scans will appear here.</p>
          </div>
        )}
      </section>
      <div className="inline-tip">
        <Info size={17} /> Scans count visits to the redirect link, including
        repeat visits and automated requests. No IP addresses are stored.
      </div>
    </>
  );
}

export function AnalyticsDetail({ record, onBack }) {
  const [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setError("");
    api(`/qrs/${record.id}/scans?page=${page}`)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [record.id, page]);
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
    return { day, count: data?.days?.[day] || 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FOLLOW THE CONNECTION</span>
          <h1>{record.name}</h1>
          <p>Scan history and activity for this QR code.</p>
        </div>
        <span className={`status ${record.active ? "active" : "paused"}`}>
          {record.active ? "Active" : "Paused"}
        </span>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {!data && !error ? (
        <LoaderCircle className="spin" />
      ) : (
        data && (
          <>
            <div className="stats-grid">
              <Stat
                label="All-time scans"
                value={numbers(data.total)}
                icon={ScanLine}
                detail="Successful redirect requests"
              />
              <Stat
                label="Last 30 days"
                value={numbers(days.reduce((s, d) => s + d.count, 0))}
                icon={ChartNoAxesCombined}
                detail="UTC daily activity"
              />
              <Stat
                label="Mobile visits · 30 days"
                value={numbers(data.devices.Mobile || 0)}
                icon={Globe}
                detail="Based on browser user agent"
              />
            </div>
            <section className="panel">
              <div className="section-heading">
                <h2>Connections over time</h2>
                <span className="muted">Last 30 days · UTC</span>
              </div>
              <div
                className="bar-chart"
                role="img"
                aria-label={`Daily scans over the last 30 days: ${days.map((d) => `${d.day}: ${d.count}`).join(", ")}`}
              >
                {days.map((d) => (
                  <div key={d.day} title={`${d.day}: ${d.count} scans`}>
                    <span
                      style={{
                        height: `${Math.max(2, (d.count / max) * 100)}%`,
                      }}
                    />
                    <small>{d.day.slice(8)}</small>
                  </div>
                ))}
              </div>
              {data.total === 0 && (
                <p className="chart-empty">
                  No scans yet. Share your code to start a connection.
                </p>
              )}
            </section>
            <section className="panel history-panel">
              <div className="section-heading">
                <h2>Scan history</h2>
                <span className="muted">
                  {numbers(data.total)} total visits
                </span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Scanned at</th>
                      <th>Device</th>
                      <th>Browser</th>
                      <th>Referrer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((s) => (
                      <tr key={s.id}>
                        <td>{new Date(s.scanned_at).toLocaleString()}</td>
                        <td>{s.device}</td>
                        <td>{s.browser}</td>
                        <td>{s.referrer || "Direct / unknown"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.rows.length && (
                  <p className="table-empty">No visits recorded yet.</p>
                )}
              </div>
              <div className="pagination">
                <span>
                  Page {page} of {Math.max(1, Math.ceil(data.total / 50))}
                </span>
                <button
                  className="button secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  className="button secondary"
                  disabled={page * 50 >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}
