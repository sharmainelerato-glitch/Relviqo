import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  ExternalLink,
  Pencil,
  Gauge,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Terminal,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import "./App.css";

const API =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

const emptyForm = {
  name: "",
  url: "",
  method: "GET",
  expectedStatus: "200",
  timeoutSeconds: "10",
};

function formatLatency(value) {
  if (value === null || value === undefined) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

function formatUptime(value) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toFixed(2)}%`;
}

function formatTime(value) {
  if (!value) return "NEVER";

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClass(status) {
  return (status || "PENDING").toLowerCase();
}

function App() {
  const [page, setPage] = useState("monitors");
  const [monitors, setMonitors] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [updating, setUpdating] = useState(false);
  const [monitorToDelete, setMonitorToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function apiFetch(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error || "Request failed.");
    }

    return data;
  }

  async function loadData(showLoader = false) {
    if (showLoader) setLoading(true);

    try {
      setError("");

      const [monitorData, dashboardData, incidentData] = await Promise.all([
        apiFetch("/monitors"),
        apiFetch("/dashboard"),
        apiFetch("/incidents"),
      ]);

      setMonitors(monitorData);
      setDashboard(dashboardData);
      setIncidents(incidentData);
    } catch (err) {
      setError(err.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  useEffect(() => {
    loadData(true);

    const refresh = setInterval(() => {
      loadData();
    }, 15000);

    return () => clearInterval(refresh);
  }, []);

  const filteredMonitors = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return monitors;

    return monitors.filter((monitor) =>
      `${monitor.name} ${monitor.url} ${monitor.currentStatus}`
        .toLowerCase()
        .includes(term)
    );
  }, [monitors, search]);

  const totalChecks = useMemo(
    () =>
      monitors.reduce(
        (total, monitor) => total + (monitor.metrics?.totalChecks || 0),
        0
      ),
    [monitors]
  );

  const averageUptime = useMemo(() => {
    const values = monitors
      .map((monitor) => monitor.metrics?.uptimePercentage)
      .filter((value) => value !== null && value !== undefined);

    if (!values.length) return null;

    return (
      values.reduce((total, value) => total + Number(value), 0) /
      values.length
    );
  }, [monitors]);

  async function createMonitor(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      await apiFetch("/monitors", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          url: form.url.trim(),
          method: form.method,
          expectedStatus: Number(form.expectedStatus),
          timeoutSeconds: Number(form.timeoutSeconds),
        }),
      });

      setForm(emptyForm);
      setShowAdd(false);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function runCheck(id) {
    try {
      setCheckingId(id);

      await apiFetch(`/monitors/${id}/check`, {
        method: "POST",
      });

      await loadData();

      if (selectedMonitor?.id === id) {
        await openMonitor(id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckingId(null);
    }
  }

  async function runAllChecks() {
    try {
      setCheckingAll(true);

      await apiFetch("/check-all", {
        method: "POST",
      });

      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckingAll(false);
    }
  }

  async function toggleMonitor(monitor) {
    try {
      await apiFetch(`/monitors/${monitor.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: !monitor.isActive,
        }),
      });

      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteMonitor() {
    if (!monitorToDelete) return;

    try {
      setDeleting(true);
      setError("");

      await apiFetch(`/monitors/${monitorToDelete.id}`, {
        method: "DELETE",
      });

      setMonitorToDelete(null);
      setSelectedMonitor(null);
      setHistory([]);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function openMonitor(id) {
    try {
      const [monitorData, historyData] = await Promise.all([
        apiFetch(`/monitors/${id}`),
        apiFetch(`/monitors/${id}/history?limit=40`),
      ]);

      setSelectedMonitor(monitorData);
      setHistory(historyData);
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditing(monitor) {
    setEditingMonitor(monitor);
    setEditForm({
      name: monitor.name,
      url: monitor.url,
      method: monitor.method,
      expectedStatus: String(monitor.expectedStatus),
      timeoutSeconds: String(monitor.timeoutSeconds),
    });
  }

  async function updateMonitor(event) {
    event.preventDefault();
    try {
      setUpdating(true);
      setError("");
      await apiFetch(`/monitors/${editingMonitor.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name.trim(),
          url: editForm.url.trim(),
          method: editForm.method,
          expectedStatus: Number(editForm.expectedStatus),
          timeoutSeconds: Number(editForm.timeoutSeconds),
        }),
      });
      const id = editingMonitor.id;
      setEditingMonitor(null);
      await runCheck(id);
      await loadData();
      if (selectedMonitor?.id === id) await openMonitor(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  }

  const systemStatus =
    dashboard?.down > 0
      ? "DOWN"
      : dashboard?.degraded > 0
      ? "DEGRADED"
      : monitors.length
      ? "UP"
      : "PENDING";

  return (
    <div className="relviqo">
      <header className="top-nav">
        <div className="brand" onClick={() => setPage("monitors")}>
          <div className="brand-symbol">
            <Activity size={17} />
          </div>

          <span>RELVIQO</span>
        </div>

        <nav>
          <button
            className={page === "monitors" ? "active" : ""}
            onClick={() => {
              setSelectedMonitor(null);
              setPage("monitors");
            }}
          >
            MONITORS
          </button>

          <button
            className={page === "incidents" ? "active" : ""}
            onClick={() => {
              setSelectedMonitor(null);
              setPage("incidents");
            }}
          >
            INCIDENTS
            {dashboard?.openIncidents > 0 && (
              <span className="incident-count">
                {dashboard.openIncidents}
              </span>
            )}
          </button>
        </nav>

        <div className="nav-right">
          <div className="engine-state">
            <span className="pulse" />
            LIVE
          </div>

          <button className="new-monitor" onClick={() => setShowAdd(true)}>
            <Plus size={15} />
            NEW MONITOR
          </button>
        </div>
      </header>

      {error && (
        <div className="error-strip">
          <AlertTriangle size={15} />
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <X size={14} />
          </button>
        </div>
      )}

      <main>
        {loading ? (
          <div className="boot-screen">
            <Terminal size={22} />
            <span>INITIALISING RELVIQO...</span>
          </div>
        ) : selectedMonitor ? (
          <MonitorDetail
            monitor={selectedMonitor}
            history={history}
            checking={checkingId === selectedMonitor.id}
            onBack={() => {
              setSelectedMonitor(null);
              setHistory([]);
            }}
            onCheck={() => runCheck(selectedMonitor.id)}
          />
        ) : page === "incidents" ? (
          <IncidentsPage incidents={incidents} />
        ) : (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="section-code">SYSTEM / OVERVIEW</div>

                <div className="health-title">
                  <StatusLight status={systemStatus} large />

                  <div>
                    <h1>
                      {systemStatus === "UP"
                        ? "ALL SYSTEMS OPERATIONAL"
                        : systemStatus === "DOWN"
                        ? "SERVICE DISRUPTION"
                        : systemStatus === "DEGRADED"
                        ? "PERFORMANCE DEGRADED"
                        : "AWAITING MONITORS"}
                    </h1>

                    <p>
                      {monitors.length
                        ? `${monitors.length} endpoint${
                            monitors.length === 1 ? "" : "s"
                          } under continuous observation.`
                        : "Add an endpoint to begin measuring reliability."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="hero-time">
                <span>CHECK INTERVAL</span>
                <strong>60 SEC</strong>
              </div>
            </section>

            <section className="telemetry">
              <Telemetry
                label="ENDPOINTS"
                value={String(monitors.length).padStart(2, "0")}
                meta={`${dashboard?.up || 0} ONLINE`}
              />

              <Telemetry
                label="AVG UPTIME"
                value={formatUptime(averageUptime)}
                meta="ALL CHECKS"
              />

              <Telemetry
                label="AVG LATENCY"
                value={formatLatency(dashboard?.averageResponseTimeMs)}
                meta="LATEST RESPONSES"
              />

              <Telemetry
                label="TOTAL CHECKS"
                value={totalChecks.toLocaleString()}
                meta="RECORDED"
              />

              <Telemetry
                label="INCIDENTS"
                value={String(dashboard?.openIncidents || 0).padStart(2, "0")}
                meta="OPEN"
                danger={dashboard?.openIncidents > 0}
              />
            </section>

            <section className="monitor-area">
              <div className="section-toolbar">
                <div>
                  <div className="section-code">LIVE / ENDPOINTS</div>
                  <h2>Service monitors</h2>
                </div>

                <div className="toolbar-actions">
                  <div className="search">
                    <Search size={14} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Filter endpoints"
                    />
                  </div>

                  <button
                    className="utility-button"
                    onClick={runAllChecks}
                    disabled={checkingAll || !monitors.length}
                  >
                    <RefreshCw
                      size={14}
                      className={checkingAll ? "spin" : ""}
                    />
                    CHECK ALL
                  </button>
                </div>
              </div>

              {!filteredMonitors.length ? (
                <EmptyState onAdd={() => setShowAdd(true)} />
              ) : (
                <div className="monitor-list">
                  {filteredMonitors.map((monitor) => (
                    <MonitorRow
                      key={monitor.id}
                      monitor={monitor}
                      onOpen={() => openMonitor(monitor.id)}
                      onCheck={() => runCheck(monitor.id)}
                      onEdit={() => startEditing(monitor)}
                      onToggle={() => toggleMonitor(monitor)}
                      onDelete={() => setMonitorToDelete(monitor)}
                      checking={checkingId === monitor.id}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="bottom-grid">
              <div className="terminal-panel">
                <div className="panel-label">
                  <span>STATUS DISTRIBUTION</span>
                  <CircleDot size={13} />
                </div>

                <StatusDistribution dashboard={dashboard} />
              </div>

              <div className="terminal-panel">
                <div className="panel-label">
                  <span>RECENT INCIDENTS</span>

                  <button onClick={() => setPage("incidents")}>
                    VIEW LOG <ChevronRight size={13} />
                  </button>
                </div>

                <IncidentPreview incidents={incidents.slice(0, 4)} />
              </div>
            </section>
          </>
        )}
      </main>

      {showAdd && (
        <AddMonitorModal
          form={form}
          setForm={setForm}
          saving={saving}
          onSubmit={createMonitor}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editingMonitor && (
        <EditMonitorModal
          form={editForm}
          setForm={setEditForm}
          updating={updating}
          onSubmit={updateMonitor}
          onClose={() => setEditingMonitor(null)}
        />
      )}

      {monitorToDelete && (
        <DeleteMonitorModal
          monitor={monitorToDelete}
          deleting={deleting}
          onConfirm={deleteMonitor}
          onClose={() => {
            if (!deleting) setMonitorToDelete(null);
          }}
        />
      )}
    </div>
  );
}

function Telemetry({ label, value, meta, danger = false }) {
  return (
    <div className={`telemetry-item ${danger ? "danger" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </div>
  );
}

function StatusLight({ status, large = false }) {
  return (
    <span
      className={`status-light ${statusClass(status)} ${large ? "large" : ""}`}
    />
  );
}

function MonitorRow({
  monitor,
  onOpen,
  onCheck,
  onEdit,
  onToggle,
  onDelete,
  checking,
}) {
  const bars = makeHeartbeat(monitor);

  return (
    <article className="monitor-row">
      <button className="monitor-main" onClick={onOpen}>
        <div className="monitor-identity">
          <StatusLight status={monitor.currentStatus} />

          <div>
            <div className="monitor-name">
              {monitor.name}
              {!monitor.isActive && <span className="paused-tag">PAUSED</span>}
            </div>

            <div className="monitor-url">{monitor.url}</div>
          </div>
        </div>

        <div className="protocol">
          <span>{monitor.method}</span>
          <strong>
            {monitor.lastStatusCode
              ? `${monitor.lastStatusCode}`
              : "---"}
          </strong>
        </div>

        <div className="latency">
          <span>LATENCY</span>
          <strong>{formatLatency(monitor.lastResponseTimeMs)}</strong>
        </div>

        <div className="uptime">
          <span>UPTIME</span>
          <strong>{formatUptime(monitor.metrics?.uptimePercentage)}</strong>
        </div>

        <div className="heartbeat">
          <div className="heartbeat-bars">
            {bars.map((check, index) => (
  <span
    key={check.id || `empty-${index}`}
    className={statusClass(check.status)}
    title={
      check.status === "PENDING"
        ? "No check recorded"
        : `${check.status} · ${
            check.statusCode
              ? `HTTP ${check.statusCode}`
              : "No response"
          } · ${formatLatency(check.responseTimeMs)} · ${formatTime(
            check.checkedAt
          )}`
    }
  />
))}
          </div>

          <small>
            {monitor.metrics?.totalChecks || 0} RECORDED CHECKS
          </small>
        </div>

        <div className="last-check">
          <span>LAST CHECK</span>
          <strong>{formatTime(monitor.lastCheckedAt)}</strong>
        </div>
      </button>

      <div className="monitor-actions">
        <button onClick={onEdit} title="Edit monitor">
          <Pencil size={14} />
        </button>
        <button onClick={onCheck} disabled={checking} title="Run check">
          <RefreshCw size={14} className={checking ? "spin" : ""} />
        </button>

        <button
          onClick={onToggle}
          title={monitor.isActive ? "Pause" : "Resume"}
        >
          {monitor.isActive ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <button onClick={onDelete} title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}

function makeHeartbeat(monitor) {
  const checks = monitor.recentChecks || [];

  const emptySlots = Math.max(0, 30 - checks.length);

  return [
    ...Array.from({ length: emptySlots }, () => ({
      status: "PENDING",
      checkedAt: null,
      responseTimeMs: null,
      statusCode: null,
    })),
    ...checks,
  ].slice(-30);
}

function StatusDistribution({ dashboard }) {
  const total = dashboard?.totalMonitors || 0;

  const data = [
    ["UP", dashboard?.up || 0],
    ["DEGRADED", dashboard?.degraded || 0],
    ["DOWN", dashboard?.down || 0],
  ];

  return (
    <div className="distribution-list">
      {data.map(([status, count]) => {
        const width = total ? (count / total) * 100 : 0;

        return (
          <div className="distribution-row" key={status}>
            <div>
              <StatusLight status={status} />
              <span>{status}</span>
              <strong>{count}</strong>
            </div>

            <div className="distribution-track">
              <span
                className={statusClass(status)}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IncidentPreview({ incidents }) {
  if (!incidents.length) {
    return (
      <div className="clear-state">
        <Check size={15} />
        <div>
          <strong>NO INCIDENTS RECORDED</strong>
          <span>Nothing to report. We like boring infrastructure.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="incident-preview">
      {incidents.map((incident) => (
        <div className="incident-line" key={incident.id}>
          <StatusLight
            status={incident.status === "ONGOING" ? "DOWN" : "UP"}
          />

          <div>
            <strong>{incident.monitorName}</strong>
            <span>{incident.cause}</span>
          </div>

          <time>{formatDate(incident.startedAt)}</time>
        </div>
      ))}
    </div>
  );
}

function MonitorDetail({ monitor, history, checking, onBack, onCheck }) {
  const orderedHistory = [...history].reverse();
  const maxLatency = Math.max(
    100,
    ...orderedHistory.map((item) => item.responseTimeMs || 0)
  );

  return (
    <section className="detail-page">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={14} />
        MONITORS
      </button>

      <div className="detail-heading">
        <div>
          <div className="detail-state">
            <StatusLight status={monitor.currentStatus} />
            {monitor.currentStatus}
          </div>

          <h1>{monitor.name}</h1>

          <a href={monitor.url} target="_blank" rel="noreferrer">
            {monitor.url}
            <ExternalLink size={12} />
          </a>
        </div>

        <button className="new-monitor" onClick={onCheck} disabled={checking}>
          <RefreshCw size={14} className={checking ? "spin" : ""} />
          CHECK NOW
        </button>
      </div>

      <div className="detail-stats">
        <Telemetry
          label="HTTP STATUS"
          value={monitor.lastStatusCode || "—"}
          meta={`EXPECTED ${monitor.expectedStatus}`}
        />

        <Telemetry
          label="LAST LATENCY"
          value={formatLatency(monitor.lastResponseTimeMs)}
          meta="RESPONSE TIME"
        />

        <Telemetry
          label="UPTIME"
          value={formatUptime(monitor.metrics?.uptimePercentage)}
          meta={`${monitor.metrics?.totalChecks || 0} CHECKS`}
        />

        <Telemetry
          label="FAILURES"
          value={monitor.metrics?.failedChecks || 0}
          meta="RECORDED"
        />
      </div>

      <div className="technical-grid">
        <section className="chart-panel">
          <div className="panel-label">
            <span>RESPONSE TIME / CHECK HISTORY</span>
            <span>MS</span>
          </div>

          {orderedHistory.length ? (
            <div className="chart">
              <div className="chart-guides">
                <span>{Math.round(maxLatency)}ms</span>
                <span>{Math.round(maxLatency / 2)}ms</span>
                <span>0ms</span>
              </div>

              <div className="chart-bars">
                {orderedHistory.map((item) => {
                  const height = Math.max(
                    4,
                    ((item.responseTimeMs || 0) / maxLatency) * 100
                  );

                  return (
                    <span
                      key={item.id}
                      className={statusClass(item.status)}
                      style={{ height: `${height}%` }}
                      title={`${formatTime(item.checkedAt)} · ${
                        item.status
                      } · ${formatLatency(item.responseTimeMs)}`}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="no-data">NO TELEMETRY AVAILABLE</div>
          )}
        </section>

        <section className="check-log">
          <div className="panel-label">
            <span>CHECK LOG</span>
            <span>{history.length} EVENTS</span>
          </div>

          <div className="log-header">
            <span>TIME</span>
            <span>METHOD</span>
            <span>STATUS</span>
            <span>LATENCY</span>
            <span>RESULT</span>
          </div>

          {history.map((item) => (
            <div className="log-row" key={item.id}>
              <span>{formatTime(item.checkedAt)}</span>
              <span>{monitor.method}</span>
              <span>{item.statusCode || "---"}</span>
              <span>{formatLatency(item.responseTimeMs)}</span>
              <span className={statusClass(item.status)}>
                {item.status}
              </span>
            </div>
          ))}

          {!history.length && (
            <div className="no-data">NO CHECKS RECORDED</div>
          )}
        </section>
      </div>
    </section>
  );
}

function IncidentsPage({ incidents }) {
  return (
    <section className="incidents-page">
      <div className="section-code">SYSTEM / INCIDENT LOG</div>
      <h1>Incidents</h1>
      <p className="page-description">
        Endpoint failures detected automatically by the monitoring engine.
      </p>

      <div className="incident-log">
        {incidents.map((incident) => (
          <article key={incident.id}>
            <div className="incident-date">
              {formatDate(incident.startedAt)}
            </div>

            <div className="incident-marker">
              <StatusLight
                status={incident.status === "ONGOING" ? "DOWN" : "UP"}
              />
              <span />
            </div>

            <div className="incident-content">
              <div className="incident-heading">
                <div>
                  <span
                    className={
                      incident.status === "ONGOING"
                        ? "incident-open"
                        : "incident-resolved"
                    }
                  >
                    {incident.status}
                  </span>

                  <h2>{incident.monitorName}</h2>
                </div>
              </div>

              <p>{incident.cause || "Endpoint became unavailable."}</p>

              {incident.resolvedAt && (
                <small>
                  RESOLVED {formatDate(incident.resolvedAt)}
                </small>
              )}
            </div>
          </article>
        ))}

        {!incidents.length && (
          <div className="empty-incidents">
            <Check size={18} />
            <strong>NO INCIDENTS</strong>
            <span>Reliability log is clear.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="empty-monitor">
      <Server size={25} />
      <div className="section-code">NO ACTIVE TARGETS</div>
      <h3>Your monitoring grid is empty.</h3>
      <p>Add an HTTP endpoint to begin collecting telemetry.</p>

      <button className="new-monitor" onClick={onAdd}>
        <Plus size={14} />
        ADD FIRST MONITOR
      </button>
    </div>
  );
}

function AddMonitorModal({
  form,
  setForm,
  saving,
  onSubmit,
  onClose,
}) {
  return (
    <div
      className="modal-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="monitor-modal">
        <div className="modal-top">
          <div>
            <div className="section-code">CONFIG / NEW TARGET</div>
            <h2>New monitor</h2>
          </div>

          <button onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <label>
            <span>MONITOR NAME</span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder="Zorviqo API"
              required
              autoFocus
            />
          </label>

          <label>
            <span>ENDPOINT URL</span>
            <input
              value={form.url}
              onChange={(event) =>
                setForm({ ...form, url: event.target.value })
              }
              placeholder="https://api.example.com/health"
              required
            />
          </label>

          <div className="modal-grid">
            <label>
              <span>METHOD</span>
              <select
                value={form.method}
                onChange={(event) =>
                  setForm({ ...form, method: event.target.value })
                }
              >
                <option>GET</option>
                <option>HEAD</option>
              </select>
            </label>

            <label>
              <span>EXPECTED</span>
              <input
                type="number"
                min="100"
                max="599"
                value={form.expectedStatus}
                onChange={(event) =>
                  setForm({
                    ...form,
                    expectedStatus: event.target.value,
                  })
                }
              />
            </label>

            <label>
              <span>TIMEOUT</span>
              <select
                value={form.timeoutSeconds}
                onChange={(event) =>
                  setForm({
                    ...form,
                    timeoutSeconds: event.target.value,
                  })
                }
              >
                <option value="5">5 SEC</option>
                <option value="10">10 SEC</option>
                <option value="20">20 SEC</option>
                <option value="30">30 SEC</option>
              </select>
            </label>
          </div>

          <div className="modal-footer">
            <span>
              <Clock3 size={13} />
              CHECKS RUN EVERY 60 SECONDS
            </span>

            <button className="new-monitor" disabled={saving}>
              {saving ? (
                <RefreshCw className="spin" size={14} />
              ) : (
                <Plus size={14} />
              )}
              {saving ? "CONNECTING..." : "START MONITORING"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function EditMonitorModal({ form, setForm, updating, onSubmit, onClose }) {
  return (
    <div className="modal-layer" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="monitor-modal">
        <div className="modal-top">
          <div>
            <div className="section-code">CONFIG / EDIT TARGET</div>
            <h2>Edit monitor</h2>
          </div>
          <button onClick={onClose}><X size={17} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <label>
            <span>MONITOR NAME</span>
            <input value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} required autoFocus />
          </label>
          <label>
            <span>ENDPOINT URL</span>
            <input value={form.url} onChange={(e) => setForm({...form, url:e.target.value})} required />
          </label>
          <div className="modal-grid">
            <label>
              <span>METHOD</span>
              <select value={form.method} onChange={(e) => setForm({...form, method:e.target.value})}>
                <option value="GET">GET</option><option value="HEAD">HEAD</option>
              </select>
            </label>
            <label>
              <span>EXPECTED</span>
              <input type="number" min="100" max="599" value={form.expectedStatus}
                onChange={(e) => setForm({...form, expectedStatus:e.target.value})} />
            </label>
            <label>
              <span>TIMEOUT</span>
              <select value={form.timeoutSeconds} onChange={(e) => setForm({...form, timeoutSeconds:e.target.value})}>
                <option value="5">5 SEC</option><option value="10">10 SEC</option>
                <option value="20">20 SEC</option><option value="30">30 SEC</option>
              </select>
            </label>
          </div>
          <div className="modal-footer">
            <span><Activity size={13} /> SAVING RUNS A FRESH CHECK</span>
            <button className="new-monitor" disabled={updating}>
              {updating ? <RefreshCw className="spin" size={14} /> : <Check size={14} />}
              {updating ? "UPDATING..." : "SAVE & CHECK"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function DeleteMonitorModal({
  monitor,
  deleting,
  onConfirm,
  onClose,
}) {
  return (
    <div
      className="modal-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) onClose();
      }}
    >
      <div className="monitor-modal delete-monitor-modal">
        <div className="modal-top">
          <div>
            <div className="section-code">CONFIG / REMOVE TARGET</div>
            <h2>Delete monitor</h2>
          </div>

          <button onClick={onClose} disabled={deleting}>
            <X size={17} />
          </button>
        </div>

        <div className="delete-warning">
          <div className="delete-warning-icon">
            <AlertTriangle size={20} />
          </div>

          <div>
            <strong>Remove {monitor.name}?</strong>
            <p>
              This monitor and its recorded check history will be permanently
              removed from Relviqo.
            </p>
          </div>
        </div>

        <div className="delete-target">
          <span>ENDPOINT</span>
          <code>{monitor.url}</code>
        </div>

        <div className="delete-actions">
          <button
            type="button"
            className="utility-button"
            onClick={onClose}
            disabled={deleting}
          >
            CANCEL
          </button>

          <button
            type="button"
            className="danger-button"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? (
              <RefreshCw className="spin" size={14} />
            ) : (
              <Trash2 size={14} />
            )}
            {deleting ? "DELETING..." : "DELETE MONITOR"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;