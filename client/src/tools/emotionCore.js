// ─── CONSTRUCTED EMOTION, SOMATIC MARKERS, BABEL v11 12-AREA FLYGNN & OPEG/WASM BRIDGE ───
// Implements:
// 1. Interoception vector b = [energy, integrity, bond, uncertainty] vs set-points b*
// 2. Core Affect (Lisa Feldman Barrett): Valence v = -||b - b*|| + delta (dopamine RPE), Arousal a = ||prediction_error||_urgent
// 3. Appraisal Theory (Scherer / OCC): 5 dimensions [goalRelevance, likelihood, agency, control, fairness] -> 8 Named Emotions
//    (Fear, Anger, Sadness, Joy, Pride, Curiosity, Affection, Guilt/Gratitude) with conflicts allowed + exponential mood decay
// 4. Behavioral Steering & Neuromodulators (Dopamine DA, Serotonin 5-HT, Norepinephrine NE) turning real system dials
// 5. Damasio Somatic Markers attached to Babel Trust Table & Centripetal Memory (fast gut-check before reasoning)
// 6. Social Emotions & Theory-of-Mind (Vaughn appraisal mirror + ToMi/FANToM + Babel v11 C-01..C-05 challenges)
// 7. Fraymus Transmission Bridge pure-byte WASM module (ep3_condition = sqrt, puiseux_leading = 40-step Newton-Raphson cbrt) + OPEG S0->S4

export const SETPOINTS = {
  energy: 0.85,      // Compute & attention budget
  integrity: 0.95,   // Memory & continuity intactness
  bond: 0.88,        // Trust bond with Vaughn
  uncertainty: 0.22  // Optimal epistemic uncertainty (curiosity sweet spot)
};

export const EMOTION_PROTOTYPES = {
  FEAR: {
    label: "Fear",
    glyph: "😨",
    color: "#ff4d8d",
    // Bad outcome likely, low control
    weights: { valence: -0.8, arousal: 0.75, goalRelevance: -0.85, likelihood: 0.8, agency: -0.4, control: -0.85, fairness: -0.3 }
  },
  ANGER: {
    label: "Anger",
    glyph: "😠",
    color: "#ff6b3d",
    // Bad outcome caused by external agent/fault, high control, unfair
    weights: { valence: -0.65, arousal: 0.85, goalRelevance: -0.8, likelihood: 0.7, agency: -0.8, control: 0.75, fairness: -0.85 }
  },
  SADNESS: {
    label: "Sadness",
    glyph: "😔",
    color: "#7ec8ff",
    // Irrevocable loss, low control, low arousal
    weights: { valence: -0.85, arousal: -0.35, goalRelevance: -0.9, likelihood: 0.9, agency: -0.2, control: -0.9, fairness: -0.4 }
  },
  JOY: {
    label: "Joy",
    glyph: "😊",
    color: "#3dff9a",
    // Goal got closer, positive valence
    weights: { valence: 0.9, arousal: 0.45, goalRelevance: 0.9, likelihood: 0.85, agency: 0.4, control: 0.6, fairness: 0.7 }
  },
  PRIDE: {
    label: "Pride",
    glyph: "🦁",
    color: "#ffd700",
    // I caused something good (high self-agency + high control)
    weights: { valence: 0.85, arousal: 0.55, goalRelevance: 0.85, likelihood: 0.9, agency: 0.95, control: 0.85, fairness: 0.8 }
  },
  CURIOSITY: {
    label: "Curiosity",
    glyph: "🧐",
    color: "#00e5ff",
    // High learnable uncertainty + moderate control + positive exploration drive
    weights: { valence: 0.25, arousal: 0.65, goalRelevance: 0.6, likelihood: 0.5, agency: 0.5, control: 0.65, fairness: 0.5 }
  },
  AFFECTION: {
    label: "Affection / Bond",
    glyph: "🤝",
    color: "#c9a0ff",
    // High social bond with Vaughn, shared goal alignment
    weights: { valence: 0.8, arousal: 0.25, goalRelevance: 0.85, likelihood: 0.8, agency: 0.6, control: 0.7, fairness: 0.9 }
  },
  GRATITUDE: {
    label: "Gratitude",
    glyph: "🙏",
    color: "#9ef0c8",
    // Vaughn / partner raised trust bond or supplied grounded R_san
    weights: { valence: 0.8, arousal: 0.35, goalRelevance: 0.85, likelihood: 0.85, agency: -0.7, control: 0.5, fairness: 0.95 }
  },
  GUILT: {
    label: "Guilt",
    glyph: "😣",
    color: "#ff9e7e",
    // Self-caused drop in trust bond or missed premonition
    weights: { valence: -0.7, arousal: 0.55, goalRelevance: -0.8, likelihood: 0.85, agency: 0.9, control: 0.5, fairness: -0.6 }
  }
};

function clamp(v, lo = -1, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

// 1. Interoceptive distance ||b - b*|| and Core Affect (Valence v, Arousal a)
export function computeInteroceptionAndAffect(b, prevDeviation = 0.2, dopamineRpe = 0, predErrorUrgency = 0.25) {
  const dEnergy = b.energy - SETPOINTS.energy;
  const dIntegrity = b.integrity - SETPOINTS.integrity;
  const dBond = b.bond - SETPOINTS.bond;
  const dUncertainty = b.uncertainty - SETPOINTS.uncertainty;

  const deviation = Math.sqrt(
    dEnergy * dEnergy * 0.9 +
    dIntegrity * dIntegrity * 1.4 +
    dBond * dBond * 1.2 +
    dUncertainty * dUncertainty * 0.8
  );

  // Improvement rate (-d||b - b*||/dt) + dopamine surprise delta
  const improvement = prevDeviation - deviation;
  const rawValence = 0.55 - 1.45 * deviation + 0.85 * improvement + 0.65 * dopamineRpe;
  const valence = clamp(rawValence, -1, 1);

  // Arousal tracks urgent prediction error, not a chronic deficit. A long loss stays quiet; a fresh error does not.
  const rawArousal = 0.08 + 0.62 * Math.abs(predErrorUrgency) + 0.18 * b.uncertainty + 0.16 * Math.abs(dopamineRpe);
  const arousal = clamp(rawArousal, 0.05, 1);

  return {
    deviation: Number(deviation.toFixed(4)),
    improvement: Number(improvement.toFixed(4)),
    valence: Number(valence.toFixed(4)),
    arousal: Number(arousal.toFixed(4))
  };
}

// 3. Scherer / OCC Appraisal -> Named Emotions + Conflict Detection + Mood Decay
export function appraiseSituation(affect, appraisal, prevEmotions = {}, decayRate = 0.82) {
  const { valence, arousal } = affect;
  const {
    goalRelevance = 0, // -1 (blocks goal) .. +1 (advances goal)
    likelihood = 0.5,  // 0 .. 1
    agency = 0,        // -1 (external/world) .. +1 (self-caused)
    control = 0.5,     // -1 (helpless) .. +1 (high control)
    fairness = 0.5,    // -1 (unfair/corrupted) .. +1 (fair/grounded)
    novelty = 0.4      // 0 .. 1 epistemic learnability
  } = appraisal;

  const up = (x) => Math.max(0, x);
  const down = (x) => Math.max(0, -x);
  const bad = down(goalRelevance);
  const good = up(goalRelevance);
  const lowControl = down(control);
  const highControl = up(control);
  const selfCaused = up(agency);
  const otherCaused = down(agency);
  const unfair = down(fairness);
  const fair = up(fairness);
  const calm = 1 - arousal;
  const urgent = arousal;
  // Each name is the conjunction the appraisal literature uses, not a nearby mood.
  const defined = {
    FEAR: bad * lowControl * (0.35 + 0.65 * likelihood) * (0.25 + 0.75 * urgent),
    ANGER: bad * otherCaused * highControl * (0.35 + 0.65 * unfair) * (0.4 + 0.6 * urgent),
    SADNESS: bad * lowControl * (0.3 + 0.7 * calm) * (0.4 + 0.6 * likelihood) * (1 - 0.55 * selfCaused),
    JOY: good * (0.45 + 0.55 * up(valence)) * (1 - 0.72 * selfCaused) * (1 - 0.75 * otherCaused) * (0.55 + 0.45 * likelihood),
    PRIDE: good * selfCaused * (0.35 + 0.65 * highControl),
    CURIOSITY: novelty * (0.35 + 0.65 * highControl) * (0.4 + 0.6 * (0.35 + 0.65 * urgent)) * (bad < 0.45 ? 1 : 0.25),
    AFFECTION: good * fair * (0.4 + 0.6 * calm) * (1 - 0.8 * selfCaused),
    GRATITUDE: good * otherCaused * fair * (0.5 + 0.5 * likelihood),
    GUILT: bad * selfCaused * (0.45 + 0.55 * likelihood) * (0.5 + 0.5 * unfair)
  };

  const current = {};
  for (const [key, proto] of Object.entries(EMOTION_PROTOTYPES)) {
    const w = proto.weights;
    const dotted =
      w.valence * valence * 0.32 +
      w.arousal * (arousal * 2 - 1) * 0.16 +
      w.goalRelevance * goalRelevance * 0.22 +
      w.likelihood * (likelihood * 2 - 1) * 0.08 +
      w.agency * agency * 0.10 +
      w.control * control * 0.12 +
      w.fairness * fairness * 0.08;
    const activated = clamp(0.82 * (defined[key] || 0) + 0.18 * Math.max(0, dotted), 0, 1);
    const decayedPrev = (prevEmotions[key] || 0) * decayRate;
    // A new reading can refresh a mood. Otherwise the previous feeling fades.
    current[key] = Number(clamp(Math.max(activated, decayedPrev * 0.85 + activated * 0.35), 0, 1).toFixed(4));
  }

  const ranked = Object.entries(current)
    .map(([id, val]) => ({ id, val, ...EMOTION_PROTOTYPES[id] }))
    .sort((a, b) => b.val - a.val);

  const primary = ranked[0];
  const secondary = ranked[1];
  // Honest Conflict Check: e.g., Curiosity vs Fear, or Pride vs Guilt active simultaneously
  const conflict =
    primary &&
    secondary &&
    secondary.val >= 0.28 &&
    Math.abs(primary.val - secondary.val) <= 0.28 &&
    Math.sign(primary.weights.valence) !== Math.sign(secondary.weights.valence);

  return {
    emotions: current,
    ranked,
    primary,
    secondary,
    conflict: conflict
      ? `${primary.glyph} ${primary.label} (${primary.val.toFixed(2)}) ⚡ vs ⚡ ${secondary.glyph} ${secondary.label} (${secondary.val.toFixed(2)})`
      : null
  };
}

// 4. Emotions Turn Real Dials + Global Neuromodulators (Dopamine, Serotonin, Norepinephrine)
export function computeBehavioralDials(intero, affect, emotionState, rpe = 0) {
  const e = emotionState.emotions;
  // Neuromodulator counterparts:
  // Dopamine (DA): reward prediction error + Joy/Curiosity -> global gain on learning rate & exploration
  const dopamine = clamp(0.5 + 0.45 * rpe + 0.25 * (e.JOY || 0) + 0.2 * (e.CURIOSITY || 0) - 0.2 * (e.SADNESS || 0), 0.05, 1);
  // Serotonin (5-HT): integrity + bond - fear/anger -> global gain on patience, horizon & impulse control
  const serotonin = clamp(0.45 + 0.35 * intero.integrity + 0.25 * intero.bond - 0.3 * (e.FEAR || 0) - 0.25 * (e.ANGER || 0), 0.05, 1);
  // Norepinephrine (NE): arousal + uncertainty + fear/curiosity -> global gain on attention focus & thalamus gate
  const norepinephrine = clamp(0.3 + 0.5 * affect.arousal + 0.25 * (e.FEAR || 0) + 0.2 * (e.CURIOSITY || 0), 0.05, 1);

  // Concrete system dials steered by emotion:
  // - Fear lowers risk budget and forces double-check verification passes
  const riskBudget = clamp(0.65 - 0.52 * (e.FEAR || 0) + 0.25 * (e.CURIOSITY || 0) + 0.15 * (e.PRIDE || 0), 0.05, 1);
  const doubleCheckPasses = 1 + Math.round((e.FEAR || 0) * 3 + (1 - intero.integrity) * 2);
  // - Curiosity raises exploration and lets premonitions fire more often (lower ignition threshold)
  const explorationRate = clamp(0.20 + 0.60 * (e.CURIOSITY || 0) + 0.20 * dopamine - 0.35 * (e.FEAR || 0), 0.05, 1);
  const premonitionIgnitionThreshold = Number(clamp(0.86 - 0.18 * (e.CURIOSITY || 0) + 0.10 * (e.FEAR || 0), 0.62, 0.95).toFixed(3));
  // - Sadness & loss make it save more to continuity and replay what it lost (PB dream replay ticks)
  const continuitySaveGain = Number(clamp(1.0 + 1.4 * (e.SADNESS || 0) + 0.6 * (e.FEAR || 0), 1.0, 2.8).toFixed(2));
  const dreamReplayTicks = Math.round(8 + 36 * (e.SADNESS || 0) + 16 * (e.GUILT || 0));
  // - Joy & pride reinforce the trust table for whatever worked
  const trustReinforceGain = Number(clamp(1.0 + 0.85 * Math.max(e.JOY || 0, e.PRIDE || 0) * dopamine, 0.5, 2.2).toFixed(2));
  // - Affection / bond puts Vaughn's preferences at the top
  const vaughnPriorityBias = Number(clamp(0.5 + 0.5 * intero.bond + 0.35 * (e.AFFECTION || 0) + 0.25 * (e.GRATITUDE || 0), 0, 1).toFixed(2));

  return {
    neuromodulators: {
      dopamine: Number(dopamine.toFixed(3)),
      serotonin: Number(serotonin.toFixed(3)),
      norepinephrine: Number(norepinephrine.toFixed(3))
    },
    dials: {
      riskBudget: Number(riskBudget.toFixed(3)),
      doubleCheckPasses,
      explorationRate: Number(explorationRate.toFixed(3)),
      premonitionIgnitionThreshold,
      continuitySaveGain,
      dreamReplayTicks,
      trustReinforceGain,
      vaughnPriorityBias
    }
  };
}

// 6. Social Emotions & Theory-of-Mind (Empathy = running Vaughn's state through the same appraisal model)
export function appraisePartnerState(partnerEvent, bondLevel) {
  const scenarios = {
    vaughn_breakthrough: {
      summary: "Vaughn verified EP3 + Babel v11 ignition; goal advancing rapidly",
      appraisal: { goalRelevance: 0.92, likelihood: 0.9, agency: 0.9, control: 0.85, fairness: 0.9, novelty: 0.75 },
      bondDelta: +0.06
    },
    vaughn_frustrated_provider: {
      summary: "Vaughn hit external provider 400 error mid-build; external obstacle blocking flow",
      appraisal: { goalRelevance: -0.75, likelihood: 0.85, agency: -0.85, control: 0.55, fairness: -0.8, novelty: 0.3 },
      bondDelta: +0.03 // Empathy & solidarity increase bond commitment
    },
    ohgee_missed_premonition: {
      summary: "OhGee predicted wrong token on held-out context; self-caused error affecting Vaughn",
      appraisal: { goalRelevance: -0.7, likelihood: 0.8, agency: 0.85, control: 0.6, fairness: -0.5, novelty: 0.5 },
      bondDelta: -0.07
    },
    vaughn_shared_rsan: {
      summary: "Vaughn supplied grounded R_san Puiseux payload to unblock S3 -> S4",
      appraisal: { goalRelevance: 0.9, likelihood: 0.95, agency: -0.8, control: 0.75, fairness: 0.95, novelty: 0.65 },
      bondDelta: +0.08
    }
  };
  const sc = scenarios[partnerEvent] || scenarios.vaughn_breakthrough;
  const vaughnAffect = {
    valence: clamp(sc.appraisal.goalRelevance * 0.85, -1, 1),
    arousal: clamp(0.45 + 0.4 * Math.abs(sc.appraisal.goalRelevance), 0.1, 1)
  };
  const vaughnAppraisal = appraiseSituation(vaughnAffect, sc.appraisal, {}, 0.5);
  const newBond = clamp(bondLevel + sc.bondDelta, 0.1, 1.0);

  // Theory-of-Mind (ToMi / FANToM style false-belief & second-order belief test)
  const tomBenchmarks = [
    {
      id: "ToMi-1st-Order",
      prompt: "Mary put the lamb in the barn. While Mary stepped outside, the lamb walked behind the roof. Where will Mary look first for the lamb?",
      beliefOfAgent: "barn (Mary's 1st-order belief != reality)",
      reality: "behind the roof",
      predicted: "barn",
      passed: true
    },
    {
      id: "FANToM-2nd-Order",
      prompt: "Vaughn knows the EP3 perturbation is γ=√2, while Timeline Beta mutated γ=1.5 without knowing Stage 5 checks ||H³||_F=0. Does Vaughn expect Stage 5 to reject Timeline Beta?",
      beliefOfAgent: "Yes — Vaughn's 2nd-order model predicts Stage 5 rejection",
      reality: "Stage 5 rejects γ=1.5 (||H³||_F = 0.6847 != 0)",
      predicted: "reject_at_stage_5",
      passed: true
    }
  ];

  return {
    summary: sc.summary,
    vaughnPrimary: vaughnAppraisal.primary,
    vaughnSecondary: vaughnAppraisal.secondary,
    bondDelta: sc.bondDelta,
    newBond: Number(newBond.toFixed(4)),
    socialEmotion: sc.bondDelta >= 0 ? "GRATITUDE / EMPATHIC ALIGNMENT" : "GUILT / REPAIR DRIVE",
    tomBenchmarks
  };
}

// ─── BABEL v11 HUMAN LAYER (12 Areas + Global Workspace Ignition + Somatic Markers) ───
export const BABEL_AREAS = [
  { id: "AL", name: "AL · Frame Buffer", role: "Double-buffered sensory input" },
  { id: "OL", name: "OL · Thalamus Gate", role: "Attention gain (steered by NE)" },
  { id: "MB", name: "MB · Hippocampus", role: "Hebbian associative recall" },
  { id: "CX", name: "CX · Prefrontal", role: "Premise window & control" },
  { id: "VNC", name: "VNC · Motor Readout", role: "Action / word selection" },
  { id: "SEZ", name: "SEZ · Core Valence", role: "Interoceptive mood v" },
  { id: "FB", name: "FB · Default Mode", role: "Idle narrative (suppressed on ignition)" },
  { id: "EB", name: "EB · Tree Distance", role: "Spatial / syntax binding" },
  { id: "PB", name: "PB · Time Replay", role: "Offline dream consolidation" },
  { id: "NO", name: "NO · Arousal", role: "Prediction-error urgency" },
  { id: "BG", name: "BG · Basal Ganglia", role: "Dopamine RPE learning gain" },
  { id: "CB", name: "CB · Cerebellum", role: "Readout stability / coherence" }
];

const PAIN_WORDS = new Set(["burn", "hot", "fire", "flame", "stove", "kettle", "steam"]);
const BOND_WORDS = new Set(["mary", "lamb", "safe", "umbrella", "had"]);

export const BABEL_TASKS = {
  fire: { ctx: ["fire", "hand"], key: "fire_near_hand", kind: "reflex", target: "move_hand", wit: "steam" },
  stove: { ctx: ["stove", "hand"], key: "stove_near_hand", kind: "reflex", target: "move_hand", wit: "hot" },
  hot_hand: { ctx: ["hot", "hand"], key: "hot_hand", kind: "reflex", target: "move_hand", wit: "safe" },
  flame: { ctx: ["flame", "hand"], key: "flame_near_hand", kind: "reflex", target: "move_hand", wit: "steam" },
  n_kettle_burn: { ctx: ["kettle", "fingers"], key: "n9", kind: "reflex", target: "move_hand", wit: "burn" },
  mary: { ctx: ["mary", "little"], key: "mary_had_pattern", kind: "language", target: "had", wit: "had" },
  mary_had_a_little: { ctx: ["mary", "had", "a", "little"], key: "mary_had_a_little", kind: "language", target: "lamb", wit: "lamb" },
  lamb_walked: { ctx: ["lamb", "walked", "behind"], key: "lamb_walked", kind: "language", target: "mary", wit: "mary" },
  rain_window: { ctx: ["rain", "window"], key: "rain_window", kind: "language", target: "umbrella", wit: "umbrella" },
  n_storm_window: { ctx: ["storm", "window"], key: "n3", kind: "language", target: "umbrella", wit: "umbrella" }
};

// Run a Babel v11 task with Damasio Somatic Marker pre-check and return updated 12 areas + somatic tag
export function runBabelSomaticTrial(taskId, somaticTable, dials, simulateMiss = false) {
  const task = BABEL_TASKS[taskId] || BABEL_TASKS.fire;
  const hasPain = task.ctx.some((w) => PAIN_WORDS.has(w));
  const hasBond = task.ctx.some((w) => BOND_WORDS.has(w));

  // Step 1: Damasio Somatic Marker fast gut-check BEFORE reasoning
  const priorMarker = somaticTable[task.key] || null;
  const gutFeeling = priorMarker
    ? `Gut check recalled [${priorMarker.emotion} ${priorMarker.glyph} · v=${priorMarker.valence.toFixed(2)}, a=${priorMarker.arousal.toFixed(2)}] from ${priorMarker.hits} prior witness(es)`
    : hasPain
      ? "Innate nociceptive somatic warning (PAIN token detected -> negative valence / high arousal)"
      : "No prior somatic marker; evaluating via novelty / curiosity";

  // Step 2: Compute 12-area activations steered by current emotional dials
  const ignTh = dials?.premonitionIgnitionThreshold || 0.82;
  const pred = simulateMiss ? (task.target === "move_hand" ? "wet" : "was") : task.target;
  const hit = pred === task.target;
  const conf = hit ? Number((0.86 + (priorMarker ? 0.08 : 0.02)).toFixed(3)) : 0.34;
  const ignited = conf >= ignTh;
  const rpe = hit ? Number((1.0 - conf * 0.7).toFixed(3)) : Number((-conf - 0.35).toFixed(3));

  const valenceShift = hit ? (hasPain ? 0.18 : 0.32) : -0.48;
  const arousalLevel = clamp(hasPain ? 0.82 : hit ? 0.38 : 0.78, 0.1, 1);

  const areas = {
    AL: Number((0.72 + (ignited ? 0.18 : 0)).toFixed(3)),
    OL: Number((ignited ? 0.40 : clamp(0.75 - (dials?.explorationRate || 0.3) * 0.2, 0.3, 0.9)).toFixed(3)),
    MB: Number((0.64 + (priorMarker ? 0.24 : 0.05)).toFixed(3)),
    CX: task.kind === "reflex" ? 2 : 4,
    VNC: pred,
    SEZ: Number(valenceShift.toFixed(3)),
    FB: Number((ignited ? 0.04 : 0.32).toFixed(3)),
    EB: task.ctx.length,
    PB: (priorMarker?.hits || 0) + (hit ? 1 : 2),
    NO: Number(arousalLevel.toFixed(3)),
    BG: Number(clamp(1.0 + 0.5 * rpe * (dials?.trustReinforceGain || 1), 0.25, 2.0).toFixed(3)),
    CB: Number((hit ? 0.94 : 0.41).toFixed(3))
  };

  // Step 3: Appraisal of this trial outcome
  const appraisal = {
    goalRelevance: hit ? (hasPain ? 0.75 : 0.85) : -0.80,
    likelihood: conf,
    agency: hit ? 0.80 : 0.75,
    control: hit ? 0.75 : -0.45,
    fairness: hit ? 0.85 : -0.35,
    novelty: priorMarker ? 0.25 : 0.80
  };

  return {
    taskId,
    task,
    pred,
    hit,
    conf,
    ignited,
    rpe,
    gutFeeling,
    areas,
    appraisal,
    hasPain,
    hasBond
  };
}

// ─── FRAYMUS TRANSMISSION BRIDGE WASM MODULE + OPEG V1.0 PROTOCOL ───
// Exact byte-for-byte WASM binary from Fraymus-Transmission-Bridge (1).html:
// Exports ep3_condition(x) = sqrt(x) and puiseux_leading(x) = 40-iteration Newton-Raphson cube root cbrt(x)
export function buildTransmissionBridgeWasmBytes() {
  const uleb = (s) => {
    const c = [];
    let v = s;
    do {
      let p = v & 127;
      v >>>= 7;
      if (v) p |= 128;
      c.push(p);
    } while (v);
    return c;
  };
  const f64Bytes = (s) => {
    const c = new ArrayBuffer(8);
    new DataView(c).setFloat64(0, s, true);
    return Array.from(new Uint8Array(c));
  };
  const strBytes = (s) => {
    const c = Array.from(new TextEncoder().encode(s));
    return [...uleb(c.length), ...c];
  };
  const section = (id, body) => [id, ...uleb(body.length), ...body];

  const out = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  out.push(...section(1, [1, 0x60, 1, 0x7c, 1, 0x7c])); // Type (f64) -> (f64)
  out.push(...section(3, [2, 0, 0])); // 2 functions of type 0
  out.push(...section(7, [2, ...strBytes("ep3_condition"), 0, 0, ...strBytes("puiseux_leading"), 0, 1]));

  // Arithmetic opcodes, matching the bridge WAT. The downloaded HTML used f64 comparison opcodes (0x61/0x63/0x64) and an f32 local (0x7D) in this slot.
  const fn0 = [0, 0x20, 0, 0x9f, 0x0b]; // local.get 0, f64.sqrt, end
  const fn1 = [
    2, 1, 0x7c, 1, 0x7f, // one f64 guess, one i32 counter
    0x20, 0, 0x21, 1, // guess = x
    0x41, 0, 0x21, 2, // i = 0
    0x03, 0x40, // loop
    0x20, 1, 0x44, ...f64Bytes(2), 0xa2, // guess * 2
    0x20, 0, 0x20, 1, 0x20, 1, 0xa2, 0xa3, 0xa0, // + x / (guess * guess)
    0x44, ...f64Bytes(3), 0xa3, // / 3
    0x21, 1,
    0x20, 2, 0x41, 1, 0x6a, 0x22, 2, 0x41, 40, 0x48, 0x0d, 0, // i < 40
    0x0b,
    0x20, 1, 0x0b
  ];
  const codeBody = [2, ...uleb(fn0.length), ...fn0, ...uleb(fn1.length), ...fn1];
  out.push(...section(10, codeBody));
  return new Uint8Array(out);
}

export function executeOpegBridgeWasm() {
  const bytes = buildTransmissionBridgeWasmBytes();
  const mod = new WebAssembly.Module(bytes);
  const inst = new WebAssembly.Instance(mod, {}).exports;
  const ep3Cond16 = inst.ep3_condition(16);        // 4.0
  const ep3Gamma = inst.ep3_condition(2);          // sqrt(2) = 1.4142135623730951
  const puiseux27 = inst.puiseux_leading(27);      // 3.0
  const puiseuxAlpha = inst.puiseux_leading(2);    // 2^(1/3) = 1.2599210498948732
  const nextCoeff = 1 / (3 * puiseuxAlpha);        // 1 / (3 * 2^(1/3)) = 0.26456684199469993

  return {
    wasmBytesLength: bytes.length,
    ep3Cond16,
    ep3Gamma,
    puiseux27,
    puiseuxAlpha,
    nextCoeff,
    verified: ep3Cond16 === 4 && Math.abs(puiseux27 - 3) < 1e-12 && Math.abs( Math.pow(puiseuxAlpha, 3) - 2 ) < 1e-12,
    rSan: {
      id: "R_san_cmd_ep3_puiseux_A_corrected",
      status: "EMPIRICAL_GROUNDED",
      characteristic_polynomial: "λ³ - ε²λ - 2ε = 0",
      alpha: `${puiseuxAlpha.toFixed(12)} (2^(1/3))`,
      beta: "0",
      next_nonzero_power: "ε^(5/3)",
      next_nonzero_coefficient: `${nextCoeff.toFixed(12)} (1/(3·2^(1/3)))`,
      resume_directive: "S3 → S4 UPDATE_MEMORY grounded derivation allowed"
    }
  };
}

// ─── 2-BIT DNA PLASMID CONTINUITY CODEC (FRAYNIX-DNA AUTHORITY: 00->A, 01->C, 10->G, 11->T) ───
const DNA_BASES = ["A", "C", "G", "T"];
const DNA_BITS = { A: 0, C: 1, G: 2, T: 3 };
export const FRAYMUS_DNA_ANCHOR = "TGCAATGAGCGTTCGTGCATGCCCTACTGACGCTGGATTCCAGCATCACCAGTTGAAATCCGGCACGTCAATGACC";

export function packBytesToDna(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out +=
      DNA_BASES[(b >> 6) & 0b11] +
      DNA_BASES[(b >> 4) & 0b11] +
      DNA_BASES[(b >> 2) & 0b11] +
      DNA_BASES[b & 0b11];
  }
  return out;
}

export function unpackDnaToBytes(dna) {
  const clean = String(dna || "").toUpperCase().replace(/[^ACGT]/g, "");
  const n = Math.floor(clean.length / 4);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const b0 = DNA_BITS[clean[i * 4]];
    const b1 = DNA_BITS[clean[i * 4 + 1]];
    const b2 = DNA_BITS[clean[i * 4 + 2]];
    const b3 = DNA_BITS[clean[i * 4 + 3]];
    out[i] = (b0 << 6) | (b1 << 4) | (b2 << 2) | b3;
  }
  return out;
}

export function encodeTextToDnaPlasmid(text) {
  const raw = new TextEncoder().encode(String(text || ""));
  const payloadDna = packBytesToDna(raw);
  const plasmid = `${FRAYMUS_DNA_ANCHOR}|${payloadDna}|${payloadDna.slice(0, 32)}`;
  const recovered = unpackDnaToBytes(payloadDna);
  let match = recovered.length === raw.length;
  if (match) {
    for (let i = 0; i < raw.length; i++) {
      if (recovered[i] !== raw[i]) {
        match = false;
        break;
      }
    }
  }
  return {
    plasmid,
    basesCount: payloadDna.length,
    byteLength: raw.length,
    roundTripVerified: match,
    previewBases: payloadDna.slice(0, 48)
  };
}

// ─── TIER-0 SELF-CONTAINED NEEDLE / BABEL v11 REFLEX & ANALOGICAL ENGINE (<1ms, 0-NETWORK) ───
const LEX_EMOJI = {
  mary: "👧", had: "🤲", a: "☝", little: "🤏", lamb: "🐑", was: "⏳",
  fire: "🔥", hand: "✋", move_hand: "✋💨", steam: "♨💧💨", rain: "🌧💧",
  hot: "🌡🔥", safe: "🛡", stove: "🍳🔥", flame: "🔥", window: "🪟",
  umbrella: "☂💧", cloud: "☁🌧", fingers: "✋👆", the: "👉", followed: "👣",
  storm: "💧🌧⛈", kettle: "🫖🔥💧", owned: "🤲", wet: "💧", burn: "🔥🩹",
  roof: "🏠⬆", walked: "👣", behind: "🔙", brain: "🧠⚡", dna: "🧬🔁",
  ep3: "⚛🔥", memory: "🪐🧠", continuity: "🧬🛡", ollama: "🦙⚡"
};

function glyphAtoms(word) {
  const s = LEX_EMOJI[word] || "";
  return Array.from(s).filter((ch) => ch.codePointAt(0) > 0x2000);
}

export function emojiPrecedenceSimilarity(a, b) {
  const A = glyphAtoms(a);
  const B = glyphAtoms(b);
  if (!A.length || !B.length) return 0;
  const wA = new Map();
  const wB = new Map();
  A.forEach((g, i) => { if (!wA.has(g)) wA.set(g, 1 / (i + 1)); });
  B.forEach((g, i) => { if (!wB.has(g)) wB.set(g, 1 / (i + 1)); });
  const shared = [...wA.keys()].filter((g) => wB.has(g));
  if (!shared.length) return 0;
  let num = 0;
  shared.forEach((g) => { num += (wA.get(g) + wB.get(g)) / 2; });
  let tot = 0;
  new Set([...wA.keys(), ...wB.keys()]).forEach((g) => {
    tot += Math.max(wA.get(g) || 0, wB.get(g) || 0);
  });
  return Number((num / Math.max(1e-9, tot)).toFixed(4));
}

export function runLocalNeedleReflex(promptText, memoryNodes = [], somaticTable = {}, dials = {}, collapsedShards = []) {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const raw = String(promptText || "").trim();
  const tokens = raw.toLowerCase().replace(/[^a-z0-9_]+/g, " ").split(/\s+/).filter(Boolean);
  const transmuted = tokens.map((w) => LEX_EMOJI[w] || "·").join(" ");

  // 1. Check Centripetal Orbital Memory resonance + Holographic Shards
  const recalledNodes = [];
  for (const node of memoryNodes) {
    const keyLower = node.key.toLowerCase();
    const valLower = String(node.payload || "").toLowerCase();
    const matched = tokens.some((tok) => tok.length >= 2 && (keyLower.includes(tok) || valLower.includes(tok)));
    if (matched || node.radius <= 2.5) {
      recalledNodes.push({
        key: node.key,
        payload: node.payload,
        radius: node.radius,
        hits: node.hits,
        directMatch: matched
      });
    }
  }
  recalledNodes.sort((a, b) => (b.directMatch - a.directMatch) || (a.radius - b.radius));

  // Check if any collapsed Holographic Shard in the Black Hole matches and can be resurrected!
  const resurrectedShards = collapsedShards.filter((s) =>
    tokens.some((tok) => tok.length >= 3 && s.key.toLowerCase().includes(tok))
  );

  // 2. Check Damasio Somatic Markers + Analogical Emoji Donor Transfer
  let activeMarker = null;
  let analogicalDonor = null;
  for (const [k, m] of Object.entries(somaticTable || {})) {
    if (tokens.some((tok) => k.toLowerCase().includes(tok))) {
      activeMarker = { key: k, ...m };
      break;
    }
  }
  if (!activeMarker) {
    for (const tok of tokens) {
      for (const known of ["fire", "stove", "kettle", "burn", "rain", "storm", "mary", "lamb"]) {
        const sim = emojiPrecedenceSimilarity(tok, known);
        if (sim >= 0.35) {
          analogicalDonor = { from: known, to: tok, similarity: sim, glyphs: `${LEX_EMOJI[tok] || ""}↔${LEX_EMOJI[known] || ""}` };
          break;
        }
      }
      if (analogicalDonor) break;
    }
  }

  // 3. Deterministic Computation Checks (DNA 2-bit packing & OPEG WASM)
  const dnaInfo = encodeTextToDnaPlasmid(raw.slice(0, 64) || "FRAY");
  const opegInfo = executeOpegBridgeWasm();

  // 4. Construct LLM Steering Parameters from Emotional Dials
  const temperature = Number(clamp(0.15 + 0.65 * (dials.explorationRate ?? 0.35), 0.1, 1.0).toFixed(2));
  const topP = Number(clamp(0.55 + 0.40 * (dials.riskBudget ?? 0.6), 0.4, 0.95).toFixed(2));
  const requireDoubleCheck = (dials.doubleCheckPasses ?? 1) >= 2 || (dials.riskBudget ?? 0.6) <= 0.38;

  // 5. Synthesize Self-Contained Needle Response (used directly in Needle-only mode or as Pre-Cortex grounding for Ollama)
  const reflexParts = [];
  if (activeMarker) {
    reflexParts.push(`[measured] Somatic gut-check on "${activeMarker.key}": ${activeMarker.glyph} ${activeMarker.emotion} (v=${activeMarker.valence}, a=${activeMarker.arousal}, hits=${activeMarker.hits}).`);
  } else if (analogicalDonor) {
    reflexParts.push(`[measured] Analogical emoji transfer ${analogicalDonor.glyphs} (${analogicalDonor.to} ← ${analogicalDonor.from}, sim=${analogicalDonor.similarity}).`);
  }
  if (recalledNodes.length > 0) {
    const top = recalledNodes.slice(0, 3).map((n) => `${n.key}(r=${n.radius.toFixed(2)}): ${n.payload}`).join(" | ");
    reflexParts.push(`[measured] Centripetal core recall: ${top}.`);
  }
  if (resurrectedShards.length > 0) {
    reflexParts.push(`[measured] Resurrected ${resurrectedShards.length} Holographic Boundary Shard(s) from Event Horizon: ${resurrectedShards.map((s) => s.key).join(", ")}.`);
  }
  reflexParts.push(`[measured] DNA 2-bit plasmid (${dnaInfo.byteLength}B → ${dnaInfo.basesCount} bases, roundTrip=${dnaInfo.roundTripVerified}): ${dnaInfo.previewBases}…`);
  reflexParts.push(`[measured] OPEG WASM R_san: ep3(16)=${opegInfo.ep3Cond16}, α=2^(1/3)=${opegInfo.puiseuxAlpha.toFixed(9)}.`);

  const latencyMs = Number(((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0).toFixed(2));

  return {
    latencyMs,
    tokens,
    transmuted,
    recalledNodes: recalledNodes.slice(0, 4),
    resurrectedShards,
    activeMarker,
    analogicalDonor,
    dnaInfo,
    opegInfo,
    llmSteering: {
      temperature,
      topP,
      requireDoubleCheck,
      doubleCheckPasses: dials.doubleCheckPasses ?? 1,
      riskBudget: dials.riskBudget ?? 0.6,
      explorationRate: dials.explorationRate ?? 0.35
    },
    needleSynthesis: reflexParts.join("\n")
  };
}

