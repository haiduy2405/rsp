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
  function degree(tr, d) {
    const len = tr.scale.length;
    const oct = Math.floor(d / len);
    return tr.root + tr.scale[((d % len) + len) % len] + 12 * oct;
  }

  // Bộ xếp lịch nhìn trước: mỗi 25ms xếp các nốt trong 120ms tới.
  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!ac || !track || ac.state !== 'running') return;
    const tr = cfg.tracks[track];
    const stepDur = 60 / tr.bpm / 4;
    if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.05;
    while (nextTime < ac.currentTime + 0.12) {
      const i = step % 16;
      const l = tr.lead.steps[i];
      if (l != null) tone(musicBus, nextTime, midi(degree(tr, l) + 12), midi(degree(tr, l) + 12), stepDur * 1.8, tr.lead.wave, tr.lead.gain);
      const b = tr.bass.steps[i];
      if (b != null) tone(musicBus, nextTime, midi(degree(tr, b)), midi(degree(tr, b)), stepDur * 1.8, tr.bass.wave, tr.bass.gain);
      if (tr.hat[i] === 'x') noise(musicBus, nextTime, 0.04, 0.12);
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
