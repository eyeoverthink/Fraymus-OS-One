export const TALK_FPS = 12;
export const TALK_HOP = 1 / TALK_FPS;

export const MOUTH_CELLS = [
  {
    id: "closed",
    note: "Same person, same hat, same clothes, same framing, solid black background. Mouth fully closed. Do not redesign the face."
  },
  {
    id: "mid",
    note: "Same person, same hat, same clothes, same framing, solid black background. Mouth slightly open, as if speaking one short word. Do not redesign the face."
  },
  {
    id: "open",
    note: "Same person, same hat, same clothes, same framing, solid black background. Mouth open mid-word. Do not redesign the face."
  },
  {
    id: "blink",
    note: "Same person, same hat, same clothes, same framing, solid black background. Eyes closed in one blink, mouth closed. Do not redesign the face."
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
  if (level < 0.12 && blinkSlot === 0) return "blink";
  if (level < 0.18) return "closed";
  if (noise) return level > 0.55 ? "mid" : "closed";
  if (level < 0.42) return "mid";
  return "open";
}

export function lineSchedule(lines, gap = LINE_GAP) {
  let cursor = 0;
  const captions = lines.map((line, index) => {
    const start = cursor;
    const end = start + line.audio.duration;
    cursor = end + (index < lines.length - 1 ? gap : 0);
    return { start, end, text: line.text, envelope: line.envelope };
  });
  return { duration: cursor, captions };
}

export function frameAt(captions, time) {
  const line = captions.find((item) => time >= item.start && time < item.end);
  if (line) return { id: mouthAt(line.envelope, time - line.start), text: line.text };
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
