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
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uSong: { value: 0 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSong; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.92);                                   // hieman hillitympi värikylläisyys
      c *= mix(vec3(0.93, 0.98, 1.06), vec3(1.05, 1.0, 0.93), smoothstep(0.1, 0.8, l));   // viileät varjot, lämpimät valot
      c = (c - 0.5) * 1.06 + 0.5;
      vec2 d = vUv - 0.5;
      c *= 1.0 - dot(d, d) * 0.55;                                 // vinjetti
      if (uSong > 0.0) {
        // Laulun haalistus: sama kuin aiempi CSS-suodin saturate(0.3) sepia(0.25) contrast(1.1) brightness(0.92)
        // ja ruskea reunavinjetti, mutta osana tätä vaihetta eikä selaimen erillisenä koko ruudun suodatuksena.
        vec3 s = clamp(c, 0.0, 1.0);
        s = clamp(mat3(0.4491, 0.1491, 0.1491, 0.5005, 0.8005, 0.5005, 0.0504, 0.0504, 0.3504) * s, 0.0, 1.0);
        s = clamp(mat3(0.8467, 0.0873, 0.0680, 0.1923, 0.9215, 0.1335, 0.0473, 0.0420, 0.7828) * s, 0.0, 1.0);
        s = clamp((s - 0.5) * 1.1 + 0.5, 0.0, 1.0) * 0.92;
        float e = clamp((length(d) * 1.41421 - 0.45) / 0.55, 0.0, 1.0);
        s = mix(s, vec3(0.118, 0.078, 0.020), e * 0.75);
        c = mix(c, s, uSong);
      }
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(grade);

let songLookOn = false;
/** Laulun ja laulunvalinnan haalistettu ilme päälle tai pois; vaihtuu 0,4 s:ssa todellista aikaa. */
export function setSongLook(on: boolean) { songLookOn = on; }
export function updateSongLook(realDt: number) {
  const target = songLookOn && !document.body.classList.contains("freecam") ? 1 : 0;
  const u = grade.uniforms.uSong;
  u.value = target > u.value ? Math.min(target, u.value + realDt / 0.4) : Math.max(target, u.value - realDt / 0.4);
}

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
