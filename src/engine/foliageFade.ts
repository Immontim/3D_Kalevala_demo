import * as THREE from "three";

// Lehvästön häivytys: kaksi seulakuvioista (Bayer 4x4) discardia alpha-testatuille
// lehvämateriaaleille. 1) Kameran lähellä oleva lehvä häipyy, ettei se peitä ruutua.
// 2) Kamerasta sankarin rintaan kulkevan kapselin sisällä oleva lehvä harvenee, jotta
// oksa kameran ja sankarin välissä on läpinäkyvä mutta puu ei katoa kokonaan.
// Varjopassi käyttää omaa depth-materiaaliaan, joten varjot pysyvät umpinaisina.

/** Jaetut uniformit: päivitetään kerran ruudussa kamerasta. */
export const foliageFadeUniforms = {
  uCamPos: { value: new THREE.Vector3() },
  uFocus: { value: new THREE.Vector3() },
  uFadeOn: { value: 0 },
};

const FOCUS_HEIGHT = 1.1;

const VERTEX_DECL = /* glsl */ `
varying vec3 vFfWorld;
`;
// Korvaa: #include <project_vertex> (lisätään sen perään; `transformed` on jo määritelty).
const VERTEX_BODY = /* glsl */ `
#include <project_vertex>
{
  vec4 ffLocal = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    ffLocal = instanceMatrix * ffLocal;
  #endif
  vFfWorld = ( modelMatrix * ffLocal ).xyz;
}
`;

const FRAGMENT_DECL = /* glsl */ `
varying vec3 vFfWorld;
uniform vec3 uCamPos;
uniform vec3 uFocus;
uniform float uFadeOn;

float ffBayer4( vec2 p ) {
  vec2 q = mod( floor( p ), 4.0 );
  float x = q.x, y = q.y;
  // Bayer 4x4 -matriisi 0..15 ilman taulukkoindeksointia.
  float a = mod( x, 2.0 ), b = mod( floor( x / 2.0 ), 2.0 );
  float c = mod( y, 2.0 ), d = mod( floor( y / 2.0 ), 2.0 );
  // Bittien lomitus: (x^y)-bitit ja y-bitit vuorotellen, käännetty järjestys.
  float xa = abs( a - c ), xb = abs( b - d );
  return ( xa * 8.0 + c * 4.0 + xb * 2.0 + d ) / 16.0;
}
`;
// Korvaa: #include <alphatest_fragment> (häivytys ajetaan ennen sitä).
const FRAGMENT_BODY = /* glsl */ `
if ( uFadeOn > 0.5 ) {
  float ffVis = 1.0;
  float ffDist = distance( vFfWorld, uCamPos );
  ffVis *= smoothstep( 0.9, 2.2, ffDist );
  vec3 ffAB = uFocus - uCamPos;
  float ffLen = length( ffAB );
  vec3 ffDir = ffAB / max( ffLen, 0.001 );
  float ffAlong = dot( vFfWorld - uCamPos, ffDir );
  float ffPerp = length( vFfWorld - ( uCamPos + ffDir * ffAlong ) );
  float ffRange = smoothstep( 0.6, 1.2, ffAlong ) * ( 1.0 - smoothstep( ffLen - 1.6, ffLen - 1.0, ffAlong ) );
  float ffW = ( 1.0 - smoothstep( 0.35, 0.9, ffPerp ) ) * ffRange;
  ffVis *= 1.0 - 0.8 * ffW;
  if ( ffVis <= ffBayer4( gl_FragCoord.xy ) + 0.03 ) discard;
}
#include <alphatest_fragment>
`;

/**
 * Lisää häivytyksen materiaalin shaderiin. Ketjuttaa olemassa olevan onBeforeCompile-funktion
 * ja customProgramCacheKeyn. Toimii MeshStandardMaterialilla, myös InstancedMeshin kanssa.
 */
export function addFoliageFade(material: THREE.Material): void {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey;
  material.onBeforeCompile = function (this: THREE.Material, shader, renderer) {
    prev.call(this, shader, renderer);
    shader.uniforms.uCamPos = foliageFadeUniforms.uCamPos;
    shader.uniforms.uFocus = foliageFadeUniforms.uFocus;
    shader.uniforms.uFadeOn = foliageFadeUniforms.uFadeOn;
    shader.vertexShader = VERTEX_DECL + shader.vertexShader.replace("#include <project_vertex>", VERTEX_BODY);
    shader.fragmentShader = FRAGMENT_DECL + shader.fragmentShader.replace("#include <alphatest_fragment>", FRAGMENT_BODY);
  };
  material.customProgramCacheKey = function (this: THREE.Material) {
    return `${prevKey.call(this)}|foliageFade`;
  };
  material.needsUpdate = true;
}

/** Päivittää uniformit kerran ruudussa. focus = null (tai vapaa kamera) kytkee häivytyksen pois. */
export function updateFoliageFade(camera: THREE.Camera, focus: THREE.Vector3 | null): void {
  foliageFadeUniforms.uCamPos.value.copy(camera.position);
  if (!focus) {
    foliageFadeUniforms.uFadeOn.value = 0;
    return;
  }
  foliageFadeUniforms.uFocus.value.set(focus.x, focus.y + FOCUS_HEIGHT, focus.z);
  foliageFadeUniforms.uFadeOn.value = 1;
}
