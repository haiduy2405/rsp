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
  let fileMode = false; // đang phát nhạc từ file (không chạy bộ xếp lịch synth)
  const musicBufs = new Map(); // bài file đã giải mã (giữ tối đa 3 để đỡ tốn RAM)
  const musicFail = new Set(); // bài tải lỗi → dùng bản tự sinh
  let outBus = null; // bus riêng của bài đang phát (mờ dần khi đổi bài)

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
    if (track && !timer) begin();
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
    const vs = cfg.variants?.[name];
    // Âm có vài biến thể thì chọn ngẫu nhiên để đỡ lặp (UI, không ảnh hưởng lõi).
    if (sample(vs ? vs[Math.floor(Math.random() * vs.length)] : name, rateMul)) return;
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
    g.connect(outBus);
    if (o.reverb && reverbIn) {
      const send = ac.createGain();
      send.gain.value = o.reverb;
      g.connect(send);
      send.connect(reverbIn);
    }
    let lfo = null;
    let lfoG = null;
    if (o.vib) {
      lfo = ac.createOscillator();
      lfoG = ac.createGain();
      lfo.frequency.value = 5.2;
      lfoG.gain.setValueAtTime(0, t0);
      lfoG.gain.linearRampToValueAtTime(o.vib, t0 + Math.min(0.25, dur * 0.6)); // rung dần vào, không rung ngay đầu nốt
      lfo.connect(lfoG);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    for (const det of o.detune || [0]) {
      for (const [mul, amp] of o.partials || [[1, 1]]) {
        const osc = ac.createOscillator();
        osc.type = o.wave;
        osc.frequency.setValueAtTime(f * mul, t0);
        osc.detune.value = det;
        if (lfoG) lfoG.connect(osc.detune);
        if (amp === 1) osc.connect(lp);
        else {
          const pg = ac.createGain();
          pg.gain.value = amp;
          osc.connect(pg);
          pg.connect(lp);
        }
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      }
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
    g.connect(outBus);
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
    g.connect(outBus);
    src.start(t0);
    src.stop(t0 + Math.min(dur, 0.3));
  }

  // Xếp lịch một nhịp 1/16 của bài. Cấu trúc: hợp âm (pad), rải (arp), giai điệu (lead), bè hòa (harm), bè trầm, trống.
  // tr.form[bar] = các lớp đang bật trong ô nhịp đó (p pad, a arp, l lead, h bè hòa, b trầm, d trống): tạo đoạn dạo, cao trào.
  function playStep(tr, n, t0, stepDur) {
    const bars = tr.chords.length;
    const bar = Math.floor(n / 16) % bars;
    const i = n % 16;
    const layers = tr.form?.[bar % tr.form.length] ?? 'palhbd';
    const on = (c) => layers.includes(c);
    const root = tr.chords[bar];
    const tones = [root, root + 2, root + 4, root + 7];
    const barDur = stepDur * 16;
    if (i === 0 && on('p')) {
      for (const d of tones.slice(0, 3)) voice(t0, midi(degree(tr, d)), barDur * 1.02, { wave: tr.padWave, gain: tr.padGain, cut: tr.padCut, attack: tr.padAttack ?? 0.35, sustain: 0.85, detune: [-8, 8], reverb: tr.reverb });
    }
    const ap = on('a') ? digit(tr.arp.pattern[i]) : null;
    if (ap != null) voice(t0, midi(degree(tr, tones[ap % 4]) + 12), stepDur * (tr.arp.len ?? 2.2), { wave: tr.arp.wave, gain: tr.arp.gain, cut: tr.arp.cut, cutTo: 500, sustain: tr.arp.sustain, partials: tr.arp.partials, reverb: tr.reverb });
    const lb = tr.lead.bars[bar % tr.lead.bars.length];
    const ld = on('l') ? digit(lb[i]) : null;
    if (ld != null) {
      let len = 1;
      while (len < 8 && lb[i + len] === '.' && i + len < 16) len++;
      const dur = stepDur * Math.min(len, tr.lead.maxLen ?? 4) * 0.95;
      const lo = { wave: tr.lead.wave, gain: tr.lead.gain, cut: tr.lead.cut, attack: tr.lead.attack ?? 0.012, sustain: tr.lead.sustain ?? 0.7, detune: [-5, 5], vib: tr.lead.vib, partials: tr.lead.partials, reverb: tr.reverb };
      voice(t0, midi(degree(tr, ld) + tr.lead.octave), dur, lo);
      if (tr.harm && on('h')) voice(t0, midi(degree(tr, ld - (tr.harm.below ?? 2)) + tr.lead.octave), dur, { wave: tr.harm.wave, gain: tr.harm.gain, cut: tr.harm.cut ?? tr.lead.cut, attack: 0.02, sustain: 0.6, reverb: tr.reverb });
    }
    const bp = tr.bass.bars ? tr.bass.bars[bar % tr.bass.bars.length] : tr.bass.pattern;
    if (on('b') && bp[i] !== '.') voice(t0, midi(degree(tr, root + (bp[i] === '5' ? 4 : 0)) - 12), stepDur * 1.7, { wave: tr.bass.wave, gain: tr.bass.gain, cut: tr.bass.cut ?? 700, sustain: 0.8 });
    if (!on('d')) return;
    const d = tr.drums;
    const fill = tr.fill && bar === bars - 1 && i >= 12; // cuối vòng: dồn trống dẫn vào vòng mới
    if (d.kick?.[i] === 'x' && !(fill && i > 12)) kick(t0, 0.5);
    if (d.snare?.[i] === 'x' || fill) {
      filteredNoise(t0, 0.14, fill ? 0.12 + (i - 12) * 0.05 : 0.22, 'highpass', 1800);
      voice(t0, 190, 0.09, { wave: 'triangle', gain: 0.2, cut: 1200 });
    }
    if (d.hat?.[i] === 'x') filteredNoise(t0, 0.04, 0.09, 'highpass', 7000);
    if (d.shaker?.[i] === 'x') filteredNoise(t0, 0.05, 0.04, 'bandpass', 5000);
  }

  // Bộ xếp lịch nhìn trước: mỗi 25ms xếp các nốt trong 120ms tới.
  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!ac || !track || fileMode || ac.state !== 'running') return;
    ensureReverb();
    if (!outBus) switchBus();
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

  // Đổi bài: bus cũ mờ đi trong 0.5s rồi ngắt, bus mới hiện dần (không bị cắt cụt, không chồng tiếng).
  function switchBus() {
    if (!ac) return;
    const now = ac.currentTime;
    const old = outBus;
    outBus = null;
    if (old) {
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0.0001, now + 0.5);
      try { old._src?.stop(now + 0.8); } catch { /* đã dừng */ }
      setTimeout(() => old.disconnect(), 3000);
    }
    if (!track) return;
    outBus = ac.createGain();
    outBus.gain.setValueAtTime(old ? 0.0001 : 1, now);
    if (old) outBus.gain.linearRampToValueAtTime(1, now + 0.7);
    outBus.connect(musicBus);
  }

  // Nhạc từ file (data/audio.json -> music): tải + giải mã khi cần, lặp liền mạch; lỗi thì dùng bài tự sinh cùng tên.
  async function loadMusic(name) {
    if (musicBufs.has(name)) return musicBufs.get(name);
    const r = await fetch(cfg.music[name].url);
    if (!r.ok) throw new Error('music ' + r.status);
    const buf = await ac.decodeAudioData(await r.arrayBuffer());
    musicBufs.set(name, buf);
    while (musicBufs.size > 3) musicBufs.delete(musicBufs.keys().next().value);
    return buf;
  }
  function begin() {
    if (!ac || !track) return;
    if (!outBus) switchBus();
    const name = track;
    const bus = outBus;
    if (cfg.music?.[name] && !musicFail.has(name)) {
      fileMode = true;
      if (bus._src || bus._loading) return; // unlock() chạy ở mỗi lần chạm: không được phát chồng thêm một bản nữa
      bus._loading = true;
      loadMusic(name).then((buf) => {
        if (track !== name || outBus !== bus || !bus) return; // đã đổi bài trong lúc tải
        const src = ac.createBufferSource();
        const g = ac.createGain();
        src.buffer = buf;
        src.loop = true;
        g.gain.value = cfg.music[name].gain ?? 1;
        src.connect(g);
        g.connect(bus);
        src.start();
        bus._src = src;
      }).catch(() => {
        musicFail.add(name);
        bus._loading = false;
        if (track === name) { fileMode = false; schedule(); }
      });
    } else {
      fileMode = false;
      schedule();
    }
  }

  function playMusic(name) {
    if (name === track) return;
    track = name && (cfg.tracks[name] || cfg.music?.[name]) ? name : null;
    step = 0;
    nextTime = 0;
    fileMode = false;
    clearTimeout(timer);
    timer = null;
    if (ac) switchBus();
    if (track && ac) begin();
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
