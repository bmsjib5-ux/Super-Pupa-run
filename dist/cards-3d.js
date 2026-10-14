// A small WebGL viewer for 3D card models (no libraries). A model is two
// files: a .bin of int16 positions and normals and uint16 texture
// coordinates, three vertices to a triangle, and a .webp texture with the
// front of the character on its left half and its back on the right.
// PupaCards3D.mount(box, { bin, texture }) draws it turning gently; drag
// to turn it further. Returns { stop() }, or null without WebGL.
(function () {
  const VERT = `
    attribute vec3 aPos; attribute vec3 aNorm; attribute vec2 aUv;
    uniform mat4 uView; uniform mat3 uTurn; varying vec3 vNorm; varying vec2 vUv;
    void main() { vNorm = uTurn * aNorm; vUv = aUv; gl_Position = uView * vec4(uTurn * aPos, 1.0); }`;
  const FRAG = `
    precision mediump float; uniform sampler2D uTex; varying vec3 vNorm; varying vec2 vUv;
    void main() {
      vec3 n = normalize(vNorm);
      float light = .58 + .42 * max(dot(n, normalize(vec3(.35, .55, .9))), 0.0);
      float rim = pow(1.0 - max(n.z, 0.0), 3.0) * .25;
      gl_FragColor = vec4(texture2D(uTex, vUv).rgb * light + vec3(1.0, .9, .7) * rim, 1.0);
    }`;
  const cache = new Map();
  function load(url) {
    if (!cache.has(url)) cache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); }));
    return cache.get(url);
  }
  function shader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function mount(box, model) {
    const canvas = document.createElement("canvas");
    canvas.className = "card-3d";
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!gl) return null;
    box.append(canvas);
    let stopped = false, frame = 0, ready = false, count = 0, turn = 0, drag = null, push = 0;
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog); gl.useProgram(prog);
    const at = (name) => gl.getAttribLocation(prog, name), un = (name) => gl.getUniformLocation(prog, name);
    gl.enable(gl.DEPTH_TEST);
    const image = new Image();
    image.crossOrigin = "anonymous";
    Promise.all([load(model.bin), new Promise((ok, fail) => { image.onload = ok; image.onerror = fail; image.src = model.texture; })]).then(([buf]) => {
      if (stopped) return;
      count = buf.byteLength / 16;
      const data = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, data);
      gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
      // positions, then normals, then texture coordinates, each in a block
      gl.vertexAttribPointer(at("aPos"), 3, gl.SHORT, true, 0, 0);
      gl.vertexAttribPointer(at("aNorm"), 3, gl.SHORT, true, 0, count * 6);
      gl.vertexAttribPointer(at("aUv"), 2, gl.UNSIGNED_SHORT, true, 0, count * 12);
      for (const name of ["aPos", "aNorm", "aUv"]) gl.enableVertexAttribArray(at(name));
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      ready = true;
      box.classList.add("has-3d");
    }).catch(() => { canvas.remove(); });
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function draw(time) {
      // gone with its sheet: stop drawing
      if (!canvas.isConnected && ready) { stopped = true; frame = 0; return; }
      frame = stopped ? 0 : requestAnimationFrame(draw);
      if (!ready) return;
      const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // a gentle sway, plus how far it was dragged (easing back)
      if (!drag) push *= .95;
      turn = (still ? 0 : Math.sin(time / 1400) * .5) + push;
      const c = Math.cos(turn), s = Math.sin(turn), tilt = -.08, ct = Math.cos(tilt), st = Math.sin(tilt);
      // yaw then a slight tilt toward the viewer
      gl.uniformMatrix3fv(un("uTurn"), false, [c, s * st, -s * ct, 0, ct, st, s, -c * st, c * ct]);
      const k = .92, aspect = w / h;
      gl.uniformMatrix4fv(un("uView"), false, [k / Math.max(1, aspect), 0, 0, 0, 0, k * Math.min(1, aspect), 0, 0, 0, 0, -.5, 0, 0, -.02, 0, 1]);
      gl.drawArrays(gl.TRIANGLES, 0, count);
    }
    frame = requestAnimationFrame(draw);
    canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, push }; canvas.setPointerCapture(e.pointerId); e.stopPropagation(); });
    canvas.addEventListener("pointermove", (e) => { if (drag) push = Math.max(-1.6, Math.min(1.6, drag.push + (e.clientX - drag.x) / 60)); });
    const end = () => { drag = null; };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    return { stop() { stopped = true; if (frame) cancelAnimationFrame(frame); canvas.remove(); } };
  }
  window.PupaCards3D = { mount };
})();
