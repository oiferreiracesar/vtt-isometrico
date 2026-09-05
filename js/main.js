// js/main.js - O Ponto de Partida (Motor Principal)
import { scene, camera, renderer } from './engine.js';
import { iniciarMapa } from './mapa.js';
import { iniciarUI } from './ui.js';

// Inicia as fundações
iniciarMapa();
iniciarUI();

// O Loop infinito que mantém o tabuleiro vivo na tela (60 FPS)
function animar() {
    requestAnimationFrame(animar);
    renderer.render(scene, camera);
}
animar();