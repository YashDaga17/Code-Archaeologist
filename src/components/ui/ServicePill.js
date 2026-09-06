"use client";

export default function ServicePill({ label, status }) {
  const dotClass = status === "online" ? "on" : status === "not_configured" ? "warn" : "off";
  return (
    <div className="status-pill">
      <span className={`status-dot ${dotClass}`} />
      {label}
    </div>
  );
}
