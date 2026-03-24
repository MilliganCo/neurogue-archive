// Улучшенная генерация карты с хиральными элементами

import { MapData, Tile, Biome, Hand, Orientation, Entity, EntityType } from '../core/types.js';
import { step } from '../core/geometry.js';

const MAP_WIDTH = 10;
const MAP_HEIGHT = 10;

// Простой PRNG на основе seed
class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    random(): number {
        return this.next();
    }

    randomInt(min: number, max: number): number {
        return Math.floor(this.random() * (max - min + 1)) + min;
    }

    randomChoice<T>(array: T[]): T {
        return array[this.randomInt(0, array.length - 1)];
    }
}

export interface GenerationResult {
    map: MapData;
    entities: Entity[];
    startX: number;
    startY: number;
    exitX: number;
    exitY: number;
}

export function generateMap(biome: Biome, seed: number): GenerationResult {
    const rng = new SeededRandom(seed);
    const tiles: Tile[][] = [];

    // Инициализируем все тайлы как пол
    for (let y = 0; y < MAP_HEIGHT; y++) {
        tiles[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            tiles[y][x] = {
                type: 'floor',
                blocksMovement: false,
                blocksLight: false
            };
        }
    }

    // Генерация стен с учетом связности
    generateWalls(tiles, rng, biome);

    // Размещаем стартовую позицию и выход
    const startPos = findStartPosition(tiles, rng);
    const exitPos = findExitPosition(tiles, rng, startPos.x, startPos.y);

    // Размещаем хиральные двери
    const doors = placeChiralDoors(tiles, rng, biome, startPos, exitPos);

    // Размещаем плиты-триггеры
    placePlates(tiles, rng, biome);

    // Размещаем ключи L/R с зеркальными парами
    const keys = placeKeys(tiles, rng, biome, doors);

    // Размещаем предметы
    const items = placeItems(tiles, rng, startPos);

    // Размещаем врагов
    const enemies = placeEnemies(tiles, rng, startPos, exitPos);

    // Гарантируем путь к выходу
    ensurePathToExit(tiles, startPos.x, startPos.y, exitPos.x, exitPos.y, biome);

    const entities: Entity[] = [
        ...keys,
        ...items,
        ...enemies
    ];

    return {
        map: {
            width: MAP_WIDTH,
            height: MAP_HEIGHT,
            tiles,
            biome,
            seed
        },
        entities,
        startX: startPos.x,
        startY: startPos.y,
        exitX: exitPos.x,
        exitY: exitPos.y
    };
}

function generateWalls(tiles: Tile[][], rng: SeededRandom, biome: Biome): void {
    // Генерируем стены более структурированно
    const wallCount = rng.randomInt(12, 20);
    const placed = new Set<string>();
    
    for (let i = 0; i < wallCount; i++) {
        let attempts = 0;
        while (attempts < 50) {
            const x = rng.randomInt(0, MAP_WIDTH - 1);
            const y = rng.randomInt(0, MAP_HEIGHT - 1);
            const key = `${x},${y}`;
            
            // Не ставим стены в центре (резерв для старта)
            if (!placed.has(key) && (Math.abs(x - 5) > 2 || Math.abs(y - 5) > 2)) {
                tiles[y][x] = {
                    type: 'wall',
                    blocksMovement: true,
                    blocksLight: true
                };
                placed.add(key);
                break;
            }
            attempts++;
        }
    }
}

function findStartPosition(tiles: Tile[][], rng: SeededRandom): { x: number; y: number } {
    // Ищем свободную клетку в центре
    const candidates: Array<{ x: number; y: number }> = [];
    for (let y = 3; y < 7; y++) {
        for (let x = 3; x < 7; x++) {
            if (!tiles[y][x].blocksMovement) {
                candidates.push({ x, y });
            }
        }
    }
    
    if (candidates.length > 0) {
        return rng.randomChoice(candidates);
    }
    
    // Fallback - ищем любую свободную клетку
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (!tiles[y][x].blocksMovement) {
                return { x, y };
            }
        }
    }
    
    return { x: 5, y: 5 };
}

function findExitPosition(tiles: Tile[][], rng: SeededRandom, startX: number, startY: number): { x: number; y: number } {
    // Выход должен быть подальше от старта
    const candidates: Array<{ x: number; y: number }> = [];
    
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (!tiles[y][x].blocksMovement) {
                const dist = Math.abs(x - startX) + Math.abs(y - startY);
                if (dist >= 6) {
                    candidates.push({ x, y });
                }
            }
        }
    }
    
    if (candidates.length > 0) {
        return rng.randomChoice(candidates);
    }
    
    // Fallback - противоположный угол
    return { x: MAP_WIDTH - 1 - startX, y: MAP_HEIGHT - 1 - startY };
}

function placeChiralDoors(
    tiles: Tile[][],
    rng: SeededRandom,
    biome: Biome,
    startPos: { x: number; y: number },
    exitPos: { x: number; y: number }
): Array<{ x: number; y: number; hand: Hand }> {
    const doors: Array<{ x: number; y: number; hand: Hand }> = [];
    const doorCount = rng.randomInt(2, 4);
    
    for (let i = 0; i < doorCount; i++) {
        let attempts = 0;
        while (attempts < 50) {
            const x = rng.randomInt(0, MAP_WIDTH - 1);
            const y = rng.randomInt(0, MAP_HEIGHT - 1);
            
            // Не ставим двери на старте, выходе или стенах
            if ((x === startPos.x && y === startPos.y) ||
                (x === exitPos.x && y === exitPos.y) ||
                tiles[y][x].blocksMovement) {
                attempts++;
                continue;
            }
            
            const hand: Hand = rng.random() < 0.5 ? 'L' : 'R';
            const requiredOrientation: Orientation | undefined = rng.random() < 0.5 ? undefined : (rng.random() < 0.5 ? 1 : -1);
            const marked = rng.random() < 0.2; // 20% шанс хиральной метки
            
            tiles[y][x] = {
                type: 'door',
                blocksMovement: true,
                blocksLight: false,
                chiralDoor: {
                    requiredHand: hand,
                    requiredOrientation,
                    marked
                }
            };
            
            doors.push({ x, y, hand });
            break;
        }
    }
    
    return doors;
}

function placePlates(tiles: Tile[][], rng: SeededRandom, biome: Biome): void {
    const plateCount = rng.randomInt(1, 3);
    
    for (let i = 0; i < plateCount; i++) {
        let attempts = 0;
        while (attempts < 50) {
            const x = rng.randomInt(0, MAP_WIDTH - 1);
            const y = rng.randomInt(0, MAP_HEIGHT - 1);
            
            if (tiles[y][x].blocksMovement || tiles[y][x].type === 'door') {
                attempts++;
                continue;
            }
            
            const hand: Hand = rng.random() < 0.5 ? 'L' : 'R';
            const requiredOrientation: Orientation | undefined = rng.random() < 0.5 ? undefined : (rng.random() < 0.5 ? 1 : -1);
            
            tiles[y][x].type = 'plate';
            tiles[y][x].plate = {
                requiredHand: hand,
                requiredOrientation
            };
            
            break;
        }
    }
}

function placeKeys(
    tiles: Tile[][],
    rng: SeededRandom,
    biome: Biome,
    doors: Array<{ x: number; y: number; hand: Hand }>
): Entity[] {
    const keys: Entity[] = [];
    const keyPositions = new Set<string>();
    
    // Размещаем ключи L и R
    for (const hand of ['L', 'R'] as Hand[]) {
        let attempts = 0;
        while (attempts < 50) {
            const x = rng.randomInt(0, MAP_WIDTH - 1);
            const y = rng.randomInt(0, MAP_HEIGHT - 1);
            const key = `${x},${y}`;
            
            if (!tiles[y][x].blocksMovement && 
                tiles[y][x].type === 'floor' &&
                !keyPositions.has(key)) {
                
                const entityType: EntityType = hand === 'L' ? 'keyL' : 'keyR';
                keys.push({
                    id: `key_${hand}_${keys.length}`,
                    x,
                    y,
                    type: entityType,
                    blocksMovement: false,
                    blocksLight: false
                });
                
                keyPositions.add(key);
                break;
            }
            attempts++;
        }
    }
    
    return keys;
}

function placeItems(tiles: Tile[][], rng: SeededRandom, startPos: { x: number; y: number }): Entity[] {
    const items: Entity[] = [];
    const itemCount = rng.randomInt(3, 6);
    const itemTypes: Array<{ type: EntityType; weight: number }> = [
        { type: 'torch', weight: 40 },
        { type: 'rune', weight: 30 },
        { type: 'potion', weight: 30 }
    ];
    
    for (let i = 0; i < itemCount; i++) {
        let attempts = 0;
        while (attempts < 50) {
            const x = rng.randomInt(0, MAP_WIDTH - 1);
            const y = rng.randomInt(0, MAP_HEIGHT - 1);
            
            // Не ставим предметы на старте, стенах или дверях
            if ((x === startPos.x && y === startPos.y) ||
                tiles[y][x].blocksMovement ||
                tiles[y][x].type === 'door') {
                attempts++;
                continue;
            }
            
            // Проверяем, нет ли уже предмета здесь
            const hasItem = items.some(item => item.x === x && item.y === y);
            if (hasItem) {
                attempts++;
                continue;
            }
            
            // Выбираем тип предмета по весам
            const rand = rng.random() * 100;
            let cumulative = 0;
            let selectedType: EntityType = 'torch';
            for (const item of itemTypes) {
                cumulative += item.weight;
                if (rand <= cumulative) {
                    selectedType = item.type;
                    break;
                }
            }
            
            items.push({
                id: `item_${selectedType}_${items.length}`,
                x,
                y,
                type: selectedType,
                blocksMovement: false,
                blocksLight: false
            });
            
            break;
        }
    }
    
    return items;
}

function placeEnemies(
    tiles: Tile[][],
    rng: SeededRandom,
    startPos: { x: number; y: number },
    exitPos: { x: number; y: number }
): Entity[] {
    const enemies: Entity[] = [];
    const enemyCount = rng.randomInt(3, 6);
    const enemyTypes: Array<{ type: EntityType; weight: number; hp: number }> = [
        { type: 'chameleon', weight: 40, hp: 2 },
        { type: 'archer', weight: 30, hp: 2 },
        { type: 'guard', weight: 20, hp: 3 },
        { type: 'slime', weight: 10, hp: 1 }
    ];
    
    for (let i = 0; i < enemyCount; i++) {
        let attempts = 0;
        while (attempts < 50) {
            const x = rng.randomInt(0, MAP_WIDTH - 1);
            const y = rng.randomInt(0, MAP_HEIGHT - 1);
            
            // Не ставим врагов на старте, выходе, стенах или дверях
            if ((x === startPos.x && y === startPos.y) ||
                (x === exitPos.x && y === exitPos.y) ||
                tiles[y][x].blocksMovement ||
                tiles[y][x].type === 'door') {
                attempts++;
                continue;
            }
            
            // Проверяем, нет ли уже врага здесь
            const hasEnemy = enemies.some(e => e.x === x && e.y === y);
            if (hasEnemy) {
                attempts++;
                continue;
            }
            
            // Выбираем тип врага по весам
            const rand = rng.random() * 100;
            let cumulative = 0;
            let selectedEnemy = enemyTypes[0];
            for (const enemy of enemyTypes) {
                cumulative += enemy.weight;
                if (rand <= cumulative) {
                    selectedEnemy = enemy;
                    break;
                }
            }
            
            enemies.push({
                id: `enemy_${selectedEnemy.type}_${enemies.length}`,
                x,
                y,
                type: selectedEnemy.type,
                blocksMovement: true,
                blocksLight: false,
                hp: selectedEnemy.hp,
                maxHp: selectedEnemy.hp
            });
            
            break;
        }
    }
    
    return enemies;
}

function ensurePathToExit(
    tiles: Tile[][],
    startX: number,
    startY: number,
    exitX: number,
    exitY: number,
    biome: Biome
): void {
    // BFS для проверки пути с учетом швов
    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number; path: Array<{ x: number; y: number }> }> = [
        { x: startX, y: startY, path: [{ x: startX, y: startY }] }
    ];
    visited.add(`${startX},${startY}`);
    
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    
    while (queue.length > 0) {
        const current = queue.shift()!;
        
        if (current.x === exitX && current.y === exitY) {
            // Путь найден
            return;
        }
        
        for (const [dx, dy] of directions) {
            const result = step(current.x, current.y, dx, dy, biome);
            const key = `${result.x},${result.y}`;
            
            if (!visited.has(key) && !tiles[result.y][result.x].blocksMovement) {
                visited.add(key);
                queue.push({
                    x: result.x,
                    y: result.y,
                    path: [...current.path, { x: result.x, y: result.y }]
                });
            }
        }
    }
    
    // Если путь не найден, убираем препятствия на прямой линии
    const path = findDirectPath(startX, startY, exitX, exitY, tiles);
    for (const pos of path) {
        if (tiles[pos.y][pos.x].blocksMovement && tiles[pos.y][pos.x].type !== 'door') {
            tiles[pos.y][pos.x] = {
                type: 'floor',
                blocksMovement: false,
                blocksLight: false
            };
        }
    }
}

function findDirectPath(
    startX: number,
    startY: number,
    exitX: number,
    exitY: number,
    tiles: Tile[][]
): Array<{ x: number; y: number }> {
    const path: Array<{ x: number; y: number }> = [];
    let x = startX;
    let y = startY;
    
    while (x !== exitX || y !== exitY) {
        path.push({ x, y });
        
        if (x < exitX) x++;
        else if (x > exitX) x--;
        else if (y < exitY) y++;
        else if (y > exitY) y--;
        else break;
    }
    
    path.push({ x: exitX, y: exitY });
    return path;
}
