// Thin client for the Fraymus OS One studio server (server/index.js).
export function studioBase() {
  return (process.env.FRAYMUS_STUDIO_URL || `http://127.0.0.1:${process.env.FRAYMUS_PORT || 4177}`).replace(/\/+$/, "");
}

export class StudioError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function studio(method, route, { json, raw, headers = {}, timeout = 60000, binary = false } = {}) {
  const init = { method, headers: { ...headers }, signal: AbortSignal.timeout(timeout) };
  if (json !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  } else if (raw !== undefined) {
    init.headers["Content-Type"] = init.headers["Content-Type"] || "application/octet-stream";
    init.body = raw;
  }
  let res;
  try {
    res = await fetch(studioBase() + route, init);
  } catch (error) {
    throw new StudioError(`Studio not reachable at ${studioBase()} (${error.cause?.code || error.message}). Start it with "npm start" in the repo root.`, 0);
  }
  const type = res.headers.get("content-type") || "";
  if (!res.ok) {
    let message = `${method} ${route} returned ${res.status}`;
    try {
      const body = type.includes("json") ? await res.json() : { error: (await res.text()).slice(0, 300) };
      if (body?.error) message += `: ${body.error}`;
    } catch { /* keep the status line */ }
    throw new StudioError(message, res.status);
  }
  if (binary) return { type, bytes: Buffer.from(await res.arrayBuffer()) };
  return type.includes("json") ? res.json() : res.text();
}
