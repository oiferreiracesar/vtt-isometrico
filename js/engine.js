// js/engine.js - Configuração Core do 3D e Câmera Isométrica
export const canvas = document.getElementById('canvas3d');
canvas.addEventListener('contextmenu', e => e.preventDefault());

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14120f);
scene.fog = new THREE.Fog(0x14120f, 25, 90);

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

// HABILITANDO O MOTOR DE SOMBRAS (O Segredo do Breu)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

// --- ILUMINAÇÃO DINÂMICA (The Sims Style) ---
// Luz Ambiente muito fraca, assim salas fechadas viram um breu
scene.add(new THREE.AmbientLight(0x20202a, 0.2)); 

// O Sol (Direcional) que projeta sombras nítidas
const sol = new THREE.DirectionalLight(0xffeedd, 2.0);
sol.position.set(20, 30, 20);
sol.castShadow = true;
sol.shadow.mapSize.width = 2048; // Alta resolução de sombra
sol.shadow.mapSize.height = 2048;
sol.shadow.camera.left = -40;
sol.shadow.camera.right = 40;
sol.shadow.camera.top = 40;
sol.shadow.camera.bottom = -40;
sol.shadow.camera.far = 100;
sol.shadow.bias = -0.001; // Evita falhas pontilhadas na sombra
scene.add(sol);

window.addEventListener('resize', () => {
  atualizarCamera();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
