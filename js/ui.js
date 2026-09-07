// js/ui.js - Bibliotecas de Texturas com Fetch Automático (Case-Sensitive)
import { setModoAtivo, atualizarVisibilidadeAndares, desfazer, refazer, iniciarArrasteSelecionado, girarSelecionado, deletarSelecionado, alterarDimensaoGizmo, exportarMapa, importarMapa, limparMapa } from './construtor.js';
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

export function mostrarGizmo(x, y) {
    const g = document.getElementById('room-gizmo');
    if(g) { g.style.display = 'flex'; g.style.left = (x - 120) + 'px'; g.style.top = (y - 70) + 'px'; }
}

export function esconderGizmo() { const g = document.getElementById('room-gizmo'); if(g) g.style.display = 'none'; }

export let paletas = { pedra: [], madeira: [], grama: [], azulejo: [], telha: [] };
export let idPaletaSelecionada = { pedra: null, madeira: null, grama: null, azulejo: null, telha: null };
export let categoriaPaletaAtual = 'pedra'; 
let proximoIdPaleta = 1;

export function itemSelecionadoAtual() { 
    const id = idPaletaSelecionada[categoriaPaletaAtual];
    return paletas[categoriaPaletaAtual].find(p => p.id === id) || null; 
}

export function selecionarMaterialNaPaleta(matAlvo) {
  if (!matAlvo) return; 
  let match = null; let catMatch = null;

  for (const cat of ['pedra', 'madeira', 'grama', 'azulejo', 'telha']) {
      if (matAlvo.map) match = paletas[cat].find(p => p.tipo === 'imagem' && p.textura && p.textura.uuid === matAlvo.map.uuid);
      else if (matAlvo.color) match = paletas[cat].find(p => p.tipo === 'cor' && p.cor.toLowerCase() === ('#' + matAlvo.color.getHexString()).toLowerCase());
      if (match) { catMatch = cat; break; }
  }

  if (match) { 
      categoriaPaletaAtual = catMatch;
      idPaletaSelecionada[catMatch] = match.id; 
      document.querySelectorAll('.paleta-tab').forEach(b => b.classList.toggle('ativo', b.getAttribute('data-cat') === catMatch));
      renderizarPaleta(); showAviso("🎨 Pipeta: Textura copiada para o balde!"); 
  } else { showAviso("Material não encontrado nas bibliotecas base."); }
}

function renderizarPaleta() {
  const div = document.getElementById('paletaTexturas'); if (!div) return; div.innerHTML = '';
  const listaAtual = paletas[categoriaPaletaAtual];

  if (!listaAtual.length) { div.innerHTML = '<span class="paletaVazia">Carregando texturas...</span>'; return; }
  
  listaAtual.forEach(item => {
    const sw = document.createElement('div'); 
    sw.className = 'swatchTextura' + (item.id === idPaletaSelecionada[categoriaPaletaAtual] ? ' selecionada' : '');
    sw.title = item.tipo === 'cor' ? `Tinta Sólida` : `Textura Local`;
    
    if (item.tipo === 'cor') { sw.style.backgroundImage = 'none'; sw.style.backgroundColor = item.cor; } 
    else { sw.style.backgroundImage = `url(${item.dataUrl})`; }
    
    sw.onclick = () => { idPaletaSelecionada[categoriaPaletaAtual] = item.id; renderizarPaleta(); }; 
    div.appendChild(sw);
  });
}

function carregarBancoDeAssets() {
  paletas.pedra.push({ id: proximoIdPaleta++, tipo: 'cor', cor: '#94a3b8' }); idPaletaSelecionada.pedra = paletas.pedra[0].id;
  paletas.madeira.push({ id: proximoIdPaleta++, tipo: 'cor', cor: '#8a7550' }); idPaletaSelecionada.madeira = paletas.madeira[0].id;
  paletas.grama.push({ id: proximoIdPaleta++, tipo: 'cor', cor: '#4ade80' }); idPaletaSelecionada.grama = paletas.grama[0].id;
  paletas.azulejo.push({ id: proximoIdPaleta++, tipo: 'cor', cor: '#e2e8f0' }); idPaletaSelecionada.azulejo = paletas.azulejo[0].id;
  paletas.telha.push({ id: proximoIdPaleta++, tipo: 'cor', cor: '#5c2b29' }); idPaletaSelecionada.telha = paletas.telha[0].id;

  const loader = new THREE.TextureLoader(); loader.setCrossOrigin('Anonymous'); renderizarPaleta();

  const githubUser = 'oiferreiracesar';
  const githubRepo = 'vtt-isometrico';
  
  const mapeamentoPastas = [ { id: 'pedra', pasta: 'Pedra' }, { id: 'madeira', pasta: 'Madeira' }, { id: 'grama', pasta: 'Grama' }, { id: 'azulejo', pasta: 'Azulejo' }, { id: 'telha', pasta: 'Telha' } ];

  mapeamentoPastas.forEach(item => {
      fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/assets/texturas/${item.pasta}`)
          .then(response => { if (!response.ok) throw new Error('Limite da API atingido ou pasta vazia.'); return response.json(); })
          .then(arquivos => {
              arquivos.forEach(arquivo => {
                  if (arquivo.type === 'file' && arquivo.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
                      const url = `assets/texturas/${item.pasta}/${arquivo.name}`;
                      loader.load(url, (tex) => { 
                          tex.colorSpace = THREE.SRGBColorSpace; 
                          paletas[item.id].push({ id: proximoIdPaleta++, tipo: 'imagem', dataUrl: url, textura: tex }); 
                          if (categoriaPaletaAtual === item.id) renderizarPaleta(); 
                      });
                  }
              });
          }).catch(error => { console.warn(`Aviso de Leitura - Pasta [${item.pasta}]:`, error.message); });
  });
}

export function iniciarUI() {
  carregarBancoDeAssets();

  document.getElementById('btnAjuda')?.addEventListener('click', () => { const modal = document.getElementById('modalAjuda'); if (modal) modal.style.display = 'flex'; });
  document.getElementById('btnFecharAjuda')?.addEventListener('click', () => { const modal = document.getElementById('modalAjuda'); if (modal) modal.style.display = 'none'; });
  
  window.addEventListener('keydown', e => { 
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'F2') { e.preventDefault(); const btnConstrucao = document.querySelector('[data-target="panel-construcao"]'); if (btnConstrucao && !btnConstrucao.classList.contains('active')) btnConstrucao.click(); }
      if (e.key === 'Escape') { const modal = document.getElementById('modalAjuda'); if (modal && modal.style.display === 'flex') { modal.style.display = 'none'; } else { const btnMaozinha = document.getElementById('btnSairModo'); if (btnMaozinha) btnMaozinha.click(); } }
      
      // MAIOR COMPATIBILIDADE COM MAC AQUI:
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) refazer(); else desfazer(); }
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { if (gridHelper) gridHelper.visible = !gridHelper.visible; }

      if (e.key.toLowerCase() === 'm' && estadoGlobal === 'construcao') { iniciarArrasteSelecionado(); }
      if (e.key.toLowerCase() === 'r' && estadoGlobal === 'construcao') { girarSelecionado('dir'); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && estadoGlobal === 'construcao') { deletarSelecionado(); }

      if (e.key === 'PageUp') { document.getElementById('camUp')?.click(); }
      if (e.key === 'PageDown') { document.getElementById('camDown')?.click(); }
      if (e.key === 'Home') { const btnFull = document.getElementById('camWallFull'); const btnCut = document.getElementById('camWallCut'); const btnLow = document.getElementById('camWallLow'); if (btnFull.classList.contains('ativo')) { btnCut.click(); } else if (btnCut.classList.contains('ativo')) { btnLow.click(); } else { btnFull.click(); } }
      if (e.key === 'End') { document.getElementById('camWallLow')?.click(); const btnRoof = document.getElementById('camRoofToggle'); if (btnRoof && btnRoof.classList.contains('ativo')) btnRoof.click(); }

      if (e.key === ',') { document.getElementById('camRotLeft')?.click(); }
      if (e.key === '.') { document.getElementById('camRotRight')?.click(); }
      if (e.key.toLowerCase() === 'z' || e.key === '+') { document.getElementById('camZoomIn')?.click(); }
      if (e.key.toLowerCase() === 'x' || e.key === '-') { document.getElementById('camZoomOut')?.click(); }
  });

  document.querySelectorAll('.paleta-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
          document.querySelectorAll('.paleta-tab').forEach(b => b.classList.remove('ativo'));
          e.target.classList.add('ativo');
          categoriaPaletaAtual = e.target.getAttribute('data-cat');
          renderizarPaleta();
      });
  });

  document.getElementById('btnAdicionarTextura')?.addEventListener('click', () => document.getElementById('inputAdicionarTextura').click());
  document.getElementById('inputAdicionarTextura')?.addEventListener('change', e => { 
      Array.from(e.target.files || []).forEach(arquivo => { 
          const leitor = new FileReader(); leitor.onload = ev => { 
              const dataUrl = ev.target.result; const textura = new THREE.TextureLoader().load(dataUrl); textura.colorSpace = THREE.SRGBColorSpace; 
              const id = proximoIdPaleta++; paletas[categoriaPaletaAtual].push({ id, tipo: 'imagem', dataUrl, textura }); idPaletaSelecionada[categoriaPaletaAtual] = id; 
              renderizarPaleta(); showAviso(`Material adicionado na pasta: ${categoriaPaletaAtual.toUpperCase()}.`); 
          }; leitor.readAsDataURL(arquivo); 
      }); 
  });
  
  document.getElementById('btnAdicionarCor')?.addEventListener('click', () => { 
      const cor = document.getElementById('inputCorNova').value; const id = proximoIdPaleta++; 
      paletas[categoriaPaletaAtual].push({ id, tipo: 'cor', cor }); idPaletaSelecionada[categoriaPaletaAtual] = id; 
      renderizarPaleta(); showAviso(`Cor adicionada na pasta: ${categoriaPaletaAtual.toUpperCase()}.`); 
  });

  function ativarFerramenta(botaoId, modo, msg) { document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('ativo')); const btn = document.getElementById(botaoId); if(btn) btn.classList.add('ativo'); setModoAtivo(modo); atualizarVisibilidadeAndares(); if(msg) showAviso(msg); }

  const simsPanel = document.getElementById('sims-panel'); if(simsPanel) simsPanel.style.display = 'flex'; 
  const playActionBar = document.getElementById('play-action-bar');

  document.querySelectorAll('.node-btn').forEach(btn => { 
    btn.addEventListener('click', () => { 
      const isAlreadyActive = btn.classList.contains('active'); const targetId = btn.getAttribute('data-target');
      document.querySelectorAll('.node-btn').forEach(b => b.classList.remove('active')); document.querySelectorAll('.sub-panel').forEach(panel => panel.classList.remove('active')); 

      if (isAlreadyActive) { 
          if(simsPanel) simsPanel.style.display = 'none'; ativarFerramenta('btnSairModo', null, null); 
      } else { 
          btn.classList.add('active'); const target = document.getElementById(targetId); if (target) target.classList.add('active'); if(simsPanel) simsPanel.style.display = 'flex'; 

          if (targetId === 'panel-construcao') { estadoGlobal = 'construcao'; if (playActionBar) playActionBar.style.display = 'none'; showAviso("🏗️ Modo Construção: Geometria Destravada"); } 
          else if (targetId === 'panel-tabuleiro') { estadoGlobal = 'tabuleiro'; if (playActionBar) playActionBar.style.display = 'flex'; resetarEstadoConstrucao(); showAviso("♟️ Modo Tabuleiro: Geometria Trancada."); } 
          else { estadoGlobal = targetId.split('-')[1]; if (playActionBar) playActionBar.style.display = 'none'; resetarEstadoConstrucao(); }
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

  document.getElementById('btnModoParede')?.addEventListener('click', () => ativarFerramenta('btnModoParede', 'parede', 'Parede: Clique e arraste.'));
  document.getElementById('btnModoCerca')?.addEventListener('click', () => ativarFerramenta('btnModoCerca', 'cerca', 'Cerca: Delimita áreas sem telhado.'));
  document.getElementById('btnModoRetangulo')?.addEventListener('click', () => ativarFerramenta('btnModoRetangulo', 'retangulo', 'Sala Retangular: Clique e arraste.'));
  document.getElementById('btnModoTriangulo')?.addEventListener('click', () => ativarFerramenta('btnModoTriangulo', 'triangulo', 'Sala Triangular: Clique e arraste.'));
  document.getElementById('btnModoOctogono')?.addEventListener('click', () => ativarFerramenta('btnModoOctogono', 'octogono', 'Sala Octogonal: Clique e arraste.'));
  document.getElementById('btnModoPorta')?.addEventListener('click', () => ativarFerramenta('btnModoPorta', 'porta', 'Modo Porta: Clique nas paredes para instalar.'));
  document.getElementById('btnModoPintura')?.addEventListener('click', () => ativarFerramenta('btnModoPintura', 'pintura', 'Pintura: (Shift = Preencher tudo, Botão Direito = Apagar, Alt = Pipeta)'));
  document.getElementById('btnModoEscada')?.addEventListener('click', () => ativarFerramenta('btnModoEscada', 'escada', 'Escada Subindo: Arraste para a direção superior.'));
  document.getElementById('btnModoEscadaBaixo')?.addEventListener('click', () => ativarFerramenta('btnModoEscadaBaixo', 'escada_baixo', 'Escada Descendo: Arraste para escavar um subsolo.'));
  document.getElementById('btnModoColuna')?.addEventListener('click', () => ativarFerramenta('btnModoColuna', 'coluna', 'Coluna: Guias do andar superior ativas!'));
  document.getElementById('btnModoTelhado')?.addEventListener('click', () => ativarFerramenta('btnModoTelhado', 'telhado', 'Telhado: Clique dentro de um cômodo fechado para gerar a cobertura.'));
  document.getElementById('btnSairModo')?.addEventListener('click', () => ativarFerramenta('btnSairModo', null, 'Navegação: Livre.'));

  const botoesFuturos = ['btnModoTerreno']; botoesFuturos.forEach(id => { document.getElementById(id)?.addEventListener('click', () => showAviso("Em breve!")); });

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
}