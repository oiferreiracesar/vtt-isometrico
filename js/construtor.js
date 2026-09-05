// js/construtor.js - Lógica de construção de formas geométricas no plano 3D
import { scene, camera, canvas } from './engine.js';
import { configMapa, meshChaoBase } from './mapa.js';
import { showAviso } from './ui.js';

export let modoAtivo = null;
export const paredesConstruidas = [];

let pontoA = null;
let marcadorPontoA = null;

const materialParede = new THREE.MeshLambertMaterial({ color: 0x6a5f48 });
const materialPrevia = new THREE.MeshBasicMaterial({ color: 0xc9a45e, transparent: true, opacity: 0.5 });
const materialCursor = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });

const cursor3D = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), materialCursor);
cursor3D.rotation.x = -Math.PI / 2;
cursor3D.visible = false;
scene.add(cursor3D);

const previaMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materialPrevia);
previaMesh.visible = false;
scene.add(previaMesh);

const raycaster = new THREE.Raycaster();
const mouseNdc = new THREE.Vector2();

export function setModoAtivo(modo) {
  modoAtivo = modo;
  pontoA = null;
  previaMesh.visible = false;
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

// --- Prévia Visual ---
canvas.addEventListener('pointermove', e => {
  if (!modoAtivo) return;
  const hit = raycastChao(e.clientX, e.clientY);
  if (hit) {
    const px = snapGrid(hit.point.x);
    const pz = snapGrid(hit.point.z);
    
    cursor3D.scale.set(configMapa.tamanhoGrid, configMapa.tamanhoGrid, 1);
    cursor3D.position.set(px, 0.02, pz);
    cursor3D.visible = true;

    if (modoAtivo === 'parede' && pontoA) {
      const dx = px - pontoA.x, dz = pz - pontoA.z;
      const comp = Math.sqrt(dx*dx + dz*dz) || 0.01;
      previaMesh.scale.set(0.25, obterAltura(), comp + 0.25);
      previaMesh.position.set((pontoA.x + px)/2, obterAltura()/2, (pontoA.z + pz)/2);
      previaMesh.rotation.y = Math.atan2(dx, dz);
      previaMesh.visible = true;
    } else if ((modoAtivo === 'retangulo' || modoAtivo === 'triangulo' || modoAtivo === 'octogono') && pontoA) {
      const w = Math.abs(px - pontoA.x) || 0.1;
      const d = Math.abs(pz - pontoA.z) || 0.1;
      previaMesh.scale.set(w, obterAltura(), d);
      previaMesh.position.set((pontoA.x + px)/2, obterAltura()/2, (pontoA.z + pz)/2);
      previaMesh.rotation.y = 0;
      previaMesh.visible = true;
    }
  } else {
    cursor3D.visible = false;
  }
});

// --- Cliques e Execução ---
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.altKey || !modoAtivo) return;
  const hit = raycastChao(e.clientX, e.clientY);
  if (!hit) return;
  const px = snapGrid(hit.point.x), pz = snapGrid(hit.point.z);

  if (modoAtivo === 'parede') {
    if (!pontoA) {
      pontoA = { x: px, z: pz };
      marcadorPontoA = criarMarcador(px, pz);
    } else {
      criarSegmentoParede(pontoA.x, pontoA.z, px, pz, obterAltura());
      removerMarcador();
      previaMesh.visible = false;
    }
  } else if (modoAtivo === 'retangulo') {
    if (!pontoA) {
      pontoA = { x: px, z: pz };
      marcadorPontoA = criarMarcador(px, pz);
    } else {
      criarRetangulo(pontoA.x, pontoA.z, px, pz, obterAltura());
      removerMarcador();
      previaMesh.visible = false;
    }
  } else if (modoAtivo === 'triangulo') {
    if (!pontoA) {
      pontoA = { x: px, z: pz };
      marcadorPontoA = criarMarcador(px, pz);
    } else {
      criarTriangulo(pontoA.x, pontoA.z, px, pz, obterAltura());
      removerMarcador();
      previaMesh.visible = false;
    }
  } else if (modoAtivo === 'octogono') {
    if (!pontoA) {
      pontoA = { x: px, z: pz };
      marcadorPontoA = criarMarcador(px, pz);
    } else {
      criarOctogono(pontoA.x, pontoA.z, px, pz, obterAltura());
      removerMarcador();
      previaMesh.visible = false;
    }
  }
});

function criarMarcador(x, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
  m.position.set(x, 0.15, z);
  scene.add(m);
  return m;
}

function removerMarcador() {
  if (marcadorPontoA) { scene.remove(marcadorPontoA); marcadorPontoA = null; }
  pontoA = null;
}

function criarSegmentoParede(ax, az, bx, bz, altura) {
  const dx = bx - ax, dz = bz - az;
  const comp = Math.sqrt(dx*dx + dz*dz);
  if (comp < 0.05) return;

  const espessura = 0.25;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(espessura, altura, comp + espessura), materialParede.clone());
  mesh.position.set((ax+bx)/2, altura/2, (az+bz)/2);
  mesh.rotation.y = Math.atan2(dx, dz);
  scene.add(mesh);
  
  paredesConstruidas.push({ mesh, ax, az, bx, bz, altura });
  showAviso('Parede construída!');
}

function criarPoligonoDeParedes(vertices, altura) {
  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];
    criarSegmentoParede(p1.x, p1.z, p2.x, p2.z, altura);
  }
}

function criarRetangulo(x1, z1, x2, z2, altura) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  const vertices = [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ }
  ];
  criarPoligonoDeParedes(vertices, altura);
  showAviso('Sala Retangular construída!');
}

function criarTriangulo(x1, z1, x2, z2, altura) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  const vertices = [
    { x: (minX + maxX) / 2, z: minZ }, // Topo ao centro
    { x: maxX, z: maxZ },               // Canto inferior direito
    { x: minX, z: maxZ }                // Canto inferior esquerdo
  ];
  criarPoligonoDeParedes(vertices, altura);
  showAviso('Sala Triangular construída!');
}

function criarOctogono(x1, z1, x2, z2, altura) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  const w = maxX - minX, d = maxZ - minZ;
  
  // Proporção de corte para as quinas do octógono (30% do tamanho)
  const offX = w * 0.3;
  const offZ = d * 0.3;

  const vertices = [
    { x: minX + offX, z: minZ },
    { x: maxX - offX, z: minZ },
    { x: maxX, z: minZ + offZ },
    { x: maxX, z: maxZ - offZ },
    { x: maxX - offX, z: maxZ },
    { x: minX + offX, z: maxZ },
    { x: minX, z: maxZ - offZ },
    { x: minX, z: minZ + offZ }
  ];
  criarPoligonoDeParedes(vertices, altura);
  showAviso('Sala Octogonal construída!');
}
