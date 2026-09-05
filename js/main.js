// js/main.js - O Ponto de Partida (Motor Principal)
import { scene, camera, renderer, canvas } from './engine.js';
import { iniciarMapa } from './mapa.js';
import { iniciarUI } from './ui.js';
import { iniciarControles } from './controles.js';

// Inicia as fundações
iniciarMapa();
iniciarUI();

// Liga o motor de controle da Câmera (Mouse e WASD)
const atualizarMovimentoTeclado = iniciarControles(canvas);

// O Loop infinito que mantém o tabuleiro vivo na tela (60 FPS)
function animar() {
    requestAnimationFrame(animar);
    if (atualizarMovimentoTeclado) atualizarMovimentoTeclado();
    renderer.render(scene, camera);
}
animar();