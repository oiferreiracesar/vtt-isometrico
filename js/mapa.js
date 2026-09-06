// js/mapa.js - Gerenciamento do chão com Anti-Glitch (Z-Fighting Fix)
import { scene } from './engine.js';

export let configMapa = { largura: 32, profundidade: 18, tamanhoGrid: 1 };
export let meshChaoBase;
export let meshChaoMasmorra;
export let gridHelper; 

export function iniciarMapa() { reconstruirGrid(); }

export function redimensionarMapa(novaLargura, novaProfundidade) {
  configMapa.largura = novaLargura; configMapa.profundidade = novaProfundidade;
  reconstruirGrid();
}

export function reconstruirGrid() {
  // Limpeza de memória (Evita acúmulo de chãos velhos caso redimensione o mapa)
  if (meshChaoBase) {
      meshChaoBase.geometry.dispose();
      meshChaoBase.material.dispose();
      scene.remove(meshChaoBase);
  }
  if (meshChaoMasmorra) {
      meshChaoMasmorra.geometry.dispose();
      meshChaoMasmorra.material.dispose();
      scene.remove(meshChaoMasmorra);
  }
  if (gridHelper) {
      gridHelper.geometry.dispose();
      gridHelper.material.dispose();
      scene.remove(gridHelper);
  }
  
  // Chão Térreo (Grama/Terra) - polygonOffset empurra o chão matematicamente para trás
  const materialChaoBase = new THREE.MeshLambertMaterial({ 
      color: 0x2a2620,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
  });
  meshChaoBase = new THREE.Mesh(new THREE.PlaneGeometry(configMapa.largura, configMapa.profundidade), materialChaoBase);
  meshChaoBase.rotation.x = -Math.PI / 2;
  meshChaoBase.position.y = 0;
  scene.add(meshChaoBase);

  // Chão Masmorra (Pedra Escura)
  const materialMasmorra = new THREE.MeshLambertMaterial({ 
      color: 0x121215,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
  });
  meshChaoMasmorra = new THREE.Mesh(new THREE.PlaneGeometry(configMapa.largura, configMapa.profundidade), materialMasmorra);
  meshChaoMasmorra.rotation.x = -Math.PI / 2;
  meshChaoMasmorra.visible = false; 
  scene.add(meshChaoMasmorra);

  const pontos = [];
  const meiaLargura = configMapa.largura / 2, meiaProfundidade = configMapa.profundidade / 2;
  const t = configMapa.tamanhoGrid;

  // Os pontos são gerados no Y = 0 limpo
  for (let x = -meiaLargura; x <= meiaLargura + 1e-6; x += t) { pontos.push(x, 0, -meiaProfundidade, x, 0, meiaProfundidade); }
  for (let z = -meiaProfundidade; z <= meiaProfundidade + 1e-6; z += t) { pontos.push(-meiaLargura, 0, z, meiaLargura, 0, z); }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pontos, 3));
  
  // Grade blindada com depthWrite: false para não brigar com o chão
  gridHelper = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ 
      color: 0x706050, 
      transparent: true, 
      opacity: 0.8,
      depthWrite: false
  })); 
  
  gridHelper.position.y = 0.02; // Garantia de que a grade vai pairar acima do plano
  scene.add(gridHelper);
}