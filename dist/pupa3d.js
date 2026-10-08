// 3D hero renderer. Draws the chosen character's GLB model into a small
// transparent WebGL canvas that game.js stamps onto the 2D stage in place of
// the sprite.
import {
  WebGLRenderer, Scene, OrthographicCamera, Group, Mesh, MeshStandardMaterial,
  HemisphereLight, DirectionalLight, TextureLoader, SRGBColorSpace,
  BufferAttribute, MathUtils, GLTFLoader
} from "./vendor/three-bundle.min.js";

const SIZE = 384;
const VIEW = 1.3; // half-height of the camera frustum in model units
const canvas = document.createElement("canvas");
canvas.width = canvas.height = SIZE;

// Each character is an untextured mesh coloured by projecting its front-view
// artwork, with its limb regions measured on the model (see LIMB_SHADER).
// "tintable" marks the pink suit the market outfits recolour.
const CHARACTERS = {
  pupa: {
    model: "assets/pupa.glb", texture: "assets/pupa-texture.webp", tintable: true, yaw: .75,
    legTop: -.50, armX: .44, armLow: -.46, armHigh: -.02, arms: 1
  },
  jibjib: {
    // The artwork is painted at a slight angle, so this one turns less: the
    // projected colours smear on the far side of the head.
    model: "assets/jibjib.glb", texture: "assets/jibjib-texture.webp", tintable: false, yaw: .38,
    legTop: -.62, armX: .40, armLow: -.58, armHigh: -.12, arms: 0
  },
  // Leg regions estimated from where the legs start in each picture.
  baitoey: {
    model: "assets/baitoey.glb", texture: "assets/baitoey-texture.webp", tintable: false, yaw: .55,
    legTop: -.34, armX: .5, armLow: -.4, armHigh: -.05, arms: 0
  },
  ikuya: {
    model: "assets/ikuya.glb", texture: "assets/ikuya-texture.webp", tintable: false, yaw: .35,
    legTop: -.32, armX: .5, armLow: -.4, armHigh: -.05, arms: 0
  },
  pangji: {
    model: "assets/pangji.glb", texture: "assets/pangji-texture.webp", tintable: false, yaw: .4,
    legTop: -.56, armX: .5, armLow: -.5, armHigh: -.2, arms: 0
  }
};

const api = { ready: false, canvas, viewHalf: VIEW, render, setSkin, setCharacter, character: "pupa" };
window.Pupa3D = api;

let renderer;
try {
  renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
} catch (error) {
  console.warn("Pupa3D: WebGL unavailable, falling back to sprites", error);
}

const scene = new Scene();
const camera = new OrthographicCamera(-VIEW, VIEW, VIEW, -VIEW, .1, 20);
camera.position.set(0, 0, 6);
scene.add(new HemisphereLight(0xffffff, 0xd9a6c8, 2.5));
const key = new DirectionalLight(0xfff1dc, 1.1);
key.position.set(2, 3, 5);
scene.add(key);

const rig = new Group();   // lean, squash and bob
const turn = new Group();  // yaw toward the travel direction
rig.add(turn);
scene.add(rig);

// The mesh has no skeleton, so the limbs are swung in the vertex shader.
// Regions are measured on the model: legs sit below LEG_TOP, arms stick out
// past ARM_X between ARM_LOW and ARM_HIGH (the scarf leaves are above that).
const limbs = { uPhase: { value: 0 }, uSwing: { value: 0 }, uFlap: { value: 0 } };
const LIMB_SHADER = `
  uniform float uPhase; uniform float uSwing; uniform float uFlap;
  uniform float LEG_TOP; uniform float ARM_X; uniform float ARM_LOW; uniform float ARM_HIGH; uniform float ARMS;
  vec3 swingLimbs(vec3 p) {
    float side = p.x < 0.0 ? -1.0 : 1.0;
    float leg = 1.0 - smoothstep(LEG_TOP - 0.14, LEG_TOP + 0.02, p.y);
    float la = side * sin(uPhase) * uSwing * 0.85 * leg;
    float ly = p.y - LEG_TOP;
    p.yz = mix(p.yz, vec2(LEG_TOP + ly * cos(la) - p.z * sin(la), ly * sin(la) + p.z * cos(la)), step(0.001, leg));
    float arm = ARMS * smoothstep(ARM_X, ARM_X + 0.14, abs(p.x))
      * smoothstep(ARM_LOW - 0.06, ARM_LOW + 0.04, p.y) * (1.0 - smoothstep(ARM_HIGH - 0.06, ARM_HIGH + 0.05, p.y));
    float aa = -sin(uPhase) * uSwing * 0.75 * arm;
    float ax = p.x - side * ARM_X;
    p.xz = mix(p.xz, vec2(side * ARM_X + ax * cos(aa) + p.z * sin(aa), -ax * sin(aa) + p.z * cos(aa)), step(0.001, arm));
    float fa = side * uFlap * arm;
    ax = p.x - side * ARM_X;
    float ay = p.y - (ARM_LOW + ARM_HIGH) * 0.5;
    p.xy = mix(p.xy, vec2(side * ARM_X + ax * cos(fa) - ay * sin(fa), (ARM_LOW + ARM_HIGH) * 0.5 + ax * sin(fa) + ay * cos(fa)), step(0.001, arm));
    return p;
  }
`;

// Outfit colours from the market: the pink suit (hues around 335 degrees,
// reasonably saturated) is turned to another hue; face, scarf and eyes keep
// their colours.
const tint = { uHue: { value: 0 }, uSat: { value: 1 }, uBright: { value: 1 } };
const TINT_SHADER = `
  uniform float uHue; uniform float uSat; uniform float uBright;
  vec3 tintRgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
  }
  vec3 tintHsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }
  vec3 recolor(vec3 c) {
    if (uHue == 0.0 && uSat == 1.0 && uBright == 1.0) return c;
    vec3 h = tintRgb2hsv(c);
    float d = abs(fract(h.x - 0.93 + 0.5) - 0.5);
    float mask = (1.0 - smoothstep(0.07, 0.11, d)) * smoothstep(0.18, 0.3, h.y);
    vec3 shifted = tintHsv2rgb(vec3(fract(h.x + uHue), clamp(h.y * uSat, 0.0, 1.0), h.z * uBright));
    return mix(c, shifted, mask);
  }
`;

// skin: { hue (turns), sat, bright } or nothing for the original colours.
// Outfits only apply to characters with a tintable suit.
let skinWanted = null;
function setSkin(skin) {
  skinWanted = skin;
  const on = CHARACTERS[api.character].tintable;
  tint.uHue.value = on ? skin?.hue || 0 : 0;
  tint.uSat.value = on ? skin?.sat ?? 1 : 1;
  tint.uBright.value = on ? skin?.bright ?? 1 : 1;
}

function projectTexture(geometry) {
  // Planar projection of the front-view artwork straight down the Z axis.
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  const inset = .012;
  for (let i = 0; i < position.count; i++) {
    const u = (position.getX(i) - min.x) / (max.x - min.x);
    const v = (position.getY(i) - min.y) / (max.y - min.y);
    uv[i * 2] = inset + u * (1 - inset * 2);
    uv[i * 2 + 1] = inset + v * (1 - inset * 2);
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
}

// Models are loaded the first time a character is picked.
const meshes = {};
function load(id) {
  const spec = CHARACTERS[id];
  meshes[id] = null;
  const texture = new TextureLoader().load(spec.texture);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const shape = {
    LEG_TOP: { value: spec.legTop }, ARM_X: { value: spec.armX },
    ARM_LOW: { value: spec.armLow }, ARM_HIGH: { value: spec.armHigh }, ARMS: { value: spec.arms }
  };
  new GLTFLoader().load(spec.model, (gltf) => {
    const group = new Group();
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      const geometry = node.geometry;
      projectTexture(geometry);
      const material = new MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, limbs, tint, shape);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${LIMB_SHADER}`)
          .replace("#include <begin_vertex>", "vec3 transformed = swingLimbs(position);");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", `#include <common>\n${TINT_SHADER}`)
          .replace("#include <map_fragment>", "#include <map_fragment>\n  diffuseColor.rgb = recolor(diffuseColor.rgb);");
      };
      group.add(new Mesh(geometry, material));
    });
    meshes[id] = group;
    if (api.character === id) show(id);
  }, undefined, (error) => console.warn(`Pupa3D: ${id} model failed to load`, error));
}

function show(id) {
  turn.clear();
  if (meshes[id]) turn.add(meshes[id]);
  api.ready = Boolean(meshes[id]);
  setSkin(skinWanted);
}

function setCharacter(id) {
  if (!CHARACTERS[id] || (id === api.character && id in meshes)) return;
  api.character = id;
  if (!(id in meshes)) load(id);
  show(id);
}

if (renderer) load("pupa");

let yaw = .75;
let lean = 0;
let stretch = 1;
let swing = 0;
let flap = 0;
let phase = 0;
let lastTime = 0;
let wasAirborne = false;

// pose: { time (ms), facing (1|-1), speed (px/s), vy (px/s), grounded }
function render(pose) {
  if (!api.ready) return false;
  const dt = Math.min(.05, Math.max(0, (pose.time - lastTime) / 1000 || 0));
  lastTime = pose.time;
  const ease = (rate) => Math.min(1, dt * rate);
  const running = pose.grounded && pose.speed > 45;
  const airborne = !pose.grounded;

  yaw += (pose.facing * CHARACTERS[api.character].yaw - yaw) * ease(11);
  const rising = airborne && pose.vy < 0;
  // Jump pose: arms thrown up and legs in a wide stride on the way up, then
  // arms fluttering out and the body tipping back on the way down.
  const airLean = rising ? -.2 : .12;
  const airFlap = rising ? 1.15 : .6 + Math.sin(pose.time * .03) * .18;
  lean += ((running ? -.13 : airborne ? airLean : 0) * pose.facing - lean) * ease(9);
  swing += ((running ? Math.min(1, pose.speed / 300) : airborne ? (rising ? 1.05 : .6) : 0) - swing) * ease(12);
  flap += ((airborne ? airFlap : 0) - flap) * ease(14);
  if (wasAirborne && !airborne) stretch = .8; // landing squash
  stretch += ((airborne ? 1 + MathUtils.clamp(-pose.vy / 5000, -.08, .16) : 1) - stretch) * ease(12);
  wasAirborne = airborne;
  if (running) phase += dt * (7 + Math.min(7, pose.speed / 45));
  else if (airborne) phase += ((Math.floor(phase / Math.PI) + .5) * Math.PI - phase) * ease(14);
  else phase += (Math.round(phase / Math.PI) * Math.PI - phase) * ease(12);

  const idle = !running && !airborne ? Math.sin(pose.time * .003) : 0;
  turn.rotation.y = yaw;
  rig.rotation.z = lean;
  rig.scale.set(1 / Math.sqrt(stretch) * (1 - idle * .012), stretch * (1 + idle * .018), 1);
  rig.position.y = (running ? Math.abs(Math.sin(phase)) * .07 : 0) - (1 - rig.scale.y);
  limbs.uPhase.value = phase;
  limbs.uSwing.value = swing;
  limbs.uFlap.value = flap;
  renderer.render(scene, camera);
  return true;
}

// ---- 3D pet (the dragon) ----
// A second small renderer of its own, so the pet can be stamped next to the
// hero independently. Loaded the first time the pet is shown.
const PET_SIZE = 256;
const PET_VIEW = 1.15;
const petCanvas = document.createElement("canvas");
petCanvas.width = petCanvas.height = PET_SIZE;
const petApi = { ready: false, canvas: petCanvas, load: loadPet, render: renderPet };
api.pet = petApi;

let petRenderer, petScene, petCamera, petTurn, petLoading = false;
function loadPet() {
  if (petLoading) return;
  petLoading = true;
  try {
    petRenderer = new WebGLRenderer({ canvas: petCanvas, alpha: true, antialias: true, premultipliedAlpha: true });
    petRenderer.setClearColor(0x000000, 0);
  } catch (error) {
    console.warn("Pupa3D: WebGL unavailable for the pet", error);
    return;
  }
  petScene = new Scene();
  petCamera = new OrthographicCamera(-PET_VIEW, PET_VIEW, PET_VIEW, -PET_VIEW, .1, 20);
  petCamera.position.set(0, 0, 6);
  petScene.add(new HemisphereLight(0xffffff, 0xa6d9d0, 2.5));
  const light = new DirectionalLight(0xfff1dc, 1.1);
  light.position.set(2, 3, 5);
  petScene.add(light);
  petTurn = new Group();
  petScene.add(petTurn);
  const texture = new TextureLoader().load("assets/dragon-texture.webp");
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  new GLTFLoader().load("assets/dragon.glb", (gltf) => {
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      projectTexture(node.geometry);
      const material = new MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, wing);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>
${WING_SHADER}`)
          .replace("#include <begin_vertex>", "vec3 transformed = flapWings(position);");
      };
      petTurn.add(new Mesh(node.geometry, material));
    });
    petApi.ready = petTurn.children.length > 0;
  }, undefined, (error) => console.warn("Pupa3D: pet model failed to load", error));
}

// The dragon has no skeleton either: its wings (the parts of the mesh that
// sit behind the body, out to either side) are hinged in the vertex shader
// and swing up and down. The tail on the left is kept out by its height.
const wing = { uWing: { value: 0 } };
const WING_SHADER = `
  uniform float uWing;
  vec3 flapWings(vec3 p) {
    float side = p.x < 0.0 ? -1.0 : 1.0;
    float back = smoothstep(0.05, -0.25, p.z);
    float spread = smoothstep(0.15, 0.45, abs(p.x));
    float band = smoothstep(-0.45, -0.2, p.y) * (1.0 - smoothstep(0.55, 0.75, p.y));
    float tail = (1.0 - smoothstep(-0.6, -0.45, p.x)) * smoothstep(-0.1, 0.1, p.y);
    float w = back * spread * band * (1.0 - tail);
    float a = uWing * w * side;
    float px = side * 0.2, py = 0.1;
    vec2 d = p.xy - vec2(px, py);
    p.xy = mix(p.xy, vec2(px + d.x * cos(a) - d.y * sin(a), py + d.x * sin(a) + d.y * cos(a)), step(0.001, w));
    return p;
  }
`;

// Bob, sway, a little lean while it flies after Pupa, and flapping wings
// (faster on a swoop).
function renderPet(time, swooping) {
  if (!petApi.ready) return false;
  const t = time * .001;
  petTurn.rotation.y = .35 + Math.sin(t * 1.3) * .12;
  petTurn.rotation.z = swooping ? -.25 : Math.sin(t * 2) * .05;
  petTurn.position.y = Math.sin(t * 3) * .05;
  const flap = 1 + Math.sin(t * 9) * .03;
  petTurn.scale.set(flap, 2 - flap, 1);
  wing.uWing.value = Math.sin(t * (swooping ? 14 : 7)) * (swooping ? .5 : .38);
  petRenderer.render(petScene, petCamera);
  return true;
}

// ---- Pumpkin hat ----
// Rendered once into its own canvas; game.js draws it like any other hat.
// The model is uncoloured, so colours are painted per vertex: green stem on
// top, glowing carved face (vertices sunk well inside the shell), orange
// skin everywhere else.
const pumpkinCanvas = document.createElement("canvas");
pumpkinCanvas.width = pumpkinCanvas.height = 192;
const pumpkinApi = { ready: false, canvas: pumpkinCanvas, load: loadPumpkin };
api.pumpkin = pumpkinApi;
let pumpkinLoading = false;

function paintPumpkin(source) {
  const geometry = source.index ? source.toNonIndexed() : source;
  geometry.computeVertexNormals();
  const position = geometry.attributes.position;
  const count = position.count;
  const ROWS = 40, COLS = 72;
  const shell = new Float32Array(ROWS * COLS);
  const cell = (x, y, z) => {
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor((y + 1) / 2 * ROWS)));
    const col = Math.min(COLS - 1, Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI * 2) * COLS));
    return row * COLS + col;
  };
  for (let i = 0; i < count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const c = cell(x, y, z);
    shell[c] = Math.max(shell[c], Math.hypot(x, z));
  }
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    let rgb;
    if (y > .6) rgb = [.12, .3, .04];
    else if (z > .2 && y > -.55 && y < .3 && Math.hypot(x, z) < shell[cell(x, y, z)] * .86) rgb = [1, .62, .06];
    else rgb = [.95, .22 + .04 * (y + 1) / 1.6, .01];
    colors.set(rgb, i * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

function loadPumpkin() {
  if (pumpkinLoading) return;
  pumpkinLoading = true;
  let still;
  try {
    still = new WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: true });
    still.setSize(192, 192, false);
    still.setClearColor(0x000000, 0);
  } catch { return; }
  const stage = new Scene();
  stage.add(new HemisphereLight(0xfff4e0, 0x553322, 2));
  const light = new DirectionalLight(0xffffff, 1.6);
  light.position.set(2, 3, 5);
  stage.add(light);
  const view = new OrthographicCamera(-1.05, 1.05, 1.05, -1.05, .1, 20);
  view.position.set(0, 0, 6);
  new GLTFLoader().load("assets/pumpkin.glb", (gltf) => {
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      const material = new MeshStandardMaterial({ vertexColors: true, roughness: .7 });
      // The carved face glows from inside.
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(1.0, 0.75, 0.25) * step(0.5, vColor.g) * 1.1;");
      };
      const mesh = new Mesh(paintPumpkin(node.geometry), material);
      mesh.rotation.set(.08, .35, 0);
      stage.add(mesh);
    });
    still.render(stage, view);
    pumpkinCanvas.getContext("2d").drawImage(still.domElement, 0, 0);
    still.dispose();
    pumpkinApi.ready = true;
  }, undefined, (error) => console.warn("Pupa3D: pumpkin failed to load", error));
}
