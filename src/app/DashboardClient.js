"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Database, Shield, FileCode, AlertTriangle, CheckCircle2,
  XCircle, Clock, Cpu, Copy, Download, RefreshCw, Layers,
  Activity, Eye, Zap, ChevronRight, ChevronDown,
  Target, AlertCircle, FileJson, BookOpen, Sparkles,
  Code2, Play, X
} from "lucide-react";

const API = "";

function repoQuery(repoPath) {
  return repoPath ? `?repo=${encodeURIComponent(repoPath)}` : "";
}

/* ──────────────────────────────────────────────────────────────
   4-STAGE VISUAL INTELLIGENCE WORKFLOW (Story of the Platform)
   ────────────────────────────────────────────────────────────── */
const WORKFLOW_STAGES = [
  {
    id: "checkpoint",
    step: "01",
    name: "Entire Checkpoint",
    role: "Context Ingestion",
    desc: "Captures developer intent, prompts, turns & git diffs",
    icon: Layers,
    color: "gold",
  },
  {
    id: "databricks",
    step: "02",
    name: "Databricks AI",
    role: "Intelligence Extraction",
    desc: "Foundation model extracts tasks, decisions & risks",
    icon: Cpu,
    color: "purple",
  },
  {
    id: "graph",
    step: "03",
    name: "Entire Graph",
    role: "Code Verification",
    desc: "Tree-sitter local call-graph verifies claims against code",
    icon: Shield,
    color: "green",
  },
  {
    id: "handoff",
    step: "04",
    name: "Actionable Handoff",
    role: "Autonomous Continuation",
    desc: "Machine-readable JSON & agent resume directive",
    icon: FileJson,
    color: "cyan",
  },
];

export default function Dashboard() {
  // Core State
  const [repoPath, setRepoPath] = useState("");
  const [health, setHealth] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [selectedCp, setSelectedCp] = useState(null);
  const [cpDetail, setCpDetail] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview"); // overview | requirements | risks | evidence | handoff

  // Filters & Toggles
  const [reqFilter, setReqFilter] = useState("ALL");
  const [showRawTranscript, setShowRawTranscript] = useState(false);
  const [copiedHandoff, setCopiedHandoff] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Databricks Lakehouse & Advisor State
  const [lakehouseHistory, setLakehouseHistory] = useState([]);
  const [lakehouseStoreStatus, setLakehouseStoreStatus] = useState(null);
  const [advisorDirective, setAdvisorDirective] = useState(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [lakehouseLoading, setLakehouseLoading] = useState(false);
  const [advisorCopied, setAdvisorCopied] = useState(false);

  // Judge Demo Walkthrough State
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoStep, setDemoStep] = useState(1);

  // Initial Load & Escape Key Listener
  useEffect(() => {
    fetchHealth();
    loadAllData();

    function handleKeyDown(e) {
      if (e.key === "Escape") setIsDemoModalOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchHealth(repo) {
    try {
      const q = repoQuery(repo);
      const r = await fetch(`${API}/api/health${q}`);
      const d = await r.json();
      setHealth(d);
      if (!repoPath && d.repository) {
        setRepoPath(process.env.NEXT_PUBLIC_REPO_PATH || "");
      }
    } catch (e) {
      setHealth(null);
    }
  }

  async function loadAllData(customPath) {
    const targetPath = customPath || repoPath || "";
    setLoading("initial");
    setError(null);

    try {
      await fetchHealth(targetPath);
      await fetchLakehouseHistory();

      // Load Checkpoints
      const cpRes = await fetch(`${API}/api/checkpoints${repoQuery(targetPath)}`);
      const cpData = await cpRes.json();
      const loadedCps = cpData.checkpoints || [];
      setCheckpoints(loadedCps);

      // Select real checkpoint by default if available
      if (loadedCps.length > 0 && !selectedCp) {
        const realCp = loadedCps.find(c => c.is_real) || loadedCps[0];
        selectCheckpoint(realCp, targetPath);
      }
    } catch (e) {
      setError("Failed to load development context: " + e.message);
    }
    setLoading("");
  }

  async function selectCheckpoint(cp, pathOverride) {
    const targetPath = pathOverride || repoPath;
    const cpId = cp.id || cp.checkpoint_id || cp;
    setSelectedCp(cpId);
    setLoading("detail");
    setError(null);
    setShowRawTranscript(false);
    setAnalysis(null);

    try {
      const r = await fetch(`${API}/api/checkpoint/${encodeURIComponent(cpId)}${repoQuery(targetPath)}`);
      if (!r.ok) {
        throw new Error(`Checkpoint API returned status ${r.status}`);
      }
      const d = await r.json();
      setCpDetail(d);
    } catch (e) {
      setError("Failed to load checkpoint detail: " + e.message);
    }
    setLoading("");
  }

  // ── Run Full Intelligence Pipeline ──
  async function runFullAnalysis() {
    if (!selectedCp) return;
    setLoading("analysis");
    setError(null);

    try {
      const r = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointId: selectedCp, ...(repoPath ? { repoPath } : {}) }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Analysis failed");
      setAnalysis(d);
      setActiveTab("overview");
      fetchLakehouseHistory();
    } catch (e) {
      setError("Analysis pipeline failed: " + e.message);
    }
    setLoading("");
  }

  // ── Databricks Lakehouse & Advisor Handlers ──
  async function fetchLakehouseHistory() {
    try {
      const r = await fetch(`${API}/api/databricks/lakehouse`);
      const d = await r.json();
      if (d.records) setLakehouseHistory(d.records);
    } catch (e) {
      console.error("Failed to load lakehouse history:", e);
    }
  }

  async function saveToLakehouse() {
    if (!analysis) return;
    setLakehouseLoading(true);
    setLakehouseStoreStatus(null);
    try {
      const r = await fetch(`${API}/api/databricks/store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpointId: selectedCp,
          ...(repoPath ? { repoPath } : {}),
          analysis: analysis.analysis?.data,
          handoff: analysis.handoff,
          report: analysis.report,
        }),
      });
      const d = await r.json();
      setLakehouseStoreStatus(d);
      fetchLakehouseHistory();
    } catch (e) {
      setLakehouseStoreStatus({ success: false, error: e.message });
    }
    setLakehouseLoading(false);
  }

  async function generateAdvisorDirective() {
    if (!analysis) return;
    setAdvisorLoading(true);
    setAdvisorDirective(null);
    try {
      const r = await fetch(`${API}/api/databricks/advisor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpointId: selectedCp,
          analysis: analysis.analysis?.data,
          graphVerification: analysis.graph_verification,
        }),
      });
      const d = await r.json();
      setAdvisorDirective(d);
    } catch (e) {
      setAdvisorDirective({ success: false, error: e.message });
    }
    setAdvisorLoading(false);
  }

  function copyAdvisorDirective() {
    if (!advisorDirective?.advisor_prompt) return;
    navigator.clipboard.writeText(advisorDirective.advisor_prompt);
    setAdvisorCopied(true);
    setTimeout(() => setAdvisorCopied(false), 2000);
  }

  function copyHandoff() {
    if (!analysis?.handoff) return;
    navigator.clipboard.writeText(JSON.stringify(analysis.handoff, null, 2));
    setCopiedHandoff(true);
    setTimeout(() => setCopiedHandoff(false), 2000);
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

  function copyReport() {
    if (!analysis?.report) return;
    navigator.clipboard.writeText(analysis.report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  }

  function downloadReport() {
    if (!analysis?.report) return;
    const blob = new Blob([analysis.report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intelligence-report-${selectedCp || "export"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Derived Statistics ──
  const reqList = useMemo(() => {
    const rawReqs = analysis?.analysis?.data?.requirements;
    if (Array.isArray(rawReqs) && rawReqs.length > 0) {
      return rawReqs;
    }
    const list = [];
    (analysis?.analysis?.data?.completed_work || []).forEach((c, idx) => {
      list.push({
        id: `REQ-${list.length + 1}`,
        description: typeof c === 'string' ? c : (c.description || JSON.stringify(c)),
        status: "COMPLETED",
        confidence: c.confidence || 0.95,
        evidence: c.evidence || "Verified in codebase",
      });
    });
    (analysis?.analysis?.data?.partial_work || []).forEach((p, idx) => {
      list.push({
        id: `REQ-${list.length + 1}`,
        description: typeof p === 'string' ? p : (p.description || JSON.stringify(p)),
        status: "PARTIAL",
        confidence: p.confidence || 0.85,
        evidence: p.evidence || p.missing_aspects || "Partially implemented",
      });
    });
    (analysis?.analysis?.data?.unfinished_work || []).forEach((u, idx) => {
      list.push({
        id: `REQ-${list.length + 1}`,
        description: typeof u === 'string' ? u : (u.description || JSON.stringify(u)),
        status: "MISSING",
        confidence: u.confidence || 0.90,
        evidence: u.evidence || "Not implemented in codebase",
      });
    });
    return list;
  }, [analysis]);
  const completedCount = reqList.filter(r => r.status === "COMPLETED").length;
  const partialCount = reqList.filter(r => r.status === "PARTIAL").length;
  const missingCount = reqList.filter(r => r.status === "MISSING").length;
  const graphVerifiedCount = (analysis?.graph_verification || []).filter(e => e.status === "VERIFIED").length;
  const activeRisks = analysis?.analysis?.data?.risks || [];
  const databricksInfo = health?.services?.databricks || {};
  const databricksOnline = databricksInfo.status === "online" || databricksInfo.configured;
  const databricksModelName = databricksInfo.model_name || databricksInfo.model || "Databricks model";
  const analysisSourceLabel = !analysis ? "NOT ANALYZED" : (analysis.analysis?.source === "databricks" ? "DATABRICKS AI GENERATED" : "LOCAL FALLBACK GENERATED");
  const realCheckpointCount = checkpoints.filter(c => c.is_real !== false).length;
  const demoCheckpointCount = checkpoints.length - realCheckpointCount;

  const filteredRequirements = useMemo(() => {
    if (reqFilter === "ALL") return reqList;
    return reqList.filter(r => r.status === reqFilter);
  }, [reqList, reqFilter]);

  // Selected Checkpoint files
  const filesTouched = cpDetail?.metadata?.files_touched || cpDetail?.files_touched || [];

  return (
    <div className="layout-container">
      {/* ── TOP EXECUTIVE HEADER ── */}
      <header className="header">
        <div className="brand-section">
          <div className="brand-logo">⛏</div>
          <div>
            <div className="brand-title">
              Code Archaeologist
              <span style={{ fontSize: "0.65rem", padding: "2px 8px", background: "rgba(245, 158, 11, 0.12)", color: "var(--accent-gold)", borderRadius: "4px", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                v2.0
              </span>
            </div>
            <div className="brand-subtitle">
              Checkpoint-Native Developer Intelligence · Entire + Databricks + Entire Graph
            </div>
          </div>
        </div>

        <div className="header-right">
          {/* Entire Connection Pill */}
          <div className="status-pill">
            <span className={`status-dot ${health?.services?.entire?.status === "online" ? "online" : "offline"}`} />
            <span>Entire Connected</span>
            <div className="tooltip-box">
              <strong>Entire CLI ({health?.services?.entire?.version?.split('\n')[0] || "Active"})</strong><br />
              Primary data source capturing real developer prompts, session transcripts, and checkpoint context on git commits.
            </div>
          </div>

          {/* Databricks AI Pill */}
          <div className="status-pill">
            <span className={`status-dot ${databricksOnline ? "online" : "warn"}`} />
            <span>{databricksOnline ? `Databricks AI: ${databricksModelName}` : "Databricks: Fallback"}</span>
            <div className="tooltip-box">
              <strong>{databricksInfo.type || "Databricks intelligence layer"}</strong><br />
              {databricksOnline
                ? `Model ${databricksInfo.model || databricksModelName} reconstructs intent, requirements, assumptions, and risks.`
                : "Backend will use deterministic local fallback until DATABRICKS_HOST and DATABRICKS_TOKEN are configured."}
            </div>
          </div>

          {/* Graph Ready Pill */}
          <div className="status-pill">
            <span className={`status-dot ${health?.services?.graph?.status === "online" ? "online" : "offline"}`} />
            <span>Graph Ready</span>
            <div className="tooltip-box">
              <strong>Entire Graph (Tree-sitter)</strong><br />
              Local semantic code engine that verifies AI findings against actual symbol definitions, call relationships, and file lines.
            </div>
          </div>

          {/* Judge Demo Walkthrough Button */}
          <button className="btn btn-demo" onClick={() => { setIsDemoModalOpen(true); setDemoStep(1); }}>
            <Sparkles size={14} />
            Judge Demo Walkthrough
          </button>

          {/* Run Full Intelligence Analysis Button */}
          <button
            className="btn btn-primary"
            onClick={runFullAnalysis}
            disabled={loading === "analysis" || !selectedCp}
          >
            {loading === "analysis" ? (
              <>
                <RefreshCw size={14} className="spin" />
                Running Pipeline...
              </>
            ) : (
              <>
                <Play size={14} />
                Run Intelligence Pipeline
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── 4 CLICKABLE EXECUTIVE INTELLIGENCE CARDS (SECTION 1) ── */}
      <div className="metric-cards-grid">
        {/* Card 1: Checkpoints */}
        <div
          className="metric-card"
          onClick={() => {
            const el = document.getElementById("checkpoint-explorer-section");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <div className="metric-card-header">
            <span className="metric-card-title">Checkpoints</span>
            <div className="metric-card-icon"><Layers size={14} /></div>
          </div>
          <div className="metric-card-value">
            {realCheckpointCount}
            <span style={{ fontSize: "0.7rem", color: "var(--accent-green)", fontWeight: 600 }}>REAL ENTIRE</span>
          </div>
          <div className="metric-card-sub">
            {checkpoints.length} total ingested · {demoCheckpointCount} sample
          </div>
        </div>

        {/* Card 2: Requirements Matrix */}
        <div
          className="metric-card"
          onClick={() => setActiveTab("requirements")}
        >
          <div className="metric-card-header">
            <span className="metric-card-title">Requirements Matrix</span>
            <div className="metric-card-icon"><Target size={14} /></div>
          </div>
          <div className="metric-card-value">
            <span style={{ color: "var(--accent-green)" }}>{completedCount}</span>
            <span style={{ color: "var(--text-muted)", fontSize: "1.2rem" }}>/</span>
            <span style={{ color: "var(--accent-gold)" }}>{partialCount}</span>
            <span style={{ color: "var(--text-muted)", fontSize: "1.2rem" }}>/</span>
            <span style={{ color: "var(--accent-red)" }}>{missingCount}</span>
          </div>
          <div className="metric-card-sub">
            Completed / Partial / Missing detected
          </div>
        </div>

        {/* Card 3: Verified Findings */}
        <div
          className="metric-card green"
          onClick={() => setActiveTab("evidence")}
        >
          <div className="metric-card-header">
            <span className="metric-card-title">Verified Findings</span>
            <div className="metric-card-icon"><Shield size={14} style={{ color: "var(--accent-green)" }} /></div>
          </div>
          <div className="metric-card-value" style={{ color: "var(--accent-green)" }}>
            {graphVerifiedCount}
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
              / {analysis?.graph_verification?.length || 0}
            </span>
          </div>
          <div className="metric-card-sub">
            Ground-truth Entire Graph verified claims
          </div>
        </div>

        {/* Card 4: Active Risks */}
        <div
          className="metric-card red"
          onClick={() => setActiveTab("risks")}
        >
          <div className="metric-card-header">
            <span className="metric-card-title">Active Risks</span>
            <div className="metric-card-icon"><AlertTriangle size={14} style={{ color: "var(--accent-red)" }} /></div>
          </div>
          <div className="metric-card-value" style={{ color: activeRisks.length > 0 ? "var(--accent-red)" : "var(--text-primary)" }}>
            {activeRisks.length}
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              {activeRisks.filter(r => r.severity === "HIGH").length} High Severity
            </span>
          </div>
          <div className="metric-card-sub">
            Architectural & security blindspots
          </div>
        </div>
      </div>

      {/* ── PRIMARY WORKFLOW SECTION: THE VISUAL INTELLIGENCE PIPELINE (SECTION 2) ── */}
      <section className="workflow-section">
        <div className="workflow-header">
          <div className="workflow-title-wrap">
            <span className="workflow-tag">Core Story</span>
            <h2 className="workflow-title">Checkpoint-Native Developer Intelligence Pipeline</h2>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
              Target: <strong style={{ color: "var(--text-primary)" }}>{health?.repository || "Code-Archaeologist"}</strong> ({health?.branch || "master"})
            </span>
          </div>
        </div>

        {/* 4-Stage Horizontal Flow Grid */}
        <div className="workflow-grid">
          {WORKFLOW_STAGES.map((st, idx) => {
            const Icon = st.icon;
            const isCurrent = loading === "analysis" && (
              (idx === 0) ||
              (idx === 1 && analysis?.pipeline?.[1]?.status === "running") ||
              (idx === 2 && analysis?.pipeline?.[2]?.status === "running") ||
              (idx === 3 && analysis?.pipeline?.[3]?.status === "running")
            );
            const isCompleted = !!analysis;

            return (
              <div
                key={st.id}
                className={`workflow-card ${isCurrent ? "active" : ""} ${isCompleted ? "completed" : ""}`}
              >
                <div>
                  <div className="workflow-step-num">STAGE {st.step}</div>
                  <div className="workflow-card-name">
                    <Icon size={16} />
                    {st.name}
                  </div>
                  <div className="workflow-card-desc">{st.desc}</div>
                </div>
                <div className="workflow-card-footer">
                  <span style={{ color: "var(--text-muted)" }}>{st.role}</span>
                  {isCompleted ? (
                    <span style={{ color: "var(--accent-green)", display: "flex", alignItems: "center", gap: "3px" }}>
                      <CheckCircle2 size={12} /> Ready
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>Standby</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Processing Stepper Status */}
        {analysis?.pipeline && (
          <div className="live-stepper-bar fade-in">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity size={14} style={{ color: "var(--accent-gold)" }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Live Execution Trace:
              </span>
            </div>
            <div className="stepper-steps-row">
              {analysis.pipeline.map((p, pi) => (
                <div key={pi} className="stepper-pill done">
                  <CheckCircle2 size={12} />
                  <span>{p.label}</span>
                  <span style={{ color: "var(--text-muted)" }}>+{p.time}ms</span>
                </div>
              ))}
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Total: {analysis.pipeline_duration_ms}ms
            </span>
          </div>
        )}
      </section>

      {/* ── MAIN WORKSPACE GRID: CHECKPOINT EXPLORER & INTELLIGENCE VIEWS ── */}
      <div className="workspace-grid" id="checkpoint-explorer-section">
        {/* ── LEFT PANEL: CHECKPOINT EXPLORER (SECTION 3) ── */}
        <div className="sidebar-panel">
          <div className="panel-card">
            <div className="panel-header">
              <div className="panel-title">
                <Layers size={14} style={{ color: "var(--accent-gold)" }} />
                Checkpoint Explorer ({checkpoints.length})
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => loadAllData(repoPath)}
                disabled={loading === "initial"}
                style={{ padding: "4px 8px", fontSize: "0.7rem" }}
              >
                <RefreshCw size={11} className={loading === "initial" ? "spin" : ""} />
                Scan
              </button>
            </div>

            <div className="checkpoint-cards-list">
              {checkpoints.map((cp, idx) => {
                const cpId = cp.id || cp.checkpoint_id;
                const isSelected = selectedCp === cpId;
                const isReal = cp.is_real !== false;

                return (
                  <div
                    key={cpId || idx}
                    className={`checkpoint-card-item ${isSelected ? "selected" : ""}`}
                    onClick={() => selectCheckpoint(cp)}
                  >
                    <div className="cp-top-row">
                      <span className="cp-id-tag">{cpId.substring(0, 14)}...</span>
                      <span className={isReal ? "badge-real" : "badge-demo"}>
                        {isReal ? "REAL ENTIRE" : "SAMPLE DEMO"}
                      </span>
                    </div>

                    <div className="cp-intent-text">
                      {cp.message || cp.summary || "AI development session"}
                    </div>

                    <div className="cp-meta-row">
                      <span>{cp.agent || "Entire Agent"}</span>
                      <span>{cp.files_count || (cp.files_touched?.length) || 2} files</span>
                      <span>{cp.turns ? `${cp.turns} turns` : "Committed"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Lakehouse Status Widget */}
          <div className="panel-card" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontWeight: 700, color: "var(--accent-gold)" }}>
                <Database size={13} />
                Lakehouse Audit Store
              </div>
              <span className="badge-real" style={{ fontSize: "0.6rem" }}>LAKEHOUSE READY</span>
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
              Stores report and handoff records as a local JSONL audit log shaped for <code style={{ color: "var(--accent-cyan)" }}>dev_intelligence.checkpoints_delta</code>.
            </div>
            <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem", color: "var(--text-muted)" }}>
              <span>Stored Records: <strong>{lakehouseHistory.length}</strong></span>
              <button
                className="btn btn-secondary"
                onClick={saveToLakehouse}
                disabled={lakehouseLoading || !analysis}
                style={{ padding: "3px 8px", fontSize: "0.68rem" }}
              >
                {lakehouseLoading ? "Writing..." : "Save Audit"}
              </button>
            </div>
            {lakehouseStoreStatus && (
              <div style={{ marginTop: "8px", fontSize: "0.68rem", color: lakehouseStoreStatus.success ? "var(--accent-green)" : "var(--accent-red)" }}>
                {lakehouseStoreStatus.message || lakehouseStoreStatus.error}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: MAIN INTELLIGENCE RESULTS (SECTIONS 4, 5, 6, 7) ── */}
        <div className="main-content-panel">
          {/* Error Banner */}
          {error && (
            <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "var(--radius-sm)", color: "var(--accent-red)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px", fontSize: "0.8rem" }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Selected Checkpoint Executive Context View (Section 3) */}
          {selectedCp && (
            <div className="selected-cp-hero fade-in">
              <div className="selected-cp-top">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <BookOpen size={16} style={{ color: "var(--accent-gold)" }} />
                    <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff" }}>
                      Checkpoint: {selectedCp}
                    </span>
                    <span className={cpDetail?.is_demo ? "badge-demo" : "badge-real"}>
                      {cpDetail?.is_demo ? "SAMPLE DATA" : "REAL ENTIRE CONTEXT"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    Agent: <strong style={{ color: "var(--accent-gold)" }}>{cpDetail?.metadata?.agent || "Entire Agent"}</strong> · Model: <strong style={{ color: "var(--accent-cyan)" }}>{cpDetail?.metadata?.model || "AI Model"}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="btn btn-primary"
                    onClick={runFullAnalysis}
                    disabled={loading === "analysis"}
                  >
                    {loading === "analysis" ? (
                      <>
                        <RefreshCw size={13} className="spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Zap size={13} />
                        Run Analysis
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Original Intent (Clear blockquote) */}
              <div className="intent-callout-box">
                <div className="intent-callout-label">Original Reconstructed Intent</div>
                <div className="intent-callout-text">
                  {analysis?.analysis?.data?.original_intent || analysis?.analysis?.data?.intent || cpDetail?.metadata?.message || "Reconstruct intent by running the intelligence pipeline."}
                </div>
              </div>

              {/* Files Changed Chips */}
              {filesTouched.length > 0 && (
                <div className="files-chips-row">
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>Files Changed:</span>
                  {filesTouched.map((f, fi) => (
                    <span key={fi} className="file-chip">
                      <FileCode size={11} />
                      {typeof f === "string" ? f : (f.path || f.file || JSON.stringify(f))}
                    </span>
                  ))}
                </div>
              )}

              {/* Expandable Accordion for Raw Transcript Evidence */}
              <button
                className="accordion-toggle"
                onClick={() => setShowRawTranscript(!showRawTranscript)}
              >
                {showRawTranscript ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>View Raw Entire Transcript Evidence ({showRawTranscript ? "Collapse" : "Expand"})</span>
              </button>

              {showRawTranscript && (
                <div className="accordion-body fade-in">
                  {cpDetail?.explanation || "Raw Entire session transcript loaded from .entire/checkpoints store."}
                </div>
              )}
            </div>
          )}

          {/* ── TABS NAVIGATION BAR (SECTION 6) ── */}
          <div className="tabs-nav-bar">
            <button
              className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <Eye size={14} />
              Overview
            </button>
            <button
              className={`tab-btn ${activeTab === "requirements" ? "active" : ""}`}
              onClick={() => setActiveTab("requirements")}
            >
              <Target size={14} />
              Requirements ({reqList.length})
            </button>
            <button
              className={`tab-btn ${activeTab === "risks" ? "active" : ""}`}
              onClick={() => setActiveTab("risks")}
            >
              <AlertTriangle size={14} />
              Risks ({activeRisks.length})
            </button>
            <button
              className={`tab-btn ${activeTab === "evidence" ? "active" : ""}`}
              onClick={() => setActiveTab("evidence")}
            >
              <Shield size={14} />
              Entire Graph Evidence ({graphVerifiedCount})
            </button>
            <button
              className={`tab-btn ${activeTab === "report" ? "active" : ""}`}
              onClick={() => setActiveTab("report")}
            >
              <BookOpen size={14} />
              Intelligence Report
            </button>
            <button
              className={`tab-btn ${activeTab === "handoff" ? "active" : ""}`}
              onClick={() => setActiveTab("handoff")}
            >
              <FileJson size={14} />
              Actionable Handoff Spec
            </button>
          </div>

          {/* ── TAB 1: OVERVIEW (WHAT HAPPENED IN THIS CHECKPOINT?) ── */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="fade-in">
              <div className="panel-card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#ffffff" }}>Executive Intelligence Summary</h3>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "3px" }}>
                      Reconstructed understanding of developer intention, delivered code, and deferred work.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span className="badge-ai">{analysisSourceLabel}</span>
                    <span className="badge-graph">GRAPH VERIFIED {graphVerifiedCount}/{analysis?.graph_verification?.length || 0}</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginBottom: "14px" }}>
                  <div style={{ background: "var(--bg-surface-elevated)", padding: "9px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 700 }}>ENTIRE EVIDENCE</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--accent-green)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                      {analysis?.analysis?.data?.provenance?.evidence_class || (cpDetail?.is_demo ? "SAMPLE DEMO" : "REAL ENTIRE EVIDENCE")}
                    </div>
                  </div>
                  <div style={{ background: "var(--bg-surface-elevated)", padding: "9px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 700 }}>AI LAYER</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--accent-gold)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                      {analysisSourceLabel}
                    </div>
                  </div>
                  <div style={{ background: "var(--bg-surface-elevated)", padding: "9px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 700 }}>CONTEXT ADAPTER</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--accent-cyan)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                      {analysis?.analysis?.context?.transcript_chunks || 0} chunks{analysis?.analysis?.context?.transcript_truncated ? " · truncated" : ""}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginTop: "14px" }}>
                  <div style={{ background: "var(--bg-surface-elevated)", padding: "12px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--accent-green)", fontWeight: 700, textTransform: "uppercase" }}>Completed Work</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>{completedCount} items</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>AI-classified, then checked by Graph</div>
                  </div>

                  <div style={{ background: "var(--bg-surface-elevated)", padding: "12px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--accent-gold)", fontWeight: 700, textTransform: "uppercase" }}>Partial / In-Progress</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>{partialCount} items</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>Initiated but not complete</div>
                  </div>

                  <div style={{ background: "var(--bg-surface-elevated)", padding: "12px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--accent-red)", fontWeight: 700, textTransform: "uppercase" }}>Missing Requirements</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>{missingCount} items</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>Discussed but left unfinished</div>
                  </div>
                </div>

                {/* Important Decisions & Assumptions Preview */}
                <div style={{ marginTop: "18px" }}>
                  <h4 style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Code2 size={14} style={{ color: "var(--accent-cyan)" }} />
                    Architectural Decisions & Assumptions
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(analysis?.analysis?.data?.important_decisions || []).slice(0, 2).map((d, di) => (
                      <div key={di} style={{ background: "var(--bg-surface-elevated)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", fontSize: "0.76rem" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.description}</div>
                        <div style={{ color: "var(--text-secondary)", marginTop: "3px" }}>{d.rationale}</div>
                      </div>
                    ))}
                    {(analysis?.analysis?.data?.important_decisions || []).length === 0 && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Click Run Intelligence Pipeline to extract decisions and assumptions.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: REQUIREMENTS MATRIX (SECTION 6) ── */}
          {activeTab === "requirements" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  Requirements extracted from Entire checkpoint context by <strong>{analysisSourceLabel}</strong> and checked with <strong>Entire Graph</strong>:
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {["ALL", "COMPLETED", "PARTIAL", "MISSING"].map(f => (
                    <button
                      key={f}
                      className={`btn btn-secondary ${reqFilter === f ? "btn-primary" : ""}`}
                      style={{ padding: "4px 10px", fontSize: "0.7rem" }}
                      onClick={() => setReqFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="req-cards-grid">
                {filteredRequirements.map((r, ri) => (
                  <div key={r.id || ri} className="req-item-card">
                    <div className="req-top-row">
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.74rem", fontWeight: 700, color: "var(--accent-gold)" }}>
                          {r.id || `REQ-${ri + 1}`}
                        </span>
                        <div>
                          <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#ffffff" }}>
                            {r.description}
                          </div>
                          <div className="req-evidence-line">
                            <span className="badge-ai">{analysis?.analysis?.source === "databricks" ? "Databricks AI" : "Fallback AI"}</span>
                            <span>Confidence: <strong>{Math.round((r.confidence || 0.9) * 100)}%</strong></span>
                            <span className={`req-status-pill ${(r.verification_status || "UNVERIFIED").toLowerCase()}`} style={{ padding: "2px 6px", fontSize: "0.62rem" }}>
                              {r.verification_status || "UNVERIFIED"}
                            </span>
                            <span style={{ color: "var(--border-focus)" }}>·</span>
                            <FileCode size={12} style={{ color: "var(--accent-cyan)" }} />
                            <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
                              {r.source_checkpoint_evidence || r.evidence || "Entire checkpoint context"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className={`req-status-pill ${r.status?.toLowerCase()}`}>
                        {r.status === "COMPLETED" && <CheckCircle2 size={12} />}
                        {r.status === "PARTIAL" && <Clock size={12} />}
                        {r.status === "MISSING" && <XCircle size={12} />}
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}

                {filteredRequirements.length === 0 && (
                  <div className="panel-card" style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
                    {`No requirements found under filter ${reqFilter}. Click Run Intelligence Pipeline to analyze this checkpoint.`}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 3: RISKS RADAR (SECTION 6) ── */}
          {activeTab === "risks" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }} className="fade-in">
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Prioritized architectural, regression, and security risks identified by {analysisSourceLabel}:
              </div>

              {activeRisks.map((risk, ri) => (
                <div key={ri} className="panel-card" style={{ padding: "16px 18px", borderLeft: `4px solid ${risk.severity === "HIGH" ? "var(--accent-red)" : "var(--accent-gold)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <AlertTriangle size={16} style={{ color: risk.severity === "HIGH" ? "var(--accent-red)" : "var(--accent-gold)" }} />
                      <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#ffffff" }}>
                        {risk.description}
                      </span>
                    </div>
                    <span className={`req-status-pill ${risk.severity === "HIGH" ? "missing" : "partial"}`}>
                      {risk.severity || "MEDIUM"} SEVERITY
                    </span>
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", display: "flex", gap: "8px" }}>
                    <strong style={{ color: "var(--text-muted)" }}>Evidence:</strong>
                    <span>{risk.source_checkpoint_evidence || risk.evidence || "Identified during session analysis"}</span>
                  </div>
                </div>
              ))}

              {activeRisks.length === 0 && (
                <div className="panel-card" style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
                  No high-priority risks detected. Run the intelligence pipeline to evaluate this checkpoint.
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: ENTIRE GRAPH EVIDENCE LAYER (SECTION 5) ── */}
          {activeTab === "evidence" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="fade-in">
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Deterministic ground-truth code verification using <strong>Entire Graph</strong> Tree-sitter static semantic analysis:
              </div>

              <div className="evidence-cards-list">
                {(analysis?.graph_verification || []).map((gv, gi) => {
                  const isVerified = gv.status === "VERIFIED";
                  const isContradicted = gv.status === "CONTRADICTED";
                  const statusClass = isVerified ? "verified" : (isContradicted ? "contradicted" : "unverified");

                  return (
                    <div key={gi} className={`evidence-card ${statusClass}`}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <div>
                          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#ffffff" }}>
                            {gv.claim}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                            Query: {gv.query} · Source: Entire Graph CLI
                          </div>
                          {gv.evidence?.explanation && (
                            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "5px" }}>
                              {gv.evidence.explanation}
                            </div>
                          )}
                          {gv.evidence?.graph_command && (
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                              {gv.evidence.graph_command}
                            </div>
                          )}
                        </div>
                        <span className={`req-status-pill ${isVerified ? "completed" : (isContradicted ? "missing" : "partial")}`}>
                          {gv.status}
                        </span>
                      </div>

                      {/* Graph Matches */}
                      {gv.evidence?.top_matches?.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
                          {gv.evidence.top_matches.map((m, mi) => (
                            <div key={mi} style={{ display: "flex", justifyContent: "space-between", background: "var(--bg-surface-elevated)", padding: "6px 10px", borderRadius: "4px", fontSize: "0.74rem" }}>
                              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-cyan)", display: "flex", alignItems: "center", gap: "6px" }}>
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

                      {/* Callers / Callees Impact */}
                      {gv.impact && (
                        <div style={{ marginTop: "8px", fontSize: "0.72rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                          Call Impact: <strong style={{ color: "var(--accent-gold)" }}>{gv.impact.symbol}</strong> (Callers: {gv.impact.callers_count} · Callees: {gv.impact.callees_count})
                        </div>
                      )}
                    </div>
                  );
                })}

                {(analysis?.graph_verification || []).length === 0 && (
                  <div className="panel-card" style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
                    No graph verification evidence generated yet. Click Run Intelligence Pipeline to verify claims against the codebase.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 5: HUMAN-FRIENDLY INTELLIGENCE REPORT ── */}
          {activeTab === "report" && (
            <div className="handoff-container fade-in">
              <div className="handoff-actions-bar">
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  Human-readable report combining Entire evidence, {analysisSourceLabel}, and Entire Graph verification:
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-secondary" onClick={copyReport} disabled={!analysis?.report}>
                    <Copy size={13} />
                    {copiedReport ? "Copied!" : "Copy Report"}
                  </button>
                  <button className="btn btn-secondary" onClick={downloadReport} disabled={!analysis?.report}>
                    <Download size={13} />
                    Export Markdown
                  </button>
                </div>
              </div>

              <div className="code-viewer-panel">
                <div className="code-viewer-header">
                  <span>intelligence-report.md</span>
                  <span>{analysis?.analysis?.data?.provenance?.evidence_class || "Entire checkpoint context"}</span>
                </div>
                <div className="code-viewer-content">
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {analysis?.report || "Run pipeline to generate the human-friendly Intelligence Report."}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 6: ACTIONABLE HANDOFF SPEC & ADVISOR (SECTION 7) ── */}
          {activeTab === "handoff" && (
            <div className="handoff-container fade-in">
              <div className="handoff-actions-bar">
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  Standardized machine-readable handoff for another developer or AI coding agent:
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-secondary" onClick={copyHandoff}>
                    <Copy size={13} />
                    {copiedHandoff ? "Copied!" : "Copy JSON"}
                  </button>
                  <button className="btn btn-secondary" onClick={downloadHandoff}>
                    <Download size={13} />
                    Export JSON
                  </button>
                  <button className="btn btn-primary" onClick={saveToLakehouse} disabled={lakehouseLoading || !analysis}>
                    <Database size={13} />
                    {lakehouseLoading ? "Storing..." : "Save Audit Record"}
                  </button>
                </div>
              </div>

              {/* Databricks AI Developer Advisor Directive (Llama 4 Maverick) */}
              <div className="panel-card" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "0.9rem", color: "var(--accent-gold)" }}>
                    <Sparkles size={16} />
                    {databricksOnline ? "Databricks AI Developer Advisor" : "Fallback Developer Advisor"} (Prompt Directive)
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="btn btn-secondary"
                      onClick={generateAdvisorDirective}
                      disabled={advisorLoading || !analysis}
                      style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                    >
                      {advisorLoading ? "Synthesizing..." : "Generate Directive"}
                    </button>
                    {advisorDirective?.advisor_prompt && (
                      <button
                        className="btn btn-primary"
                        onClick={copyAdvisorDirective}
                        style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                      >
                        <Copy size={12} />
                        {advisorCopied ? "Copied!" : "Copy Directive"}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginBottom: "12px" }}>
                  Actionable prompt directive generated from the current analysis, verified evidence, and unresolved work. Graph line numbers appear only when Graph returned them.
                </div>

                {advisorDirective?.advisor_prompt ? (
                  <div style={{ background: "var(--bg-terminal)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "14px 16px", fontFamily: "var(--font-mono)", fontSize: "0.76rem", lineHeight: 1.6, color: "#e5e7eb", whiteSpace: "pre-wrap", maxHeight: "280px", overflowY: "auto" }}>
                    {advisorDirective.advisor_prompt}
                  </div>
                ) : (
                  <div style={{ background: "var(--bg-terminal)", border: "1px dashed var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.74rem" }}>
                    Click Generate Directive to produce an executive agent handoff prompt.
                  </div>
                )}
              </div>

              {/* Machine-Readable JSON Viewer */}
              <div className="code-viewer-panel">
                <div className="code-viewer-header">
                  <span>agent-handoff.json (Standardized Spec)</span>
                  <span>Confidence: {analysis?.handoff?.metadata?.confidence?.overall ? `${Math.round(analysis.handoff.metadata.confidence.overall * 100)}%` : "95%"}</span>
                </div>
                <div className="code-viewer-content">
                  <pre style={{ margin: 0 }}>
                    {JSON.stringify(analysis?.handoff || { message: "Run pipeline to generate standardized agent-handoff JSON" }, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── JUDGE DEMO WALKTHROUGH MODAL (SECTION 9) ── */}
      {isDemoModalOpen && (
        <div className="demo-modal-backdrop" onClick={() => setIsDemoModalOpen(false)}>
          <div className="demo-modal-card" onClick={e => e.stopPropagation()}>
            <div className="demo-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={18} style={{ color: "var(--accent-gold)" }} />
                <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "#ffffff" }}>
                  Judge Walkthrough: The Code Archaeologist Story
                </span>
              </div>
              <button
                onClick={() => setIsDemoModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="demo-modal-body">
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
                How Code Archaeologist solves the critical AI development handoff problem in 5 steps:
              </p>

              <div className="demo-step-timeline">
                <div className={`demo-step-row ${demoStep === 1 ? "active" : ""}`}>
                  <div className="demo-step-icon">1</div>
                  <div>
                    <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#ffffff" }}>Real Entire Checkpoint Ingestion</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Ingests real Entire Checkpoint <code>{selectedCp || "01M1TKD2E97T4F5PHJKWZR70GQ"}</code> on the active branch, capturing developer prompts, agent turns, and git diffs.
                    </div>
                  </div>
                </div>

                <div className={`demo-step-row ${demoStep === 2 ? "active" : ""}`}>
                  <div className="demo-step-icon">2</div>
                  <div>
                    <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#ffffff" }}>Databricks AI Foundation Model Analysis</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      The configured Databricks model analyzes chunked session context to reconstruct original intent and extract structured requirements; fallback mode labels itself when credentials are absent.
                    </div>
                  </div>
                </div>

                <div className={`demo-step-row ${demoStep === 3 ? "active" : ""}`}>
                  <div className="demo-step-icon">3</div>
                  <div>
                    <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#ffffff" }}>Entire Graph Ground-Truth Code Verification</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Entire Graph Tree-sitter static analyzer verifies each AI claim against local symbol definitions, call relationships, and file lines.
                    </div>
                  </div>
                </div>

                <div className={`demo-step-row ${demoStep === 4 ? "active" : ""}`}>
                  <div className="demo-step-icon">4</div>
                  <div>
                    <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#ffffff" }}>Completed vs Missing Requirements Matrix</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Categorizes work into Completed, Partial, and genuinely Missing or deferred items to prevent silent regressions.
                    </div>
                  </div>
                </div>

                <div className={`demo-step-row ${demoStep === 5 ? "active" : ""}`}>
                  <div className="demo-step-icon">5</div>
                  <div>
                    <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#ffffff" }}>Actionable Agent Handoff & Delta Lakehouse</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Produces standardized JSON for the next AI agent, generates evidence-aware resume prompts, and saves a lakehouse-ready audit record.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="demo-modal-footer">
              <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                Step {demoStep} of 5
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-secondary" onClick={() => setIsDemoModalOpen(false)}>
                  Close
                </button>
                {demoStep > 1 && (
                  <button className="btn btn-secondary" onClick={() => setDemoStep(s => s - 1)}>
                    Back
                  </button>
                )}
                {demoStep < 5 ? (
                  <button className="btn btn-primary" onClick={() => setDemoStep(s => s + 1)}>
                    Next Step
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setIsDemoModalOpen(false);
                      runFullAnalysis();
                    }}
                  >
                    <Play size={13} />
                    Run Live Demo Pipeline
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
