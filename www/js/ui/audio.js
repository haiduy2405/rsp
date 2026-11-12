// Âm thanh sinh bằng WebAudio (không file, không giấy phép). Dữ liệu giai điệu/SFX: data/audio.json.
// Chỉ phát sau cử chỉ người dùng đầu tiên (chính sách trình duyệt). Tự dừng khi app ẩn.
export function createAudio(cfg, settings) {
  let ac = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let track = null; // tên bài đang phát
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let noiseBuf = null;

  const Ctor = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;

  const vol = () => Math.max(0, Math.min(1, (settings.volume ?? 80) / 100));
  function applyGains() {
    if (!ac) return;
    master.gain.value = cfg.master * vol();
    musicBus.gain.value = settings.music === false ? 0 : cfg.musicGain;
    sfxBus.gain.value = settings.sfx === false ? 0 : cfg.sfxGain;
  }

  // Gọi trong handler của cử chỉ người dùng.
  function unlock() {
    if (!Ctor) return;
    if (!ac) {
      ac = new Ctor();
      master = ac.createGain();
      musicBus = ac.createGain();
      sfxBus = ac.createGain();
      musicBus.connect(master);
      sfxBus.connect(master);
      master.connect(ac.destination);
      const len = ac.sampleRate * 0.3;
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let s = 12345; // nhiễu tất định, không cần Math.random
      for (let i = 0; i < len; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        d[i] = (s / 4294967296) * 2 - 1;
      }
      applyGains();
      loadSamples();
    }
    if (ac.state === 'suspended' && !document.hidden) ac.resume();
    if (track && !timer) schedule();
  }

  function tone(bus, t0, f0, f1, dur, wave, gain) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  function noise(bus, t0, dur, gain) {
    const src = ac.createBufferSource();
    const g = ac.createGain();
    src.buffer = noiseBuf;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(g);
    g.connect(bus);
    src.start(t0);
    src.stop(t0 + Math.min(dur, 0.3));
  }

  // Mẫu âm (CC0) giải mã sẵn; thiếu mẫu thì dùng synth dự phòng.
  const bufs = {};
  async function loadSamples() {
    if (!ac || !cfg.samples) return;
    await Promise.all(Object.entries(cfg.samples).map(async ([k, v]) => {
      if (bufs[k]) return;
      try {
        const r = await fetch(v.url);
        bufs[k] = await ac.decodeAudioData(await r.arrayBuffer());
      } catch {
        /* dùng synth */
      }
    }));
  }
  function sample(name, rateMul) {
    const b = bufs[name];
    if (!b) return false;
    const v = cfg.samples[name];
    const src = ac.createBufferSource();
    const g = ac.createGain();
    src.buffer = b;
    src.playbackRate.value = (v.rate || 1) * rateMul;
    g.gain.value = v.gain ?? 1;
    src.connect(g);
    g.connect(sfxBus);
    src.start(ac.currentTime + 0.003);
    return true;
  }

  function sfx(name, rateMul = 1) {
    if (!ac || settings.sfx === false || ac.state !== 'running') return;
    if (sample(name, rateMul)) return;
    const def = cfg.sfx[name];
    if (!def) return;
    const t0 = ac.currentTime + 0.005;
    for (const n of def) {
      if (n.noise) noise(sfxBus, t0 + n.t, n.dur, n.gain);
      else tone(sfxBus, t0 + n.t, n.f0, n.f1, n.dur, n.wave, n.gain);
    }
  }

  const midi = (m) => 440 * 2 ** ((m - 69) / 12);
  // Bậc thang âm (có thể vượt quá 1 quãng tám) -> số nốt MIDI.
  function degree(tr, d) {
    const len = tr.scale.length;
    const oct = Math.floor(d / len);
    return tr.root + tr.scale[((d % len) + len) % len] + 12 * oct;
  }
  const digit = (c) => (c === '.' || c === undefined ? null : parseInt(c, 36));

  // Vang (reverb) tạo từ nhiễu tắt dần, tất định.
  let reverbIn = null;
  function ensureReverb() {
    if (reverbIn || !ac) return;
    const len = Math.floor(ac.sampleRate * 1.9);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let seed = 777 + ch * 131;
      for (let k = 0; k < len; k++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        d[k] = ((seed / 4294967296) * 2 - 1) * (1 - k / len) ** 2.6;
      }
    }
    const conv = ac.createConvolver();
    conv.buffer = buf;
    reverbIn = ac.createGain();
    reverbIn.gain.value = 1;
    reverbIn.connect(conv);
    conv.connect(musicBus);
  }

  // Giọng nhạc: mọi giọng đi qua lọc thấp, có gửi vang riêng.
  function voice(t0, f, dur, o) {
    const g = ac.createGain();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(o.cut ?? 3000, t0);
    if (o.cutTo) lp.frequency.exponentialRampToValueAtTime(o.cutTo, t0 + dur);
    const a = o.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t0 + a);
    g.gain.setValueAtTime(Math.max(0.0002, o.gain * (o.sustain ?? 0.6)), t0 + Math.max(a + 0.001, dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    lp.connect(g);
    g.connect(musicBus);
    if (o.reverb && reverbIn) {
      const send = ac.createGain();
      send.gain.value = o.reverb;
      g.connect(send);
      send.connect(reverbIn);
    }
    for (const det of o.detune || [0]) {
      const osc = ac.createOscillator();
      osc.type = o.wave;
      osc.frequency.setValueAtTime(f, t0);
      osc.detune.value = det;
      osc.connect(lp);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }
  }
  function kick(t0, gain) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t0);
    o.frequency.exponentialRampToValueAtTime(42, t0 + 0.13);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    o.connect(g);
    g.connect(musicBus);
    o.start(t0);
    o.stop(t0 + 0.25);
  }
  function filteredNoise(t0, dur, gain, type, freq) {
    const src = ac.createBufferSource();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    src.buffer = noiseBuf;
    f.type = type;
    f.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(musicBus);
    src.start(t0);
    src.stop(t0 + Math.min(dur, 0.3));
  }

  // Xếp lịch một nhịp 1/16 của bài. Cấu trúc: hợp âm (pad), rải (arp), giai điệu (lead), bè trầm, trống.
  function playStep(tr, n, t0, stepDur) {
    const bar = Math.floor(n / 16) % tr.chords.length;
    const i = n % 16;
    const root = tr.chords[bar];
    const tones = [root, root + 2, root + 4, root + 7];
    const barDur = stepDur * 16;
    if (i === 0) {
      for (const d of tones.slice(0, 3)) voice(t0, midi(degree(tr, d)), barDur * 1.02, { wave: tr.padWave, gain: tr.padGain, cut: tr.padCut, attack: 0.35, sustain: 0.85, detune: [-8, 8], reverb: tr.reverb });
    }
    const ap = digit(tr.arp.pattern[i]);
    if (ap != null) voice(t0, midi(degree(tr, tones[ap % 4]) + 12), stepDur * 2.2, { wave: tr.arp.wave, gain: tr.arp.gain, cut: tr.arp.cut, cutTo: 500, reverb: tr.reverb });
    const ld = digit(tr.lead.bars[bar % tr.lead.bars.length][i]);
    if (ld != null) {
      let len = 1;
      while (len < 8 && tr.lead.bars[bar % tr.lead.bars.length][i + len] === '.' && i + len < 16) len++;
      voice(t0, midi(degree(tr, ld) + tr.lead.octave), stepDur * Math.min(len, 4) * 0.95, { wave: tr.lead.wave, gain: tr.lead.gain, cut: tr.lead.cut, attack: 0.012, sustain: 0.7, detune: [-5, 5], reverb: tr.reverb });
    }
    if (tr.bass.pattern[i] !== '.') voice(t0, midi(degree(tr, root) - 12), stepDur * 1.7, { wave: tr.bass.wave, gain: tr.bass.gain, cut: tr.bass.cut ?? 700, sustain: 0.8 });
    const d = tr.drums;
    if (d.kick?.[i] === 'x') kick(t0, 0.5);
    if (d.snare?.[i] === 'x') {
      filteredNoise(t0, 0.14, 0.22, 'highpass', 1800);
      voice(t0, 190, 0.09, { wave: 'triangle', gain: 0.2, cut: 1200 });
    }
    if (d.hat?.[i] === 'x') filteredNoise(t0, 0.04, 0.09, 'highpass', 7000);
    if (d.shaker?.[i] === 'x') filteredNoise(t0, 0.05, 0.04, 'bandpass', 5000);
  }

  // Bộ xếp lịch nhìn trước: mỗi 25ms xếp các nốt trong 120ms tới.
  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!ac || !track || ac.state !== 'running') return;
    ensureReverb();
    const tr = cfg.tracks[track];
    const stepDur = 60 / tr.bpm / 4;
    if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.05;
    while (nextTime < ac.currentTime + 0.12) {
      playStep(tr, step, nextTime, stepDur);
      nextTime += stepDur;
      step++;
    }
    timer = setTimeout(schedule, 25);
  }

  function playMusic(name) {
    if (name === track) return;
    track = name && cfg.tracks[name] ? name : null;
    step = 0;
    nextTime = 0;
    clearTimeout(timer);
    timer = null;
    if (track && ac) schedule();
  }

  function vibrate(ms) {
    if (settings.haptic === false) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* bỏ qua */
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!ac) return;
      if (document.hidden) {
        clearTimeout(timer);
        timer = null;
        ac.suspend();
      } else ac.resume().then(() => track && schedule());
    });
  }

  return { unlock, sfx, playMusic, applyGains, vibrate, get track() { return track; } };
}
