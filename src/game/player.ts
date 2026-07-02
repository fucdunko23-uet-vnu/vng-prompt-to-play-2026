// ========================
// Player Entity: Movement, Jump, Attack, Dash
// ========================

import { InputState, Particle, PlayerState, Projectile } from "./types";
import { applyGravity, moveAndCollide, clampToBounds, getAttackRect, aabbOverlap, getEntityRect } from "./physics";
import { BossState, MapData } from "./types";
import { sfx } from "./audio";

// Player constants
const MAX_MOVE_SPEED = 350;
const ACCELERATION = 2500;
const FRICTION = 1800;
const AIR_FRICTION = 800;
const JUMP_FORCE = -640;
const MELEE_DAMAGE = 35;
const RANGED_DAMAGE = 20;
const MELEE_RANGE = 55;
const MELEE_COOLDOWN = 0.35;
const RANGED_COOLDOWN = 0.6;
const DASH_SPEED = 450;
const DASH_DURATION = 0.4;
const DASH_COOLDOWN = 1.0;
const INVINCIBLE_AFTER_DASH = 0.1;
const PROJECTILE_SPEED = 500;

export function createPlayer(x: number, y: number): PlayerState {
  return {
    position: { x, y },
    velocity: { x: 0, y: 0 },
    width: 32,
    height: 48,
    health: 300,
    maxHealth: 300,
    baseDamage: MELEE_DAMAGE,
    baseRangedDamage: RANGED_DAMAGE,
    maxDashCooldown: DASH_COOLDOWN,
    facing: 1,
    isGrounded: false,
    attackCooldown: 0,
    rangedCooldown: 0,
    dashCooldown: 0,
    isDashing: false,
    dashTimer: 0,
    invincibleTimer: 0,
    isAttacking: false,
    isBlocking: false,
    attackTimer: 0,
    comboCount: 0,
    score: 0,
    jumpCount: 0,
    maxJumps: 2,
    animState: "idle",
    animTimer: 0,
    hasLifesteal: false,
    hasTripleShot: false,
    hasReflectiveShield: false,
    hasExecute: false,
    hasFireAura: false,
    hasSlowAura: false,
    hasVampiricDash: false,
    hasGiantSword: false,
    deathCount: 0,
  };
}

function setPlayerAnim(player: PlayerState, anim: PlayerState["animState"], time: number) {
  if (player.animState !== anim) {
    player.animState = anim;
    player.animTimer = time;
  }
}

export function updatePlayer(
  player: PlayerState,
  input: InputState,
  justPressed: (key: keyof InputState) => boolean,
  map: MapData,
  dt: number
): { newProjectiles: Projectile[]; newParticles: Particle[] } {
  const newProjectiles: Projectile[] = [];
  const newParticles: Particle[] = [];

  // Cooldown ticks
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.rangedCooldown = Math.max(0, player.rangedCooldown - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);
  player.attackTimer = Math.max(0, player.attackTimer - dt);
  player.animTimer = player.animTimer - dt; // Allow dropping below 0 to trigger loop

  // Handle Death
  if (player.health <= 0) {
    setPlayerAnim(player, "death", 1.0); // 10 frames
    player.velocity.x = 0;
    applyGravity(player, dt);
    moveAndCollide(player, map.platforms, dt);
    clampToBounds(player, map.bounds);
    return { newProjectiles, newParticles };
  }

  if (player.attackTimer <= 0) {
    player.isAttacking = false;
  }

  // Dash logic
  if (player.isDashing) {
    player.dashTimer -= dt;
    player.velocity.y = 0; // Giữ độ cao không cho rớt ráng lướt ngang
    if (player.dashTimer <= 0) {
      player.isDashing = false;
      player.invincibleTimer = INVINCIBLE_AFTER_DASH;
      // Do not hard-stop velocity here to allow smooth drift out of dash
      // Dash end particles
      for (let i = 0; i < 6; i++) {
        newParticles.push({
          position: { x: player.position.x + player.width / 2, y: player.position.y + player.height / 2 },
          velocity: { x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 200 },
          color: "#00f5d4",
          size: 3 + Math.random() * 3,
          lifetime: 0.3,
          maxLifetime: 0.3,
          alpha: 0.8,
        });
      }
    }
  }

  if (!player.isDashing) {
    // Process Blocking logic
    player.isBlocking = input.block && player.isGrounded && !player.isAttacking;
    
    // Giảm tốc độ di chuyển cực mạnh nếu đang đỡ đòn
    const speedMult = player.isBlocking ? 0.3 : 1.0;
    const maxSpeed = MAX_MOVE_SPEED * speedMult;

    // Smooth horizontal movement
    const currentFriction = player.isGrounded ? (player.isBlocking ? FRICTION * 2 : FRICTION) : AIR_FRICTION;
    let isMovingInput = false;

    if (input.left && (!player.isBlocking || player.isGrounded)) {
      player.velocity.x = Math.max(-maxSpeed, player.velocity.x - ACCELERATION * dt);
      if (!player.isBlocking) player.facing = -1; // Không đổi hướng khi đang đỡ đòn để giật lùi
      isMovingInput = true;
    } else if (input.right && (!player.isBlocking || player.isGrounded)) {
      player.velocity.x = Math.min(maxSpeed, player.velocity.x + ACCELERATION * dt);
      if (!player.isBlocking) player.facing = 1;
      isMovingInput = true;
    }

    if (!isMovingInput) {
      // decelerate to 0
      if (player.velocity.x > 0) {
        player.velocity.x = Math.max(0, player.velocity.x - currentFriction * dt);
      } else if (player.velocity.x < 0) {
        player.velocity.x = Math.min(0, player.velocity.x + currentFriction * dt);
      }
    }

    // Jump (hỗ trợ double jump)
    // justPressed = nhả rồi bấm lại; HOẶC input.jump && !jumpConsumed = bấm giữ nhưng chưa dùng lần này
    const wantJump = justPressed("jump");
    if (wantJump && player.jumpCount < player.maxJumps && !player.isBlocking) {
      sfx.playJump();
      const isDoubleJump = !player.isGrounded && player.jumpCount >= 1;
      player.velocity.y = isDoubleJump ? JUMP_FORCE * 0.9 : JUMP_FORCE;
      player.isGrounded = false;
      player.jumpCount++;
      // Particle — màu khác cho double jump
      const pColor = isDoubleJump ? "#00f5d4" : "rgba(255,255,255,0.5)";
      const pCount = isDoubleJump ? 6 : 4;
      for (let i = 0; i < pCount; i++) {
        newParticles.push({
          position: { x: player.position.x + player.width / 2, y: player.position.y + player.height },
          velocity: { x: (Math.random() - 0.5) * (isDoubleJump ? 160 : 100), y: Math.random() * 50 + 20 },
          color: pColor,
          size: 2 + Math.random() * 2,
          lifetime: 0.25,
          maxLifetime: 0.25,
          alpha: isDoubleJump ? 0.9 : 0.6,
        });
      }
    }

    // Dash
    if (justPressed("dash") && player.dashCooldown <= 0) {
      sfx.playDash();
      player.isDashing = true;
      player.dashTimer = DASH_DURATION;
      player.dashCooldown = player.maxDashCooldown;
      player.invincibleTimer = Math.max(player.invincibleTimer, DASH_DURATION + INVINCIBLE_AFTER_DASH);
      player.velocity.x = player.facing * DASH_SPEED;
      player.velocity.y = 0;
      setPlayerAnim(player, "dash", DASH_DURATION);
    }

    // Melee attack
    if (justPressed("melee") && player.attackCooldown <= 0) {
      player.isAttacking = true;
      player.attackTimer = 0.4; // 4 frames ~ 0.4s
      player.attackCooldown = MELEE_COOLDOWN;
      setPlayerAnim(player, "attack1", 0.4);
      // Slash particles
      const slashX = player.facing === 1 ? player.position.x + player.width : player.position.x;
      for (let i = 0; i < 5; i++) {
        newParticles.push({
           position: { x: slashX, y: player.position.y + 10 + Math.random() * 30 },
           velocity: { x: player.facing * (100 + Math.random() * 150), y: (Math.random() - 0.5) * 80 },
           color: "#00f5d4",
           size: 2 + Math.random() * 4,
           lifetime: 0.15,
           maxLifetime: 0.15,
           alpha: 0.9,
        });
      }
    }

    // Ranged attack (Kiếm khí)
    // Ranged
    if (input.ranged && player.rangedCooldown <= 0) {
      sfx.playShoot();
      player.isAttacking = true;
      player.attackTimer = 0.6; // 6 frames ~ 0.6s
      player.rangedCooldown = RANGED_COOLDOWN;
      setPlayerAnim(player, "attack2", 0.6);
      
      const projX = player.facing === 1 ? player.position.x + player.width : player.position.x - 20;
      const spawnProjectile = (vy: number) => ({
        position: { x: projX, y: player.position.y + player.height / 2 - 20 },
        velocity: { x: player.facing * PROJECTILE_SPEED, y: vy },
        width: 20,
        height: 40,
        damage: Math.round(player.baseRangedDamage),
        owner: "player" as const,
        lifetime: 2,
      });

      newProjectiles.push(spawnProjectile(0));
      if (player.hasTripleShot) {
        newProjectiles.push(spawnProjectile(-100)); // Angled up
        newProjectiles.push(spawnProjectile(100));  // Angled down
      }
    }
  }

  // Auto set Idle / Run / Jump / Fall if not attacking or dashing
  if (!player.isDashing && !player.isAttacking) {
    if (player.isBlocking) {
       setPlayerAnim(player, "block", 0.5); // block pose
    } else if (!player.isGrounded) {
      if (player.velocity.y < 0) {
         setPlayerAnim(player, "jump", 0.3); // 3 frames
      } else {
         setPlayerAnim(player, "fall", 0.3); // 3 frames
      }
    } else {
      if (Math.abs(player.velocity.x) > 20) {
         setPlayerAnim(player, "run", 1.0); // 10 frames loop
      } else {
         setPlayerAnim(player, "idle", 1.0); // 10 frames loop
      }
    }
  }

  // Loop standing and running animations
  if (player.animTimer <= 0) {
    if (player.animState === "idle" || player.animState === "run") {
      player.animTimer += 1.0;
    }
  }

  // Apply gravity & move (input.down = xuyên qua platform)
  applyGravity(player, dt);
  moveAndCollide(player, map.platforms, dt, input.down);
  clampToBounds(player, map.bounds);

  // Reset jump count SAU physics để isGrounded chính xác từ collision
  if (player.isGrounded) {
    player.jumpCount = 0;
  }

  return { newProjectiles, newParticles };
}

/** Check if player melee hits boss, return damage */
export function checkPlayerMeleeHit(player: PlayerState, boss: BossState): number {
  if (!player.isAttacking || player.attackTimer <= 0.1) return 0;
  const range = player.hasGiantSword ? MELEE_RANGE * 1.8 : MELEE_RANGE;
  const atkRect = getAttackRect(player, range, player.height - 10);
  const bossRect = getEntityRect(boss);
  if (aabbOverlap(atkRect, bossRect)) {
    return Math.round(player.baseDamage);
  }
  return 0;
}
