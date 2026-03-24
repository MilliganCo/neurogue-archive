// Точка входа приложения

import { Game } from './core/game.js';
import { Renderer } from './render/renderer.js';
import { Minimap } from './render/minimap.js';
import { hasSave } from './systems/saveLoad.js';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
if (!canvas) {
    throw new Error('Canvas not found');
}

const minimapCanvas = document.getElementById('minimapCanvas') as HTMLCanvasElement;
if (!minimapCanvas) {
    throw new Error('Minimap canvas not found');
}

const game = new Game();
const renderer = new Renderer(canvas, game);
const minimap = new Minimap(minimapCanvas);

// Инициализация игры
if (hasSave()) {
    const loadConfirm = confirm('Найдено сохранение. Загрузить?');
    if (loadConfirm) {
        if (!game.load()) {
            alert('Ошибка загрузки сохранения. Начинаем новую игру.');
            game.init();
        }
    } else {
        game.init();
    }
} else {
    game.init();
}

// Обработка ввода
const keys = new Set<string>();

// Функция нормализации клавиш
function normalizeKey(key: string): string {
    const keyMap: { [key: string]: string } = {
        'ArrowUp': 'arrowup',
        'ArrowDown': 'arrowdown',
        'ArrowLeft': 'arrowleft',
        'ArrowRight': 'arrowright',
        ' ': 'space',
        'Tab': 'tab'
    };
    return keyMap[key] || key.toLowerCase();
}

document.addEventListener('keydown', (e) => {
    const normalizedKey = normalizeKey(e.key);
    keys.add(normalizedKey);
    
    // Обработка Ctrl+S для сохранения
    if ((e.ctrlKey || e.metaKey) && normalizedKey === 's') {
        e.preventDefault();
        if (game.save()) {
            console.log('Игра сохранена!');
        }
        return;
    }
    
    handleInput();
});

document.addEventListener('keyup', (e) => {
    const normalizedKey = normalizeKey(e.key);
    keys.delete(normalizedKey);
});

function handleInput() {
    if (keys.has('w') || keys.has('arrowup')) {
        game.movePlayer(0, -1);
        keys.delete('w');
        keys.delete('arrowup');
    } else if (keys.has('s') || keys.has('arrowdown')) {
        game.movePlayer(0, 1);
        keys.delete('s');
        keys.delete('arrowdown');
    } else if (keys.has('a') || keys.has('arrowleft')) {
        game.movePlayer(-1, 0);
        keys.delete('a');
        keys.delete('arrowleft');
    } else if (keys.has('d') || keys.has('arrowright')) {
        game.movePlayer(1, 0);
        keys.delete('d');
        keys.delete('arrowright');
    } else if (keys.has('space')) {
        game.wait();
        keys.delete('space');
    } else if (keys.has('f')) {
        game.shoot();
        keys.delete('f');
    } else if (keys.has('q')) {
        game.useRune();
        keys.delete('q');
    } else if (keys.has('e')) {
        game.useRune();
        keys.delete('e');
    } else if (keys.has('tab')) {
        game.switchHand();
        keys.delete('tab');
    } else if (keys.has('t')) {
        game.useTorch();
        keys.delete('t');
    }
}

// Игровой цикл
function gameLoop() {
    renderer.render();
    minimap.render(game.getState());
    updateUI();
    requestAnimationFrame(gameLoop);
}

function updateUI() {
    const player = game.getPlayer();
    const state = game.getState();
    const orientationEl = document.getElementById('orientation');
    const handEl = document.getElementById('hand');
    const hpEl = document.getElementById('hp');
    const torchesEl = document.getElementById('torches');
    const compassEl = document.getElementById('compass');
    const floorEl = document.getElementById('floor');

    if (orientationEl) {
        orientationEl.textContent = player.orientation === 1 ? '+1' : '-1';
    }
    if (handEl) {
        handEl.textContent = player.hand;
    }
    if (hpEl) {
        hpEl.textContent = `${player.hp}/${player.maxHp}`;
    }
    if (torchesEl) {
        torchesEl.textContent = player.torches.toString();
    }
    if (compassEl) {
        // Компас меняется в зависимости от ориентации
        if (player.orientation === 1) {
            compassEl.textContent = 'N↑';
        } else {
            compassEl.textContent = 'S↓';
        }
    }
    if (floorEl) {
        floorEl.textContent = `Этаж ${state.floor}`;
    }

    // Обновляем инвентарь
    const inventoryEl = document.getElementById('inventory');
    if (inventoryEl) {
        const keys = player.inventory.filter(item => item === 'keyL' || item === 'keyR');
        const runes = player.inventory.filter(item => item === 'rune').length;
        let invText = '';
        if (keys.includes('keyL')) invText += 'L ';
        if (keys.includes('keyR')) invText += 'R ';
        if (runes > 0) invText += `Рун: ${runes}`;
        inventoryEl.textContent = invText || 'Пусто';
    }
}

gameLoop();
