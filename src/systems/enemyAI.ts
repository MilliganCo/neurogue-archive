// ИИ врагов с учетом отражений

import { Entity, EntityType, Biome, Orientation } from '../core/types.js';
import { step, manhattanDistance, getNeighbors } from '../core/geometry.js';
import { EntityManager } from '../entities/entityManager.js';
import { fireProjectile, applyDamage, meleeAttack } from './combat.js';

const MAP_WIDTH = 10;
const MAP_HEIGHT = 10;

export interface EnemyAI {
    type: EntityType;
    think: (enemy: Entity, player: { x: number; y: number; orientation: Orientation }, biome: Biome, entityManager: EntityManager, tiles: any[][]) => EnemyAction;
}

export interface EnemyAction {
    type: 'move' | 'attack' | 'shoot' | 'wait';
    dx?: number;
    dy?: number;
    targetX?: number;
    targetY?: number;
}

/**
 * BFS поиск пути к игроку с учетом отражений
 */
function findPathToPlayer(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    biome: Biome,
    entityManager: EntityManager,
    tiles: any[][],
    excludeId: string
): Array<{ x: number; y: number }> | null {
    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number; path: Array<{ x: number; y: number }> }> = [
        { x: startX, y: startY, path: [{ x: startX, y: startY }] }
    ];
    visited.add(`${startX},${startY}`);

    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (queue.length > 0) {
        const current = queue.shift()!;

        // Проверяем достижение цели (с учетом всех возможных отражений)
        const dist = manhattanDistance(current.x, current.y, targetX, targetY);
        if (dist <= 1) {
            return current.path;
        }

        for (const [dx, dy] of directions) {
            const result = step(current.x, current.y, dx, dy, biome);
            const key = `${result.x},${result.y}`;

            if (!visited.has(key)) {
                // Проверяем проходимость
                if (tiles[result.y][result.x].blocksMovement) {
                    continue;
                }

                // Проверяем блокировку сущностями (кроме себя и игрока)
                const blocking = entityManager.getBlockingEntities(result.x, result.y, excludeId);
                const hasBlocking = blocking.some(e => e.id !== excludeId && e.type !== 'player');
                
                if (hasBlocking) {
                    continue;
                }

                visited.add(key);
                queue.push({
                    x: result.x,
                    y: result.y,
                    path: [...current.path, { x: result.x, y: result.y }]
                });
            }
        }
    }

    return null;
}

/**
 * ИИ для Хамелеона - движение по диагонали через скачок
 */
export const chameleonAI: EnemyAI = {
    type: 'chameleon',
    think: (enemy, player, biome, entityManager, tiles) => {
        // Хамелеон движется по диагонали
        const dx = Math.sign(player.x - enemy.x);
        const dy = Math.sign(player.y - enemy.y);

        // Если рядом с игроком - атака
        const dist = Math.abs(player.x - enemy.x) + Math.abs(player.y - enemy.y);
        if (dist === 1) {
            return { type: 'attack', targetX: player.x, targetY: player.y };
        }

        // Пытаемся двигаться по диагонали
        if (dx !== 0 && dy !== 0) {
            // Пробуем сначала по X, потом по Y
            const result1 = step(enemy.x, enemy.y, dx, 0, biome);
            if (!tiles[result1.y][result1.x].blocksMovement && 
                !entityManager.isBlocked(result1.x, result1.y, enemy.id)) {
                return { type: 'move', dx, dy: 0 };
            }

            const result2 = step(enemy.x, enemy.y, 0, dy, biome);
            if (!tiles[result2.y][result2.x].blocksMovement && 
                !entityManager.isBlocked(result2.x, result2.y, enemy.id)) {
                return { type: 'move', dx: 0, dy };
            }
        } else if (dx !== 0) {
            return { type: 'move', dx, dy: 0 };
        } else if (dy !== 0) {
            return { type: 'move', dx: 0, dy };
        }

        return { type: 'wait' };
    }
};

/**
 * ИИ для Стража - открывает хиральные двери, преследует игрока
 */
export const guardAI: EnemyAI = {
    type: 'guard',
    think: (enemy, player, biome, entityManager, tiles) => {
        const dist = Math.abs(player.x - enemy.x) + Math.abs(player.y - enemy.y);
        
        // Если рядом - атака
        if (dist === 1) {
            return { type: 'attack', targetX: player.x, targetY: player.y };
        }

        // Ищем путь к игроку
        const path = findPathToPlayer(enemy.x, enemy.y, player.x, player.y, biome, entityManager, tiles, enemy.id);
        if (path && path.length > 1) {
            const next = path[1];
            const dx = next.x - enemy.x;
            const dy = next.y - enemy.y;
            
            // Нормализуем направление
            const normDx = dx !== 0 ? Math.sign(dx) : 0;
            const normDy = dy !== 0 ? Math.sign(dy) : 0;
            
            return { type: 'move', dx: normDx, dy: normDy };
        }

        return { type: 'wait' };
    }
};

/**
 * ИИ для Лучника - стреляет по прямой, стрелы отражаются
 */
export const archerAI: EnemyAI = {
    type: 'archer',
    think: (enemy, player, biome, entityManager, tiles) => {
        const dist = Math.abs(player.x - enemy.x) + Math.abs(player.y - enemy.y);
        
        // Если очень близко - отступаем или атакуем ближним
        if (dist === 1) {
            return { type: 'attack', targetX: player.x, targetY: player.y };
        }

        // Если в пределах дальности стрельбы (до 6 клеток)
        if (dist <= 6) {
            // Проверяем линию обзора
            const dx = Math.sign(player.x - enemy.x);
            const dy = Math.sign(player.y - enemy.y);
            
            // Стреляем в направлении игрока
            return { type: 'shoot', dx, dy };
        }

        // Двигаемся к игроку
        const path = findPathToPlayer(enemy.x, enemy.y, player.x, player.y, biome, entityManager, tiles, enemy.id);
        if (path && path.length > 1) {
            const next = path[1];
            const dx = next.x - enemy.x;
            const dy = next.y - enemy.y;
            
            const normDx = dx !== 0 ? Math.sign(dx) : 0;
            const normDy = dy !== 0 ? Math.sign(dy) : 0;
            
            return { type: 'move', dx: normDx, dy: normDy };
        }

        return { type: 'wait' };
    }
};

/**
 * ИИ для Зеркальной слизи - делится/удваивает урон в зависимости от s
 */
export const slimeAI: EnemyAI = {
    type: 'slime',
    think: (enemy, player, biome, entityManager, tiles) => {
        const dist = Math.abs(player.x - enemy.x) + Math.abs(player.y - enemy.y);
        
        // Если рядом - атака
        if (dist === 1) {
            return { type: 'attack', targetX: player.x, targetY: player.y };
        }

        // Двигаемся к игроку простым способом
        const dx = Math.sign(player.x - enemy.x);
        const dy = Math.sign(player.y - enemy.y);

        if (dx !== 0) {
            const result = step(enemy.x, enemy.y, dx, 0, biome);
            if (!tiles[result.y][result.x].blocksMovement && 
                !entityManager.isBlocked(result.x, result.y, enemy.id)) {
                return { type: 'move', dx, dy: 0 };
            }
        }

        if (dy !== 0) {
            const result = step(enemy.x, enemy.y, 0, dy, biome);
            if (!tiles[result.y][result.x].blocksMovement && 
                !entityManager.isBlocked(result.x, result.y, enemy.id)) {
                return { type: 'move', dx: 0, dy };
            }
        }

        return { type: 'wait' };
    }
};

/**
 * Получить ИИ для типа врага
 */
export function getEnemyAI(type: EntityType): EnemyAI | null {
    switch (type) {
        case 'chameleon':
            return chameleonAI;
        case 'guard':
            return guardAI;
        case 'archer':
            return archerAI;
        case 'slime':
            return slimeAI;
        default:
            return null;
    }
}

