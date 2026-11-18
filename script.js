(function () {
  function createMagneticAudio() {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    var ctx = null;
    var master = null;
    var dryBus = null;
    var wetBus = null;
    var noiseBuffer = null;
    var humOsc1 = null, humOsc2 = null, humOsc3 = null, humFilter = null, humGain = null;
    var muted = false;
    var lastSparkTime = 0;
    var gemStreak = 0;
    var lastGemTime = 0;

    // C-major pentatonic shimmer notes for escalating gem combos
    var GEM_SCALE = [1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0, 2349.32, 2637.02];

    try { muted = localStorage.getItem('ferro-muted') === 'true'; } catch (e) {}

    function buildNoiseBuffer(audioCtx) {
      var len = Math.floor(audioCtx.sampleRate * 0.6);
      var buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return buf;
    }

    function ensure() {
      if (!AudioCtx) return false;
      if (!ctx) {
        try {
          ctx = new AudioCtx();

          // Master bus with gentle studio dynamics compressor
          master = ctx.createGain();
          master.gain.value = muted ? 0 : 0.92;

          var comp = ctx.createDynamicsCompressor ? ctx.createDynamicsCompressor() : null;
          if (comp) {
            comp.threshold.value = -14;
            comp.knee.value = 18;
            comp.ratio.value = 4;
            comp.attack.value = 0.004;
            comp.release.value = 0.14;
            master.connect(comp);
            comp.connect(ctx.destination);
          } else {
            master.connect(ctx.destination);
          }

          dryBus = ctx.createGain();
          dryBus.gain.value = 1;
          dryBus.connect(master);

          // Subtle metallic laboratory echo chamber (dual short filtered delays)
          wetBus = ctx.createGain();
          wetBus.gain.value = 0.22;
          if (ctx.createDelay) {
            var d1 = ctx.createDelay(0.2);
            var d2 = ctx.createDelay(0.2);
            var fb1 = ctx.createGain();
            var fb2 = ctx.createGain();
            var damp = ctx.createBiquadFilter();

            d1.delayTime.value = 0.037;
            d2.delayTime.value = 0.061;
            fb1.gain.value = 0.22;
            fb2.gain.value = 0.2;
            damp.type = 'lowpass';
            damp.frequency.value = 2400;

            wetBus.connect(d1);
            wetBus.connect(d2);
            d1.connect(damp);
            d2.connect(damp);
            damp.connect(master);
            damp.connect(fb1);
            fb1.connect(d2);
            damp.connect(fb2);
            fb2.connect(d1);
          } else {
            wetBus.connect(master);
          }

          noiseBuffer = buildNoiseBuffer(ctx);

          // Silky superconducting maglev field hum (sub + warm beating harmonics)
          humOsc1 = ctx.createOscillator();
          humOsc2 = ctx.createOscillator();
          humOsc3 = ctx.createOscillator();
          var h2Gain = ctx.createGain();
          var h3Gain = ctx.createGain();
          humFilter = ctx.createBiquadFilter();
          humGain = ctx.createGain();

          humOsc1.type = 'sine';
          humOsc2.type = 'sine';
          humOsc3.type = 'sine';
          humOsc1.frequency.value = 56;
          humOsc2.frequency.value = 111.7;
          humOsc3.frequency.value = 112.4;

          h2Gain.gain.value = 0.35;
          h3Gain.gain.value = 0.35;

          humFilter.type = 'lowpass';
          humFilter.frequency.value = 180;
          humFilter.Q.value = 1.6;
          humGain.gain.value = 0;

          humOsc1.connect(humFilter);
          humOsc2.connect(h2Gain);
          humOsc3.connect(h3Gain);
          h2Gain.connect(humFilter);
          h3Gain.connect(humFilter);
          humFilter.connect(humGain);
          humGain.connect(dryBus);

          humOsc1.start();
          humOsc2.start();
          humOsc3.start();
        } catch (e) {
          ctx = null;
          return false;
        }
      }
      if (ctx.state === 'suspended') {
        ctx.resume().catch(function () {});
      }
      return true;
    }

    function setMuted(val) {
      muted = !!val;
      try { localStorage.setItem('ferro-muted', String(muted)); } catch (e) {}
      if (ctx && master) {
        master.gain.setTargetAtTime(muted ? 0 : 0.92, ctx.currentTime, 0.02);
      }
      if (muted) updateHum(false, 0, 100, 1);
      return muted;
    }

    function toggle() {
      if (muted) ensure();
      return setMuted(!muted);
    }

    function resetCombo() {
      gemStreak = 0;
      lastGemTime = 0;
    }

    // Run launch: energized magnetic coil charge-up swell
    function playStart() {
      resetCombo();
      if (muted || !ensure()) return;
      var t = ctx.currentTime;
      var notes = [220, 329.63, 440];
      for (var i = 0; i < notes.length; i++) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        var st = t + i * 0.032;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(notes[i] * 0.85, st);
        osc.frequency.exponentialRampToValueAtTime(notes[i], st + 0.09);
        g.gain.setValueAtTime(0.001, st);
        g.gain.linearRampToValueAtTime(0.085, st + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.19);
        osc.connect(g);
        g.connect(dryBus);
        g.connect(wetBus);
        osc.start(st);
        osc.stop(st + 0.21);
      }
    }

    // Pause / Resume: clean magnetic latch double-pip
    function playPause(isPaused) {
      if (muted || !ensure()) return;
      var t = ctx.currentTime;
      var pair = isPaused ? [440, 310] : [310, 440];
      for (var i = 0; i < 2; i++) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        var st = t + i * 0.04;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pair[i], st);
        g.gain.setValueAtTime(0.001, st);
        g.gain.linearRampToValueAtTime(0.07, st + 0.006);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.07);
        osc.connect(g);
        g.connect(dryBus);
        osc.start(st);
        osc.stop(st + 0.08);
      }
    }

    // Polarity flip: crisp neodymium snap + silky FM magnetic flux whoosh
    function playFlip(pol) {
      if (muted || !ensure()) return;
      var t = ctx.currentTime;
      var isNorth = pol > 0;

      // 1. Tactile neodymium snap (filtered noise micro-burst + metallic ping)
      if (noiseBuffer && ctx.createBufferSource) {
        var nSrc = ctx.createBufferSource();
        nSrc.buffer = noiseBuffer;
        var nFilt = ctx.createBiquadFilter();
        nFilt.type = 'bandpass';
        nFilt.frequency.setValueAtTime(isNorth ? 2900 : 2100, t);
        nFilt.Q.value = 3.2;

        var nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.001, t);
        nGain.gain.linearRampToValueAtTime(0.16, t + 0.002);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

        nSrc.connect(nFilt);
        nFilt.connect(nGain);
        nGain.connect(dryBus);
        nGain.connect(wetBus);
        nSrc.start(t, Math.random() * 0.3, 0.025);
      }

      var ping = ctx.createOscillator();
      var pingGain = ctx.createGain();
      ping.type = 'sine';
      ping.frequency.setValueAtTime(isNorth ? 3100 : 2300, t);
      ping.frequency.exponentialRampToValueAtTime(isNorth ? 1450 : 980, t + 0.018);
      pingGain.gain.setValueAtTime(0.055, t);
      pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
      ping.connect(pingGain);
      pingGain.connect(dryBus);
      ping.start(t);
      ping.stop(t + 0.025);

      // 2. Silky FM-modulated magnetic flux whoosh
      var carrier = ctx.createOscillator();
      var mod = ctx.createOscillator();
      var modGain = ctx.createGain();
      var bodyFilter = ctx.createBiquadFilter();
      var bodyGain = ctx.createGain();

      var fStart = isNorth ? 175 : 300;
      var fEnd = isNorth ? 355 : 148;

      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(fStart, t);
      carrier.frequency.exponentialRampToValueAtTime(fEnd, t + 0.115);

      mod.type = 'sine';
      mod.frequency.setValueAtTime(fStart * 2.0, t);
      mod.frequency.exponentialRampToValueAtTime(fEnd * 2.0, t + 0.115);

      modGain.gain.setValueAtTime(isNorth ? 140 : 110, t);
      modGain.gain.exponentialRampToValueAtTime(6, t + 0.11);

      bodyFilter.type = 'lowpass';
      bodyFilter.frequency.setValueAtTime(isNorth ? 480 : 1250, t);
      bodyFilter.frequency.exponentialRampToValueAtTime(isNorth ? 1700 : 380, t + 0.11);
      bodyFilter.Q.value = 2.4;

      bodyGain.gain.setValueAtTime(0.001, t);
      bodyGain.gain.linearRampToValueAtTime(0.16, t + 0.008);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.135);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(bodyFilter);
      bodyFilter.connect(bodyGain);
      bodyGain.connect(dryBus);
      bodyGain.connect(wetBus);

      carrier.start(t);
      mod.start(t);
      carrier.stop(t + 0.145);
      mod.stop(t + 0.145);
    }

    // Continuous smooth superconducting levitation resonance
    function updateHum(active, forceMag, minRailDist, pol) {
      if (!ctx || !humGain) return;
      var t = ctx.currentTime;
      if (!active || muted) {
        humGain.gain.setTargetAtTime(0, t, 0.045);
        return;
      }
      var forceNorm = Math.min(1, forceMag / 1450);
      var proxNorm = Math.max(0, Math.min(1, 1 - minRailDist / 85));
      var intensity = Math.max(forceNorm * 0.6, proxNorm);

      var poleShift = pol > 0 ? 4 : -3;
      var baseFreq = 54 + poleShift + intensity * 38;
      var cutoff = 140 + intensity * 340;
      var targetVol = 0.008 + intensity * 0.032;

      humOsc1.frequency.setTargetAtTime(baseFreq, t, 0.06);
      humOsc2.frequency.setTargetAtTime(baseFreq * 1.995, t, 0.06);
      humOsc3.frequency.setTargetAtTime(baseFreq * 2.008, t, 0.06);
      humFilter.frequency.setTargetAtTime(cutoff, t, 0.06);
      humGain.gain.setTargetAtTime(targetVol, t, 0.06);
    }

    // Gem pickup: escalating pentatonic crystal FM bell chime
    function playGem() {
      if (muted || !ensure()) return;
      var now = performance.now();
      if (now - lastGemTime > 3800) gemStreak = 0;
      lastGemTime = now;

      var noteFreq = GEM_SCALE[Math.min(gemStreak, GEM_SCALE.length - 1)];
      gemStreak++;

      var t = ctx.currentTime;

      // Primary crystal bell fundamental
      var fund = ctx.createOscillator();
      var fundGain = ctx.createGain();
      fund.type = 'sine';
      fund.frequency.setValueAtTime(noteFreq, t);
      fundGain.gain.setValueAtTime(0.001, t);
      fundGain.gain.linearRampToValueAtTime(0.13, t + 0.005);
      fundGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

      // Shimmering metallic bell overtone (2.756x ratio)
      var bell = ctx.createOscillator();
      var bellGain = ctx.createGain();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(noteFreq * 2.756, t);
      bellGain.gain.setValueAtTime(0.001, t);
      bellGain.gain.linearRampToValueAtTime(0.04, t + 0.003);
      bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      // Delayed octave sparkle
      var oct = ctx.createOscillator();
      var octGain = ctx.createGain();
      oct.type = 'sine';
      oct.frequency.setValueAtTime(noteFreq * 1.5, t + 0.045);
      octGain.gain.setValueAtTime(0.001, t + 0.045);
      octGain.gain.linearRampToValueAtTime(0.08, t + 0.052);
      octGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      fund.connect(fundGain);
      bell.connect(bellGain);
      oct.connect(octGain);

      fundGain.connect(dryBus);
      fundGain.connect(wetBus);
      bellGain.connect(dryBus);
      bellGain.connect(wetBus);
      octGain.connect(dryBus);
      octGain.connect(wetBus);

      fund.start(t);
      bell.start(t);
      oct.start(t + 0.045);
      fund.stop(t + 0.34);
      bell.stop(t + 0.16);
      oct.stop(t + 0.3);
    }

    // Authentic electric rail spark crackle (filtered noise micro-arc)
    function playSpark() {
      if (muted || !ctx || !noiseBuffer || !ctx.createBufferSource) return;
      var now = performance.now();
      if (now - lastSparkTime < 65) return;
      lastSparkTime = now;

      var t = ctx.currentTime;
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer;

      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3200 + Math.random() * 3400, t);
      bp.Q.value = 4.5;

      var g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.075, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.018);

      src.connect(bp);
      bp.connect(g);
      g.connect(dryBus);
      g.connect(wetBus);
      src.start(t, Math.random() * 0.4, 0.022);
    }

    // Rail collision: heavy steel-on-magnet clamp + impact noise + field collapse
    function playCrash() {
      resetCombo();
      if (muted || !ensure()) return;
      var t = ctx.currentTime;
      updateHum(false, 0, 0, 1);

      // 1. Metallic steel-ball-on-rail clank cluster
      var metalFreqs = [276, 618, 1170];
      for (var i = 0; i < metalFreqs.length; i++) {
        var mOsc = ctx.createOscillator();
        var mGain = ctx.createGain();
        mOsc.type = i === 0 ? 'triangle' : 'sine';
        mOsc.frequency.setValueAtTime(metalFreqs[i], t);
        mOsc.frequency.exponentialRampToValueAtTime(metalFreqs[i] * 0.62, t + 0.16);
        mGain.gain.setValueAtTime(0.11 / (i + 1), t);
        mGain.gain.exponentialRampToValueAtTime(0.001, t + (0.18 - i * 0.03));
        mOsc.connect(mGain);
        mGain.connect(dryBus);
        mGain.connect(wetBus);
        mOsc.start(t);
        mOsc.stop(t + 0.2);
      }

      // 2. Physical impact noise thud
      if (noiseBuffer && ctx.createBufferSource) {
        var nSrc = ctx.createBufferSource();
        nSrc.buffer = noiseBuffer;
        var lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1100, t);
        lp.frequency.exponentialRampToValueAtTime(120, t + 0.14);

        var nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.24, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        nSrc.connect(lp);
        lp.connect(nGain);
        nGain.connect(dryBus);
        nSrc.start(t, 0, 0.17);
      }

      // 3. Deep electromagnetic power-down sub sweep
      var sub = ctx.createOscillator();
      var subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(140, t);
      sub.frequency.exponentialRampToValueAtTime(34, t + 0.38);
      subGain.gain.setValueAtTime(0.32, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      sub.connect(subGain);
      subGain.connect(dryBus);
      sub.start(t);
      sub.stop(t + 0.44);
    }

    return {
      isMuted: function () { return muted; },
      toggle: toggle,
      ensure: ensure,
      playStart: playStart,
      playPause: playPause,
      playFlip: playFlip,
      updateHum: updateHum,
      playGem: playGem,
      playSpark: playSpark,
      playCrash: playCrash
    };
  }

  function init() {
    var cv = document.getElementById('game');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var LW = 960, LH = 420, CEIL = 76, FLOOR = 344, CX = 190, R = 13;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = LW * dpr; cv.height = LH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var assistEl = document.getElementById('assist');
    var pauseBtn = document.getElementById('pauseBtn');
    var soundBtn = document.getElementById('soundBtn');
    var audio = createMagneticAudio();

    function syncSoundBtn() {
      if (!soundBtn) return;
      var on = !audio.isMuted();
      soundBtn.textContent = on ? 'Sound: On' : 'Sound: Off';
      soundBtn.setAttribute('aria-pressed', String(on));
    }
    syncSoundBtn();

    var state = 'ready';            // ready | play | paused | over
    var cam, y, vy, pol, fy, gems, sf, sc, gl, fx, cxp, gx, sparks, best = 0, last = 0;
    try { best = parseInt(localStorage.getItem('ferro-best') || '0', 10) || 0; } catch (e) {}

    var dashes = [];
    for (var i = 0; i < 90; i++) {
      dashes.push({ x: Math.random() * LW, y: CEIL + Math.random() * (FLOOR - CEIL), l: 6 + Math.random() * 7, a: Math.random() * 3.14 });
    }

    function reset() {
      cam = 0; y = (CEIL + FLOOR) / 2; vy = 0; pol = 1; fy = 0; gems = 0;
      sf = []; sc = []; gl = []; fx = 0; cxp = 0; gx = 420; sparks = [];
      fill();
    }

    function fill() {
      while (fx < cam + LW + 400) {
        var w = 170 + Math.random() * 130;
        sf.push({ x: fx, w: w, c: Math.random() < 0.5 ? 1 : -1 }); fx += w;
      }
      while (cxp < cam + LW + 400) {
        var w2 = 170 + Math.random() * 130;
        sc.push({ x: cxp, w: w2, c: Math.random() < 0.5 ? 1 : -1 }); cxp += w2;
      }
      while (gx < cam + LW + 400) {
        gx += 230 + Math.random() * 200;
        gl.push({ x: gx, y: CEIL + 50 + Math.random() * (FLOOR - CEIL - 100), got: false });
      }
      while (sf.length && sf[0].x + sf[0].w < cam - 80) sf.shift();
      while (sc.length && sc[0].x + sc[0].w < cam - 80) sc.shift();
      while (gl.length && gl[0].x < cam - 80) gl.shift();
    }

    function segAt(arr, x) {
      for (var i = 0; i < arr.length; i++) if (x >= arr[i].x && x < arr[i].x + arr[i].w) return arr[i].c;
      return 1;
    }

    function score() { return Math.floor(cam / 10) + gems * 20; }

    function endRun() {
      state = 'over';
      audio.playCrash();
      var s = score();
      if (s > best) {
        best = s;
        try { localStorage.setItem('ferro-best', String(best)); } catch (e) {}
      }
      if (pauseBtn) pauseBtn.textContent = 'Pause';
    }

    function flip() {
      audio.ensure();
      if (state === 'ready') { reset(); state = 'play'; audio.playStart(); }
      else if (state === 'play') { pol = -pol; audio.playFlip(pol); }
      else if (state === 'paused') { togglePause(); }
      else if (state === 'over') { reset(); state = 'play'; audio.playStart(); }
    }

    function togglePause() {
      if (state === 'play') {
        state = 'paused';
        audio.updateHum(false, 0, 100, pol);
        audio.playPause(true);
        if (pauseBtn) pauseBtn.textContent = 'Resume';
      } else if (state === 'paused') {
        state = 'play';
        audio.playPause(false);
        if (pauseBtn) pauseBtn.textContent = 'Pause';
      }
    }

    function toggleSound() {
      audio.toggle();
      syncSoundBtn();
      if (!audio.isMuted()) audio.playFlip(pol);
    }

    cv.addEventListener('pointerdown', function (e) { e.preventDefault(); cv.focus({ preventScroll: true }); flip(); });
    window.addEventListener('keydown', function (e) {
      var t = e.target && e.target.tagName;
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (t === 'BUTTON' || t === 'INPUT') return;
        e.preventDefault(); flip();
      } else if (e.key === 'p' || e.key === 'P') { togglePause(); }
      else if (e.key === 'm' || e.key === 'M') { toggleSound(); }
    });
    if (pauseBtn) pauseBtn.addEventListener('click', togglePause);
    if (soundBtn) soundBtn.addEventListener('click', toggleSound);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        audio.updateHum(false, 0, 100);
        if (state === 'play') togglePause();
      }
    });

    function update(dt) {
      var k = (assistEl && assistEl.checked) ? 0.78 : 1;
      if (state === 'ready') {
        audio.updateHum(false, 0, 100);
        cam += 40 * dt; fill(); return;
      }
      if (state !== 'play') {
        audio.updateHum(false, 0, 100);
        return;
      }

      var speed = Math.min(400, 200 + cam * 0.015) * k;
      cam += speed * dt; fill();

      var wx = cam + CX;
      var cF = segAt(sf, wx), cC = segAt(sc, wx);
      var dF = FLOOR - y - R, dC = y - CEIL - R;
      var A = 46000 * k;
      var f1 = (cF === pol ? -1 : 1) * Math.min(1500, A / (Math.max(dF, 0) + 34));
      var f2 = (cC === pol ? 1 : -1) * Math.min(1500, A / (Math.max(dC, 0) + 34));
      fy = f1 + f2;
      vy += fy * dt;
      vy *= Math.pow(0.35, dt);
      y += vy * dt;

      audio.updateHum(true, Math.abs(fy), Math.min(dF, dC), pol);

      for (var i = 0; i < gl.length; i++) {
        var g = gl[i];
        if (!g.got && Math.abs(g.x - wx) < 20 && Math.abs(g.y - y) < 22) {
          g.got = true; gems++; audio.playGem();
        }
      }

      if (!reduced && (dF < 16 || dC < 16) && Math.random() < 0.6) {
        var onFloor = dF < dC;
        sparks.push({ x: CX, y: onFloor ? FLOOR : CEIL, vx: -(120 + Math.random() * 160), vy: (onFloor ? -1 : 1) * (20 + Math.random() * 90), l: 1 });
        audio.playSpark();
      }
      for (var s = sparks.length - 1; s >= 0; s--) {
        var p = sparks[s]; p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt * 2.2;
        if (p.l <= 0) sparks.splice(s, 1);
      }

      if (dF <= 1 || dC <= 1) endRun();
    }

    function text(t, x, yy, size, weight, color, align) {
      ctx.fillStyle = color; ctx.font = weight + ' ' + size + 'px "Avenir Next","Segoe UI",system-ui,sans-serif';
      ctx.textAlign = align || 'left'; ctx.fillText(t, x, yy); ctx.textAlign = 'left';
    }

    function panel(c, title, sub) {
      var pw = 520, ph = 150;
      ctx.fillStyle = c.panel; ctx.globalAlpha = 0.95;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(LW / 2 - pw / 2, LH / 2 - ph / 2, pw, ph, 18); else ctx.rect(LW / 2 - pw / 2, LH / 2 - ph / 2, pw, ph);
      ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.stroke();
      text(title, LW / 2, LH / 2 - 16, 29, '700', c.ink, 'center');
      text(sub, LW / 2, LH / 2 + 22, 16, '400', c.muted, 'center');
    }

    function draw() {
      var cs = getComputedStyle(document.documentElement);
      var c = {
        panel: cs.getPropertyValue('--panel').trim(), ink: cs.getPropertyValue('--ink').trim(),
        muted: cs.getPropertyValue('--muted').trim(), red: cs.getPropertyValue('--red').trim(),
        blue: cs.getPropertyValue('--blue').trim(), teal: cs.getPropertyValue('--teal').trim(),
        line: cs.getPropertyValue('--line').trim()
      };
      ctx.clearRect(0, 0, LW, LH);
      ctx.fillStyle = c.panel; ctx.fillRect(0, 0, LW, LH);

      // drifting filings backdrop
      ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.globalAlpha = 0.12;
      for (var i = 0; i < dashes.length; i++) {
        var d = dashes[i], x = (((d.x - cam * 0.25) % LW) + LW) % LW;
        ctx.beginPath(); ctx.moveTo(x, d.y); ctx.lineTo(x + d.l * Math.cos(d.a), d.y + d.l * Math.sin(d.a)); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // rails
      function rail(arr, ry, h) {
        for (var j = 0; j < arr.length; j++) {
          var s = arr[j], sx = s.x - cam;
          if (sx > LW || sx + s.w < 0) continue;
          ctx.fillStyle = s.c > 0 ? c.red : c.blue; ctx.fillRect(sx, ry, s.w - 3, h);
          ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(sx, ry, s.w - 3, 2);
          text(s.c > 0 ? 'N' : 'S', sx + (s.w - 3) / 2, ry + h - 3, 12, '700', '#fff', 'center');
        }
      }
      rail(sc, CEIL - 15, 15);
      rail(sf, FLOOR, 15);

      // gems
      for (var g = 0; g < gl.length; g++) {
        var gm = gl[g]; if (gm.got) continue;
        var gX = gm.x - cam;
        ctx.fillStyle = c.teal; ctx.beginPath();
        ctx.moveTo(gX, gm.y - 11); ctx.lineTo(gX + 9, gm.y); ctx.lineTo(gX, gm.y + 11); ctx.lineTo(gX - 9, gm.y); ctx.closePath(); ctx.fill();
      }

      // sparks
      for (var s2 = 0; s2 < sparks.length; s2++) {
        var p = sparks[s2]; ctx.globalAlpha = Math.max(0, p.l); ctx.fillStyle = c.ink; ctx.fillRect(p.x, p.y, 3, 2);
      }
      ctx.globalAlpha = 1;

      // ball
      ctx.fillStyle = pol > 0 ? c.red : c.blue; ctx.beginPath(); ctx.arc(CX, y, R, 0, 6.283); ctx.fill();
      ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.stroke();
      text(pol > 0 ? 'N' : 'S', CX, y + 5, 14, '700', '#fff', 'center');

      // force arrow
      if (state === 'play') {
        var al = Math.max(-40, Math.min(40, fy * 0.035));
        ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.6; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(CX + 28, y); ctx.lineTo(CX + 28, y + al); ctx.stroke();
        if (Math.abs(al) > 7) {
          var sg = al > 0 ? 1 : -1;
          ctx.beginPath(); ctx.moveTo(CX + 23, y + al - sg * 6); ctx.lineTo(CX + 28, y + al); ctx.lineTo(CX + 33, y + al - sg * 6); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // HUD
      text('Distance ' + Math.floor(cam / 10) + ' m', 20, 38, 16, '600', c.ink);
      text('Gems ' + gems, 200, 38, 16, '600', c.ink);
      text('Best ' + best, LW - 20, 38, 16, '600', c.ink, 'right');
      text('Score ' + score(), LW - 150, 38, 16, '400', c.muted, 'right');

      if (state === 'ready') panel(c, 'Ferro Runner', 'Click, tap, or press Space to start');
      else if (state === 'paused') panel(c, 'Paused', 'Press P or Resume to continue');
      else if (state === 'over') panel(c, 'You hit a rail', 'Score ' + score() + '. Click or press Space to run again');
    }

    function frame(ts) {
      var dt = Math.min(0.04, (ts - last) / 1000 || 0.016); last = ts;
      update(dt); draw();
      requestAnimationFrame(frame);
    }

    reset();
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
