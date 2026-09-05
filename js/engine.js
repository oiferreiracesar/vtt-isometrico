// js/engine.js - Configuração Core do 3D e Câmera Isométrica

export const canvas = document.getElementById('canvas3d');
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14120f);
scene.fog = new THREE.Fog(0x14120f, 25, 90);

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Configuração da Câmera Ortográfica (Isométrica)
const tamCena = 15; 
export let configsCamera = { 
  zoom: 1, 
  angulo: Math.PI / 4, // 45 Graus Iniciais
  nivel: 0             // Andar 0 (Térreo)
};
export const orbitAlvo = new THREE.Vector3(0, 0, 0);

const aspecto = window.innerWidth / window.innerHeight;
export const camera = new THREE.OrthographicCamera(-tamCena * aspecto, tamCena * aspecto, tamCena, -tamCena, -100, 1000);

export function atualizarCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const d = tamCena / configsCamera.zoom;
  
  camera.left = -d * aspect;
  camera.right = d * aspect;
  camera.top = d;
  camera.bottom = -d;
  camera.updateProjectionMatrix();

  // A distância XZ para isométrico clássico é 20 * sqrt(2) = 28.284
  const raioIsometrico = 28.28427;
  
  // Calcula a posição baseada no giro da câmera
  const camX = orbitAlvo.x + raioIsometrico * Math.cos(configsCamera.angulo);
  const camZ = orbitAlvo.z + raioIsometrico * Math.sin(configsCamera.angulo);
  
  // O Y da câmera sobe dependendo do andar atual
  orbitAlvo.y = configsCamera.nivel * 3; 

  camera.position.set(camX, orbitAlvo.y + 20, camZ);
  camera.lookAt(orbitAlvo);
}
atualizarCamera();

// Luzes
scene.add(new THREE.AmbientLight(0x6a5f4a, 1.6));
scene.add(new THREE.HemisphereLight(0x8a7a5a, 0x1a1610, 1.0));
const luzDirecional = new THREE.DirectionalLight(0xfff2d8, 0.9);
luzDirecional.position.set(15, 25, 10);
scene.add(luzDirecional);

window.addEventListener('resize', () => {
  atualizarCamera();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
