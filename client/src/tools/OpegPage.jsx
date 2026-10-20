import React, { useState } from "react";

const DEFAULT_GOAL = "Derive EP3 algebraic condition and Puiseux series";

async function copyText(value) {
  await navigator.clipboard.writeText(value);
}

export default function OpegPage({ say }) {
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [g, setG] = useState("1");
  const [gamma, setGamma] = useState("0.5");
  const [epsilon, setEpsilon] = useState("0.001");
  const [report, setReport] = useState(null);
  const [protocol, setProtocol] = useState("");
  const [busy, setBusy] = useState(false);

  async function execute() {
    setBusy(true);
    try {
      const response = await fetch("/api/opeg/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          goal,
          hamiltonianType: "pt_symmetric_3x3",
          g: Number(g),
          gamma: Number(gamma),
          epsilon: Number(epsilon)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The gateway refused the command");
      setReport(data);
      say?.(data.status === "SUCCESS" ? `R_san ${data.R_san.receipt_id}` : data.reason);
    } catch (error) {
      setReport(null);
      say?.(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function showProtocol() {
    const response = await fetch("/api/opeg/protocol");
    const data = await response.json();
    setProtocol(`${data.protocol}\n---\n${data.modelfile}`);
  }

  const receipt = report?.R_san;
  const steps = [
    ["Hypothesis", report ? report.hypothesis || report.reason : "Waiting for a goal"],
    ["Command", report?.command ? report.command.params.id : "Not emitted"],
    ["Runtime", report?.raw_text ? "simulation_api · quantum_tunneling" : "Not run"],
    ["Σ", receipt ? receipt.sanitizer : "Not run"],
    ["S3 → S4", report?.gate ? report.knowledge_update : "Gate closed"],
    ["Derivation", report?.derivation ? "From R_san.empirical_data" : "Held"]
  ];

  return (
    <div className="tool">
      <aside className="tool-side">
        <div className="fh">Task</div>
        <label className="field">Goal
          <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={4} spellCheck={false} />
        </label>
        <label className="field">Hamiltonian
          <input value="pt_symmetric_3x3" readOnly />
        </label>
        <label className="field">g
          <input value={g} onChange={(event) => setG(event.target.value)} inputMode="decimal" />
        </label>
        <label className="field">γ
          <input value={gamma} onChange={(event) => setGamma(event.target.value)} inputMode="decimal" />
        </label>
        <label className="field">ε
          <input value={epsilon} onChange={(event) => setEpsilon(event.target.value)} inputMode="decimal" />
        </label>
        <div className="fh">Flow</div>
        {steps.map(([name, detail]) => (
          <div className="card" key={name}>
            <b>{name}</b>
            <div className="muted">{detail}</div>
          </div>
        ))}
      </aside>
      <section className="tool-main">
        <div className="codebar">
          <b>OPEG</b>
          <span className="muted">V1.0 · empirical grounding · simulation_api → Σ → R_san</span>
          <span className="spacer" />
          <button className="btn" type="button" onClick={showProtocol}>Protocol</button>
          <button className="btn on" type="button" onClick={execute} disabled={busy}>{busy ? "Running" : "Execute"}</button>
        </div>
        <div className="tool-body">
          {!report && <p className="note">A PT-symmetric, EP3, or Puiseux goal runs as a command. The derivation appears after R_san.</p>}
          {report?.status === "HALT" && <p className="note">{report.reason}</p>}
          {report?.command && (
            <>
              <div className="fh">Command</div>
              <pre className="note">{JSON.stringify(report.command, null, 2)}</pre>
            </>
          )}
          {report?.derivation && (
            <>
              <div className="fh">Grounded derivation</div>
              <div className="card">
                <b>{report.derivation.polynomial}</b>
                <div className="muted">Roots {report.derivation.roots}</div>
                <div className="muted">{report.derivation.ep3_condition} · γ_EP3 = {report.derivation.gamma_EP3} · EP3 {String(report.derivation.ep3)}</div>
                <div className="muted">{report.derivation.defectiveness_proof} · Δ = {report.derivation.discriminant}</div>
                <div className="muted">H {report.derivation.matrix_numeric}</div>
                <div className="muted">ε={report.derivation.epsilon} · {report.derivation.branches.join(" · ")}</div>
                <div className="muted">dλ/dε = {report.derivation.sensitivity}</div>
              </div>
            </>
          )}
          {protocol && <pre className="note">{protocol}</pre>}
        </div>
      </section>
      <aside className="tool-side">
        <div className="fh">R_san</div>
        {receipt ? (
          <>
            <button className="btn" type="button" onClick={() => copyText(JSON.stringify(receipt, null, 2)).then(() => say?.("R_san copied"))}>Copy R_san</button>
            <pre className="note">{JSON.stringify(receipt, null, 2)}</pre>
          </>
        ) : (
          <p className="muted">The sanitized receipt lands here. Metadata from the raw receipt stays out.</p>
        )}
      </aside>
    </div>
  );
}
