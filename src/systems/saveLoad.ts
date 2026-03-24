// Система сохранения и загрузки игры

import { GameState, Player, Entity, MapData } from '../core/types.js';

export interface SaveData {
    v: number; // Версия формата сохранения
    seed: number;
    floor: number;
    player: Player;
    map: {
        biome: string;
        tiles: any[][];
    };
    entities: Array<{
        t: string; // type
        x: number;
        y: number;
        hp?: number;
        maxHp?: number;
    }>;
}

/**
 * Сохраняет состояние игры в JSON формат
 */
export function saveGame(state: GameState): string {
    const saveData: SaveData = {
        v: 1,
        seed: state.seed,
        floor: state.floor,
        player: {
            x: state.player.x,
            y: state.player.y,
            orientation: state.player.orientation,
            hand: state.player.hand,
            hp: state.player.hp,
            maxHp: state.player.maxHp,
            torches: state.player.torches,
            inventory: [...state.player.inventory]
        },
        map: {
            biome: state.map.biome,
            tiles: state.map.tiles.map(row => 
                row.map(tile => ({
                    type: tile.type,
                    blocksMovement: tile.blocksMovement,
                    blocksLight: tile.blocksLight,
                    chiralDoor: tile.chiralDoor,
                    plate: tile.plate,
                    isSeam: tile.isSeam
                }))
            )
        },
        entities: state.entities.map(entity => ({
            t: entity.type,
            x: entity.x,
            y: entity.y,
            hp: entity.hp,
            maxHp: entity.maxHp
        }))
    };

    return JSON.stringify(saveData);
}

/**
 * Загружает состояние игры из JSON строки
 */
export function loadGame(jsonString: string): SaveData | null {
    try {
        const saveData: SaveData = JSON.parse(jsonString);
        
        // Проверяем версию
        if (saveData.v !== 1) {
            console.error('Несовместимая версия сохранения');
            return null;
        }

        return saveData;
    } catch (error) {
        console.error('Ошибка загрузки сохранения:', error);
        return null;
    }
}

/**
 * Сохраняет игру в localStorage
 */
export function saveToLocalStorage(state: GameState): boolean {
    try {
        const saveString = saveGame(state);
        localStorage.setItem('neurogue_save', saveString);
        return true;
    } catch (error) {
        console.error('Ошибка сохранения в localStorage:', error);
        return false;
    }
}

/**
 * Загружает игру из localStorage
 */
export function loadFromLocalStorage(): SaveData | null {
    try {
        const saveString = localStorage.getItem('neurogue_save');
        if (!saveString) {
            return null;
        }
        return loadGame(saveString);
    } catch (error) {
        console.error('Ошибка загрузки из localStorage:', error);
        return null;
    }
}

/**
 * Удаляет сохранение из localStorage
 */
export function deleteSave(): void {
    localStorage.removeItem('neurogue_save');
}

/**
 * Проверяет наличие сохранения
 */
export function hasSave(): boolean {
    return localStorage.getItem('neurogue_save') !== null;
}

