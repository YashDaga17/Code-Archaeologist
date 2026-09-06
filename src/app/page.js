"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GitBranch, Database, Search, Shield, FileCode, AlertTriangle, CheckCircle2,
  XCircle, Clock, Cpu, ArrowRight, Copy, Download, RefreshCw, Layers,
  Activity, Terminal, Eye, Zap, ChevronRight, CircleDot, BarChart3,
  Target, AlertCircle, FileJson, BookOpen, Radar, Check, Info, Sparkles,
  HelpCircle, Compass, GitCommit, UserCheck, Code2
} from "lucide-react";

const API = "";

/* ──────────────────────────────────────────────────────────────
   PIPELINE STEPS (ForgeOS Stepper)
   ────────────────────────────────────────────────────────────── */

const STEPS = [
  { id: "repo", label: "Repository", icon: GitBranch },
  { id: "checkpoint", label: "Entire Context", icon: Layers },
  { id: "databricks", label: "Databricks AI", icon: Cpu },
  { id: "graph", label: "Graph Verification", icon: Shield },
  { id: "findings", label: "Findings & Evidence", icon: Eye },
  { id: "handoff", label: "Agent Handoff", icon: FileJson },
];

export default function Dashboard() {
  const [repoPath, setRepoPath] = useState("");
  const [health, setHealth] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [sidebarView, setSidebarView] = useState("checkpoints"); // "checkpoints" | "sessions"
  const [selectedCp, setSelectedCp] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [cpDetail, setCpDetail] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [activeStep, setActiveStep] = useState("repo");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("intent");
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reqFilter, setReqFilter] = useState("ALL");
  const [asyncJob, setAsyncJob] = useState(null);

  // ── Auto-detect repository and load health & sessions on mount ──
  useEffect(() => {
    fetchHealth();
    loadAllData();
  }, []);

  async function fetchHealth(repo) {
    try {
      const q = repo ? `?repo=${encodeURIComponent(repo)}` : "";
      const r = await fetch(`${API}/api/health${q}`);
      const d = await r.json();
      setHealth(d);
      if (!repoPath && d.repository) {
        // Default to local workspace path if not explicitly provided
        setRepoPath(process.env.NEXT_PUBLIC_REPO_PATH || "/Users/yashdaga/Desktop/dev/Code-Archaeologist");
      }
    } catch (e) {
      setHealth(null);
    }
  }

  async function loadAllData(customPath) {
    const targetPath = customPath || repoPath || "/Users/yashdaga/Desktop/dev/Code-Archaeologist";
    setLoading("initial");
    setError(null);

    try {
      await fetchHealth(targetPath);

      // Load Checkpoints
      const cpRes = await fetch(`${API}/api/checkpoints?repo=${encodeURIComponent(targetPath)}`);
      const cpData = await cpRes.json();
      const loadedCps = cpData.checkpoints || [];
      setCheckpoints(loadedCps);

      // Load Sessions
      const sesRes = await fetch(`${API}/api/sessions?repo=${encodeURIComponent(targetPath)}`);
      const sesData = await sesRes.json();
      setSessions(sesData.sessions || []);

      // Load Timeline
      const tlRes = await fetch(`${API}/api/timeline?repo=${encodeURIComponent(targetPath)}`);
      const tlData = await tlRes.json();
      setTimeline(tlData.timeline || []);

      // Select first checkpoint by default if available
      if (loadedCps.length > 0 && !selectedCp) {
        selectCheckpoint(loadedCps[0], targetPath);
      }
    } catch (e) {
      setError("Failed to load development context: " + e.message);
    }
    setLoading("");
  }

  // ── Select Checkpoint ──
  async function selectCheckpoint(cp, pathOverride) {
    const targetPath = pathOverride || repoPath;
    const cpId = cp.id || cp.checkpoint_id || cp;
    setSelectedCp(cpId);
    setLoading("detail");
    setActiveStep("checkpoint");
    setAnalysis(null);
    setError(null);

    try {
      const r = await fetch(`${API}/api/checkpoint/${cpId}?repo=${encodeURIComponent(targetPath)}`);
      const d = await r.json();
      setCpDetail(d);
    } catch (e) {
      setError("Failed to load checkpoint detail: " + e.message);
    }
    setLoading("");
  }

  // ── Select Session ──
  function selectSession(session) {
    setSelectedSession(session);
    // Find matching checkpoint if any
    const matchingCp = checkpoints.find(c => c.session_id === session.session_id);
    if (matchingCp) {
      selectCheckpoint(matchingCp);
    }
  }

  // ── Run Full Intelligence Pipeline (Synchronous with Live Trace) ──
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
      if (!d.success) throw new Error(d.error || "Analysis failed");
      setAnalysis(d);
      setActiveStep("findings");
    } catch (e) {
      setError("Analysis pipeline failed: " + e.message);
      setActiveStep("checkpoint");
    }
    setLoading("");
  }

  // ── Copy & Download Handoff ──
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
    a.download = `agent-handoff-${selectedCp || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Derived Stats & Filtering ──
  const reqList = analysis?.analysis?.data?.requirements || [];
  const completedCount = reqList.filter(r => r.status === "COMPLETED").length;
  const partialCount = reqList.filter(r => r.status === "PARTIAL").length;
  const missingCount = reqList.filter(r => r.status === "MISSING").length;
  const graphVerifiedCount = (analysis?.graph_verification || []).filter(e => e.status === "VERIFIED").length;
  const activeRisksCount = (analysis?.analysis?.data?.risks || []).length;

  const filteredRequirements = reqList.filter(r => {
    if (reqFilter === "ALL") return true;
    return r.status === reqFilter;
  });

  const filteredCheckpoints = checkpoints.filter(cp => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (cp.id || cp.checkpoint_id || "").toLowerCase().includes(q) ||
      (cp.message || cp.summary || "").toLowerCase().includes(q) ||
      (cp.agent || "").toLowerCase().includes(q)
    );
  });

  const filteredSessions = sessions.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.session_id.toLowerCase().includes(q) ||
      (s.agent || "").toLowerCase().includes(q) ||
      (s.last_prompt || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="layout">
      {/* ── Background Grid & Glow ── */}
      <div className="bg-grid" />
      <div className="bg-glow" />

      <div className="container">
        {/* ── Top Header ── */}
        <header className="header">
          <div className="hdr-left">
            <div className="logo-icon">⛏</div>
            <div>
              <div className="logo-text">CODE ARCHAEOLOGIST</div>
              <div className="logo-sub">Checkpoint-Native Developer Intelligence Command Center</div>
            </div>
          </div>
          <div className="hdr-right">
            <div className="pill">
              <span className={`pill-dot ${health?.services?.entire?.status === "online" ? "online" : "offline"}`} />
              Entire CLI: {health?.services?.entire?.status || "offline"}
            </div>
            <div className="pill">
              <span className={`pill-dot ${health?.services?.graph?.status === "online" ? "online" : "offline"}`} />
              Entire Graph: {health?.services?.graph?.status || "offline"}
            </div>
            <div className="pill">
              <span className={`pill-dot ${health?.services?.databricks?.configured ? "online" : "warn"}`} />
              Databricks: {health?.services?.databricks?.configured ? "Connected" : "Fallback Engine"}
            </div>
          </div>
        </header>

        {/* ── Dashboard Metrics Summary Bar (Section 5.1) ── */}
        <div className="metrics-bar anim-in">
          <div className="metric-box">
            <div className="metric-box-title">Repository</div>
            <div className="metric-box-val b" style={{ fontSize: "0.95rem" }}>
              {health?.repository || "Code-Archaeologist"}
            </div>
          </div>
          <div className="metric-box">
            <div className="metric-box-title">Branch</div>
            <div className="metric-box-val c" style={{ fontSize: "0.95rem" }}>
              {health?.branch || "master"}
            </div>
          </div>
          <div className="metric-box">
            <div className="metric-box-title">Total Checkpoints</div>
            <div className="metric-box-val">{checkpoints.length}</div>
          </div>
          <div className="metric-box">
            <div className="metric-box-title">Sessions Tracked</div>
            <div className="metric-box-val c">{sessions.length}</div>
          </div>
          <div className="metric-box">
            <div className="metric-box-title">Requirements</div>
            <div className="metric-box-val">
              <span className="g">{completedCount}</span> / <span className="a">{partialCount}</span> / <span className="r">{missingCount}</span>
            </div>
          </div>
          <div className="metric-box">
            <div className="metric-box-title">Graph Verified</div>
            <div className="metric-box-val g">
              {graphVerifiedCount} / {analysis?.graph_verification?.length || 0}
            </div>
          </div>
          <div className="metric-box">
            <div className="metric-box-title">Active Risks</div>
            <div className="metric-box-val r">{activeRisksCount}</div>
          </div>
        </div>

        {/* ── Pipeline Stepper ── */}
        <div className="stepper anim-in">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const currentIdx = STEPS.findIndex(st => st.id === activeStep);
            const isCompleted = idx < currentIdx;
            const isCurrent = s.id === activeStep;
            return (
              <div
                key={s.id}
                className={`step-item ${isCompleted ? "done" : ""} ${isCurrent ? "active" : ""}`}
              >
                <div className="step-icon-wrap">
                  <Icon size={14} />
                </div>
                <span className="step-label">{s.label}</span>
                {idx < STEPS.length - 1 && <ChevronRight size={14} className="step-arrow" />}
              </div>
            );
          })}
        </div>

        {/* ── Main Workspace Grid ── */}
        <div className="workspace">
          {/* ── Left Sidebar (Checkpoint & Session Explorer) ── */}
          <div className="sidebar">
            {/* Repo Input */}
            <div className="card">
              <div className="card-hdr">
                <div className="card-hdr-left">
                  <GitBranch size={15} className="card-icon" />
                  <span className="card-title">Target Workspace</span>
                </div>
              </div>
              <div className="card-body">
                <div className="search-box">
                  <input
                    type="text"
                    className="input"
                    placeholder="/path/to/repo"
                    value={repoPath}
                    onChange={(e) => setRepoPath(e.target.value)}
                  />
                  <button
                    className="btn btn-p"
                    onClick={() => loadAllData(repoPath)}
                    disabled={loading === "initial" || loading === "checkpoints"}
                  >
                    {loading === "initial" || loading === "checkpoints" ? (
                      <RefreshCw size={14} className="spin" />
                    ) : (
                      "Scan"
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar View Switcher (Checkpoints vs Sessions) */}
            <div className="card" style={{ padding: 0 }}>
              <div className="sidebar-tabs">
                <button
                  className={`sidebar-tab ${sidebarView === "checkpoints" ? "active" : ""}`}
                  onClick={() => setSidebarView("checkpoints")}
                >
                  Checkpoints ({checkpoints.length})
                </button>
                <button
                  className={`sidebar-tab ${sidebarView === "sessions" ? "active" : ""}`}
                  onClick={() => setSidebarView("sessions")}
                >
                  Entire Sessions ({sessions.length})
                </button>
              </div>

              {/* Filter Search */}
              <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                <input
                  type="text"
                  className="input"
                  style={{ fontSize: "0.72rem", padding: "6px 10px" }}
                  placeholder={`Filter ${sidebarView}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Checkpoint List */}
              {sidebarView === "checkpoints" ? (
                <div className="card-body" style={{ maxHeight: "560px", overflowY: "auto", padding: "10px" }}>
                  {filteredCheckpoints.length > 0 ? (
                    <ul className="cp-list stagger">
                      {filteredCheckpoints.map((cp, i) => {
                        const cpId = cp.id || cp.checkpoint_id;
                        const isSelected = selectedCp === cpId;
                        const isReal = cp.is_real !== false;
                        return (
                          <li
                            key={cpId || i}
                            className={`cp-item ${isSelected ? "sel" : ""}`}
                            onClick={() => selectCheckpoint(cp)}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div className="cp-id">{(cpId || "").substring(0, 10)}...</div>
                              <span className={isReal ? "badge-real" : "badge-demo"}>
                                {isReal ? "REAL ENTIRE" : "SAMPLE DEMO"}
                              </span>
                            </div>
                            <div className="cp-msg">{cp.message || cp.summary || "Checkpoint commit"}</div>
                            <div className="cp-meta">
                              {cp.agent && <span>{cp.agent}</span>}
                              {cp.turns && <span>{cp.turns} turns</span>}
                              {cp.files_count !== undefined && <span>{cp.files_count} files</span>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="empty">
                      <Layers size={32} className="empty-icon" />
                      <div className="empty-title">No Checkpoints</div>
                      <div className="empty-desc">Click Scan to discover checkpoints.</div>
                    </div>
                  )}
                </div>
              ) : (
                /* Sessions List */
                <div className="card-body" style={{ maxHeight: "560px", overflowY: "auto", padding: "10px" }}>
                  {filteredSessions.length > 0 ? (
                    <ul className="cp-list stagger">
                      {filteredSessions.map((s, i) => {
                        const isSelected = selectedSession?.session_id === s.session_id;
                        return (
                          <li
                            key={s.session_id || i}
                            className={`cp-item ${isSelected ? "sel" : ""}`}
                            onClick={() => selectSession(s)}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div className="cp-id" style={{ color: "var(--accent-cyan)" }}>
                                {s.session_id.substring(0, 12)}...
                              </div>
                              <span className={s.is_real !== false ? "badge-real" : "badge-demo"}>
                                {s.is_real !== false ? "REAL SESSION" : "SAMPLE"}
                              </span>
                            </div>
                            <div className="cp-msg">
                              {s.last_prompt || `Agent session with ${s.agent}`}
                            </div>
                            <div className="cp-meta">
                              <span>{s.agent}</span>
                              {s.model && <span>{s.model}</span>}
                              {s.turns && <span>{s.turns} turns</span>}
                              <span>{s.files_touched?.length || 0} files</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="empty">
                      <Terminal size={32} className="empty-icon" />
                      <div className="empty-title">No Sessions</div>
                      <div className="empty-desc">No Entire sessions tracked yet.</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Main Content Area ── */}
          <div className="main-panel">
            {error && (
              <div className="card" style={{ borderColor: "var(--accent-red)", background: "rgba(239, 68, 68, 0.05)" }}>
                <div className="card-body" style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--accent-red)" }}>
                  <AlertCircle size={16} />
                  <span style={{ fontSize: "0.82rem" }}>{error}</span>
                </div>
              </div>
            )}

            {/* Checkpoint Provenance & Action Card */}
            {selectedCp && (
              <div className="card anim-in">
                <div className="card-hdr">
                  <div className="card-hdr-left">
                    <BookOpen size={16} className="card-icon" />
                    <span className="card-title">Selected Entire Checkpoint: {selectedCp}</span>
                    <span className={cpDetail?.is_demo ? "badge-demo" : "badge-real"}>
                      {cpDetail?.is_demo ? "SAMPLE DATA" : "REAL CHECKPOINT CONTEXT"}
                    </span>
                  </div>
                  <button
                    className="btn btn-p"
                    onClick={runAnalysis}
                    disabled={loading === "analysis"}
                  >
                    {loading === "analysis" ? (
                      <>
                        <RefreshCw size={14} className="spin" />
                        Running Pipeline...
                      </>
                    ) : (
                      <>
                        <Cpu size={14} />
                        Run Intelligence Pipeline
                      </>
                    )}
                  </button>
                </div>
                <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 500 }}>
                    {cpDetail?.metadata?.message || cpDetail?.explanation || "Selected Entire Checkpoint Context"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {cpDetail?.metadata?.agent && <span>Agent: <strong style={{ color: "var(--accent-amber)" }}>{cpDetail.metadata.agent}</strong></span>}
                    {cpDetail?.metadata?.model && <span>Model: <strong style={{ color: "var(--accent-cyan)" }}>{cpDetail.metadata.model}</strong></span>}
                    {cpDetail?.metadata?.session_id && <span>Session: <strong style={{ color: "var(--text-secondary)" }}>{cpDetail.metadata.session_id.substring(0, 12)}...</strong></span>}
                    {cpDetail?.metadata?.files_touched?.length > 0 && <span>Files: <strong style={{ color: "var(--accent-green)" }}>{cpDetail.metadata.files_touched.length}</strong></span>}
                  </div>
                </div>
              </div>
            )}

            {/* Live Pipeline Execution Trace (Section 5.10 & 12) */}
            {analysis?.pipeline && (
              <div className="card anim-in">
                <div className="card-hdr">
                  <div className="card-hdr-left">
                    <Activity size={15} className="card-icon" />
                    <span className="card-title">Live Analysis Trace</span>
                    <span className="pill" style={{ padding: "2px 8px", fontSize: "0.65rem" }}>
                      Completed in {analysis.pipeline_duration_ms}ms
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {analysis.pipeline.map((p, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.76rem", padding: "6px 10px", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <CheckCircle2 size={14} style={{ color: "var(--accent-green)" }} />
                          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{p.label || p.step}</span>
                        </div>
                        <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.68rem" }}>
                          +{p.time}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Main Tabbed Intelligence Views ── */}
            <div className="card anim-in">
              <div className="tabs" style={{ borderBottom: "1.5px solid var(--border-subtle)", padding: "0 14px" }}>
                <button
                  className={`tab-btn ${activeTab === "intent" ? "active" : ""}`}
                  onClick={() => setActiveTab("intent")}
                >
                  <Target size={14} />
                  Intent vs Implementation
                </button>
                <button
                  className={`tab-btn ${activeTab === "unfinished" ? "active" : ""}`}
                  onClick={() => setActiveTab("unfinished")}
                >
                  <AlertTriangle size={14} />
                  Unfinished Work ({missingCount})
                </button>
                <button
                  className={`tab-btn ${activeTab === "decisions" ? "active" : ""}`}
                  onClick={() => setActiveTab("decisions")}
                >
                  <Code2 size={14} />
                  Decisions & Assumptions
                </button>
                <button
                  className={`tab-btn ${activeTab === "radar" ? "active" : ""}`}
                  onClick={() => setActiveTab("radar")}
                >
                  <Radar size={14} />
                  Risk Radar ({activeRisksCount})
                </button>
                <button
                  className={`tab-btn ${activeTab === "graph" ? "active" : ""}`}
                  onClick={() => setActiveTab("graph")}
                >
                  <Shield size={14} />
                  Graph Evidence ({graphVerifiedCount})
                </button>
                <button
                  className={`tab-btn ${activeTab === "timeline" ? "active" : ""}`}
                  onClick={() => setActiveTab("timeline")}
                >
                  <Clock size={14} />
                  Timeline
                </button>
                <button
                  className={`tab-btn ${activeTab === "handoff" ? "active" : ""}`}
                  onClick={() => setActiveTab("handoff")}
                >
                  <FileJson size={14} />
                  Agent Handoff JSON
                </button>
              </div>

              <div className="card-body">
                {/* ── TAB 1: INTENT VS IMPLEMENTATION MATRIX (Section 5.4) ── */}
                {activeTab === "intent" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                    {/* Intent Header Card */}
                    <div className="term-panel">
                      <div className="term-hdr">
                        <div className="term-dots"><span className="term-dot r"/><span className="term-dot y"/><span className="term-dot g"/></div>
                        <span className="term-title">ORIGINAL INTENT (RECONSTRUCTED)</span>
                      </div>
                      <div className="term-body" style={{ fontSize: "0.85rem", color: "var(--accent-amber)" }}>
                        {analysis?.analysis?.data?.original_intent || analysis?.analysis?.data?.intent || cpDetail?.metadata?.message || "Select a checkpoint and run the intelligence pipeline to reconstruct developer intent."}
                      </div>
                    </div>

                    {/* Requirements Matrix Filter */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        REQUIREMENTS MATRIX ({filteredRequirements.length})
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {["ALL", "COMPLETED", "PARTIAL", "MISSING"].map(f => (
                          <button
                            key={f}
                            className={`pill ${reqFilter === f ? "online" : ""}`}
                            style={{ cursor: "pointer", border: reqFilter === f ? "1px solid var(--accent-amber)" : "1px solid var(--border-subtle)" }}
                            onClick={() => setReqFilter(f)}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Requirement Matrix Table */}
                    {filteredRequirements.length > 0 ? (
                      <div className="req-table-wrapper">
                        <table className="req-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Requirement</th>
                              <th>Status</th>
                              <th>Confidence</th>
                              <th>Codebase Evidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRequirements.map((r, i) => (
                              <tr key={r.id || i}>
                                <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--accent-cyan)" }}>
                                  {r.id || `REQ-${i + 1}`}
                                </td>
                                <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                                  {r.description}
                                </td>
                                <td>
                                  <span className={`status-badge ${r.status?.toLowerCase()}`}>
                                    {r.status}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "110px" }}>
                                    <div className="conf-bar-track">
                                      <div className="conf-bar-fill" style={{ width: `${Math.round((r.confidence || 0.9) * 100)}%` }} />
                                    </div>
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem" }}>
                                      {Math.round((r.confidence || 0.9) * 100)}%
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span className="code-citation">
                                    <FileCode size={12} />
                                    {r.evidence || "Verified in code"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty">
                        <Target size={28} className="empty-icon" />
                        <div className="empty-title">No Requirements Extracted</div>
                        <div className="empty-desc">Click Run Intelligence Pipeline to extract requirements from this checkpoint.</div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 2: UNFINISHED WORK DETECTOR (Section 5.5) ── */}
                {activeTab === "unfinished" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                      Requirements identified in development context that lack complete implementation evidence or were intentionally deferred:
                    </div>

                    {(analysis?.analysis?.data?.unfinished_work || []).length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {analysis.analysis.data.unfinished_work.map((u, i) => (
                          <div key={i} className="risk-card high anim-in">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <AlertTriangle size={15} style={{ color: "var(--accent-red)" }} />
                                <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.85rem" }}>
                                  {u.description}
                                </span>
                              </div>
                              <span className="status-badge missing">
                                PRIORITY: {u.priority || "HIGH"}
                              </span>
                            </div>
                            <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", display: "flex", gap: "8px", alignItems: "center" }}>
                              <strong style={{ color: "var(--text-muted)" }}>Evidence:</strong>
                              <span>{u.evidence || "No implementation evidence detected in Entire Graph"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty">
                        <CheckCircle2 size={28} className="empty-icon" style={{ color: "var(--accent-green)" }} />
                        <div className="empty-title">No Unfinished Requirements Flagged</div>
                        <div className="empty-desc">All stated requirements in this checkpoint were verified complete.</div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 3: DECISIONS & ASSUMPTIONS (Section 5.6 & 5.7) ── */}
                {activeTab === "decisions" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {/* Decisions Section */}
                    <div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Code2 size={16} style={{ color: "var(--accent-cyan)" }} />
                        ARCHITECTURAL & IMPLEMENTATION DECISIONS
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {(analysis?.analysis?.data?.important_decisions || []).map((d, i) => (
                          <div key={i} className="risk-card verified">
                            <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.84rem" }}>
                              {d.description}
                            </div>
                            <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                              <strong style={{ color: "var(--text-muted)" }}>Rationale:</strong> {d.rationale}
                            </div>
                            {d.relevant_files?.length > 0 && (
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                                {d.relevant_files.map((f, fi) => (
                                  <span key={fi} className="code-citation">{f}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Assumptions Section (Section 5.7) */}
                    <div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <HelpCircle size={16} style={{ color: "var(--accent-amber)" }} />
                        ASSUMPTION DETECTOR (UNVALIDATED AGENT/DEVELOPER HYPOTHESES)
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {(analysis?.analysis?.data?.assumptions || []).map((a, i) => (
                          <div key={i} className="assumption-card">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.82rem" }}>
                                {a.description}
                              </div>
                              <span className={`v-badge ${a.verification_status?.toLowerCase() || "unverified"}`}>
                                {a.verification_status || "UNVERIFIED"}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "12px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              <span>Source: <strong>{a.source}</strong></span>
                              <span>Risk: <strong style={{ color: a.risk_level === "HIGH" ? "var(--accent-red)" : "var(--accent-amber)" }}>{a.risk_level}</strong></span>
                              <span>Confidence: <strong>{Math.round((a.confidence || 0.8) * 100)}%</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 4: RISK RADAR (Section 5.8) ── */}
                {activeTab === "radar" && (
                  <div className="risk-grid">
                    {(analysis?.analysis?.data?.risks || []).map((r, i) => {
                      const sev = (r.severity || "MEDIUM").toLowerCase();
                      return (
                        <div key={i} className={`risk-card ${sev}`}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.85rem" }}>
                              {r.description}
                            </span>
                            <span className={`status-badge ${sev === "high" ? "missing" : "partial"}`}>
                              {r.severity} RISK
                            </span>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            <strong style={{ color: "var(--text-muted)" }}>Evidence:</strong> {r.evidence}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── TAB 5: 4-STATE GRAPH EVIDENCE (Section 4.4 & 5.9) ── */}
                {activeTab === "graph" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      Every finding is verified against the actual repository structure using <strong>Entire Graph</strong> semantic code search:
                    </div>

                    {(analysis?.graph_verification || []).map((gv, i) => {
                      const statusClass = (gv.status || "unverified").toLowerCase();
                      return (
                        <div key={i} className="card anim-in" style={{ padding: "12px 16px", borderColor: gv.status === "VERIFIED" ? "var(--accent-green)" : gv.status === "CONTRADICTED" ? "var(--accent-red)" : "var(--border-subtle)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                            <div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                {gv.claim}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                                Query: "{gv.query}" · Source: Entire Graph
                              </div>
                            </div>
                            <span className={`v-badge ${statusClass}`}>
                              {gv.status}
                            </span>
                          </div>

                          {/* Matches */}
                          {gv.evidence?.top_matches?.length > 0 && (
                            <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                              {gv.evidence.top_matches.map((m, mi) => (
                                <div key={mi} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.74rem", background: "var(--bg-secondary)", padding: "4px 8px", borderRadius: "4px" }}>
                                  <span className="code-citation">
                                    <FileCode size={12} />
                                    {m.file}:{m.line}
                                  </span>
                                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--accent-green)" }}>
                                    Relevance Score: {m.score}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Impact Info */}
                          {gv.impact && (
                            <div style={{ marginTop: "6px", fontSize: "0.72rem", color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                              Symbol: {gv.impact.symbol} · Callers: {gv.impact.callers_count} · Callees: {gv.impact.callees_count}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── TAB 6: DEVELOPMENT TIMELINE (Section 5.3) ── */}
                {activeTab === "timeline" && (
                  <div className="timeline">
                    {timeline.map((item, i) => (
                      <div key={item.id || i} className="tl-item">
                        <span className={`tl-dot ${item.type === "session" ? "session" : ""}`} />
                        <div className="tl-header">
                          <div className="tl-title">
                            {item.type === "session" ? <Terminal size={14} style={{ color: "var(--accent-cyan)" }} /> : <GitCommit size={14} style={{ color: "var(--accent-amber)" }} />}
                            {item.title}
                          </div>
                          <div className="tl-date">
                            {new Date(item.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="tl-body">
                          {item.subtitle}
                        </div>
                        <div className="tl-meta">
                          {item.agent && <span className="pill">{item.agent}</span>}
                          {item.model && <span className="pill">{item.model}</span>}
                          {item.turns && <span className="pill">{item.turns} turns</span>}
                          <span className={item.is_real ? "badge-real" : "badge-demo"}>
                            {item.is_real ? "REAL" : "SAMPLE"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── TAB 7: AGENT HANDOFF JSON (Section 6) ── */}
                {activeTab === "handoff" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                        Standardized machine-readable handoff for another developer or AI coding agent (Section 6 Specification):
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="btn btn-s" onClick={copyHandoff}>
                          <Copy size={13} />
                          {copied ? "Copied!" : "Copy JSON"}
                        </button>
                        <button className="btn btn-p" onClick={downloadHandoff}>
                          <Download size={13} />
                          Download JSON
                        </button>
                      </div>
                    </div>

                    <div className="term-panel">
                      <div className="term-hdr">
                        <div className="term-dots"><span className="term-dot r"/><span className="term-dot y"/><span className="term-dot g"/></div>
                        <span className="term-title">agent-handoff.json</span>
                      </div>
                      <div className="term-body" style={{ maxHeight: "420px", overflowY: "auto" }}>
                        <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.76rem" }}>
                          {JSON.stringify(analysis?.handoff || { message: "Run pipeline to generate handoff JSON" }, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
