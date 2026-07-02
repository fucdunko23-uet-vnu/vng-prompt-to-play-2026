// ========================
// Physics: AABB Collision, Gravity, Ground Detection
// ========================

import { Entity, Platform, Projectile, Rect, Vector2 } from "./types";

export const GRAVITY = 1800;
export const MAX_FALL_SPEED = 900;

/** AABB overlap test between two rectangles */
export function aabbOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Get entity bounding rect */
export function getEntityRect(e: Entity | Projectile): Rect {
  return {
    x: e.position.x,
    y: e.position.y,
    width: e.width,
    height: e.height,
  };
}

/** Get attack hitbox rect (offset from entity based on facing) */
export function getAttackRect(e: Entity, range: number, height: number): Rect {
  const x = e.facing === 1 ? e.position.x + e.width : e.position.x - range;
  return {
    x,
    y: e.position.y + e.height * 0.2,
    width: range,
    height: height,
  };
}

/** Apply gravity to an entity */
export function applyGravity(entity: Entity, dt: number): void {
  if (!entity.isGrounded) {
    entity.velocity.y += GRAVITY * dt;
    // Clamp fall speed
    if (entity.velocity.y > MAX_FALL_SPEED) {
      entity.velocity.y = MAX_FALL_SPEED;
    }
  }
}

/** Move entity and resolve collisions with platforms
 *  dropThrough = true khi player bấm xuống → xuyên qua platform */
export function moveAndCollide(
  entity: Entity,
  platforms: Platform[],
  dt: number,
  dropThrough: boolean = false
): void {
  // Horizontal movement
  entity.position.x += entity.velocity.x * dt;
  resolveHorizontalCollisions(entity, platforms);

  // Lưu vị trí chân trước khi di chuyển dọc (để xác định one-way)
  const feetBeforeMove = entity.position.y + entity.height;

  // Vertical movement
  entity.position.y += entity.velocity.y * dt;
  entity.isGrounded = false;
  resolveVerticalCollisions(entity, platforms, feetBeforeMove, dropThrough);
}

function resolveHorizontalCollisions(
  entity: Entity,
  platforms: Platform[]
): void {
  const eRect = getEntityRect(entity);
  for (const p of platforms) {
    // Platform one-way: không block ngang
    if (p.type === "platform") continue;

    if (!aabbOverlap(eRect, p)) continue;

    if (entity.velocity.x > 0) {
      entity.position.x = p.x - entity.width;
    } else if (entity.velocity.x < 0) {
      entity.position.x = p.x + p.width;
    }
  }
}

function resolveVerticalCollisions(
  entity: Entity,
  platforms: Platform[],
  feetBeforeMove: number,
  dropThrough: boolean
): void {
  const eRect = getEntityRect(entity);
  for (const p of platforms) {
    if (!aabbOverlap(eRect, p)) continue;

    if (p.type === "platform") {
      // One-way platform: chỉ đáp từ trên xuống
      // Điều kiện: đang rơi (vy >= 0) VÀ chân trước khi di chuyển nằm trên hoặc sát mặt platform
      const wasAbove = feetBeforeMove <= p.y + 2; // +2 tolerance
      if (entity.velocity.y >= 0 && wasAbove && !dropThrough) {
        entity.position.y = p.y - entity.height;
        entity.velocity.y = 0;
        entity.isGrounded = true;
      }
      // Nhảy từ dưới lên hoặc drop-through → không chặn
    } else {
      // Ground / Wall: solid từ mọi hướng
      if (entity.velocity.y > 0) {
        entity.position.y = p.y - entity.height;
        entity.velocity.y = 0;
        entity.isGrounded = true;
      } else if (entity.velocity.y < 0) {
        entity.position.y = p.y + p.height;
        entity.velocity.y = 0;
      }
    }
  }
}

/** Clamp entity within map bounds */
export function clampToBounds(entity: Entity, bounds: Rect): void {
  if (entity.position.x < bounds.x) {
    entity.position.x = bounds.x;
    entity.velocity.x = 0;
  }
  if (entity.position.x + entity.width > bounds.x + bounds.width) {
    entity.position.x = bounds.x + bounds.width - entity.width;
    entity.velocity.x = 0;
  }
  // Floor clamp (fallback)
  if (entity.position.y + entity.height > bounds.y + bounds.height) {
    entity.position.y = bounds.y + bounds.height - entity.height;
    entity.velocity.y = 0;
    entity.isGrounded = true;
  }
}

/** Distance between two entities (center to center) */
export function entityDistance(a: Entity, b: Entity): number {
  const ax = a.position.x + a.width / 2;
  const ay = a.position.y + a.height / 2;
  const bx = b.position.x + b.width / 2;
  const by = b.position.y + b.height / 2;
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

/** Horizontal distance only */
export function horizontalDistance(a: Entity, b: Entity): number {
  const ax = a.position.x + a.width / 2;
  const bx = b.position.x + b.width / 2;
  return Math.abs(ax - bx);
}

/** Direction from a to b (-1 or 1) */
export function directionTo(from: Entity, to: Entity): 1 | -1 {
  const fx = from.position.x + from.width / 2;
  const tx = to.position.x + to.width / 2;
  return tx >= fx ? 1 : -1;
}
