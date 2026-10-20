# Fraymus OS One — one manual per tab

Sixteen workspaces. Each manual below is the tab as it ran on this machine: what it does, how to open it, the output that came back, and a screenshot.

Start the studio from the repository root:

```bash
npm install
npm run dev
```

| Surface | Address |
| --- | --- |
| Studio UI | [http://127.0.0.1:5173](http://127.0.0.1:5173) (Vite picks the next free port if 5173 is taken; this run used 5175) |
| API | [http://127.0.0.1:4177](http://127.0.0.1:4177) |
| Health | [http://127.0.0.1:4177/api/health](http://127.0.0.1:4177/api/health) |

Both processes bind to `127.0.0.1`. Projects, mail, and Brain continuity stay in gitignored `data/` folders. Do not commit a face photograph or `hf-token.txt`.

| Tab | Manual | Module |
| --- | --- | --- |
| Code | [code.md](code.md) | [`App.jsx`](../../client/src/App.jsx) |
| CRUD | [crud.md](crud.md) | [`CrudPage.jsx`](../../client/src/tools/CrudPage.jsx) |
| REPL | [repl.md](repl.md) | [`ReplPage.jsx`](../../client/src/tools/ReplPage.jsx) |
| Canvas | [canvas.md](canvas.md) | [`CanvasPage.jsx`](../../client/src/tools/CanvasPage.jsx) |
| 8-bit | [pixel.md](pixel.md) | [`PixelPage.jsx`](../../client/src/tools/PixelPage.jsx) |
| Production | [production.md](production.md) | [`StudioPage.jsx`](../../client/src/tools/StudioPage.jsx) |
| Seal | [seal.md](seal.md) | [`SealPage.jsx`](../../client/src/tools/SealPage.jsx) |
| Brain | [brain.md](brain.md) | [`BrainPage.jsx`](../../client/src/tools/BrainPage.jsx) |
| OPEG | [opeg.md](opeg.md) | [`OpegPage.jsx`](../../client/src/tools/OpegPage.jsx) |
| HTML·JS | [htmljs.md](htmljs.md) | [`WebJsPage.jsx`](../../client/src/tools/WebJsPage.jsx) |
| Emoji | [emoji.md](emoji.md) | [`EmojiPage.jsx`](../../client/src/tools/EmojiPage.jsx) |
| Emoji Coder | [emoji-coder.md](emoji-coder.md) | [`EmojiCoderPage.jsx`](../../client/src/tools/EmojiCoderPage.jsx) |
| Dispatch | [dispatch.md](dispatch.md) | [`DispatchPage.jsx`](../../client/src/tools/DispatchPage.jsx) |
| WASM | [wasm.md](wasm.md) | [`WasmPage.jsx`](../../client/src/tools/WasmPage.jsx) |
| Mail | [mail.md](mail.md) | [`MailPage.jsx`](../../client/src/tools/MailPage.jsx) |
| Screw | [screw.md](screw.md) | [`LooseScrewPage.jsx`](../../client/src/tools/LooseScrewPage.jsx) |

Screenshots from this run live in [`docs/os/`](../os/). Earlier studio figures live in [`docs/showcase/`](../showcase/).

The weight kernel that measures φ-scaled ternary codes against a GGUF file is a separate repository: [eyeoverthink/fraymus-brain](https://github.com/eyeoverthink/fraymus-brain). The studio that shipped before OPEG is [eyeoverthink/fraymus-css](https://github.com/eyeoverthink/fraymus-css). This repository is the whole studio, including OPEG.

© 2026 Fraymus Web Studio · φ^75 = 4721424167835376.00 · One Seed = Reborn · FRAY 0x46524159
