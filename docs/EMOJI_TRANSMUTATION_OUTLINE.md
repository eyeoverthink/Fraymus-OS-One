# Emoji transmutation and HTML·JS: outline of the archive

This is a summary of everything in `~/Documents/fraymus-css` (57 files, deduplicated by SHA-256) and the attached PDFs. The Emoji and HTML·JS tabs in the studio are built from it. Each section says what the source does, what the tab took from it, and what it deliberately left out.

## 1. Sources

| Source | What it is |
| --- | --- |
| `glyphsmith.html` | Encode text or bytes into one emoji using Unicode variation selectors; decode back into 11 views (UTF-8, hex, `0x`, `\x`, Base64, JSON, C, Python, Rust, Go, WAT). |
| `Glyphsmith-Ultimate-Java-Baremetal-Zero-Protocol (1).html` | Same codec, plus Java and bare-metal byte arrays as export views. |
| `Fray-Exec-Studio-Any (5).html` | A 60-emoji carrier picker, an x86 subset assembler (`mov eax,imm` B8, `add eax,imm` 05, `xor`, `inc`, `nop` 90, `ret` C3), a per-byte VS breakdown table, and `.bin` / `.txt` / `.c` / `.js` downloads. |
| `emoji_coder (1).html` (= `(2)`, `(3)`, and the copy in `fraymus-artifacts.zip`; newer than `emoji_coder.html`) | **Emoji Coder**, the emoji-to-CSS/JS converter. Emoji markup (📦 div, 🔴 color, ↔️ row, `> + * ( ) { } . #`) becomes live HTML with inline CSS, plus JS DOM, JSX, Pug, Markdown, JSON, and a reversible `.wasm`. It also has My Keys (macros, or `=tag` for a real element) and an Embed panel (the page behind one emoji). |
| `agentdocs.zip` → `fraymus-ultimate-java-baremetal-bundle.txt`, `Java-Baremetal-Minimal-Deps-Ultimate-Fix.html`, `Wat-Probe-Java-Baremetal-Integration.html` | `UltimateBrick.java` (`com.fraymus.metal`): `ZeroProtocol` / `ProtocolZero` (the same selector codec), `FrayVM` / `executeX86`, `GenesisChain` SHA-256, DNA `pack32`, FNV-1a, a WASM custom-section builder, and Ollama Modelfiles. JDK only. |
| `emoji_polyglot.html` | A stack VM written in emoji (`push add sub mul div dup swap drop eq gt lt print emit times if`), emitted to 14 languages. |
| `Powder-Protocol-...html` | An emoji opcode map: 😀 MOV, 🌟 ADD, ✨ XOR, 🔥 STORE, 💎 LOAD, 🌀 SIN, 🧬 DNA, 🔐 HASH, 🧩 MERKLE, ⚡ POW, 🎭 SHUF, 🔮 WAVE, 🛡️ PROT, 📦 PACK, 🔗 CHAIN, 💥 BREAK. |
| `fraymus_manual (4).html` | A manual with easter eggs (🧬 → 15, 🔥 → 1337, 🧠 message) and the palette: gold `#e7b24e`, bio `#46d39a`, violet `#b98cff`, cyan `#5cc7ff`. |
| `EMOJI_STEGANOGRAPHY_COMPLETE_DOCUMENTATION.md` | A zero-width binary codec (U+200B = 0, U+200D = 1, 8 bits per character, U+200C separator) and a semantic word-to-emoji map (hello 👋, world 🌍, ...). |
| `message-emoji.txt` / `message-dna.txt` | FRAYMUS v13 read-back tests: 41 × (🧩 + one selector) and the same 41 bytes as 164 DNA bases. The phrase stays private; only its sha256 `cdeb7bef24c7e82c...` is on record. |
| `FRAYMUS-COMMS-PROTOCOL-V1.pdf` (= `V1_1.pdf`, byte-identical) | The variation-selector codec, the DNA codec, FNV-1a 64, Merkle-41, FaceBlock, the FRAY header, and the WASM demo. |
| `FRAYMUS-ELITE-OS-MASTER-VAULT.pdf` | Constants and lore: φ = 1.618033988749895, φ^75 seal 4721424167835376.00, SEED 1337, golden angle 137.507°, SCALE 2^50. |
| `Image-gallery-css-font.html` (= `CSS-font-live-Fraymus .html`) | The "HAND-DRAWN 3D CSSKIT" showcase: hand-drawn buttons, a font specimen, a gallery. It is not itself an editor. |
| `Fraymus-Studio-Css-Js (2).html`, `css-two.html` | The real live editors (FRAYMUS CREATE ENGINE): debounced `srcdoc` preview (350 ms), a console bridge, single-file export. |

## 2. The exact codecs

**Variation selectors**, from Glyphsmith, Fray-Exec, and the Comms Protocol:

```js
toVS(b)   = b < 16 ? U+FE00 + b : U+E0100 + (b - 16)
fromVS(c) = FE00..FE0F → c - 0xFE00 ; E0100..E01EF → c - 0xE0100 + 16 ; else null
glyph     = carrier + bytes.map(toVS)        // or one carrier per byte (v13 style)
```

When decoding, every selector in the string is read in order, so a message can be spread over many emojis.

**DNA**: 4 bases per byte, 2 bits per base, most significant pair first. A = 00, C = 01, G = 10, T = 11.

**Zero-width**: UTF-8 bytes become bits; 0 = U+200B, 1 = U+200D. The tab uses UTF-8 bytes instead of the document's `ord(c)`, so text beyond Latin-1 still round-trips.

**FNV-1a 64**: offset `14695981039346656037`, prime `1099511628211`, `hash = (hash ^ byte) * prime` mod 2^64.

**Merkle-41**: 32 block hashes, then 8 intermediate hashes (groups of 4), then 1 root (group of 8), all FNV-1a.

**FaceBlock**: `w[i] ^= floor(sin(f*i + p) * 1000)`.

**FRAY header**: magic `0x46524159`, version 3, wordCount 256, hashCount 41, root[32], timestamp, gameId, drawCount. The spec says 64 bytes, but these fields add up to 72, so the tab does not write this header.

## 3. What the Emoji tab does

- **Hide**: text or a file becomes a glyph. You can put all the bytes on one carrier, one carrier per byte (v13 style), or let the words pick carriers (meaning mode).
- **Reveal**: paste anything. It recognizes a glyph, zero-width text, DNA, or plain text and decodes it.
- **DNA**: bytes to and from ACGT.
- **Zero-width**: hides the payload inside an ordinary sentence.
- **Proof**: SHA-256 and FNV-1a of the input and of the round-trip output, with a match badge.
- **Views**: text, hex, Base64, JSON, C, JS, Java, Python, DNA, x86.
- **Selector breakdown**: byte, hex, selector code point, DNA quad, character.
- **Downloads**: glyph `.txt`, DNA `.txt`, payload `.bin`.
- **Place in project**: a glyph plus a Reveal button, for static projects and MERN.

**Left out on purpose:**

- Claims that cannot be tested (consciousness, "survives death", platform-survival percentages).
- The x86 executor and the emoji VMs: running emoji-encoded machine code is a separate app.
- The 64/72-byte header mismatch described above.

The tab only encodes and decodes. It never sends anything anywhere.

**Java**: there is a Java view (`byte[] payload = {…}`) and a **FrayGlyph.java** download. The download is a JDK 11+ class with no dependencies. It carries the payload (as base64 chunks, so large payloads still compile), re-encodes it, checks the round trip, and prints SHA-256, FNV-1a, and DNA. It also reads the x86 subset and writes `glyph.txt`. It was compiled and run on Temurin 17. For all 256 bytes, its glyph is byte-identical to the JavaScript output.

Two bugs in the archive Java are fixed:

- Glyphsmith's `b<16` tests a signed Java byte, so bytes 128–255 get the wrong selector. The fix uses `b & 0xFF` first.
- The bundle's `encodeGlyph` masks each byte with `& 0xE7`, which loses data; its own comment says so. The fix uses all 256 values, one selector per byte.

## 4. What the Emoji Coder tab does

This is a port of `emoji_coder (1).html` into the studio template.

- **Left column**: the palette (Structure, Text, Interactive, Color, Background, Layout, Type) and My Keys. Bind an emoji to markup (a macro) or to `=tag` (a real element). There are six presets: nav bar, hero, card, 3 cards, form, footer.
- **Middle**: the emoji editor with operator buttons, plus a Live preview / HTML / CSS view.
- **Right column**: the exports and Embed.

**Exports:**

- HTML.
- **CSS + HTML** (new): each distinct emoji style becomes a `.fx-xxxxxx` class in a real stylesheet, and the HTML uses those classes. It downloads as `styles.css` and `index.html`.
- **JavaScript (DOM)**: `createElement` and `style.cssText`, with 👆 wired through `addEventListener`.
- JSX/React.
- **Java** (new): `EmojiPage.java`, JDK 15+. Run it and it writes `page.html`.
- Pug, Markdown, and JSON.
- **WASM**: valid, exports `execute(i32)`, and carries the source as base64 in the `fraymus.emojicoder` custom section. It decodes back to the exact source.
- The emoji source itself.

**Embed / Reveal**: hide the source or the HTML behind one carrier, then render the hidden page back into the preview.

**Bug fixed**: the original tokenizer stopped at the first space after an element. Its own sample `📦.hero 🌈 🎯 ↕️` therefore lost every style, and `1️⃣ 🆙{Big}` lost its text. Spaces between an element and its styles or `{text}` are now allowed.

**Place in project**: in a static project, the class-based HTML is appended to the HTML pane and its CSS to the CSS pane. In a MERN project, a `/coded` page is added, built from the JSX.

### Keys, legend, and the emoji window

- **Three kinds of key** (`classifyKey` in `emojiMarkup.js`):
  - A **combination** expands to more emoji markup.
  - An **element** (`=dialog`) is a real tag.
  - A **CSS** key holds full declarations (`prop: value; …`). It registers as a style glyph, so it stacks after any element exactly like 🌈 or 📏, and it turns into a `.fx-` class in the CSS export.
- **CSS → Emoji window**: paste a whole stylesheet, load the project's CSS, or use the sample. `parseStylesheet` turns each rule into a key with a live swatch. At-rules (`@media`, `@keyframes`, `@import`) are skipped because one glyph carries one set of declarations. Emoji are assigned by hand from the emoji window or with Auto-pick, then all are bound at once.
- **Emoji window**: tabs for HTML elements, CSS styles, My keys, Smileys, People, Animals, Nature, Food, Buildings, Travel, Activities, Objects, Symbols, and Flags (`emojiCatalog.js`). Selecting a glyph shows its meaning, code points, UTF-16 units, and UTF-8 bytes. From there it can be inserted, bound as a key, or used as the carrier.
- **Legend**: how a line reads, every operator with a worked example, all built-in elements, styles, and actions, your keys, and the capacity explanation.
- **Capacity, stated plainly**: a bigger glyph does not store more. 🧠 is 4 UTF-8 bytes and 👨‍👩‍👧‍👦 is 25, but every carrier hides any number of bytes, one selector per byte (3 UTF-8 bytes for values 0–15, 4 for 16–255). The archive's own Emoji Coder notes say the same.

## 5. What the Dispatch tab does

Source: `email_launched_engine_heartbeat.html` in the archive, an "email-launched engine" with a six-tick heartbeat and a CSS robot. In the archive most ticks are simulated: the signature check always prints TRUE against a placeholder signature, `ep3()=42` is a display string, the Merkle proof is hard-coded, and "decompress" is a progress bar. In the studio every tick does the real work (`dispatchCore.js`).

- **Envelope**: `{fray, v, from, to, subject, ts, prev, program, psha, merkle, alg, pub, canon, sig}`. The program is `{css, js, html, wasm}`. `canon = v|from|to|ts|prev|psha|root`, signed with Ed25519 (ECDSA P-256 if the browser lacks Ed25519). `prev` chains to the SHA-256 of the previous canon.
- **Wire**: `FRAY` magic, version, flags, then deflate-raw JSON. Plain JSON without a header is read too, which is the archive's format.
- **Carriers**: emoji-64 (the engine's 64-symbol alphabet, 💤 padding) or one glyph with variation selectors.
- **Archive bug fixed**: 7 of the 64 symbols (❤️ ⚙️ 👁️ 🛰️ ❄️ 🌪️ 🏳️) are two code points, but the archive decoder read one code point at a time, so most payloads failed to decode. The studio strips U+FE0F and decodes per symbol, which also survives mail clients that drop U+FE0F.
- **Heartbeat**: 1 decode, 2 verify signature, 3 Merkle root + payload hash + prev + freshness window, 4 unpack to files and validate the WASM, 5 execute in a sandboxed iframe, 6 dispatch through `mailto:` or a Gmail draft. Tamper flips one symbol to show where it is caught.
- **Robot**: the archive's `roboRun` keyframes on a `.robo` 🤖, plus a small API for payload JS: `robot.move(px)`, `robot.say(text)`, `robot.spin()`.
- **WASM movie**: a hand-assembled 245-byte module exporting `ep3()`, `frame(t)`, and `mem`, with a `fraymus.movie` custom section. Each frame writes 160×90 RGBA pixels in WebAssembly, and the stage draws them to a canvas. Any `.wasm` with `frame(t)` and `mem` can be loaded instead.
- **Not recoverable from the archive**: `fraynix-video-to-wasm-full.zip` is a saved "Preview is not available" web page, not a zip. `media_creation_mega` only allocates WASM memory for frames and imports Python modules that are not in the archive.

## 6. What the WASM tab does

Sources: `wasm-my-pocket-frayvm-wired-v3-true-merkle.html`, `fraymus_wasm_forge_local.html`, and the two markdown IP notes. The core is `frayvm.js`; the UI is `WasmPage.jsx`.

- **FrayVM Tier0**: the 60-opcode stack machine, copied verbatim from the archive's `step()` (HALT, stack shuffles, arithmetic, compares, PUSH_IMM, POP_PRINT, EMIT, JUMP, JZ, float ops). `JUMP`/`JZ`/`PUSH_IMM` carry an immediate; the step limit is 20,000.
- **Assembler**: text mnemonics (with `PUSH`/`PRINT` aliases, `;` comments, and `name:` labels) → `{op, arg}` program. Labels are resolved by instruction index with forward references.
- **Bytecode**: op byte, plus an i32 LE arg for PUSH_IMM / JUMP / JZ — the archive's serializer. Round-trips through `toBytecode` / `fromBytecode`.
- **Golden tests**: all 13 from the archive run live on the VM (ADD 10+5, the Hi! EMIT, the JZ count-down loop, and the rest). All pass.
- **Compile to WebAssembly** (`compileToWasm`): a real straight-line compiler for the arithmetic/compare subset. Each op maps onto the wasm operand stack, and it emits a module exporting `main() -> i32`. Verified in the browser that `main()` equals the VM result (e.g. 6×7−2 = 40). Stack-shuffle and jump programs are refused with a note to forge instead.
- **Forge** (`forge`): a real executable module exporting `execute(i32) -> i32` (identity, self-tested with `execute(42) === 42`), plus three custom sections: `fraymus.baseline` (what it ran), `fraymus.frayvm` (the bytecode), and `fraymus.ledger` (FNV-1a and SHA-256). The program is recovered from the section and re-run.
- **Probe**: load any `.wasm`, validate it, instantiate it, list exports and custom sections, call the exports, and recover the FrayVM program if the module was forged here.
- **True Merkle 41** (`trueMerkle`): text → DNA → 8192 bases → 256 words → 32 FaceBlock hashes → 8 → 1 root, all FNV-1a 64-bit. Plus the FRAY 64-byte header (magic `0x46524159`, version 3, wordCount BE, hashCount BE, root, timestamp).
- **WASM in one emoji**: the bytecode hides behind one carrier with the variation-selector codec and reveals back to the exact program (21 bytes in one 🧩).
- **Honest note**: in the archive, most of this was a display. The signature always printed TRUE, `ep3()=42` was a string, and the Merkle proof was hard-coded. Here the VM, compiler, forge, probe, Merkle, and emoji round trip all actually run.

## 7. What the HTML·JS tab does

- Two panes only, HTML and JavaScript. Use `<style>` inside the HTML when you need styling.
- A live `srcdoc` preview with an adjustable delay (350 ms by default) and a console bridge for `log`, `warn`, `error`, and uncaught errors.
- Starters in the Image-gallery kit look: Gallery, Font specimen, Hand-drawn buttons, Canvas starfield, Clock, Todo, Blank.
- Device widths, copy, export as a single `.html` file, open in a new tab, and Place in project.
