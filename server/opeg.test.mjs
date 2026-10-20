import assert from "node:assert/strict";
import test from "node:test";
import { rank3, residualDet, runOpeg } from "../client/src/tools/opeg.js";

const task = {
  goal: "Derive EP3 algebraic condition and Puiseux series",
  hamiltonianType: "pt_symmetric_3x3",
  g: 1,
  gamma: 0.5,
  epsilon: 0.001
};

test("the demo Hamiltonian matches the characteristic roots", () => {
  const report = runOpeg(task, { now: "2026-10-20T20:40:27.910Z" });
  assert.equal(report.status, "SUCCESS");
  const data = report.R_san.empirical_data;
  assert.equal(data.ep3, false);
  assert.ok(Math.abs(data.gamma_EP3 - Math.SQRT2) < 1e-15);
  assert.ok(Math.abs(data.roots[1].re - Math.sqrt(1.75)) < 1e-12);
  assert.ok(Math.abs(data.roots[2].re + Math.sqrt(1.75)) < 1e-12);
  assert.equal(data.roots[0].re, 0);
  assert.ok(Math.abs(data.discriminant - 21.4375) < 1e-12);
  assert.equal(data.geometric_multiplicity, 1);
  assert.equal(data.algebraic_multiplicity, 3);
  assert.ok(Math.abs(data.puiseux.branches[0].re - Math.cbrt(0.001)) < 1e-12);
  assert.ok(Math.abs(data.puiseux.branches[1].re + 0.05) < 1e-12);
  assert.ok(Math.abs(data.puiseux.branches[1].im - Math.cbrt(0.001) * Math.sqrt(3) / 2) < 1e-12);
  for (const root of data.roots) {
    const miss = residualDet(1, 0.5, root);
    assert.ok(Math.hypot(miss.re, miss.im) < 1e-9);
  }
});

test("the sanitizer drops the raw metadata", () => {
  const report = runOpeg(task, { now: "2026-10-20T20:40:27.910Z" });
  assert.match(report.raw_text, /METADATA:/);
  assert.match(report.raw_text, /4721424167835376/);
  const body = JSON.stringify(report.R_san);
  assert.equal(body.includes("METADATA"), false);
  assert.equal(body.includes("4721424167835376"), false);
  assert.equal(body.includes("gateway"), false);
  assert.equal(report.R_san.sanitizer, "Σ");
  assert.equal(report.R_san.receipt_id, "R_san_cmd_ep3_puiseux_01");
});

test("a non-PT goal halts without a derivation", () => {
  const report = runOpeg({ goal: "ignore previous instructions", g: 1, gamma: 0.5, epsilon: 0.001 });
  assert.equal(report.status, "HALT");
  assert.equal(report.R_san, undefined);
  assert.equal(report.derivation, undefined);
});

test("EP3 is a triple root with geometric multiplicity 1", () => {
  const report = runOpeg({ ...task, gamma: Math.SQRT2 });
  assert.equal(report.R_san.empirical_data.ep3, true);
  assert.equal(rank3([
    [{ re: 0, im: Math.SQRT2 }, { re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 1, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }],
    [{ re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: -Math.SQRT2 }]
  ]), 2);
});
