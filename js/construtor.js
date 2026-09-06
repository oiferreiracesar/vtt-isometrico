// js/construtor.js - Múltiplos Andares, Gizmo, Masmorras, TELHADOS, Landing Pads e SAVE BLINDADO
import { scene, camera, canvas, configsCamera, orbitAlvo, atualizarCamera } from './engine.js';
import { configMapa, meshChaoBase, meshChaoMasmorra, gridHelper } from './mapa.js';
import { showAviso, itemSelecionadoAtual, mostrarGizmo, esconderGizmo, selecionarMaterialNaPaleta } from './ui.js';

export let modoAtivo = null;
export let modoVisaoAtual = 'full'; 

export const comodosConstruidos = []; 
export const paredesConstruidas = [];
export const pilaresConstruidos = []; 
export const pisosConstruidos = []; 
export const escadasConstruidas = [];
export const colunasSustentacao = [];
export const telhadosConstruidos = []; 

let arrastandoConstrucao = false;
let comodoSelecionado = null; 
let escadaSelecionada = null; 
let telhadoSelecionado = null; 
let movendoSelecionado = false;
let pontoA = null; 

let arrastandoSeta = null;
let comodoArrastadoBounds = null;

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

const matFog = new THREE.MeshBasicMaterial({ color: 0x05080c, transparent: true, opacity: 0.65, depthWrite: false });
const fogAndares = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), matFog);
fogAndares.rotation.x = -Math.PI / 2;
scene.add(fogAndares);

const historicoUndo = [];
const historicoRedo = [];
let acaoAtual = null;

// =========================================================================
// TRADUTOR DE DECORAÇÃO BLINDADO (RESOLVE O CRASH DA LINHA 0 E UNDEFINED SIDE)
// =========================================================================
const cacheTexturas = {}; 

function extrairMateriais(mesh) {
    if (!mesh || !mesh.material) return [];
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    return mats.map(m => {
        if (!m) return { tipo: 'cor', cor: '#8a7550' }; 
        if (m.map && m.map.image) return { tipo: 'imagem', dataUrl: m.map.image.src || m.map.image.currentSrc };
        if (m.color) return { tipo: 'cor', cor: '#' + m.color.getHexString() };
        return { tipo: 'cor', cor: '#ffffff' };
    });
}

function extrairMaterialEscada(escada) {
    if (escada.mesh.children.length > 0) {
        const m = escada.mesh.children[0].material;
        if (m && m.map && m.map.image) return { tipo: 'imagem', dataUrl: m.map.image.src || m.map.image.currentSrc };
        if (m && m.color) return { tipo: 'cor', cor: '#' + m.color.getHexString() };
    }
    return { tipo: 'cor', cor: '#8a7550' };
}

function aplicarMateriaisImportados(mesh, matDataArray, objectType) {
    if (!matDataArray || matDataArray.length === 0 || !mesh) return;
    
    const materiais = matDataArray.map(data => {
        if (!data) return new THREE.MeshLambertMaterial({ color: '#ffffff' });
        if (data.tipo === 'imagem' && data.dataUrl) {
            let tex = cacheTexturas[data.dataUrl];
            if (!tex) {
                tex = new THREE.TextureLoader().load(data.dataUrl);
                tex.colorSpace = THREE.SRGBColorSpace;
                cacheTexturas[data.dataUrl] = tex;
            }
            const cloneTex = tex.clone(); 
            cloneTex.needsUpdate = true;
            cloneTex.wrapS = cloneTex.wrapT = THREE.RepeatWrapping;
            return new THREE.MeshLambertMaterial({ map: cloneTex, color: 0xffffff });
        } else {
            return new THREE.MeshLambertMaterial({ color: data.cor || '#ffffff' });
        }
    });

    const groupsLen = mesh.geometry.groups && mesh.geometry.groups.length > 0 ? mesh.geometry.groups.length : 1;

    // BLINDAGEM MÁXIMA CONTRA CRASH: 
    // Garante que a geometria vai ter a quantidade exata de texturas, sem nenhum 'undefined' para quebrar o Laser
    if (groupsLen > 1) {
        if (materiais.length === 1) {
            mesh.material = materiais[0]; // Aplica 1 material pra todos os lados (Seguro)
        } else if (materiais.length === groupsLen) {
            mesh.material = materiais;
        } else {
            const padded = [];
            for(let i = 0; i < groupsLen; i++) padded.push(materiais[i] ? materiais[i] : materiais[0].clone());
            mesh.material = padded;
        }
    } else {
        mesh.material = materiais[0];
    }

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mat, faceIndex) => {
        if (mat && mat.map && mesh.geometry) {
            let repeatX = 1, repeatY = 1;
            if (objectType === 'piso' || objectType === 'escada') {
                repeatX = configMapa.tamanhoGrid; repeatY = configMapa.tamanhoGrid;
            } else if (objectType === 'telhado' || mesh.geometry.type === 'ConeGeometry') {
                repeatX = Math.max(1, mesh.scale.x / configMapa.tamanhoGrid) * 2;
                repeatY = Math.max(1, mesh.scale.y / configMapa.tamanhoGrid);
            } else if (mesh.geometry.parameters) {
                const { width, height, depth } = mesh.geometry.parameters;
                if (faceIndex === 0 || faceIndex === 1) { repeatX = depth; repeatY = height; }
                else if (faceIndex === 2 || faceIndex === 3) { repeatX = width; repeatY = depth; }
                else if (faceIndex === 4 || faceIndex === 5) { repeatX = width; repeatY = height; }
            }
            mat.map.repeat.set(repeatX, repeatY);
            mat.needsUpdate = true;
        }
    });
}

export function limparMapa() {
    [...paredesConstruidas, ...pilaresConstruidos, ...pisosConstruidos, ...colunasSustentacao, ...telhadosConstruidos].forEach(obj => { scene.remove(obj.mesh); });
    escadasConstruidas.forEach(e => scene.remove(e.mesh));

    paredesConstruidas.length = 0; pilaresConstruidos.length = 0; pisosConstruidos.length = 0; colunasSustentacao.length = 0; escadasConstruidas.length = 0; comodosConstruidos.length = 0; telhadosConstruidos.length = 0;
    historicoUndo.length = 0; historicoRedo.length = 0;
    
    setModoAtivo(null); atualizarVisibilidadeAndares(); showAviso("Tabuleiro completamente limpo!");
}

export function exportarMapa() {
    const dados = {
        versao: 2, 
        pisos: pisosConstruidos.map(p => ({ x: p.x, z: p.z, nivel: p.nivel, materiais: extrairMateriais(p.mesh) })),
        pilares: pilaresConstruidos.map(p => ({ x: p.x, z: p.z, altura: p.altura, nivel: p.nivel, isCerca: p.isCerca, comodoId: p.comodoId, materiais: extrairMateriais(p.mesh) })),
        paredes: paredesConstruidas.map(p => ({ ax: p.ax, az: p.az, bx: p.bx, bz: p.bz, altura: p.altura, isCerca: p.isCerca, comodoId: p.comodoId, nivel: p.nivel, isPorta: p.isPorta, materiais: extrairMateriais(p.mesh) })),
        colunas: colunasSustentacao.map(c => ({ x: c.x, z: c.z, altura: c.altura, nivel: c.nivel, materiais: extrairMateriais(c.mesh) })),
        escadas: escadasConstruidas.map(e => ({ ax: e.ax, az: e.az, bx: e.bx, bz: e.bz, alturaAndar: e.alturaAndar, largura: e.largura, nivel: e.nivel, material: extrairMaterialEscada(e) })),
        telhados: telhadosConstruidos.map(t => ({ ax: t.ax, az: t.az, bx: t.bx, bz: t.bz, alturaTelhado: t.alturaTelhado, nivel: t.nivel, materiais: extrairMateriais(t.mesh) }))
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dados));
    const downloadNode = document.createElement('a'); downloadNode.setAttribute("href", dataStr); downloadNode.setAttribute("download", "masmorra_decorada.json");
    document.body.appendChild(downloadNode); downloadNode.click(); downloadNode.remove();
    showAviso("Projeto exportado com sucesso!");
}

export function importarMapa(dados) {
    limparMapa();
    const nivelOriginal = configsCamera.nivel;

    const comodosIds = new Set();
    if (dados.paredes) dados.paredes.forEach(p => { if(p.comodoId) comodosIds.add(p.comodoId); });
    if (dados.pilares) dados.pilares.forEach(p => { if(p.comodoId) comodosIds.add(p.comodoId); });
    comodosIds.forEach(id => comodosConstruidos.push({ id, paredes: [], pilares: [] }));

    if(dados.pisos) {
        dados.pisos.forEach(p => {
            configsCamera.nivel = p.nivel;
            aplicarPiso(p.x, p.z, { tipo: 'cor', cor: '#8a7550' }); 
            const piso = pisosConstruidos.find(tile => Math.abs(tile.x - p.x) < 0.01 && Math.abs(tile.z - p.z) < 0.01 && tile.nivel === p.nivel);
            if(piso) aplicarMateriaisImportados(piso.mesh, p.materiais, 'piso');
        });
    }
    if(dados.pilares) {
        dados.pilares.forEach(p => {
            configsCamera.nivel = p.nivel;
            const pilar = obterOuCriarPilar(p.x, p.z, p.altura, p.isCerca, p.comodoId);
            if(pilar) aplicarMateriaisImportados(pilar.mesh, p.materiais, 'pilar');
        });
    }
    if(dados.paredes) {
        dados.paredes.forEach(p => {
            configsCamera.nivel = p.nivel;
            criarSegmentoParede(p.ax, p.az, p.bx, p.bz, p.altura, p.isCerca, p.comodoId);
            const parede = paredesConstruidas.find(w => Math.abs(w.ax - p.ax) < 0.01 && Math.abs(w.az - p.az) < 0.01 && Math.abs(w.bx - p.bx) < 0.01 && Math.abs(w.bz - p.bz) < 0.01 && w.nivel === p.nivel);
            
            if (parede) {
                aplicarMateriaisImportados(parede.mesh, p.materiais, 'parede');
                if (p.isPorta) {
                    parede.isPorta = true;
                    const matPorta = new THREE.MeshLambertMaterial({ color: 0x4a3320 });
                    parede.mesh.material = [matPorta, matPorta, matPorta, matPorta, matPorta, matPorta];
                }
            }
        });
    }
    if(dados.colunas) {
        dados.colunas.forEach(c => {
            configsCamera.nivel = c.nivel;
            criarColunaSustentacao(c.x, c.z, c.altura);
            const col = colunasSustentacao.find(col => Math.abs(col.x - c.x) < 0.01 && Math.abs(col.z - c.z) < 0.01 && col.nivel === c.nivel);
            if(col) aplicarMateriaisImportados(col.mesh, c.materiais, 'coluna');
        });
    }
    if(dados.escadas) {
        dados.escadas.forEach(e => {
            configsCamera.nivel = e.nivel;
            criarEscada(e.ax, e.az, e.bx, e.bz, e.alturaAndar, e.largura, e.nivel);
            const escada = escadasConstruidas.find(s => Math.abs(s.ax - e.ax) < 0.01 && Math.abs(s.az - e.az) < 0.01 && Math.abs(s.bx - e.bx) < 0.01 && Math.abs(s.bz - e.bz) < 0.01 && s.nivel === e.nivel);
            if (escada && e.material) {
                escada.textura = { tipo: e.material.tipo, cor: e.material.cor, dataUrl: e.material.dataUrl };
                escada.mesh.children.forEach(child => aplicarMateriaisImportados(child, [e.material], 'escada'));
            }
        });
    }
    if(dados.telhados) {
        dados.telhados.forEach(t => {
            configsCamera.nivel = t.nivel;
            criarTelhado(t.ax, t.az, t.bx, t.bz, t.alturaTelhado);
            const tel = telhadosConstruidos[telhadosConstruidos.length - 1];
            if(tel) aplicarMateriaisImportados(tel.mesh, t.materiais, 'telhado');
        });
    }

    configsCamera.nivel = nivelOriginal; historicoUndo.length = 0; acaoAtual = null;
    atualizarVisibilidadeAndares(); showAviso("Decorações carregadas com sucesso!");
}

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

const materialParede = new THREE.MeshLambertMaterial({ color: 0x6a5f48 });
const materialCerca = new THREE.MeshLambertMaterial({ color: 0x5a4f38 }); 
const materialPiso = new THREE.MeshLambertMaterial({ color: 0x8a7550 });
const materialTelhadoPadrão = new THREE.MeshLambertMaterial({ color: 0x5c2b29 }); 

const materialPrevia = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
const materialCursor = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false });
const materialMarreta = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.6, depthWrite: false });
const materialPreviaEscada = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.6, depthWrite: false });

const cursor3D = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), materialCursor);
cursor3D.rotation.x = -Math.PI / 2; cursor3D.visible = false; scene.add(cursor3D);

const previaMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materialPrevia);
previaMesh.visible = false; scene.add(previaMesh);

const previaEscadaInicio = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), materialPreviaEscada);
previaEscadaInicio.rotation.x = -Math.PI / 2; previaEscadaInicio.visible = false; scene.add(previaEscadaInicio);

const previaEscadaFim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), materialPreviaEscada);
previaEscadaFim.rotation.x = -Math.PI / 2; previaEscadaFim.visible = false; scene.add(previaEscadaFim);

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
  const telhadosF = telhadosConstruidos.filter(t => t.nivel === configsCamera.nivel).map(t => t.mesh);
  
  const objetosNivel = [...paredesF, ...pilaresF, ...pisosF, ...colunasF, ...escadasF, ...telhadosF];
  if (configsCamera.nivel === 0 && meshChaoBase) objetosNivel.push(meshChaoBase);
  if (configsCamera.nivel < 0 && meshChaoMasmorra) objetosNivel.push(meshChaoMasmorra);

  const hits = raycaster.intersectObjects(objetosNivel, true);
  return hits.length ? hits[0] : null;
}

export function setModoAtivo(modo) {
  modoAtivo = modo;
  arrastandoConstrucao = false;
  pontoA = null;
  limparSelecao();
  previaMesh.visible = false;
  previaEscadaInicio.visible = false;
  previaEscadaFim.visible = false;
  cursor3D.visible = false;
  const divMedida = document.getElementById('cursor-medida');
  if(divMedida) divMedida.style.display = 'none';
}

function limparSelecao() {
    if (comodoSelecionado) comodoSelecionado.paredes.forEach(p => p.mesh.material.forEach(m => m.emissive.setHex(0x000000)));
    if (escadaSelecionada) escadaSelecionada.mesh.children.forEach(c => c.material.emissive.setHex(0x000000));
    if (telhadoSelecionado) telhadoSelecionado.mesh.material.forEach(m => { if(m && m.emissive) m.emissive.setHex(0x000000); });
    
    comodoSelecionado = null; escadaSelecionada = null; telhadoSelecionado = null;
    movendoSelecionado = false; arrastandoSeta = null;
    esconderGizmo(); grupoSetas.visible = false;
}

function atualizarSetasResize() {
    if (!comodoSelecionado) { grupoSetas.visible = false; return; }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    comodoSelecionado.paredes.forEach(p => {
        minX = Math.min(minX, p.ax, p.bx); maxX = Math.max(maxX, p.ax, p.bx);
        minZ = Math.min(minZ, p.az, p.bz); maxZ = Math.max(maxZ, p.az, p.bz);
    });
    const cx = (minX + maxX) / 2; const cz = (minZ + maxZ) / 2; const h = (configsCamera.nivel * obterAltura()) + (obterAltura() / 2);
    setaN.position.set(cx, h, minZ - 1.2); setaS.position.set(cx, h, maxZ + 1.2);
    setaE.position.set(maxX + 1.2, h, cz); setaW.position.set(minX - 1.2, h, cz);
    grupoSetas.visible = true;
}

export function iniciarArrasteSelecionado() {
    if (!comodoSelecionado && !escadaSelecionada && !telhadoSelecionado) return;
    movendoSelecionado = true; esconderGizmo(); grupoSetas.visible = false;
    iniciarAcao(); pontoA = null; showAviso("Colado no mouse. Clique para soltar!");
}

export function girarSelecionado(sentido) {
    if (comodoSelecionado) {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        comodoSelecionado.paredes.forEach(p => {
            minX = Math.min(minX, p.ax, p.bx); maxX = Math.max(maxX, p.ax, p.bx);
            minZ = Math.min(minZ, p.az, p.bz); maxZ = Math.max(maxZ, p.az, p.bz);
        });
        const cx = snapMeioGrid((minX + maxX) / 2), cz = snapMeioGrid((minZ + maxZ) / 2);
        const angulo = sentido === 'esq' ? Math.PI / 2 : -Math.PI / 2;
        const cos = Math.round(Math.cos(angulo)), sin = Math.round(Math.sin(angulo));

        comodoSelecionado.paredes.forEach(p => {
            const nx1 = cx + (p.ax - cx) * cos - (p.az - cz) * sin, nz1 = cz + (p.ax - cx) * sin + (p.az - cz) * cos;
            const nx2 = cx + (p.bx - cx) * cos - (p.bz - cz) * sin, nz2 = cz + (p.bx - cx) * sin + (p.bz - cz) * cos;
            p.ax = nx1; p.az = nz1; p.bx = nx2; p.bz = nz2; atualizarGeometriaParede(p);
        });
        comodoSelecionado.pilares.forEach(p => {
            const nx = cx + (p.x - cx) * cos - (p.z - cz) * sin, nz = cz + (p.x - cx) * sin + (p.z - cz) * cos;
            p.x = nx; p.z = nz; atualizarGeometriaPilar(p);
        });
        atualizarSetasResize();
    } else if (escadaSelecionada) {
        const angulo = sentido === 'esq' ? Math.PI / 2 : -Math.PI / 2;
        escadaSelecionada.mesh.rotation.y += angulo;
    } else if (telhadoSelecionado) {
        const angulo = sentido === 'esq' ? Math.PI / 2 : -Math.PI / 2;
        telhadoSelecionado.mesh.rotation.y += angulo;
    }
}

export function alterarDimensaoGizmo(direcao) {
    if (escadaSelecionada) {
        const newLargura = Math.max(configMapa.tamanhoGrid, escadaSelecionada.largura + (direcao * configMapa.tamanhoGrid));
        if (newLargura === escadaSelecionada.largura) return; 
        iniciarAcao(); reconstruirDegrausEscada(escadaSelecionada, newLargura); finalizarAcao();
        showAviso(`Largura alterada para ${newLargura / configMapa.tamanhoGrid} quadrados.`);
    } else if (telhadoSelecionado) {
        const novaAltura = Math.max(0.5, telhadoSelecionado.alturaTelhado + (direcao * 0.5));
        if (novaAltura === telhadoSelecionado.alturaTelhado) return;
        
        iniciarAcao(); 
        telhadoSelecionado.alturaTelhado = novaAltura;
        
        const minX = telhadoSelecionado.ax, maxX = telhadoSelecionado.bx;
        const minZ = telhadoSelecionado.az, maxZ = telhadoSelecionado.bz;
        const largura = Math.max(configMapa.tamanhoGrid, Math.abs(maxX - minX)) + 0.5;
        const profundidade = Math.max(configMapa.tamanhoGrid, Math.abs(maxZ - minZ)) + 0.5;
        
        telhadoSelecionado.mesh.scale.set(largura, novaAltura, profundidade);
        const alturaBase = (telhadoSelecionado.nivel * obterAltura()) + obterAltura();
        telhadoSelecionado.mesh.position.y = alturaBase + (novaAltura / 2);
        
        finalizarAcao();
        showAviso(`Altura do telhado alterada para ${novaAltura}m.`);
    }
}

export function deletarSelecionado() {
    iniciarAcao();
    if (comodoSelecionado) {
        const pArray = [...comodoSelecionado.paredes], pilArray = [...comodoSelecionado.pilares];
        pArray.forEach(p => removerObjetoMundo('parede', p, paredesConstruidas));
        pilArray.forEach(p => removerObjetoMundo('pilar', p, pilaresConstruidos));
    } else if (escadaSelecionada) { 
        removerObjetoMundo('escada', escadaSelecionada, escadasConstruidas); 
    } else if (telhadoSelecionado) {
        removerObjetoMundo('telhado', telhadoSelecionado, telhadosConstruidos);
    }
    limparSelecao(); finalizarAcao(); showAviso("Demolido.");
}

function atualizarGeometriaParede(parede) {
    const dx = parede.bx - parede.ax, dz = parede.bz - parede.az;
    const compTotal = Math.hypot(dx, dz); const compParede = Math.max(0.001, compTotal - 0.25); 
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

function criarTelhado(ax, az, bx, bz, alturaTelhado = 2.0) {
    const minX = Math.min(ax, bx); const maxX = Math.max(ax, bx);
    const minZ = Math.min(az, bz); const maxZ = Math.max(az, bz);
    
    const largura = Math.max(configMapa.tamanhoGrid, Math.abs(maxX - minX)) + 0.5;
    const profundidade = Math.max(configMapa.tamanhoGrid, Math.abs(maxZ - minZ)) + 0.5;
    
    const radius = Math.SQRT2 / 2; 
    const geo = new THREE.ConeGeometry(radius, 1, 4);
    geo.rotateY(Math.PI / 4); 
    
    const matSides = materialTelhadoPadrão.clone();
    const matBottom = new THREE.MeshBasicMaterial({ color: 0x000000, visible: false }); 
    const mesh = new THREE.Mesh(geo, [matSides, matBottom]);
    
    mesh.scale.set(largura, alturaTelhado, profundidade);
    
    const cx = (minX + maxX) / 2; const cz = (minZ + maxZ) / 2;
    const alturaBase = (configsCamera.nivel * obterAltura()) + obterAltura(); 
    
    mesh.position.set(cx, alturaBase + (alturaTelhado / 2), cz);
    scene.add(mesh);
    
    const telhado = { mesh, ax: minX, az: minZ, bx: maxX, bz: maxZ, alturaTelhado, nivel: configsCamera.nivel, isTelhado: true };
    telhadosConstruidos.push(telhado);
    registrarAdicao('telhado', telhado, telhadosConstruidos);
}

canvas?.addEventListener('dblclick', e => {
  const hit = raycastPlanoBase(e.clientX, e.clientY);
  if (hit) { orbitAlvo.x = hit.point.x; orbitAlvo.z = hit.point.z; atualizarCamera(); showAviso("Câmera focada!"); }
});

canvas?.addEventListener('pointerdown', e => {
  if (e.button !== 0 && !(e.button === 2 && e.ctrlKey)) return;
  
  if (movendoSelecionado) {
      movendoSelecionado = false; pontoA = null; finalizarAcao(); limparSelecao();
      showAviso("Posicionado!"); return;
  }

  if (!modoAtivo && e.button === 0 && !e.altKey && !e.ctrlKey && !e.shiftKey) {
      if (grupoSetas.visible) {
          raycaster.setFromCamera(mouseNdc, camera);
          const hitsSetas = raycaster.intersectObjects(grupoSetas.children);
          if (hitsSetas.length > 0) {
              arrastandoSeta = hitsSetas[0].object.userData.dir; esconderGizmo();
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
      if (hitAll && hitAll.object !== meshChaoBase && hitAll.object !== meshChaoMasmorra) {
          const isEscada = escadasConstruidas.find(esc => esc.mesh === hitAll.object.parent);
          if (isEscada) {
              limparSelecao(); escadaSelecionada = isEscada;
              escadaSelecionada.mesh.children.forEach(c => c.material.emissive.setHex(0x2a2a2a));
              mostrarGizmo(e.clientX, e.clientY); return;
          }
          const isTelhado = telhadosConstruidos.find(t => t.mesh === hitAll.object);
          if (isTelhado) {
              limparSelecao(); telhadoSelecionado = isTelhado;
              telhadoSelecionado.mesh.material.forEach(m => { if(m && m.emissive) m.emissive.setHex(0x2a2a2a); });
              mostrarGizmo(e.clientX, e.clientY); return;
          }
          const objClicado = paredesConstruidas.find(p => p.mesh === hitAll.object) || pilaresConstruidos.find(p => p.mesh === hitAll.object);
          if (objClicado && objClicado.comodoId) {
              limparSelecao();
              comodoSelecionado = comodosConstruidos.find(c => c.id === objClicado.comodoId);
              if (comodoSelecionado) {
                  comodoSelecionado.paredes.forEach(p => p.mesh.material.forEach(m => m.emissive.setHex(0x2a2a2a)));
                  mostrarGizmo(e.clientX, e.clientY); atualizarSetasResize(); return;
              }
          }
      }
      limparSelecao(); return;
  }

  if (!modoAtivo) return; 
  iniciarAcao();

  if (e.ctrlKey && modoAtivo !== 'pintura') {
    const hit = raycastObjetosDoNivel(e.clientX, e.clientY);
    if (hit) executarMarreta(hit.object);
    return;
  }
  
  if (['parede', 'cerca', 'escada', 'escada_baixo', 'retangulo', 'triangulo', 'octogono', 'telhado'].includes(modoAtivo)) {
    const hit = raycastPlanoBase(e.clientX, e.clientY);
    if (hit) { pontoA = { x: snapGrid(hit.point.x), z: snapGrid(hit.point.z) }; arrastandoConstrucao = true; }
    return;
  }

  if (modoAtivo === 'coluna') {
     const hit = raycastPlanoBase(e.clientX, e.clientY);
     if (hit) { criarColunaSustentacao(snapGrid(hit.point.x), snapGrid(hit.point.z), obterAltura()); showAviso("🏛️ Coluna instalada!"); }
     return;
  }

  if (modoAtivo === 'pintura') {
      const isRemocao = e.ctrlKey; const isPipeta = e.altKey;
      const hitAll = raycastObjetosDoNivel(e.clientX, e.clientY);
      const chaoHit = raycastPlanoBase(e.clientX, e.clientY);
      if (!hitAll && !chaoHit) return;

      const targetObject = hitAll ? hitAll.object : null;

      if (isPipeta) {
          if (targetObject && targetObject.material) {
              let matAlvo = targetObject.material;
              if (Array.isArray(matAlvo)) {
                  const faceClicada = hitAll.face ? hitAll.face.materialIndex : 0;
                  matAlvo = matAlvo[faceClicada];
              }
              selecionarMaterialNaPaleta(matAlvo);
          }
          return;
      }

      const item = itemSelecionadoAtual();
      if (!isRemocao && !item) return;

      const clickPoint = hitAll ? hitAll.point : chaoHit.point;
      const isEscada = targetObject && escadasConstruidas.some(e => e.mesh === targetObject.parent);
      if (isEscada) {
          const escada = escadasConstruidas.find(e => e.mesh === targetObject.parent);
          escada.mesh.children.forEach(step => { 
              registrarPintura(step);
              step.material = isRemocao ? materialPiso.clone() : gerarMaterialPintura(item, configMapa.tamanhoGrid, configMapa.tamanhoGrid); 
              finalizarPintura(step);
          });
          escada.textura = isRemocao ? null : item; return;
      }

      const isParede = targetObject && paredesConstruidas.some(p => p.mesh === targetObject);
      const isPilar = targetObject && pilaresConstruidos.some(p => p.mesh === targetObject);
      const isColuna = targetObject && colunasSustentacao.some(p => p.mesh === targetObject);
      const isTelhado = targetObject && telhadosConstruidos.some(t => t.mesh === targetObject);

      if (e.shiftKey) {
          let startX = snapCentroCelula(clickPoint.x); let startZ = snapCentroCelula(clickPoint.z);
          if (targetObject && (isParede || isPilar)) {
              const faceClicada = hitAll.face ? hitAll.face.materialIndex : 0;
              const localNormals = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)];
              const worldNormal = localNormals[faceClicada].clone().applyQuaternion(targetObject.quaternion).normalize();
              startX = snapCentroCelula(clickPoint.x + worldNormal.x * 0.1); startZ = snapCentroCelula(clickPoint.z + worldNormal.z * 0.1);
          }
          const { celulas } = encontrarAreaFechada(startX, startZ);
          if (targetObject && (isParede || isPilar)) {
             celulas.forEach(c => {
               [['x',1],['x',-1],['z',1],['z',-1]].forEach(([eixo, dir]) => {
                  const dx = eixo==='x' ? configMapa.tamanhoGrid * dir : 0, dz = eixo==='z' ? configMapa.tamanhoGrid * dir : 0;
                  const p = paredeQueBloqueia(c.x, c.z, c.x + dx, c.z + dz);
                  if (p && !p.isPorta && !p.isCerca) { 
                     const dirNorm = new THREE.Vector3(c.x - p.mesh.position.x, 0, c.z - p.mesh.position.z).normalize();
                     if (isRemocao) { removerPinturaFacePorNormal(p.mesh, dirNorm, materialParede); if (p.pilarA) removerPinturaFacePorNormal(p.pilarA.mesh, dirNorm, materialParede); if (p.pilarB) removerPinturaFacePorNormal(p.pilarB.mesh, dirNorm, materialParede);
                     } else { pintarFacePorNormalMundial(p.mesh, dirNorm, item); if (p.pilarA) pintarFacePorNormalMundial(p.pilarA.mesh, dirNorm, item); if (p.pilarB) pintarFacePorNormalMundial(p.pilarB.mesh, dirNorm, item); }
                  }
               });
             });
          } else { celulas.forEach(c => { if (isRemocao) removerPiso(c.x, c.z); else aplicarPiso(c.x, c.z, item); }); }
      } else {
          if (isTelhado) {
              if (isRemocao) removerMaterialNaFace(targetObject, 0, materialTelhadoPadrão); 
              else aplicarMaterialNaFace(targetObject, 0, item); 
              return;
          }

          if (targetObject && (isParede || isPilar || isColuna)) {
              const paredeObj = paredesConstruidas.find(p => p.mesh === targetObject); const pilarObj = pilaresConstruidos.find(p => p.mesh === targetObject); const colunaObj = colunasSustentacao.find(p => p.mesh === targetObject);
              if (colunaObj || pilarObj || (paredeObj && paredeObj.isCerca)) {
                  const baseMat = (paredeObj && paredeObj.isCerca) || (pilarObj && pilarObj.isCerca) ? materialCerca : materialParede;
                  for (let i = 0; i < 6; i++) { if (isRemocao) removerMaterialNaFace(targetObject, i, baseMat); else aplicarMaterialNaFace(targetObject, i, item); }
              } else {
                  const faceClicada = hitAll.face ? hitAll.face.materialIndex : 0;
                  const localNormals = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)];
                  const worldNormal = localNormals[faceClicada].clone().applyQuaternion(targetObject.quaternion).normalize();
                  if (isRemocao) { removerPinturaFacePorNormal(targetObject, worldNormal, materialParede); if (paredeObj && !paredeObj.isPorta) { if (paredeObj.pilarA) removerPinturaFacePorNormal(paredeObj.pilarA.mesh, worldNormal, materialParede); if (paredeObj.pilarB) removerPinturaFacePorNormal(paredeObj.pilarB.mesh, worldNormal, materialParede); }
                  } else { pintarFacePorNormalMundial(targetObject, worldNormal, item); if (paredeObj && !paredeObj.isPorta) { if (paredeObj.pilarA) pintarFacePorNormalMundial(paredeObj.pilarA.mesh, worldNormal, item); if (paredeObj.pilarB) pintarFacePorNormalMundial(paredeObj.pilarB.mesh, worldNormal, item); } }
              }
          } else { const cx = snapCentroCelula(clickPoint.x); const cz = snapCentroCelula(clickPoint.z); if (isRemocao) removerPiso(cx, cz); else aplicarPiso(cx, cz, item); }
      }
      return; 
  }
});

function aplicarMaterialNaFace(mesh, faceIndex, item) { 
    registrarPintura(mesh); 
    let repeatX = 1, repeatY = 1; 
    const groupsLen = mesh.geometry.groups && mesh.geometry.groups.length > 0 ? mesh.geometry.groups.length : 6;

    if (mesh.geometry.type === 'ConeGeometry') { 
        repeatX = Math.max(1, mesh.scale.x / configMapa.tamanhoGrid) * 2; 
        repeatY = Math.max(1, mesh.scale.y / configMapa.tamanhoGrid); 
    } else if (mesh.geometry && mesh.geometry.parameters) { 
        const { width, height, depth } = mesh.geometry.parameters; 
        if (faceIndex === 0 || faceIndex === 1) { repeatX = depth; repeatY = height; } 
        else if (faceIndex === 2 || faceIndex === 3) { repeatX = width; repeatY = depth; } 
        else if (faceIndex === 4 || faceIndex === 5) { repeatX = width; repeatY = height; } 
    } 
    
    let novosMateriais = [];
    if (Array.isArray(mesh.material)) {
        if (mesh.material.length === groupsLen) {
            novosMateriais = [...mesh.material];
        } else {
            for (let i = 0; i < groupsLen; i++) novosMateriais.push(mesh.material[i] ? mesh.material[i].clone() : mesh.material[0].clone());
        }
    } else {
        for (let i = 0; i < groupsLen; i++) novosMateriais.push(mesh.material.clone());
    }

    novosMateriais[faceIndex] = gerarMaterialPintura(item, repeatX, repeatY); 
    mesh.material = novosMateriais; 
    finalizarPintura(mesh); 
}

function pintarFacePorNormalMundial(mesh, targetNormal, item) { 
    const tNorm = targetNormal.clone().normalize(); 
    const localNormals = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)]; 
    for (let i = 0; i < 6; i++) { 
        const worldNormal = localNormals[i].clone().applyQuaternion(mesh.quaternion).normalize(); 
        if (worldNormal.dot(tNorm) > 0.5) aplicarMaterialNaFace(mesh, i, item); 
    } 
}

function removerMaterialNaFace(mesh, faceIndex, matBase) { 
    registrarPintura(mesh); 
    const groupsLen = mesh.geometry.groups && mesh.geometry.groups.length > 0 ? mesh.geometry.groups.length : 6;
    let novosMateriais = [];

    if (Array.isArray(mesh.material)) {
        if (mesh.material.length === groupsLen) {
            novosMateriais = [...mesh.material];
        } else {
            for (let i = 0; i < groupsLen; i++) novosMateriais.push(mesh.material[i] ? mesh.material[i].clone() : mesh.material[0].clone());
        }
    } else {
        for (let i = 0; i < groupsLen; i++) novosMateriais.push(mesh.material.clone());
    }

    novosMateriais[faceIndex] = matBase.clone(); 
    mesh.material = novosMateriais; 
    finalizarPintura(mesh); 
}

function removerPinturaFacePorNormal(mesh, targetNormal, matBase) { 
    const tNorm = targetNormal.clone().normalize(); 
    const localNormals = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)]; 
    for (let i = 0; i < 6; i++) { 
        const worldNormal = localNormals[i].clone().applyQuaternion(mesh.quaternion).normalize(); 
        if (worldNormal.dot(tNorm) > 0.5) removerMaterialNaFace(mesh, i, matBase); 
    } 
}

canvas?.addEventListener('pointermove', e => {
  if (!modoAtivo && arrastandoSeta && comodoSelecionado) {
        const hit = raycastPlanoBase(e.clientX, e.clientY);
        if (hit) {
            const px = snapGrid(hit.point.x), pz = snapGrid(hit.point.z); const cb = comodoArrastadoBounds;
            let scaleX = 1; let scaleZ = 1; let dX = 0; let dZ = 0; const minSize = configMapa.tamanhoGrid;

            if (arrastandoSeta === 'E') { const newMaxX = Math.max(cb.minX + minSize, px); scaleX = (newMaxX - cb.minX) / (cb.maxX - cb.minX || 1); dX = cb.minX; 
            } else if (arrastandoSeta === 'W') { const newMinX = Math.min(cb.maxX - minSize, px); scaleX = (cb.maxX - newMinX) / (cb.maxX - cb.minX || 1); dX = cb.maxX;
            } else if (arrastandoSeta === 'S') { const newMaxZ = Math.max(cb.minZ + minSize, pz); scaleZ = (newMaxZ - cb.minZ) / (cb.maxZ - cb.minZ || 1); dZ = cb.minZ;
            } else if (arrastandoSeta === 'N') { const newMinZ = Math.min(cb.maxZ - minSize, pz); scaleZ = (cb.maxZ - newMinZ) / (cb.maxZ - cb.minZ || 1); dZ = cb.maxZ; }

            comodoSelecionado.paredesIniciais.forEach(st => {
                if (arrastandoSeta === 'E' || arrastandoSeta === 'W') { st.parede.ax = dX + (st.ax - dX) * scaleX; st.parede.bx = dX + (st.bx - dX) * scaleX; } 
                else { st.parede.az = dZ + (st.az - dZ) * scaleZ; st.parede.bz = dZ + (st.bz - dZ) * scaleZ; }
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

  if (!modoAtivo && movendoSelecionado) {
      const chaoHit = raycastPlanoBase(e.clientX, e.clientY);
      if (chaoHit) {
          const atualX = snapGrid(chaoHit.point.x), atualZ = snapGrid(chaoHit.point.z);
          if (!pontoA) pontoA = { x: atualX, z: atualZ }; 
          const dx = atualX - pontoA.x, dz = atualZ - pontoA.z; pontoA = { x: atualX, z: atualZ }; 
          
          if (comodoSelecionado) aplicarMovimento(comodoSelecionado, dx, dz); 
          else if (escadaSelecionada) {
              escadaSelecionada.ax += dx; escadaSelecionada.az += dz;
              escadaSelecionada.bx += dx; escadaSelecionada.bz += dz;
              escadaSelecionada.mesh.position.x += dx; escadaSelecionada.mesh.position.z += dz;
          }
          else if (telhadoSelecionado) {
              telhadoSelecionado.ax += dx; telhadoSelecionado.az += dz;
              telhadoSelecionado.bx += dx; telhadoSelecionado.bz += dz;
              telhadoSelecionado.mesh.position.x += dx; telhadoSelecionado.mesh.position.z += dz;
          }
          if (acaoAtual) {
              const objId = comodoSelecionado ? comodoSelecionado.id : (escadaSelecionada ? escadaSelecionada.id : telhadoSelecionado.id);
              const moveRecord = acaoAtual.move.find(m => m.comodoId === objId);
              if (moveRecord) { moveRecord.dx += dx; moveRecord.dz += dz; } 
              else { acaoAtual.move.push({ comodoId: objId, dx, dz }); }
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
  const divMedida = document.getElementById('cursor-medida');

  if (hit) {
    const px = snapGrid(hit.point.x), pz = snapGrid(hit.point.z);
    
    if (e.ctrlKey) {
        cursor3D.material = materialMarreta;
    } else if (modoAtivo === 'coluna' || modoAtivo === 'escada' || modoAtivo === 'escada_baixo' || modoAtivo === 'telhado') {
        cursor3D.material = materialPreviaEscada;
    } else {
        cursor3D.material = materialCursor;
    }
    
    cursor3D.scale.set(configMapa.tamanhoGrid, configMapa.tamanhoGrid, 1);
    
    if (modoAtivo === 'pintura') { cursor3D.position.set(snapCentroCelula(hit.point.x), alturaBase + 0.02, snapCentroCelula(hit.point.z)); } 
    else { cursor3D.position.set(px, alturaBase + 0.02, pz); }
    cursor3D.visible = true;

    if (modoAtivo === 'coluna' && !e.ctrlKey) {
        const hTemp = obterAltura();
        previaMesh.scale.set(0.4, hTemp, 0.4);
        previaMesh.position.set(px, alturaBase + hTemp/2, pz);
        previaMesh.rotation.y = 0;
        previaMesh.visible = true;
        if (previaMesh.material.color) previaMesh.material.color.setHex(0x4ade80);

        if(divMedida) {
            divMedida.style.display = 'block'; divMedida.style.left = (e.clientX + 15) + 'px'; divMedida.style.top = (e.clientY + 15) + 'px';
            divMedida.textContent = `Pilar de Sustentação`;
        }
        previaEscadaInicio.visible = false; previaEscadaFim.visible = false;
    }
    else if (arrastandoConstrucao && pontoA) {
      if(divMedida) {
          divMedida.style.display = 'block'; divMedida.style.left = (e.clientX + 15) + 'px'; divMedida.style.top = (e.clientY + 15) + 'px';
          const dxM = Math.abs(px - pontoA.x) / configMapa.tamanhoGrid, dzM = Math.abs(pz - pontoA.z) / configMapa.tamanhoGrid;
          if (modoAtivo === 'escada' || modoAtivo === 'escada_baixo') { divMedida.textContent = `Escada: ${Math.round(Math.hypot(dxM, dzM))} blocos`; } 
          else if (modoAtivo === 'parede' || modoAtivo === 'cerca') { divMedida.textContent = `Comprimento: ${Math.round(Math.hypot(dxM, dzM))}`; } 
          else if (modoAtivo === 'telhado') { divMedida.textContent = `Telhado: ${Math.round(dxM)} x ${Math.round(dzM)}`; }
          else { divMedida.textContent = `${Math.round(dxM)} x ${Math.round(dzM)}`; }
      }

      const isCerca = (modoAtivo === 'cerca');
      const hTemp = isCerca ? 1.0 : obterAltura(); 

      if (modoAtivo === 'telhado') {
          const w = Math.abs(px - pontoA.x) + 0.5; const d = Math.abs(pz - pontoA.z) + 0.5;
          previaMesh.scale.set(w, 2.0, d); 
          previaMesh.position.set((pontoA.x + px)/2, alturaBase + hTemp + 1.0, (pontoA.z + pz)/2);
          previaMesh.rotation.y = 0; previaMesh.visible = true;
          if (previaMesh.material.color) previaMesh.material.color.setHex(0x38bdf8);
          
          previaEscadaInicio.scale.set(configMapa.tamanhoGrid, configMapa.tamanhoGrid, 1);
          previaEscadaInicio.position.set(pontoA.x, alturaBase + 0.03, pontoA.z);
          previaEscadaInicio.visible = true;
          previaEscadaFim.scale.set(configMapa.tamanhoGrid, configMapa.tamanhoGrid, 1);
          previaEscadaFim.position.set(px, alturaBase + 0.03, pz);
          previaEscadaFim.visible = true;
      }
      else if (modoAtivo === 'parede' || modoAtivo === 'cerca' || modoAtivo === 'escada' || modoAtivo === 'escada_baixo') {
        const dx = px - pontoA.x, dz = pz - pontoA.z; const comp = Math.sqrt(dx*dx + dz*dz) || 0.01;
        previaMesh.scale.set(0.25, hTemp, comp + 0.25); previaMesh.position.set((pontoA.x + px)/2, alturaBase + hTemp/2, (pontoA.z + pz)/2); previaMesh.rotation.y = Math.atan2(dx, dz); previaMesh.visible = true;
        if (previaMesh.material.color) previaMesh.material.color.setHex(modoAtivo === 'escada_baixo' ? 0xff4444 : 0x38bdf8);

        if (modoAtivo === 'escada' || modoAtivo === 'escada_baixo') {
            const sinalAndar = modoAtivo === 'escada_baixo' ? -1 : 1;
            previaEscadaInicio.scale.set(configMapa.tamanhoGrid, configMapa.tamanhoGrid, 1);
            previaEscadaInicio.position.set(pontoA.x, alturaBase + 0.03, pontoA.z);
            previaEscadaInicio.visible = true;
            previaEscadaFim.scale.set(configMapa.tamanhoGrid, configMapa.tamanhoGrid, 1);
            previaEscadaFim.position.set(px, alturaBase + (sinalAndar * obterAltura()) + 0.03, pz);
            previaEscadaFim.visible = true;
        } else {
            previaEscadaInicio.visible = false; previaEscadaFim.visible = false;
        }

      } else {
        previaEscadaInicio.visible = false; previaEscadaFim.visible = false;
        const w = Math.abs(px - pontoA.x) || 0.1, d = Math.abs(pz - pontoA.z) || 0.1;
        previaMesh.scale.set(w, hTemp, d); previaMesh.position.set((pontoA.x + px)/2, alturaBase + hTemp/2, (pontoA.z + pz)/2); previaMesh.rotation.y = 0; previaMesh.visible = true;
        if (previaMesh.material.color) previaMesh.material.color.setHex(0x38bdf8);
      }
    } else { 
        previaMesh.visible = false;
        previaEscadaInicio.visible = false; previaEscadaFim.visible = false;
        if(divMedida) divMedida.style.display = 'none'; 
    }
  } else { 
      cursor3D.visible = false; 
      previaMesh.visible = false;
      previaEscadaInicio.visible = false; previaEscadaFim.visible = false;
      if(divMedida) divMedida.style.display = 'none'; 
  }
});

window.addEventListener('pointerup', e => {
  const divMedida = document.getElementById('cursor-medida');
  if(divMedida) divMedida.style.display = 'none';

  if (arrastandoSeta) { arrastandoSeta = null; mostrarGizmo(e.clientX, e.clientY); return; }

  if (arrastandoConstrucao && pontoA) {
    const hit = raycastPlanoBase(e.clientX, e.clientY);
    if (hit) {
      const px = snapGrid(hit.point.x), pz = snapGrid(hit.point.z);
      if (Math.abs(px - pontoA.x) > 0.1 || Math.abs(pz - pontoA.z) > 0.1) {
        const comodoId = Date.now() + Math.random();
        
        if (modoAtivo !== 'telhado') comodosConstruidos.push({ id: comodoId, paredes: [], pilares: [] });
        
        if (modoAtivo === 'parede') criarLinhaDeParedes(pontoA.x, pontoA.z, px, pz, obterAltura(), false, comodoId);
        else if (modoAtivo === 'cerca') criarLinhaDeParedes(pontoA.x, pontoA.z, px, pz, 1.0, true, comodoId);
        else if (modoAtivo === 'escada') {
            criarEscada(pontoA.x, pontoA.z, px, pz, obterAltura(), configMapa.tamanhoGrid, configsCamera.nivel);
            configsCamera.nivel += 1;
            atualizarCamera(); atualizarVisibilidadeAndares();
            showAviso(`Escada criada! Subiu para o Nível ${configsCamera.nivel}.`);
        }
        else if (modoAtivo === 'escada_baixo') {
            criarEscada(px, pz, pontoA.x, pontoA.z, obterAltura(), configMapa.tamanhoGrid, configsCamera.nivel - 1);
            configsCamera.nivel -= 1;
            atualizarCamera(); atualizarVisibilidadeAndares();
            showAviso(`Escotilha criada! Desceu para o Nível ${configsCamera.nivel}.`);
        }
        else if (modoAtivo === 'telhado') {
            criarTelhado(pontoA.x, pontoA.z, px, pz, 3.0); 
            showAviso(`Telhado construído! (Selecione com a mãozinha para redimensionar)`);
        }
        else if (modoAtivo === 'retangulo') criarRetangulo(pontoA.x, pontoA.z, px, pz, obterAltura(), comodoId);
        else if (modoAtivo === 'triangulo') criarTriangulo(pontoA.x, pontoA.z, px, pz, obterAltura(), comodoId);
        else if (modoAtivo === 'octogono') criarOctogono(pontoA.x, pontoA.z, px, pz, obterAltura(), comodoId);
      }
    }
    arrastandoConstrucao = false; pontoA = null; previaMesh.visible = false;
    previaEscadaInicio.visible = false; previaEscadaFim.visible = false;
  }
  finalizarAcao(); 
});

function aplicarMovimento(comodo, dx, dz) {
    comodo.paredes.forEach(p => { p.ax += dx; p.az += dz; p.bx += dx; p.bz += dz; p.mesh.position.x += dx; p.mesh.position.z += dz; });
    comodo.pilares.forEach(p => { p.x += dx; p.z += dz; p.mesh.position.x += dx; p.mesh.position.z += dz; });
}

function removerObjetoMundo(tipo, obj, arrayBase) {
    if (!obj) return;
    registrarRemocao(tipo, obj, arrayBase); scene.remove(obj.mesh);
    const idx = arrayBase.indexOf(obj); if (idx > -1) arrayBase.splice(idx, 1);
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

function criarEscada(ax, az, bx, bz, alturaAndar, largura = configMapa.tamanhoGrid, targetNivel = configsCamera.nivel) { 
    const dx = bx - ax, dz = bz - az; const comp = Math.hypot(dx, dz); if (comp < 0.5) return; 
    const escadaMesh = new THREE.Group(); 
    const id = Date.now() + Math.random(); 
    const escada = { id, mesh: escadaMesh, ax, az, bx, bz, alturaAndar, largura, nivel: targetNivel, textura: null, isEscada: true }; 
    reconstruirDegrausEscada(escada, largura);
    escadasConstruidas.push(escada); registrarAdicao('escada', escada, escadasConstruidas); 
}

export function reconstruirDegrausEscada(escada, novaLargura) {
    escada.largura = novaLargura;
    while(escada.mesh.children.length > 0){ escada.mesh.remove(escada.mesh.children[0]); }
    const dx = escada.bx - escada.ax, dz = escada.bz - escada.az; 
    const comp = Math.hypot(dx, dz); 
    const degraus = Math.max(3, Math.floor(comp / (configMapa.tamanhoGrid / 2))); 
    const angle = Math.atan2(dx, dz); 
    
    for (let i = 0; i < degraus; i++) { 
        const stepD = comp / degraus, stepH = escada.alturaAndar / degraus; 
        const mat = escada.textura ? gerarMaterialPintura(escada.textura, configMapa.tamanhoGrid, configMapa.tamanhoGrid) : materialPiso.clone();
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(escada.largura - 0.002, stepH * (i + 1), stepD - 0.002), mat); 
        mesh.position.set(0, (stepH * (i + 1)) / 2 + 0.001, (i * stepD) - comp/2 + stepD/2); 
        escada.mesh.add(mesh); 
    } 
    const alturaBase = escada.nivel * escada.alturaAndar; 
    escada.mesh.position.set((escada.ax+escada.bx)/2, alturaBase, (escada.az+escada.bz)/2); 
    escada.mesh.rotation.y = angle; 
    if(!scene.children.includes(escada.mesh)) scene.add(escada.mesh);
    if (escadaSelecionada === escada) { escada.mesh.children.forEach(c => c.material.emissive.setHex(0x2a2a2a)); }
}

function executarMarreta(hitObject) {
  if (!hitObject || hitObject === meshChaoBase || hitObject === meshChaoMasmorra) return;
  const isPiso = pisosConstruidos.some(p => p.mesh === hitObject);
  const isParedeMode = ['parede', 'cerca', 'retangulo', 'triangulo', 'octogono', 'telhado'].includes(modoAtivo);
  if (isParedeMode && isPiso) return; 
  
  const telhado = telhadosConstruidos.find(t => t.mesh === hitObject);
  if (telhado) { removerObjetoMundo('telhado', telhado, telhadosConstruidos); return; }

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

function gerarMaterialPintura(item, repeatX = 1, repeatY = 1) { 
    const mat = new THREE.MeshLambertMaterial(); 
    if (item.tipo === 'cor') { 
        mat.color.set(item.cor); 
    } else { 
        const tex = item.textura ? item.textura.clone() : new THREE.TextureLoader().load(item.dataUrl); 
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeatX, repeatY); 
        mat.map = tex; mat.color.set(0xffffff); 
    } 
    return mat; 
}

function aplicarPiso(x, z, item) { let tile = pisosConstruidos.find(p => Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01 && p.nivel === configsCamera.nivel); if (!tile) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(configMapa.tamanhoGrid, 0.12, configMapa.tamanhoGrid), materialPiso.clone()); const alturaBase = configsCamera.nivel * obterAltura(); mesh.position.set(x, alturaBase + 0.06, z); scene.add(mesh); tile = { mesh, x, z, nivel: configsCamera.nivel }; pisosConstruidos.push(tile); registrarAdicao('piso', tile, pisosConstruidos); } registrarPintura(tile.mesh); tile.mesh.material = gerarMaterialPintura(item, configMapa.tamanhoGrid, configMapa.tamanhoGrid); finalizarPintura(tile.mesh); }
function removerPiso(x, z) { const tile = pisosConstruidos.find(p => Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01 && p.nivel === configsCamera.nivel); if (tile) { removerObjetoMundo('piso', tile, pisosConstruidos); } }
function distanciaPontoSegmento(px, pz, ax, az, bx, bz) { const compSq = (bx-ax)**2 + (bz-az)**2; if (compSq === 0) return Math.hypot(px-ax, pz-az); let t = Math.max(0, Math.min(1, ((px-ax)*(bx-ax) + (pz-az)*(bz-az)) / compSq)); return Math.hypot(px - (ax + t*(bx-ax)), pz - (az + t*(bz-az))); }
function paredeQueBloqueia(x1, z1, x2, z2) { const midX = (x1+x2)/2, midZ = (z1+z2)/2; return paredesConstruidas.find(p => p.nivel === configsCamera.nivel && !p.isCerca && distanciaPontoSegmento(midX, midZ, p.ax, p.az, p.bx, p.bz) < 0.2) || null; }
function encontrarAreaFechada(xInicial, zInicial) { const visitados = new Set(), pilha = [{ x: xInicial, z: zInicial }], celulas = []; const limiteX = configMapa.largura / 2, limiteZ = configMapa.profundidade / 2; while (pilha.length && celulas.length < 50000) { const atual = pilha.pop(), chave = `${atual.x.toFixed(2)},${atual.z.toFixed(2)}`; if (visitados.has(chave)) continue; visitados.add(chave); if (atual.x < -limiteX + 0.1 || atual.x > limiteX - 0.1 || atual.z < -limiteZ + 0.1 || atual.z > limiteZ - 0.1) continue; celulas.push(atual); [[1,0], [-1,0], [0,1], [0,-1]].forEach(([dx, dz]) => { const vx = atual.x + dx * configMapa.tamanhoGrid, vz = atual.z + dz * configMapa.tamanhoGrid; if (!paredeQueBloqueia(atual.x, atual.z, vx, vz)) pilha.push({ x: vx, z: vz }); }); } return { celulas }; }

function setOpacity(mesh, isTransparent, opacity) { 
    if (!mesh) return; 
    if (mesh.type === 'Group') { 
        mesh.children.forEach(child => setOpacity(child, isTransparent, opacity)); 
    } else if (Array.isArray(mesh.material)) { 
        mesh.material.forEach(m => { 
            if (m && m.transparent !== isTransparent) m.needsUpdate = true;
            if (m) { m.transparent = isTransparent; m.opacity = opacity; }
        }); 
    } else if (mesh.material) { 
        if (mesh.material.transparent !== isTransparent) mesh.material.needsUpdate = true;
        mesh.material.transparent = isTransparent; mesh.material.opacity = opacity; 
    } 
}

export function atualizarVisibilidadeAndares(modoVisaoManual) {
  if (modoVisaoManual) modoVisaoAtual = modoVisaoManual; 
  
  const alturaAtual = configsCamera.nivel * obterAltura();
  
  if (meshChaoBase) meshChaoBase.visible = (configsCamera.nivel >= 0);
  if (meshChaoMasmorra) {
      meshChaoMasmorra.visible = (configsCamera.nivel < 0);
      meshChaoMasmorra.position.y = alturaAtual - 0.01; 
  }
  
  fogAndares.position.y = alturaAtual - 0.02; 
  if (gridHelper) gridHelper.position.y = alturaAtual + 0.01;

  const aplicarParede = (obj) => { 
      if (obj.nivel > configsCamera.nivel) { 
          obj.mesh.visible = false; 
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
              obj.mesh.visible = false; 
          } else { 
              obj.mesh.visible = true; setOpacity(obj.mesh, false, 1); 
          } 
      }); 
  });

  telhadosConstruidos.forEach(obj => {
      if (obj.nivel > configsCamera.nivel) {
          obj.mesh.visible = false;
      } else if (obj.nivel === configsCamera.nivel) {
          if (modoVisaoAtual === 'full' && modoAtivo !== 'pintura' && !arrastandoConstrucao) {
              obj.mesh.visible = true; setOpacity(obj.mesh, false, 1);
          } else {
              obj.mesh.visible = true; setOpacity(obj.mesh, true, 0.15); 
          }
      } else {
          obj.mesh.visible = true; setOpacity(obj.mesh, false, 1);
      }
  });
}