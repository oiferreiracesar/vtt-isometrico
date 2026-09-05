// js/construtor.js - Lógica de construção no plano 3D
import { scene, camera, canvas } from './engine.js';
import { configMapa, meshChaoBase } from './mapa.js';
import { showAviso } from './ui.js';

export let modoAtivo = null;
export const paredesConstruidas = [];

let paredePontoA = null;
let retanguloPontoA = null;
let marcadorPontoA = null;

// Materiais e Geometrias
const materialParede = new THREE.MeshLambertMaterial({ color: 0x6a5f48 });
const materialPrevia = new THREE.MeshBasicMaterial({ color: 0xc9a45e, transparent: true, opacity: 0.5 });
const materialCursor = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });

const cursor3D = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), materialCursor);
cursor3D.rotation.x = -Math.PI / 2;
cursor3D.visible = false;
scene.add(cursor3D);

const previaParede = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materialPrevia);
previaParede.visible = false;
scene.add(previaParede);

const previasRetangulo = [0,1,2,3].map(() => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materialPrevia);
  m.visible = false;
  scene.add(m);
  return m;
});

const raycaster = new THREE.Raycaster();
const mouseNdc = new THREE.Vector2();

export function setModoAtivo(modo) {
  modoAtivo = modo;
  paredePontoA = null;
  retanguloPontoA = null;
  previaParede.visible = false;
  previasRetangulo.forEach(m => m.visible = false);
  cursor3D.visible = false;
  if (marcadorPontoA) { scene.remove(marcadorPontoA); marcadorPontoA = null; }
}

function snapGrid(valor) { return Math.round(valor / configMapa.tamanhoGrid) * configMapa.tamanhoGrid; }

function raycastChao(clientX, clientY) {
  mouseNdc.x = (clientX / window.innerWidth) * 2 - 1;
  mouseNdc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNdc, camera);
  const hits = raycaster.intersectObject(meshChaoBase);
  return hits.length ? hits[0] : null;
}

function obterAltura() { return parseFloat(document.getElementById('inputAlturaParede').value) || 3; }

// --- Lógica Visual de Previsão ---
canvas.addEventListener('pointermove', e => {
  if (!modoAtivo) return;

  const hit = raycastChao(e.clientX, e.clientY);
  if (hit) {
    const px = snapGrid(hit.point.x);
    const pz = snapGrid(hit.point.z);
    
    // Atualiza Cursor
    cursor3D.scale.set(configMapa.tamanhoGrid, configMapa.tamanhoGrid, 1);
    cursor3D.position.set(px, 0.02, pz);
    cursor3D.visible = true;

    // Atualiza Prévia da Parede
    if (modoAtivo === 'parede' && paredePontoA) {
      const dx = px - paredePontoA.x, dz = pz - paredePontoA.z;
      const comp = Math.sqrt(dx*dx + dz*dz) || 0.01;
      previaParede.scale.set(0.25, obterAltura(), comp);
      previaParede.position.set((paredePontoA.x + px)/2, obterAltura()/2, (paredePontoA.z + pz)/2);
      previaParede.rotation.y = Math.atan2(dx, dz);
      previaParede.visible = true;
    }
  } else {
    cursor3D.visible = false;
  }
});

// --- Lógica de Construção ---
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.altKey || !modoAtivo) return; // Apenas clique esquerdo limpo
  
  const hit = raycastChao(e.clientX, e.clientY);
  if (!hit) return;
  const px = snapGrid(hit.point.x), pz = snapGrid(hit.point.z);

  if (modoAtivo === 'parede') {
    if (!paredePontoA) {
      paredePontoA = { x: px, z: pz };
      marcadorPontoA = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      marcadorPontoA.position.set(px, 0.15, pz);
      scene.add(marcadorPontoA);
    } else {
      criarParede(paredePontoA.x, paredePontoA.z, px, pz, obterAltura());
      scene.remove(marcadorPontoA);
      paredePontoA = null;
      marcadorPontoA = null;
      previaParede.visible = false;
    }
  }
});

function criarParede(ax, az, bx, bz, altura) {
  const dx = bx - ax, dz = bz - az;
  const comp = Math.sqrt(dx*dx + dz*dz);
  if (comp < 0.05) return;

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, altura, comp), materialParede.clone());
  mesh.position.set((ax+bx)/2, altura/2, (az+bz)/2);
  mesh.rotation.y = Math.atan2(dx, dz);
  scene.add(mesh);
  
  paredesConstruidas.push({ mesh, ax, az, bx, bz, altura });
  showAviso('Parede construída!');
}
