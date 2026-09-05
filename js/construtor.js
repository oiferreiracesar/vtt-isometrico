// js/construtor.js - Múltiplos Andares e Arquitetura de "Cômodos" (The Sims 4 Style)
import { scene, camera, canvas, configsCamera } from './engine.js';
import { configMapa, meshChaoBase } from './mapa.js';
import { showAviso, itemSelecionadoAtual } from './ui.js';

export let modoAtivo = null;
export let modoVisaoAtual = 'full';

// O Banco de Dados Central
export const comodosConstruidos = []; // Guarda os RGs dos cômodos
export const paredesConstruidas = [];
export const pilaresConstruidos = []; 
export const pisosConstruidos = []; 
export const escadasConstruidas = [];
export const colunasSustentacao = [];

let arrastandoConstrucao = false;
let comodoArrastado = null; 
let pontoA = null; // Usado tanto para criar paredes quanto para iniciar o arraste

const materialParede = new THREE.MeshLambertMaterial({ color: 0x6a5f48 });
const materialCerca = new THREE.MeshLambertMaterial({ color: 0x5a4f38 }); 
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
  comodoArrastado = null;
  previaMesh.visible = false;
  cursor3D.visible = false;
}

function snapGrid(valor) { return Math.round(valor / configMapa.tamanhoGrid) * configMapa.tamanhoGrid; }
function snapCentroCelula(valor) { return Math.floor(valor / configMapa.tamanhoGrid) * configMapa.tamanhoGrid + configMapa.tamanhoGrid / 2; }
function obterAltura() { return parseFloat(document.getElementById('inputAlturaParede').value) || 3; }

function raycastPlanoBase(clientX, clientY) {
  mouseNdc.x = (clientX / window.innerWidth) * 2 - 1;
  mouseNdc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNdc, camera);
  const alturaNivelAtual = configsCamera.nivel * obterAltura();
  const planoFlutuante = new THREE.Plane(new THREE.Vector3(0, 1, 0), -alturaNivelAtual);
  const pontoIntersectado = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(planoFlutuante, pontoIntersectado)) return { point: pontoIntersectado };
  return null;
}

function raycastObjetosDoNivel(clientX, clientY) {
  mouseNdc.x = (clientX / window.innerWidth) * 2 - 1;
  mouseNdc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNdc, camera);
  const paredesF = paredesConstruidas.filter(p => p.nivel === configsCamera.nivel).map(p => p.mesh);
  const pilaresF = pilaresConstruidos.filter(p => p.nivel === configsCamera.nivel).map(p => p.mesh);
  const pisosF = pisosConstruidos.filter(p => p.nivel === configsCamera.nivel).map(p => p.mesh);
  const colunasF = colunasSustentacao.filter(p => p.nivel === configsCamera.nivel).map(p => p.mesh);
  const escadasF = []; 
  escadasConstruidas.forEach(e => { if (e.nivel === configsCamera.nivel) escadasF.push(...e.mesh.children); });
  
  const objetosNivel = [...paredesF, ...pilaresF, ...pisosF, ...colunasF, ...escadasF];
  if (configsCamera.nivel === 0) objetosNivel.push(meshChaoBase);

  const hits = raycaster.intersectObjects(objetosNivel, true);
  return hits.length ? hits[0] : null;
}

function executarMarreta(hitObject) {
  if (hitObject === meshChaoBase) return;
  const isPiso = pisosConstruidos.some(p => p.mesh === hitObject);
  const isParedeMode = ['parede', 'cerca', 'retangulo', 'triangulo', 'octogono'].includes(modoAtivo);
  if (isParedeMode && isPiso) return;
  
  const paredeIdx = paredesConstruidas.findIndex(p => p.mesh === hitObject);
  if (paredeIdx > -1) { removerParede(paredesConstruidas[paredeIdx]); }
  
  const pilarIdx = pilaresConstruidos.findIndex(p => p.mesh === hitObject);
  if (pilarIdx > -1) {
      const pilarObj = pilaresConstruidos[pilarIdx];
      const attachedWalls = paredesConstruidas.filter(p => p.pilarA === pilarObj || p.pilarB === pilarObj);
      attachedWalls.forEach(p => removerParede(p));
  }
  
  const pisoIdx = pisosConstruidos.findIndex(p => p.mesh === hitObject);
  if (pisoIdx > -1) { scene.remove(pisosConstruidos[pisoIdx].mesh); pisosConstruidos.splice(pisoIdx, 1); }
  const colIdx = colunasSustentacao.findIndex(p => p.mesh === hitObject);
  if (colIdx > -1) { scene.remove(colunasSustentacao[colIdx].mesh); colunasSustentacao.splice(colIdx, 1); }
  const escadaIdx = escadasConstruidas.findIndex(e => e.mesh === hitObject.parent);
  if (escadaIdx > -1) { scene.remove(escadasConstruidas[escadaIdx].mesh); escadasConstruidas.splice(escadaIdx, 1); }
}

// ----------------------------------------------------
// INTERAÇÕES E ARRASTAR CÔMODOS
// ----------------------------------------------------
canvas.addEventListener('pointerdown', e => {
  e.preventDefault(); 
  if (e.button !== 0 || !modoAtivo) return;

  if (e.ctrlKey && modoAtivo !== 'pintura' && modoAtivo !== 'selecao') {
    const hit = raycastObjetosDoNivel(e.clientX, e.clientY);
    if (hit) executarMarreta(hit.object);
    return;
  }
  if (e.altKey) return; 

  // MODO SELEÇÃO: O Coração da Fase 1 (The Sims 4 Engine)
  if (modoAtivo === 'selecao') {
      const hitAll = raycastObjetosDoNivel(e.clientX, e.clientY);
      if (hitAll) {
          const target = hitAll.object;
          const paredeClicada = paredesConstruidas.find(p => p.mesh === target);
          const pilarClicado = pilaresConstruidos.find(p => p.mesh === target);
          const objClicado = paredeClicada || pilarClicado;

          if (objClicado && objClicado.comodoId) {
              // Acha todo o grupo ao qual a parede clicada pertence
              comodoArrastado = comodosConstruidos.find(c => c.id === objClicado.comodoId);
              const chaoHit = raycastPlanoBase(e.clientX, e.clientY);
              
              if (chaoHit && comodoArrastado) {
                  pontoA = { x: snapGrid(chaoHit.point.x), z: snapGrid(chaoHit.point.z) };
                  
                  // Salva as coordenadas iniciais antes de começar a arrastar (Isso garante precisão na hora de mover)
                  comodoArrastado.paredesIniciais = comodoArrastado.paredes.map(p => ({
                      parede: p, ax: p.ax, az: p.az, bx: p.bx, bz: p.bz, mx: p.mesh.position.x, mz: p.mesh.position.z
                  }));
                  comodoArrastado.pilaresIniciais = comodoArrastado.pilares.map(p => ({
                      pilar: p, x: p.x, z: p.z, mx: p.mesh.position.x, mz: p.mesh.position.z
                  }));
                  
                  // Efeito Visual de Seleção (Dá um "Brilho" na Sala Selecionada)
                  comodoArrastado.paredes.forEach(p => p.mesh.material.forEach(m => m.emissive.setHex(0x2a2a2a)));
                  showAviso("✨ Cômodo selecionado. Arraste para mover.");
              }
          } else if (objClicado && !objClicado.comodoId) {
              showAviso("Essa parede foi construída na versão antiga e não forma um cômodo móvel.");
          }
      }
      return;
  }

  if (['parede', 'cerca', 'escada', 'retangulo', 'triangulo', 'octogono'].includes(modoAtivo)) {
    const hit = raycastPlanoBase(e.clientX, e.clientY);
    if (hit) { pontoA = { x: snapGrid(hit.point.x), z: snapGrid(hit.point.z) }; arrastandoConstrucao = true; }
    return;
  }

  if (modoAtivo === 'coluna') {
     const hit = raycastPlanoBase(e.clientX, e.clientY);
     if (hit) { criarColunaSustentacao(snapGrid(hit.point.x), snapGrid(hit.point.z), obterAltura()); showAviso("🏛️ Coluna instalada!"); }
     return;
  }

  const hitAll = raycastObjetosDoNivel(e.clientX, e.clientY);
  if (!hitAll) return;

  if (modoAtivo === 'porta') {
    const paredeAlvo = paredesConstruidas.find(p => p.mesh === hitAll.object && p.nivel === configsCamera.nivel);
    if (paredeAlvo && !paredeAlvo.isCerca) { 
      const matPorta = new THREE.MeshLambertMaterial({ color: 0x4a3320 });
      hitAll.object.material = [matPorta, matPorta, matPorta, matPorta, matPorta, matPorta];
      paredeAlvo.isPorta = true;
    }
    return;
  }

  if (modoAtivo === 'pintura') {
    const isRemocao = e.ctrlKey; 
    const item = itemSelecionadoAtual();
    if (!isRemocao && !item) return;

    const isEscada = escadasConstruidas.some(e => e.mesh === hitAll.object.parent);
    if (isEscada) {
        const escada = escadasConstruidas.find(e => e.mesh === hitAll.object.parent);
        escada.mesh.children.forEach(step => { step.material = isRemocao ? materialPiso.clone() : gerarMaterialPintura(item, configMapa.tamanhoGrid, configMapa.tamanhoGrid); });
        return;
    }

    const isParede = paredesConstruidas.some(p => p.mesh === hitAll.object);
    const isPilar = pilaresConstruidos.some(p => p.mesh === hitAll.object);
    const isColuna = colunasSustentacao.some(p => p.mesh === hitAll.object);
    
    if (e.shiftKey) {
      const centroX = snapCentroCelula(hitAll.point.x), centroZ = snapCentroCelula(hitAll.point.z);
      const { celulas } = encontrarAreaFechada(centroX, centroZ);
      if (isParede || isPilar) {
         celulas.forEach(c => {
           [['x',1],['x',-1],['z',1],['z',-1]].forEach(([eixo, dir]) => {
              const dx = eixo==='x' ? configMapa.tamanhoGrid * dir : 0, dz = eixo==='z' ? configMapa.tamanhoGrid * dir : 0;
              const p = paredeQueBloqueia(c.x, c.z, c.x + dx, c.z + dz);
              if (p && !p.isPorta && !p.isCerca) { 
                 const dirNorm = new THREE.Vector3(c.x - p.mesh.position.x, 0, c.z - p.mesh.position.z).normalize();
                 if (isRemocao) {
                     removerPinturaFacePorNormal(p.mesh, dirNorm, materialParede);
                     if (p.pilarA) removerPinturaFacePorNormal(p.pilarA.mesh, dirNorm, materialParede);
                     if (p.pilarB) removerPinturaFacePorNormal(p.pilarB.mesh, dirNorm, materialParede);
                 } else {
                     pintarFacePorNormalMundial(p.mesh, dirNorm, item);
                     if (p.pilarA) pintarFacePorNormalMundial(p.pilarA.mesh, dirNorm, item);
                     if (p.pilarB) pintarFacePorNormalMundial(p.pilarB.mesh, dirNorm, item);
                 }
              }
           });
         });
      } else { celulas.forEach(c => { if (isRemocao) removerPiso(c.x, c.z); else aplicarPiso(c.x, c.z, item); }); }
    } else {
      if (isParede || isPilar || isColuna) {
        const targetObject = hitAll.object;
        const faceClicada = hitAll.face ? hitAll.face.materialIndex : 0;
        const localNormals = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)];
        const worldNormal = localNormals[faceClicada].clone().applyQuaternion(targetObject.quaternion).normalize();
        if (isRemocao) {
            removerPinturaFacePorNormal(targetObject, worldNormal, materialParede);
            if (isParede) {
                const parede = paredesConstruidas.find(p => p.mesh === targetObject);
                if(parede && !parede.isPorta) {
                    if (parede.pilarA) removerPinturaFacePorNormal(parede.pilarA.mesh, worldNormal, materialParede);
                    if (parede.pilarB) removerPinturaFacePorNormal(parede.pilarB.mesh, worldNormal, materialParede);
                }
            } else if (isPilar) {
                const pilarObj = pilaresConstruidos.find(p => p.mesh === targetObject);
                const attachedWalls = paredesConstruidas.filter(p => p.pilarA === pilarObj || p.pilarB === pilarObj);
                attachedWalls.forEach(p => { if (!p.isPorta) removerPinturaFacePorNormal(p.mesh, worldNormal, materialParede); });
            }
        } else {
            pintarFacePorNormalMundial(targetObject, worldNormal, item);
            if (isParede) {
                const parede = paredesConstruidas.find(p => p.mesh === targetObject);
                if(parede && !parede.isPorta) {
                    if (parede.pilarA) pintarFacePorNormalMundial(parede.pilarA.mesh, worldNormal, item);
                    if (parede.pilarB) pintarFacePorNormalMundial(parede.pilarB.mesh, worldNormal, item);
                }
            } else if (isPilar) {
                const pilarObj = pilaresConstruidos.find(p => p.mesh === targetObject);
                const attachedWalls = paredesConstruidas.filter(p => p.pilarA === pilarObj || p.pilarB === pilarObj);
                attachedWalls.forEach(p => { if (!p.isPorta) pintarFacePorNormalMundial(p.mesh, worldNormal, item); });
            }
        }
      } else { if (isRemocao) removerPiso(snapCentroCelula(hitAll.point.x), snapCentroCelula(hitAll.point.z)); else aplicarPiso(snapCentroCelula(hitAll.point.x), snapCentroCelula(hitAll.point.z), item); }
    }
  }
});

canvas.addEventListener('pointermove', e => {
  if (!modoAtivo) return;

  if (e.buttons === 1 && e.ctrlKey && modoAtivo !== 'pintura' && modoAtivo !== 'selecao') {
      const hit = raycastObjetosDoNivel(e.clientX, e.clientY);
      if (hit) executarMarreta(hit.object);
      return;
  }

  // A Lógica Visual de Arrastar o Cômodo Inteiro
  if (modoAtivo === 'selecao' && comodoArrastado && pontoA) {
      const chaoHit = raycastPlanoBase(e.clientX, e.clientY);
      if (chaoHit) {
          const atualX = snapGrid(chaoHit.point.x);
          const atualZ = snapGrid(chaoHit.point.z);
          const dx = atualX - pontoA.x; // Quanta distância o mouse andou no eixo X
          const dz = atualZ - pontoA.z; // Quanta distância o mouse andou no eixo Z

          // Translada todas as paredes juntas, simulando um grupo
          comodoArrastado.paredesIniciais.forEach(st => {
              st.parede.ax = st.ax + dx;
              st.parede.az = st.az + dz;
              st.parede.bx = st.bx + dx;
              st.parede.bz = st.bz + dz;
              st.parede.mesh.position.x = st.mx + dx;
              st.parede.mesh.position.z = st.mz + dz;
          });
          
          // E translada as quinas também para acompanhar perfeitamente
          comodoArrastado.pilaresIniciais.forEach(st => {
              st.pilar.x = st.x + dx;
              st.pilar.z = st.z + dz;
              st.pilar.mesh.position.x = st.mx + dx;
              st.pilar.mesh.position.z = st.mz + dz;
          });
      }
      return;
  }

  const hit = raycastPlanoBase(e.clientX, e.clientY);
  const alturaBase = configsCamera.nivel * obterAltura();

  if (hit && modoAtivo !== 'selecao') {
    const px = snapGrid(hit.point.x), pz = snapGrid(hit.point.z);
    cursor3D.material = e.ctrlKey ? materialMarreta : materialCursor;
    cursor3D.scale.set(configMapa.tamanhoGrid, configMapa.tamanhoGrid, 1);
    
    if (modoAtivo === 'pintura') { cursor3D.position.set(snapCentroCelula(hit.point.x), alturaBase + 0.02, snapCentroCelula(hit.point.z)); } 
    else { cursor3D.position.set(px, alturaBase + 0.02, pz); }
    cursor3D.visible = true;

    if (arrastandoConstrucao && pontoA) {
      const isCerca = (modoAtivo === 'cerca');
      const hTemp = isCerca ? 1.0 : obterAltura(); 
      if (modoAtivo === 'parede' || modoAtivo === 'cerca' || modoAtivo === 'escada') {
        const dx = px - pontoA.x, dz = pz - pontoA.z;
        const comp = Math.sqrt(dx*dx + dz*dz) || 0.01;
        previaMesh.scale.set(0.25, hTemp, comp + 0.25);
        previaMesh.position.set((pontoA.x + px)/2, alturaBase + hTemp/2, (pontoA.z + pz)/2);
        previaMesh.rotation.y = Math.atan2(dx, dz);
        previaMesh.visible = true;
      } else if (modoAtivo !== 'coluna') {
        const w = Math.abs(px - pontoA.x) || 0.1, d = Math.abs(pz - pontoA.z) || 0.1;
        previaMesh.scale.set(w, hTemp, d);
        previaMesh.position.set((pontoA.x + px)/2, alturaBase + hTemp/2, (pontoA.z + pz)/2);
        previaMesh.rotation.y = 0; previaMesh.visible = true;
      }
    }
  } else { cursor3D.visible = false; }
});

window.addEventListener('pointerup', e => {
  // Soltou o mouse após arrastar a sala? Limpa o efeito de seleção!
  if (modoAtivo === 'selecao' && comodoArrastado) {
      comodoArrastado.paredes.forEach(p => p.mesh.material.forEach(m => m.emissive.setHex(0x000000)));
      comodoArrastado = null; pontoA = null;
      return;
  }

  // Soltou o mouse desenhando uma sala? Cria a sala e cadastra o RG (comodoId)
  if (arrastandoConstrucao && pontoA) {
    const hit = raycastPlanoBase(e.clientX, e.clientY);
    if (hit) {
      const px = snapGrid(hit.point.x), pz = snapGrid(hit.point.z);
      if (Math.abs(px - pontoA.x) > 0.1 || Math.abs(pz - pontoA.z) > 0.1) {
        
        // GERA O RG DO NOVO CÔMODO!
        const comodoId = Date.now() + Math.random();
        comodosConstruidos.push({ id: comodoId, paredes: [], pilares: [] });

        if (modoAtivo === 'parede') criarLinhaDeParedes(pontoA.x, pontoA.z, px, pz, obterAltura(), false, comodoId);
        else if (modoAtivo === 'cerca') criarLinhaDeParedes(pontoA.x, pontoA.z, px, pz, 1.0, true, comodoId);
        else if (modoAtivo === 'escada') criarEscada(pontoA.x, pontoA.z, px, pz, obterAltura());
        else if (modoAtivo === 'retangulo') criarRetangulo(pontoA.x, pontoA.z, px, pz, obterAltura(), comodoId);
        else if (modoAtivo === 'triangulo') criarTriangulo(pontoA.x, pontoA.z, px, pz, obterAltura(), comodoId);
        else if (modoAtivo === 'octogono') criarOctogono(pontoA.x, pontoA.z, px, pz, obterAltura(), comodoId);
      }
    }
    arrastandoConstrucao = false; pontoA = null; previaMesh.visible = false;
  }
});

// ----------------------------------------------------
// CONSTRUÇÃO ESTRUTURAL E AGRUPAMENTO (THE SIMS 4)
// ----------------------------------------------------
function removerParede(parede) {
    scene.remove(parede.mesh);
    const idx = paredesConstruidas.indexOf(parede);
    if (idx > -1) paredesConstruidas.splice(idx, 1);
    
    // Remove do Grupo também
    if (parede.comodoId) {
        const comodo = comodosConstruidos.find(c => c.id === parede.comodoId);
        if (comodo) {
            const cIdx = comodo.paredes.indexOf(parede);
            if (cIdx > -1) comodo.paredes.splice(cIdx, 1);
        }
    }
    limparPilaresSoltos();
}

function limparPilaresSoltos() {
    for (let i = pilaresConstruidos.length - 1; i >= 0; i--) {
        const pilar = pilaresConstruidos[i];
        const emUso = paredesConstruidas.some(p => p.pilarA === pilar || p.pilarB === pilar);
        if (!emUso) { 
            scene.remove(pilar.mesh); 
            pilaresConstruidos.splice(i, 1); 
            if (pilar.comodoId) {
                const comodo = comodosConstruidos.find(c => c.id === pilar.comodoId);
                if (comodo) {
                    const cIdx = comodo.pilares.indexOf(pilar);
                    if (cIdx > -1) comodo.pilares.splice(cIdx, 1);
                }
            }
        }
    }
}

function obterOuCriarPilar(x, z, altura, isCerca, comodoId = null) {
    // Agora o pilar só tenta se juntar se pertencer ao mesmo cômodo (evita deformação gráfica)
    let pilar = pilaresConstruidos.find(p => Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01 && p.nivel === configsCamera.nivel && p.comodoId === comodoId);
    if (!pilar) {
        const mat = isCerca ? materialCerca : materialParede;
        const materiais = [mat.clone(), mat.clone(), mat.clone(), mat.clone(), mat.clone(), mat.clone()];
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, altura, 0.25), materiais);
        const alturaBase = configsCamera.nivel * obterAltura();
        mesh.position.set(x, alturaBase + altura / 2, z);
        scene.add(mesh);
        
        pilar = { mesh, x, z, altura, nivel: configsCamera.nivel, comodoId };
        pilaresConstruidos.push(pilar);
        
        if (comodoId) {
            const c = comodosConstruidos.find(com => com.id === comodoId);
            if (c) c.pilares.push(pilar);
        }
    }
    return pilar;
}

function criarSegmentoParede(ax, az, bx, bz, altura, isCerca, comodoId = null) {
  const existe = paredesConstruidas.find(p => p.nivel === configsCamera.nivel && 
      ((Math.abs(p.ax - ax) < 0.01 && Math.abs(p.az - az) < 0.01 && Math.abs(p.bx - bx) < 0.01 && Math.abs(p.bz - bz) < 0.01) || 
      (Math.abs(p.ax - bx) < 0.01 && Math.abs(p.az - bz) < 0.01 && Math.abs(p.bx - ax) < 0.01 && Math.abs(p.bz - az) < 0.01))
  );
  if (existe) return;

  const dx = bx - ax, dz = bz - az;
  const compTotal = Math.hypot(dx, dz);
  if (compTotal < 0.05) return;
  
  const pilarA = obterOuCriarPilar(ax, az, altura, isCerca, comodoId);
  const pilarB = obterOuCriarPilar(bx, bz, altura, isCerca, comodoId);

  const compParede = Math.max(0.001, compTotal - 0.25);
  const mat = isCerca ? materialCerca : materialParede;
  const materiais = [mat.clone(), mat.clone(), mat.clone(), mat.clone(), mat.clone(), mat.clone()];

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, altura, compParede), materiais);
  const alturaBase = configsCamera.nivel * obterAltura();
  mesh.position.set((ax+bx)/2, alturaBase + altura/2, (az+bz)/2);
  mesh.rotation.y = Math.atan2(dx, dz);
  scene.add(mesh);
  
  const parede = { mesh, ax, az, bx, bz, altura, nivel: configsCamera.nivel, isPorta: false, isCerca, pilarA, pilarB, comodoId };
  paredesConstruidas.push(parede);
  
  if (comodoId) {
      const c = comodosConstruidos.find(com => com.id === comodoId);
      if (c) c.paredes.push(parede);
  }
}

function criarLinhaDeParedes(ax, az, bx, bz, altura, isCerca = false, comodoId = null) {
  const dx = bx - ax, dz = bz - az;
  const compTotal = Math.hypot(dx, dz);
  if (compTotal < 0.05) return;
  const qtd = Math.max(1, Math.round(compTotal / configMapa.tamanhoGrid));
  const stepX = dx / qtd, stepZ = dz / qtd;
  for (let i = 0; i < qtd; i++) { criarSegmentoParede(ax + stepX * i, az + stepZ * i, ax + stepX * (i + 1), az + stepZ * (i + 1), altura, isCerca, comodoId); }
}

function criarPoligonoDeParedes(vertices, altura, comodoId = null) {
  for (let i = 0; i < vertices.length; i++) { criarLinhaDeParedes(vertices[i].x, vertices[i].z, vertices[(i + 1) % vertices.length].x, vertices[(i + 1) % vertices.length].z, altura, false, comodoId); }
}

function criarRetangulo(x1, z1, x2, z2, altura, comodoId = null) { const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2); criarPoligonoDeParedes([{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }], altura, comodoId); }
function criarTriangulo(x1, z1, x2, z2, altura, comodoId = null) { const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2); criarPoligonoDeParedes([{ x: (minX + maxX) / 2, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }], altura, comodoId); }
function criarOctogono(x1, z1, x2, z2, altura, comodoId = null) { const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2); const w = maxX - minX, d = maxZ - minZ, offX = w * 0.3, offZ = d * 0.3; criarPoligonoDeParedes([{ x: minX + offX, z: minZ }, { x: maxX - offX, z: minZ }, { x: maxX, z: minZ + offZ }, { x: maxX, z: maxZ - offZ }, { x: maxX - offX, z: maxZ }, { x: minX + offX, z: maxZ }, { x: minX, z: maxZ - offZ }, { x: minX, z: minZ + offZ }], altura, comodoId); }

function criarColunaSustentacao(x, z, altura) {
    const alturaBase = configsCamera.nivel * altura;
    const materiais = [materialParede.clone(), materialParede.clone(), materialParede.clone(), materialParede.clone(), materialParede.clone(), materialParede.clone()];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, altura, 0.4), materiais);
    mesh.position.set(x, alturaBase + altura / 2, z); scene.add(mesh);
    colunasSustentacao.push({ mesh, x, z, nivel: configsCamera.nivel, altura });
}

function criarEscada(ax, az, bx, bz, alturaAndar) {
    const dx = bx - ax, dz = bz - az; const comp = Math.hypot(dx, dz); if (comp < 0.5) return; 
    const degraus = Math.max(3, Math.floor(comp / (configMapa.tamanhoGrid / 2)));
    const escadaMesh = new THREE.Group(); const angle = Math.atan2(dx, dz);
    for (let i = 0; i < degraus; i++) {
        const stepD = comp / degraus, stepH = alturaAndar / degraus;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(configMapa.tamanhoGrid, stepH * (i + 1), stepD), materialPiso.clone());
        mesh.position.set(0, (stepH * (i + 1)) / 2, (i * stepD) - comp/2 + stepD/2); escadaMesh.add(mesh);
    }
    const alturaBase = configsCamera.nivel * alturaAndar; escadaMesh.position.set((ax+bx)/2, alturaBase, (az+bz)/2); escadaMesh.rotation.y = angle; scene.add(escadaMesh);
    escadasConstruidas.push({ mesh: escadaMesh, nivel: configsCamera.nivel, isEscada: true });
}

// ----------------------------------------------------
// PINTURA E REMOÇÃO DE PINTURA (BORRACHA)
// ----------------------------------------------------
function gerarMaterialPintura(item, repeatX = 1, repeatY = 1) {
  const mat = new THREE.MeshLambertMaterial();
  if (item.tipo === 'cor') { mat.color.set(item.cor); } 
  else { const tex = item.textura.clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeatX, repeatY); mat.map = tex; mat.color.set(0xffffff); }
  return mat;
}
function aplicarMaterialNaFace(mesh, faceIndex, item) {
  let repeatX = 1, repeatY = 1;
  if (mesh.geometry && mesh.geometry.parameters) {
      const { width, height, depth } = mesh.geometry.parameters;
      if (faceIndex === 0 || faceIndex === 1) { repeatX = depth; repeatY = height; } 
      else if (faceIndex === 2 || faceIndex === 3) { repeatX = width; repeatY = depth; } 
      else if (faceIndex === 4 || faceIndex === 5) { repeatX = width; repeatY = height; }
  }
  const novosMateriais = [...mesh.material]; novosMateriais[faceIndex] = gerarMaterialPintura(item, repeatX, repeatY); mesh.material = novosMateriais;
}
function pintarFacePorNormalMundial(mesh, targetNormal, item) {
    const tNorm = targetNormal.clone().normalize();
    const localNormals = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)];
    for (let i = 0; i < 6; i++) { const worldNormal = localNormals[i].clone().applyQuaternion(mesh.quaternion).normalize(); if (worldNormal.dot(tNorm) > 0.5) aplicarMaterialNaFace(mesh, i, item); }
}
function removerMaterialNaFace(mesh, faceIndex, matBase) {
    const novosMateriais = [...mesh.material]; novosMateriais[faceIndex] = matBase.clone(); mesh.material = novosMateriais;
}
function removerPinturaFacePorNormal(mesh, targetNormal, matBase) {
    const tNorm = targetNormal.clone().normalize();
    const localNormals = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)];
    for (let i = 0; i < 6; i++) { const worldNormal = localNormals[i].clone().applyQuaternion(mesh.quaternion).normalize(); if (worldNormal.dot(tNorm) > 0.5) removerMaterialNaFace(mesh, i, matBase); }
}
function aplicarPiso(x, z, item) {
  let tile = pisosConstruidos.find(p => Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01 && p.nivel === configsCamera.nivel);
  if (!tile) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(configMapa.tamanhoGrid, 0.12, configMapa.tamanhoGrid), materialPiso.clone());
    const alturaBase = configsCamera.nivel * obterAltura(); mesh.position.set(x, alturaBase + 0.06, z); scene.add(mesh);
    tile = { mesh, x, z, nivel: configsCamera.nivel }; pisosConstruidos.push(tile);
  }
  tile.mesh.material = gerarMaterialPintura(item, configMapa.tamanhoGrid, configMapa.tamanhoGrid);
}
function removerPiso(x, z) {
  const idx = pisosConstruidos.findIndex(p => Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01 && p.nivel === configsCamera.nivel);
  if (idx > -1) { scene.remove(pisosConstruidos[idx].mesh); pisosConstruidos.splice(idx, 1); }
}

// ----------------------------------------------------
// GERENCIADOR DE VISIBILIDADE E FANTASMA
// ----------------------------------------------------
function setOpacity(mesh, isTransparent, opacity) {
    if (!mesh) return;
    if (mesh.type === 'Group') { mesh.children.forEach(child => setOpacity(child, isTransparent, opacity)); } 
    else if (Array.isArray(mesh.material)) { mesh.material.forEach(m => { m.transparent = isTransparent; m.opacity = opacity; }); } 
    else if (mesh.material) { mesh.material.transparent = isTransparent; mesh.material.opacity = opacity; }
}

export function atualizarVisibilidadeAndares(modoVisaoManual) {
  if (modoVisaoManual) modoVisaoAtual = modoVisãoManual;
  const mostrarFantasma = (modoAtivo === 'coluna'); 

  const aplicarParede = (obj) => {
     if (obj.nivel > configsCamera.nivel) {
         if (mostrarFantasma && obj.nivel === configsCamera.nivel + 1) { obj.mesh.visible = true; setOpacity(obj.mesh, true, 0.15); } 
         else { obj.mesh.visible = false; }
     } else if (obj.nivel < configsCamera.nivel) {
         obj.mesh.visible = true; obj.mesh.scale.y = 1; obj.mesh.position.y = (obj.nivel * obj.altura) + (obj.altura / 2); setOpacity(obj.mesh, false, 1);
     } else {
         obj.mesh.visible = true;
         if (modoVisaoAtual === 'full') { obj.mesh.scale.y = 1; obj.mesh.position.y = (obj.nivel * obj.altura) + (obj.altura / 2); setOpacity(obj.mesh, false, 1); } 
         else if (modoVisaoAtual === 'cut') { obj.mesh.scale.y = 1; obj.mesh.position.y = (obj.nivel * obj.altura) + (obj.altura / 2); setOpacity(obj.mesh, true, 0.3); } 
         else if (modoVisaoAtual === 'low') { obj.mesh.scale.y = 0.1; obj.mesh.position.y = (obj.nivel * obj.altura) + (obj.altura * 0.1) / 2; setOpacity(obj.mesh, false, 1); }
     }
  };

  paredesConstruidas.forEach(aplicarParede); pilaresConstruidos.forEach(aplicarParede);
  colunasSustentacao.forEach(obj => { if (obj.nivel > configsCamera.nivel) obj.mesh.visible = false; else { obj.mesh.visible = true; setOpacity(obj.mesh, false, 1); } });
  [pisosConstruidos, escadasConstruidas].forEach(arr => {
      arr.forEach(obj => {
          if (obj.nivel > configsCamera.nivel) {
              if (mostrarFantasma && obj.nivel === configsCamera.nivel + 1) { obj.mesh.visible = true; setOpacity(obj.mesh, true, 0.15); } else obj.mesh.visible = false;
          } else { obj.mesh.visible = true; setOpacity(obj.mesh, false, 1); }
      });
  });
}
