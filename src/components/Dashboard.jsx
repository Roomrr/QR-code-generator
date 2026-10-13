import React, { useState } from "react";
import {
  QrCode,
  ChartNoAxesCombined,
  ArrowUpRight,
  Plus,
  Search,
  Download,
  Copy,
  Ellipsis,
  Link,
  Folder,
  ArrowRight,
  ScanLine,
  Pause,
  Play,
  Trash2,
  Pencil,
  Globe,
  Grid2X2,
  List,
  Info,
  RefreshCw,
} from "lucide-react";
import { QRPreview, Stat, IconButton, date, numbers } from "./ui";

export function Dashboard({
  codes,
  total,
  busy,
  onCreate,
  onEdit,
  onAnalytics,
  onDownload,
  onToggle,
  onDelete,
  notify,
}) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [folder, setFolder] = useState("all"),
    [view, setView] = useState("grid"),
    [sort, setSort] = useState("newest"),
    [confirm, setConfirm] = useState(null);
  const filtered = codes
    .filter(
      (q) =>
        `${q.name} ${q.destination} ${q.folder}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (status === "all" || q.active === (status === "active")) &&
        (folder === "all" || q.folder === folder),
    )
    .sort((a, b) =>
      sort === "scans"
        ? b.total_scans - a.total_scans
        : sort === "name"
          ? a.name.localeCompare(b.name)
          : b.created_at.localeCompare(a.created_at),
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE EVERY CONNECTION COUNT</div>
          <h1>
            My QR codes<span className="heading-dot">.</span>
          </h1>
          <p>A home for your links. A little room for possibility.</p>
        </div>
        <button className="button primary" onClick={onCreate}>
          <Plus size={18} /> Create QR code
        </button>
      </div>
      <div className="stats-grid">
        <Stat
          label="Total QR codes"
          value={numbers(codes.length)}
          icon={QrCode}
          detail="Every connection, in one place"
        />
        <Stat
          label="Total scans"
          value={numbers(total)}
          icon={ScanLine}
          detail="Lifetime redirect visits"
        />
        <Stat
          label="Active QR codes"
          value={numbers(codes.filter((q) => q.active).length)}
          icon={Link}
          detail="Ready for the next connection"
        />
      </div>
      <div className="section-heading">
        <h2>
          Your collection <span>{codes.length}</span>
        </h2>
        <span className="muted">Create once. Keep it connected.</span>
      </div>
      <div className="toolbar">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="Search QR codes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, link, or collection…"
          />
        </div>
        <select
          aria-label="Status filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
        <select
          aria-label="Collection filter"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        >
          <option value="all">All collections</option>
          {[...new Set(codes.map((q) => q.folder).filter(Boolean))].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select
          aria-label="Sort QR codes"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="scans">Most scanned</option>
          <option value="name">Name A–Z</option>
        </select>
        <div className="view-switch">
          <IconButton
            label="Grid view"
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
          >
            <Grid2X2 size={17} />
          </IconButton>
          <IconButton
            label="List view"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
          >
            <List size={18} />
          </IconButton>
        </div>
      </div>
      {codes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-art">
            <QrCode size={58} strokeWidth={1.4} />
            <span>
              <Plus size={18} />
            </span>
          </div>
          <span className="eyebrow">YOUR FIRST CONNECTION</span>
          <h2>Good things start with a little code.</h2>
          <p>
            Connect your website, menu, or next big idea.
            <br />
            Give it your style. Change its destination anytime.
          </p>
          <button className="button primary" onClick={onCreate}>
            Create your first QR code <ArrowRight size={17} />
          </button>
          <div className="empty-benefits">
            <span>
              <RefreshCw size={15} /> Always editable
            </span>
            <span>
              <Pencil size={15} /> Uniquely yours
            </span>
            <span>
              <Globe size={15} /> Built to move
            </span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state small">
          <Search size={32} />
          <h2>No codes match your search.</h2>
          <p>Try another name or reset your filters.</p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery("");
              setStatus("all");
              setFolder("all");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className={`code-grid ${view === "list" ? "list-view" : ""}`}>
          {filtered.map((q) => (
            <CodeCard
              key={q.id}
              q={q}
              busy={busy}
              onEdit={onEdit}
              onAnalytics={onAnalytics}
              onDownload={onDownload}
              onToggle={onToggle}
              onDelete={setConfirm}
              notify={notify}
            />
          ))}
          <button className="new-code-card" onClick={onCreate}>
            <span>
              <Plus size={25} />
            </span>
            <strong>A new connection awaits</strong>
            <p>Create a QR code</p>
          </button>
        </div>
      )}
      <div className="tip-strip">
        <span className="tip-icon">
          <Info size={19} />
        </span>
        <div>
          <strong>One code. A destination that can evolve.</strong>
          <p>Update your link anytime. Your printed QR code keeps working.</p>
        </div>
        <button onClick={onCreate}>
          Make a connection <ArrowRight size={17} />
        </button>
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <div className="dialog-icon">
              <Trash2 />
            </div>
            <h2 id="delete-title">Delete “{confirm.name}”?</h2>
            <p>
              This permanently removes the QR code and its scan history. Printed
              codes will stop working. Pausing keeps the code available for
              later.
            </p>
            <div className="dialog-actions">
              <button
                className="button secondary"
                onClick={() => setConfirm(null)}
              >
                Keep QR code
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => {
                  onDelete(confirm);
                  setConfirm(null);
                }}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CodeCard({
  q,
  busy,
  onEdit,
  onAnalytics,
  onDownload,
  onToggle,
  onDelete,
  notify,
}) {
  const [menu, setMenu] = useState(false),
    [format, setFormat] = useState("png");
  return (
    <article className="code-card">
      <div className="card-top">
        <span className={`status ${q.active ? "active" : "paused"}`}>
          <span className="status-dot" />
          {q.active ? "Active" : "Paused"}
        </span>
        <div className="dropdown">
          <IconButton
            label={`Actions for ${q.name}`}
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
          >
            <Ellipsis size={20} />
          </IconButton>
          {menu && (
            <>
              <div className="dropdown-away" onClick={() => setMenu(false)} />
              <div className="dropdown-menu">
                {[
                  [Pencil, "Edit code", () => onEdit(q)],
                  [ChartNoAxesCombined, "Scan history", () => onAnalytics(q)],
                  [
                    q.active ? Pause : Play,
                    q.active ? "Pause code" : "Activate code",
                    () => onToggle(q),
                  ],
                  [
                    Copy,
                    "Copy permanent link",
                    async () => {
                      try {
                        await navigator.clipboard.writeText(q.redirect_url);
                        notify("Permanent link copied");
                      } catch {
                        notify(
                          "Clipboard unavailable. Copy the link from the editor.",
                          true,
                        );
                      }
                    },
                  ],
                  [Trash2, "Delete code", () => onDelete(q)],
                ].map(([Icon, text, fn]) => (
                  <button
                    key={text}
                    onClick={() => {
                      setMenu(false);
                      fn();
                    }}
                    disabled={busy}
                  >
                    <Icon size={15} />
                    {text}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <button
        className="card-qr"
        onClick={() => onEdit(q)}
        aria-label={`Edit ${q.name}`}
      >
        <QRPreview url={q.redirect_url} design={q.design} />
      </button>
      <div className="card-info">
        <h3 title={q.name}>{q.name}</h3>
        <a
          className="destination"
          href={q.destination}
          target="_blank"
          rel="noreferrer"
        >
          <Link size={13} />
          <span>{q.destination.replace(/^https?:\/\//, "")}</span>
          <ArrowUpRight size={13} />
        </a>
        <div className="card-meta">
          <button onClick={() => onAnalytics(q)}>
            <ScanLine size={14} />
            <strong>{numbers(q.total_scans)}</strong> scans
          </button>
          <span>
            {q.folder ? (
              <>
                <Folder size={13} />
                {q.folder}
              </>
            ) : (
              date(q.created_at)
            )}
          </span>
        </div>
      </div>
      <div className="card-footer">
        <button onClick={() => onEdit(q)}>
          <Pencil size={14} /> Edit code
        </button>
        <div>
          <select
            aria-label={`Download format for ${q.name}`}
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="png">PNG</option>
            <option value="svg">SVG</option>
            <option value="pdf">PDF</option>
          </select>
          <IconButton
            label={`Download ${q.name}`}
            disabled={busy}
            onClick={() => onDownload(q, format)}
          >
            <Download size={16} />
          </IconButton>
        </div>
      </div>
    </article>
  );
}
