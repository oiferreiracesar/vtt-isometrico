// js/ui.js - Gerenciamento da Interface HTML
import { setModoAtivo, mudarVisaoParedes } from './construtor.js';
import { configsCamera, atualizarCamera } from './engine.js';

let avisoTimeout = null;
export function showAviso(msg) {
  let el = document.getElementById('avisoTemp');
  if(!el) {
    el = document.createElement('div'); el.id = 'avisoTemp';
    el.style.cssText = 'position:absolute; bottom:40px; left:50%; transform:translateX(-50%); background:rgba(30,25,18,0.95); color:#e8dcc0; border:1px solid #38bdf8; border-radius:6px; padding:8px 16px; font-size:12px; z-index:999; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: sans-serif;';
    document.body.appendChild(el);
  }
  el.textContent = msg; el.style.display = 'block';
  clearTimeout(avisoTimeout); avisoTimeout = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

export function iniciarUI() {
  document.querySelectorAll('.node-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.node-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.sub-panel').forEach(panel => panel.classList.remove('active'));
      const targetId = btn.getAttribute('data-target');
      const targetPanel = document.getElementById(targetId);
      if(targetPanel) targetPanel.classList.add('active');
    });
  });

  function desativarFerramentas() { document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('ativo')); }

  document.getElementById('btnModoParede').addEventListener('click', (e) => { desativarFerramentas(); e.currentTarget.classList.add('ativo'); setModoAtivo('parede'); });
  document.getElementById('btnModoRetangulo').addEventListener('click', (e) => { desativarFerramentas(); e.currentTarget.classList.add('ativo'); setModoAtivo('retangulo'); });
  document.getElementById('btnModoTriangulo').addEventListener('click', (e) => { desativarFerramentas(); e.currentTarget.classList.add('ativo'); setModoAtivo('triangulo'); });
  document.getElementById('btnModoOctogono').addEventListener('click', (e) => { desativarFerramentas(); e.currentTarget.classList.add('ativo'); setModoAtivo('octogono'); });
  document.getElementById('btnSairModo').addEventListener('click', (e) => { desativarFerramentas(); e.currentTarget.classList.add('ativo'); setModoAtivo(null); });

  // ==========================================
  // CONTROLES DE CÂMERA E PAREDES (THE SIMS)
  // ==========================================

  // Zoom
  document.getElementById('camZoomIn').addEventListener('click', () => { configsCamera.zoom = Math.min(8, configsCamera.zoom + 0.5); atualizarCamera(); });
  document.getElementById('camZoomOut').addEventListener('click', () => { configsCamera.zoom = Math.max(0.2, configsCamera.zoom - 0.5); atualizarCamera(); });

  // Rotação (90 graus)
  document.getElementById('camRotLeft').addEventListener('click', () => {
    configsCamera.angulo -= Math.PI / 2;
    atualizarCamera();
    showAviso('Câmera rotacionada para Esquerda.');
  });
  document.getElementById('camRotRight').addEventListener('click', () => {
    configsCamera.angulo += Math.PI / 2;
    atualizarCamera();
    showAviso('Câmera rotacionada para Direita.');
  });

  // Andares
  document.getElementById('camUp').addEventListener('click', () => {
    configsCamera.nivel += 1;
    atualizarCamera();
    showAviso(`Subiu para o andar ${configsCamera.nivel}.`);
  });
  document.getElementById('camDown').addEventListener('click', () => {
    configsCamera.nivel = Math.max(0, configsCamera.nivel - 1);
    atualizarCamera();
    showAviso(configsCamera.nivel === 0 ? `Desceu para o Térreo.` : `Desceu para o andar ${configsCamera.nivel}.`);
  });

  // Modo de Visão das Paredes
  const btnWallFull = document.getElementById('camWallFull');
  const btnWallCut = document.getElementById('camWallCut');
  const btnWallLow = document.getElementById('camWallLow');

  function clearWallActive() { [btnWallFull, btnWallCut, btnWallLow].forEach(b => b.classList.remove('ativo')); }

  btnWallFull.addEventListener('click', () => { clearWallActive(); btnWallFull.classList.add('ativo'); mudarVisaoParedes('full'); });
  btnWallCut.addEventListener('click', () => { clearWallActive(); btnWallCut.classList.add('ativo'); mudarVisaoParedes('cut'); });
  btnWallLow.addEventListener('click', () => { clearWallActive(); btnWallLow.classList.add('ativo'); mudarVisaoParedes('low'); });
}
