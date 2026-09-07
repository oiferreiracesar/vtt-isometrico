// js/ui.js - Cérebro da Máquina de Estados e Mapeamento The Sims 1
import { setModoAtivo, atualizarVisibilidadeAndares, desfazer, refazer, iniciarArrasteSelecionado, girarSelecionado, deletarSelecionado, alterarDimensaoGizmo, alterarAlturaGizmo, exportarMapa, importarMapa, limparMapa, toggleTelhadosGlobais, resetarEstadoConstrucao } from './construtor.js';
import { configsCamera, atualizarCamera } from './engine.js';
import { redimensionarMapa, gridHelper } from './mapa.js';

export let estadoGlobal = 'construcao'; 

let avisoTimeout = null;
export function showAviso(msg) {
  let el = document.getElementById('avisoTemp');
  if(!el) {
    el = document.createElement('div'); el.id = 'avisoTemp';
    el.style.cssText = 'position:absolute; bottom:80px; left:50%; transform:translateX(-50%); background:rgba(30,25,18,0.95); color:#e8dcc0; border:1px solid #38bdf8; border-radius:6px; padding:8px 16px; font-size:12px; z-index:999; box-shadow: 0 4px 12px rgba(0,0,0,0.5); pointer-events: none;';
    document.body.appendChild(el);
  }
  el.textContent = msg; el.style.display = 'block';
  clearTimeout(avisoTimeout); avisoTimeout = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

export function mostrarGizmo(x, y, tipoObj = 'comodo') {
    const g = document.getElementById('room-gizmo');
    if(g) { 
        g.style.display = 'flex'; g.style.left = (x - 120) + 'px'; g.style.top = (y - 70) + 'px'; 
        const rotL = document.getElementById('gizmoRotLeft'); if(rotL) rotL.style.display = tipoObj === 'telhado' ? 'none' : 'block';
        const rotR = document.getElementById('gizmoRotRight'); if(rotR) rotR.style.display = tipoObj === 'telhado' ? 'none' : 'block';
        const wPlus = document.getElementById('gizmoWiden'); if(wPlus) wPlus.style.display = tipoObj === 'telhado' ? 'none' : 'block';
        const wMin = document.getElementById('gizmoShrink'); if(wMin) wMin.style.display = tipoObj === 'telhado' ? 'none' : 'block';
        const tPlus = document.getElementById('gizmoTaller'); if(tPlus) tPlus.style.display = tipoObj === 'comodo' ? 'none' : 'block';
        const tMin = document.getElementById('gizmoShorter'); if(tMin) tMin.style.display = tipoObj === 'comodo' ? 'none' : 'block';
    }
}

export function esconderGizmo() { const g = document.getElementById('room-gizmo'); if(g) g.style.display = 'none'; }

export let paleta = []; export let idPaletaSelecionada = null; let proximoIdPaleta = 1;

export function itemSelecionadoAtual() { return paleta.find(p => p.id === idPaletaSelecionada) || null; }

export function selecionarMaterialNaPaleta(matAlvo) {
  if (!matAlvo) return; let match = null;
  if (matAlvo.map) match = paleta.find(p => p.tipo === 'imagem' && p.textura && p.textura.uuid === matAlvo.map.uuid);
  else if (matAlvo.color) match = paleta.find(p => p.tipo === 'cor' && p.cor.toLowerCase() === ('#' + matAlvo.color.getHexString()).toLowerCase());
  if (match) { idPaletaSelecionada = match.id; renderizarPaleta(); showAviso("🎨 Pipeta: Textura copiada!"); } 
  else showAviso("Material não encontrado na paleta base.");
}

function renderizarPaleta() {
  const div = document.getElementById('paletaTexturas'); if (!div) return; div.innerHTML = '';
  if (!paleta.length) { div.innerHTML = '<span class="paletaVazia">Carregando Banco...</span>'; return; }
  paleta.forEach(item => {
    const sw = document.createElement('div'); sw.className = 'swatchTextura' + (item.id === idPaletaSelecionada ? ' selecionada' : '');
    sw.title = item.tipo === 'cor' ? `Tinta` : `Textura`;
    if (item.tipo === 'cor') { sw.style.backgroundImage = 'none'; sw.style.backgroundColor = item.cor; } else { sw.style.backgroundImage = `url(${item.dataUrl})`; }
    sw.onclick = () => { idPaletaSelecionada = item.id; renderizarPaleta(); }; div.appendChild(sw);
  });
}

function carregarBancoDeAssets() {
  const coresIniciais = ['#e2e8f0', '#334155', '#4ade80']; 
  coresIniciais.forEach(cor => { const id = proximoIdPaleta++; paleta.push({ id, tipo: 'cor', cor }); if (idPaletaSelecionada === null) idPaletaSelecionada = id; });
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin('Anonymous'); 
  const texturasIniciais = ['https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/brick_diffuse.jpg', 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/hardwood2_diffuse.jpg', 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/grasslight-big.jpg'];
  texturasIniciais.forEach(url => { loader.load(url, (textura) => { textura.colorSpace = THREE.SRGBColorSpace; const id = proximoIdPaleta++; paleta.push({ id, tipo: 'imagem', dataUrl: url, textura }); renderizarPaleta(); }); });
  renderizarPaleta();
}

export function iniciarUI() {
  carregarBancoDeAssets();

  document.getElementById('btnAjuda')?.addEventListener('click', () => { const modal = document.getElementById('modalAjuda'); if (modal) modal.style.display = 'flex'; });
  document.getElementById('btnFecharAjuda')?.addEventListener('click', () => { const modal = document.getElementById('modalAjuda'); if (modal) modal.style.display = 'none'; });
  
  // --- ATALHOS: THE SIMS 1 BUILD MODE ---
  window.addEventListener('keydown', e => { 
      // PROTEÇÃO DE INPUT: Evita disparar atalhos enquanto digita números/textos
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      // F2: Build Mode
      if (e.key === 'F2') {
          e.preventDefault();
          const btnConstrucao = document.querySelector('[data-target="panel-construcao"]');
          if (btnConstrucao && !btnConstrucao.classList.contains('active')) btnConstrucao.click();
      }

      // Esc: Cancelar ferramenta e voltar para mãozinha
      if (e.key === 'Escape') { 
          const modal = document.getElementById('modalAjuda'); 
          if (modal && modal.style.display === 'flex') { modal.style.display = 'none'; } 
          else { const btnMaozinha = document.getElementById('btnSairModo'); if (btnMaozinha) btnMaozinha.click(); } 
      }
      
      // Ctrl + Z / Shift + Ctrl + Z (Desfazer / Refazer)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) refazer(); else desfazer();
      }

      // Tecla G: Ocultar Grade
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
          if (gridHelper) gridHelper.visible = !gridHelper.visible;
      }

      // M: Mover objeto selecionado
      if (e.key.toLowerCase() === 'm' && estadoGlobal === 'construcao') { iniciarArrasteSelecionado(); }

      // R: Rotacionar objeto selecionado
      if (e.key.toLowerCase() === 'r' && estadoGlobal === 'construcao') { girarSelecionado('dir'); }

      // Delete / Backspace: Apagar objeto selecionado
      if ((e.key === 'Delete' || e.key === 'Backspace') && estadoGlobal === 'construcao') { deletarSelecionado(); }

      // Page Up: Subir Andar
      if (e.key === 'PageUp') { document.getElementById('camUp')?.click(); }

      // Page Down: Descer Andar
      if (e.key === 'PageDown') { document.getElementById('camDown')?.click(); }

      // Home: Cycle Paredes (Full -> Cut -> Low -> Full)
      if (e.key === 'Home') {
          const btnFull = document.getElementById('camWallFull');
          const btnCut = document.getElementById('camWallCut');
          const btnLow = document.getElementById('camWallLow');
          
          if (btnFull.classList.contains('ativo')) { btnCut.click(); }
          else if (btnCut.classList.contains('ativo')) { btnLow.click(); }
          else { btnFull.click(); }
      }

      // End: Ocultar Tudo (Paredes Low + Telhado Desligado)
      if (e.key === 'End') {
          document.getElementById('camWallLow')?.click();
          const btnRoof = document.getElementById('camRoofToggle');
          if (btnRoof && btnRoof.classList.contains('ativo')) btnRoof.click(); 
      }

      // Vírgula e Ponto: Girar Câmera
      if (e.key === ',') { document.getElementById('camRotLeft')?.click(); }
      if (e.key === '.') { document.getElementById('camRotRight')?.click(); }

      // Z / X ou + / - : Zoom In e Zoom Out
      if (e.key.toLowerCase() === 'z' || e.key === '+') { document.getElementById('camZoomIn')?.click(); }
      if (e.key.toLowerCase() === 'x' || e.key === '-') { document.getElementById('camZoomOut')?.click(); }
  });

  document.getElementById('btnAdicionarTextura')?.addEventListener('click', () => document.getElementById('inputAdicionarTextura').click());
  document.getElementById('inputAdicionarTextura')?.addEventListener('change', e => { Array.from(e.target.files || []).forEach(arquivo => { const leitor = new FileReader(); leitor.onload = ev => { const dataUrl = ev.target.result; const textura = new THREE.TextureLoader().load(dataUrl); textura.colorSpace = THREE.SRGBColorSpace; const id = proximoIdPaleta++; paleta.push({ id, tipo: 'imagem', dataUrl, textura }); if (idPaletaSelecionada === null) idPaletaSelecionada = id; renderizarPaleta(); showAviso(`Material adicionado.`); }; leitor.readAsDataURL(arquivo); }); });
  document.getElementById('btnAdicionarCor')?.addEventListener('click', () => { const cor = document.getElementById('inputCorNova').value; const id = proximoIdPaleta++; paleta.push({ id, tipo: 'cor', cor }); if (idPaletaSelecionada === null) idPaletaSelecionada = id; renderizarPaleta(); showAviso(`Cor adicionada.`); });

  function ativarFerramenta(botaoId, modo, msg) { document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('ativo')); const btn = document.getElementById(botaoId); if(btn) btn.classList.add('ativo'); setModoAtivo(modo); atualizarVisibilidadeAndares(); if(msg) showAviso(msg); }

  const simsPanel = document.getElementById('sims-panel'); if(simsPanel) simsPanel.style.display = 'flex'; 
  const playActionBar = document.getElementById('play-action-bar');

  document.querySelectorAll('.node-btn').forEach(btn => { 
    btn.addEventListener('click', () => { 
      const isAlreadyActive = btn.classList.contains('active'); 
      const targetId = btn.getAttribute('data-target');

      document.querySelectorAll('.node-btn').forEach(b => b.classList.remove('active')); 
      document.querySelectorAll('.sub-panel').forEach(panel => panel.classList.remove('active')); 

      if (isAlreadyActive) { 
          if(simsPanel) simsPanel.style.display = 'none'; 
          ativarFerramenta('btnSairModo', null, null); 
      } else { 
          btn.classList.add('active'); 
          const target = document.getElementById(targetId); 
          if (target) target.classList.add('active'); 
          if(simsPanel) simsPanel.style.display = 'flex'; 

          if (targetId === 'panel-construcao') {
              estadoGlobal = 'construcao';
              if (playActionBar) playActionBar.style.display = 'none';
              showAviso("🏗️ Modo Construção: Geometria Destravada");
          } else if (targetId === 'panel-tabuleiro') {
              estadoGlobal = 'tabuleiro';
              if (playActionBar) playActionBar.style.display = 'flex';
              resetarEstadoConstrucao(); 
              showAviso("♟️ Modo Tabuleiro: Geometria Trancada.");
          } else {
              estadoGlobal = targetId.split('-')[1]; 
              if (playActionBar) playActionBar.style.display = 'none';
              resetarEstadoConstrucao();
          }
      } 
    }); 
  });

  document.getElementById('btnSalvarMapa')?.addEventListener('click', exportarMapa);
  document.getElementById('btnCarregarMapa')?.addEventListener('click', () => document.getElementById('inputCarregarMapa').click());
  document.getElementById('inputCarregarMapa')?.addEventListener('change', e => { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = ev => { try { const dados = JSON.parse(ev.target.result); importarMapa(dados); } catch(err) { showAviso("Erro ao ler o arquivo."); } }; reader.readAsText(file); e.target.value = ''; });
  document.getElementById('btnLimparMapa')?.addEventListener('click', () => { if(confirm("Demolir TODO O TABULEIRO? Isso não pode ser desfeito!")) limparMapa(); });

  document.getElementById('btnDesfazer')?.addEventListener('click', desfazer);
  document.getElementById('btnRefazer')?.addEventListener('click', refazer);

  document.getElementById('gizmoMove')?.addEventListener('click', iniciarArrasteSelecionado);
  document.getElementById('gizmoRotLeft')?.addEventListener('click', () => girarSelecionado('esq'));
  document.getElementById('gizmoRotRight')?.addEventListener('click', () => girarSelecionado('dir'));
  document.getElementById('gizmoDelete')?.addEventListener('click', deletarSelecionado);
  document.getElementById('gizmoWiden')?.addEventListener('click', () => alterarDimensaoGizmo(1));
  document.getElementById('gizmoShrink')?.addEventListener('click', () => alterarDimensaoGizmo(-1));
  document.getElementById('gizmoTaller')?.addEventListener('click', () => alterarAlturaGizmo(1));
  document.getElementById('gizmoShorter')?.addEventListener('click', () => alterarAlturaGizmo(-1));

  document.getElementById('btnModoParede')?.addEventListener('click', () => ativarFerramenta('btnModoParede', 'parede', 'Parede: Clique e arraste.'));
  document.getElementById('btnModoCerca')?.addEventListener('click', () => ativarFerramenta('btnModoCerca', 'cerca', 'Cerca: Delimita áreas sem telhado.'));
  document.getElementById('btnModoRetangulo')?.addEventListener('click', () => ativarFerramenta('btnModoRetangulo', 'retangulo', 'Sala Retangular: Clique e arraste.'));
  document.getElementById('btnModoTriangulo')?.addEventListener('click', () => ativarFerramenta('btnModoTriangulo', 'triangulo', 'Sala Triangular: Clique e arraste.'));
  document.getElementById('btnModoOctogono')?.addEventListener('click', () => ativarFerramenta('btnModoOctogono', 'octogono', 'Sala Octogonal: Clique e arraste.'));
  document.getElementById('btnModoPorta')?.addEventListener('click', () => ativarFerramenta('btnModoPorta', 'porta', 'Modo Porta: Clique nas paredes para instalar.'));
  document.getElementById('btnModoPintura')?.addEventListener('click', () => ativarFerramenta('btnModoPintura', 'pintura', 'Pintura: (Shift = Preencher tudo, Ctrl = Remover, Alt = Pipeta)'));
  document.getElementById('btnModoEscada')?.addEventListener('click', () => ativarFerramenta('btnModoEscada', 'escada', 'Escada Subindo: Arraste para a direção superior.'));
  document.getElementById('btnModoEscadaBaixo')?.addEventListener('click', () => ativarFerramenta('btnModoEscadaBaixo', 'escada_baixo', 'Escada Descendo: Arraste para escavar um subsolo.'));
  document.getElementById('btnModoColuna')?.addEventListener('click', () => ativarFerramenta('btnModoColuna', 'coluna', 'Coluna: Guias do andar superior ativas!'));
  
  document.getElementById('btnSairModo')?.addEventListener('click', () => ativarFerramenta('btnSairModo', null, 'Navegação Livre.'));

  document.getElementById('btnRedimensionarMapa')?.addEventListener('click', () => { const w = parseInt(document.getElementById('inputMapaX').value) || 32, d = parseInt(document.getElementById('inputMapaZ').value) || 18; redimensionarMapa(w, d); showAviso(`Tabuleiro redimensionado para ${w}x${d}.`); });

  document.getElementById('camZoomIn')?.addEventListener('click', () => { configsCamera.zoom = Math.min(8, configsCamera.zoom + 0.5); atualizarCamera(); });
  document.getElementById('camZoomOut')?.addEventListener('click', () => { configsCamera.zoom = Math.max(0.2, configsCamera.zoom - 0.5); atualizarCamera(); });
  document.getElementById('camRotLeft')?.addEventListener('click', () => { configsCamera.angulo -= Math.PI / 2; atualizarCamera(); });
  document.getElementById('camRotRight')?.addEventListener('click', () => { configsCamera.angulo += Math.PI / 2; atualizarCamera(); });
  
  document.getElementById('camUp')?.addEventListener('click', () => { configsCamera.nivel += 1; atualizarCamera(); atualizarVisibilidadeAndares(); showAviso(configsCamera.nivel === 0 ? `Subiu para o Térreo.` : (configsCamera.nivel > 0 ? `Subiu para o Nível ${configsCamera.nivel}.` : `Subiu para o Subsolo ${Math.abs(configsCamera.nivel)}.`)); });
  document.getElementById('camDown')?.addEventListener('click', () => { configsCamera.nivel -= 1; atualizarCamera(); atualizarVisibilidadeAndares(); showAviso(configsCamera.nivel === 0 ? `Desceu para o Térreo.` : (configsCamera.nivel > 0 ? `Desceu para o Nível ${configsCamera.nivel}.` : `Desceu para o Subsolo ${Math.abs(configsCamera.nivel)}.`)); });

  const btnWallFull = document.getElementById('camWallFull'), btnWallCut = document.getElementById('camWallCut'), btnWallLow = document.getElementById('camWallLow');
  function clearWallActive() { [btnWallFull, btnWallCut, btnWallLow].forEach(b => b?.classList.remove('ativo')); }
  btnWallFull?.addEventListener('click', () => { clearWallActive(); btnWallFull.classList.add('ativo'); atualizarVisibilidadeAndares('full'); });
  btnWallCut?.addEventListener('click', () => { clearWallActive(); btnWallCut.classList.add('ativo'); atualizarVisibilidadeAndares('cut'); });
  btnWallLow?.addEventListener('click', () => { clearWallActive(); btnWallLow.classList.add('ativo'); atualizarVisibilidadeAndares('low'); });

  document.getElementById('camRoofToggle')?.addEventListener('click', (e) => { e.currentTarget.classList.toggle('ativo'); toggleTelhadosGlobais(e.currentTarget.classList.contains('ativo')); });
}