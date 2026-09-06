"use client";

import ServicePill from "../ui/ServicePill";

export default function Header({ health }) {
  return (
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
  );
}
