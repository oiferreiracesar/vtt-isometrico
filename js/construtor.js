// js/construtor.js - A Mágica de Construção e Pintura (The Sims Style)
import { scene, camera, canvas } from './engine.js';
import { configMapa, meshChaoBase } from './mapa.js';
import { showAviso, itemSelecionadoAtual } from './ui.js';

export let modoAtivo = null;
export const paredesConstruidas = [];
export const pilaresConstruidos = []; // NOVO: Gerencia as quinas perfeitamente
export const pisosConstruidos = []; 

let arrastandoConstrucao = false;
let pontoA = null;

const materialParede = new THREE.MeshLambertMaterial({ color: 0x6a5f48 });
const materialPiso = new THREE.MeshLambertMaterial({ color: 0x8a7550 });
const materialPrevia = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
const materialCursor = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false });
const materialMarreta = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.6, depthWrite: false });

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
  arrastandoConstrucao = false;
  pontoA = null;
  previaMesh.visible = false;
  cursor3D.visible = false;
}

function snapGrid(valor) { return Math.round(valor / configMapa.tamanhoGrid) * configMapa.tamanhoGrid; }
function snapCentroCelula(valor) { return Math.floor(valor / configMapa.tamanhoGrid) * configMapa.tamanhoGrid + configMapa.tamanhoGrid / 2; }
function obterAltura() { return parseFloat(document.getElementById('inputAlturaParede').value) || 3; }

function raycastChao(clientX, clientY) {
  mouseNdc.x = (clientX / window.innerWidth) * 2 - 1;
  mouseNdc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNdc, camera);
  const hits = raycaster.intersectObject(meshChaoBase);
  return hits.length ? hits[0] : null;
}

function raycastParedesEPisos(clientX, clientY) {
  mouseNdc.x = (clientX / window.innerWidth) * 2 - 1;
  mouseNdc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNdc, camera);
  const objetos = [
      ...paredesConstruidas.map(p => p.mesh), 
      ...pilaresConstruidos.map(p => p.mesh), 
      ...pisosConstruidos.map(p => p.mesh), 
      meshChaoBase
  ];
  const hits = raycaster.intersectObjects(objetos);
  return hits.length ? hits[0] : null;
}

// ----------------------------------------------------
// LÓGICA DE CLIQUE E ARRASTE (Construção)
// ----------------------------------------------------
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !modoAtivo) return;

  // 1. MARRETA (DELETAR COM CTRL)
  if (e.ctrlKey) {
    const hit = raycastParedesEPisos(e.clientX, e.clientY);
    if (hit && hit.object !== meshChaoBase) {
      
      const paredeIdx = paredesConstruidas.findIndex(p => p.mesh === hit.object);
      if (paredeIdx > -1) { removerParede(paredesConstruidas[paredeIdx]); showAviso("🗑️ Parede demolida!"); }
      
      const pilarIdx = pilaresConstruidos.findIndex(p => p.mesh === hit.object);
      if (pilarIdx > -1) {
          const pilarObj = pilaresConstruidos[pilarIdx];
          const attachedWalls = paredesConstruidas.filter(p => p.pilarA === pilarObj || p.pilarB === pilarObj);
          attachedWalls.forEach(p => removerParede(p));
          showAviso("🗑️ Quina demolida!");
      }

      const pisoIdx = pisosConstruidos.findIndex(p => p.mesh === hit.object);
      if (pisoIdx > -1) {
          scene.remove(pisosConstruidos[pisoIdx].mesh);
          pisosConstruidos.splice(pisoIdx, 1);
          showAviso("🗑️ Piso demolido!");
      }
    }
    return;
  }

  if (e.altKey) return; 

  // 2. INICIAR ARRASTE DE SALA/PAREDE
  if (['parede', 'retangulo', 'triangulo', 'octogono'].includes(modoAtivo)) {
    const hit = raycastChao(e.clientX, e.clientY);
    if (hit) {
      pontoA = { x: snapGrid(hit.point.x), z: snapGrid(hit.point.z) };
      arrastandoConstrucao = true;
    }
    return;
  }

  // 3. PINTAR E PORTAS (CLIQUE SIMPLES)
  const hitAll = raycastParedesEPisos(e.clientX, e.clientY);
  if (!hitAll) return;

  if (modoAtivo === 'porta') {
    const paredeAlvo = paredesConstruidas.find(p => p.mesh === hitAll.object);
    if (paredeAlvo) {
      const matPorta = new THREE.MeshLambertMaterial({ color: 0x4a3320 });
      hitAll.object.material = [matPorta, matPorta, matPorta, matPorta, matPorta, matPorta];
      paredeAlvo.isPorta = true;
      showAviso("🚪 Porta instalada!");
    }
    return;
  }

  if (modoAtivo === 'pintura') {
    const item = itemSelecionadoAtual();
    if (!item) { showAviso("Selecione um material no catálogo primeiro!"); return; }

    const isParede = paredesConstruidas.some(p => p.mesh === hitAll.object);
    const isPilar = pilaresConstruidos.some(p => p.mesh === hitAll.object);
    
    // PINTAR COM SHIFT (PREENCHER CÔMODO)
    if (e.shiftKey) {
      const centroX = snapCentroCelula(hitAll.point.x);
      const centroZ = snapCentroCelula(hitAll.point.z);
      const { celulas } = encontrarAreaFechada(centroX, centroZ);
      
      if (isParede || isPilar) {
         celulas.forEach(c => {
           [['x',1],['x',-1],['z',1],['z',-1]].forEach(([eixo, dir]) => {
              const dx = eixo==='x' ? configMapa.tamanhoGrid * dir : 0;
              const dz = eixo==='z' ? configMapa.tamanhoGrid * dir : 0;
              const p = paredeQueBloqueia(c.x, c.z, c.x + dx, c.z + dz);
              
              if (p && !p.isPorta) {
                 const dirNorm = new THREE.Vector3(c.x - p.mesh.position.x, 0, c.z - p.mesh.position.z).normalize();
                 pintarFacePorNormalMundial(p.mesh, dirNorm, item);
                 if (p.pilarA) pintarFacePorNormalMundial(p.pilarA.mesh, dirNorm, item);
                 if (p.pilarB) pintarFacePorNormalMundial(p.pilarB.mesh, dirNorm, item);
              }
           });
         });
         showAviso("🎨 Papel de parede aplicado na sala inteira!");
      } else {
         celulas.forEach(c => aplicarPiso(c.x, c.z, item));
         showAviso("🎨 Piso aplicado na sala inteira!");
      }
    } 
    // PINTAR APENAS UM LADO (CLIQUE SIMPLES)
    else {
      if (isParede || isPilar) {
        const targetObject = hitAll.object;
        const faceClicada = hitAll.face ? hitAll.face.materialIndex : 0;
        
        const localNormals = [
            new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0),
            new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0),
            new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)
        ];
        const worldNormal = localNormals[faceClicada].clone().applyQuaternion(targetObject.quaternion).normalize();

        pintarFacePorNormalMundial(targetObject, worldNormal, item);

        if (isParede) {
            const parede = paredesConstruidas.find(p => p.mesh === targetObject);
            if(!parede.isPorta) {
                if (parede.pilarA) pintarFacePorNormalMundial(parede.pilarA.mesh, worldNormal, item);
                if (parede.pilarB) pintarFacePorNormalMundial(parede.pilarB.mesh, worldNormal, item);
            }
        } else if (isPilar) {
            const pilarObj = pilaresConstruidos.find(p => p.mesh === targetObject);
            const attachedWalls = paredesConstruidas.filter(p => p.pilarA === pilarObj || p.pilarB === pilarObj);
            attachedWalls.forEach(p => { if (!p.isPorta) pintarFacePorNormalMundial(p.mesh, worldNormal, item); });
        }
      } else {
        aplicarPiso(snapCentroCelula(hitAll.point.x), snapCentroCelula(hitAll.point.z), item);
      }
    }
  }
});

canvas.addEventListener('pointermove', e => {
  if (!modoAtivo) return;

  const hit = raycastChao(e.clientX, e.clientY);
  if (hit) {
    const px = snapGrid(hit.point.x), pz = snapGrid(hit.point.z);
    
    cursor3D.material = e.ctrlKey ? materialMarreta : materialCursor;
    cursor3D.scale.set(configMapa.tamanhoGrid, configMapa.tamanhoGrid, 1);
    
    if (modoAtivo === 'pintura') {
      cursor3D.position.set(snapCentroCelula(hit.point.x), 0.02, snapCentroCelula(hit.point.z));
    } else {
      cursor3D.position.set(px, 0.02, pz);
    }
    cursor3D.visible = true;

    if (arrastandoConstrucao && pontoA) {
      if (modoAtivo === 'parede') {
        const dx = px - pontoA.x, dz = pz - pontoA.z;
        const comp = Math.sqrt(dx*dx + dz*dz) || 0.01;
        previaMesh.scale.set(0.25, obterAltura(), comp + 0.25);
        previaMesh.position.set((pontoA.x + px)/2, obterAltura()/2, (pontoA.z + pz)/2);
        previaMesh.rotation.y = Math.atan2(dx, dz);
        previaMesh.visible = true;
      } else {
        const w = Math.abs(px - pontoA.x) || 0.1, d = Math.abs(pz - pontoA.z) || 0.1;
        previaMesh.scale.set(w, obterAltura(), d);
        previaMesh.position.set((pontoA.x + px)/2, obterAltura()/2, (pontoA.z + pz)/2);
        previaMesh.rotation.y = 0; 
        previaMesh.visible = true;
      }
    }
  } else {
    cursor3D.visible = false;
  }
});

window.addEventListener('pointerup', e => {
  if (arrastandoConstrucao && pontoA) {
    const hit = raycastChao(e.clientX, e.clientY);
    if (hit) {
      const px = snapGrid(hit.point.x), pz = snapGrid(hit.point.z);
      if (Math.abs(px - pontoA.x) > 0.1 || Math.abs(pz - pontoA.z) > 0.1) {
        if (modoAtivo === 'parede') criarLinhaDeParedes(pontoA.x, pontoA.z, px, pz, obterAltura());
        else if (modoAtivo === 'retangulo') criarRetangulo(pontoA.x, pontoA.z, px, pz, obterAltura());
        else if (modoAtivo === 'triangulo') criarTriangulo(pontoA.x, pontoA.z, px, pz, obterAltura());
        else if (modoAtivo === 'octogono') criarOctogono(pontoA.x, pontoA.z, px, pz, obterAltura());
      }
    }
    arrastandoConstrucao = false;
    pontoA = null;
    previaMesh.visible = false;
  }
});

// ----------------------------------------------------
// NOVA ARQUITETURA DE QUINAS (PILARES E SEGMENTOS)
// ----------------------------------------------------
function removerParede(parede) {
    scene.remove(parede.mesh);
    const idx = paredesConstruidas.indexOf(parede);
    if (idx > -1) paredesConstruidas.splice(idx, 1);
    limparPilaresSoltos();
}

function limparPilaresSoltos() {
    for (let i = pilaresConstruidos.length - 1; i >= 0; i--) {
        const pilar = pilaresConstruidos[i];
        const emUso = paredesConstruidas.some(p => p.pilarA === pilar || p.pilarB === pilar);
        if (!emUso) {
            scene.remove(pilar.mesh);
            pilaresConstruidos.splice(i, 1);
        }
    }
}

function obterOuCriarPilar(x, z, altura) {
    let pilar = pilaresConstruidos.find(p => Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01);
    if (!pilar) {
        const materiais = [
            materialParede.clone(), materialParede.clone(), materialParede.clone(),
            materialParede.clone(), materialParede.clone(), materialParede.clone()
        ];
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, altura, 0.25), materiais);
        mesh.position.set(x, altura / 2, z);
        scene.add(mesh);
        pilar = { mesh, x, z, altura };
        pilaresConstruidos.push(pilar);
    }
    return pilar;
}

function criarSegmentoParede(ax, az, bx, bz, altura) {
  // Evita duplicar paredes no mesmo lugar exato
  const existe = paredesConstruidas.find(p => 
      (Math.abs(p.ax - ax) < 0.01 && Math.abs(p.az - az) < 0.01 && Math.abs(p.bx - bx) < 0.01 && Math.abs(p.bz - bz) < 0.01) ||
      (Math.abs(p.ax - bx) < 0.01 && Math.abs(p.az - bz) < 0.01 && Math.abs(p.bx - ax) < 0.01 && Math.abs(p.bz - az) < 0.01)
  );
  if (existe) return;

  const dx = bx - ax, dz = bz - az;
  const compTotal = Math.hypot(dx, dz);
  if (compTotal < 0.05) return;
  
  const pilarA = obterOuCriarPilar(ax, az, altura);
  const pilarB = obterOuCriarPilar(bx, bz, altura);

  // A parede agora encaixa EXATAMENTE entre os pilares, erradicando o Z-Fighting de vez
  const compParede = Math.max(0.001, compTotal - 0.25);
  const materiais = [
    materialParede.clone(), materialParede.clone(), materialParede.clone(), 
    materialParede.clone(), materialParede.clone(), materialParede.clone()
  ];

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, altura, compParede), materiais);
  mesh.position.set((ax+bx)/2, altura/2, (az+bz)/2);
  mesh.rotation.y = Math.atan2(dx, dz);
  scene.add(mesh);
  paredesConstruidas.push({ mesh, ax, az, bx, bz, altura, isPorta: false, pilarA, pilarB });
}

function criarLinhaDeParedes(ax, az, bx, bz, altura) {
  const dx = bx - ax, dz = bz - az;
  const compTotal = Math.hypot(dx, dz);
  if (compTotal < 0.05) return;
  const qtd = Math.max(1, Math.round(compTotal / configMapa.tamanhoGrid));
  const stepX = dx / qtd;
  const stepZ = dz / qtd;

  for (let i = 0; i < qtd; i++) {
    criarSegmentoParede(ax + stepX * i, az + stepZ * i, ax + stepX * (i + 1), az + stepZ * (i + 1), altura);
  }
}

function criarPoligonoDeParedes(vertices, altura) {
  for (let i = 0; i < vertices.length; i++) {
    criarLinhaDeParedes(vertices[i].x, vertices[i].z, vertices[(i + 1) % vertices.length].x, vertices[(i + 1) % vertices.length].z, altura);
  }
}

function criarRetangulo(x1, z1, x2, z2, altura) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  criarPoligonoDeParedes([{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }], altura);
}

function criarTriangulo(x1, z1, x2, z2, altura) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  criarPoligonoDeParedes([{ x: (minX + maxX) / 2, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }], altura);
}

function criarOctogono(x1, z1, x2, z2, altura) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  const w = maxX - minX, d = maxZ - minZ, offX = w * 0.3, offZ = d * 0.3;
  criarPoligonoDeParedes([
    { x: minX + offX, z: minZ }, { x: maxX - offX, z: minZ }, { x: maxX, z: minZ + offZ }, { x: maxX, z: maxZ - offZ },
    { x: maxX - offX, z: maxZ }, { x: minX + offX, z: maxZ }, { x: minX, z: maxZ - offZ }, { x: minX, z: minZ + offZ }
  ], altura);
}

// ----------------------------------------------------
// APLICAÇÃO DE PINTURA E PISO
// ----------------------------------------------------
function gerarMaterialPintura(item) {
  const mat = new THREE.MeshLambertMaterial();
  if (item.tipo === 'cor') {
    mat.color.set(item.cor);
  } else {
    const tex = item.textura.clone();
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.5, 1.5);
    mat.map = tex;
    mat.color.set(0xffffff);
  }
  return mat;
}

function aplicarMaterialNaFace(mesh, faceIndex, item) {
  const novosMateriais = [...mesh.material]; 
  novosMateriais[faceIndex] = gerarMaterialPintura(item);
  mesh.material = novosMateriais;
}

function pintarFacePorNormalMundial(mesh, targetNormal, item) {
    const tNorm = targetNormal.clone().normalize();
    const localNormals = [
        new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0),
        new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0),
        new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)
    ];
    for (let i = 0; i < 6; i++) {
        const worldNormal = localNormals[i].clone().applyQuaternion(mesh.quaternion).normalize();
        // Dot product aproxima o ângulo. Se apontar na mesma direção (> 0.5), ele pinta a face.
        if (worldNormal.dot(tNorm) > 0.5) {
            aplicarMaterialNaFace(mesh, i, item);
        }
    }
}

function aplicarPiso(x, z, item) {
  let tile = pisosConstruidos.find(p => Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01);
  if (!tile) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(configMapa.tamanhoGrid, 0.12, configMapa.tamanhoGrid), materialPiso.clone());
    mesh.position.set(x, 0.06, z);
    scene.add(mesh);
    tile = { mesh, x, z };
    pisosConstruidos.push(tile);
  }
  tile.mesh.material = gerarMaterialPintura(item);
}

// ----------------------------------------------------
// ALGORITMO DE FLOOD FILL (ACHAR SALA FECHADA)
// ----------------------------------------------------
function distanciaPontoSegmento(px, pz, ax, az, bx, bz) {
  const compSq = (bx-ax)**2 + (bz-az)**2;
  if (compSq === 0) return Math.hypot(px-ax, pz-az);
  let t = Math.max(0, Math.min(1, ((px-ax)*(bx-ax) + (pz-az)*(bz-az)) / compSq));
  return Math.hypot(px - (ax + t*(bx-ax)), pz - (az + t*(bz-az)));
}

function paredeQueBloqueia(x1, z1, x2, z2) {
  const midX = (x1+x2)/2, midZ = (z1+z2)/2;
  return paredesConstruidas.find(p => {
    return distanciaPontoSegmento(midX, midZ, p.ax, p.az, p.bx, p.bz) < 0.2;
  }) || null;
}

function encontrarAreaFechada(xInicial, zInicial) {
  const visitados = new Set();
  const pilha = [{ x: xInicial, z: zInicial }];
  const celulas = [];
  
  while (pilha.length && celulas.length < 3000) {
    const atual = pilha.pop();
    const chave = `${atual.x.toFixed(2)},${atual.z.toFixed(2)}`;
    
    if (visitados.has(chave)) continue;
    visitados.add(chave);
    
    if (Math.abs(atual.x) > 50 || Math.abs(atual.z) > 50) continue; 
    
    celulas.push(atual);
    
    [[1,0], [-1,0], [0,1], [0,-1]].forEach(([dx, dz]) => {
      const vx = atual.x + dx * configMapa.tamanhoGrid;
      const vz = atual.z + dz * configMapa.tamanhoGrid;
      if (!paredeQueBloqueia(atual.x, atual.z, vx, vz)) {
        pilha.push({ x: vx, z: vz });
      }
    });
  }
  return { celulas };
}

// ----------------------------------------------------
// CONTROLE DE VISÃO DE PAREDES (SIMS STYLE)
// ----------------------------------------------------
export function mudarVisaoParedes(modo) {
  const aplicar = (p) => {
     if (modo === 'full') {
        p.mesh.scale.y = 1; p.mesh.position.y = p.altura / 2;
        if(Array.isArray(p.mesh.material)) p.mesh.material.forEach(m => { m.transparent = false; m.opacity = 1; });
     } else if (modo === 'cut') {
        p.mesh.scale.y = 1; p.mesh.position.y = p.altura / 2;
        if(Array.isArray(p.mesh.material)) p.mesh.material.forEach(m => { m.transparent = true; m.opacity = 0.3; });
     } else if (modo === 'low') {
        p.mesh.scale.y = 0.1; p.mesh.position.y = (p.altura * 0.1) / 2;
        if(Array.isArray(p.mesh.material)) p.mesh.material.forEach(m => { m.transparent = false; m.opacity = 1; });
     }
  };
  paredesConstruidas.forEach(aplicar);
  pilaresConstruidos.forEach(aplicar);
}
