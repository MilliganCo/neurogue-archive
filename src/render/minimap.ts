// Миникарта уровня

import { GameState, FogState } from '../core/types.js';

const MAP_WIDTH = 10;
const MAP_HEIGHT = 10;
const MINIMAP_SIZE = 100; // Размер миникарты в пикселях
const CELL_SIZE = MINIMAP_SIZE / MAP_WIDTH;

export class Minimap {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.canvas.width = MINIMAP_SIZE;
        this.canvas.height = MINIMAP_SIZE;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2d context for minimap');
        }
        this.ctx = ctx;
    }

    render(state: GameState): void {
        // Очистка
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

        // Рендерим карту
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const fog = state.fog[y][x];
                const tile = state.map.tiles[y][x];
                const screenX = x * CELL_SIZE;
                const screenY = y * CELL_SIZE;

                // Цвет зависит от состояния тумана войны
                if (fog.state === 'unseen') {
                    // Невидимые клетки - черные
                    this.ctx.fillStyle = '#000';
                } else if (fog.state === 'explored') {
                    // Разведанные клетки - темно-серые
                    if (tile.type === 'wall') {
                        this.ctx.fillStyle = '#333';
                    } else {
                        this.ctx.fillStyle = '#222';
                    }
                } else {
                    // Видимые клетки - светлые
                    if (tile.type === 'wall') {
                        this.ctx.fillStyle = '#666';
                    } else {
                        this.ctx.fillStyle = '#444';
                    }
                }

                this.ctx.fillRect(screenX, screenY, CELL_SIZE, CELL_SIZE);

                // Рисуем границы клеток
                this.ctx.strokeStyle = '#111';
                this.ctx.lineWidth = 0.5;
                this.ctx.strokeRect(screenX, screenY, CELL_SIZE, CELL_SIZE);

                // Специальные тайлы
                if (fog.state !== 'unseen') {
                    if (tile.type === 'door') {
                        this.ctx.fillStyle = '#8b4513';
                        this.ctx.fillRect(screenX + 1, screenY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                    } else if (tile.type === 'plate') {
                        this.ctx.fillStyle = '#643264';
                        this.ctx.fillRect(screenX + 1, screenY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                    }
                }
            }
        }

        // Рендерим выход
        if (state.exitX !== undefined && state.exitY !== undefined) {
            const fog = state.fog[state.exitY][state.exitX];
            if (fog.state !== 'unseen') {
                this.ctx.fillStyle = '#ff0';
                this.ctx.beginPath();
                this.ctx.arc(
                    state.exitX * CELL_SIZE + CELL_SIZE / 2,
                    state.exitY * CELL_SIZE + CELL_SIZE / 2,
                    CELL_SIZE / 3,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
            }
        }

        // Рендерим игрока
        this.ctx.fillStyle = '#0f0';
        this.ctx.beginPath();
        this.ctx.arc(
            state.player.x * CELL_SIZE + CELL_SIZE / 2,
            state.player.y * CELL_SIZE + CELL_SIZE / 2,
            CELL_SIZE / 2 - 1,
            0,
            Math.PI * 2
        );
        this.ctx.fill();

        // Рендерим врагов (только видимые)
        for (const entity of state.entities) {
            const fog = state.fog[entity.y][entity.x];
            if (fog.state === 'visible' && 
                (entity.type === 'chameleon' || entity.type === 'guard' || 
                 entity.type === 'archer' || entity.type === 'slime')) {
                this.ctx.fillStyle = '#f00';
                this.ctx.fillRect(
                    entity.x * CELL_SIZE + 1,
                    entity.y * CELL_SIZE + 1,
                    CELL_SIZE - 2,
                    CELL_SIZE - 2
                );
            }
        }
    }
}

