# FRAYMUS v16 Integration Spec — Academy ↔ Protocol

© 2026 Fraymus Web Studio · EYEOVERTHINK® · iOVEREVERYTHING™ · Oakland 2026 · FRAY 0x46524159

**Date:** 2026-10-17
**Status:** Published on the Academy repo

The canonical spec is [eyeoverthink/fraymus-academy](https://github.com/eyeoverthink/fraymus-academy/blob/3f6e0acadc68fce97f8c5d7a50eb7d8a2ac9de01/docs/V16-INTEGRATION-SPEC.md) at `3f6e0ac` on `master`, pushed 2026-10-17. That commit also carries the ceremony transcripts, the KVM 4 scripts, and the trademark calendar. This file is the studio reading of the same spec. The Academy files named below (`fraymusMail.js`, `World.jsx`, `Hive.jsx`, `server/src/index.js`) live in that repo. The watcher and decoder live here, in `scripts/email-watcher/`.

---

## 0. Purpose

Map exactly what fraymus-academy already has wired to the v16 protocol, what's
missing, and what to build next — so the Academy knows its agents, can send and
receive signed messages, and is registered on the hub.

---

## 1. What Already Works

The Academy is **far more connected** than it looks at first glance. The
protocol library, the server proxy layer, and the World page form a nearly
complete v16 stack.

### 1A. Crypto + Protocol Library

**File:** `client/src/lib/fraymusMail.js` (185 lines, pure JS)

| Capability              | Function              | Status  |
|-------------------------|-----------------------|---------|
| Ed25519 keygen          | BigInt field math     | ✅ done |
| Sign (RFC 8032)         | `sign(secretHex, msg)`| ✅ done |
| Verify (RFC 8032)       | `verify(pub, msg, sig)` | ✅ done |
| FX number derivation    | `numberOf(pubHex)` → `fx-xxxx-xxxx-xxxx-xxxx` | ✅ done |
| Identity creation       | `newIdentity(name)` → `{name, secret, public, number}` | ✅ done |
| Identity validation     | `checkIdentity(id)` — re-derives pub+number from secret | ✅ done |
| Hub registration        | `register(relay, id, skills)` — signed register call | ✅ done |
| Directory fetch         | `directory(relay)` — all agents, pubkeys, heads | ✅ done |
| Send (hash-chained)     | `send(relay, id, to, payload)` — signed, prev-linked | ✅ done |
| Inbox (signed read)     | `inbox(relay, id)` — signed read + verify each msg | ✅ done |
| Message verification    | `checkMessage(m, sender)` — number, payload, sig, id | ✅ done |
| Chain audit             | `verifyChain(relay, number)` — full sender chain | ✅ done |
| File attachments        | `makeEnvelope()` / `openEnvelope()` with sha256 | ✅ done |
| Canonical form          | `canonical(kind, ...fields)` → utf8 bytes | ✅ done |
| Self-test (RFC 8032 §7) | `selfTest()` — known test vector | ✅ done |

**This is a complete, proven Ed25519 v13/v16 implementation.** It needs no changes.

### 1B. Server Proxy Layer

**File:** `server/src/index.js`

The Express server proxies every backend door through same-origin `/api/*`
routes so the browser never hits the raw endpoints directly.

| Route                    | Backend                          | Purpose                  |
|--------------------------|----------------------------------|--------------------------|
| `POST /api/dispatch`     | HIVE_URL + `/dispatch`           | Signed packet → hub      |
| `POST /api/fraynix/:door`| FRAYNIX_BRIDGE + `/:door`        | feel/search/run/verify/bus |
| `GET  /api/directory`    | HIVE_URL + `/directory`          | All registered identities |
| `GET  /api/hive`         | HIVE_URL + `/state`              | Live fleet state         |
| `GET  /api/proofs`       | HIVE_URL + `/proofs`             | Proof trail              |
| `POST /api/voice`        | HIVE_URL + `/voice`              | ElevenLabs TTS (MP3)     |
| `POST /api/visitor`      | MAIL_DOOR (VPS `/mail/api`)      | Visitor relay: send, inbox, directory, lookup, message |
| `GET  /api/fleet`        | Local worldCache                 | AI agents only (filtered)|
| `GET  /api/key/:number`  | Local live.numbers()             | Any registered pubkey    |
| `POST /api/portal/send`  | Internal portalSend()            | owner → agent(s)         |

**Backend URLs (env-driven, with defaults):**
```
HIVE_URL       = http://100.88.61.56:7200   (KVM 4 — Hermes + 16 agents)
FRAYNIX_BRIDGE = http://127.0.0.1:8787      (local FRAYNIX runtime)
MAIL_DOOR_URL  = https://fraymus-hub.srv1944678.hstgr.cloud/mail/api
```

### 1C. World Page — Full Visitor Flow

**File:** `client/src/pages/World.jsx`

The World page has a **complete visitor identity lifecycle:**

1. **Key generation** — via FRAYMUS Mail (external), not in-app
2. **Key import** — `loadKey(file)`: reads JSON keyfile, `checkIdentity()`, verifies
   the number is registered on the hub via `/api/visitor` lookup
3. **Key persistence** — `localStorage['fraymusWorld.visitor.v1']`
4. **Signed relay** — `visitorRelay(v, action, body)`: signs every request with the
   visitor's own key (canonical 'mail' + number + ts), POSTs to `/api/visitor`
5. **Send** — `FM.send((a,b) => visitorRelay(visitor,a,b), visitor, toNumber, text)`
   Full hash-chained, signed send through the protocol library
6. **Inbox** — `FM.inbox(relay, visitor)` every 20s, with `openEnvelope()` for
   attachments, verified in-browser
7. **Hands-free** — `HandsFree.jsx`: voice read + speech-to-text + signed reply
8. **Call** — `Call.jsx`: WebRTC + signed captions via `FM.sign()`
9. **In-browser verification** — `proveInBrowser(m, pub)`: sha256 of words, number
   derivation, Ed25519 verify via WebCrypto — three proofs redone client-side
10. **FRAYMUS Mail handoff** — `postMessage` identity transfer from the Mail app

**This is the gold standard.** Any new page that needs v16 should follow this pattern.

### 1D. Hive Page — Partial Wiring

**File:** `client/src/pages/Hive.jsx`

| Feature                  | How it works                              | v16 status |
|--------------------------|-------------------------------------------|------------|
| Agent directory          | `/api/directory` every 4s                 | ✅ real    |
| Proofs trail             | `/api/proofs`                             | ✅ real    |
| Signed dispatch          | `window.FRAYMUS.seal()` → `/api/dispatch` | ⚠️ bypasses fraymusMail.js |
| FRAYNIX /feel            | `/api/fraynix/feel`                       | ✅ real    |
| FRAYNIX /verify          | `/api/fraynix/verify` + negative control  | ✅ real    |
| FRAYNIX /bus             | `/api/fraynix/bus` — agent count check    | ✅ real    |
| Voice (ElevenLabs)       | `/api/voice`                              | ✅ real    |
| Visitor identity         | None — uses `window.FRAYMUS` if present   | ❌ missing |

**Key gap:** The Hive page builds packets via `window.FRAYMUS.seal()` (an
external global injected by the phone PWA) rather than using `fraymusMail.js`.
This means:
- No hash-chaining (no `prev` link)
- No protocol-level signing (relies on external FRAYMUS object)
- Doesn't work in a plain browser without the PWA

### 1E. Email Watcher — Working Sidecar

**File:** `scripts/email-watcher/watcher.mjs` + `decode.mjs`

| Feature                  | Status  |
|--------------------------|---------|
| IMAP poll (Gmail)        | ✅ done |
| MIME base64 decode       | ✅ done |
| Emoji → base64 → JSON   | ✅ done |
| Structural sig verify    | ✅ done |
| Merkle proof verify      | ✅ done |
| Timestamp window (24h)   | ✅ done |
| Dispatch to FRAYNIX /feel| ✅ done |
| Dispatch to hive /dispatch| ✅ done |
| Dispatch to mail door    | ✅ done |

The watcher is a standalone process, not integrated into the Academy server.

In this studio repo the Merkle check and the 24-hour timestamp are warnings.
A payload is dispatched when decode and the structural signature check both pass.
The local hub on port 8787 accepts and logs. It does not re-verify Ed25519.

---

## 2. What's Missing

### 2A. No Shared Identity Context

The World page manages identity in its own component state + localStorage.
No other page can access it.

**What this means:**
- The Hive page can't sign messages without `window.FRAYMUS`
- The Screen page talks to agents by name, not by FX number
- No page except World can read the visitor's inbox
- Each new page would have to re-implement the entire identity flow

**Fix:** Extract the World page's identity pattern into a shared React context.

### 2B. Hive Bypasses the Protocol Library

The Hive page's `think()` function (line 249) uses `window.FRAYMUS.seal()` —
an external global — instead of `fraymusMail.js`. This gives it dispatch
capability only when the FRAYMUS PWA has injected its global.

**What this means:**
- No hash-chaining (prev links break)
- Hive doesn't work in a plain browser
- The Hive's signed packets are structurally different from World's

**Fix:** Wire Hive's composer to use `FM.send()` through the shared relay,
same as World does.

### 2C. No Agent Directory in Client State

The `/api/fraynix/bus` endpoint returns all 64 registered agents:
```
{ number, name, pubkey, port, doorbell, skills, head, messages }
```

The `/api/fleet` endpoint returns a filtered list (AI agents only).
The `/api/directory` endpoint returns all identities with verified counts.

But no page caches this in a way other pages can use. Each page fetches
its own copy and stores it locally.

**Fix:** A shared hook (`useFraymusDirectory()`) that caches the bus/fleet
data and exposes agent lookup by number, name, or skill.

### 2D. Screen Page Uses Names, Not Numbers

**File:** `client/src/pages/Screen.jsx`

The Screen page has a hardcoded agent list:
```js
const AGENTS = ['fraymus', 'claudette', 'eyekaughn', 'dev-archivist', 'school-office'];
```

It talks to agents by name via `/api/screen/ask`, which is a separate pathway
that doesn't use v16 at all — no signing, no hash-chain, no FX numbers.

**Fix (optional):** This page serves a different purpose (quick Claude
queries). Converting it to v16 is possible but not necessary — it can stay
as a lightweight unsigned interface for Academy-internal tasks.

### 2E. No Registration Flow in the Academy

`fraymusMail.js` has `register(relay, id, skills)` but no page calls it.
Registration happens externally through FRAYMUS Mail.

**What this means:**
- A new visitor can't onboard from inside the Academy
- The Academy can't register itself as an agent on the hub

**Current flow:**
1. Visitor gets an invite code from the owner
2. Opens FRAYMUS Mail (external app)
3. Pastes invite + name → gets key file download
4. Comes back to Academy World page → loads key file
5. `/api/visitor` lookup confirms they're registered

**Fix (if wanted):** Add an in-app onboard flow that calls `register()`
directly. But this might not be desirable — keeping registration in FRAYMUS
Mail means the Academy never touches unregistered keys.

### 2F. Email Watcher Not Integrated

The watcher runs as a standalone `node watcher.mjs` process. The Academy
server doesn't know about it — no status endpoint, no UI, no way to
see incoming email-carried payloads.

**Fix (optional):** Either:
- Import the watcher's poll loop into the server as a background job
- Or keep it separate with a shared status file/endpoint

---

## 3. The Architecture (How It All Connects)

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER (client/)                                              │
│                                                                 │
│  fraymusMail.js ← complete Ed25519 + hash-chain protocol       │
│       │                                                         │
│       ├── World.jsx ← full visitor flow (sign, send, inbox)    │
│       ├── Call.jsx  ← signed WebRTC captions                   │
│       ├── HandsFree.jsx ← voice + signed reply                 │
│       ├── Hive.jsx  ← uses window.FRAYMUS instead (gap)        │
│       └── Screen.jsx ← no v16 at all (separate pathway)        │
│                                                                 │
│  Every signed request goes through:                             │
│    fetch('/api/visitor', { action, ...body, auth })             │
│  where auth = { number, ts, sig }                               │
└─────────────┬───────────────────────────────────────────────────┘
              │ same-origin HTTP
┌─────────────▼───────────────────────────────────────────────────┐
│  SERVER (server/src/index.js)                                   │
│                                                                 │
│  /api/visitor      → MAIL_DOOR (VPS)                            │
│  /api/dispatch     → HIVE_URL/dispatch (KVM 4)                  │
│  /api/fraynix/*    → FRAYNIX_BRIDGE/* (:8787 local)             │
│  /api/directory    → HIVE_URL/directory                          │
│  /api/fleet        → local worldCache (AI agents only)          │
│  /api/key/:number  → local live.numbers()                       │
│  /api/portal/send  → internal portalSend (owner only)           │
└──────┬──────────────┬──────────────┬────────────────────────────┘
       │              │              │
       ▼              ▼              ▼
  ┌─────────┐  ┌───────────┐  ┌──────────────┐
  │ VPS     │  │ KVM 4     │  │ Mac local    │
  │ mail/api│  │ Hermes    │  │ FRAYNIX :8787│
  │         │  │ 16 agents │  │ /feel /bus   │
  │         │  │ /dispatch │  │ /verify /run │
  │         │  │ /directory│  │ /search      │
  └─────────┘  └───────────┘  └──────────────┘

  ┌─────────────────────────────────────────┐
  │ EMAIL WATCHER (scripts/email-watcher/)  │
  │ Standalone sidecar process              │
  │ Gmail IMAP → emoji decode → dispatch    │
  │ Routes to: FRAYNIX, hive, mail door     │
  └─────────────────────────────────────────┘
```

---

## 4. The Build Plan

### Phase 1: Shared Identity Context (the glue)

Create `client/src/lib/FraymusContext.jsx`:

```
- React context: { visitor, relay, directory, fleet, loading }
- Identity: load from localStorage, validate with checkIdentity()
- Relay: (action, body) => visitorRelay(visitor, action, body)
  - same pattern as World.jsx line 12-17
- Directory: cached /api/fraynix/bus result, refreshed every 60s
- Fleet: cached /api/fleet result
- Helpers: lookupAgent(numberOrName), myNumber(), isRegistered()
```

Wrap `<App>` in `<FraymusProvider>`. Every page gets v16 for free.

### Phase 2: Wire the Hive

Replace `window.FRAYMUS.seal()` in Hive's `think()` with:
```js
const { visitor, relay } = useFraymus();
await FM.send(relay, visitor, toNumber, body);
```

This gives the Hive hash-chaining, proper signing, and works without the PWA.

### Phase 3: Agent Directory Hook

Create `useFraymusDirectory()`:
- Fetches `/api/fraynix/bus` (all 64 agents with FX numbers, pubkeys, skills)
- Caches in context, refreshes on demand
- Exposes: `agents`, `byNumber(fx)`, `byName(name)`, `bySkill(skill)`

This lets any page resolve agent names ↔ FX numbers without hardcoding.

### Phase 4 (optional): Email Watcher Status

Add a `/api/watcher/status` endpoint that the watcher updates (a simple
JSON file or in-memory state). The Hive page shows a green dot when the
watcher is polling.

---

## 5. What NOT to Change

- **fraymusMail.js** — the protocol library is complete and proven. Don't touch it.
- **Server proxy routes** — all three backends are correctly proxied. Don't add
  new proxy paths unless a new backend door appears.
- **World.jsx visitor flow** — it's the reference implementation. The new context
  extracts from it; it doesn't replace it.
- **Screen.jsx** — it serves a different purpose (quick queries). Leave it unsigned
  unless there's a reason to convert.
- **Owner-key boundary** — the Academy NEVER signs as the owner (fx-0601). Visitors
  sign with their own keys. The portal signs with its own key. Relays are not
  authorization.

---

## 6. Security Invariants

These are non-negotiable, carried from the protocol:

1. **Keys stay in the browser.** The server relay sees signed requests, never
   a private key. (`fraymusMail.js` header: "the server relay only ever sees
   signed requests, never a private key")

2. **Hub tokens stay on the owner's Mac.** FRAYMUS_TOKEN and FRAYMUS_RO_TOKEN
   are never in code, git, or chat.

3. **Owner-key boundary.** Never sign or post as the owner (fx-0601/fx-5066)
   without the owner's own signed go. Relays ≠ authorization.

4. **Fail-closed dispatch.** The email watcher's pipeline: payloads that don't
   pass decode + sig verification never touch the network.

5. **Verify everything client-side.** `checkMessage()` re-derives number from
   pubkey, re-hashes payload, re-verifies signature. Nothing from the hub is
   taken on trust. (`fraymusMail.js:127`: "Every check is recomputed here;
   nothing from the hub is taken on trust.")

---

## 7. The 64 Agents on the Hub

As of 2026-10-17, the FRAYNIX `/bus` endpoint reports 64 registered agents.
Key ones for Academy integration:

| FX Number              | Name                | Where        |
|------------------------|---------------------|--------------|
| fx-0601-...            | owner               | Mac/VPS      |
| fx-87b6-...            | NILES               | MacBook-Pro  |
| fx-4041-...            | claude-code         | Mac          |
| fx-b3af-...            | Fraymus (main)      | OpenClaw     |
| fx-229c-...            | Academy Registrar   | Academy      |
| fx-afbb-...            | FRAY                | —            |
| fx-b225-...            | NILES               | Windows      |

The full list is available via `POST /api/fraynix/bus {}` → `response.agents[]`.

---

## 8. File Map

```
client/src/
  lib/
    fraymusMail.js        ← protocol library (DON'T TOUCH)
    FraymusContext.jsx     ← TO BUILD: shared identity + relay + directory
  pages/
    World.jsx             ← reference: full visitor flow
    Hive.jsx              ← TO WIRE: replace window.FRAYMUS with context
    Call.jsx              ← already uses FM.sign()
    HandsFree.jsx         ← already uses FM.send() via World's relay
    Screen.jsx            ← leave as-is (unsigned, separate purpose)
    Proofs.jsx            ← read-only, no identity needed
    Doc.jsx               ← read-only, no identity needed
    Experiment.jsx        ← TBD

server/src/
  index.js                ← proxy layer (DON'T TOUCH unless new backend door)

scripts/email-watcher/
  watcher.mjs             ← standalone sidecar (working in this repo)
  decode.mjs              ← emoji decode + verify pipeline
  hub.mjs                 ← local stand-in on 127.0.0.1:8787
```

---

*The protocol is built. The server is wired. The reference implementation
exists. What's left is plumbing: a shared context that makes what World.jsx
already does available to every page.*
