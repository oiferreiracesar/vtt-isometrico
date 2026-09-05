// main.js - Ponto de entrada da aplicação modular
import { scene, camera, renderer, canvas } from './engine.js';
import { iniciarMapa } from './mapa.js';
import { iniciarControles } from './controles.js';
import { iniciarUI } from './ui.js';
import './construtor.js'; // Apenas importa para ativar os listeners de mouse

// Inicia chão e grid
iniciarMapa();

// Inicia botões e abas HTML
iniciarUI();

// Inicia câmera isométrica e movimentação (Pan/Zoom/WASD)
const atualizarTeclado = iniciarControles(canvas);

// Loop principal de renderização
function animar() {
  requestAnimationFrame(animar);
  atualizarTeclado();
  renderer.render(scene, camera);
}
animar();
