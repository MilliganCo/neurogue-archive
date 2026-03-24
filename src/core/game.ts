// Игровой цикл и основная логика

import { GameState, Player, Entity, MapData, Tile, Biome, Orientation, Hand } from './types.js';
import { step } from './geometry.js';
import { calculateFOV, updateFog } from './fov.js';
import { generateMap, GenerationResult } from '../map/generator.js';
import { EntityManager } from '../entities/entityManager.js';
import { fireProjectile, meleeAttack, applyDamage } from '../systems/combat.js';
import { getEnemyAI, EnemyAction } from '../systems/enemyAI.js';
import { saveToLocalStorage, loadFromLocalStorage, SaveData } from '../systems/saveLoad.js';

const MAP_WIDTH = 10;
const MAP_HEIGHT = 10;

export class Game {
    private state: GameState;
    private exploredCells: Set<string> = new Set();
    private entityManager: EntityManager = new EntityManager();
    private lastMoveDirection: { dx: number; dy: number } = { dx: 1, dy: 0 }; // Направление последнего движения
    private activeTorches: number = 0; // Количество активных факелов

    constructor() {
        this.state = this.createInitialState();
    }

    private createInitialState(): GameState {
        const fog: { state: 'unseen' | 'explored' | 'visible' }[][] = [];
        for (let y = 0; y < MAP_HEIGHT; y++) {
            fog[y] = [];
            for (let x = 0; x < MAP_WIDTH; x++) {
                fog[y][x] = { state: 'unseen' };
            }
        }

        return {
            map: {
                width: MAP_WIDTH,
                height: MAP_HEIGHT,
                tiles: [],
                biome: 'klein',
                seed: 0
            },
            player: {
                x: 5,
                y: 5,
                orientation: 1,
                hand: 'L',
                hp: 6,
                maxHp: 6,
                torches: 4,
                inventory: []
            },
            entities: [],
            fog,
            floor: 1,
            seed: 0,
            exitX: undefined,
            exitY: undefined
        };
    }

    save(): boolean {
        return saveToLocalStorage(this.state);
    }

    load(): boolean {
        const saveData = loadFromLocalStorage();
        if (saveData) {
            return this.initFromSave(saveData);
        }
        return false;
    }

    init(): void {
        const seed = Math.floor(Math.random() * 1000000);
        this.state = this.createInitialState();
        this.state.seed = seed;
        this.activeTorches = 0; // Сбрасываем активные факелы
        
        const result: GenerationResult = generateMap('klein', seed);
        this.state.map = result.map;
        this.state.player.x = result.startX;
        this.state.player.y = result.startY;
        this.state.exitX = result.exitX;
        this.state.exitY = result.exitY;
        
        // Добавляем сущности в менеджер
        this.entityManager.clear();
        for (const entity of result.entities) {
            this.entityManager.addEntity(entity);
        }
        this.state.entities = result.entities;
        
        // Очищаем exploredCells перед обновлением FOV
        this.exploredCells.clear();
        this.updateFOV();
        
        console.log('Игра инициализирована:', {
            playerPos: { x: this.state.player.x, y: this.state.player.y },
            mapSize: { width: this.state.map.width, height: this.state.map.height },
            entities: this.state.entities.length,
            visibleCells: Array.from(this.exploredCells).length
        });
    }

    initFromSave(saveData: SaveData): boolean {
        try {
            // Восстанавливаем состояние из сохранения
            this.state.seed = saveData.seed;
            this.state.floor = saveData.floor;
            this.state.player = { ...saveData.player };
            this.activeTorches = 0; // Сбрасываем активные факелы при загрузке
            
            // Восстанавливаем карту
            this.state.map = {
                width: MAP_WIDTH,
                height: MAP_HEIGHT,
                tiles: saveData.map.tiles.map(row => 
                    row.map(tile => ({
                        type: tile.type as Tile['type'],
                        blocksMovement: tile.blocksMovement,
                        blocksLight: tile.blocksLight,
                        chiralDoor: tile.chiralDoor,
                        plate: tile.plate,
                        isSeam: tile.isSeam
                    }))
                ),
                biome: saveData.map.biome as Biome,
                seed: saveData.seed
            };
            
            // Восстанавливаем сущности
            this.entityManager.clear();
            this.state.entities = saveData.entities.map(e => ({
                id: `${e.t}_${Math.random()}`,
                x: e.x,
                y: e.y,
                type: e.t as Entity['type'],
                blocksMovement: e.t === 'chameleon' || e.t === 'guard' || e.t === 'archer' || e.t === 'slime',
                blocksLight: false,
                hp: e.hp,
                maxHp: e.maxHp
            }));
            
            for (const entity of this.state.entities) {
                this.entityManager.addEntity(entity);
            }
            
            // Восстанавливаем туман войны
            this.exploredCells.clear();
            this.updateFOV();
            
            return true;
        } catch (error) {
            console.error('Ошибка загрузки сохранения:', error);
            return false;
        }
    }

    nextFloor(): void {
        // Переход на следующий этаж
        this.state.floor++;
        this.activeTorches = 0; // Сбрасываем активные факелы
        
        // Выбираем биом в зависимости от этажа
        let biome: Biome = 'klein';
        if (this.state.floor === 1) {
            biome = 'ribbon'; // Первый этаж - обучающий
        } else if (this.state.floor <= 5) {
            biome = 'klein'; // Основные этажи
        } else {
            biome = 'projective'; // Сложные этажи
        }
        
        // Генерируем новый этаж
        const seed = this.state.seed + this.state.floor; // Детерминированный seed для каждого этажа
        const result: GenerationResult = generateMap(biome, seed);
        
        this.state.map = result.map;
        this.state.player.x = result.startX;
        this.state.player.y = result.startY;
        this.state.exitX = result.exitX;
        this.state.exitY = result.exitY;
        
        // Сохраняем инвентарь и здоровье игрока
        // Можно добавить восстановление здоровья или другие бонусы
        
        // Очищаем сущности и добавляем новые
        this.entityManager.clear();
        for (const entity of result.entities) {
            this.entityManager.addEntity(entity);
        }
        this.state.entities = result.entities;
        
        // Сбрасываем туман войны
        this.exploredCells.clear();
        this.updateFOV();
    }

    checkExit(): boolean {
        // Проверяем, находится ли игрок на выходе
        if (this.state.exitX !== undefined && this.state.exitY !== undefined) {
            return this.state.player.x === this.state.exitX && 
                   this.state.player.y === this.state.exitY;
        }
        return false;
    }

    getState(): GameState {
        return this.state;
    }

    getPlayer(): Player {
        return this.state.player;
    }

    getMap(): MapData {
        return this.state.map;
    }

    movePlayer(dx: number, dy: number): void {
        const player = this.state.player;
        const result = step(player.x, player.y, dx, dy, this.state.map.biome);

        // Сохраняем направление для стрельбы
        this.lastMoveDirection = { dx, dy };

        // Проверяем возможность движения
        if (this.canMoveTo(result.x, result.y)) {
            // Проверяем хиральную дверь
            const tile = this.state.map.tiles[result.y][result.x];
            if (tile.type === 'door' && tile.chiralDoor) {
                if (!this.canOpenDoor(tile.chiralDoor, player)) {
                    return; // Дверь закрыта
                }
                // Открываем дверь
                tile.blocksMovement = false;
            }

            player.x = result.x;
            player.y = result.y;

            // Инвертируем ориентацию при переходе через отражающий шов
            if (result.orientationFlip) {
                player.orientation = (player.orientation * -1) as Orientation;
            }

            // Проверяем взаимодействие с предметами и плитами
            this.checkInteractions(result.x, result.y);

            // Проверяем выход на следующий этаж
            if (this.checkExit()) {
                this.nextFloor();
                return;
            }

            this.updateFOV();
            this.processEnemyTurns();
        }
    }

    wait(): void {
        this.processEnemyTurns();
    }

    shoot(): void {
        const player = this.state.player;
        
        // Стреляем в направлении последнего движения
        const dx = this.lastMoveDirection.dx;
        const dy = this.lastMoveDirection.dy;
        
        const result = fireProjectile(
            player.x,
            player.y,
            dx,
            dy,
            1, // Урон стрелы
            'player',
            6, // Дальность
            this.state.map.biome,
            this.entityManager,
            this.state.map.tiles
        );
        
        if (result.hit && result.target && result.damage) {
            const isDead = applyDamage(result.target, result.damage);
            
            if (isDead) {
                // Удаляем мертвого врага
                this.entityManager.removeEntity(result.target.id);
                this.state.entities = this.state.entities.filter(e => e.id !== result.target!.id);
            } else {
                // Обновляем сущность
                this.entityManager.updateEntity(result.target);
                const index = this.state.entities.findIndex(e => e.id === result.target!.id);
                if (index !== -1) {
                    this.state.entities[index] = result.target;
                }
            }
        }
        
        this.processEnemyTurns();
    }

    shootDirection(dx: number, dy: number): void {
        // Устанавливаем направление и стреляем
        this.lastMoveDirection = { dx, dy };
        this.shoot();
    }

    useRune(): void {
        if (this.state.player.inventory.includes('rune')) {
            // Инвертируем ориентацию без движения
            this.state.player.orientation = (this.state.player.orientation * -1) as Orientation;
            this.state.player.inventory = this.state.player.inventory.filter(item => item !== 'rune');
            this.updateFOV();
        }
    }

    switchHand(): void {
        this.state.player.hand = this.state.player.hand === 'L' ? 'R' : 'L';
    }

    private canMoveTo(x: number, y: number): boolean {
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
            return false;
        }

        const tile = this.state.map.tiles[y][x];
        // Двери проверяются отдельно в movePlayer
        if (tile.blocksMovement && tile.type !== 'door') {
            return false;
        }

        // Проверяем сущности через EntityManager
        if (this.entityManager.isBlocked(x, y)) {
            return false;
        }

        return true;
    }

    private canOpenDoor(door: { requiredHand: Hand; requiredOrientation?: Orientation; marked?: boolean }, player: Player): boolean {
        // Хиральная метка пропускает независимо от s
        if (door.marked) {
            return true;
        }

        // Проверяем руку
        if (door.requiredHand !== player.hand) {
            return false;
        }

        // Проверяем ориентацию если требуется
        if (door.requiredOrientation !== undefined && door.requiredOrientation !== player.orientation) {
            return false;
        }

        return true;
    }

    private checkInteractions(x: number, y: number): void {
        const entities = this.entityManager.getEntitiesAt(x, y);
        const player = this.state.player;

        for (const entity of entities) {
            // Подбираем предметы
            if (entity.type === 'keyL' || entity.type === 'keyR') {
                const keyType = entity.type === 'keyL' ? 'keyL' : 'keyR';
                if (!player.inventory.includes(keyType)) {
                    player.inventory.push(keyType);
                    this.entityManager.removeEntity(entity.id);
                    this.state.entities = this.state.entities.filter(e => e.id !== entity.id);
                }
            } else if (entity.type === 'torch') {
                player.torches++;
                this.entityManager.removeEntity(entity.id);
                this.state.entities = this.state.entities.filter(e => e.id !== entity.id);
            } else if (entity.type === 'rune') {
                if (!player.inventory.includes('rune')) {
                    player.inventory.push('rune');
                }
                this.entityManager.removeEntity(entity.id);
                this.state.entities = this.state.entities.filter(e => e.id !== entity.id);
            } else if (entity.type === 'potion') {
                player.hp = Math.min(player.hp + 2, player.maxHp);
                this.entityManager.removeEntity(entity.id);
                this.state.entities = this.state.entities.filter(e => e.id !== entity.id);
            }
        }

        // Проверяем плиты
        const tile = this.state.map.tiles[y][x];
        if (tile.type === 'plate' && tile.plate) {
            // Плита активируется при правильной комбинации руки и ориентации
            const canActivate = tile.plate.requiredHand === player.hand &&
                (tile.plate.requiredOrientation === undefined || tile.plate.requiredOrientation === player.orientation);
            
            if (canActivate) {
                // TODO: Активация плиты (открытие дверей, запуск механизмов)
                console.log('Plate activated!');
            }
        }
    }

    useTorch(): boolean {
        if (this.state.player.torches > 0) {
            this.state.player.torches--;
            this.activeTorches++;
            this.updateFOV();
            return true;
        }
        return false;
    }

    getTorchRadius(): number {
        // Каждый активный факел дает +2 к радиусу
        return this.activeTorches * 2;
    }

    private updateFOV(): void {
        const torchRadius = this.getTorchRadius();
        const visible = calculateFOV(
            this.state.player.x,
            this.state.player.y,
            6, // Базовый радиус зрения
            torchRadius, // Дополнительный радиус от факелов
            this.state.map.biome,
            this.state.map.tiles
        );

        updateFog(this.state.fog, visible, this.exploredCells);
    }

    private processEnemyTurns(): void {
        const player = this.state.player;
        const enemies = this.entityManager.getEntitiesByType('chameleon')
            .concat(this.entityManager.getEntitiesByType('guard'))
            .concat(this.entityManager.getEntitiesByType('archer'))
            .concat(this.entityManager.getEntitiesByType('slime'));

        for (const enemy of enemies) {
            if (enemy.hp === undefined || enemy.hp <= 0) {
                continue; // Пропускаем мертвых врагов
            }

            const ai = getEnemyAI(enemy.type);
            if (!ai) {
                continue;
            }

            const action = ai.think(
                enemy,
                { x: player.x, y: player.y, orientation: player.orientation },
                this.state.map.biome,
                this.entityManager,
                this.state.map.tiles
            );

            this.executeEnemyAction(enemy, action);
        }
    }

    private executeEnemyAction(enemy: Entity, action: EnemyAction): void {
        switch (action.type) {
            case 'move':
                if (action.dx !== undefined && action.dy !== undefined) {
                    const result = step(enemy.x, enemy.y, action.dx, action.dy, this.state.map.biome);
                    
                    if (!this.state.map.tiles[result.y][result.x].blocksMovement &&
                        !this.entityManager.isBlocked(result.x, result.y, enemy.id)) {
                        this.entityManager.moveEntity(enemy.id, result.x, result.y);
                        const index = this.state.entities.findIndex(e => e.id === enemy.id);
                        if (index !== -1) {
                            this.state.entities[index].x = result.x;
                            this.state.entities[index].y = result.y;
                        }
                    }
                }
                break;

            case 'attack':
                if (action.targetX !== undefined && action.targetY !== undefined) {
                    const damage = enemy.type === 'slime' ? 2 : 1; // Слизь наносит больше урона
                    const result = meleeAttack(
                        enemy.x,
                        enemy.y,
                        action.targetX,
                        action.targetY,
                        damage,
                        enemy.id,
                        this.entityManager
                    );

                    if (result.hit && result.target && result.damage) {
                        // Проверяем, это игрок или другой враг
                        if (result.target.type === 'player') {
                            // Урон игроку
                            this.state.player.hp = Math.max(0, this.state.player.hp - result.damage);
                            
                            if (this.state.player.hp === 0) {
                                // Игрок умер - можно добавить экран смерти
                                console.log('Game Over!');
                            }
                        } else {
                            // Урон другому врагу (редко, но возможно)
                            const isDead = applyDamage(result.target, result.damage);
                            if (isDead) {
                                this.entityManager.removeEntity(result.target.id);
                                this.state.entities = this.state.entities.filter(e => e.id !== result.target!.id);
                            }
                        }
                    }
                }
                break;

            case 'shoot':
                if (action.dx !== undefined && action.dy !== undefined) {
                    const damage = 1;
                    const result = fireProjectile(
                        enemy.x,
                        enemy.y,
                        action.dx,
                        action.dy,
                        damage,
                        enemy.id,
                        6,
                        this.state.map.biome,
                        this.entityManager,
                        this.state.map.tiles
                    );

                    if (result.hit && result.target && result.damage) {
                        if (result.target.type === 'player') {
                            // Урон игроку
                            this.state.player.hp = Math.max(0, this.state.player.hp - result.damage);
                            
                            if (this.state.player.hp === 0) {
                                console.log('Game Over!');
                            }
                        } else {
                            // Урон другой сущности
                            const isDead = applyDamage(result.target, result.damage);
                            if (isDead) {
                                this.entityManager.removeEntity(result.target.id);
                                this.state.entities = this.state.entities.filter(e => e.id !== result.target!.id);
                            }
                        }
                    }
                }
                break;

            case 'wait':
                // Враг ничего не делает
                break;
        }
    }
}

