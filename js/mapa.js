// js/mapa.js - Gerenciamento do chão, grid e construção
import { scene } from './engine.js';

export let configMapa = {
  larguraChao: 32,
  tamanhoGrid: 1,
  imagemChaoDataUrl: null
};

export let meshChaoBase;
let gridHelper;

export function iniciarMapa() {
  const profundidadeChao = configMapa.larguraChao * 9 / 16;
  
  const materialChaoBase = new THREE.MeshLambertMaterial({ color: 0x2a2620 });
  meshChaoBase = new THREE.Mesh(new THREE.PlaneGeometry(configMapa.larguraChao, profundidadeChao), materialChaoBase);
  meshChaoBase.rotation.x = -Math.PI / 2;
  meshChaoBase.position.y = 0;
  scene.add(meshChaoBase);

  reconstruirGrid();
}

export function reconstruirGrid() {
  if (gridHelper) scene.remove(gridHelper);
  
  const profundidadeChao = configMapa.larguraChao * 9 / 16;
  const pontos = [];
  const meiaLargura = configMapa.larguraChao / 2;
  const meiaProfundidade = profundidadeChao / 2;
  const t = configMapa.tamanhoGrid;

  for (let x = -meiaLargura; x <= meiaLargura + 1e-6; x += t) {
    pontos.push(x, 0.01, -meiaProfundidade, x, 0.01, meiaProfundidade);
  }
  for (let z = -meiaProfundidade; z <= meiaProfundidade + 1e-6; z += t) {
    pontos.push(-meiaLargura, 0.01, z, meiaLargura, 0.01, z);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pontos, 3));
  gridHelper = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x4a4030 }));
  scene.add(gridHelper);
}
