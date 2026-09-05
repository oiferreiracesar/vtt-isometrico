// js/controles.js - Navegação de Câmera (Pan, Zoom, WASD)
import { camera, orbitAlvo, configsCamera, atualizarCamera } from './engine.js';

export function iniciarControles(canvas) {
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
      
      // Matemática para o arraste funcionar em qualquer ângulo girado da câmera
      const dirX = -Math.cos(configsCamera.angulo);
      const dirZ = -Math.sin(configsCamera.angulo);

      orbitAlvo.x -= (-dirZ * dx + dirX * dy * 1.5) * fatorTranslacao;
      orbitAlvo.z -= (dirX * dx + dirZ * dy * 1.5) * fatorTranslacao;

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
    
    // Calcula qual direção é a "Frente" da câmera naquele exato momento
    const dirX = -Math.cos(configsCamera.angulo);
    const dirZ = -Math.sin(configsCamera.angulo);
    
    if (teclas['w'] || teclas['arrowup']) { orbitAlvo.x += dirX * vel; orbitAlvo.z += dirZ * vel; mudou = true; }
    if (teclas['s'] || teclas['arrowdown']) { orbitAlvo.x -= dirX * vel; orbitAlvo.z -= dirZ * vel; mudou = true; }
    if (teclas['a'] || teclas['arrowleft']) { orbitAlvo.x += dirZ * vel; orbitAlvo.z -= dirX * vel; mudou = true; }
    if (teclas['d'] || teclas['arrowright']) { orbitAlvo.x -= dirZ * vel; orbitAlvo.z += dirX * vel; mudou = true; }
    
    if (mudou) atualizarCamera();
  }

  return atualizarMovimentoTeclado;
}
