// js/ui.js - Gerenciamento da Interface HTML (Com Blindagem de Erros)
import { setModoAtivo, atualizarVisibilidadeAndares, desfazer, refazer, iniciarArrasteComodo, girarComodoSelecionado, deletarComodoSelecionado } from './construtor.js';
import { configsCamera, atualizarCamera } from './engine.js';
import { redimensionarMapa } from './mapa.js';

let avisoTimeout = null;
export function showAviso(msg) {
  let el = document.getElementById('avisoTemp');
  if(!el) {
    el = document.createElement('div'); el.id = 'avisoTemp';
    el.style.cssText = 'position:absolute; bottom:40px; left:50%; transform:translateX(-50%); background:rgba(30,25,18,0.95); color:#e8dcc0; border:1px solid #38bdf8; border-radius:6px; padding:8px 16px; font-size:12px; z-index:999; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: sans-serif; pointer-events: none;';
    document.body.appendChild(el);
  }
  el.textContent = msg; el.style.display = 'block';
  clearTimeout(avisoTimeout); avisoTimeout = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

// O GIZMO DO THE SIMS
export function mostrarGizmo(x, y) {
    const g = document.getElementById('room-gizmo');
    if(g) {
        g.style.display = 'flex';
        g.style.left = (x - 85) + 'px'; 
        g.style.top = (y - 70) + 'px'; 
    }
}

export function esconderGizmo() {
    const g = document.getElementById('room-gizmo');
    if(g) g.style.display = 'none';
}

export let paleta = [];
export let idPaletaSelecionada = null;
let proximoIdPaleta = 1;

export function itemSelecionadoAtual() { return paleta.find(p => p.id === idPaletaSelecionada) || null; }

function renderizarPaleta() {
  const div = document.getElementById('paletaTexturas');
  if (!div) return;
  div.innerHTML = '';
  if (!paleta.length) { div.innerHTML = '<span class="paletaVazia">Carregando Banco de Assets...</span>'; return; }
  paleta.forEach(item => {
    const sw = document.createElement('div');
    sw.className = 'swatchTextura' + (item.id === idPaletaSelecionada ? ' selecionada' : '');
    sw.title = item.tipo === 'cor' ? `Tinta` : `Textura`;
    if (item.tipo === 'cor') { sw.style.backgroundImage = 'none'; sw.style.backgroundColor = item.cor; } 
    else { sw.style.backgroundImage = `url(${item.dataUrl})`; }
    sw.onclick = () => { idPaletaSelecionada = item.id; renderizarPaleta(); };
    div.appendChild(sw);
  });
}

function carregarBancoDeAssets() {
  const coresIniciais = ['#e2e8f0', '#334155', '#4ade80']; 
  coresIniciais.forEach(cor => { const id = proximoIdPaleta++; paleta.push({ id, tipo: 'cor', cor }); if (idPaletaSelecionada === null) idPaletaSelecionada = id; });
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin('Anonymous'); 
  const texturasIniciais = [
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/brick_diffuse.jpg',
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/hardwood2_diffuse.jpg',
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/grasslight-big.jpg'
  ];
  texturasIniciais.forEach(url => { loader.load(url, (textura) => { textura.colorSpace = THREE.SRGBColorSpace; const id = proximoIdPaleta++; paleta.push({ id, tipo: 'imagem', dataUrl: url, textura }); renderizarPaleta(); }); });
  renderizarPaleta();
}

export function iniciarUI() {
  carregarBancoDeAssets();

  document.getElementById('btnAdicionarTextura')?.addEventListener('click', () => document.getElementById('inputAdicionarTextura').click());
  document.getElementById('inputAdicionarTextura')?.addEventListener('change', e => {
    Array.from(e.target.files || []).forEach(arquivo => {
      const leitor = new FileReader();
      leitor.onload = ev => {
        const dataUrl = ev.target.result; const textura = new THREE.TextureLoader().load(dataUrl); textura.colorSpace = THREE.SRGBColorSpace;
        const id = proximoIdPaleta++; paleta.push({ id, tipo: 'imagem', dataUrl, textura });
        if (idPaletaSelecionada === null) idPaletaSelecionada = id; renderizarPaleta(); showAviso(`Material adicionado.`);
      }; leitor.readAsDataURL(arquivo);
    });
  });

  document.getElementById('btnAdicionarCor')?.addEventListener('click', () => {
    const cor = document.getElementById('inputCorNova').value; const id = proximoIdPaleta++; paleta.push({ id, tipo: 'cor', cor });
    if (idPaletaSelecionada === null) idPaletaSelecionada = id; renderizarPaleta(); showAviso(`Cor adicionada.`);
  });

  function ativarFerramenta(botaoId, modo, msg) {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('ativo'));
    const btn = document.getElementById(botaoId); if(btn) btn.classList.add('ativo');
    
    setModoAtivo(modo); 
    atualizarVisibilidadeAndares(); 
    if(msg) showAviso(msg);
  }

  const simsPanel = document.getElementById('sims-panel');
  if(simsPanel) simsPanel.style.display = 'flex'; 

  document.querySelectorAll('.node-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const isAlreadyActive = btn.classList.contains('active');
      document.querySelectorAll('.node-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sub-panel').forEach(panel => panel.classList.remove('active'));
      if (isAlreadyActive) { 
          if(simsPanel) simsPanel.style.display = 'none'; 
          ativarFerramenta('btnSairModo', null, 'Menu recolhido.'); 
      } 
      else { 
          btn.classList.add('active'); 
          const target = document.getElementById(btn.getAttribute('data-target'));
          if (target) target.classList.add('active'); 
          if(simsPanel) simsPanel.style.display = 'flex'; 
      }
    });
  });

  // BOTÕES DE HISTÓRICO E GIZMO
  document.getElementById('btnDesfazer')?.addEventListener('click', desfazer);
  document.getElementById('btnRefazer')?.addEventListener('click', refazer);

  document.getElementById('gizmoMove')?.addEventListener('click', iniciarArrasteComodo);
  document.getElementById('gizmoRotLeft')?.addEventListener('click', () => girarComodoSelecionado('esq'));
  document.getElementById('gizmoRotRight')?.addEventListener('click', () => girarComodoSelecionado('dir'));
  document.getElementById('gizmoDelete')?.addEventListener('click', deletarComodoSelecionado);

  // FERRAMENTAS
  document.getElementById('btnModoParede')?.addEventListener('click', () => ativarFerramenta('btnModoParede', 'parede', 'Parede: Clique e arraste.'));
  document.getElementById('btnModoCerca')?.addEventListener('click', () => ativarFerramenta('btnModoCerca', 'cerca', 'Cerca: Delimita áreas sem telhado.'));
  document.getElementById('btnModoRetangulo')?.addEventListener('click', () => ativarFerramenta('btnModoRetangulo', 'retangulo', 'Sala Retangular: Clique e arraste.'));
  document.getElementById('btnModoTriangulo')?.addEventListener('click', () => ativarFerramenta('btnModoTriangulo', 'triangulo', 'Sala Triangular: Clique e arraste.'));
  document.getElementById('btnModoOctogono')?.addEventListener('click', () => ativarFerramenta('btnModoOctogono', 'octogono', 'Sala Octogonal: Clique e arraste.'));
  document.getElementById('btnModoPorta')?.addEventListener('click', () => ativarFerramenta('btnModoPorta', 'porta', 'Modo Porta: Clique nas paredes para instalar.'));
  document.getElementById('btnModoPintura')?.addEventListener('click', () => ativarFerramenta('btnModoPintura', 'pintura', 'Pintura: (Shift = Preencher tudo, Ctrl = Remover)'));
  
  document.getElementById('btnModoEscada')?.addEventListener('click', () => ativarFerramenta('btnModoEscada', 'escada', 'Escada: Arraste para o sentido que ela sobe.'));
  document.getElementById('btnModoColuna')?.addEventListener('click', () => ativarFerramenta('btnModoColuna', 'coluna', 'Coluna: Guias do andar superior ativas!'));
  document.getElementById('btnSairModo')?.addEventListener('click', () => ativarFerramenta('btnSairModo', null, 'Navegação: Clique numa sala para ver opções.'));

  const botoesFuturos = ['btnModoTelhado', 'btnModoTerreno'];
  botoesFuturos.forEach(id => { document.getElementById(id)?.addEventListener('click', () => showAviso("Em breve!")); });

  document.getElementById('btnRedimensionarMapa')?.addEventListener('click', () => {
    const w = parseInt(document.getElementById('inputMapaX').value) || 32, d = parseInt(document.getElementById('inputMapaZ').value) || 18;
    redimensionarMapa(w, d); showAviso(`Tabuleiro redimensionado para ${w}x${d}.`);
  });

  document.getElementById('camZoomIn')?.addEventListener('click', () => { configsCamera.zoom = Math.min(8, configsCamera.zoom + 0.5); atualizarCamera(); });
  document.getElementById('camZoomOut')?.addEventListener('click', () => { configsCamera.zoom = Math.max(0.2, configsCamera.zoom - 0.5); atualizarCamera(); });
  document.getElementById('camRotLeft')?.addEventListener('click', () => { configsCamera.angulo -= Math.PI / 2; atualizarCamera(); });
  document.getElementById('camRotRight')?.addEventListener('click', () => { configsCamera.angulo += Math.PI / 2; atualizarCamera(); });
  
  document.getElementById('camUp')?.addEventListener('click', () => { configsCamera.nivel += 1; atualizarCamera(); atualizarVisibilidadeAndares(); showAviso(`Subiu para o Nível ${configsCamera.nivel}.`); });
  document.getElementById('camDown')?.addEventListener('click', () => { configsCamera.nivel = Math.max(0, configsCamera.nivel - 1); atualizarCamera(); atualizarVisibilidadeAndares(); showAviso(configsCamera.nivel === 0 ? `Desceu para o Térreo.` : `Desceu para o Nível ${configsCamera.nivel}.`); });

  const btnWallFull = document.getElementById('camWallFull'), btnWallCut = document.getElementById('camWallCut'), btnWallLow = document.getElementById('camWallLow');
  function clearWallActive() { [btnWallFull, btnWallCut, btnWallLow].forEach(b => b?.classList.remove('ativo')); }
  btnWallFull?.addEventListener('click', () => { clearWallActive(); btnWallFull.classList.add('ativo'); atualizarVisibilidadeAndares('full'); });
  btnWallCut?.addEventListener('click', () => { clearWallActive(); btnWallCut.classList.add('ativo'); atualizarVisibilidadeAndares('cut'); });
  btnWallLow?.addEventListener('click', () => { clearWallActive(); btnWallLow.classList.add('ativo'); atualizarVisibilidadeAndares('low'); });
}