// FrayVM Tier0 — faithful to the archive's wasm-my-pocket-frayvm-wired build.
// Program is an array of { op, arg }. JUMP/JZ/PUSH_IMM carry an immediate arg.
import { base64, fnv1a64, sha256, textBytes } from "./emojiCodec.js";

export const ISA = [
  ["HALT", 0x00, "stop"], ["NOP", 0x01, "do nothing"], ["EMIT", 0x10, "pop n, print the character n"],
  ["DROP", 0x20, "pop and discard"], ["SWAP", 0x21, "swap top two"], ["OVER", 0x22, "copy second to top"],
  ["ROT", 0x23, "rotate top three"], ["NIP", 0x24, "drop the second"], ["TUCK", 0x25, "copy top below second"],
  ["2DUP", 0x26, "duplicate top two"], ["2SWAP", 0x27, "swap the top two pairs"], ["2OVER", 0x28, "copy the second pair"],
  ["DEPTH", 0x29, "push the stack depth"], ["PICK", 0x2a, "copy the nth item"], ["ROLL", 0x2b, "move the nth item to top"],
  ["DUP", 0x2c, "duplicate top"], ["?DUP", 0x2d, "duplicate top if non-zero"], ["2DROP", 0x2e, "drop top two"],
  ["ADD", 0x40, "pop a b, push b+a"], ["SUB", 0x41, "pop a b, push b-a"], ["MUL", 0x42, "pop a b, push b*a"],
  ["DIV", 0x43, "pop a b, push b/a"], ["MOD", 0x44, "pop a b, push b%a"], ["NEG", 0x45, "negate top"],
  ["ABS", 0x46, "absolute value"], ["MIN", 0x47, "smaller of top two"], ["MAX", 0x48, "larger of top two"],
  ["AND", 0x49, "bitwise and"], ["OR", 0x4a, "bitwise or"], ["XOR", 0x4b, "bitwise xor"],
  ["SHL", 0x4c, "shift left"], ["SHR", 0x4d, "shift right (unsigned)"], ["NOT", 0x4e, "bitwise not"],
  ["INC", 0x4f, "add one"], ["DEC", 0x50, "subtract one"],
  ["EQ", 0x60, "equal"], ["NE", 0x61, "not equal"], ["LT", 0x62, "less than"], ["GT", 0x63, "greater than"],
  ["GE", 0x64, "greater or equal"], ["LE", 0x65, "less or equal"], ["ZERO?", 0x66, "top is zero"],
  ["NOTZERO?", 0x67, "top is non-zero"], ["EVEN?", 0x68, "top is even"], ["ODD?", 0x69, "top is odd"],
  ["LNOT", 0x6a, "logical not"], ["BOOL", 0x6b, "0 or 1"], ["SIGN", 0x6c, "-1, 0, or 1"],
  ["BETWEEN", 0x6d, "lo hi x -> in range"], ["CLAMP", 0x6e, "clamp to lo..hi"], ["TRUE", 0x6f, "push 1"], ["FALSE", 0x70, "push 0"],
  ["PUSH_IMM", 0x80, "push the immediate"], ["POP_PRINT", 0x81, "pop and print the number"],
  ["ITOF", 0x90, "int to float"], ["FTOI", 0x91, "float to int"], ["FDUP", 0x92, "duplicate float top"], ["FDROP", 0x93, "drop float top"],
  ["JUMP", 0xa0, "jump to the immediate"], ["JZ", 0xa1, "pop; if zero, jump to the immediate"]
];

export const BY_NAME = new Map(ISA.map(([name, op, desc]) => [name, { op, desc }]));
export const BY_OP = new Map(ISA.map(([name, op, desc]) => [op, { name, desc }]));
export const ARG_OPS = new Set([0x80, 0xa0, 0xa1]);
const STEP_LIMIT = 20000;

export class FrayVM {
  load(code) {
    this.code = code;
    this.ip = 0;
    this.running = true;
    this.iStack = [];
    this.fStack = [];
    this.output = "";
    this.steps = 0;
    this.trace = [];
    return this;
  }

  step() {
    if (!this.running || this.ip >= this.code.length) return (this.running = false);
    const instruction = this.code[this.ip++];
    const n = instruction.op;
    const t = instruction.arg;
    const S = this.iStack;
    const r = () => (S.length ? S.pop() : 0);
    const l = (value) => S.push(value | 0);
    switch (n) {
      case 0x00: this.running = false; break;
      case 0x01: break;
      case 0x20: r(); break;
      case 0x21: { const u = r(), i = r(); l(u); l(i); break; }
      case 0x22: { const u = S[S.length - 2] ?? 0; l(u); break; }
      case 0x23: if (S.length >= 3) { const u = r(), i = r(), o = r(); l(i); l(u); l(o); } break;
      case 0x24: if (S.length >= 2) { const u = r(); r(); l(u); } break;
      case 0x25: { const u = r(), i = r(); l(u); l(i); l(u); break; }
      case 0x26: { const u = S[S.length - 1] ?? 0, i = S[S.length - 2] ?? 0; l(i); l(u); break; }
      case 0x27: if (S.length >= 4) { const u = r(), i = r(), o = r(), a = r(); l(i); l(u); l(a); l(o); } break;
      case 0x28: if (S.length >= 4) { const u = S[S.length - 4] ?? 0, i = S[S.length - 3] ?? 0; l(u); l(i); } break;
      case 0x29: l(S.length); break;
      case 0x2a: { let u = t !== undefined ? t : r(); u |= 0; l(S[S.length - 1 - u] ?? 0); break; }
      case 0x2b: { let u = t !== undefined ? t : r(); u |= 0; if (u >= 0 && u < S.length) l(S.splice(S.length - 1 - u, 1)[0]); break; }
      case 0x2c: { const u = S[S.length - 1] ?? 0; l(u); break; }
      case 0x2d: { const u = S[S.length - 1] ?? 0; if (u !== 0) l(u); break; }
      case 0x2e: r(); r(); break;
      case 0x40: { const u = r(), i = r(); l(i + u); break; }
      case 0x41: { const u = r(), i = r(); l(i - u); break; }
      case 0x42: { const u = r(), i = r(); l(Math.imul(i, u)); break; }
      case 0x43: { const u = r(), i = r(); l(u === 0 ? 0 : (i / u) | 0); break; }
      case 0x44: { const u = r(), i = r(); l(u === 0 ? 0 : i % u); break; }
      case 0x45: { const u = r(); l(-u); break; }
      case 0x46: { const u = r(); l(u < 0 ? -u : u); break; }
      case 0x47: { const u = r(), i = r(); l(i < u ? i : u); break; }
      case 0x48: { const u = r(), i = r(); l(i > u ? i : u); break; }
      case 0x49: { const u = r(), i = r(); l(i & u); break; }
      case 0x4a: { const u = r(), i = r(); l(i | u); break; }
      case 0x4b: { const u = r(), i = r(); l(i ^ u); break; }
      case 0x4c: { const u = r(), i = r(); l(i << (u & 31)); break; }
      case 0x4d: { const u = r(), i = r(); l(i >>> (u & 31)); break; }
      case 0x4e: { const u = r(); l(~u); break; }
      case 0x4f: { const u = r(); l(u + 1); break; }
      case 0x50: { const u = r(); l(u - 1); break; }
      case 0x60: { const u = r(), i = r(); l(i === u ? 1 : 0); break; }
      case 0x61: { const u = r(), i = r(); l(i !== u ? 1 : 0); break; }
      case 0x62: { const u = r(), i = r(); l(i < u ? 1 : 0); break; }
      case 0x63: { const u = r(), i = r(); l(i > u ? 1 : 0); break; }
      case 0x64: { const u = r(), i = r(); l(i >= u ? 1 : 0); break; }
      case 0x65: { const u = r(), i = r(); l(i <= u ? 1 : 0); break; }
      case 0x66: { const u = r(); l(u === 0 ? 1 : 0); break; }
      case 0x67: { const u = r(); l(u !== 0 ? 1 : 0); break; }
      case 0x68: { const u = r(); l((u & 1) === 0 ? 1 : 0); break; }
      case 0x69: { const u = r(); l((u & 1) !== 0 ? 1 : 0); break; }
      case 0x6a: { const u = r(); l(u ? 0 : 1); break; }
      case 0x6b: { const u = r(); l(u ? 1 : 0); break; }
      case 0x6c: { const u = r(); l(u === 0 ? 0 : u > 0 ? 1 : -1); break; }
      case 0x6d: { const u = r(), i = r(), o = r(); l(o >= i && o <= u ? 1 : 0); break; }
      case 0x6e: { const u = r(), i = r(); let a = r(); if (a < i) a = i; if (a > u) a = u; l(a); break; }
      case 0x6f: l(1); break;
      case 0x70: l(0); break;
      case 0x80: l(t ?? 0); break;
      case 0xa0: if (t !== undefined) this.ip = t; break;
      case 0xa1: if (r() === 0 && t !== undefined) this.ip = t; break;
      case 0x81: { const u = r(); this.output += u.toString() + " "; break; }
      case 0x10: { const u = r(); this.output += String.fromCharCode(u & 65535); break; }
      case 0x90: { const u = r(); this.fStack.push(u); break; }
      case 0x91: { const u = this.fStack.pop() ?? 0; l(u | 0); break; }
      case 0x92: { const u = this.fStack[this.fStack.length - 1] ?? 0; this.fStack.push(u); break; }
      case 0x93: this.fStack.pop(); break;
      default: break;
    }
    if (++this.steps > STEP_LIMIT) this.running = false;
    return this.running;
  }

  run() {
    while (this.running && this.steps < STEP_LIMIT) this.step();
    return this.output;
  }
}

export function runProgram(code) {
  const vm = new FrayVM().load(code);
  const output = vm.run();
  return { output, top: vm.iStack[vm.iStack.length - 1] ?? null, stack: vm.iStack.slice(), steps: vm.steps, halted: !vm.running };
}

// text assembler: "PUSH 10  PUSH 5  ADD  POP_PRINT  HALT" or one op per line, ; comments
const ALIAS = { PUSH: "PUSH_IMM", PRINT: "POP_PRINT", IMM: "PUSH_IMM", "." : "POP_PRINT" };

const parseNumber = (token) => (/^0x[0-9a-f]+$/i.test(token) ? parseInt(token, 16) : /^-?\d+$/.test(token) ? Number(token) : null);

export function assemble(text) {
  const tokens = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/[;#].*$/, "").trim();
    if (!line) continue;
    for (const token of line.split(/[\s,]+/).filter(Boolean)) tokens.push(token);
  }
  const program = [];
  const labels = new Map();
  const pending = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.endsWith(":")) { labels.set(token.slice(0, -1).toUpperCase(), program.length); continue; }
    const literal = parseNumber(token);
    if (literal !== null) { program.push({ op: 0x80, arg: literal }); continue; }
    const name = (ALIAS[token.toUpperCase()] || token).toUpperCase();
    const entry = BY_NAME.get(name);
    if (!entry) throw new Error(`Unknown instruction: ${token}`);
    if (!ARG_OPS.has(entry.op)) { program.push({ op: entry.op }); continue; }
    const next = tokens[++i];
    if (next === undefined) throw new Error(`${name} needs an argument`);
    const value = parseNumber(next);
    if (value !== null) program.push({ op: entry.op, arg: value });
    else { pending.push({ index: program.length, label: next.toUpperCase(), name }); program.push({ op: entry.op, arg: 0 }); }
  }
  for (const { index, label, name } of pending) {
    if (!labels.has(label)) throw new Error(`${name} points at an unknown label: ${label}`);
    program[index].arg = labels.get(label);
  }
  return program;
}

export function disassemble(code) {
  return code.map((instruction, index) => {
    const entry = BY_OP.get(instruction.op);
    const name = entry ? entry.name : `0x${instruction.op.toString(16)}`;
    return ARG_OPS.has(instruction.op) ? `${index}: ${name} ${instruction.arg ?? 0}` : `${index}: ${name}`;
  }).join("\n");
}

// canonical bytecode: op byte, plus i32 LE arg for PUSH_IMM / JUMP / JZ (matches the archive)
export function toBytecode(code) {
  const bytes = [];
  for (const instruction of code) {
    bytes.push(instruction.op);
    if (ARG_OPS.has(instruction.op)) {
      const value = instruction.arg | 0;
      bytes.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
    }
  }
  return new Uint8Array(bytes);
}

export function fromBytecode(bytes) {
  const code = [];
  for (let i = 0; i < bytes.length;) {
    const op = bytes[i++];
    if (ARG_OPS.has(op)) {
      const arg = (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24));
      i += 4;
      code.push({ op, arg });
    } else code.push({ op });
  }
  return code;
}

// ---- straight-line FrayVM -> WASM compiler ----
// Maps the arithmetic/compare subset directly onto the wasm operand stack.
// DUP and stack-shuffles are supported via 2 i32 scratch locals (local 0, local 1).
const WASM_DIRECT = {
  0x20: [0x1a],
  0x21: [0x21, 0x00, 0x21, 0x01, 0x20, 0x00, 0x20, 0x01],
  0x22: [0x21, 0x00, 0x22, 0x01, 0x20, 0x00, 0x20, 0x01],
  0x2c: [0x22, 0x00, 0x20, 0x00],
  0x6f: [0x41, 0x01],
  0x70: [0x41, 0x00],
  0x80: null, 0x40: [0x6a], 0x41: [0x6b], 0x42: [0x6c], 0x43: [0x6d], 0x44: [0x6f],
  0x45: null, 0x49: [0x71], 0x4a: [0x72], 0x4b: [0x73], 0x4c: [0x74], 0x4d: [0x76], 0x4f: null, 0x50: null,
  0x60: [0x46], 0x61: [0x47], 0x62: [0x48], 0x63: [0x4a], 0x64: [0x4e], 0x65: [0x4c], 0x66: [0x45]
};
const COMPILABLE = new Set(Object.keys(WASM_DIRECT).map(Number).concat([0x00, 0x01]));

export function canCompile(code) {
  return code.every((instruction) => COMPILABLE.has(instruction.op));
}

function sleb(value) {
  const out = [];
  for (;;) {
    const byte = value & 0x7f;
    value >>= 7;
    if ((value === 0 && !(byte & 0x40)) || (value === -1 && byte & 0x40)) { out.push(byte); return out; }
    out.push(byte | 0x80);
  }
}
function uleb(value) {
  const out = [];
  do { let byte = value & 0x7f; value >>>= 7; if (value) byte |= 0x80; out.push(byte); } while (value);
  return out;
}
const wsection = (id, body) => [id, ...uleb(body.length), ...body];
const wname = (text) => [...uleb(textBytes(text).length), ...textBytes(text)];

export function compileToWasm(code) {
  if (!canCompile(code)) throw new Error("This program uses stack or control-flow ops; run it on the VM or forge it instead.");
  const bodyOps = [];
  for (const instruction of code) {
    const op = instruction.op;
    if (op === 0x00 || op === 0x01) continue;
    if (op === 0x80) { bodyOps.push(0x41, ...sleb(instruction.arg | 0)); continue; }
    if (op === 0x45) { bodyOps.push(0x41, ...sleb(-1), 0x6c); continue; }
    if (op === 0x4f) { bodyOps.push(0x41, ...sleb(1), 0x6a); continue; }
    if (op === 0x50) { bodyOps.push(0x41, ...sleb(1), 0x6b); continue; }
    bodyOps.push(...WASM_DIRECT[op]);
  }
  const funcBody = [0x01, 0x02, 0x7f, ...bodyOps, 0x0b];
  const bytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...wsection(1, [0x01, 0x60, 0x00, 0x01, 0x7f]),
    ...wsection(3, [0x01, 0x00]),
    ...wsection(7, [0x01, ...wname("main"), 0x00, 0x00]),
    ...wsection(10, [0x01, ...uleb(funcBody.length), ...funcBody]),
    ...wsection(0, [...wname("fraymus.frayvm"), ...toBytecode(code)])
  ]);
  return bytes;
}

// ---- self-running forge: a real module that carries its own program + proofs ----
const CUSTOM = (name, data) => wsection(0, [...wname(name), ...Array.from(data)]);

export async function forge(code, meta = {}) {
  const bytecode = toBytecode(code);
  const result = runProgram(code);
  const baseline = { tool: "frayvm-forge/1.0", ran: result.output, top: result.top, steps: result.steps, created: new Date().toISOString(), ...meta };
  const ledger = { bytecode_b64: base64(bytecode), fnv1a64: fnv1a64(bytecode), sha256: await sha256(bytecode), instructions: code.length, reversible: true };
  // identity module: export execute(i32)->i32 returns its input; plus the program + proofs in custom sections
  const executeBody = [0x00, 0x20, 0x00, 0x0b];
  const bytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...wsection(1, [0x01, 0x60, 0x01, 0x7f, 0x01, 0x7f]),
    ...wsection(3, [0x01, 0x00]),
    ...wsection(7, [0x01, ...wname("execute"), 0x00, 0x00]),
    ...wsection(10, [0x01, ...uleb(executeBody.length), ...executeBody]),
    ...CUSTOM("fraymus.baseline", textBytes(JSON.stringify(baseline))),
    ...CUSTOM("fraymus.frayvm", bytecode),
    ...CUSTOM("fraymus.ledger", textBytes(JSON.stringify(ledger)))
  ]);
  return { bytes, baseline, ledger };
}

export function readCustomSections(bytes) {
  const sections = {};
  let i = 8;
  const readUleb = () => { let shift = 0, value = 0, byte; do { byte = bytes[i++]; value |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80); return value >>> 0; };
  while (i < bytes.length) {
    const id = bytes[i++];
    const size = readUleb();
    const end = i + size;
    if (id === 0) {
      const nameLen = readUleb();
      const name = new TextDecoder().decode(bytes.slice(i, i + nameLen));
      sections[name] = bytes.slice(i + nameLen, end);
    }
    i = end;
  }
  return sections;
}

export function recoverProgram(bytes) {
  const sections = readCustomSections(bytes);
  if (!sections["fraymus.frayvm"]) return null;
  return fromBytecode(sections["fraymus.frayvm"]);
}

export const GOLDEN = [
  { name: "ADD 10+5", src: "PUSH 10  PUSH 5  ADD  POP_PRINT  HALT", expect: "15 " },
  { name: "SUB 20-8", src: "PUSH 20  PUSH 8  SUB  POP_PRINT  HALT", expect: "12 " },
  { name: "MUL 6*7", src: "PUSH 6  PUSH 7  MUL  POP_PRINT  HALT", expect: "42 " },
  { name: "DIV 20/4", src: "PUSH 20  PUSH 4  DIV  POP_PRINT  HALT", expect: "5 " },
  { name: "DUP 9+9", src: "PUSH 9  DUP  ADD  POP_PRINT  HALT", expect: "18 " },
  { name: "SWAP 1 2", src: "PUSH 1  PUSH 2  SWAP  POP_PRINT  POP_PRINT  HALT", expect: "1 2 " },
  { name: "EMIT Hi", src: "PUSH 72  EMIT  PUSH 105  EMIT  PUSH 10  EMIT  HALT", expect: "Hi\n" },
  { name: "TRUE FALSE EQ", src: "TRUE  FALSE  EQ  POP_PRINT  HALT", expect: "0 " },
  { name: "ZERO? 0", src: "PUSH 0  ZERO?  POP_PRINT  HALT", expect: "1 " },
  { name: "EVEN? 4", src: "PUSH 4  EVEN?  POP_PRINT  HALT", expect: "1 " },
  { name: "ODD? 5", src: "PUSH 5  ODD?  POP_PRINT  HALT", expect: "1 " },
  { name: "INC 41", src: "PUSH 41  INC  POP_PRINT  HALT", expect: "42 " },
  { name: "LOOP via JZ", src: "PUSH 3\nloop: DUP  POP_PRINT  DEC  DUP  JZ end  JUMP loop\nend: DROP  HALT", expect: "3 2 1 " }
];

export function runGolden() {
  return GOLDEN.map((test) => {
    try {
      const code = assemble(test.src);
      const output = runProgram(code).output;
      return { ...test, output, pass: output === test.expect };
    } catch (error) {
      return { ...test, output: error.message, pass: false };
    }
  });
}

// ---- True Merkle 41: text -> DNA -> 8192 bases -> 256 words -> 41 hashes ----
const MASK64 = (1n << 64n) - 1n;
function fnvBig(bytes) {
  let hash = 14695981039346656037n;
  for (const byte of bytes) { hash ^= BigInt(byte); hash = (hash * 1099511628211n) & MASK64; }
  return hash;
}
function bigToLE(value) {
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) out[i] = Number((value >> BigInt(i * 8)) & 0xffn);
  return out;
}
export function trueMerkle(text) {
  const bytes = textBytes(text).slice(0, 2048);
  let dna = "";
  for (const byte of bytes) for (let shift = 0; shift < 4; shift++) dna += "ACGT"[(byte >> (2 * shift)) & 3];
  dna = dna.length < 8192 ? dna.padEnd(8192, "A") : dna.slice(0, 8192);
  const words = [];
  for (let i = 0; i < 8192; i += 32) {
    let value = 0n;
    for (const base of dna.slice(i, i + 32)) value = (value << 2n) | BigInt(Math.max(0, "ACGT".indexOf(base)));
    words.push(value);
  }
  const blockHashes = [];
  for (let b = 0; b < 32; b++) {
    const group = words.slice(b * 8, b * 8 + 8);
    const buffer = new Uint8Array(group.length * 8);
    group.forEach((word, index) => buffer.set(bigToLE(word), index * 8));
    blockHashes.push(fnvBig(buffer));
  }
  const level1 = [];
  for (let g = 0; g < 8; g++) {
    const children = blockHashes.slice(g * 4, g * 4 + 4);
    const buffer = new Uint8Array(32);
    children.forEach((hash, index) => buffer.set(bigToLE(hash), index * 8));
    level1.push(fnvBig(buffer));
  }
  const rootBuffer = new Uint8Array(64);
  level1.forEach((hash, index) => rootBuffer.set(bigToLE(hash), index * 8));
  const root = fnvBig(rootBuffer);
  return { bytesLen: bytes.length, words: words.length, blockHashes, level1, root, hashCount: blockHashes.length + level1.length + 1 };
}

// FRAY 64-byte header + bytecode (matches the archive's serializer)
export function frayHeader(code, root, wordCount = 256, hashCount = 41) {
  const bytecode = toBytecode(code);
  const bytes = new Uint8Array(64 + bytecode.length);
  const view = new DataView(bytes.buffer);
  bytes.set([0x46, 0x52, 0x41, 0x59], 0);
  bytes[4] = 3;
  view.setUint16(6, wordCount, false);
  view.setUint16(8, hashCount, false);
  bytes.set(bigToLE(root), 10);
  view.setBigUint64(18, BigInt(Date.now()), true);
  view.setUint32(30, code.length, true);
  view.setUint32(34, bytecode.length, true);
  bytes.set(bytecode, 64);
  return bytes;
}
