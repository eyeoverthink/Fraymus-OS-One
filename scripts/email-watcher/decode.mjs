/**
 * FRAYMUS v16 Emoji Decode + Verify module
 * Extracted from the proven Email-Launched-Engine-Heartbeat.html (Oct 2 2026)
 *
 * © 2026 Fraymus Web Studio · FRAY 0x46524159
 */

// ─── The 64-emoji base64 alphabet (proven in the bridge, ep3_condition = √2 exact) ───
const EMOJI_ALPHABET = [
  '🟦','🟩','🟥','🟨','🟪','🟧','⬛','⬜',
  '🔵','🟢','🔴','🟡','🟣','🟠','⚫','⚪',
  '🔷','💚','❤️','💛','💜','🧡','🖤','🤍',
  '🚀','🤖','💾','📦','🧬','⚙️','🔐','🔑',
  '🌐','📡','💡','🔋','🧠','👁️','🎯','🛰️',
  '🦾','🦿','🧩','⚡','🔥','❄️','🌊','🌪️',
  '🎮','🎲','🧿','🔮','💎','🏴','🏳️','🚩',
  '🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'
];
const PAD_EMOJI = '💤';
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Emoji string → base64 string (I0 from the engine)
 * Each emoji maps to one base64 character; 💤 = '='
 */
export function emojiToBase64(emojiStr) {
  let b64 = '';
  const segmenter = new Intl.Segmenter();
  for (const { segment } of segmenter.segment(String(emojiStr))) {
    const ch = segment.replace(/\uFE0F/g, "");
    if (ch === PAD_EMOJI || segment === PAD_EMOJI) { b64 += '='; continue; }
    const idx = EMOJI_ALPHABET.findIndex((glyph) => glyph.replace(/\uFE0F/g, "") === ch);
    if (idx >= 0) b64 += B64_CHARS[idx];
    // skip whitespace / unknown chars silently
  }
  return b64;
}

/**
 * Decode a full emoji payload → JSON object (Gc from the engine)
 * emoji → base64 → atob → UTF-8 → JSON.parse
 */
export function decodePayload(emojiStr) {
  try {
    const b64 = emojiToBase64(emojiStr);
    const binary = atob(b64);
    // Handle UTF-8: decodeURIComponent(escape(binaryStr))
    const utf8 = decodeURIComponent(escape(binary));
    return JSON.parse(utf8);
  } catch (err) {
    return null;
  }
}

/**
 * SHA-256 hex digest (for merkle verification + sig hashing)
 */
export async function sha256hex(data) {
  const enc = new TextEncoder().encode(typeof data === 'string' ? data : JSON.stringify(data));
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify the merkle proof in a decoded payload
 * Walks proof[] from leaf up, hashing pairs, must reach root
 */
export async function verifyMerkle(payload) {
  if (!payload?.merkle?.root || !payload?.merkle?.proof) return false;
  const { root, proof, leaf } = payload.merkle;

  // If leaf is truncated (e.g. "da2b1ec4..."), we can only verify structurally
  if (leaf && leaf.includes('...')) {
    // Structural check: root and proof exist, prev hash present
    return !!(root && proof.length > 0 && payload.prev);
  }

  // Full verification: hash up the tree
  let current = leaf || await sha256hex(payload.canon);
  for (const sibling of proof) {
    // Convention: sorted concatenation
    const pair = current < sibling ? current + sibling : sibling + current;
    current = await sha256hex(pair);
  }
  return current === root;
}

/**
 * Verify signature (Ed25519 BigInt, matching the engine's O0 path)
 * For now: structural check (pub + sig + canon present and well-formed)
 * Full Ed25519 verify requires the curve ops from the bridge
 */
export function verifySignature(payload) {
  if (!payload?.pub || !payload?.sig || !payload?.canon) return { valid: false, reason: 'missing fields' };
  if (payload.pub.length !== 66 && payload.pub.length !== 64) return { valid: false, reason: 'bad pub length' };
  if (payload.sig.length < 64) return { valid: false, reason: 'bad sig length' };
  // Structural pass — full Ed25519 verify happens at the hub's /api/fraynix/verify
  return { valid: true, reason: 'structural-pass (full verify at hub)' };
}

/**
 * Check the FRAY magic header (0x46524159) in WASM bytes
 */
export function hasFrayHeader(wasmBytes) {
  if (!wasmBytes || wasmBytes.length < 4) return false;
  return wasmBytes[0] === 0x46 && wasmBytes[1] === 0x52
      && wasmBytes[2] === 0x41 && wasmBytes[3] === 0x59;
}

/**
 * Full decode + verify pipeline
 * Returns { ok, payload, checks: { decode, sig, merkle, ts } } or { ok: false, error }
 */
export async function decodePipeline(emojiStr) {
  const checks = { decode: false, sig: false, merkle: false, ts: false };

  // Step 1: decode
  const payload = decodePayload(emojiStr);
  if (!payload) return { ok: false, error: 'decode failed', checks };
  checks.decode = true;

  // Step 2: verify signature (structural, full at hub)
  const sigResult = verifySignature(payload);
  checks.sig = sigResult.valid;

  // Step 3: verify merkle
  checks.merkle = await verifyMerkle(payload);

  // Step 4: timestamp window (payload.ts within 24h for email transport)
  if (payload.ts) {
    const age = Date.now() - payload.ts;
    checks.ts = age >= 0 && age < 24 * 60 * 60 * 1000; // 24h window for email
  }

  return {
    ok: checks.decode && checks.sig,  // merkle + ts are warnings, not blockers
    payload,
    checks,
    dispatchTo: payload.dispatchTo || payload.to || null,
    canon: payload.canon || null,
    from: payload.from || null,
  };
}

// ─── CLI test ───
if (process.argv[1]?.endsWith('decode.mjs') && process.argv[2]) {
  const input = process.argv[2];
  console.log('Decoding emoji payload...');
  const result = await decodePipeline(input);
  console.log(JSON.stringify(result, null, 2));
}
