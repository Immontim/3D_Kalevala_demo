// Piirto: canvas, renderöijä, näkymä (scene), kamera, maailma ja jälkikäsittely.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { setCharacterEnv } from "../fighter";
import { buildWorld } from "../world";

export const canvas = document.getElementById("c") as HTMLCanvasElement;
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
export const world = buildWorld(scene, renderer);


// Jälkikäsittely: hehku (nuotio, vastavalo), sävytys ja vinjetti. MSAA säilyy renderöintikohteessa.
export const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.14, 0.5, 1.0));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.92);                                   // hieman hillitympi värikylläisyys
      c *= mix(vec3(0.93, 0.98, 1.06), vec3(1.05, 1.0, 0.93), smoothstep(0.1, 0.8, l));   // viileät varjot, lämpimät valot
      c = (c - 0.5) * 1.06 + 0.5;
      vec2 d = vUv - 0.5;
      c *= 1.0 - dot(d, d) * 0.55;                                 // vinjetti
      gl_FragColor = vec4(c, 1.0);
    }`,
}));

export function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

export function initView() {
  setCharacterEnv(world.envMap);

  window.addEventListener("resize", resize);
  resize();
}
