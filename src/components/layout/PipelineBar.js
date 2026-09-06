"use client";

import { CheckCircle2 } from "lucide-react";

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

export default function PipelineBar({ steps, activeStep, analysis }) {
  return (
    <div className="pipeline-bar">
      {steps.map((step, i) => (
        <PipelineStep
          key={step.id}
          step={step}
          index={i}
          activeStep={activeStep}
          steps={steps}
          analysis={analysis}
        />
      ))}
    </div>
  );
}
