// js/construtor.js - Múltiplos Andares, Gizmo e PINTURA CIRÚRGICA
import { scene, camera, canvas, configsCamera } from './engine.js';
import { configMapa, meshChaoBase } from './mapa.js';
import { showAviso, itemSelecionadoAtual, mostrarGizmo, esconderGizmo } from './ui.js';

export let modoAtivo = null;
export let modoVisaoAtual = 'full'; 

export const comodosConstruidos = []; 
export const paredesConstruidas = [];
export const pilaresConstruidos = []; 
export const pisosConstruidos = []; 
export const escadasConstruidas = [];
export const colunasSustentacao = [];

let arrastandoConstrucao = false;
let comodoSelecionado = null; 
let movendoComodo = false;
let pontoA = null; 

// --- VARIAVEIS SETAS RESIZE ---
let arrastandoSeta = null;
let comodoArrastadoBounds = null;

// --- CRIAÇÃO DAS SETAS 3D (Hologramas Azuis) ---
const geometriaSeta = new THREE.ConeGeometry(0.6, 1.2, 4);
geometriaSeta.rotateX(Math.PI / 2); 
const matSeta = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9, depthTest: false });

const setaN = new THREE.Mesh(geometriaSeta, matSeta); setaN.userData.dir = 'N'; setaN.rotation.y = Math.PI; 
const setaS = new THREE.Mesh(geometriaSeta, matSeta); setaS.userData.dir = 'S'; 
const setaE = new THREE.Mesh(geometriaSeta, matSeta); setaE.userData.dir = 'E'; setaE.rotation.y = Math.PI / 2; 
const setaW = new THREE.Mesh(geometriaSeta, matSeta); setaW.userData.dir = 'W'; setaW.rotation.y = -Math.PI / 2; 

const grupoSetas = new THREE.Group();
grupoSetas.add(setaN, setaS, setaE, setaW);
grupoSetas.visible = false;
grupoSetas.renderOrder = 999; 
scene.add(grupoSetas);

// --- MOTOR DE HISTÓRICO BLINDADO ---
const historicoUndo = [];
const historicoRedo = [];
let acaoAtual = null;

function iniciarAcao() { acaoAtual = { add: [], rem: [], paint: [], move: [] }; }
function finalizarAcao() {
    if (!acaoAtual) return;
    if (acaoAtual.add.length > 0 || acaoAtual.rem.length > 0 || acaoAtual.paint.length > 0 || acaoAtual.move.length > 0) {
        historicoUndo.push(acaoAtual);
        if (historicoUndo.length > 30) historicoUndo.shift(); 
        historicoRedo.length = 0; 
    }
    acaoAtual = null;
}

export function desfazer() {
    if (historicoUndo.length === 0) { showAviso("Nada para desfazer."); return; }
    const acao = historicoUndo.pop();
    try {
        acao.move.forEach(m => { const c = comodosConstruidos.find(x => x.id === m.comodoId); if (c) aplicarMovimento(c, -m.dx, -m.dz); });
        acao.paint.forEach(p => { if(p.obj && p.oldMats) p.obj.material = p.oldMats; });
        acao.add.forEach(item => {
            scene.remove(item.obj.mesh);
            const idx = item.arrayBase.indexOf(item.obj);
            if(idx > -1) item.arrayBase.splice(idx, 1);
            if (item.obj.comodoId) {
                const c = comodosConstruidos.find(x => x.id === item.obj.comodoId);
                if (c) {
                    if (item.tipo === 'parede') c.paredes = c.paredes.filter(x => x !== item.obj);
                    if (item.tipo === 'pilar') c.pilares = c.pilares.filter(x => x !== item.obj);
                }
            }
        });
        acao.rem.reverse().forEach(item => { 
            scene.add(item.obj.mesh);
            item.arrayBase.splice(item.indexInsercao, 0, item.obj);
            if (item.obj.comodoId) {
                let c = comodosConstruidos.find(x => x.id === item.obj.comodoId);
                if (!c) { c = {id: item.obj.comodoId, paredes:[], pilares:[]}; comodosConstruidos.push(c); }
                if (item.tipo === 'parede') c.paredes.push(item.obj);
                if (item.tipo === 'pilar') c.pilares.push(item.obj);
            }
        });
        historicoRedo.push(acao); atualizarVisibilidadeAndares(); limparSelecao(); showAviso("Desfazer (Undo)");
    } catch(e) { console.error("Erro ao desfazer:", e); }
}

export function refazer() {
    if (historicoRedo.length === 0) { showAviso("Nada para refazer."); return; }
    const acao = historicoRedo.pop();
    try {
        acao.move.forEach(m => { const c = comodosConstruidos.find(x => x.id === m.comodoId); if (c) aplicarMovimento(c, m.dx, m.dz); });
        acao.paint.forEach(p => { if(p.obj && p.newMats) p.obj.material = p.newMats; });
        acao.add.forEach(item => {
            scene.add(item.obj.mesh);
            item.arrayBase.push(item.obj);
            if (item.obj.comodoId) {
                let c = comodosConstruidos.find(x => x.id === item.obj.comodoId);
                if (!c) { c = {id: item.obj.comodoId, paredes:[], pilares:[]}; comodosConstruidos.push(c); }
                if (item.tipo === 'parede') c.paredes.push(item.obj);
                if (item.tipo === 'pilar') c.pilares.push(item.obj);
            }
        });
        acao.rem.forEach(item => {
            scene.remove(item.obj.mesh);
            const idx = item.arrayBase.indexOf(item.obj);
            if(idx > -1) item.arrayBase.splice(idx, 1);
            if (item.obj.comodoId) {
                const c = comodosConstruidos.find(x => x.id === item.obj.comodoId);
                if (c) {
                    if (item.tipo === 'parede') c.paredes = c.paredes.filter(x => x !== item.obj);
                    if (item.tipo === 'pilar') c.pilares = c.pilares.filter(x => x !== item.obj);
                }
            }
        });
        historicoUndo.push(acao); atualizarVisibilidadeAndares(); limparSelecao(); showAviso("Refazer (Redo)");
    } catch(e) { console.error("Erro ao refazer:", e); }
}

window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) refazer(); else desfazer(); }
        if (e.key.toLowerCase() === 'y') { e.preventDefault(); refazer(); }
    }
});

function registrarAdicao(tipo, obj, arrayBase) { if (acaoAtual) acaoAtual.add.push({ tipo, obj, arrayBase }); }
function registrarRemocao(tipo, obj, arrayBase) {
    if (!acaoAtual || !obj) return;
    const idx = arrayBase.indexOf(obj);
    acaoAtual.rem.push({ tipo, obj, arrayBase, indexInsercao: idx > -1 ? idx : arrayBase.length });
}
function registrarPintura(mesh) {
    if (!acaoAtual || !mesh || !mesh.material) return;
    const jaPintado = acaoAtual.paint.find(p => p.obj === mesh);
    if (!jaPintado) {
        const oldMats = Array.isArray(mesh.material) ? [...mesh.material] : mesh.material.clone();
        acaoAtual.paint.push({ obj: mesh, oldMats, newMats: null });
    }
}
function finalizarPintura(mesh) {
    if (!acaoAtual || !mesh || !mesh.material) return;
    const p = acaoAtual.paint.find(p => p.obj === mesh);
    if (p) p.newMats = Array.isArray(mesh.material) ? [...mesh.material] : mesh.material.clone();
}

// --- MATERIAIS ---
const materialParede = new THREE.MeshLambertMaterial({ color: 0x6a5f48 });
const materialCerca = new THREE.MeshLambertMaterial({ color: 0x5a4f38 }); 
const materialPiso = new THREE.MeshLambertMaterial({ color: 0x8a7550 });
const materialPrevia = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
const materialCursor = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false });
const materialMarreta = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.6, depthWrite: false });

const cursor3D = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), materialCursor);
cursor3D.rotation.x = -Math.PI / 2; cursor3D.visible = false; scene.add(cursor3D);
const previaMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materialPrevia);
previaMesh.visible = false; scene.add(previaMesh);

const raycaster = new THREE.Raycaster(); const mouseNdc = new THREE.Vector2();

function snapGrid(valor) { return Math.round(valor / configMapa.tamanhoGrid) * configMapa.tamanhoGrid; }
function snapMeioGrid(valor) { return Math.round(valor / (configMapa.tamanhoGrid/2)) * (configMapa.tamanhoGrid/2); }
function snapCentroCelula(valor) { return Math.floor(valor / configMapa.tamanhoGrid) * configMapa.tamanhoGrid + configMapa.tamanhoGrid / 2; }
function obterAltura() { return parseFloat(document.getElementById('inputAlturaParede')?.value) || 3; }

function raycastPlanoBase(clientX, clientY) {
  mouseNdc.x = (clientX / window.innerWidth) * 2 - 1; mouseNdc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNdc, camera);
  const alturaNivelAtual = configsCamera.nivel * obterAltura();
  const planoFlutuante = new THREE.Plane(new THREE.Vector3(0, 1, 0), -alturaNivelAtual);
  const pontoIntersectado = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(planoFlutuante, pontoIntersectado)) return { point: pontoIntersectado };
  return null;
}

function raycastObjetosDoNivel(clientX, clientY) {
  mouseNdc.x = (clientX / window.innerWidth) * 2 - 1; mouseNdc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNdc, camera);
  const paredesF = paredesConstruidas.filter(p => p.nivel === configsCamera.nivel).map(p => p.mesh);
  const pilaresF = pilaresConstruidos.filter(p => p.nivel === configsCamera.nivel).map(p => p.mesh);
  const pisosF = pisosConstruidos.filter(p => p.nivel === configsCamera.nivel).map(p => p.mesh);
  const colunasF = colunasSustentacao.filter(p => p.nivel === configsCamera.nivel).map(p => p.mesh);
  const escadasF = []; escadasConstruidas.forEach(e => { if (e.nivel === configsCamera.nivel) escadasF.push(...e.mesh.children); });
  
  const objetosNivel = [...paredesF, ...pilaresF, ...pisosF, ...colunasF, ...escadasF];
  if (configsCamera.nivel === 0 && meshChaoBase) objetosNivel.push(meshChaoBase);

  const hits = raycaster.intersectObjects(objetosNivel, true);
  return hits.length ? hits[0] : null;
}

// ----------------------------------------------------
// A LÓGICA DO GIZMO E DAS SETAS DE ESTICAR
// ----------------------------------------------------
export function setModoAtivo(modo) {
  modoAtivo = modo;
  arrastandoConstrucao = false;
  pontoA = null;
  limparSelecao();
  previaMesh.visible = false;
  cursor3D.visible = false;
}

function limparSelecao() {
    if (comodoSelecionado) {
        comodoSelecionado.paredes.forEach(p => p.mesh.material.forEach(m => m.emissive.setHex(0x000000)));
    }
    comodoSelecionado = null;
    movendoComodo = false;
    arrastandoSeta = null;
    esconderGizmo();
    grupoSetas.visible = false;
}

function atualizarSetasResize() {
    if (!comodoSelecionado) { grupoSetas.visible = false; return; }
    
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    comodoSelecionado.paredes.forEach(p => {
        minX = Math.min(minX, p.ax, p.bx); maxX = Math.max(maxX, p.ax, p.bx);
        minZ = Math.min(minZ, p.az, p.bz); maxZ = Math.max(maxZ, p.az, p.bz);
    });
    
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const h = (configsCamera.nivel * obterAltura()) + (obterAltura() / 2);

    setaN.position.set(cx, h, minZ - 1.2);
    setaS.position.set(cx, h, maxZ + 1.2);
    setaE.position.set(maxX + 1.2, h, cz);
    setaW.position.set(minX - 1.2, h, cz);

    grupoSetas.visible = true;
}

export function iniciarArrasteComodo() {
    if (!comodoSelecionado) return;
    movendoComodo = true;
    esconderGizmo();
    grupoSetas.visible = false;
    iniciarAcao();
    pontoA = null; 
    showAviso("Cômodo colado no mouse. Clique para soltar!");
}

export function girarComodoSelecionado(sentido) {
    if (!comodoSelecionado) return;
    
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    comodoSelecionado.paredes.forEach(p => {
        minX = Math.min(minX, p.ax, p.bx); maxX = Math.max(maxX, p.ax, p.bx);
        minZ = Math.min(minZ, p.az, p.bz); maxZ = Math.max(maxZ, p.az, p.bz);
    });
    const cx = snapMeioGrid((minX + maxX) / 2);
    const cz = snapMeioGrid((minZ + maxZ) / 2);
    
    const angulo = sentido === 'esq' ? Math.PI / 2 : -Math.PI / 2;
    const cos = Math.round(Math.cos(angulo)); 
    const sin = Math.round(Math.sin(angulo));

    comodoSelecionado.paredes.forEach(p => {
        const nx1 = cx + (p.ax - cx) * cos - (p.az - cz) * sin;
        const nz1 = cz + (p.ax - cx) * sin + (p.az - cz) * cos;
        const nx2 = cx + (p.bx - cx) * cos - (p.bz - cz) * sin;
        const nz2 = cz + (p.bx - cx) * sin + (p.bz - cz) * cos;
        p.ax = nx1; p.az = nz1; p.bx = nx2; p.bz = nz2;
        atualizarGeometriaParede(p);
    });

    comodoSelecionado.pilares.forEach(p => {
        const nx = cx + (p.x - cx) * cos - (p.z - cz) * sin;
        const nz = cz + (p.x - cx) * sin + (p.z - cz) * cos;
        p.x = nx; p.z = nz;
        atualizarGeometriaPilar(p);
    });
    atualizarSetasResize();
}

export function deletarComodoSelecionado() {
    if (!comodoSelecionado) return;
    iniciarAcao();
    const pArray = [...comodoSelecionado.paredes];
    const pilArray = [...comodoSelecionado.pilares];
    pArray.forEach(p => removerObjetoMundo('parede', p, paredesConstruidas));
    pilArray.forEach(p => removerObjetoMundo('pilar', p, pilaresConstruidos));
    limparSelecao();
    finalizarAcao();
    showAviso("Cômodo demolido.");
}

function atualizarGeometriaParede(parede) {
    const dx = parede.bx - parede.ax;
    const dz = parede.bz - parede.az;
    const compTotal = Math.hypot(dx, dz);
    const compParede = Math.max(0.001, compTotal - 0.25); 
    
    const alturaBase = parede.nivel * obterAltura();
    parede.mesh.position.set((parede.ax + parede.bx)/2, alturaBase + parede.altura/2, (parede.az + parede.bz)/2);
    parede.mesh.rotation.y = Math.atan2(dx, dz);
    
    if (parede.mesh.geometry) parede.mesh.geometry.dispose();
    parede.mesh.geometry = new THREE.BoxGeometry(0.25, parede.altura, compParede);
}

function atualizarGeometriaPilar(pilar) {
    const alturaBase = pilar.nivel * obterAltura();
    pilar.mesh.position.set(pilar.x, alturaBase + pilar.altura/2, pilar.z);
}

// ----------------------------------------------------
// INTERAÇÕES PRINCIPAIS E MOUSE
// ----------------------------------------------------
canvas?.addEventListener('pointerdown', e => {
  if (e.button !== 0 && !(e.button === 2 && e.ctrlKey)) return;
  
  if (movendoComodo) {
      movendoComodo = false; pontoA = null; finalizarAcao(); limparSelecao();
      showAviso("Cômodo posicionado!");
      return;
  }

  // O CLIQUE INTELIGENTE DO MODO NAVEGAR E SETAS DE ESTICAR
  if (!modoAtivo && e.button === 0 && !e.altKey && !e.ctrlKey && !e.shiftKey) {
      
      if (grupoSetas.visible) {
          raycaster.setFromCamera(mouseNdc, camera);
          const hitsSetas = raycaster.intersectObjects(grupoSetas.children);
          if (hitsSetas.length > 0) {
              arrastandoSeta = hitsSetas[0].object.userData.dir;
              esconderGizmo();
              
              let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
              comodoSelecionado.paredes.forEach(p => {
                  minX = Math.min(minX, p.ax, p.bx); maxX = Math.max(maxX, p.ax, p.bx);
                  minZ = Math.min(minZ, p.az, p.bz); maxZ = Math.max(maxZ, p.az, p.bz);
              });
              comodoArrastadoBounds = { minX, maxX, minZ, maxZ };
              
              comodoSelecionado.paredesIniciais = comodoSelecionado.paredes.map(p => ({ parede: p, ax: p.ax, az: p.az, bx: p.bx, bz: p.bz }));
              comodoSelecionado.pilaresIniciais = comodoSelecionado.pilares.map(p => ({ pilar: p, x: p.x, z: p.z }));
              return;
          }
      }

      const hitAll = raycastObjetosDoNivel(e.clientX, e.clientY);
      if (hitAll && hitAll.object !== meshChaoBase) {
          const objClicado = paredesConstruidas.find(p => p.mesh === hitAll.object) || pilaresConstruidos.find(p => p.mesh === hitAll.object);
          if (objClicado && objClicado.comodoId) {
              limparSelecao();
              comodoSelecionado = comodosConstruidos.find(c => c.id === objClicado.comodoId);
              if (comodoSelecionado) {
                  comodoSelecionado.paredes.forEach(p => p.mesh.material.forEach(m => m.emissive.setHex(0x2a2a2a)));
                  mostrarGizmo(e.clientX, e.clientY);
                  atualizarSetasResize();
                  return;
              }
          }
      }
      limparSelecao(); 
      return;
  }

  if (!modoAtivo) return; 
  iniciarAcao();

  if (e.ctrlKey && modoAtivo !== 'pintura') {
    const hit = raycastObjetosDoNivel(e.clientX, e.clientY);
    if (hit) executarMarreta(hit.object);
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

  // --- LÓGICA CIRÚRGICA DE PINTURA ---
  if (modoAtivo === 'pintura') {
      const isRemocao = e.ctrlKey; 
      const item = itemSelecionadoAtual();
      if (!isRemocao && !item) return;

      const hitAll = raycastObjetosDoNivel(e.clientX, e.clientY);
      const chaoHit = raycastPlanoBase(e.clientX, e.clientY);
      if (!hitAll && !chaoHit) return;

      const targetObject = hitAll ? hitAll.object : null;
      const clickPoint = hitAll ? hitAll.point : chaoHit.point;

      const isEscada = targetObject && escadasConstruidas.some(e => e.mesh === targetObject.parent);
      if (isEscada) {
          const escada = escadasConstruidas.find(e => e.mesh === targetObject.parent);
          escada.mesh.children.forEach(step => { 
              registrarPintura(step);
              step.material = isRemocao ? materialPiso.clone() : gerarMaterialPintura(item, configMapa.tamanhoGrid, configMapa.tamanhoGrid); 
              finalizarPintura(step);
          });
          return;
      }

      const isParede = targetObject && paredesConstruidas.some(p => p.mesh === targetObject);
      const isPilar = targetObject && pilaresConstruidos.some(p => p.mesh === targetObject);
      const isColuna = targetObject && colunasSustentacao.some(p => p.mesh === targetObject);

      if (e.shiftKey) {
          let startX = snapCentroCelula(clickPoint.x);
          let startZ = snapCentroCelula(clickPoint.z);

          if (targetObject && (isParede || isPilar)) {
              const faceClicada = hitAll.face ? hitAll.face.materialIndex : 0;
              const localNormals = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)];
              const worldNormal = localNormals[faceClicada].clone().applyQuaternion(targetObject.quaternion).normalize();
              startX = snapCentroCelula(clickPoint.x + worldNormal.x * 0.1);
              startZ = snapCentroCelula(clickPoint.z + worldNormal.z * 0.1);
          }

          const { celulas } = encontrarAreaFechada(startX, startZ);
          if (targetObject && (isParede || isPilar)) {
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
          if (targetObject && (isParede || isPilar || isColuna)) {
              const faceClicada = hitAll.face ? hitAll.face.materialIndex : 0;
              const localNormals = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)];
              const worldNormal = localNormals[faceClicada].clone().applyQuaternion(targetObject.quaternion).normalize();
              if (isRemocao) { removerPinturaFacePorNormal(targetObject, worldNormal, materialParede); } 
              else { pintarFacePorNormalMundial(targetObject, worldNormal, item); }
          } else { 
              const cx = snapCentroCelula(clickPoint.x); const cz = snapCentroCelula(clickPoint.z);
              if (isRemocao) removerPiso(cx, cz); else aplicarPiso(cx, cz, item); 
          }
      }
      return; 
  }
});

canvas?.addEventListener('pointermove', e => {
  if (!modoAtivo && arrastandoSeta && comodoSelecionado) {
        const hit = raycastPlanoBase(e.clientX, e.clientY);
        if (hit) {
            const px = snapGrid(hit.point.x);
            const pz = snapGrid(hit.point.z);
            const cb = comodoArrastadoBounds;
            
            let scaleX = 1; let scaleZ = 1; let dX = 0; let dZ = 0;
            const minSize = configMapa.tamanhoGrid;

            if (arrastandoSeta === 'E') {
                const newMaxX = Math.max(cb.minX + minSize, px);
                scaleX = (newMaxX - cb.minX) / (cb.maxX - cb.minX || 1);
                dX = cb.minX; 
            } else if (arrastandoSeta === 'W') {
                const newMinX = Math.min(cb.maxX - minSize, px);
                scaleX = (cb.maxX - newMinX) / (cb.maxX - cb.minX || 1);
                dX = cb.maxX;
            } else if (arrastandoSeta === 'S') {
                const newMaxZ = Math.max(cb.minZ + minSize, pz);
                scaleZ = (newMaxZ - cb.minZ) / (cb.maxZ - cb.minZ || 1);
                dZ = cb.minZ;
            } else if (arrastandoSeta === 'N') {
                const newMinZ = Math.min(cb.maxZ - minSize, pz);
                scaleZ = (cb.maxZ - newMinZ) / (cb.maxZ - cb.minZ || 1);
                dZ = cb.maxZ;
            }

            comodoSelecionado.paredesIniciais.forEach(st => {
                if (arrastandoSeta === 'E' || arrastandoSeta === 'W') {
                    st.parede.ax = dX + (st.ax - dX) * scaleX; st.parede.bx = dX + (st.bx - dX) * scaleX;
                } else {
                    st.parede.az = dZ + (st.az - dZ) * scaleZ; st.parede.bz = dZ + (st.bz - dZ) * scaleZ;
                }
                atualizarGeometriaParede(st.parede);
            });

            comodoSelecionado.pilaresIniciais.forEach(st => {
                if (arrastandoSeta === 'E' || arrastandoSeta === 'W') { st.pilar.x = dX + (st.x - dX) * scaleX; } 
                else { st.pilar.z = dZ + (st.z - dZ) * scaleZ; }
                atualizarGeometriaPilar(st.pilar);
            });
            atualizarSetasResize();
        }
        return;
  }

  if (!modoAtivo && movendoComodo && comodoSelecionado) {
      const chaoHit = raycastPlanoBase(e.clientX, e.clientY);
      if (chaoHit) {
          const atualX = snapGrid(chaoHit.point.x), atualZ = snapGrid(chaoHit.point.z);
          if (!pontoA) pontoA = { x: atualX, z: atualZ }; 
          const dx = atualX - pontoA.x, dz = atualZ - pontoA.z;
          pontoA = { x: atualX, z: atualZ }; 
          aplicarMovimento(comodoSelecionado, dx, dz); 
          if (acaoAtual) {
              const moveRecord = acaoAtual.move.find(m => m.comodoId === comodoSelecionado.id);
              if (moveRecord) { moveRecord.dx += dx; moveRecord.dz += dz; } 
              else { acaoAtual.move.push({ comodoId: comodoSelecionado.id, dx, dz }); }
          }
      }
      return;
  }

  if (!modoAtivo) return;

  if (e.buttons === 1 && e.ctrlKey && modoAtivo !== 'pintura') {
      const hit = raycastObjetosDoNivel(e.clientX, e.clientY);
      if (hit) executarMarreta(hit.object);
      return;
  }

  const hit = raycastPlanoBase(e.clientX, e.clientY);
  const alturaBase = configsCamera.nivel * obterAltura();

  if (hit) {
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
        const dx = px - pontoA.x, dz = pz - pontoA.z; const comp = Math.sqrt(dx*dx + dz*dz) || 0.01;
        previaMesh.scale.set(0.25, hTemp, comp + 0.25); previaMesh.position.set((pontoA.x + px)/2, alturaBase + hTemp/2, (pontoA.z + pz)/2); previaMesh.rotation.y = Math.atan2(dx, dz); previaMesh.visible = true;
      } else if (modoAtivo !== 'coluna') {
        const w = Math.abs(px - pontoA.x) || 0.1, d = Math.abs(pz - pontoA.z) || 0.1;
        previaMesh.scale.set(w, hTemp, d); previaMesh.position.set((pontoA.x + px)/2, alturaBase + hTemp/2, (pontoA.z + pz)/2); previaMesh.rotation.y = 0; previaMesh.visible = true;
      }
    }
  } else { cursor3D.visible = false; }
});

window.addEventListener('pointerup', e => {
  if (arrastandoSeta) {
      arrastandoSeta = null;
      mostrarGizmo(e.clientX, e.clientY);
      return;
  }

  if (arrastandoConstrucao && pontoA) {
    const hit = raycastPlanoBase(e.clientX, e.clientY);
    if (hit) {
      const px = snapGrid(hit.point.x), pz = snapGrid(hit.point.z);
      if (Math.abs(px - pontoA.x) > 0.1 || Math.abs(pz - pontoA.z) > 0.1) {
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
  finalizarAcao(); 
});

function aplicarMovimento(comodo, dx, dz) {
    comodo.paredes.forEach(p => { p.ax += dx; p.az += dz; p.bx += dx; p.bz += dz; p.mesh.position.x += dx; p.mesh.position.z += dz; });
    comodo.pilares.forEach(p => { p.x += dx; p.z += dz; p.mesh.position.x += dx; p.mesh.position.z += dz; });
}

function removerObjetoMundo(tipo, obj, arrayBase) {
    if (!obj) return;
    registrarRemocao(tipo, obj, arrayBase);
    scene.remove(obj.mesh);
    const idx = arrayBase.indexOf(obj);
    if (idx > -1) arrayBase.splice(idx, 1);

    if (obj.comodoId) {
        const c = comodosConstruidos.find(x => x.id === obj.comodoId);
        if (c) {
            if (tipo === 'parede') c.paredes = c.paredes.filter(x => x !== obj);
            if (tipo === 'pilar') c.pilares = c.pilares.filter(x => x !== obj);
        }
    }
}
function limparPilaresSoltos() {
    for (let i = pilaresConstruidos.length - 1; i >= 0; i--) {
        const pilar = pilaresConstruidos[i];
        const emUso = paredesConstruidas.some(p => p.pilarA === pilar || p.pilarB === pilar);
        if (!emUso) { removerObjetoMundo('pilar', pilar, pilaresConstruidos); }
    }
}
function obterOuCriarPilar(x, z, altura, isCerca, comodoId = null) {
    let pilar = pilaresConstruidos.find(p => Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01 && p.nivel === configsCamera.nivel && p.comodoId === comodoId);
    if (!pilar) {
        const mat = isCerca ? materialCerca : materialParede; const materiais = [mat.clone(), mat.clone(), mat.clone(), mat.clone(), mat.clone(), mat.clone()];
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, altura, 0.25), materiais); const alturaBase = configsCamera.nivel * obterAltura(); mesh.position.set(x, alturaBase + altura / 2, z); scene.add(mesh);
        pilar = { mesh, x, z, altura, nivel: configsCamera.nivel, comodoId }; pilaresConstruidos.push(pilar); registrarAdicao('pilar', pilar, pilaresConstruidos);
        if (comodoId) { const c = comodosConstruidos.find(com => com.id === comodoId); if (c) c.pilares.push(pilar); }
    } return pilar;
}
function criarSegmentoParede(ax, az, bx, bz, altura, isCerca, comodoId = null) {
  const existe = paredesConstruidas.find(p => p.nivel === configsCamera.nivel && ((Math.abs(p.ax - ax) < 0.01 && Math.abs(p.az - az) < 0.01 && Math.abs(p.bx - bx) < 0.01 && Math.abs(p.bz - bz) < 0.01) || (Math.abs(p.ax - bx) < 0.01 && Math.abs(p.az - bz) < 0.01 && Math.abs(p.bx - ax) < 0.01 && Math.abs(p.bz - az) < 0.01)));
  if (existe) return;
  const dx = bx - ax, dz = bz - az; const compTotal = Math.hypot(dx, dz); if (compTotal < 0.05) return;
  const pilarA = obterOuCriarPilar(ax, az, altura, isCerca, comodoId); const pilarB = obterOuCriarPilar(bx, bz, altura, isCerca, comodoId);
  const compParede = Math.max(0.001, compTotal - 0.25); const mat = isCerca ? materialCerca : materialParede; const materiais = [mat.clone(), mat.clone(), mat.clone(), mat.clone(), mat.clone(), mat.clone()];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, altura, compParede), materiais); const alturaBase = configsCamera.nivel * obterAltura(); mesh.position.set((ax+bx)/2, alturaBase + altura/2, (az+bz)/2); mesh.rotation.y = Math.atan2(dx, dz); scene.add(mesh);
  const parede = { mesh, ax, az, bx, bz, altura, nivel: configsCamera.nivel, isPorta: false, isCerca, pilarA, pilarB, comodoId };
  paredesConstruidas.push(parede); registrarAdicao('parede', parede, paredesConstruidas);
  if (comodoId) { const c = comodosConstruidos.find(com => com.id === comodoId); if (c) c.paredes.push(parede); }
}
function criarLinhaDeParedes(ax, az, bx, bz, altura, isCerca = false, comodoId = null) { const dx = bx - ax, dz = bz - az; const compTotal = Math.hypot(dx, dz); if (compTotal < 0.05) return; const qtd = Math.max(1, Math.round(compTotal / configMapa.tamanhoGrid)); const stepX = dx / qtd, stepZ = dz / qtd; for (let i = 0; i < qtd; i++) { criarSegmentoParede(ax + stepX * i, az + stepZ * i, ax + stepX * (i + 1), az + stepZ * (i + 1), altura, isCerca, comodoId); } }
function criarPoligonoDeParedes(vertices, altura, comodoId = null) { for (let i = 0; i < vertices.length; i++) { criarLinhaDeParedes(vertices[i].x, vertices[i].z, vertices[(i + 1) % vertices.length].x, vertices[(i + 1) % vertices.length].z, altura, false, comodoId); } }
function criarRetangulo(x1, z1, x2, z2, altura, comodoId = null) { const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2); criarPoligonoDeParedes([{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }], altura, comodoId); }
function criarTriangulo(x1, z1, x2, z2, altura, comodoId = null) { const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2); criarPoligonoDeParedes([{ x: (minX + maxX) / 2, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }], altura, comodoId); }
function criarOctogono(x1, z1, x2, z2, altura, comodoId = null) { const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2); const w = maxX - minX, d = maxZ - minZ, offX = w * 0.3, offZ = d * 0.3; criarPoligonoDeParedes([{ x: minX + offX, z: minZ }, { x: maxX - offX, z: minZ }, { x: maxX, z: minZ + offZ }, { x: maxX, z: maxZ - offZ }, { x: maxX - offX, z: maxZ }, { x: minX + offX, z: maxZ }, { x: minX, z: maxZ - offZ }, { x: minX, z: minZ + offZ }], altura, comodoId); }
function criarColunaSustentacao(x, z, altura) { const alturaBase = configsCamera.nivel * altura; const materiais = [materialParede.clone(), materialParede.clone(), materialParede.clone(), materialParede.clone(), materialParede.clone(), materialParede.clone()]; const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, altura, 0.4), materiais); mesh.position.set(x, alturaBase + altura / 2, z); scene.add(mesh); const coluna = { mesh, x, z, nivel: configsCamera.nivel, altura }; colunasSustentacao.push(coluna); registrarAdicao('coluna', coluna, colunasSustentacao); }
function criarEscada(ax, az, bx, bz, alturaAndar) { const dx = bx - ax, dz = bz - az; const comp = Math.hypot(dx, dz); if (comp < 0.5) return; const degraus = Math.max(3, Math.floor(comp / (configMapa.tamanhoGrid / 2))); const escadaMesh = new THREE.Group(); const angle = Math.atan2(dx, dz); for (let i = 0; i < degraus; i++) { const stepD = comp / degraus, stepH = alturaAndar / degraus; const mesh = new THREE.Mesh(new THREE.BoxGeometry(configMapa.tamanhoGrid, stepH * (i + 1), stepD), materialPiso.clone()); mesh.position.set(0, (stepH * (i + 1)) / 2, (i * stepD) - comp/2 + stepD/2); escadaMesh.add(mesh); } const alturaBase = configsCamera.nivel * alturaAndar; escadaMesh.position.set((ax+bx)/2, alturaBase, (az+bz)/2); escadaMesh.rotation.y = angle; scene.add(escadaMesh); const escada = { mesh: escadaMesh, nivel: configsCamera.nivel, isEscada: true }; escadasConstruidas.push(escada); registrarAdicao('escada', escada, escadasConstruidas); }

function executarMarreta(hitObject) {
  if (!hitObject || hitObject === meshChaoBase) return;
  const isPiso = pisosConstruidos.some(p => p.mesh === hitObject);
  const isParedeMode = ['parede', 'cerca', 'retangulo', 'triangulo', 'octogono'].includes(modoAtivo);
  if (isParedeMode && isPiso) return; 
  
  const parede = paredesConstruidas.find(p => p.mesh === hitObject);
  if (parede) { removerObjetoMundo('parede', parede, paredesConstruidas); limparPilaresSoltos(); return; }
  
  const pilar = pilaresConstruidos.find(p => p.mesh === hitObject);
  if (pilar) { const attachedWalls = paredesConstruidas.filter(p => p.pilarA === pilar || p.pilarB === pilar); attachedWalls.forEach(p => removerObjetoMundo('parede', p, paredesConstruidas)); limparPilaresSoltos(); return; }
  
  const piso = pisosConstruidos.find(p => p.mesh === hitObject);
  if (piso) { removerObjetoMundo('piso', piso, pisosConstruidos); return; }
  
  const coluna = colunasSustentacao.find(p => p.mesh === hitObject);
  if (coluna) { removerObjetoMundo('coluna', coluna, colunasSustentacao); return; }
  
  const escada = escadasConstruidas.find(e => e.mesh === hitObject.parent);
  if (escada) { removerObjetoMundo('escada', escada, escadasConstruidas); return; }
}

// ----------------------------------------------------
// PINTURA E REMOÇÃO DE PINTURA (BORRACHA)
// ----------------------------------------------------
function gerarMaterialPintura(item, repeatX = 1, repeatY = 1) { const mat = new THREE.MeshLambertMaterial(); if (item.tipo === 'cor') { mat.color.set(item.cor); } else { const tex = item.textura.clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeatX, repeatY); mat.map = tex; mat.color.set(0xffffff); } return mat; }
function aplicarMaterialNaFace(mesh, faceIndex, item) { registrarPintura(mesh); let repeatX = 1, repeatY = 1; if (mesh.geometry && mesh.geometry.parameters) { const { width, height, depth } = mesh.geometry.parameters; if (faceIndex === 0 || faceIndex === 1) { repeatX = depth; repeatY = height; } else if (faceIndex === 2 || faceIndex === 3) { repeatX = width; repeatY = depth; } else if (faceIndex === 4 || faceIndex === 5) { repeatX = width; repeatY = height; } } const novosMateriais = [...mesh.material]; novosMateriais[faceIndex] = gerarMaterialPintura(item, repeatX, repeatY); mesh.material = novosMateriais; finalizarPintura(mesh); }
function pintarFacePorNormalMundial(mesh, targetNormal, item) { const tNorm = targetNormal.clone().normalize(); const localNormals = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)]; for (let i = 0; i < 6; i++) { const worldNormal = localNormals[i].clone().applyQuaternion(mesh.quaternion).normalize(); if (worldNormal.dot(tNorm) > 0.5) aplicarMaterialNaFace(mesh, i, item); } }
function removerMaterialNaFace(mesh, faceIndex, matBase) { registrarPintura(mesh); const novosMateriais = [...mesh.material]; novosMateriais[faceIndex] = matBase.clone(); mesh.material = novosMateriais; finalizarPintura(mesh); }
function removerPinturaFacePorNormal(mesh, targetNormal, matBase) { const tNorm = targetNormal.clone().normalize(); const localNormals = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)]; for (let i = 0; i < 6; i++) { const worldNormal = localNormals[i].clone().applyQuaternion(mesh.quaternion).normalize(); if (worldNormal.dot(tNorm) > 0.5) removerMaterialNaFace(mesh, i, matBase); } }
function aplicarPiso(x, z, item) { let tile = pisosConstruidos.find(p => Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01 && p.nivel === configsCamera.nivel); if (!tile) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(configMapa.tamanhoGrid, 0.12, configMapa.tamanhoGrid), materialPiso.clone()); const alturaBase = configsCamera.nivel * obterAltura(); mesh.position.set(x, alturaBase + 0.06, z); scene.add(mesh); tile = { mesh, x, z, nivel: configsCamera.nivel }; pisosConstruidos.push(tile); registrarAdicao('piso', tile, pisosConstruidos); } registrarPintura(tile.mesh); tile.mesh.material = gerarMaterialPintura(item, configMapa.tamanhoGrid, configMapa.tamanhoGrid); finalizarPintura(tile.mesh); }
function removerPiso(x, z) { const tile = pisosConstruidos.find(p => Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01 && p.nivel === configsCamera.nivel); if (tile) { removerObjetoMundo('piso', tile, pisosConstruidos); } }
function distanciaPontoSegmento(px, pz, ax, az, bx, bz) { const compSq = (bx-ax)**2 + (bz-az)**2; if (compSq === 0) return Math.hypot(px-ax, pz-az); let t = Math.max(0, Math.min(1, ((px-ax)*(bx-ax) + (pz-az)*(bz-az)) / compSq)); return Math.hypot(px - (ax + t*(bx-ax)), pz - (az + t*(bz-az))); }
function paredeQueBloqueia(x1, z1, x2, z2) { const midX = (x1+x2)/2, midZ = (z1+z2)/2; return paredesConstruidas.find(p => p.nivel === configsCamera.nivel && !p.isCerca && distanciaPontoSegmento(midX, midZ, p.ax, p.az, p.bx, p.bz) < 0.2) || null; }
function encontrarAreaFechada(xInicial, zInicial) { const visitados = new Set(), pilha = [{ x: xInicial, z: zInicial }], celulas = []; const limiteX = configMapa.largura / 2, limiteZ = configMapa.profundidade / 2; while (pilha.length && celulas.length < 50000) { const atual = pilha.pop(), chave = `${atual.x.toFixed(2)},${atual.z.toFixed(2)}`; if (visitados.has(chave)) continue; visitados.add(chave); if (atual.x < -limiteX + 0.1 || atual.x > limiteX - 0.1 || atual.z < -limiteZ + 0.1 || atual.z > limiteZ - 0.1) continue; celulas.push(atual); [[1,0], [-1,0], [0,1], [0,-1]].forEach(([dx, dz]) => { const vx = atual.x + dx * configMapa.tamanhoGrid, vz = atual.z + dz * configMapa.tamanhoGrid; if (!paredeQueBloqueia(atual.x, atual.z, vx, vz)) pilha.push({ x: vx, z: vz }); }); } return { celulas }; }

// ----------------------------------------------------
// GERENCIADOR DE VISIBILIDADE E FANTASMA (CORRIGIDO)
// ----------------------------------------------------
function setOpacity(mesh, isTransparent, opacity) { 
    if (!mesh) return; 
    if (mesh.type === 'Group') { 
        mesh.children.forEach(child => setOpacity(child, isTransparent, opacity)); 
    } else if (Array.isArray(mesh.material)) { 
        mesh.material.forEach(m => { 
            if (m.transparent !== isTransparent) m.needsUpdate = true; // CORREÇÃO
            m.transparent = isTransparent; 
            m.opacity = opacity; 
        }); 
    } else if (mesh.material) { 
        if (mesh.material.transparent !== isTransparent) mesh.material.needsUpdate = true;
        mesh.material.transparent = isTransparent; 
        mesh.material.opacity = opacity; 
    } 
}

export function atualizarVisibilidadeAndares(modoVisaoManual) {
  if (modoVisaoManual) modoVisaoAtual = modoVisaoManual; 
  const mostrarFantasma = (modoAtivo === 'coluna'); 
  
  const aplicarParede = (obj) => { 
      if (obj.nivel > configsCamera.nivel) { 
          obj.mesh.visible = false; // Paredes superiores NUNCA ficam de fantasma
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
              // Fantasma se aplica APENAS para pisos e escadas
              if (mostrarFantasma && obj.nivel === configsCamera.nivel + 1) { obj.mesh.visible = true; setOpacity(obj.mesh, true, 0.15); } 
              else obj.mesh.visible = false; 
          } else { 
              obj.mesh.visible = true; setOpacity(obj.mesh, false, 1); 
          } 
      }); 
  });
}