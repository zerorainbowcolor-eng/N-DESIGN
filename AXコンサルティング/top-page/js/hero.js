/* FV：ノイズで写真がにじむように切り替わる背景スライダー（素のWebGL + GSAP） */
(() => {
  'use strict';

  /* ============================================================
     設定：ここを書き換えて調整する
     ============================================================ */
  const CONFIG = {
    // 画像。1枚だけにすると切り替えなしの静止FVになる。読み込めない場合は自動でダミー画像になる
    slides: [
      { pc: 'images/slide01.jpg', sp: 'images/slide01_sp.jpg' }, // 支給写真
      { pc: 'images/slide02.jpg', sp: 'images/slide02_sp.jpg' }, // 仮画像。差し替える
      { pc: 'images/slide03.jpg', sp: 'images/slide03_sp.jpg' }, // 仮画像。差し替える
    ],
    spQuery: '(max-width: 767px)',
    interval: 5,          // 切り替え開始から次の切り替え開始まで（秒）
    duration: 2.5,        // トランジションの長さ（秒）
    ease: 'power2.inOut',
    noiseScale: 8,        // 模様の細かさ（大きいほど細かい）
    flowSpeed: 0.06,      // 模様が流れる速さ
    softness: 0.6,        // 境界のぼかし（0.05でくっきり、1でほぼクロスフェード）
    maxDpr: 2,
  };

  if (!window.gsap) { document.documentElement.classList.remove('js'); return; } // GSAPが読めない時はコピーを素で表示

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) { CONFIG.softness = 5; CONFIG.duration = 0.8; } // 実質ただのクロスフェードにする

  /* ============================================================
     シェーダー
     ============================================================ */
  const VERT = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif
    varying vec2 vUv;
    uniform sampler2D uTexA;   // 今の画像
    uniform sampler2D uTexB;   // 次の画像
    uniform vec2 uCanvasRes;
    uniform vec2 uTexResA;
    uniform vec2 uTexResB;
    uniform float uProgress;
    uniform float uTime;
    uniform float uNoiseScale;
    uniform float uFlowSpeed;
    uniform float uSoftness;

    // object-fit: cover 相当のUV
    vec2 coverUv(vec2 uv, vec2 canvasRes, vec2 texRes) {
      float ca = canvasRes.x / canvasRes.y;
      float ta = texRes.x / texRes.y;
      vec2 scale = ca > ta ? vec2(1.0, ta / ca) : vec2(ca / ta, 1.0);
      return (uv - 0.5) * scale + 0.5;
    }

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    void main() {
      // 画面の縦横比を掛けて、模様が横に伸びないようにする
      vec2 aspect = vec2(uCanvasRes.x / uCanvasRes.y, 1.0);
      float n = valueNoise(vUv * aspect * uNoiseScale + uTime * uFlowSpeed);

      // progress 0 → 全面A、1 → 全面B になるよう、ぼかし幅のぶん範囲を広げる
      float edge = uProgress * (1.0 + 2.0 * uSoftness) - uSoftness;
      float keepA = smoothstep(edge - uSoftness, edge + uSoftness, n);

      vec4 colA = texture2D(uTexA, coverUv(vUv, uCanvasRes, uTexResA));
      vec4 colB = texture2D(uTexB, coverUv(vUv, uCanvasRes, uTexResB));
      gl_FragColor = mix(colB, colA, keepA);
    }`;

  /* ============================================================
     WebGL 初期化
     ============================================================ */
  const mqlEarly = window.matchMedia(CONFIG.spQuery);
  const canvas = document.getElementById('hero-canvas');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });

  const $ = (s) => document.querySelector(s);
  const els = {
    main: $('.js-title-main'), sub: $('.js-title-sub'),
    current: $('.js-current'), next: $('.js-next'),
    bar: $('.js-bar'), toggle: $('.js-toggle'),
  };

  function introText() {
    gsap.fromTo([els.main, els.sub],
      { opacity: 0, y: 30, filter: 'blur(10px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.6, ease: 'power2.out', stagger: 0.2, delay: 0.4 });
  }

  if (!gl) {
    // WebGL不可：1枚目を静止画で出すだけのフォールバック
    document.body.style.background = `#10233f url(${mqlEarly.matches ? CONFIG.slides[0].sp : CONFIG.slides[0].pc}) center / cover fixed`;
    canvas.remove();
    introText();
    return;
  }

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);

  // 画面全体を覆う四角形（三角形2枚）
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uTexA','uTexB','uCanvasRes','uTexResA','uTexResB','uProgress','uTime','uNoiseScale','uFlowSpeed','uSoftness']
    .forEach((n) => { U[n] = gl.getUniformLocation(program, n); });
  gl.uniform1i(U.uTexA, 0);
  gl.uniform1i(U.uTexB, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  /* ============================================================
     テクスチャ
     ============================================================ */
  function placeholder(index) {
    // 画像が無いときのダミー。色相をずらした空っぽいグラデーション
    const c = document.createElement('canvas');
    c.width = 1600; c.height = 1000;
    const x = c.getContext('2d');
    const hue = 205 + index * 32;
    const g = x.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, `hsl(${hue}, 55%, 22%)`);
    g.addColorStop(1, `hsl(${hue + 40}, 60%, 62%)`);
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 4; i++) {
      const cx = ((index * 397 + i * 613) % 1600), cy = ((index * 211 + i * 347) % 1000);
      const r = x.createRadialGradient(cx, cy, 0, cx, cy, 520);
      r.addColorStop(0, `hsla(${hue + 70 + i * 20}, 70%, 75%, 0.45)`);
      r.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
      x.fillStyle = r; x.fillRect(0, 0, c.width, c.height);
    }
    x.fillStyle = 'rgba(255,255,255,0.14)';
    x.font = '500 520px Outfit, Arial, sans-serif';
    x.textAlign = 'right'; x.textBaseline = 'alphabetic';
    x.fillText(String(index + 1).padStart(2, '0'), c.width - 60, c.height - 40);
    return c;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function upload(source) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); // file:// の画像だとここで例外になる
    // サイズが2の累乗でない画像でも使える設定
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return { tex, w: source.naturalWidth || source.width, h: source.naturalHeight || source.height };
  }

  async function makeTexture(index, isSp) {
    const slide = CONFIG.slides[index];
    try {
      return upload(await loadImage(isSp ? slide.sp : slide.pc));
    } catch (e) {
      return upload(placeholder(index));
    }
  }

  /* ============================================================
     描画
     ============================================================ */
  const state = { progress: 0 };
  let textures = [];
  let current = 0, upcoming = 1;
  let transitioning = false, playing = true, visible = true;
  let barTween = null, swapCall = null, fadeTween = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    render();
  }

  function render() {
    const a = textures[current], b = textures[upcoming] || a;
    if (!a) return;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, b.tex);
    gl.uniform2f(U.uCanvasRes, canvas.width, canvas.height);
    gl.uniform2f(U.uTexResA, a.w, a.h);
    gl.uniform2f(U.uTexResB, b.w, b.h);
    gl.uniform1f(U.uProgress, state.progress);
    gl.uniform1f(U.uTime, performance.now() / 1000);
    gl.uniform1f(U.uNoiseScale, CONFIG.noiseScale);
    gl.uniform1f(U.uFlowSpeed, CONFIG.flowSpeed);
    gl.uniform1f(U.uSoftness, CONFIG.softness);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  // 静止中は progress=0 で見た目が変わらないので、毎フレーム描画はしない（電池にやさしい）

  /* ============================================================
     スライド制御
     ============================================================ */
  const pad = (n) => String(n).padStart(2, '0');
  function updateCounter(index) {
    els.current.textContent = pad(index + 1);
    els.next.textContent = pad(((index + 1) % textures.length) + 1);
  }

  function startBar(seconds) {
    if (barTween) barTween.kill();
    barTween = gsap.fromTo(els.bar, { scaleX: 0 }, {
      scaleX: 1, duration: seconds, ease: 'none', paused: !(playing && visible), onComplete: goNext,
    });
  }

  function goNext() {
    if (transitioning || textures.length < 2) return;
    transitioning = true;
    upcoming = (current + 1) % textures.length;

    // 切り替えの中間で数字とバーを更新
    swapCall = gsap.delayedCall(CONFIG.duration / 2, () => {
      updateCounter(upcoming);
      startBar(CONFIG.interval - CONFIG.duration / 2);
    });

    fadeTween = gsap.to(state, {
      progress: 1, duration: CONFIG.duration, ease: CONFIG.ease,
      onUpdate: render,
      onComplete: () => {
        current = upcoming;
        upcoming = (current + 1) % textures.length;
        state.progress = 0;
        transitioning = false;
        render();
      },
    });
  }

  els.toggle.addEventListener('click', () => {
    playing = !playing;
    els.toggle.dataset.state = playing ? 'playing' : 'paused';
    els.toggle.setAttribute('aria-label', playing ? 'スライドを一時停止' : 'スライドを再生');
    if (barTween) barTween.paused(!(playing && visible)); // 進行中のトランジションは最後まで流す
  });

  /* ============================================================
     起動
     ============================================================ */
  const mql = window.matchMedia(CONFIG.spQuery);
  let introDone = false;
  let runId = 0;

  async function setup() {
    const myRun = ++runId;
    [barTween, swapCall, fadeTween].forEach((t) => t && t.kill());
    textures.forEach((t) => gl.deleteTexture(t.tex));
    textures = []; current = 0; upcoming = 1; state.progress = 0; transitioning = false;
    gsap.set(els.bar, { scaleX: 0 });
    const isSp = mql.matches;

    // 1枚目だけ先に読んで即表示（FVの表示を待たせない）
    const first = await makeTexture(0, isSp);
    if (myRun !== runId) { gl.deleteTexture(first.tex); return; }
    textures[0] = first;
    resize();
    if (!introDone) { introDone = true; introText(); }

    // 残りは裏で読み込み、揃ってから自動再生を開始
    const rest = await Promise.all(CONFIG.slides.slice(1).map((_, i) => makeTexture(i + 1, isSp)));
    if (myRun !== runId) { rest.forEach((t) => gl.deleteTexture(t.tex)); return; } // 読み込み中にPC/SPが切り替わったら後続のsetupに任せる
    textures = [textures[0], ...rest];
    if (textures.length < 2) { const c = document.querySelector('.hero__controls'); if (c) c.hidden = true; return; }
    updateCounter(0);
    startBar(CONFIG.interval);
  }

  // main.js から呼ぶ：FVが画面外に出たら自動再生を止める
  window.heroSlider = {
    setVisible(v) { visible = v; if (barTween) barTween.paused(!(playing && visible)); },
  };

  window.addEventListener('resize', resize);
  mql.addEventListener('change', setup);
  setup();
})();
