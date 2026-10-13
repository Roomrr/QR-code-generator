import React, { useState, useEffect } from "react";
import {
  QrCode,
  ChartNoAxesCombined,
  Settings,
  ArrowUpRight,
  ChevronDown,
  LogOut,
  Globe,
  Menu,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { api } from "./api";
import { downloadQR } from "./qr";
import { defaultDesign } from "../shared/design";
import { IconButton, Toast } from "./components/ui";
import { Auth } from "./components/Auth";
import { Dashboard } from "./components/Dashboard";
import { Editor } from "./components/Editor";
import { AnalyticsOverview, AnalyticsDetail } from "./components/Analytics";
const Admin = React.lazy(() =>
  import("./components/Admin").then((m) => ({ default: m.Admin })),
);
import { SettingsPage } from "./components/Settings";

export function App() {
  const [user, setUser] = useState(null),
    [initial, setInitial] = useState(true),
    [config, setConfig] = useState(null),
    [codes, setCodes] = useState([]),
    [page, setPage] = useState(
      window.location.pathname === "/admin" ? "admin" : "codes",
    ),
    [editor, setEditor] = useState(null),
    [analytics, setAnalytics] = useState(null),
    [toast, setToast] = useState(null),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [loadError, setLoadError] = useState("");
  function notify(message, error = false) {
    setToast({ message, error });
  }
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function refreshUser() {
    const u = await api("/auth/me");
    setUser(u);
    return u;
  }
  function navigate(id) {
    setPage(id);
    window.history.replaceState({}, "", id === "admin" ? "/admin" : "/app");
  }
  async function load() {
    try {
      setLoadError("");
      setCodes(await api("/qrs"));
    } catch (e) {
      setLoadError(e.message);
      if (e.status === 401 || e.status === 403) setUser(null);
    }
  }
  useEffect(() => {
    Promise.all([
      api("/config").then(setConfig),
      api("/auth/me")
        .then(setUser)
        .catch((e) => {
          if (e.status !== 401) throw e;
        }),
    ])
      .catch((e) => setLoadError(e.message))
      .finally(() => setInitial(false));
  }, []);
  useEffect(() => {
    if (user?.access.allowed) load();
    if (user && ["/login", "/register"].includes(window.location.pathname))
      window.history.replaceState({}, "", "/app");
  }, [user?.id, user?.access.allowed]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(
      () =>
        refreshUser().catch((e) => {
          if ([401, 403].includes(e.status)) setUser(null);
        }),
      60000,
    );
    return () => clearInterval(timer);
  }, [user?.id]);
  async function mutate(fn, message) {
    setBusy(true);
    try {
      await fn();
      await load();
      notify(message);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      setCodes([]);
      setEditor(null);
      setAnalytics(null);
      window.location.href = "/login";
    } catch (e) {
      notify(e.message, true);
    }
  }
  async function download(q, format) {
    setBusy(true);
    try {
      await downloadQR(q, format);
      notify(`${format.toUpperCase()} downloaded`);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }
  const total = codes.reduce((s, q) => s + q.total_scans, 0);
  if (initial)
    return (
      <div className="loading-screen">
        <div className="brand">
          <span className="brand-icon">
            <QrCode />
          </span>
          relay<span className="brand-dot">.</span>
        </div>
        <LoaderCircle className="spin" />
      </div>
    );
  if (!user)
    return (
      <>
        <Auth
          config={config}
          onLogin={setUser}
          error={loadError}
          initialMode={
            window.location.pathname === "/register" ? "register" : "login"
          }
        />
        {toast && <Toast toast={toast} />}
      </>
    );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("codes");
            setEditor(null);
          }}
        >
          <span className="brand-icon">
            <QrCode size={23} />
          </span>
          relay<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>Your workspace</strong>
            <small>Personal workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="workspace-access">
          <ShieldCheck size={14} />
          <span>Free access</span>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {[
            ["codes", QrCode, "My QR codes"],
            ["analytics", ChartNoAxesCombined, "Analytics"],
            ["settings", Settings, "Settings & data"],
            ...(user.role === "superadmin"
              ? [["admin", ShieldCheck, "Admin panel"]]
              : []),
          ].map(([id, Icon, label]) => (
            <button
              className={page === id ? "nav-active" : ""}
              key={id}
              onClick={() => {
                navigate(id);
                setEditor(null);
                setAnalytics(null);
                setMobile(false);
              }}
            >
              <Icon size={19} />
              {label}
              {id === "codes" && (
                <span className="nav-count">{codes.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="ownership-note">
            <Globe size={20} />
            <strong>Your links. Your home.</strong>
            <p>
              Built to move with you.
              <br />
              Your QR codes stay connected.
            </p>
            <button
              onClick={() => {
                navigate("settings");
                setEditor(null);
              }}
            >
              Portability guide <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="profile" onClick={logout} title="Sign out">
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {mobile && (
        <div className="mobile-backdrop" onClick={() => setMobile(false)} />
      )}
      <main className="main">
        <header className="topbar">
          <div>
            <IconButton
              label="Open menu"
              className="mobile-menu icon-button"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </IconButton>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {editor
                ? "QR code editor"
                : page === "codes"
                  ? "My QR codes"
                  : page === "analytics"
                    ? "Analytics"
                    : page === "admin"
                      ? "Admin panel"
                      : "Settings & data"}
            </strong>
          </div>
          <span className="topbar-badge">
            <span className="status-dot" /> All systems yours
          </span>
        </header>
        <div className="content">
          {loadError && (
            <div className="error-banner">
              {loadError}
              <button onClick={load}>Retry</button>
            </div>
          )}
          {page === "admin" ? (
            <React.Suspense fallback={<LoaderCircle className="spin" />}>
              <Admin notify={notify} />
            </React.Suspense>
          ) : editor ? (
            <Editor
              key={editor.id || "new"}
              record={editor}
              config={config}
              onBack={() => setEditor(null)}
              onSave={async (input) => {
                const saved = await api(
                  editor.id ? `/qrs/${editor.id}` : "/qrs",
                  { method: editor.id ? "PUT" : "POST", body: input },
                );
                await load();
                setEditor(saved);
                notify(
                  editor.id
                    ? "Changes saved. Your permanent link is unchanged."
                    : "Your dynamic QR code is ready.",
                );
                return saved;
              }}
              onDownload={download}
            />
          ) : analytics ? (
            <AnalyticsDetail
              record={analytics}
              onBack={() => setAnalytics(null)}
            />
          ) : page === "codes" ? (
            <Dashboard
              codes={codes}
              total={total}
              busy={busy}
              onCreate={() => setEditor({ design: { ...defaultDesign } })}
              onEdit={setEditor}
              onAnalytics={setAnalytics}
              onDownload={download}
              onToggle={(q) =>
                mutate(
                  () =>
                    api(`/qrs/${q.id}`, {
                      method: "PUT",
                      body: { ...q, active: !q.active },
                    }),
                  q.active ? "QR code paused" : "QR code activated",
                )
              }
              onDelete={(q) =>
                mutate(
                  () => api(`/qrs/${q.id}`, { method: "DELETE" }),
                  "QR code deleted",
                )
              }
              notify={notify}
            />
          ) : page === "analytics" ? (
            <AnalyticsOverview
              codes={codes}
              total={total}
              onSelect={setAnalytics}
            />
          ) : (
            <SettingsPage
              config={config}
              user={user}
              notify={notify}
              onImport={load}
              accessAllowed={user.access.allowed}
            />
          )}
        </div>
        <footer>
          Made for the long run.
          <span>Dynamic links. Lasting possibilities.</span>
        </footer>
      </main>
      {toast && <Toast toast={toast} />}
    </div>
  );
}
