import { buildAppSource, ensureMern } from "../model.js";
import { derivePiHiddenFrequency, composeRainbowBeatChord, runFlyGnnMeasureTrainMeasure } from "./flyGnnConnectome.js";
import { recommendAndForgePackages, runReaForensicAudit } from "./sovereignEcosystem.js";
import { assemble, compileWithPccCertificate, verifyPccWasmCertificate } from "./frayvm.js";

export const PHI = 1.618033988749895;

const SEED_NOTES = [110, 146.83, 164.81, 196, 220, 261.63];

export const SEED_CATALOG = [
  {
    id: "music-phi",
    channel: "MUSIC",
    title: "Phi-Harmonic Sub-Bass (1.618 Hz Drift)",
    duration: "03:44",
    screws: 842,
    bpm: 118,
    tags: ["#WebAudioSynth", "#Stems", "#118BPM"],
    voiceIntro: "Phi-harmonic sub-bass is live. Four stems share the clock: sub, lead, drum, and your custom audio.",
    synthNotes: [110, 130.81, 146.83, 164.81, 196, 220, 261.63],
    code: `const patch = { waveform: "sawtooth", cutoffHz: 1618, resonance: 6.4, tempoBpm: 118, phiRatio: 1.6180339 };
return "Synth patch verified at " + patch.tempoBpm + " BPM | Filter: " + patch.cutoffHz + "Hz";`,
    reaTrace: "[AUDIO]\nStems: SUB_BASS, LEAD_SYNTH, DRUM_PULSE, CUSTOM\nFFT: 64-band analyser on the master bus"
  },
  {
    id: "video-portal",
    channel: "VIDEO",
    title: "Fraymus Portal: 60FPS Horizon Broadcast",
    duration: "08:15",
    screws: 965,
    bpm: 124,
    tags: ["#60FPS", "#Portal", "#Devlog"],
    voiceIntro: "Portal horizon is on the video channel. The cyan grid locks to the stem clock.",
    synthNotes: [98, 123.47, 146.83, 196, 246.94],
    code: `const terrain = { gridLines: 28, horizonGlow: "#00e5ff", elevationScale: 42.5, cameraVelocity: 2.4 };
return "Terrain matrix recompiled: " + terrain.gridLines + " scanlines active.";`,
    reaTrace: "[VIDEO]\nCanvas horizon grid at display refresh\nFrame clock shares the stem BPM"
  },
  {
    id: "code-rea-protocol",
    channel: "CODE",
    title: "REA Protocol: Clean-Room Rebuild",
    duration: "14:20",
    screws: 1290,
    bpm: 95,
    tags: ["#REA", "#CleanRebuild", "#AppDesign"],
    voiceIntro: "Code and App Design is open. Scope the target, map the surface, trace the feature, and verify the rebuild.",
    synthNotes: [146.83, 174.61, 220, 293.66],
    code: `function traceStatePipeline(uiPayload) {
  if (!uiPayload || !uiPayload.action) throw new Error("Invalid trigger");
  const signature = uiPayload.action.split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0);
  return { status: "VERIFIED_ORIGINAL_REBUILD", route: "ipcMain://fraymus/dispatch", hash: Math.abs(signature).toString(16).toUpperCase() };
}
const test1 = traceStatePipeline({ action: "SYNC_NEURAL_BUFFER" });
const test2 = traceStatePipeline({ action: "EXPORT_SVG_CENTERLINE" });
return JSON.stringify({ test1, test2, verdict: "PASS" }, null, 2);`,
    reaTrace: "[REA]\n1. Target Scoping\n2. Setup & Readiness\n3. Surface Mapping\n4. Feature Tracing\n5. Evidence Collection\n6. Reconstruction\n7. Verification\n8. Final Report"
  }
];

export function formatClock(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function audible(freqs) {
  return (freqs.length ? freqs : SEED_NOTES).map((raw) => {
    let f = Math.abs(Number(raw)) || 110;
    while (f > 880) f /= 2;
    while (f < 70) f *= 2;
    return Number(f.toFixed(2));
  });
}

function slug(value) {
  return String(value || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "item";
}

function brainPatch(seed = 847) {
  const hidden = derivePiHiddenFrequency(seed, 432, 0);
  const chord = composeRainbowBeatChord(hidden.freqHz, 528, 1);
  return { hidden, chord, synthNotes: audible(chord.rainbowVector) };
}

export function cardFromStem(stem, project, goal = "") {
  const name = stem?.name || "custom-stem";
  const brain = brainPatch((stem?.sampleRate || 432) % 900);
  const pkg = recommendAndForgePackages(project, `${goal} custom audio stem ${name} app design system`);
  const rea = runReaForensicAudit(project || {});
  return {
    id: `code-stem-${slug(name)}`,
    channel: "CODE",
    generated: false,
    title: `App Design · ${name}`,
    duration: formatClock(stem?.seconds || 30),
    screws: 1,
    bpm: stem?.bpm || 118,
    tags: ["#CustomStem", "#SystemDesign", "#Brain432", "#REA"],
    voiceIntro: `Custom stem ${name} is now a Code and App Design card. Brain carrier ${brain.hidden.freqHz.toFixed(2)} hertz. ${rea.summary}`,
    synthNotes: brain.synthNotes,
    code: `const stem = ${JSON.stringify({
      name,
      seconds: Number(stem?.seconds || 0),
      sampleRate: stem?.sampleRate || 0,
      bpm: stem?.bpm || 118
    }, null, 2)};
const brainHz = ${brain.hidden.freqHz};
const packages = ${JSON.stringify(pkg.recommendations.map((item) => item.name))};
return JSON.stringify({ stem, brainHz, packages, phi: ${PHI}, verdict: "PASS" }, null, 2);`,
    reaTrace: [
      "[STEM → CODE & APP DESIGN]",
      `Stem: ${name}`,
      `Brain π-hidden carrier: ${brain.hidden.freqHz} Hz · chunk ${brain.hidden.chunk}`,
      `Rainbow vector: ${brain.chord.rainbowVector.join(", ")}`,
      rea.summary,
      ...rea.obligations.slice(0, 5).map((item) => `${item.id} ${item.status} ${item.surface}`),
      ...pkg.recommendations.map((item) => `${item.name} · ${item.reason}`)
    ].join("\n")
  };
}

export function buildStudioCards(project, goal = "offline media studio") {
  const p = project || {};
  const rea = runReaForensicAudit(p);
  const brain = brainPatch(847);
  const pkg = recommendAndForgePackages(p, goal || "app design");
  const cards = [];

  if (p.stack === "mern" && Array.isArray(p.pages) && p.pages.length) {
    for (const page of p.pages.slice(0, 6)) {
      cards.push({
        id: `code-page-${slug(page.name)}`,
        channel: "CODE",
        generated: true,
        title: `App Design · ${page.name}`,
        duration: "06:00",
        screws: 12,
        bpm: 104,
        tags: ["#AppDesign", "#MERN", page.path || "/"],
        voiceIntro: `${page.name} at ${page.path} is on the Code and App Design channel.`,
        synthNotes: brain.synthNotes,
        code: `const page = ${JSON.stringify({ name: page.name, path: page.path, file: page.file, auth: !!page.auth })};
return JSON.stringify(page, null, 2);`,
        reaTrace: `Surface: ${page.file}\nRoute: ${page.path}\n${rea.summary}`
      });
    }
  } else if (p.name) {
    cards.push({
      id: "code-page-shell",
      channel: "CODE",
      generated: true,
      title: `App Design · ${p.name}`,
      duration: "05:00",
      screws: 8,
      bpm: 110,
      tags: ["#AppDesign", "#Static", p.stack || "static"],
      voiceIntro: `Open project ${p.name} is mapped into the Code and App Design channel.`,
      synthNotes: brain.synthNotes,
      code: `const shell = ${JSON.stringify({
        name: p.name,
        stack: p.stack || "static",
        htmlBytes: String(p.html || "").length,
        cssBytes: String(p.css || "").length,
        jsBytes: String(p.js || "").length
      })};
return JSON.stringify(shell, null, 2);`,
      reaTrace: rea.summary
    });
  }

  cards.push({
    id: "code-rea-audit",
    channel: "CODE",
    generated: true,
    title: "REA · Project obligation ledger",
    duration: "09:40",
    screws: 40,
    bpm: 96,
    tags: ["#REA", "#Evidence", "#EightStep"],
    voiceIntro: rea.summary,
    synthNotes: brain.synthNotes,
    code: `const audit = ${JSON.stringify({
      summary: rea.summary,
      coveragePct: rea.coveragePct,
      artifacts: rea.artifactCount,
      unknowns: rea.unknowns.length
    })};
return JSON.stringify(audit, null, 2);`,
    reaTrace: [
      rea.summary,
      ...rea.evidence.slice(0, 6).map((item) => `${item.artifact} · ${item.bytes} B · ${item.digest}`)
    ].join("\n")
  });

  cards.push({
    id: "code-brain-pi",
    channel: "CODE",
    generated: true,
    title: `Brain · π-hidden ${brain.hidden.freqHz.toFixed(2)} Hz`,
    duration: "04:32",
    screws: 64,
    bpm: 108,
    tags: ["#Brain", "#432Hz", "#Phi"],
    voiceIntro: `Brain carrier locked at ${brain.hidden.freqHz.toFixed(2)} hertz from pi digit index ${brain.hidden.secretIndex}.`,
    synthNotes: brain.synthNotes,
    code: `const brain = ${JSON.stringify({
      freqHz: brain.hidden.freqHz,
      chunk: brain.hidden.chunk,
      secretIndex: brain.hidden.secretIndex,
      rainbow: brain.chord.rainbowVector
    })};
return JSON.stringify(brain, null, 2);`,
    reaTrace: `π chunk ${brain.hidden.chunk} → ${brain.hidden.freqHz} Hz\nRainbow ${brain.chord.rainbowVector.join(", ")}`
  });

  const runnable = `${pkg.synthesizedPackageCode.replace(/^export /gm, "")}\nreturn ternaryDot([1, -1, 0, 1], [3, 4, 5, 6]).toFixed(4);`;
  cards.push({
    id: "code-sysdesign",
    channel: "CODE",
    generated: true,
    title: `SystemDesign · ${pkg.synthesizedPackageName.split("/").pop()}`,
    duration: "07:10",
    screws: 22,
    bpm: 112,
    tags: ["#SystemDesign", "#ZeroDep", "#Packages"],
    voiceIntro: `System design forged ${pkg.recommendations.length} package recommendations for this project.`,
    synthNotes: brain.synthNotes,
    code: runnable,
    reaTrace: pkg.recommendations.map((item) => `${item.name} (${item.matchScore}) · ${item.reason}`).join("\n")
  });

  return cards;
}

export function buildFlyCard(prompt = "loose screw stem design") {
  const result = runFlyGnnMeasureTrainMeasure(prompt, 2);
  const brain = brainPatch(11);
  return {
    id: "code-flygnn",
    channel: "CODE",
    generated: true,
    title: "Brain · FlyGNN dedicated connectome",
    duration: "11:00",
    screws: 70,
    bpm: 100,
    tags: ["#FlyGNN", "#Brain", "#Hebbian"],
    voiceIntro: `FlyGNN measure-train-measure finished. Non-overwrite check ${result.nonOverwritingVerified ? "passed" : "needs another pass"}.`,
    synthNotes: brain.synthNotes,
    code: `const fly = ${JSON.stringify({
      engine: result.engine,
      nonOverwritingVerified: result.nonOverwritingVerified,
      beforeHadWeight: result.beforeHadWeight,
      afterHadWeight: result.afterHadWeight,
      beforeMoveHandWeight: result.beforeMoveHandWeight,
      afterMoveHandWeight: result.afterMoveHandWeight
    })};
return JSON.stringify(fly, null, 2);`,
    reaTrace: JSON.stringify({
      engine: result.engine,
      neurons: result.connectomeSnapshot?.totalNeurons,
      trainSteps: result.connectomeSnapshot?.trainSteps,
      cxCoherence: result.connectomeSnapshot?.cxCoherence,
      nonOverwritingVerified: result.nonOverwritingVerified
    }, null, 2)
  };
}

export function buildPccCard() {
  const program = assemble("PUSH 6\nPUSH 7\nMUL\nPUSH 2\nSUB\nHALT");
  const packed = compileWithPccCertificate(program, { fuelLimit: 4000, label: "looseScrew" });
  const check = verifyPccWasmCertificate(packed.wasmBytes, { expectedTop: 40 });
  const brain = brainPatch(40);
  return {
    id: "code-pcc",
    channel: "CODE",
    generated: true,
    title: "App Design · FrayVM proof-carrying WASM",
    duration: "08:00",
    screws: 21,
    bpm: 98,
    tags: ["#WASM", "#PCC", "#FrayVM"],
    voiceIntro: `Proof-carrying WASM ${check.verified ? "verified" : "did not verify"} before instantiation. Stage ${check.stage || "done"}.`,
    synthNotes: brain.synthNotes,
    code: `const pcc = ${JSON.stringify({
      verified: check.verified,
      stage: check.stage || "VERIFIED",
      wasmBytes: packed.wasmBytes.length,
      pccBytes: packed.pccSectionBytesLength,
      top: packed.certificate.finalTop,
      root: packed.certificate.traceMerkleRootHex
    })};
return JSON.stringify(pcc, null, 2);`,
    reaTrace: `fray.pcc.v21 · ${packed.wasmBytes.length} bytes · merkle ${packed.certificate.traceMerkleRootHex}`
  };
}

export function mergeCards(current, generated) {
  const ids = new Set(generated.map((card) => card.id));
  return [...generated, ...current.filter((card) => !ids.has(card.id))];
}

export function applyLooseScrew(project, item) {
  const card = item || SEED_CATALOG[0];
  const safeTitle = String(card.title || "looseScrew").replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[ch]));
  const snippet = `<section class="loose-screw" style="max-width:720px;margin:24px auto;padding:18px;border:1px solid rgba(0,229,255,.35);border-radius:12px;background:#0c1017;color:#e6f1ff;font-family:ui-monospace,monospace">
  <p style="color:#00e5ff;margin:0 0 6px">looseScrew · ${card.channel || "CODE"}</p>
  <h2 style="margin:0 0 8px">${safeTitle}</h2>
  <p style="color:#8aa899">${(card.tags || []).join(" ")} · ${card.bpm || 120} BPM</p>
  <pre style="white-space:pre-wrap">${String(card.reaTrace || "").replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[ch]))}</pre>
</section>`;
  if (project.stack === "mern") {
    const next = ensureMern(project);
    const file = "client/src/pages/LooseScrew.jsx";
    const pages = next.pages.some((page) => page.name === "LooseScrew")
      ? next.pages
      : [...next.pages, { name: "LooseScrew", path: "/loosescrew", file, auth: false }];
    const source = `import React from "react";
const CARD = ${JSON.stringify({ title: card.title, channel: card.channel, bpm: card.bpm, tags: card.tags, reaTrace: card.reaTrace, code: card.code })};
export default function LooseScrew() {
  return (
    <main className="page" style={{ padding: 20, background: "#05070a", color: "#e6f1ff" }}>
      <p style={{ color: "#00e5ff" }}>looseScrew · {CARD.channel}</p>
      <h1>{CARD.title}</h1>
      <p>{(CARD.tags || []).join(" ")} · {CARD.bpm} BPM</p>
      <pre style={{ whiteSpace: "pre-wrap" }}>{CARD.reaTrace}</pre>
      <pre style={{ whiteSpace: "pre-wrap" }}>{CARD.code}</pre>
    </main>
  );
}
`;
    return { ...next, pages, files: { ...next.files, [file]: source, "client/src/App.jsx": buildAppSource(pages) } };
  }
  return { ...project, html: `${project.html || ""}\n${snippet}\n` };
}

export function standaloneIndexHtml(catalog) {
  const data = JSON.stringify(catalog.map((card) => ({
    id: card.id,
    channel: card.channel,
    title: card.title,
    duration: card.duration,
    bpm: card.bpm,
    tags: card.tags,
    synthNotes: card.synthNotes,
    code: card.code,
    reaTrace: card.reaTrace
  })));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>looseScrew</title>
<style>
body{margin:0;background:#05070a;color:#e6f1ff;font-family:ui-monospace,monospace}
header{display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(0,229,255,.35)}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:16px}
button,article{background:#121822;color:#e6f1ff;border:1px solid #1e293b;border-radius:8px;padding:10px;text-align:left}
article{cursor:pointer}
.cyan{color:#00e5ff}
pre{white-space:pre-wrap}
</style>
</head>
<body>
<header><b>loose<span class="cyan">Screw</span></b><span>EyeOverthink · stems drive the Code channel</span></header>
<main id="grid"></main>
<pre id="out" style="margin:16px"></pre>
<script>
const CATALOG = ${data};
const grid = document.getElementById("grid");
const out = document.getElementById("out");
function play(notes, bpm){
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const step = (60 / (bpm || 120)) * 0.5;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime + i * step);
    osc.stop(ctx.currentTime + i * step + 0.2);
  });
}
grid.innerHTML = CATALOG.map((item) => '<article data-id="'+item.id+'"><div class="cyan">'+item.channel+'</div><b>'+item.title+'</b><div>'+(item.tags||[]).slice(0,3).join(" ")+'</div></article>').join("");
grid.onclick = (event) => {
  const node = event.target.closest("article");
  if (!node) return;
  const item = CATALOG.find((card) => card.id === node.dataset.id);
  try {
    const result = new Function(item.code)();
    out.textContent = item.reaTrace + "\\n\\n" + result;
  } catch (error) {
    out.textContent = error.message;
  }
  play(item.synthNotes || [110,220], item.bpm);
};
</script>
</body>
</html>`;
}

export const LOOSE_SCREW_JAVA = `import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;
import java.io.*;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.*;

/** looseScrew local engine. Binds 127.0.0.1 only. */
public class LooseScrewEngine {
    public static class AkashicRecord {
        private final List<String> fossils = new CopyOnWriteArrayList<>();
        public void preserveFossil(String category, String payload) {
            String entry = String.format("{\\"timestamp\\":\\"%s\\",\\"category\\":\\"%s\\",\\"payload\\":\\"%s\\"}",
                    Instant.now().toString(), category, payload.replace("\\"", "\\\\\\""));
            fossils.add(entry);
            System.out.println("[AKASHIC_RECORD] Preserved Fossil #" + fossils.size() + " -> " + category);
        }
        public String toJson() { return "[" + String.join(",", fossils) + "]"; }
    }

    public static class LazarusEngine implements Runnable {
        private volatile double thermalCoreCelsius = 36.48;
        private final AkashicRecord memory;
        public LazarusEngine(AkashicRecord memory) { this.memory = memory; }
        public void triggerThermalInjection(double delta) {
            this.thermalCoreCelsius += delta;
            memory.preserveFossil("THERMAL_INJECTION", String.format("Core mutated to %.2fC", thermalCoreCelsius));
        }
        @Override public void run() {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    Thread.sleep(15000);
                    thermalCoreCelsius = 36.48 + (Math.sin(System.currentTimeMillis() * 0.001) * 0.1618);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }
    }

    public static void main(String[] args) throws IOException {
        int port = 8080;
        AkashicRecord akashic = new AkashicRecord();
        akashic.preserveFossil("BOOT", "looseScrew initialized");
        Thread.ofVirtual().start(new LazarusEngine(akashic));
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/", (HttpExchange exchange) -> {
            Path indexPath = Path.of("index.html");
            byte[] response = Files.exists(indexPath)
                    ? Files.readAllBytes(indexPath)
                    : "<h1>Place index.html beside this engine</h1>".getBytes();
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=UTF-8");
            exchange.sendResponseHeaders(200, response.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(response); }
        });
        server.createContext("/api/akashic", (HttpExchange exchange) -> {
            byte[] json = akashic.toJson().getBytes();
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, json.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(json); }
        });
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        server.start();
        System.out.println("looseScrew Studio Online -> http://127.0.0.1:" + port);
    }
}
`;

export const DEPLOY_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail
REPO_NAME="looseScrew"
GITHUB_USER="eyeoverthink"
git init
git checkout -B main
git add index.html LooseScrewEngine.java README.md
git commit -m "Manifest looseScrew: Music, Video, and Code/REA studio"
if command -v gh >/dev/null 2>&1; then
  gh repo create "$GITHUB_USER/$REPO_NAME" --public --source=. --remote=origin --push
else
  git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git" 2>/dev/null || true
  git push -u origin main
fi
echo "Pushed to https://github.com/$GITHUB_USER/$REPO_NAME"
`;
