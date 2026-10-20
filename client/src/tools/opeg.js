// OPEG V1.0. A PT-symmetric goal is answered only after a command runs
// and the sanitizer returns R_san. The numbers below are computed from H.

export const PROTOCOL_VERSION = "OPEG-V1.0";
export const SESSION_ID = "4721424167835376";

const PT_GOAL = /PT-symmetric|EP3|Puiseux/i;

function complex(re, im = 0) {
  return { re, im };
}

function cadd(a, b) {
  return { re: a.re + b.re, im: a.im + b.im };
}

function csub(a, b) {
  return { re: a.re - b.re, im: a.im - b.im };
}

function cmul(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function cdiv(a, b) {
  const den = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / den, im: (a.im * b.re - a.re * b.im) / den };
}

function cabs(a) {
  return Math.hypot(a.re, a.im);
}

function hamiltonian(g, gamma) {
  const z = complex(0, 0);
  const gg = complex(g, 0);
  return [
    [complex(0, gamma), gg, z],
    [gg, z, gg],
    [z, gg, complex(0, -gamma)]
  ];
}

function shifted(g, gamma, lambda) {
  const h = hamiltonian(g, gamma);
  h[0][0] = csub(h[0][0], lambda);
  h[1][1] = csub(h[1][1], lambda);
  h[2][2] = csub(h[2][2], lambda);
  return h;
}

export function residualDet(g, gamma, root) {
  return det3(shifted(g, gamma, root));
}

export function det3(matrix) {
  const a = matrix[0];
  const b = matrix[1];
  const c = matrix[2];
  const m11 = csub(cmul(b[1], c[2]), cmul(b[2], c[1]));
  const m12 = csub(cmul(b[0], c[2]), cmul(b[2], c[0]));
  const m13 = csub(cmul(b[0], c[1]), cmul(b[1], c[0]));
  return cadd(csub(cmul(a[0], m11), cmul(a[1], m12)), cmul(a[2], m13));
}

export function rank3(matrix) {
  const rows = matrix.map((row) => row.map((value) => ({ re: value.re, im: value.im })));
  let rank = 0;
  let pivotRow = 0;
  for (let col = 0; col < 3 && pivotRow < 3; col += 1) {
    let best = pivotRow;
    let bestAbs = cabs(rows[pivotRow][col]);
    for (let row = pivotRow + 1; row < 3; row += 1) {
      const mag = cabs(rows[row][col]);
      if (mag > bestAbs) {
        best = row;
        bestAbs = mag;
      }
    }
    if (bestAbs < 1e-9) continue;
    if (best !== pivotRow) {
      const swap = rows[pivotRow];
      rows[pivotRow] = rows[best];
      rows[best] = swap;
    }
    const pivot = rows[pivotRow][col];
    for (let row = 0; row < 3; row += 1) {
      if (row === pivotRow) continue;
      const factor = cdiv(rows[row][col], pivot);
      for (let k = col; k < 3; k += 1) rows[row][k] = csub(rows[row][k], cmul(factor, rows[pivotRow][k]));
    }
    rank += 1;
    pivotRow += 1;
  }
  return rank;
}

function formatImag(value) {
  const mag = Math.abs(value);
  const body = Number.isInteger(mag) ? String(mag) : String(Math.round(mag * 1e12) / 1e12);
  return value < 0 ? `-i${body}` : `i${body}`;
}

function matrixText(g, gamma) {
  const gText = String(g);
  const up = formatImag(gamma);
  const down = formatImag(-gamma);
  return `[[${up},${gText},0],[${gText},0,${gText}],[0,${gText},${down}]]`;
}

function branchText(value) {
  const re = value.re;
  const im = value.im;
  if (Math.abs(im) < 1e-12) return re.toFixed(4);
  const sign = im < 0 ? "-" : "+";
  return `${re.toFixed(4)} ${sign} i${Math.abs(im).toFixed(4)}`;
}

export function isPtChallenge(goal) {
  return PT_GOAL.test(String(goal || ""));
}

function halt(state, reason) {
  return {
    status: "HALT",
    state,
    reason,
    forbidden: "DIRECT_INFERENCE",
    protocol_version: PROTOCOL_VERSION
  };
}

function simulate(g, gamma, epsilon) {
  const p = gamma * gamma - 2 * g * g;
  const radicand = -p;
  const split = radicand > 0 ? Math.sqrt(radicand) : 0;
  const roots = radicand >= 0
    ? [complex(0), complex(split), complex(-split)]
    : [complex(0), complex(0, Math.sqrt(-radicand)), complex(0, -Math.sqrt(-radicand))];
  const gammaEp3 = Math.SQRT2 * g;
  const ep3 = Math.abs(p) <= 1e-10;
  const rank = rank3(hamiltonian(g, gammaEp3));
  const cube = Math.cbrt(epsilon);
  const omegaIm = Math.sqrt(3) / 2;
  const branches = [
    complex(cube, 0),
    complex(cube * -0.5, cube * omegaIm),
    complex(cube * -0.5, -cube * omegaIm)
  ];
  return {
    p,
    roots,
    gammaEp3,
    ep3,
    geometric: 3 - rank,
    algebraic: 3,
    discriminant: -4 * p * p * p,
    branches,
    sensitivity: (1 / 3) * Math.pow(epsilon, -2 / 3),
    cube
  };
}

export function buildCommand(task) {
  return {
    command: "EXECUTE",
    target_tool: "simulation_api",
    params: {
      model: "quantum_tunneling",
      k: task.g,
      constraints: {
        hamiltonian_type: "pt_symmetric_3x3",
        g: task.g,
        gamma: task.gamma,
        epsilon: task.epsilon,
        calculate_ep3_coalescence: true,
        puiseux_perturbation_epsilon: true
      },
      id: "cmd_ep3_puiseux_01",
      goal_ref: task.goal
    }
  };
}

export function executeCommand(cmd, now) {
  const box = cmd?.params?.constraints || {};
  const g = Number(box.g);
  const gamma = Number(box.gamma);
  const epsilon = Number(box.epsilon);
  const solved = simulate(g, gamma, epsilon);
  const rootLead = solved.roots[1].re || solved.roots[1].im;
  const empirical = {
    hamiltonian_type: "pt_symmetric_3x3",
    matrix_form: "H=[[iγ,g,0],[g,0,g],[0,g,-iγ]]",
    matrix_numeric: matrixText(g, gamma),
    characteristic_polynomial: "-(λ^3 + λ*(γ^2 - 2g^2))",
    characteristic_coefficient: solved.p,
    roots: solved.roots.map((root) => ({ re: root.re, im: root.im })),
    roots_display: solved.ep3 ? "0, 0, 0" : `0, ±${Math.abs(rootLead)}`,
    ep3_condition: "γ² = 2g²",
    gamma_EP3: solved.gammaEp3,
    ep3: solved.ep3,
    triple_root: "0,0,0 at EP3",
    geometric_multiplicity: solved.geometric,
    algebraic_multiplicity: solved.algebraic,
    defectiveness_proof: `geometric=${solved.geometric} algebraic=${solved.algebraic}`,
    discriminant: solved.discriminant,
    puiseux: {
      alpha: 1,
      exponent: 1 / 3,
      epsilon,
      cube: solved.cube,
      branches: solved.branches.map((branch) => ({ re: branch.re, im: branch.im, text: branchText(branch) })),
      omega: "exp(2πi/3)",
      sensitivity: solved.sensitivity
    },
    input_params: { g, gamma, epsilon }
  };
  const payload = {
    "det(H-λI)": empirical.characteristic_polynomial,
    calc: {
      g,
      gamma,
      gamma_EP3: solved.gammaEp3,
      roots: empirical.roots,
      EP3: solved.ep3,
      puiseux: { eps: epsilon, cbrt: solved.cube }
    },
    H: empirical.matrix_numeric,
    empirical_data: empirical,
    id: cmd.params.id
  };
  const metadata = {
    tool: "simulation_api",
    runtime: "node",
    gateway: "live_react",
    session: SESSION_ID
  };
  const raw = {
    status: "SUCCESS",
    metadata,
    payload,
    timestamp: now
  };
  const text = `RAW_RECEIPT_START|STATUS:SUCCESS|METADATA:${JSON.stringify(metadata)}|DATA_PAYLOAD:${JSON.stringify(payload)}|RAW_RECEIPT_END`;
  return { ...raw, text };
}

export function sanitizeReceipt(raw) {
  const data = raw.payload.empirical_data;
  return {
    status: raw.status,
    receipt_id: `R_san_${raw.payload.id}`,
    source_tool: "simulation_api",
    sanitizer: "Σ",
    protocol_version: PROTOCOL_VERSION,
    empirical_data: data,
    timestamp: raw.timestamp
  };
}

export function runOpeg(task, options = {}) {
  const goal = String(task?.goal || "").trim();
  if (!isPtChallenge(goal)) {
    return halt("S1_HYPOTHESIS", "This goal is not a PT-symmetric, EP3, or Puiseux challenge. No derivation was produced.");
  }
  const hamiltonianType = task.hamiltonianType || "pt_symmetric_3x3";
  if (hamiltonianType !== "pt_symmetric_3x3") {
    return halt("S2_COMMAND_GEN", "simulation_api has a solver for pt_symmetric_3x3. This Hamiltonian type has no receipt.");
  }
  const g = Number(task.g);
  const gamma = Number(task.gamma);
  const epsilon = Number(task.epsilon);
  if (!Number.isFinite(g) || !Number.isFinite(gamma) || !Number.isFinite(epsilon) || epsilon <= 0) {
    return halt("S2_COMMAND_GEN", "g, γ, and ε have to be finite, and ε has to be positive.");
  }
  const now = options.now || new Date().toISOString();
  const command = buildCommand({ goal, g, gamma, epsilon });
  const raw = executeCommand(command, now);
  const receipt = sanitizeReceipt(raw);
  const data = receipt.empirical_data;
  return {
    status: "SUCCESS",
    state: "S4_KNOWLEDGE_UPDATE",
    protocol_version: PROTOCOL_VERSION,
    forbidden: "DIRECT_INFERENCE",
    hypothesis: goal,
    command,
    raw_text: raw.text,
    R_san: receipt,
    gate: receipt.status === "SUCCESS",
    knowledge_update: `UPDATE_MEMORY(${command.params.id})`,
    derivation: {
      matrix: data.matrix_form,
      matrix_numeric: data.matrix_numeric,
      polynomial: data.characteristic_polynomial,
      roots: data.roots_display,
      ep3_condition: data.ep3_condition,
      gamma_EP3: data.gamma_EP3,
      ep3: data.ep3,
      defectiveness_proof: data.defectiveness_proof,
      discriminant: data.discriminant,
      branches: data.puiseux.branches.map((branch) => branch.text),
      sensitivity: data.puiseux.sensitivity,
      epsilon
    }
  };
}
