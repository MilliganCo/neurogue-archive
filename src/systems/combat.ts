// Боевая система: стрельба с отражениями, урон, здоровье

import { Entity, Biome, Orientation } from '../core/types.js';
import { step } from '../core/geometry.js';
import { EntityManager } from '../entities/entityManager.js';

const MAP_WIDTH = 10;
const MAP_HEIGHT = 10;

export interface Projectile {
    x: number;
    y: number;
    dx: number;
    dy: number;
    damage: number;
    ownerId: string;
    maxRange: number;
    traveled: number;
}

export interface DamageResult {
    hit: boolean;
    target?: Entity;
    damage?: number;
    critical?: boolean;
}

/**
 * Запускает стрелу/проектиль с учетом отражений через швы
 */
export function fireProjectile(
    startX: number,
    startY: number,
    dx: number,
    dy: number,
    damage: number,
    ownerId: string,
    maxRange: number,
    biome: Biome,
    entityManager: EntityManager,
    tiles: any[][]
): DamageResult {
    const projectile: Projectile = {
        x: startX,
        y: startY,
        dx,
        dy,
        damage,
        ownerId,
        maxRange,
        traveled: 0
    };

    let seamCrossings = 0;

    while (projectile.traveled < projectile.maxRange) {
        const result = step(projectile.x, projectile.y, projectile.dx, projectile.dy, biome);
        
        if (result.orientationFlip) {
            seamCrossings++;
        }

        projectile.x = result.x;
        projectile.y = result.y;
        projectile.dx = result.dx;
        projectile.dy = result.dy;
        projectile.traveled++;

        // Проверяем столкновение со стенами
        if (tiles[projectile.y][projectile.x].blocksLight) {
            break; // Стрела останавливается на стене
        }

        // Проверяем попадание в сущности
        const entities = entityManager.getEntitiesAt(projectile.x, projectile.y);
        for (const entity of entities) {
            if (entity.id !== ownerId && entity.hp !== undefined) {
                // Попадание!
                const isCritical = seamCrossings > 0 && seamCrossings % 2 === 0; // Крит при четном количестве пересечений швов
                const finalDamage = isCritical ? damage * 2 : damage;
                
                return {
                    hit: true,
                    target: entity,
                    damage: finalDamage,
                    critical: isCritical
                };
            }
        }
    }

    return { hit: false };
}

/**
 * Наносит урон сущности
 */
export function applyDamage(entity: Entity, damage: number): boolean {
    if (entity.hp === undefined) {
        return false;
    }

    entity.hp = Math.max(0, entity.hp - damage);
    return entity.hp === 0; // Возвращает true если сущность мертва
}

/**
 * Вычисляет урон от ближнего боя
 */
export function meleeAttack(
    attackerX: number,
    attackerY: number,
    targetX: number,
    targetY: number,
    damage: number,
    attackerId: string,
    entityManager: EntityManager
): DamageResult {
    // Проверяем, что цель рядом (4-соседство)
    const dx = Math.abs(targetX - attackerX);
    const dy = Math.abs(targetY - attackerY);
    
    if (dx + dy !== 1) {
        return { hit: false };
    }

    const entities = entityManager.getEntitiesAt(targetX, targetY);
    for (const entity of entities) {
        if (entity.id !== attackerId && entity.hp !== undefined) {
            return {
                hit: true,
                target: entity,
                damage: damage,
                critical: false
            };
        }
    }

    return { hit: false };
}

