import React, { useState, useEffect } from "react";
import { api } from "../api";
export function Admin({ notify }) {
  const [tab, setTab] = useState("users"),
    [data, setData] = useState(null),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setError("");
      setData(
        await api(
          tab === "users"
            ? `/admin/users?page=${page}&search=${encodeURIComponent(search)}`
            : tab === "audit"
              ? `/admin/audit?page=${page}`
              : "/admin/settings",
        ),
      );
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    setData(null);
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [tab, search, page]);
  async function changeUser(u, status) {
    const reason = window.prompt(
      `Change ${u.email} to ${status}? Enter a reason for the audit log:`,
    );
    if (!reason) return;
    setBusy(true);
    try {
      await api(`/admin/users/${u.id}`, {
        method: "PATCH",
        body: { status, reason },
      });
      await load();
      notify("Account status updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/admin/settings", { method: "PUT", body: data });
      notify("Platform settings saved.");
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
          <span className="eyebrow">SUPER ADMINISTRATOR</span>
          <h1>Platform control.</h1>
          <p>Manage accounts and site settings. Everyone has free access.</p>
        </div>
      </div>
      <div className="admin-tabs">
        {[
          ["users", "Users"],
          ["settings", "Platform settings"],
          ["audit", "Audit log"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <div className="error-banner">{error}</div>}
      {tab === "users" && (
        <label className="search-field">
          Search users
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Name or email"
          />
        </label>
      )}
      {data &&
        (tab === "settings" ? (
          <form className="admin-settings panel" onSubmit={save}>
            {Object.entries(data).map(([key, value]) => (
              <label key={key}>
                {key.replace(/([A-Z])/g, " $1")}
                {key.endsWith("Policy") ? (
                  <textarea
                    rows={8}
                    value={value}
                    onChange={(e) =>
                      setData({ ...data, [key]: e.target.value })
                    }
                  />
                ) : (
                  <input
                    value={value}
                    onChange={(e) =>
                      setData({ ...data, [key]: e.target.value })
                    }
                  />
                )}
              </label>
            ))}
            <button className="button primary" disabled={busy}>
              Save settings
            </button>
          </form>
        ) : (
          <section className="panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {(tab === "users"
                      ? [
                          "Name",
                          "Email",
                          "Status",
                          "Access",
                          "QR codes",
                          "Actions",
                        ]
                      : ["Date", "Administrator", "Action", "Target", "Details"]
                    ).map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) =>
                    tab === "users" ? (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.email}</td>
                        <td>{r.status}</td>
                        <td>{r.access.type}</td>
                        <td>{r.qr_count}</td>
                        <td>
                          {r.role !== "superadmin" && (
                            <button
                              className="button secondary"
                              disabled={busy}
                              onClick={() =>
                                changeUser(
                                  r,
                                  r.status === "active"
                                    ? "suspended"
                                    : "active",
                                )
                              }
                            >
                              {r.status === "active" ? "Suspend" : "Reactivate"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      <tr key={r.id}>
                        <td>{new Date(r.created_at).toLocaleString()}</td>
                        <td>{r.actor_email}</td>
                        <td>{r.action}</td>
                        <td>{r.target_id || "Platform"}</td>
                        <td>{r.details}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {data.total} records · Page {page}
              </span>
              <button
                className="button secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <button
                className="button secondary"
                disabled={page * 50 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </section>
        ))}
    </>
  );
}
