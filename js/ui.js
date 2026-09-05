// js/ui.js - Gerenciamento da Interface HTML
import { setModoAtivo } from './construtor.js';

let avisoTimeout = null;
export function showAviso(msg) {
  let el = document.getElementById('avisoTemp');
  if(!el) {
    el = document.createElement('div'); 
    el.id = 'avisoTemp';
    el.style.cssText = 'position:absolute; bottom:40px; left:50%; transform:translateX(-50%); background:rgba(30,25,18,0.95); color:#e8dcc0; border:1px solid #38bdf8; border-radius:6px; padding:8px 16px; font-size:12px; z-index:999; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: sans-serif;';
    document.body.appendChild(el);
  }
  el.textContent = msg; 
  el.style.display = 'block';
  clearTimeout(avisoTimeout); 
  avisoTimeout = setTimeout(() => { el.style.display = 'none'; }, 3000);
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

  function desativarFerramentas() {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('ativo'));
  }

  document.getElementById('btnModoParede').addEventListener('click', (e) => {
    desativarFerramentas();
    e.currentTarget.classList.add('ativo');
    setModoAtivo('parede');
    showAviso('Modo Parede: Clique no ponto inicial e final.');
  });

  document.getElementById('btnModoRetangulo').addEventListener('click', (e) => {
    desativarFerramentas();
    e.currentTarget.classList.add('ativo');
    setModoAtivo('retangulo');
    showAviso('Modo Retângulo: Clique em um canto e no canto oposto.');
  });

  document.getElementById('btnModoTriangulo').addEventListener('click', (e) => {
    desativarFerramentas();
    e.currentTarget.classList.add('ativo');
    setModoAtivo('triangulo');
    showAviso('Modo Triângulo: Defina a área delimitadora da sala.');
  });

  document.getElementById('btnModoOctogono').addEventListener('click', (e) => {
    desativarFerramentas();
    e.currentTarget.classList.add('ativo');
    setModoAtivo('octogono');
    showAviso('Modo Octógono: Defina a área delimitadora da sala.');
  });

  document.getElementById('btnSairModo').addEventListener('click', (e) => {
    desativarFerramentas();
    e.currentTarget.classList.add('ativo');
    setModoAtivo(null);
  });
}
