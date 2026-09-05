// js/ui.js - Gerenciamento da Interface HTML e Paleta
import { setModoAtivo, mudarVisaoParedes } from './construtor.js';
import { configsCamera, atualizarCamera } from './engine.js';

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

// === SISTEMA DE PALETA E ASSETS ===
export let paleta = [];
export let idPaletaSelecionada = null;
let proximoIdPaleta = 1;

export function itemSelecionadoAtual() {
  return paleta.find(p => p.id === idPaletaSelecionada) || null;
}

function renderizarPaleta() {
  const div = document.getElementById('paletaTexturas');
  div.innerHTML = '';
  if (!paleta.length) { div.innerHTML = '<span class="paletaVazia">Carregando Banco de Assets...</span>'; return; }
  
  paleta.forEach(item => {
    const sw = document.createElement('div');
    sw.className = 'swatchTextura' + (item.id === idPaletaSelecionada ? ' selecionada' : '');
    
    // Mostra o nome do material ao passar o mouse
    sw.title = item.tipo === 'cor' ? `Tinta` : `Textura`;

    if (item.tipo === 'cor') {
      sw.style.backgroundImage = 'none';
      sw.style.backgroundColor = item.cor;
    } else {
      sw.style.backgroundImage = `url(${item.dataUrl})`;
    }
    
    sw.onclick = () => { idPaletaSelecionada = item.id; renderizarPaleta(); };
    div.appendChild(sw);
  });
}

function carregarBancoDeAssets() {
  // 1. Carrega Cores Padrões (Gelo, Asfalto, Verde Bandeira)
  const coresIniciais = ['#e2e8f0', '#334155', '#4ade80']; 
  coresIniciais.forEach(cor => {
      const id = proximoIdPaleta++;
      paleta.push({ id, tipo: 'cor', cor });
      if (idPaletaSelecionada === null) idPaletaSelecionada = id;
  });

  // 2. Carrega Texturas da Nuvem (Link direto do repositório público para não dar erro)
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('Anonymous'); // Libera o download de fora do seu PC
  
  const texturasIniciais = [
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/brick_diffuse.jpg', // Tijolo
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/hardwood2_diffuse.jpg', // Madeira
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/grasslight-big.jpg' // Grama
  ];

  texturasIniciais.forEach(url => {
      loader.load(url, (textura) => {
          textura.colorSpace = THREE.SRGBColorSpace;
          const id = proximoIdPaleta++;
          paleta.push({ id, tipo: 'imagem', dataUrl: url, textura });
          renderizarPaleta(); // Atualiza a caixinha assim que a imagem termina de baixar
      });
  });
  
  renderizarPaleta();
}

export function iniciarUI() {
  // Dispara o download automático do banco de dados ao abrir o site
  carregarBancoDeAssets();

  // Permite subir novas texturas do PC do usuário
  document.getElementById('btnAdicionarTextura').addEventListener('click', () => document.getElementById('inputAdicionarTextura').click());
  document.getElementById('inputAdicionarTextura').addEventListener('change', e => {
    Array.from(e.target.files || []).forEach(arquivo => {
      const leitor = new FileReader();
      leitor.onload = ev => {
        const dataUrl = ev.target.result;
        const textura = new THREE.TextureLoader().load(dataUrl);
        textura.colorSpace = THREE.SRGBColorSpace;
        const id = proximoIdPaleta++;
        paleta.push({ id, tipo: 'imagem', dataUrl, textura });
        if (idPaletaSelecionada === null) idPaletaSelecionada = id;
        renderizarPaleta();
        showAviso(`Material adicionado ao catálogo.`);
      };
      leitor.readAsDataURL(arquivo);
    });
  });

  // Permite escolher nova cor no PC do usuário
  document.getElementById('btnAdicionarCor').addEventListener('click', () => {
    const cor = document.getElementById('inputCorNova').value;
    const id = proximoIdPaleta++;
    paleta.push({ id, tipo: 'cor', cor });
    if (idPaletaSelecionada === null) idPaletaSelecionada = id;
    renderizarPaleta();
    showAviso(`Cor adicionada ao catálogo.`);
  });

  function ativarFerramenta(botaoId, modo, msg) {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('ativo'));
    const btn = document.getElementById(botaoId);
    if(btn) btn.classList.add('ativo');
    setModoAtivo(modo);
    if(msg) showAviso(msg);
  }

  // === SISTEMA DE RECOLHER/EXPANDIR MENU ===
  const simsPanel = document.getElementById('sims-panel');
  simsPanel.style.display = 'flex'; // Inicia aberto

  document.querySelectorAll('.node-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Verifica se o botão clicado JÁ estava ativo
      const isAlreadyActive = btn.classList.contains('active');
      
      // Remove a ativação de todos
      document.querySelectorAll('.node-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sub-panel').forEach(panel => panel.classList.remove('active'));
      
      if (isAlreadyActive) {
        // Se já estava aberto, oculta o painel e trava as ferramentas de construção
        simsPanel.style.display = 'none';
        ativarFerramenta('btnSairModo', null, 'Menu recolhido. Câmera livre.');
      } else {
        // Se estava fechado ou em outra aba, abre o painel correspondente
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        const targetPanel = document.getElementById(targetId);
        if(targetPanel) targetPanel.classList.add('active');
        simsPanel.style.display = 'flex';
      }
    });
  });

  // Ferramentas de Construção
  document.getElementById('btnModoParede').addEventListener('click', () => ativarFerramenta('btnModoParede', 'parede', 'Modo Parede: Clique e arraste. (Ctrl = Marreta)'));
  document.getElementById('btnModoRetangulo').addEventListener('click', () => ativarFerramenta('btnModoRetangulo', 'retangulo', 'Sala Retangular: Clique e arraste.'));
  document.getElementById('btnModoTriangulo').addEventListener('click', () => ativarFerramenta('btnModoTriangulo', 'triangulo', 'Sala Triangular: Clique e arraste.'));
  document.getElementById('btnModoOctogono').addEventListener('click', () => ativarFerramenta('btnModoOctogono', 'octogono', 'Sala Octogonal: Clique e arraste.'));
  document.getElementById('btnModoPorta').addEventListener('click', () => ativarFerramenta('btnModoPorta', 'porta', 'Modo Porta: Clique nas paredes para instalar.'));
  document.getElementById('btnModoPintura').addEventListener('click', () => ativarFerramenta('btnModoPintura', 'pintura', 'Pintura: Clique no chão/parede. (Shift = Preencher tudo)'));
  document.getElementById('btnSairModo').addEventListener('click', () => ativarFerramenta('btnSairModo', null, 'Modo de Navegação livre.'));

  // Ferramentas Futuras (Sims)
  const botoesFuturos = ['btnModoTelhado', 'btnModoEscada', 'btnModoTerreno', 'btnModoAgua'];
  botoesFuturos.forEach(id => {
    document.getElementById(id).addEventListener('click', () => showAviso("Esta ferramenta será habilitada na próxima atualização!"));
  });

  // Controles de Câmera (The Sims)
  document.getElementById('camZoomIn').addEventListener('click', () => { configsCamera.zoom = Math.min(8, configsCamera.zoom + 0.5); atualizarCamera(); });
  document.getElementById('camZoomOut').addEventListener('click', () => { configsCamera.zoom = Math.max(0.2, configsCamera.zoom - 0.5); atualizarCamera(); });
  document.getElementById('camRotLeft').addEventListener('click', () => { configsCamera.angulo -= Math.PI / 2; atualizarCamera(); });
  document.getElementById('camRotRight').addEventListener('click', () => { configsCamera.angulo += Math.PI / 2; atualizarCamera(); });

  // Visão das Paredes
  const btnWallFull = document.getElementById('camWallFull');
  const btnWallCut = document.getElementById('camWallCut');
  const btnWallLow = document.getElementById('camWallLow');
  
  function clearWallActive() { [btnWallFull, btnWallCut, btnWallLow].forEach(b => b.classList.remove('ativo')); }
  
  btnWallFull.addEventListener('click', () => { clearWallActive(); btnWallFull.classList.add('ativo'); mudarVisaoParedes('full'); });
  btnWallCut.addEventListener('click', () => { clearWallActive(); btnWallCut.classList.add('ativo'); mudarVisaoParedes('cut'); });
  btnWallLow.addEventListener('click', () => { clearWallActive(); btnWallLow.classList.add('ativo'); mudarVisaoParedes('low'); });
}
