(function () {
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
      var s = score();
      if (s > best) {
        best = s;
        try { localStorage.setItem('ferro-best', String(best)); } catch (e) {}
      }
      if (pauseBtn) pauseBtn.textContent = 'Pause';
    }

    function flip() {
      if (state === 'ready') { reset(); state = 'play'; }
      else if (state === 'play') { pol = -pol; }
      else if (state === 'paused') { togglePause(); }
      else if (state === 'over') { reset(); state = 'play'; }
    }

    function togglePause() {
      if (state === 'play') { state = 'paused'; if (pauseBtn) pauseBtn.textContent = 'Resume'; }
      else if (state === 'paused') { state = 'play'; if (pauseBtn) pauseBtn.textContent = 'Pause'; }
    }

    cv.addEventListener('pointerdown', function (e) { e.preventDefault(); cv.focus({ preventScroll: true }); flip(); });
    window.addEventListener('keydown', function (e) {
      var t = e.target && e.target.tagName;
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (t === 'BUTTON' || t === 'INPUT') return;
        e.preventDefault(); flip();
      } else if (e.key === 'p' || e.key === 'P') { togglePause(); }
    });
    if (pauseBtn) pauseBtn.addEventListener('click', togglePause);
    document.addEventListener('visibilitychange', function () { if (document.hidden && state === 'play') togglePause(); });

    function update(dt) {
      var k = (assistEl && assistEl.checked) ? 0.78 : 1;
      if (state === 'ready') { cam += 40 * dt; fill(); return; }
      if (state !== 'play') return;

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

      for (var i = 0; i < gl.length; i++) {
        var g = gl[i];
        if (!g.got && Math.abs(g.x - wx) < 20 && Math.abs(g.y - y) < 22) { g.got = true; gems++; }
      }

      if (!reduced && (dF < 16 || dC < 16) && Math.random() < 0.6) {
        var onFloor = dF < dC;
        sparks.push({ x: CX, y: onFloor ? FLOOR : CEIL, vx: -(120 + Math.random() * 160), vy: (onFloor ? -1 : 1) * (20 + Math.random() * 90), l: 1 });
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
