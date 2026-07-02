// ========================
// Game Engine: Main loop, state management, orchestration
// ========================

import {
  BossConfig,
  GameCallbacks,
  GamePhase,
  GameState,
  Particle,
  Projectile,
  TelemetryData,
} from "./types";
import { createPlayer, updatePlayer, checkPlayerMeleeHit } from "./player";
import { createBoss, updateBoss, damageBoss, getDefaultBossConfig } from "./boss";
import { createArenaMap } from "./map";
import { Renderer } from "./renderer";
import { inputManager } from "./input";
import { sfx } from "./audio";
import { aabbOverlap, getEntityRect } from "./physics";
import { PlayerTracker } from "./tracker";

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private state!: GameState;
  private callbacks: GameCallbacks;
  private tracker!: PlayerTracker;
  private rafId: number = 0;
  private lastTime: number = 0;
  private fpsCounter = 0;
  private fpsTimer = 0;
  private running = false;

  // Track melee hit to prevent multi-hit per swing
  private meleeHitThisSwing = false;
  private lastAttackTimer = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.callbacks = callbacks;
    // Re-attach input listeners (handles React Strict Mode remounts)
    inputManager.init();
    // Don't auto-init level — wait for user to click Start
    this.startMenuLoop();
  }

  /** Render a static menu background (no gameplay) */
  private menuRafId: number = 0;
  private startMenuLoop(): void {
    const drawMenu = () => {
      // Draw a dark background with grid only
      const ctx = this.canvas.getContext("2d")!;
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      // Subtle grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < this.canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); ctx.stroke();
      }
      for (let y = 0; y < this.canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); ctx.stroke();
      }
      // Floating particles for ambiance
      const t = Date.now() * 0.001;
      ctx.fillStyle = "rgba(0, 245, 212, 0.05)";
      for (let i = 0; i < 15; i++) {
        const px = (Math.sin(t * 0.3 + i * 1.7) * 0.5 + 0.5) * this.canvas.width;
        const py = (Math.cos(t * 0.2 + i * 2.3) * 0.5 + 0.5) * this.canvas.height;
        ctx.beginPath();
        ctx.arc(px, py, 2 + Math.sin(t + i) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!this.running) {
        this.menuRafId = requestAnimationFrame(drawMenu);
      }
    };
    drawMenu();
  }

  private stopMenuLoop(): void {
    if (this.menuRafId) {
      cancelAnimationFrame(this.menuRafId);
      this.menuRafId = 0;
    }
  }

  /** Initialize or reset a level */
  initLevel(level: number, bossConfig: BossConfig, preserveStats: boolean = true, restoreHealth: boolean = false, isTwoPlayer: boolean = false): void {
    const mapW = this.canvas.width / 1.1;
    const mapH = this.canvas.height / 1.1;
    const map = createArenaMap(mapW, mapH);
    const player = createPlayer(map.spawnPoint.x, map.spawnPoint.y);
    const boss = createBoss(map.bossSpawnPoint.x, map.bossSpawnPoint.y, bossConfig);
    
    // Determine 2P Mode: do not inherit 2P mode if this is a fresh start (preserveStats = false)
    const mode2P = isTwoPlayer || (preserveStats && this.state && this.state.isTwoPlayerMode);

    let player2 = null;
    if (mode2P) {
       player2 = createPlayer(map.spawnPoint.x - 30, map.spawnPoint.y);
    }

    // Preserve score and upgraded stats across levels
    if (preserveStats && this.state?.player) {
      player.score = this.state.player.score;
      player.maxHealth = this.state.player.maxHealth;
      player.health = restoreHealth ? player.maxHealth : this.state.player.health; // Maintain or restore current HP
      player.baseDamage = this.state.player.baseDamage;
      player.baseRangedDamage = this.state.player.baseRangedDamage;
      player.maxDashCooldown = this.state.player.maxDashCooldown;
      player.maxJumps = this.state.player.maxJumps;
      
      player.hasLifesteal = this.state.player.hasLifesteal;
      player.hasTripleShot = this.state.player.hasTripleShot;
      player.hasReflectiveShield = this.state.player.hasReflectiveShield;
      player.hasExecute = this.state.player.hasExecute;
      player.hasFireAura = this.state.player.hasFireAura;
      player.hasSlowAura = this.state.player.hasSlowAura;
      player.hasVampiricDash = this.state.player.hasVampiricDash;
      player.hasGiantSword = this.state.player.hasGiantSword;
      player.deathCount = this.state.player.deathCount;
    }

    this.state = {
      phase: "playing",
      level,
      player,
      player2,
      boss,
      minions: [],
      projectiles: [],
      particles: [],
      map,
      screenShake: 0,
      slowMotion: 1,
      fps: 0,
      upgradeChoices: [],
      isTwoPlayerMode: mode2P,
    };

    // Hồi lại stats cho cả Player 2 nếu có
    if (preserveStats && this.state?.player2 && player2) {
      player2.score = this.state.player2.score;
      player2.maxHealth = this.state.player2.maxHealth;
      player2.health = restoreHealth ? player2.maxHealth : this.state.player2.health;
      player2.baseDamage = this.state.player2.baseDamage;
      player2.baseRangedDamage = this.state.player2.baseRangedDamage;
      player2.maxDashCooldown = this.state.player2.maxDashCooldown;
      player2.maxJumps = this.state.player2.maxJumps;
      
      player2.hasLifesteal = this.state.player2.hasLifesteal;
      player2.hasTripleShot = this.state.player2.hasTripleShot;
      player2.hasReflectiveShield = this.state.player2.hasReflectiveShield;
      player2.hasExecute = this.state.player2.hasExecute;
      player2.hasFireAura = this.state.player2.hasFireAura;
      player2.hasSlowAura = this.state.player2.hasSlowAura;
      player2.hasVampiricDash = this.state.player2.hasVampiricDash;
      player2.hasGiantSword = this.state.player2.hasGiantSword;
      player2.deathCount = this.state.player2.deathCount;
    }

    this.tracker = new PlayerTracker(level);
    this.meleeHitThisSwing = false;
    this.lastAttackTimer = 0;

    this.callbacks.onPhaseChange("playing");
    this.callbacks.onLevelStart(level);

    // Show boss taunt at level start
    if (boss.currentTaunt) {
      this.callbacks.onTaunt(boss.currentTaunt);
    }
  }

  /** Start the game loop */
  start(): void {
    if (this.running) return;
    this.stopMenuLoop();
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  /** Stop the game loop */
  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /** Resize canvas and re-init renderer */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderer.resize();
    // Update map bounds
    if (this.state) {
      this.state.map = createArenaMap(width / 1.1, height / 1.1);
    }
  }

  /** Apply new boss config (from Gemini AI) and start next level */
  applyBossConfig(config: BossConfig): void {
    this.initLevel(config.level, config);
  }

  /** Restart current level */
  restart(): void {
    this.stop();
    const config = this.state.boss.config;
    
    // Thất bại là mẹ thành công - Give buff on restart if died multiple times
    if (this.state.player.deathCount > 0 && this.state.player.deathCount % 3 === 0) {
      this.state.player.baseDamage *= 1.2;
      this.state.player.maxHealth += 50;
      // also give them lifesteal maybe if they died 5 times?
      if (this.state.player.deathCount >= 5) {
        this.state.player.hasLifesteal = true;
      }
    }

    // Keep stats, but restore HP so player can play again!
    this.initLevel(this.state.level, config, true, true);
  }

  /** Pause or unpause engine for dialogue */
  setDialogMode(isDialog: boolean): void {
     if (this.state) {
        if (isDialog) {
           this.state.phase = "dialog";
        } else {
           this.state.phase = "playing";
        }
     }
  }

  /** Get current game state (for React overlay) */
  getState(): Readonly<GameState> {
    return this.state;
  }

  // ─── Main Loop ─────────────────────────────────────
  private hitStopTimer: number = 0;

  private loop = (timestamp: number): void => {
    if (!this.running) return;

    const rawDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    // Clamp dt to prevent spiral of death
    const dt = Math.min(rawDt, 0.05) * this.state.slowMotion;

    // FPS calculation
    this.fpsCounter++;
    this.fpsTimer += rawDt;
    if (this.fpsTimer >= 1) {
      this.state.fps = this.fpsCounter;
      this.fpsCounter = 0;
      this.fpsTimer = 0;
    }

    // Process Hit Stop
    if (this.hitStopTimer > 0) {
       this.hitStopTimer -= rawDt;
       // We skip `update(dt)` to freeze game logic, but still render
    } else {
       if (this.state.phase === "playing") {
         this.update(dt);
       }
    }

    this.renderer.render(this.state);
    inputManager.endFrame();

    this.rafId = requestAnimationFrame(this.loop);
  };

  // ─── Update ────────────────────────────────────────
  private update(dt: number): void {
    const { player, boss, map } = this.state;
    let p1JustPressed = (action: string) => inputManager.isJustPressed(action as any, 1);
    let p2JustPressed = (action: string) => inputManager.isJustPressed(action as any, 2);

    // Player 2 Join In logic trong trận
    if (!this.state.player2 && (p2JustPressed("melee") || p2JustPressed("jump") || p2JustPressed("dash"))) {
      this.state.player2 = createPlayer(this.state.map.spawnPoint.x - 30, this.state.map.spawnPoint.y);
      this.state.isTwoPlayerMode = true;
    }

    // Track jumps
    const wasGrounded = player.isGrounded;

    // Update player
    const playerResult = updatePlayer(
      player,
      inputManager.getState(1),
      p1JustPressed,
      map,
      dt
    );
    this.state.projectiles.push(...playerResult.newProjectiles);
    this.state.particles.push(...playerResult.newParticles);

    if (this.state.player2 && this.state.player2.health > 0) {
      const p2Result = updatePlayer(
        this.state.player2,
        inputManager.getState(2),
        p2JustPressed,
        map,
        dt
      );
      this.state.projectiles.push(...p2Result.newProjectiles);
      this.state.particles.push(...p2Result.newParticles);
    }

    // Track jump event
    if (wasGrounded && !player.isGrounded && player.velocity.y < 0) {
      this.tracker.trackJump();
    }

    // Track dodge
    if (inputManager.isJustPressed("dash")) {
      // Check if dodge was near boss attack
      const nearBossAttack = boss.isAttacking && boss.attackTimer > 0;
      this.tracker.trackDodge(nearBossAttack);
    }

    // Reset melee tracking for new swing
    if (player.attackTimer > this.lastAttackTimer) {
      this.meleeHitThisSwing = false;
    }
    this.lastAttackTimer = player.attackTimer;

    // Fire Aura
    if (player.hasFireAura) {
      const dist = Math.abs(player.position.x - boss.position.x);
      if (dist < 120 && boss.health > 0) {
        const fireDamage = Math.max(10, player.baseDamage * 0.2) * dt; 
        boss.health = Math.max(0, boss.health - fireDamage);
        player.score += Math.round(fireDamage);
        if (Math.random() < 0.1) {
           this.state.particles.push({
             position: { x: boss.position.x + boss.width/2 + (Math.random()-0.5)*40, y: boss.position.y + Math.random()*boss.height },
             velocity: { x: 0, y: -50 - Math.random()*50 },
             color: "#ff5722", size: 4 + Math.random() * 4, lifetime: 0.4, maxLifetime: 0.4, alpha: 0.8
           });
        }
      }
    }

    // Vampiric Dash
    if (player.isDashing && player.hasVampiricDash) {
       if (aabbOverlap(getEntityRect(player), getEntityRect(boss))) {
          const dashDmg = player.baseDamage * 1.5 * dt; 
          boss.health = Math.max(0, boss.health - dashDmg);
          player.health = Math.min(player.maxHealth, player.health + dashDmg * 2.0); // hút máu cực mạnh
          player.score += Math.round(dashDmg);
          if (Math.random() < 0.2) {
             this.state.particles.push({
               position: { x: boss.position.x + boss.width/2, y: boss.position.y + boss.height/2 },
               velocity: { x: (Math.random()-0.5)*150, y: (Math.random()-0.5)*150 },
               color: "#ff006e", size: 4, lifetime: 0.3, maxLifetime: 0.3, alpha: 0.8
             });
          }
       }
    }

    // Player melee → boss damage & minions
    if (!this.meleeHitThisSwing) {
      let meleeDmg = checkPlayerMeleeHit(player, boss);
      if (meleeDmg > 0) {
        if (player.hasExecute && Math.random() < 0.1) meleeDmg *= 3; // 10% chance to 3x damage
        
        sfx.playHit();
        const hitParticles = damageBoss(boss, meleeDmg);
        this.state.particles.push(...hitParticles);
        this.state.screenShake = 0.6; // Increased shake
        this.hitStopTimer = 0.05; // 50ms freeze frame for impact!
        this.meleeHitThisSwing = true;
        this.tracker.trackDamageDealt(meleeDmg, "melee");
        player.score += Math.round(meleeDmg);

        if (player.hasLifesteal && Math.random() < 0.15) {
          player.health = Math.min(player.maxHealth, player.health + player.maxHealth * 0.05);
        }
      }
      
      if (!this.meleeHitThisSwing) {
        for (let minion of this.state.minions) {
           let mxDmg = checkPlayerMeleeHit(player, minion);
           if (mxDmg > 0) {
              if (player.hasExecute && Math.random() < 0.1) mxDmg *= 3;
              sfx.playHit();
              this.state.particles.push(...damageBoss(minion, mxDmg));
              this.state.screenShake = 0.2;
              this.meleeHitThisSwing = true;
              this.tracker.trackDamageDealt(mxDmg, "melee");
              player.score += Math.round(mxDmg);
              if (player.hasLifesteal && Math.random() < 0.15) {
                 player.health = Math.min(player.maxHealth, player.health + player.maxHealth * 0.05);
              }
              break;
           }
        }
      }
    }

    if (this.state.player2 && this.state.player2.health > 0 && !this.meleeHitThisSwing) {
      const p2 = this.state.player2;
      let meleeDmgP2 = checkPlayerMeleeHit(p2, boss);
      if (meleeDmgP2 > 0) {
        if (p2.hasExecute && Math.random() < 0.1) meleeDmgP2 *= 3;
        sfx.playHit();
        this.state.particles.push(...damageBoss(boss, meleeDmgP2));
        this.state.screenShake = 0.6;
        this.hitStopTimer = 0.05;
        this.meleeHitThisSwing = true;
        this.tracker.trackDamageDealt(meleeDmgP2, "melee");
        p2.score += Math.round(meleeDmgP2);
        if (p2.hasLifesteal && Math.random() < 0.15) p2.health = Math.min(p2.maxHealth, p2.health + p2.maxHealth * 0.05);
      }
    }


    // Cập nhật target player gần nhất
    let targetPlayer = player;
    if (this.state.player2 && this.state.player2.health > 0) {
      if (player.health <= 0) targetPlayer = this.state.player2;
      else {
        const d1 = Math.abs(player.position.x - boss.position.x);
        const d2 = Math.abs(this.state.player2.position.x - boss.position.x);
        if (d2 < d1) targetPlayer = this.state.player2;
      }
    }

    // Update boss với target mới
    const bossResult = updateBoss(boss, targetPlayer, this.state.projectiles, map, dt);
    this.state.projectiles.push(...bossResult.newProjectiles);
    this.state.particles.push(...bossResult.newParticles);
    if (bossResult.newMinions) this.state.minions.push(...bossResult.newMinions);
    
    if (bossResult.enteredPhase2 && this.callbacks.onBossPhase2) {
      this.callbacks.onBossPhase2(this.state.level);
    }

    // Boss Aura Mechanics cho cả 2 player
    if (boss.config.auraType && boss.health > 0) {
      const bcx = boss.position.x + boss.width/2;
      const bcy = boss.position.y + boss.height/2;

      for (let pTarget of [player, this.state.player2].filter(pl => pl && pl.health > 0)) {
        if (!pTarget) continue;
        const pcx = pTarget.position.x + pTarget.width/2;
        const pcy = pTarget.position.y + pTarget.height/2;
        const dist = Math.sqrt(Math.pow(bcx - pcx, 2) + Math.pow(bcy - pcy, 2));

        switch (boss.config.auraType) {
          case "fire":
            if (dist < 200 && pTarget.invincibleTimer <= 0) {
               const burnDmg = 15 * dt;
               pTarget.health -= burnDmg;
               if (Math.random() < 0.2) {
                 this.state.particles.push({
                   position: { x: pcx, y: pcy },
                   velocity: { x: (Math.random()-0.5)*50, y: -100 },
                   color: "#ff3300", size: 3, lifetime: 0.5, maxLifetime: 0.5, alpha: 0.8
                 });
               }
            }
            break;
          case "frost":
            if (dist < 400 && !pTarget.isDashing) {
               pTarget.velocity.x *= 0.85; 
               if (Math.random() < 0.1) {
                 this.state.particles.push({
                   position: { x: pcx + (Math.random()-0.5)*pTarget.width, y: pcy + (Math.random()-0.5)*pTarget.height },
                   velocity: { x: 0, y: 10 },
                   color: "#00ffff", size: 2, lifetime: 0.5, maxLifetime: 0.5, alpha: 0.7
                 });
               }
            }
            break;
          case "gravity":
            if (dist < 800 && dist > 50 && !pTarget.isDashing) {
               const pull = 800 * (1 - dist/800) * dt;
               pTarget.velocity.x += ((bcx - pcx) / dist) * pull;
            }
            break;
        }
      }
    }

    // Update minions
    this.state.minions = this.state.minions.filter(m => m.health > 0);
    for (let minion of this.state.minions) {
       let mTarget = player;
       if (this.state.player2 && this.state.player2.health > 0) {
          if (player.health <= 0) mTarget = this.state.player2;
          else {
             const d1 = Math.abs(player.position.x - minion.position.x);
             const d2 = Math.abs(this.state.player2.position.x - minion.position.x);
             if (d2 < d1) mTarget = this.state.player2;
          }
       }
       
       const mResult = updateBoss(minion, mTarget, this.state.projectiles, map, dt);
       this.state.projectiles.push(...mResult.newProjectiles);
       this.state.particles.push(...mResult.newParticles);
       if (mResult.newMinions) this.state.minions.push(...mResult.newMinions);

       if (mResult.damageToPlayer > 0 && mTarget.invincibleTimer <= 0) {
         sfx.playPlayerHit();
         let finalDmg = mResult.damageToPlayer;
         if (mTarget.isBlocking) {
             finalDmg *= 0.25; 
             this.state.particles.push({ position: { x: mTarget.position.x + mTarget.facing * 10, y: mTarget.position.y + mTarget.height/2 }, velocity: { x: (Math.random()-0.5)*100, y: -100 }, color: "#aaffff", size: 4, lifetime: 0.3, maxLifetime: 0.3, alpha: 1 });
         }
         mTarget.health -= finalDmg;
         mTarget.invincibleTimer = 0.5;
         this.state.screenShake = mTarget.isBlocking ? 0.1 : 0.4;
         if (mTarget === player) this.tracker.trackDamageTaken(finalDmg);
         
         if (mTarget.hasReflectiveShield) {
           const reflectDmg = finalDmg * 0.15;
           this.state.particles.push(...damageBoss(minion, reflectDmg));
         }
         mTarget.velocity.x = -minion.facing * (mTarget.isBlocking ? 50 : 250);
         mTarget.velocity.y = mTarget.isBlocking ? 0 : -150;
       }
    }

    // Boss damage to player
    if (bossResult.damageToPlayer > 0 && targetPlayer.invincibleTimer <= 0) {
      sfx.playPlayerHit();
      let finalDmg = bossResult.damageToPlayer;
      if (targetPlayer.isBlocking) {
          finalDmg *= 0.25;
          this.state.particles.push({ position: { x: targetPlayer.position.x + targetPlayer.facing * 10, y: targetPlayer.position.y + targetPlayer.height/2 }, velocity: { x: (Math.random()-0.5)*100, y: -100 }, color: "#aaffff", size: 5, lifetime: 0.4, maxLifetime: 0.4, alpha: 1 });
      }
      
      targetPlayer.health -= finalDmg;
      targetPlayer.invincibleTimer = 0.5;
      this.state.screenShake = targetPlayer.isBlocking ? 0.2 : 0.8;
      this.hitStopTimer = targetPlayer.isBlocking ? 0.05 : 0.12; 
      if (targetPlayer === player) this.tracker.trackDamageTaken(finalDmg);
      
      if (boss.config.auraType === "vampire") {
         boss.health = Math.min(boss.maxHealth, boss.health + finalDmg * 1.5);
         this.state.particles.push({
            position: { x: boss.position.x + boss.width/2, y: boss.position.y + boss.height/2 },
            velocity: { x: 0, y: -100 }, color: "#ff006e", size: 5, lifetime: 0.5, maxLifetime: 0.5, alpha: 1
         });
      }

      if (targetPlayer.hasReflectiveShield) {
        const reflectDmg = finalDmg * 0.15;
        this.state.particles.push(...damageBoss(boss, reflectDmg));
      }
      
      targetPlayer.velocity.x = -boss.facing * (targetPlayer.isBlocking ? 100 : 250);
      targetPlayer.velocity.y = targetPlayer.isBlocking ? 0 : -150;
    }

    // Update projectiles
    this.updateProjectiles(dt);

    // Update particles
    this.updateParticles(dt);

    // Screen shake decay
    this.state.screenShake = Math.max(0, this.state.screenShake - dt * 2);

    // Telemetry update
    this.tracker.update(player, boss, dt);

    // Taunt on boss phase change
    if (boss.currentTaunt && boss.tauntTimer > 0) {
      this.callbacks.onTaunt(boss.currentTaunt);
    }

    // Win/Lose checks
    if (boss.health <= 0) {
      // Yêu cầu: Boss chết xong người chơi phải đi về bên phải màn hình để qua màn
      const rightEdge = map.bounds.x + map.bounds.width - 150;
      // Tuỳ biến 2P: 1 trong 2 người tới mép là đủ
      const p1Clear = player.position.x >= rightEdge;
      const p2Clear = this.state.player2 && this.state.player2.health > 0 ? (this.state.player2.position.x >= rightEdge) : false;
      if (p1Clear || p2Clear) {
        this.onBossDead();
      } else {
        // Tích hạt hiệu ứng bay dần sang bên phải để khơi gợi ý tưởng
        if (Math.random() < 0.1) {
           this.state.particles.push({
             position: { x: (p1Clear || p2Clear) ? player.position.x : player.position.x, y: player.position.y - 30 },
             velocity: { x: 200 + Math.random()*150, y: (Math.random()-0.5)*50 },
             color: "#d4af37", size: 3 + Math.random()*2, lifetime: 0.8, maxLifetime: 0.8, alpha: 0.7
           });
        }
      }
    } else if (player.health <= 0 && (!this.state.player2 || this.state.player2.health <= 0)) {
      this.onPlayerDead();
    }
  }

  private updateProjectiles(dt: number): void {
    const { player, boss } = this.state;

    this.state.projectiles = this.state.projectiles.filter((p) => {
      if (p.isHoming && p.owner === "boss") {
          const dx = (player.position.x + player.width/2) - (p.position.x + p.width/2);
          const dy = (player.position.y + player.height/2) - (p.position.y + p.height/2);
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 10) {
             const speed = Math.sqrt(p.velocity.x*p.velocity.x + p.velocity.y*p.velocity.y);
             const dirX = dx / dist;
             const dirY = dy / dist;
             // Lerk velocity smoothly
             p.velocity.x += (dirX * speed - p.velocity.x) * dt * 2.0;
             p.velocity.y += (dirY * speed - p.velocity.y) * dt * 2.0;
          }
      }

      if (p.owner === "boss" && p.color === "#110033") {
         // Lực hút của Hố Đen
         const cx = p.position.x + p.width/2;
         const cy = p.position.y + p.height/2;
         const pcx = player.position.x + player.width/2;
         const pcy = player.position.y + player.height/2;
         const dx = cx - pcx;
         const dy = cy - pcy;
         const dist = Math.sqrt(dx*dx + dy*dy);
         if (dist < 450 && dist > 20) {
            const pullStrength = 1500 * (1 - dist/450); 
            player.velocity.x += (dx/dist) * pullStrength * dt;
            player.velocity.y += (dy/dist) * pullStrength * dt;
         }
         // Hạt hút vào tâm
         if (Math.random() < 0.2) {
            const px = cx + (Math.random()-0.5)*p.width*1.5;
            const py = cy + (Math.random()-0.5)*p.height*1.5;
            this.state.particles.push({
               position: { x: px, y: py },
               velocity: { x: (cx - px)*2, y: (cy - py)*2 },
               color: "#ffffff", size: 2, lifetime: 0.5, maxLifetime: 0.5, alpha: 0.8
            });
         }
      }

      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.lifetime -= dt;

      // Out of bounds or expired
      if (p.lifetime <= 0) return false;
      if (
        p.position.x + p.width < -100 ||
        p.position.x > this.canvas.width + 100 ||
        p.position.y + p.height < -100 ||
        p.position.y > this.canvas.height + 100
      ) {
        return false;
      }

      const pRect = getEntityRect(p);

      // Player projectile → boss or minions
      if (p.owner === "player") {
        let hit = false;
        
        // Trúng minions
        for (let minion of this.state.minions) {
           if (aabbOverlap(pRect, getEntityRect(minion))) {
              sfx.playHit();
              let finalDmg = p.damage;
              if (player.hasExecute && Math.random() < 0.1) finalDmg *= 3;
              this.state.particles.push(...damageBoss(minion, finalDmg));
              this.state.screenShake = 0.1;
              hit = true;
              this.tracker.trackDamageDealt(finalDmg, "ranged");
              player.score += Math.round(finalDmg);
              break;
           }
        }

        // Trúng boss
        if (!hit && aabbOverlap(pRect, getEntityRect(boss))) {
          sfx.playHit();
          let finalDmg = p.damage;
          if (player.hasExecute && Math.random() < 0.1) finalDmg *= 3; // 10% chance to 3x damage

          const hitParticles = damageBoss(boss, finalDmg);
          this.state.particles.push(...hitParticles);
          this.state.screenShake = 0.2; // Increase slightly
          this.hitStopTimer = 0.02; // Small micro freeze
          this.tracker.trackDamageDealt(finalDmg, "ranged");
          player.score += Math.round(finalDmg);
          
          if (player.hasLifesteal && Math.random() < 0.15) {
            player.health = Math.min(player.maxHealth, player.health + player.maxHealth * 0.05);
          }
          
          hit = true;
        }

        if (hit) return false;
      }

      // Boss projectile → player
      // Boss projectile → player/player2
      if (p.owner === "boss") {
         for (let target of [player, this.state.player2].filter(pl => pl && pl.health > 0)) {
            if (target && target.invincibleTimer <= 0 && aabbOverlap(pRect, getEntityRect(target))) {
               sfx.playPlayerHit();
               let finalDmg = p.damage;
               if (target.isBlocking) {
                  finalDmg *= 0.25; 
                  this.state.particles.push({ position: { x: target.position.x + target.facing * 10, y: target.position.y + target.height/2 }, velocity: { x: (Math.random()-0.5)*100, y: -100 }, color: "#aaffff", size: 4, lifetime: 0.3, maxLifetime: 0.3, alpha: 1 });
               }
               target.health -= finalDmg;
               target.invincibleTimer = 0.5;
               this.state.screenShake = target.isBlocking ? 0.1 : 0.3;
               if (target === player) this.tracker.trackDamageTaken(finalDmg);
               
               if (target.hasReflectiveShield) {
                  const reflectDmg = finalDmg * 0.15;
                  this.state.particles.push(...damageBoss(boss, reflectDmg));
               }
               
               target.velocity.x = p.velocity.x > 0 ? (target.isBlocking ? 50 : 150) : (target.isBlocking ? -50 : -150);
               if (p.width < 200) return false;
            }
         }
      }

      return true;
    });
  }

  private updateParticles(dt: number): void {
    this.state.particles = this.state.particles.filter((p) => {
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.lifetime -= dt;
      p.velocity.x *= 0.95;
      p.velocity.y *= 0.95;
      return p.lifetime > 0;
    });
  }

  private onBossDead(): void {
    if (this.state.phase === "boss_dead") return;
    this.state.phase = "boss_dead";
    this.state.player.score += 500 * this.state.level;
    this.callbacks.onPhaseChange("boss_dead");

    // Generate and send telemetry
    const telemetry = this.tracker.generateReport(this.state.boss.config);
    console.log("[Engine] Telemetry:", telemetry);
    this.callbacks.onBossDead(telemetry);

    // Victory particles
    for (let i = 0; i < 30; i++) {
      this.state.particles.push({
        position: {
          x: this.state.boss.position.x + this.state.boss.width / 2,
          y: this.state.boss.position.y + this.state.boss.height / 2,
        },
        velocity: {
          x: (Math.random() - 0.5) * 500,
          y: (Math.random() - 0.5) * 500,
        },
        color: this.state.boss.config.colorScheme || "#ff006e",
        size: 3 + Math.random() * 6,
        lifetime: 1.5,
        maxLifetime: 1.5,
        alpha: 1,
      });
    }
  }

  private onPlayerDead(): void {
    this.state.phase = "player_dead";
    this.state.player.deathCount++;
    this.tracker.trackDeath();
    this.callbacks.onPhaseChange("player_dead");
    this.callbacks.onPlayerDead();
  }

  destroy(): void {
    this.stop();
    this.stopMenuLoop();
    inputManager.destroy();
  }

  // --- Upgrades ---
  public generateUpgrades(): import("./types").SkillUpgrade[] {
    const lvl = this.state.level + 1; // Preparing for the next level

    const hpBoost = 100 + lvl * 40;
    const hpFullBoost = 50 + lvl * 20; 
    const meleeBoost = 15 + lvl * 10;
    const rangedBoost = 10 + lvl * 8;
    const dashReduction = 0.05 + lvl * 0.015;

    const allUpgrades: import("./types").SkillUpgrade[] = [
      { id: "hp_max", title: "Cường Hóa Thể Chất", description: `Tăng ${hpBoost} máu tối đa & hồi đầy`, icon: "❤️" },
      { id: "hp_full", title: "Sinh Mệnh Bất Diệt", description: `Hồi 100% máu & +${hpFullBoost} max HP`, icon: "💖" },
      { id: "dmg_melee", title: "Hủy Diệt Kiếm Thuật", description: `Tăng lượng lớn sát thương vật lý (+${meleeBoost})`, icon: "⚔️" },
      { id: "dmg_ranged", title: "Cường Hóa Kiếm Khí", description: `Tăng sát thương kiếm khí (+${rangedBoost})`, icon: "✨" },
      { id: "dash_cd", title: "Khinh Công", description: `Giảm thời gian hồi lướt (-${dashReduction.toFixed(2)}s)`, icon: "💨" },
      { id: "extra_jump", title: "Đạp Hư Không", description: "Thêm 1 lần nhảy giữa không trung", icon: "🪽" },
    ];
    
    if (!this.state.player.hasLifesteal) {
        allUpgrades.push({ id: "lifesteal", title: "Khát Máu", description: "Có 15% tỷ lệ hồi 5% máu tối đa khi đánh trúng", icon: "🩸" });
    }
    if (!this.state.player.hasTripleShot) {
        allUpgrades.push({ id: "triple_shot", title: "Kiếm Khí Liên Hoàn", description: "Đánh xa phóng ra 3 tia kiếm khí", icon: "🌪️" });
    }
    if (!this.state.player.hasReflectiveShield) {
        allUpgrades.push({ id: "reflective_shield", title: "Kim Chung Tráo", description: "Phản lại 15% sát thương khi bị đánh trúng", icon: "🛡️" });
    }
    if (!this.state.player.hasExecute) {
        allUpgrades.push({ id: "execute", title: "Nhất Kích Tất Sát", description: "10% tỷ lệ gây 300% sát thương bạo kích", icon: "☠️" });
    }
    if (!this.state.player.hasFireAura) {
        allUpgrades.push({ id: "fire_aura", title: "Hỏa Lập Vòng Cung", description: "Thiêu đốt quái vật xung quanh liên tục", icon: "🔥" });
    }
    if (!this.state.player.hasSlowAura) {
        allUpgrades.push({ id: "slow_aura", title: "Uy Áp Băng Giá", description: "Giảm 25% tốc độ di chuyển của Boss", icon: "❄️" });
    }
    if (!this.state.player.hasVampiricDash) {
        allUpgrades.push({ id: "vampiric_dash", title: "Lướt Đoạt Mệnh", description: "Lướt xuyên Boss gây sát thương & hồi máu", icon: "🧛" });
    }
    if (!this.state.player.hasGiantSword) {
        allUpgrades.push({ id: "giant_sword", title: "Thánh Kiếm", description: "Mở rộng 80% tầm đánh cận chiến", icon: "🗡️" });
    }

    // Shuffle & pick 3
    const shuffled = [...allUpgrades].sort(() => 0.5 - Math.random());
    this.state.upgradeChoices = shuffled.slice(0, 3);
    // Phase is controlled by GameCanvas, not here
    return this.state.upgradeChoices;
  }

  public getUpgradeChoices() {
    return this.state.upgradeChoices;
  }

  public applyUpgrade(id: import("./types").UpgradeId): void {
    const p = this.state.player;
    const lvl = this.state.level + 1;

    switch (id) {
      case "hp_max":
        p.maxHealth += (100 + lvl * 40);
        p.health = p.maxHealth;
        break;
      case "hp_full":
        p.maxHealth += (50 + lvl * 20);
        p.health = p.maxHealth;
        break;
      case "dmg_melee":
        p.baseDamage += (15 + lvl * 10);
        break;
      case "dmg_ranged":
        p.baseRangedDamage += (10 + lvl * 8);
        break;
      case "dash_cd":
        p.maxDashCooldown = Math.max(0.15, p.maxDashCooldown - (0.05 + lvl * 0.015));
        break;
      case "extra_jump":
        p.maxJumps += 1;
        break;
      case "lifesteal":
        p.hasLifesteal = true;
        break;
      case "triple_shot":
        p.hasTripleShot = true;
        break;
      case "reflective_shield":
        p.hasReflectiveShield = true;
        break;
      case "execute":
        p.hasExecute = true;
        break;
      case "fire_aura":
        p.hasFireAura = true;
        break;
      case "slow_aura":
        p.hasSlowAura = true;
        break;
      case "vampiric_dash":
        p.hasVampiricDash = true;
        break;
      case "giant_sword":
        p.hasGiantSword = true;
        break;
    }
  }

  public executeCommand(cmd: string): void {
    const trimmed = cmd.trim();
    if (trimmed.startsWith("skip ")) {
      const parts = trimmed.split(" ");
      const lvl = parseInt(parts[1], 10);
      if (!isNaN(lvl) && lvl > 0 && this.state) {
        const config = getDefaultBossConfig(lvl);
        this.initLevel(lvl, config, true, true);
        sfx.playPowerup();
      }
      return;
    }
    if (trimmed === ":hack" || trimmed === "1") {
      if (this.state && this.state.player) {
        this.state.player.baseDamage = 10000;
        this.state.player.baseRangedDamage = 10000;
        
        if (trimmed === "1") {
           this.state.player.invincibleTimer = 999999; // Bất tử
           this.state.player.health = 999999;
           this.state.player.maxHealth = 999999;
           this.state.player.baseDamage = 999999;
           this.state.player.baseRangedDamage = 999999;
        }

        sfx.playPowerup();
        // Spawns some particles for feedback
        for (let i = 0; i < 20; i++) {
          this.state.particles.push({
            position: { ...this.state.player.position },
            velocity: {
              x: (Math.random() - 0.5) * 300,
              y: (Math.random() - 0.5) * 300,
            },
            color: "#ff00ff",
            size: 4 + Math.random() * 4,
            lifetime: 1.0,
            maxLifetime: 1.0,
            alpha: 1,
          });
        }
      }
    }
  }
}
