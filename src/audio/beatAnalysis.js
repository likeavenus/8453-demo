const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const quantile = (values, amount) => {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * amount;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const mix = index - lower;

  return sorted[lower] * (1 - mix) + sorted[upper] * mix;
};

const renderBand = async (buffer, minimumHz, maximumHz) => {
  const OfflineContext =
    window.OfflineAudioContext || window.webkitOfflineAudioContext;

  if (!OfflineContext) return buffer;

  const context = new OfflineContext(1, buffer.length, buffer.sampleRate);
  const source = context.createBufferSource();
  const highPass = context.createBiquadFilter();
  const lowPass = context.createBiquadFilter();

  source.buffer = buffer;
  highPass.type = "highpass";
  highPass.frequency.value = minimumHz;
  highPass.Q.value = 0.707;
  lowPass.type = "lowpass";
  lowPass.frequency.value = maximumHz;
  lowPass.Q.value = 0.707;

  source.connect(highPass).connect(lowPass).connect(context.destination);
  source.start(0);

  return context.startRendering();
};

const detectBandOnsets = async (
  audioBuffer,
  {
    type,
    minimumHz,
    maximumHz,
    frameSize,
    hopSize = 256,
    sensitivity,
    energyQuantile,
    minimumInterval,
    strengthScale = 1,
  }
) => {
  const bandBuffer = await renderBand(audioBuffer, minimumHz, maximumHz);
  const data = bandBuffer.getChannelData(0);
  const sampleRate = bandBuffer.sampleRate;
  const frameCount = Math.max(
    0,
    Math.floor((data.length - frameSize) / hopSize) + 1
  );
  const energy = new Float32Array(frameCount);
  const novelty = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * hopSize;
    let sumSquares = 0;

    for (let offset = 0; offset < frameSize; offset += 1) {
      const sample = data[start + offset];
      sumSquares += sample * sample;
    }

    energy[frame] = Math.log1p(Math.sqrt(sumSquares / frameSize) * 80);
  }

  for (let frame = 4; frame < frameCount; frame += 1) {
    const recentEnergy =
      (energy[frame - 1] +
        energy[frame - 2] +
        energy[frame - 3] +
        energy[frame - 4]) /
      4;
    novelty[frame] = Math.max(0, energy[frame] - recentEnergy);
  }

  const historyFrames = Math.max(12, Math.round(sampleRate / hopSize));
  const globalFloor = quantile(Array.from(novelty), 0.64) * 0.5;
  const energyFloor = quantile(Array.from(energy), energyQuantile);
  const rawOnsets = [];
  let historySum = 0;
  let historySquares = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const historyStart = frame - historyFrames;

    if (frame > 0) {
      const added = novelty[frame - 1];
      historySum += added;
      historySquares += added * added;
    }

    if (historyStart > 0) {
      const removed = novelty[historyStart - 1];
      historySum -= removed;
      historySquares -= removed * removed;
    }

    const historyLength = Math.min(frame, historyFrames);
    if (historyLength < 8) continue;

    const mean = historySum / historyLength;
    const variance = Math.max(
      0,
      historySquares / historyLength - mean * mean
    );
    const deviation = Math.sqrt(variance);
    const threshold = Math.max(globalFloor, mean + deviation * sensitivity);
    const value = novelty[frame];
    const isLocalMaximum =
      value >= (novelty[frame - 1] || 0) &&
      value > (novelty[frame + 1] || 0) &&
      value >= (novelty[frame - 2] || 0) &&
      value > (novelty[frame + 2] || 0);

    if (
      isLocalMaximum &&
      value > threshold &&
      energy[frame] > energyFloor
    ) {
      rawOnsets.push({
        type,
        time: (frame * hopSize + frameSize * 0.5) / sampleRate,
        rawStrength: (value / Math.max(threshold, 0.0001)) * strengthScale,
      });
    }
  }

  const separated = [];

  for (const onset of rawOnsets) {
    const previous = separated.at(-1);

    if (!previous || onset.time - previous.time >= minimumInterval) {
      separated.push(onset);
    } else if (onset.rawStrength > previous.rawStrength) {
      separated[separated.length - 1] = onset;
    }
  }

  const strengths = separated.map((onset) => onset.rawStrength);
  const weak = quantile(strengths, 0.18);
  const strong = Math.max(weak + 0.001, quantile(strengths, 0.92));

  return separated.map(({ time, rawStrength }) => ({
    type,
    time,
    strength:
      0.48 + clamp((rawStrength - weak) / (strong - weak), 0, 1) * 0.52,
  }));
};

const mergePercussion = (kickOnsets, clapOnsets) => {
  const all = [...kickOnsets, ...clapOnsets].sort((a, b) => a.time - b.time);
  const merged = [];
  const mergeWindow = 0.075;

  for (const onset of all) {
    const previous = merged.at(-1);

    if (!previous || onset.time - previous.time > mergeWindow) {
      merged.push({ ...onset });
      continue;
    }

    previous.type = previous.type === onset.type ? previous.type : "both";
    if (onset.strength > previous.strength) previous.time = onset.time;
    previous.strength = Math.max(previous.strength, onset.strength);
  }

  return merged;
};

const estimateTempo = (onsets) => {
  if (onsets.length < 4) return null;

  const histogram = new Float32Array(161);

  for (let index = 1; index < onsets.length; index += 1) {
    const interval = onsets[index].time - onsets[index - 1].time;
    if (interval <= 0 || interval > 2) continue;

    let bpm = 60 / interval;
    while (bpm < 80) bpm *= 2;
    while (bpm > 160) bpm /= 2;
    histogram[Math.round(bpm)] += onsets[index].strength;
  }

  let bestBin = 0;
  let bestScore = 0;

  for (let bpm = 80; bpm <= 160; bpm += 1) {
    const score =
      histogram[bpm] +
      (histogram[bpm - 1] || 0) * 0.5 +
      (histogram[bpm + 1] || 0) * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestBin = bpm;
    }
  }

  return bestBin || null;
};

export const analyzePercussionOnsets = async (audioBuffer) => {
  const [kickOnsets, clapOnsets] = await Promise.all([
    detectBandOnsets(audioBuffer, {
      type: "kick",
      minimumHz: 35,
      maximumHz: 190,
      frameSize: 1024,
      sensitivity: 1.25,
      energyQuantile: 0.34,
      minimumInterval: 0.14,
    }),
    detectBandOnsets(audioBuffer, {
      type: "clap",
      minimumHz: 750,
      maximumHz: 5200,
      frameSize: 512,
      sensitivity: 1.62,
      energyQuantile: 0.52,
      minimumInterval: 0.16,
      strengthScale: 0.88,
    }),
  ]);
  const onsets = mergePercussion(kickOnsets, clapOnsets);

  return {
    duration: audioBuffer.duration,
    bpm: estimateTempo(kickOnsets),
    kickCount: kickOnsets.length,
    clapCount: clapOnsets.length,
    onsets,
  };
};
