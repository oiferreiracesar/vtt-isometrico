// main.js - Ponto de entrada da aplicação
import { scene, camera, renderer } from './engine.js';

// Um GridHelper provisório apenas para você ver o chão isométrico na tela
const gridTemporario = new THREE.GridHelper(32, 32, 0x38bdf8, 0x4a4030);
scene.add(gridTemporario);

// Loop de renderização
function animar() {
  requestAnimationFrame(animar);
  renderer.render(scene, camera);
}
animar();

// Controle temporário das abas HTML (apenas visual)
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
