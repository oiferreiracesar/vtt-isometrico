// js/mapa.js - Gerenciamento do chão e dimensões do tabuleiro
import { scene } from './engine.js';

export let configMapa = { largura: 32, profundidade: 18, tamanhoGrid: 1 };
export let meshChaoBase;
let gridHelper;

export function iniciarMapa() { reconstruirGrid(); }

export function redimensionarMapa(novaLargura, novaProfundidade) {
  configMapa.largura = novaLargura; configMapa.profundidade = novaProfundidade;
  reconstruirGrid();
}

export function reconstruirGrid() {
  if (meshChaoBase) scene.remove(meshChaoBase);
  if (gridHelper) scene.remove(gridHelper);
  
  const materialChaoBase = new THREE.MeshLambertMaterial({ color: 0x2a2620 });
  meshChaoBase = new THREE.Mesh(new THREE.PlaneGeometry(configMapa.largura, configMapa.profundidade), materialChaoBase);
  meshChaoBase.rotation.x = -Math.PI / 2;
  meshChaoBase.position.y = 0;
  
  // O CHÃO AGORA RECEBE SOMBRAS!
  meshChaoBase.receiveShadow = true; 
  
  scene.add(meshChaoBase);

  const pontos = [];
  const meiaLargura = configMapa.largura / 2, meiaProfundidade = configMapa.profundidade / 2;
  const t = configMapa.tamanhoGrid;

  for (let x = -meiaLargura; x <= meiaLargura + 1e-6; x += t) { pontos.push(x, 0.01, -meiaProfundidade, x, 0.01, meiaProfundidade); }
  for (let z = -meiaProfundidade; z <= meiaProfundidade + 1e-6; z += t) { pontos.push(-meiaLargura, 0.01, z, meiaLargura, 0.01, z); }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pontos, 3));
  gridHelper = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x4a4030, transparent: true, opacity: 0.5 }));
  scene.add(gridHelper);
}
