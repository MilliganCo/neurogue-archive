// Геометрия с отражениями через швы

import { StepResult, Biome, Orientation } from './types.js';

const MAP_WIDTH = 10;
const MAP_HEIGHT = 10;

/**
 * Выполняет шаг с учетом отражений через швы
 * @param x Текущая координата X
 * @param y Текущая координата Y
 * @param dx Направление по X (-1, 0, 1)
 * @param dy Направление по Y (-1, 0, 1)
 * @param biome Тип биома (определяет какие швы отражают)
 * @returns Результат шага с новыми координатами, направлением и флагом инверсии ориентации
 */
export function step(
    x: number,
    y: number,
    dx: number,
    dy: number,
    biome: Biome = 'klein'
): StepResult {
    let nx = x + dx;
    let ny = y + dy;
    let newDx = dx;
    let newDy = dy;
    let orientationFlip = false;

    // Горизонтальные швы (влево/вправо) - всегда отражают в биомах ribbon, klein, projective
    const crossedLR = nx < 0 || nx >= MAP_WIDTH;
    if (crossedLR) {
        // Переход через горизонтальный шов
        nx = nx < 0 ? MAP_WIDTH - 1 : 0;
        ny = MAP_HEIGHT - 1 - ny; // Отражение по Y
        newDy = -newDy; // Инверсия направления по Y
        orientationFlip = true;
    }

    // Вертикальные швы (вверх/вниз)
    const crossedTB = ny < 0 || ny >= MAP_HEIGHT;
    if (crossedTB) {
        // В биоме ribbon вертикальные швы не отражают
        // В биоме klein и projective - отражают
        if (biome === 'klein' || biome === 'projective') {
            ny = ny < 0 ? MAP_HEIGHT - 1 : 0;
            nx = MAP_WIDTH - 1 - nx; // Отражение по X
            newDx = -newDx; // Инверсия направления по X
            orientationFlip = true;
        } else {
            // В ribbon просто зацикливаем без отражения
            ny = ny < 0 ? MAP_HEIGHT - 1 : 0;
        }
    }

    return {
        x: nx,
        y: ny,
        dx: newDx,
        dy: newDy,
        orientationFlip
    };
}

/**
 * Получает соседей клетки с учетом отражений
 */
export function getNeighbors(
    x: number,
    y: number,
    biome: Biome = 'klein'
): Array<{ x: number; y: number; orientationFlip: boolean }> {
    const neighbors: Array<{ x: number; y: number; orientationFlip: boolean }> = [];
    const directions = [
        { dx: 1, dy: 0 },  // вправо
        { dx: -1, dy: 0 }, // влево
        { dx: 0, dy: 1 },  // вниз
        { dx: 0, dy: -1 }  // вверх
    ];

    for (const dir of directions) {
        const result = step(x, y, dir.dx, dir.dy, biome);
        neighbors.push({
            x: result.x,
            y: result.y,
            orientationFlip: result.orientationFlip
        });
    }

    return neighbors;
}

/**
 * Вычисляет манхэттенское расстояние с учетом всех возможных отражений цели
 */
export function manhattanDistance(
    x1: number,
    y1: number,
    x2: number,
    y2: number
): number {
    const distances = [
        Math.abs(x1 - x2) + Math.abs(y1 - y2),
        Math.abs(x1 - (MAP_WIDTH - 1 - x2)) + Math.abs(y1 - y2),
        Math.abs(x1 - x2) + Math.abs(y1 - (MAP_HEIGHT - 1 - y2)),
        Math.abs(x1 - (MAP_WIDTH - 1 - x2)) + Math.abs(y1 - (MAP_HEIGHT - 1 - y2))
    ];
    return Math.min(...distances);
}

/**
 * Нормализует координаты в пределах карты
 */
export function normalizeCoords(x: number, y: number): { x: number; y: number } {
    return {
        x: ((x % MAP_WIDTH) + MAP_WIDTH) % MAP_WIDTH,
        y: ((y % MAP_HEIGHT) + MAP_HEIGHT) % MAP_HEIGHT
    };
}

