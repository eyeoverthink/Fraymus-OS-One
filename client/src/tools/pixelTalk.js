export const TALK_FPS = 12;
export const TALK_HOP = 1 / TALK_FPS;

export const MOUTH_CELLS = [
  {
    id: "closed",
    note: "Same person, same hair, same clothes, same framing, solid black background. Mouth fully closed. Do not redesign the face."
  },
  {
    id: "mid",
    note: "Change only the mouth. Lips clearly apart, a dark oval opening as wide as the nose, no teeth. Same eyes, hair, beard, shirt, framing, and black background."
  },
  {
    id: "open",
    note: "Change only the mouth. Jaw lowered, mouth wide open, big black mouth interior, white upper teeth. Same eyes, hair, beard, shirt, framing, and black background."
  },
  {
    id: "blink",
    note: "Same person, same hair, same clothes, same framing, solid black background. Eyes closed in one blink, mouth closed. Do not redesign the face."
  }
];

export const LINE_GAP = 0.35;

export function voiceEnvelope(audioBuffer, hop = TALK_HOP) {
  const channel = audioBuffer.getChannelData(0);
  const hopSamples = Math.max(1, Math.round(hop * audioBuffer.sampleRate));
  const bins = [];
  for (let i = 0; i < channel.length; i += hopSamples) {
    let sum = 0;
    let crosses = 0;
    let prev = channel[i] || 0;
    const end = Math.min(channel.length, i + hopSamples);
    for (let j = i; j < end; j += 1) {
      const sample = channel[j];
      sum += sample * sample;
      if ((sample >= 0 && prev < 0) || (sample < 0 && prev >= 0)) crosses += 1;
      prev = sample;
    }
    const count = Math.max(1, end - i);
    bins.push({ rms: Math.sqrt(sum / count), zcr: crosses / count });
  }
  const sorted = bins.map((bin) => bin.rms).sort((a, b) => a - b);
  const peak = sorted[Math.floor(sorted.length * 0.9)] || 1;
  return bins.map((bin) => ({ level: bin.rms / peak, noise: bin.zcr > 0.08 }));
}

export function mouthAt(envelope, time, hop = TALK_HOP) {
  if (!envelope.length) return "closed";
  const index = Math.min(envelope.length - 1, Math.max(0, Math.floor(time / hop)));
  const bin = envelope[index] || { level: 0, noise: false };
  const level = typeof bin === "number" ? bin : bin.level;
  const noise = typeof bin === "number" ? false : Boolean(bin.noise);
  const blinkSlot = Math.floor(time / hop) % Math.round(3.2 / hop);
  if (level < 0.12 && blinkSlot < 2) return "blink";
  if (level < 0.18) return "closed";
  if (noise) return level > 0.22 ? "mid" : "closed";
  if (level < 0.42) return "mid";
  return "open";
}

export function lineSchedule(lines, gap = LINE_GAP) {
  let cursor = 0;
  const captions = lines.map((line, index) => {
    const start = cursor;
    const end = start + line.audio.duration;
    cursor = end + (index < lines.length - 1 ? gap : 0);
    return { start, end, text: line.text, envelope: line.envelope, hold: line.hold || "auto" };
  });
  return { duration: cursor, captions };
}

function voicedSpan(envelope, hop) {
  let first = 0;
  let last = envelope.length;
  const quiet = (bin) => (typeof bin === "number" ? bin : bin.level) < 0.18;
  while (first < envelope.length && quiet(envelope[first])) first += 1;
  while (last > first && quiet(envelope[last - 1])) last -= 1;
  return { start: first * hop, end: Math.max((first + 1) * hop, last * hop) };
}

function wordAt(text, envelope, time, hop) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const span = voicedSpan(envelope, hop);
  const weights = words.map((word) => Math.max(1, word.replace(/[^a-z]/gi, "").length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = span.start;
  for (let i = 0; i < words.length; i += 1) {
    const width = ((span.end - span.start) * weights[i]) / total;
    const end = cursor + width * 0.9;
    if (time >= cursor && time < cursor + width) {
      return time < end ? words[i] : "";
    }
    cursor += width;
  }
  return "";
}

export function frameAt(captions, time) {
  const line = captions.find((item) => time >= item.start && time < item.end);
  if (line) {
    const local = time - line.start;
    if (line.hold && line.hold !== "auto") return { id: line.hold, text: line.text };
    const energy = mouthAt(line.envelope, local);
    if (energy === "blink") return { id: "blink", text: line.text };
    const word = wordAt(line.text, line.envelope, local, TALK_HOP);
    if (word === "") return { id: "closed", text: line.text };
    const vowels = (word.match(/[aeiouy]/gi) || []).length;
    let id = energy;
    if (word && energy === "closed") id = "mid";
    if (word && (vowels >= 2 || word.length > 4) && energy !== "closed") id = "open";
    return { id, text: line.text };
  }
  const upcoming = captions.find((item) => time < item.start);
  return { id: "closed", text: upcoming?.text || captions[captions.length - 1]?.text || "" };
}

export function talkMime() {
  return ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9", "video/webm"].find((type) => {
    try {
      return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  }) || "";
}
