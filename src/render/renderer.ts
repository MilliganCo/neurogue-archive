// Рендеринг игры на Canvas

import { Game } from '../core/game.js';
import { Tile, FogState } from '../core/types.js';

const TILE_SIZE = 24;
const MAP_WIDTH = 10;
const MAP_HEIGHT = 10;

export class Renderer {
    private ctx: CanvasRenderingContext2D;
    private game: Game;

    constructor(canvas: HTMLCanvasElement, game: Game) {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2d context');
        }
        this.ctx = ctx;
        this.game = game;
        
        // Настройка шрифта для текста
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
    }

    render(): void {
        const state = this.game.getState();
        const player = state.player;

        // Очистка
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        // Рендерим карту
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const fog = state.fog[y][x];
                
                // Пропускаем невидимые клетки (кроме клетки игрока)
                if (fog.state === 'unseen' && !(player.x === x && player.y === y)) {
                    continue;
                }

                const tile = state.map.tiles[y][x];
                const screenX = x * TILE_SIZE;
                const screenY = y * TILE_SIZE;

                // Рендерим тайл
                this.renderTile(tile, screenX, screenY, fog.state === 'explored');

                // Рендерим сущности
                for (const entity of state.entities) {
                    if (entity.x === x && entity.y === y) {
                        this.renderEntity(entity, screenX, screenY);
                    }
                }

                // Рендерим выход
                if (state.exitX === x && state.exitY === y) {
                    this.renderExit(screenX, screenY, fog.state === 'explored');
                }

                // Рендерим игрока (всегда видим)
                if (player.x === x && player.y === y) {
                    this.renderPlayer(player, screenX, screenY);
                }
            }
        }

        // Рендерим швы (если нужно)
        this.renderSeams();
    }

    private renderExit(x: number, y: number, explored: boolean): void {
        const alpha = explored ? 0.5 : 1.0;
        const centerX = x + TILE_SIZE / 2;
        const centerY = y + TILE_SIZE / 2;

        // Выход - желтый круг с символом
        this.ctx.fillStyle = `rgba(255, 255, 0, ${alpha * 0.3})`;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
        this.ctx.stroke();

        // Символ выхода
        this.ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
        this.ctx.fillText('↑', centerX, centerY);
    }

    private renderTile(tile: Tile, x: number, y: number, explored: boolean): void {
        const alpha = explored ? 0.5 : 1.0;

        if (tile.type === 'wall') {
            this.ctx.fillStyle = `rgba(100, 100, 100, ${alpha})`;
            this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            this.ctx.strokeStyle = `rgba(80, 80, 80, ${alpha})`;
            this.ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        } else {
            this.ctx.fillStyle = `rgba(40, 40, 40, ${alpha})`;
            this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            this.ctx.strokeStyle = `rgba(60, 60, 60, ${alpha})`;
            this.ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        }

        // Рендерим плиты
        if (tile.type === 'plate') {
            this.ctx.fillStyle = `rgba(100, 50, 150, ${alpha * 0.5})`;
            this.ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        }

        // Рендерим двери
        if (tile.type === 'door') {
            if (tile.blocksMovement) {
                // Закрытая дверь
                this.ctx.fillStyle = `rgba(139, 69, 19, ${alpha})`;
                this.ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                
                // Индикатор требуемой руки
                if (tile.chiralDoor) {
                    const handColor = tile.chiralDoor.requiredHand === 'L' ? '#4a9eff' : '#ff4a4a';
                    this.ctx.fillStyle = handColor;
                    this.ctx.fillText(tile.chiralDoor.requiredHand, x + TILE_SIZE / 2, y + TILE_SIZE / 2);
                }
            } else {
                // Открытая дверь
                this.ctx.fillStyle = `rgba(139, 69, 19, ${alpha * 0.3})`;
                this.ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            }
        }
    }

    private renderEntity(entity: any, x: number, y: number): void {
        const centerX = x + TILE_SIZE / 2;
        const centerY = y + TILE_SIZE / 2;

        switch (entity.type) {
            case 'keyL':
                this.ctx.fillStyle = '#4a9eff';
                this.ctx.fillText('L', centerX, centerY);
                break;
            case 'keyR':
                this.ctx.fillStyle = '#ff4a4a';
                this.ctx.fillText('R', centerX, centerY);
                break;
            case 'torch':
                this.ctx.fillStyle = '#ffaa00';
                this.ctx.fillRect(centerX - 3, centerY - 3, 6, 6);
                break;
            case 'rune':
                this.ctx.fillStyle = '#aa00ff';
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
                this.ctx.fill();
                break;
            case 'potion':
                this.ctx.fillStyle = '#00ff00';
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
                this.ctx.fill();
                break;
            case 'chameleon':
                this.ctx.fillStyle = '#00ffff';
                this.ctx.fillRect(centerX - 5, centerY - 5, 10, 10);
                this.renderHealthBar(entity, x, y);
                break;
            case 'archer':
                this.ctx.fillStyle = '#ff8800';
                this.ctx.fillRect(centerX - 5, centerY - 5, 10, 10);
                this.renderHealthBar(entity, x, y);
                break;
            case 'guard':
                this.ctx.fillStyle = '#8888ff';
                this.ctx.fillRect(centerX - 5, centerY - 5, 10, 10);
                this.renderHealthBar(entity, x, y);
                break;
            case 'slime':
                this.ctx.fillStyle = '#88ff88';
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
                this.ctx.fill();
                this.renderHealthBar(entity, x, y);
                break;
        }
    }

    private renderHealthBar(entity: any, x: number, y: number): void {
        if (entity.hp === undefined || entity.maxHp === undefined) {
            return;
        }

        const barWidth = TILE_SIZE - 4;
        const barHeight = 2;
        const barX = x + 2;
        const barY = y - 4;

        // Фон полоски здоровья
        this.ctx.fillStyle = '#330000';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // Полоска здоровья
        const healthPercent = entity.hp / entity.maxHp;
        const healthWidth = barWidth * healthPercent;
        
        if (healthPercent > 0.5) {
            this.ctx.fillStyle = '#00ff00';
        } else if (healthPercent > 0.25) {
            this.ctx.fillStyle = '#ffff00';
        } else {
            this.ctx.fillStyle = '#ff0000';
        }
        
        this.ctx.fillRect(barX, barY, healthWidth, barHeight);
    }

    private renderPlayer(player: any, x: number, y: number): void {
        const centerX = x + TILE_SIZE / 2;
        const centerY = y + TILE_SIZE / 2;

        // Игрок - зеленый квадрат
        this.ctx.fillStyle = '#00ff00';
        this.ctx.fillRect(centerX - 6, centerY - 6, 12, 12);

        // Индикатор ориентации
        this.ctx.fillStyle = player.orientation === 1 ? '#ffffff' : '#ffff00';
        this.ctx.fillRect(centerX - 2, centerY - 8, 4, 4);
    }

    private renderSeams(): void {
        // Рендерим маркеры швов по краям карты
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.2)';
        this.ctx.lineWidth = 1;

        // Горизонтальные швы (всегда есть)
        for (let x = 0; x < MAP_WIDTH; x++) {
            // Верхний край
            this.ctx.beginPath();
            this.ctx.moveTo(x * TILE_SIZE, 0);
            this.ctx.lineTo((x + 1) * TILE_SIZE, 0);
            this.ctx.stroke();

            // Нижний край
            this.ctx.beginPath();
            this.ctx.moveTo(x * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
            this.ctx.lineTo((x + 1) * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
            this.ctx.stroke();
        }

        // Вертикальные швы (только если биом klein или projective)
        const biome = this.game.getMap().biome;
        if (biome === 'klein' || biome === 'projective') {
            for (let y = 0; y < MAP_HEIGHT; y++) {
                // Левый край
                this.ctx.beginPath();
                this.ctx.moveTo(0, y * TILE_SIZE);
                this.ctx.lineTo(0, (y + 1) * TILE_SIZE);
                this.ctx.stroke();

                // Правый край
                this.ctx.beginPath();
                this.ctx.moveTo(MAP_WIDTH * TILE_SIZE, y * TILE_SIZE);
                this.ctx.lineTo(MAP_WIDTH * TILE_SIZE, (y + 1) * TILE_SIZE);
                this.ctx.stroke();
            }
        }
    }
}

