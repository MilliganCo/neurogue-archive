// Поле зрения с лучами, учитывающими отражения

import { Biome, Tile, FogState } from './types.js';
import { step } from './geometry.js';

const MAP_WIDTH = 10;
const MAP_HEIGHT = 10;
const DEFAULT_VISION_RADIUS = 6;

/**
 * Бросает луч с учетом отражений через швы
 * @param startX Начальная координата X
 * @param startY Начальная координата Y
 * @param dx Начальное направление по X
 * @param dy Начальное направление по Y
 * @param maxSteps Максимальное количество шагов
 * @param biome Тип биома
 * @param blocksLight Функция проверки блокировки света
 * @returns Генератор позиций, которые видит луч
 */
export function* castRay(
    startX: number,
    startY: number,
    dx: number,
    dy: number,
    maxSteps: number = DEFAULT_VISION_RADIUS,
    biome: Biome = 'klein',
    blocksLight: (x: number, y: number) => boolean
): Generator<{ x: number; y: number; orientationFlip: boolean }, void, unknown> {
    let x = startX;
    let y = startY;
    let currentDx = dx;
    let currentDy = dy;
    let totalOrientationFlips = 0;

    // Нормализуем направление (только 4 направления)
    if (currentDx !== 0 && currentDy !== 0) {
        // Диагональ - выбираем одно направление
        if (Math.abs(currentDx) > Math.abs(currentDy)) {
            currentDy = 0;
        } else {
            currentDx = 0;
        }
    }

    for (let i = 0; i < maxSteps; i++) {
        const result = step(x, y, currentDx, currentDy, biome);
        
        if (result.orientationFlip) {
            totalOrientationFlips++;
        }

        x = result.x;
        y = result.y;
        currentDx = result.dx;
        currentDy = result.dy;

        // Возвращаем позицию
        yield {
            x,
            y,
            orientationFlip: totalOrientationFlips % 2 === 1
        };

        // Проверяем блокировку света
        if (blocksLight(x, y)) {
            break;
        }
    }
}

/**
 * Вычисляет поле зрения для игрока с учетом факелов
 * @param playerX Координата X игрока
 * @param playerY Координата Y игрока
 * @param visionRadius Базовый радиус зрения
 * @param torchRadius Дополнительный радиус от факелов
 * @param biome Тип биома
 * @param tiles Карта тайлов
 * @returns Множество видимых позиций
 */
export function calculateFOV(
    playerX: number,
    playerY: number,
    visionRadius: number = DEFAULT_VISION_RADIUS,
    torchRadius: number = 0,
    biome: Biome,
    tiles: Tile[][]
): Set<string> {
    const visible = new Set<string>();
    const key = (x: number, y: number) => `${x},${y}`;
    const totalRadius = visionRadius + torchRadius;

    // Всегда видим текущую позицию
    visible.add(key(playerX, playerY));

    // Бросаем лучи во все 4 направления и их комбинации
    const directions = [
        { dx: 1, dy: 0 },   // вправо
        { dx: -1, dy: 0 },  // влево
        { dx: 0, dy: 1 },   // вниз
        { dx: 0, dy: -1 },  // вверх
    ];

    const blocksLightFn = (x: number, y: number) => {
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
            return true;
        }
        return tiles[y][x].blocksLight;
    };

    for (const dir of directions) {
        for (const pos of castRay(
            playerX,
            playerY,
            dir.dx,
            dir.dy,
            totalRadius,
            biome,
            blocksLightFn
        )) {
            visible.add(key(pos.x, pos.y));
        }
    }

    return visible;
}

/**
 * Обновляет туман войны на основе поля зрения
 */
export function updateFog(
    fog: FogState[][],
    visible: Set<string>,
    explored: Set<string>
): void {
    const key = (x: number, y: number) => `${x},${y}`;

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const k = key(x, y);
            if (visible.has(k)) {
                fog[y][x] = { state: 'visible' };
                explored.add(k);
            } else if (explored.has(k)) {
                fog[y][x] = { state: 'explored' };
            } else {
                fog[y][x] = { state: 'unseen' };
            }
        }
    }
}

