// js/controles.js - Navegação de Câmera com Fronteiras Inteligentes
import { camera, orbitAlvo, configsCamera, atualizarCamera } from './engine.js';
import { configMapa } from './mapa.js';

export function iniciarControles(canvas) {
  
  // A Matemática da Fronteira Invisível
  function aplicarFronteiras() {
      const limiteX = (configMapa.largura / 2) + 2;
      const limiteZ = (configMapa.profundidade / 2) + 2;
      orbitAlvo.x = THREE.MathUtils.clamp(orbitAlvo.x, -limiteX, limiteX);
      orbitAlvo.z = THREE.MathUtils.clamp(orbitAlvo.z, -limiteZ, limiteZ);
  }

  // Zoom via Scroll
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    configsCamera.zoom = THREE.MathUtils.clamp(configsCamera.zoom - e.deltaY * 0.002, 0.2, 8);
    atualizarCamera();
  }, { passive: false });

  // Pan
  let arrastandoPan = false;
  let ultimoX = 0, ultimoY = 0;

  canvas.addEventListener('pointerdown', e => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      arrastandoPan = true;
      ultimoX = e.clientX; 
      ultimoY = e.clientY;
      canvas.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('pointerup', () => {
    if (arrastandoPan) { arrastandoPan = false; canvas.style.cursor = 'default'; }
  });

  window.addEventListener('pointermove', e => {
    if (arrastandoPan) {
      const dx = e.clientX - ultimoX;
      const dy = e.clientY - ultimoY;
      const fatorTranslacao = (15 / configsCamera.zoom) * 0.0028;
      
      const dirX = -Math.cos(configsCamera.angulo);
      const dirZ = -Math.sin(configsCamera.angulo);

      orbitAlvo.x -= (-dirZ * dx + dirX * dy * 1.5) * fatorTranslacao;
      orbitAlvo.z -= (dirX * dx + dirZ * dy * 1.5) * fatorTranslacao;

      aplicarFronteiras();
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      atualizarCamera();
    }
  });

  // Teclado
  const teclas = {};
  window.addEventListener('keydown', e => teclas[e.key.toLowerCase()] = true);
  window.addEventListener('keyup', e => teclas[e.key.toLowerCase()] = false);

  function atualizarMovimentoTeclado() {
    const vel = 0.25 / configsCamera.zoom;
    let mudou = false;
    
    const dirX = -Math.cos(configsCamera.angulo);
    const dirZ = -Math.sin(configsCamera.angulo);
    
    if (teclas['w'] || teclas['arrowup']) { orbitAlvo.x += dirX * vel; orbitAlvo.z += dirZ * vel; mudou = true; }
    if (teclas['s'] || teclas['arrowdown']) { orbitAlvo.x -= dirX * vel; orbitAlvo.z -= dirZ * vel; mudou = true; }
    if (teclas['a'] || teclas['arrowleft']) { orbitAlvo.x += dirZ * vel; orbitAlvo.z -= dirX * vel; mudou = true; }
    if (teclas['d'] || teclas['arrowright']) { orbitAlvo.x -= dirZ * vel; orbitAlvo.z += dirX * vel; mudou = true; }
    
    if (mudou) { 
        aplicarFronteiras(); 
        atualizarCamera(); 
    }
  }

  return atualizarMovimentoTeclado;
}