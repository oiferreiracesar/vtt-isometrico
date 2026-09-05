// js/engine.js - Configuração Core do 3D e Câmera Isométrica
export const canvas = document.getElementById('canvas3d');

// BLINDAGEM ELEGANTE: Bloqueia o menu do Mac sem matar os cliques do jogo!
window.addEventListener('contextmenu', e => { e.preventDefault(); }, { capture: true });

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14120f);
scene.fog = new THREE.Fog(0x14120f, 25, 90);

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const tamCena = 15; 
export let configsCamera = { zoom: 1, angulo: Math.PI / 4, nivel: 0 };
export const orbitAlvo = new THREE.Vector3(0, 0, 0);
const aspecto = window.innerWidth / window.innerHeight;
export const camera = new THREE.OrthographicCamera(-tamCena * aspecto, tamCena * aspecto, tamCena, -tamCena, -100, 1000);

export function atualizarCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const d = tamCena / configsCamera.zoom;
  camera.left = -d * aspect; camera.right = d * aspect;
  camera.top = d; camera.bottom = -d;
  camera.updateProjectionMatrix();

  const raioIsometrico = 28.28427;
  const camX = orbitAlvo.x + raioIsometrico * Math.cos(configsCamera.angulo);
  const camZ = orbitAlvo.z + raioIsometrico * Math.sin(configsCamera.angulo);
  orbitAlvo.y = configsCamera.nivel * 3; 

  camera.position.set(camX, orbitAlvo.y + 20, camZ);
  camera.lookAt(orbitAlvo);
}
atualizarCamera();

scene.add(new THREE.AmbientLight(0xffffff, 0.8)); 
const luzPrincipal = new THREE.DirectionalLight(0xffffff, 0.8);
luzPrincipal.position.set(20, 30, 20);
scene.add(luzPrincipal);
const luzSecundaria = new THREE.DirectionalLight(0xffffff, 0.5);
luzSecundaria.position.set(-20, 30, -20);
scene.add(luzSecundaria);

window.addEventListener('resize', () => {
  atualizarCamera();
  renderer.setSize(window.innerWidth, window.innerHeight);
});