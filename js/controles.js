// js/controles.js - Navegação de Câmera (Pan, Zoom, WASD)
import { camera, orbitAlvo, configsCamera, atualizarCamera } from './engine.js';

export function iniciarControles(canvas) {
  // 1. Zoom (Scroll do Mouse)
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    configsCamera.zoom = THREE.MathUtils.clamp(configsCamera.zoom - e.deltaY * 0.002, 0.2, 8);
    atualizarCamera();
  }, { passive: false });

  // 2. Pan (Botão do Meio ou Alt + Botão Esquerdo)
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
    if (arrastandoPan) {
      arrastandoPan = false;
      canvas.style.cursor = 'default';
    }
  });

  window.addEventListener('pointermove', e => {
    if (arrastandoPan) {
      const dx = e.clientX - ultimoX;
      const dy = e.clientY - ultimoY;
      
      const fatorTranslacao = (15 / configsCamera.zoom) * 0.0028;
      
      // Matemática para arrastar no ângulo isométrico
      orbitAlvo.x -= (dx + dy * 1.5) * fatorTranslacao;
      orbitAlvo.z += (dx - dy * 1.5) * fatorTranslacao;

      ultimoX = e.clientX;
      ultimoY = e.clientY;
      atualizarCamera();
    }
  });

  // 3. Teclado (WASD / Setas)
  const teclas = {};
  window.addEventListener('keydown', e => teclas[e.key.toLowerCase()] = true);
  window.addEventListener('keyup', e => teclas[e.key.toLowerCase()] = false);

  function atualizarMovimentoTeclado() {
    const vel = 0.25 / configsCamera.zoom;
    let mudou = false;
    
    // Movimento ajustado para alinhar com os eixos da tela
    if (teclas['w'] || teclas['arrowup']) { orbitAlvo.x -= vel; orbitAlvo.z -= vel; mudou = true; }
    if (teclas['s'] || teclas['arrowdown']) { orbitAlvo.x += vel; orbitAlvo.z += vel; mudou = true; }
    if (teclas['a'] || teclas['arrowleft']) { orbitAlvo.x -= vel; orbitAlvo.z += vel; mudou = true; }
    if (teclas['d'] || teclas['arrowright']) { orbitAlvo.x += vel; orbitAlvo.z -= vel; mudou = true; }
    
    if (mudou) atualizarCamera();
  }

  // Retorna a função de movimentação para ser chamada no loop de animação
  return atualizarMovimentoTeclado;
}
