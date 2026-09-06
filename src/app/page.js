"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GitBranch, Database, Search, Shield, FileCode, AlertTriangle, CheckCircle2,
  XCircle, Clock, Cpu, ArrowRight, Copy, Download, RefreshCw, Layers,
  Activity, Terminal, Eye, Zap, ChevronRight, CircleDot, BarChart3,
  Target, AlertCircle, FileJson, BookOpen
} from "lucide-react";

const API = "";

/* ──────────────────────────────────────────────────────────────
   PIPELINE STEPS
   ────────────────────────────────────────────────────────────── */

const STEPS = [
  { id: "repo", label: "Repository", icon: GitBranch },
  { id: "checkpoint", label: "Entire Checkpoint", icon: Layers },
  { id: "databricks", label: "Databricks Analysis", icon: Cpu },
  { id: "graph", label: "Graph Verification", icon: Shield },
  { id: "findings", label: "Findings", icon: Eye },
  { id: "handoff", label: "Agent Handoff", icon: FileJson },
];

/* ──────────────────────────────────────────────────────────────
   MAIN DASHBOARD
   ────────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const [repoPath, setRepoPath] = useState("");
  const [health, setHealth] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [selectedCp, setSelectedCp] = useState(null);
  const [cpDetail, setCpDetail] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [activeStep, setActiveStep] = useState("repo");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("intent");
  const [copied, setCopied] = useState(false);

  // ── Health check on mount ──
  useEffect(() => {
    fetchHealth();
  }, []);

  async function fetchHealth(repo) {
    try {
      const q = repo ? `?repo=${encodeURIComponent(repo)}` : "";
      const r = await fetch(`${API}/api/health${q}`);
      const d = await r.json();
      setHealth(d);
    } catch (e) {
      setHealth(null);
    }
  }

  // ── Load checkpoints ──
  async function loadCheckpoints() {
    if (!repoPath.trim()) return;
    setLoading("checkpoints");
    setError(null);
    setCheckpoints([]);
    setSelectedCp(null);
    setCpDetail(null);
    setAnalysis(null);

    try {
      await fetchHealth(repoPath);
      const r = await fetch(`${API}/api/checkpoints?repo=${encodeURIComponent(repoPath)}`);
      const d = await r.json();
      setCheckpoints(d.checkpoints || []);
      setActiveStep(d.checkpoints?.length > 0 ? "checkpoint" : "repo");
    } catch (e) {
      setError("Failed to load checkpoints: " + e.message);
    }
    setLoading("");
  }

  // ── Select checkpoint ──
  async function selectCheckpoint(cp) {
    const cpId = cp.id || cp.checkpoint_id || cp;
    setSelectedCp(cpId);
    setLoading("detail");
    setActiveStep("checkpoint");
    setAnalysis(null);

    try {
      const r = await fetch(`${API}/api/checkpoint/${cpId}?repo=${encodeURIComponent(repoPath)}`);
      const d = await r.json();
      setCpDetail(d);
    } catch (e) {
      setError("Failed to load checkpoint detail: " + e.message);
    }
    setLoading("");
  }

  // ── Run full analysis pipeline ──
  async function runAnalysis() {
    if (!selectedCp) return;
    setLoading("analysis");
    setError(null);
    setActiveStep("databricks");

    try {
      const r = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointId: selectedCp, repoPath }),
      });
      const d = await r.json();
      setAnalysis(d);
      setActiveStep("handoff");
    } catch (e) {
      setError("Analysis pipeline failed: " + e.message);
      setActiveStep("checkpoint");
    }
    setLoading("");
  }

  // ── Copy handoff JSON ──
  function copyHandoff() {
    if (!analysis?.handoff) return;
    navigator.clipboard.writeText(JSON.stringify(analysis.handoff, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadHandoff() {
    if (!analysis?.handoff) return;
    const blob = new Blob([JSON.stringify(analysis.handoff, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `handoff-${selectedCp || "analysis"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Stats ──
  const stats = analysis?.analysis?.data ? {
    completed: (analysis.analysis.data.completed || []).length,
    unfinished: (analysis.analysis.data.unfinished || []).length,
    decisions: (analysis.analysis.data.decisions || []).length,
    risks: (analysis.analysis.data.risks || []).length,
    verified: (analysis.graph_verification || []).filter(v => v.status === "VERIFIED").length,
    total_graph: (analysis.graph_verification || []).length,
  } : null;

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */

  return (
    <div className="app-container">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">⛏</div>
          <div>
            <div className="header-title">Code Archaeologist</div>
            <div className="header-subtitle">AI Development Intelligence Command Center</div>
          </div>
        </div>
        <div className="header-status">
          <ServicePill label="Entire" status={health?.services?.entire?.status} />
          <ServicePill label="Databricks" status={health?.services?.databricks?.status} />
          <ServicePill label="Graph" status={health?.services?.graph?.status} />
        </div>
      </header>

      {/* ── Pipeline Bar ── */}
      <div className="pipeline-bar">
        {STEPS.map((step, i) => (
          <PipelineStep
            key={step.id}
            step={step}
            index={i}
            activeStep={activeStep}
            steps={STEPS}
            analysis={analysis}
          />
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div className="dash-grid">
        {/* ── Left Sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Repository Input */}
          <div className="card">
            <div className="card-hdr">
              <div className="card-hdr-left">
                <GitBranch size={15} className="card-icon" />
                <span className="card-title">Repository</span>
              </div>
              <span className={`badge ${repoPath && checkpoints.length > 0 ? "ok" : "warn"}`}>
                {repoPath ? (checkpoints.length > 0 ? `${checkpoints.length} CPs` : "Ready") : "Select"}
              </span>
            </div>
            <div className="card-body">
              <div className="input-group">
                <input
                  className="input"
                  type="text"
                  placeholder="/path/to/repo"
                  value={repoPath}
                  onChange={e => setRepoPath(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && loadCheckpoints()}
                />
                <button
                  className="btn btn-p"
                  onClick={loadCheckpoints}
                  disabled={!repoPath.trim() || loading === "checkpoints"}
                >
                  {loading === "checkpoints" ? <RefreshCw size={13} className="spinning" /> : <Search size={13} />}
                  Scan
                </button>
              </div>
              {health?.services?.entire?.version && (
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                  {health.services.entire.version}
                </div>
              )}
            </div>
          </div>

          {/* Checkpoint List */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-hdr">
              <div className="card-hdr-left">
                <Layers size={15} className="card-icon" />
                <span className="card-title">Entire Checkpoints</span>
              </div>
              <span className={`badge ${checkpoints.length > 0 ? "ok" : "info"}`}>
                {checkpoints.length > 0 ? `${checkpoints.length} Found` : "Awaiting"}
              </span>
            </div>
            <div className="card-body">
              {loading === "checkpoints" ? (
                <div className="loading"><div className="spinner" /><div className="load-text">Scanning repository...</div></div>
              ) : checkpoints.length > 0 ? (
                <ul className="cp-list stagger">
                  {checkpoints.map((cp, i) => (
                    <li
                      key={cp.id || cp.checkpoint_id || i}
                      className={`cp-item ${selectedCp === (cp.id || cp.checkpoint_id) ? "sel" : ""}`}
                      onClick={() => selectCheckpoint(cp)}
                    >
                      <div className="cp-id">{(cp.id || cp.checkpoint_id || "").substring(0, 12)}...</div>
                      <div className="cp-msg">{cp.message || cp.summary || cp.description || "Checkpoint"}</div>
                      <div className="cp-meta">
                        {cp.sessions_count && <span>{cp.sessions_count} sessions</span>}
                        {cp.files_count && <span>{cp.files_count} files</span>}
                        {cp.timestamp && <span>{new Date(cp.timestamp).toLocaleString()}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty">
                  <Layers size={36} className="empty-icon" />
                  <div className="empty-title">No Checkpoints</div>
                  <div className="empty-desc">
                    Enter a repository path and click Scan to discover Entire Checkpoints.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Main Panel ── */}
        <div className="main-panel">
          {error && (
            <div className="card" style={{ borderColor: "var(--accent-red)" }}>
              <div className="card-body" style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--accent-red)" }}>
                <AlertCircle size={16} />
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.82rem" }}>{error}</span>
              </div>
            </div>
          )}

          {/* Stats Row (visible after analysis) */}
          {stats && (
            <div className="stats-row anim-in">
              <div className="stat">
                <div className="stat-val g">{stats.completed}</div>
                <div className="stat-lbl">Completed</div>
              </div>
              <div className="stat">
                <div className="stat-val r">{stats.unfinished}</div>
                <div className="stat-lbl">Unfinished</div>
              </div>
              <div className="stat">
                <div className="stat-val a">{stats.risks}</div>
                <div className="stat-lbl">Risks</div>
              </div>
              <div className="stat">
                <div className="stat-val b">{stats.verified}/{stats.total_graph}</div>
                <div className="stat-lbl">Graph Verified</div>
              </div>
            </div>
          )}

          {/* Checkpoint Detail */}
          {selectedCp && !analysis && (
            <div className="card anim-in">
              <div className="card-hdr">
                <div className="card-hdr-left">
                  <BookOpen size={15} className="card-icon" />
                  <span className="card-title">Checkpoint Detail</span>
                </div>
                <button
                  className="btn btn-p"
                  onClick={runAnalysis}
                  disabled={loading === "analysis"}
                >
                  {loading === "analysis" ? (
                    <><RefreshCw size={13} className="spinning" /> Analyzing...</>
                  ) : (
                    <><Zap size={13} /> Run Full Pipeline</>
                  )}
                </button>
              </div>
              <div className="card-body">
                {loading === "detail" ? (
                  <div className="loading"><div className="spinner" /><div className="load-text">Loading checkpoint data...</div></div>
                ) : cpDetail ? (
                  <div className="term">
                    <div><span className="p">checkpoint_id:</span> {selectedCp}</div>
                    {cpDetail.explanation && (
                      <div style={{ marginTop: 8, whiteSpace: "pre-wrap", maxHeight: 250, overflowY: "auto" }}>
                        {cpDetail.explanation.substring(0, 3000)}
                      </div>
                    )}
                    {!cpDetail.explanation && cpDetail.metadata && (
                      <div style={{ marginTop: 8 }}>
                        <pre style={{ whiteSpace: "pre-wrap" }}>
                          {JSON.stringify(cpDetail.metadata, null, 2).substring(0, 3000)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty">
                    <Terminal size={28} className="empty-icon" />
                    <div className="empty-desc">Select a checkpoint to view details</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading Analysis */}
          {loading === "analysis" && (
            <div className="card anim-in">
              <div className="card-hdr">
                <div className="card-hdr-left">
                  <Activity size={15} className="card-icon" />
                  <span className="card-title">Live Pipeline Execution</span>
                </div>
                <span className="badge warn">Running</span>
              </div>
              <div className="card-body">
                <PipelineProgress />
              </div>
            </div>
          )}

          {/* Analysis Results */}
          {analysis && (
            <>
              {/* Source Badge */}
              <div className="card anim-in">
                <div className="card-hdr">
                  <div className="card-hdr-left">
                    <Cpu size={15} className="card-icon" />
                    <span className="card-title">Databricks Analysis</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span className={`badge ${analysis.analysis?.source === "databricks" ? "ok" : "warn"}`}>
                      {analysis.analysis?.source === "databricks" ? "Databricks AI" : "Local Fallback"}
                    </span>
                    {analysis.analysis?.model && (
                      <span className="badge purple">{analysis.analysis.model}</span>
                    )}
                    {analysis.pipeline_duration_ms && (
                      <span className="badge info">{analysis.pipeline_duration_ms}ms</span>
                    )}
                  </div>
                </div>
                <div className="card-body">
                  {analysis.analysis?.fallback_reason && (
                    <div style={{
                      padding: "10px 12px", background: "var(--accent-amber-dim)",
                      border: "1px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius)",
                      fontSize: "0.74rem", color: "var(--accent-amber)", marginBottom: 14,
                      fontFamily: "var(--font-sans)",
                    }}>
                      ⚠ Fallback: {analysis.analysis.fallback_reason}
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="tabs">
                    {["intent", "completed", "unfinished", "decisions", "risks", "evidence"].map(t => (
                      <button key={t} className={`tab ${activeTab === t ? "on" : ""}`} onClick={() => setActiveTab(t)}>
                        {t}
                      </button>
                    ))}
                  </div>

                  <AnalysisTabContent tab={activeTab} data={analysis.analysis?.data || {}} />
                </div>
              </div>

              {/* Graph Verification */}
              {analysis.graph_verification && analysis.graph_verification.length > 0 && (
                <div className="card anim-in">
                  <div className="card-hdr">
                    <div className="card-hdr-left">
                      <Shield size={15} className="card-icon" />
                      <span className="card-title">Entire Graph Verification</span>
                    </div>
                    <span className="badge ok">
                      {analysis.graph_verification.filter(v => v.status === "VERIFIED").length}/
                      {analysis.graph_verification.length} Verified
                    </span>
                  </div>
                  <div className="card-body stagger">
                    {analysis.graph_verification.map((v, i) => (
                      <div key={i} className="gv-card">
                        <div className="gv-query">
                          <Search size={11} style={{ display: "inline", marginRight: 4 }} />
                          entire graph search &quot;{v.query}&quot;
                        </div>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginBottom: 4, fontFamily: "var(--font-sans)" }}>
                          {v.claim}
                        </div>
                        <div className={`gv-status ${v.status === "VERIFIED" ? "v" : v.status === "NOT_FOUND" ? "nf" : "u"}`}>
                          {v.status === "VERIFIED" ? <CheckCircle2 size={12} /> : v.status === "NOT_FOUND" ? <XCircle size={12} /> : <AlertTriangle size={12} />}
                          {v.status === "VERIFIED" ? "✓ VERIFIED" : v.status === "NOT_FOUND" ? "✗ NOT FOUND" : "? UNVERIFIED"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Handoff JSON */}
              {analysis.handoff && (
                <div className="card anim-in">
                  <div className="card-hdr">
                    <div className="card-hdr-left">
                      <FileJson size={15} className="card-icon" />
                      <span className="card-title">Agent Handoff</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-s btn-sm" onClick={copyHandoff}>
                        <Copy size={11} /> {copied ? "Copied!" : "Copy"}
                      </button>
                      <button className="btn btn-s btn-sm" onClick={downloadHandoff}>
                        <Download size={11} /> Export
                      </button>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="handoff-wrap">
                      <pre className="handoff-json">
                        {JSON.stringify(analysis.handoff, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Welcome state */}
          {!selectedCp && !analysis && !loading && (
            <div className="card">
              <div className="card-body">
                <div className="empty">
                  <Target size={44} className="empty-icon" />
                  <div className="empty-title">Welcome to Code Archaeologist</div>
                  <div className="empty-desc">
                    Enter a repository path with Entire enabled, scan for checkpoints, then run the AI analysis pipeline.
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 12, fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    <span>Entire Checkpoint</span>
                    <ChevronRight size={12} />
                    <span>Databricks AI</span>
                    <ChevronRight size={12} />
                    <span>Graph Verify</span>
                    <ChevronRight size={12} />
                    <span>Agent Handoff</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════ */

function ServicePill({ label, status }) {
  const dotClass = status === "online" ? "on" : status === "not_configured" ? "warn" : "off";
  return (
    <div className="status-pill">
      <span className={`status-dot ${dotClass}`} />
      {label}
    </div>
  );
}

function PipelineStep({ step, index, activeStep, steps, analysis }) {
  const stepIdx = steps.findIndex(s => s.id === activeStep);
  const myIdx = index;
  const isDone = myIdx < stepIdx || (analysis && myIdx <= stepIdx);
  const isActive = step.id === activeStep;
  const Icon = step.icon;

  return (
    <>
      <div className={`pipe-step ${isActive ? "active" : isDone ? "done" : "pending"}`}>
        <div className="pipe-num">
          {isDone ? <CheckCircle2 size={12} /> : (myIdx + 1)}
        </div>
        <Icon size={13} />
        {step.label}
      </div>
      {index < steps.length - 1 && (
        <div className={`pipe-con ${isDone ? "done" : ""}`} />
      )}
    </>
  );
}

function PipelineProgress() {
  const [step, setStep] = useState(0);
  const stages = [
    "Extracting checkpoint context from Entire...",
    "Sending to Databricks Foundation Model...",
    "Running AI intent extraction...",
    "Comparing intent vs implementation...",
    "Detecting missing requirements...",
    "Querying Entire Graph for verification...",
    "Scoring confidence and generating findings...",
    "Building agent handoff document...",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => (s < stages.length - 1 ? s + 1 : s));
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="term">
      {stages.map((stage, i) => (
        <div key={i} style={{ opacity: i <= step ? 1 : 0.2, transition: "opacity 0.3s" }}>
          <span className="p">{'>'} </span>
          <span className={i < step ? "s" : i === step ? "c" : ""}>
            {i < step ? "✓ " : i === step ? "⏳ " : "  "}
            {stage}
          </span>
        </div>
      ))}
      <div className="prog-container" style={{ marginTop: 12 }}>
        <div className="prog-label">
          <span>Pipeline Progress</span>
          <span>{Math.round(((step + 1) / stages.length) * 100)}%</span>
        </div>
        <div className="prog-bar">
          <div className="prog-fill" style={{ width: `${((step + 1) / stages.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function AnalysisTabContent({ tab, data }) {
  switch (tab) {
    case "intent":
      return (
        <div className="a-section">
          <div className="sec-title"><Target size={14} /> Original Intent</div>
          <div className="intent-block">{data.intent || "No intent extracted"}</div>
          {data.requirements && data.requirements.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="sec-title"><BarChart3 size={14} /> Requirements Tracking</div>
              <ul className="task-list stagger">
                {data.requirements.map((r, i) => (
                  <li key={i} className={`task-item ${r.status === "COMPLETED" ? "done" : r.status === "MISSING" ? "miss" : "dec"}`}>
                    <span className="task-icon">
                      {r.status === "COMPLETED" ? <CheckCircle2 size={14} color="var(--accent-green)" /> :
                       r.status === "MISSING" ? <XCircle size={14} color="var(--accent-red)" /> :
                       <AlertTriangle size={14} color="var(--accent-amber)" />}
                    </span>
                    <div>
                      <div className="task-text">
                        <span style={{ color: "var(--accent-cyan)", marginRight: 6, fontSize: "0.7rem" }}>[{r.id}]</span>
                        {r.description}
                      </div>
                      {r.evidence && (
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 3, fontStyle: "italic" }}>
                          Evidence: {r.evidence}
                        </div>
                      )}
                    </div>
                    <span className="task-conf">
                      {Math.round((r.confidence || 0) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );

    case "completed":
      return (
        <div className="a-section">
          <div className="sec-title"><CheckCircle2 size={14} color="var(--accent-green)" /> Completed Work</div>
          <ul className="task-list stagger">
            {(data.completed || []).map((item, i) => (
              <TaskItem key={i} item={item} type="done" icon={<CheckCircle2 size={14} color="var(--accent-green)" />} />
            ))}
          </ul>
          {(!data.completed || data.completed.length === 0) && <EmptySection text="No completed items detected" />}
        </div>
      );

    case "unfinished":
      return (
        <div className="a-section">
          <div className="sec-title"><XCircle size={14} color="var(--accent-red)" /> Unfinished / Missing</div>
          <ul className="task-list stagger">
            {(data.unfinished || []).map((item, i) => (
              <TaskItem key={i} item={item} type="miss" icon={<XCircle size={14} color="var(--accent-red)" />} />
            ))}
          </ul>
          {(!data.unfinished || data.unfinished.length === 0) && <EmptySection text="No unfinished items detected" />}
        </div>
      );

    case "decisions":
      return (
        <div className="a-section">
          <div className="sec-title"><CircleDot size={14} color="var(--accent-blue)" /> Key Decisions</div>
          <ul className="task-list stagger">
            {(data.decisions || []).map((item, i) => (
              <TaskItem key={i} item={item} type="dec" icon={<CircleDot size={14} color="var(--accent-blue)" />} />
            ))}
          </ul>
          {(!data.decisions || data.decisions.length === 0) && <EmptySection text="No decisions detected" />}
        </div>
      );

    case "risks":
      return (
        <div className="a-section">
          <div className="sec-title"><AlertTriangle size={14} color="var(--accent-amber)" /> Risks</div>
          <ul className="task-list stagger">
            {(data.risks || []).map((item, i) => (
              <TaskItem key={i} item={item} type="risk" icon={<AlertTriangle size={14} color="var(--accent-amber)" />} />
            ))}
          </ul>
          {(!data.risks || data.risks.length === 0) && <EmptySection text="No risks detected" />}
        </div>
      );

    case "evidence":
      return (
        <div className="a-section">
          <div className="sec-title"><FileCode size={14} /> Evidence Chain</div>
          <div className="stagger">
            {(data.requirements || data.completed || []).map((item, i) => {
              const evidence = item.evidence || "";
              const confidence = item.confidence || 0;
              return (
                <div key={i} className="ev-card">
                  <div className="ev-claim">{item.description || item}</div>
                  <div className="ev-meta">
                    <span className="ev-src">{item.source || "checkpoint"}</span>
                    <div className="conf-bar">
                      <div className="conf-track">
                        <div
                          className={`conf-fill ${confidence >= 0.8 ? "hi" : confidence >= 0.5 ? "md" : "lo"}`}
                          style={{ width: `${confidence * 100}%` }}
                        />
                      </div>
                      <span className="conf-label">{Math.round(confidence * 100)}%</span>
                    </div>
                    {evidence && <span style={{ color: "var(--text-muted)" }}>{evidence}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );

    default:
      return null;
  }
}

function TaskItem({ item, type, icon }) {
  const desc = typeof item === "string" ? item : item.description || JSON.stringify(item);
  const evidence = typeof item === "object" ? item.evidence : null;
  const confidence = typeof item === "object" ? item.confidence : null;
  const priority = typeof item === "object" ? item.priority : null;
  const severity = typeof item === "object" ? item.severity : null;

  return (
    <li className={`task-item ${type}`}>
      <span className="task-icon">{icon}</span>
      <div style={{ flex: 1 }}>
        <div className="task-text">{desc}</div>
        {evidence && (
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 3, fontStyle: "italic" }}>
            {evidence}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        {(priority || severity) && (
          <span className={`badge ${(priority || severity) === "HIGH" ? "err" : (priority || severity) === "MEDIUM" ? "warn" : "info"}`}>
            {priority || severity}
          </span>
        )}
        {confidence !== null && confidence !== undefined && (
          <span className="task-conf">{Math.round(confidence * 100)}%</span>
        )}
      </div>
    </li>
  );
}

function EmptySection({ text }) {
  return (
    <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem" }}>
      {text}
    </div>
  );
}
