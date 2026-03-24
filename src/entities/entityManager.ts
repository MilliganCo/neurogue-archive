// Система сущностей (базовый ECS)

import { Entity, EntityType, Position } from '../core/types.js';

export class EntityManager {
    private entities: Map<string, Entity> = new Map();
    private entitiesByPosition: Map<string, Entity[]> = new Map();
    private entitiesByType: Map<EntityType, Entity[]> = new Map();

    addEntity(entity: Entity): void {
        this.entities.set(entity.id, entity);
        
        // Индексируем по позиции
        const posKey = `${entity.x},${entity.y}`;
        if (!this.entitiesByPosition.has(posKey)) {
            this.entitiesByPosition.set(posKey, []);
        }
        this.entitiesByPosition.get(posKey)!.push(entity);
        
        // Индексируем по типу
        if (!this.entitiesByType.has(entity.type)) {
            this.entitiesByType.set(entity.type, []);
        }
        this.entitiesByType.get(entity.type)!.push(entity);
    }

    removeEntity(id: string): boolean {
        const entity = this.entities.get(id);
        if (!entity) return false;

        this.entities.delete(id);
        
        // Удаляем из индекса позиций
        const posKey = `${entity.x},${entity.y}`;
        const posEntities = this.entitiesByPosition.get(posKey);
        if (posEntities) {
            const index = posEntities.findIndex(e => e.id === id);
            if (index !== -1) {
                posEntities.splice(index, 1);
            }
            if (posEntities.length === 0) {
                this.entitiesByPosition.delete(posKey);
            }
        }
        
        // Удаляем из индекса типов
        const typeEntities = this.entitiesByType.get(entity.type);
        if (typeEntities) {
            const index = typeEntities.findIndex(e => e.id === id);
            if (index !== -1) {
                typeEntities.splice(index, 1);
            }
        }
        
        return true;
    }

    getEntity(id: string): Entity | undefined {
        return this.entities.get(id);
    }

    getEntitiesAt(x: number, y: number): Entity[] {
        const posKey = `${x},${y}`;
        return this.entitiesByPosition.get(posKey) || [];
    }

    getEntitiesByType(type: EntityType): Entity[] {
        return this.entitiesByType.get(type) || [];
    }

    getAllEntities(): Entity[] {
        return Array.from(this.entities.values());
    }

    moveEntity(id: string, newX: number, newY: number): boolean {
        const entity = this.entities.get(id);
        if (!entity) return false;

        const oldPosKey = `${entity.x},${entity.y}`;
        const newPosKey = `${newX},${newY}`;

        // Удаляем из старой позиции
        const oldPosEntities = this.entitiesByPosition.get(oldPosKey);
        if (oldPosEntities) {
            const index = oldPosEntities.findIndex(e => e.id === id);
            if (index !== -1) {
                oldPosEntities.splice(index, 1);
            }
            if (oldPosEntities.length === 0) {
                this.entitiesByPosition.delete(oldPosKey);
            }
        }

        // Добавляем в новую позицию
        if (!this.entitiesByPosition.has(newPosKey)) {
            this.entitiesByPosition.set(newPosKey, []);
        }
        this.entitiesByPosition.get(newPosKey)!.push(entity);

        // Обновляем позицию сущности
        entity.x = newX;
        entity.y = newY;

        return true;
    }

    updateEntity(entity: Entity): boolean {
        if (!this.entities.has(entity.id)) {
            return false;
        }
        
        // Если позиция изменилась, нужно обновить индексы
        const oldEntity = this.entities.get(entity.id)!;
        if (oldEntity.x !== entity.x || oldEntity.y !== entity.y) {
            this.moveEntity(entity.id, entity.x, entity.y);
        }
        
        // Обновляем сущность
        this.entities.set(entity.id, entity);
        
        // Обновляем индекс типов если тип изменился
        if (oldEntity.type !== entity.type) {
            const oldTypeEntities = this.entitiesByType.get(oldEntity.type);
            if (oldTypeEntities) {
                const index = oldTypeEntities.findIndex(e => e.id === entity.id);
                if (index !== -1) {
                    oldTypeEntities.splice(index, 1);
                }
            }
            
            if (!this.entitiesByType.has(entity.type)) {
                this.entitiesByType.set(entity.type, []);
            }
            this.entitiesByType.get(entity.type)!.push(entity);
        }
        
        return true;
    }

    clear(): void {
        this.entities.clear();
        this.entitiesByPosition.clear();
        this.entitiesByType.clear();
    }

    // Проверка блокировки движения в позиции
    isBlocked(x: number, y: number, excludeId?: string): boolean {
        const entities = this.getEntitiesAt(x, y);
        return entities.some(e => e.blocksMovement && e.id !== excludeId);
    }

    // Получить все блокирующие сущности в позиции
    getBlockingEntities(x: number, y: number, excludeId?: string): Entity[] {
        return this.getEntitiesAt(x, y).filter(
            e => e.blocksMovement && e.id !== excludeId
        );
    }
}

