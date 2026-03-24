// Базовые типы и интерфейсы

export type Orientation = 1 | -1; // +1 или -1

export type Hand = 'L' | 'R';

export type Biome = 'ribbon' | 'klein' | 'projective';

export interface Position {
    x: number;
    y: number;
}

export interface Direction {
    dx: number;
    dy: number;
}

export interface StepResult {
    x: number;
    y: number;
    dx: number;
    dy: number;
    orientationFlip: boolean;
}

export type TileType = 'floor' | 'wall' | 'door' | 'plate' | 'seam';

export interface Tile {
    type: TileType;
    blocksMovement: boolean;
    blocksLight: boolean;
    chiralDoor?: {
        requiredHand: Hand;
        requiredOrientation?: Orientation;
        marked?: boolean; // Хиральная метка - пропускает независимо от s
    };
    plate?: {
        requiredHand: Hand;
        requiredOrientation?: Orientation;
    };
    isSeam?: boolean; // Шлюз-шов (не инвертирует s)
}

export interface MapData {
    width: number;
    height: number;
    tiles: Tile[][];
    biome: Biome;
    seed: number;
}

export interface Entity {
    id: string;
    x: number;
    y: number;
    type: EntityType;
    blocksMovement: boolean;
    blocksLight: boolean;
    hp?: number;
    maxHp?: number;
}

export type EntityType = 
    | 'player'
    | 'chameleon'
    | 'guard'
    | 'archer'
    | 'slime'
    | 'keyL'
    | 'keyR'
    | 'torch'
    | 'rune'
    | 'potion';

export interface Player {
    x: number;
    y: number;
    orientation: Orientation;
    hand: Hand;
    hp: number;
    maxHp: number;
    torches: number;
    inventory: string[];
}

export interface FogState {
    state: 'unseen' | 'explored' | 'visible';
}

export interface GameState {
    map: MapData;
    player: Player;
    entities: Entity[];
    fog: FogState[][];
    floor: number;
    seed: number;
    exitX?: number;
    exitY?: number;
}

