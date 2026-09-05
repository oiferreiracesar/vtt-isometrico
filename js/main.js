// main.js - Ponto de entrada da aplicação
import { scene, camera, renderer, canvas } from './engine.js';
import { iniciarMapa } from './mapa.js';
import { iniciarControles } from './controles.js';

// Inicia o chão escuro com a grade
iniciarMapa();

// Inicia o pan/zoom isométrico e guarda a função do teclado
const atualizarTeclado = iniciarControles(canvas);

// Loop de renderização principal
function animar() {
  requestAnimationFrame(animar);
  atualizarTeclado(); // Processa WASD continuamente
  renderer.render(scene, camera);
}
animar();

// Controle provisório das abas do HUD
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
