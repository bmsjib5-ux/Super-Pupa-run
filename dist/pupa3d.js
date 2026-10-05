// 3D Pupa renderer. Draws the GLB model into a small transparent WebGL canvas
// that game.js stamps onto the 2D stage in place of the sprite.
import {
  WebGLRenderer, Scene, OrthographicCamera, Group, Mesh, MeshStandardMaterial,
  HemisphereLight, DirectionalLight, TextureLoader, SRGBColorSpace,
  BufferAttribute, MathUtils, GLTFLoader
} from "./vendor/three-bundle.min.js";

const SIZE = 384;
const VIEW = 1.3; // half-height of the camera frustum in model units
const canvas = document.createElement("canvas");
canvas.width = canvas.height = SIZE;

const api = { ready: false, canvas, viewHalf: VIEW, render };
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
  const float LEG_TOP = -0.50; const float ARM_X = 0.44;
  const float ARM_LOW = -0.46; const float ARM_HIGH = -0.02;
  vec3 swingLimbs(vec3 p) {
    float side = p.x < 0.0 ? -1.0 : 1.0;
    float leg = 1.0 - smoothstep(LEG_TOP - 0.14, LEG_TOP + 0.02, p.y);
    float la = side * sin(uPhase) * uSwing * 0.85 * leg;
    float ly = p.y - LEG_TOP;
    p.yz = mix(p.yz, vec2(LEG_TOP + ly * cos(la) - p.z * sin(la), ly * sin(la) + p.z * cos(la)), step(0.001, leg));
    float arm = smoothstep(ARM_X, ARM_X + 0.14, abs(p.x))
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

if (renderer) {
  const texture = new TextureLoader().load("assets/pupa-texture.webp");
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  new GLTFLoader().load("assets/pupa.glb", (gltf) => {
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      const geometry = node.geometry;
      projectTexture(geometry);
      const material = new MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, limbs);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${LIMB_SHADER}`)
          .replace("#include <begin_vertex>", "vec3 transformed = swingLimbs(position);");
      };
      turn.add(new Mesh(geometry, material));
    });
    api.ready = turn.children.length > 0;
  }, undefined, (error) => console.warn("Pupa3D: model failed to load", error));
}

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

  yaw += (pose.facing * .75 - yaw) * ease(11);
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
