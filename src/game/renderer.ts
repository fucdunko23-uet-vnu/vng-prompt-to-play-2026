// ========================
// Canvas Renderer: Drawing utilities with effects
// ========================

import {
  BossState,
  Entity,
  GameState,
  Particle,
  Platform,
  PlayerState,
  Projectile,
} from "./types";

const PLAYER_COLOR = "#d4af37";
const PLAYER_GLOW = "rgba(212, 175, 55, 0.4)";
const PLATFORM_COLOR = "#2c1e16";
const PLATFORM_BORDER = "#150f0a";
const BG_COLOR = "#0f0d0a";
const HEALTH_BG = "rgba(255, 255, 255, 0.1)";
const PLAYER_HEALTH_COLOR = "#d4af37";
const BOSS_HEALTH_COLOR = "#8b0000";

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;
  private shakeOffset = { x: 0, y: 0 };

  private bossSprite: HTMLImageElement;
  private laserSprite: HTMLImageElement;
  private armSprite: HTMLImageElement;
  private isBossSpriteLoaded = false;
  private isLaserSpriteLoaded = false;
  private isArmSpriteLoaded = false;

  private playerSprites: Record<string, HTMLImageElement> = {};
  private loadedPlayerSprites: Record<string, boolean> = {};

  private bgImage: HTMLImageElement;
  private isBgImageLoaded = false;

  private platSprite: HTMLImageElement;
  private isPlatSpriteLoaded = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();

    // Load boss and weapon sprites
    this.bossSprite = new Image();
    this.bossSprite.src = "/mecha_boss.png";
    this.bossSprite.onload = () => { this.isBossSpriteLoaded = true; };

    this.laserSprite = new Image();
    this.laserSprite.src = "/laser_sheet.png";
    this.laserSprite.onload = () => { this.isLaserSpriteLoaded = true; };

    this.armSprite = new Image();
    this.armSprite.src = "/arm_projectile_glowing.png";
    this.armSprite.onload = () => { this.isArmSpriteLoaded = true; };

    // Load Player Knight sprites
    const knightSprites = {
      idle: "_Idle.png",
      run: "_Run.png",
      jump: "_Jump.png",
      fall: "_Fall.png",
      dash: "_Roll.png",
      attack1: "_Attack.png",
      attack2: "_Attack2.png",
      death: "_Death.png"
    };

    for (const [key, file] of Object.entries(knightSprites)) {
      const img = new Image();
      img.src = `/knight/${file}`;
      img.onload = () => { this.loadedPlayerSprites[key] = true; };
      this.playerSprites[key] = img;
    }

    // Load Background
    this.bgImage = new Image();
    this.bgImage.src = "/back.jpg";
    this.bgImage.onload = () => { this.isBgImageLoaded = true; };

    // Load Platform sprite
    this.platSprite = new Image();
    this.platSprite.src = "/plat.png";
    this.platSprite.onload = () => { this.isPlatSpriteLoaded = true; };
  }

  resize(): void {
    this.width = this.canvas.width / 1.1;
    this.height = this.canvas.height / 1.1;
  }

  /** Clear and prepare frame */
  beginFrame(screenShake: number): void {
    // Screen shake offset
    if (screenShake > 0) {
      this.shakeOffset.x = (Math.random() - 0.5) * screenShake * 8;
      this.shakeOffset.y = (Math.random() - 0.5) * screenShake * 8;
    } else {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }

    this.ctx.save();
    
    // Scale các vật thể to lên 10%
    this.ctx.scale(1.1, 1.1);
    
    this.ctx.translate(this.shakeOffset.x, this.shakeOffset.y);

    this.ctx.fillStyle = BG_COLOR;
    this.ctx.fillRect(-10, -10, this.width + 20, this.height + 20);
    this.drawBackground();
  }

  endFrame(): void {
    this.ctx.restore();
  }

  /** Premium Sci-Fi / Fantasy parallax background */
  private drawBackground(): void {
    if (this.isBgImageLoaded) {
       this.ctx.drawImage(this.bgImage, 0, 0, this.width, this.height);
       // Phủ một lớp sương mờ tối màu để làm nổi bật Boss và Player
       this.ctx.fillStyle = "rgba(10, 10, 15, 0.4)";
       this.ctx.fillRect(0, 0, this.width, this.height);
       return;
    }

    // Sky gradient
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.height);
    skyGrad.addColorStop(0, "#050510"); // deep space
    skyGrad.addColorStop(0.5, "#120a2a"); // purple mid
    skyGrad.addColorStop(1, "#20002c"); // dark maroon bottom
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw glowing dust/stars
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    for (let i = 0; i < 60; i++) {
       const x = (Math.sin(i * 12345) * 10000) % this.width;
       const y = (Math.cos(i * 54321) * 10000) % (this.height * 0.7);
       const r = (i % 3) * 0.5 + 0.5;
       this.ctx.beginPath();
       this.ctx.arc(Math.abs(x), Math.abs(y), r, 0, Math.PI * 2);
       this.ctx.fill();
    }

    // Distant mountain silhouette (parallax layer 1)
    this.ctx.fillStyle = "#0c0518";
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height);
    for (let x = 0; x <= this.width; x += 50) {
      const y = this.height - 220 + Math.sin(x * 0.01) * 60 + Math.cos(x * 0.025) * 30;
      this.ctx.lineTo(x, y);
    }
    this.ctx.lineTo(this.width, this.height);
    this.ctx.fill();

    // Midground ruined castle / city silhouette (parallax layer 2)
    this.ctx.fillStyle = "#150a21";
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height);
    for (let x = 0; x <= this.width; x += 40) {
      const height = 120 + (Math.sin(x * 0.05) ** 2) * 80 + (x % 3 === 0 ? 50 : 0);
      this.ctx.lineTo(x, this.height - height);
      this.ctx.lineTo(x + 35, this.height - height);
    }
    this.ctx.lineTo(this.width, this.height);
    this.ctx.fill();
    
    // Slight mist over the ground
    const mistGrad = this.ctx.createLinearGradient(0, this.height - 150, 0, this.height);
    mistGrad.addColorStop(0, "transparent");
    mistGrad.addColorStop(1, "rgba(20, 0, 40, 0.8)");
    this.ctx.fillStyle = mistGrad;
    this.ctx.fillRect(0, this.height - 150, this.width, 150);
  }

  /** Draw all platforms */
  drawPlatforms(platforms: Platform[]): void {
    for (const p of platforms) {
      if (p.type === "wall") continue;

      if (p.type === "platform" && this.isPlatSpriteLoaded) {
        // Vẽ platform bằng sprite đá bay — tỉ lệ tự nhiên
        const imgAspect = this.platSprite.naturalWidth / this.platSprite.naturalHeight;
        const drawW = p.width + 40; // Rộng hơn hitbox một chút cho tự nhiên
        const drawH = drawW / imgAspect;
        const drawX = p.x - 20; // Căn giữa so với hitbox
        const drawY = p.y - (drawH - p.height) * 0.3; // Mặt trên khớp collision
        this.ctx.drawImage(this.platSprite, drawX, drawY, drawW, drawH);
      } else {
        // Ground hoặc fallback
        this.ctx.fillStyle = "#1e1b30";
        this.ctx.fillRect(p.x, p.y, p.width, p.height);

        // Neon top edge
        this.ctx.fillStyle = "#d4af37";
        this.ctx.fillRect(p.x, p.y, p.width, 4);

        const grad = this.ctx.createLinearGradient(p.x, p.y, p.x, p.y + 15);
        grad.addColorStop(0, "rgba(212, 175, 55, 0.4)");
        grad.addColorStop(1, "transparent");
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(p.x, p.y + 4, p.width, 11);

        this.ctx.fillStyle = "#0c0a14";
        this.ctx.fillRect(p.x, p.y + p.height - 4, p.width, 4);
      }
    }
  }

  /** Draw the player character */
  drawPlayer(player: PlayerState, isPlayer2 = false): void {
    const { x, y } = player.position;
    const { width, height } = player;

    // Glow effect
    this.ctx.shadowColor = isPlayer2 ? "#4a90e2" : PLAYER_GLOW;
    this.ctx.shadowBlur = player.invincibleTimer > 0 ? 25 : 12;

    // Invincibility flash
    if (player.invincibleTimer > 0 && Math.floor(player.invincibleTimer * 10) % 2 === 0) {
      this.ctx.globalAlpha = 0.5;
    }

    // Dash trail
    if (player.isDashing) {
      this.ctx.globalAlpha = 0.3;
      this.ctx.fillStyle = PLAYER_COLOR;
      const trailX = x - player.facing * 20;
      this.ctx.fillRect(trailX, y + 4, width, height - 8);
      this.ctx.globalAlpha = 0.15;
      const trailX2 = x - player.facing * 40;
      this.ctx.fillRect(trailX2, y + 8, width, height - 16);
      this.ctx.globalAlpha = 1;
    }

    // Draw Character Body / Sprite
    const animState = player.animState || "idle";
    
    if (this.loadedPlayerSprites[animState]) {
      const sprite = this.playerSprites[animState];
      let frames = 1;
      let duration = 1.0;
      let forceFrame = -1;
      
      switch (animState) {
        case "idle": frames = 10; duration = 1.0; break;
        case "run": frames = 10; duration = 1.0; break;
        case "jump": frames = 3; duration = 0.3; break;
        case "fall": frames = 3; duration = 0.3; break;
        case "dash": frames = 12; duration = 0.4; break;
        case "attack1": frames = 4; duration = 0.4; break;
        case "attack2": frames = 6; duration = 0.6; break;
        case "death": 
           frames = 10; duration = 1.0; 
           // Hold the last frame of death
           if (player.health <= 0 && player.animTimer <= 0) forceFrame = 9; 
           break;
      }
      
      const elapsed = Math.max(0, duration - player.animTimer);
      let currentFrame = forceFrame !== -1 ? forceFrame : Math.floor((elapsed / duration) * frames);
      if (currentFrame >= frames) currentFrame = frames - 1;
      
      const frameWidth = 120;
      const frameHeight = 80;
      
      // Original actual character is ~38x20 on 120x80 canvas
      // We scale up to fit our 32x48 bounding box
      const scale = 1.6;
      const drawWidth = 120 * scale; 
      const drawHeight = 80 * scale;
      
      // Offset correctly so the bottom pixel of sprite matches bottom of bounding box
      const offsetX = x + width/2 - drawWidth/2;
      const offsetY = y + height - drawHeight;
      
      this.ctx.save();
      // Face left or right
      if (player.facing === -1) {
        this.ctx.translate(x + width / 2, y);
        this.ctx.scale(-1, 1);
        this.ctx.translate(-(x + width / 2), -y);
      }
      
      if (isPlayer2) {
         this.ctx.filter = "hue-rotate(180deg) saturate(1.5)";
      }

      this.ctx.drawImage(
        sprite,
        currentFrame * frameWidth, 0,
        frameWidth, frameHeight,
        offsetX, offsetY,
        drawWidth, drawHeight
      );
      this.ctx.restore();
    } else {
      // Fallback
      this.ctx.fillStyle = isPlayer2 ? "#4a90e2" : PLAYER_COLOR;
      this.ctx.fillRect(x, y, width, height);

      // "Eye" indicator (facing direction)
      this.ctx.fillStyle = "#0a0a0f";
      const eyeX = player.facing === 1 ? x + width - 10 : x + 4;
      this.ctx.fillRect(eyeX, y + 8, 6, 6);
    }
    this.ctx.globalAlpha = 1;
    this.ctx.shadowBlur = 0;
  }

  /** Draw the boss */
  drawBoss(boss: BossState): void {
    const { x, y } = boss.position;
    const { width, height } = boss;
    const color = boss.config.colorScheme || "#8b0000";

    // Glow under boss
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 15;
    
    if (this.isBossSpriteLoaded && boss.animState) {
      // Find sprite configuration
      let row = 0;
      let frames = 4;
      let duration = 0.4;
      let reverse = false;
      let forceFrame = -1;

      switch (boss.animState) {
        case "idle": case "moving": row = 0; frames = 4; duration = 0.4; break;
        case "glowing": row = 1; frames = 8; duration = 0.8; break;
        case "ranged": row = 2; frames = 9; duration = 0.9; break;
        case "melee": row = 3; frames = 7; duration = 0.7; break;
        case "laser_cast": row = 4; frames = 7; duration = 0.7; break;
        case "laser_beam": row = 4; frames = 7; duration = 0.9; forceFrame = 6; break; // Hold the last frame of cast
        case "armor_buff": row = 5; frames = 11; duration = 1.1; break;
        case "appearance": row = 6; frames = 14; duration = 1.4; reverse = true; break;
        case "defeated": row = 6; frames = 14; duration = 1.4; break;
        case "block": row = 7; frames = 9; duration = 0.9; break;
      }

      // Calculate current frame index (0-indexed)
      const elapsed = Math.max(0, duration - boss.animTimer);
      let currentFrame = forceFrame !== -1 ? forceFrame : Math.floor((elapsed / duration) * frames);
      if (currentFrame >= frames) currentFrame = frames - 1; 
      
      if (reverse && forceFrame === -1) {
        currentFrame = (frames - 1) - currentFrame;
      }
      
      // Known sprite sheet size: 1000x1000 (100x100 per frame)
      const frameWidth = 100;
      const frameHeight = 100;
      
      const drawWidth = width * 2.5; // Scale up to cover collision box
      const drawHeight = height * 2.5;
      const offsetX = x - (drawWidth - width) / 2;
      const offsetY = y - (drawHeight - height) / 2 - 20;

      this.ctx.save();
      // Handle facing direction
      if (boss.facing === -1) {
        this.ctx.translate(x + width / 2, y);
        this.ctx.scale(-1, 1);
        this.ctx.translate(-(x + width / 2), -y);
      }

      this.ctx.drawImage(
        this.bossSprite,
        currentFrame * frameWidth,
        row * frameHeight,
        frameWidth,
        frameHeight,
        offsetX,
        offsetY,
        drawWidth,
        drawHeight
      );

      this.ctx.restore();
    } else {
      // Fallback rectangle
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, y, width, height);

      // Inner pattern
      this.ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + 5, y + 10 + i * 15);
        this.ctx.lineTo(x + width - 5, y + 10 + i * 15);
        this.ctx.stroke();
      }

      // Eyes
      this.ctx.fillStyle = "#fff";
      const eyeOffset = boss.facing === 1 ? width - 18 : 6;
      this.ctx.fillRect(x + eyeOffset, y + 10, 5, 8);
      this.ctx.fillRect(x + eyeOffset + 8, y + 10, 5, 8);
    }

    this.ctx.shadowBlur = 0;
  }

  /** Draw projectiles */
  drawProjectiles(projectiles: Projectile[], boss?: BossState): void {
    for (const p of projectiles) {
      if (p.owner === "boss") {
        if (p.width >= 200 && this.isLaserSpriteLoaded) { // Laser Beam
           const maxLifetime = 0.9; // Tương ứng 9 frames theo thông báo
           const elapsed = Math.max(0, maxLifetime - p.lifetime);
           
           const totalFrames = 9;
           const frameOffset = 6; // Cắt bỏ 6 frame đánh lửa đầu tiên, bắt đầu từ frame 6 đến 14
           const frameHeight = 100;
           let currentFrame = Math.floor((elapsed / maxLifetime) * totalFrames);
           if (currentFrame >= totalFrames) currentFrame = totalFrames - 1;
           
           currentFrame += frameOffset;
           
           this.ctx.save();
           const leftFacing = boss && p.position.x < boss.position.x;
           let drawX = p.position.x;
           
           if (leftFacing) {
             this.ctx.translate(drawX + p.width / 2, p.position.y);
             this.ctx.scale(-1, 1);
             this.ctx.translate(-(drawX + p.width / 2), -p.position.y);
           }
           
           this.ctx.drawImage(
              this.laserSprite,
              0, currentFrame * frameHeight, 
              this.laserSprite.width, frameHeight, 
              // Adjusted Y offset so the larger laser rests properly
              drawX, p.position.y - p.height * 0.5, 
              p.width, p.height * 2 
            );
            this.ctx.restore();
            continue;
         } else if (p.width < 150) { // Ranged arm (up to 150px)
            this.ctx.save();
            
            // Vẽ khối cầu năng lượng dạ quang (Aura)
            this.ctx.globalCompositeOperation = "lighter";
            this.ctx.beginPath();
            this.ctx.arc(p.position.x + p.width / 2, p.position.y + p.height / 2, p.width / 2, 0, Math.PI * 2);
            this.ctx.fillStyle = "rgba(139, 0, 0, 0.4)";
            this.ctx.fill();
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = "#8b0000";
            this.ctx.fillStyle = "#8b0000";
            this.ctx.beginPath();
            this.ctx.arc(p.position.x + p.width / 2, p.position.y + p.height / 2, p.width / 3.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalCompositeOperation = "source-over";
            this.ctx.shadowBlur = 0;

            if (this.isArmSpriteLoaded) {
              const leftFacing = p.velocity.x < 0;
              if (leftFacing) {
                this.ctx.translate(p.position.x + p.width / 2, p.position.y + p.height / 2);
                this.ctx.scale(-1, 1);
                this.ctx.translate(-(p.position.x + p.width / 2), -(p.position.y + p.height / 2));
              }
              
              // Rotating arm
              this.ctx.translate(p.position.x + p.width/2, p.position.y + p.height/2);
              this.ctx.rotate((Date.now() * 0.015) % (Math.PI * 2));
              this.ctx.translate(-(p.position.x + p.width/2), -(p.position.y + p.height/2));
              
              this.ctx.drawImage(
                 this.armSprite,
                 p.position.x, p.position.y,
                 p.width, p.height
              );
            }
            this.ctx.restore();
            continue;
         }
      }

      // Default rendering if no sprite (or player's ranged attack)
      const baseColor = p.owner === "player" ? "#d4af37" : "#8b0000";
      const color = p.color || baseColor;
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 8;
      this.ctx.fillStyle = color;

      if (p.owner === "player") {
         this.ctx.save();
         const leftFacing = p.velocity.x < 0;
         
         const drawX = p.position.x;
         const drawY = p.position.y;
         const w = p.width; 
         const h = p.height; 
         
         if (leftFacing) {
            this.ctx.translate(drawX + w/2, drawY);
            this.ctx.scale(-1, 1);
            this.ctx.translate(-(drawX + w/2), -drawY);
         }
         
         // Vẽ kiếm khí (Sword Aura - Hình bán nguyệt)
         this.ctx.beginPath();
         this.ctx.moveTo(drawX - 5, drawY - 10);
         this.ctx.quadraticCurveTo(drawX + w + 15, drawY + h/2, drawX - 5, drawY + h + 10);
         this.ctx.quadraticCurveTo(drawX + w - 5, drawY + h/2, drawX - 5, drawY - 10);
         this.ctx.fill();
         this.ctx.restore();
      } else {
         if (p.isHoming) {
            this.ctx.beginPath();
            this.ctx.arc(p.position.x + p.width / 2, p.position.y + p.height / 2, p.width / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = "#fff";
            this.ctx.fillRect(p.position.x + p.width/4, p.position.y + p.height/3, 4, 4);
            this.ctx.fillRect(p.position.x + p.width * 0.75 - 4, p.position.y + p.height/3, 4, 4);
         } else {
            this.ctx.fillRect(p.position.x, p.position.y, p.width, p.height);
         }
      }
    }
    this.ctx.shadowBlur = 0;
  }

  /** Draw particles */
  drawParticles(particles: Particle[]): void {
    for (const p of particles) {
      const alpha = (p.lifetime / p.maxLifetime) * p.alpha;
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(
        p.position.x - p.size / 2,
        p.position.y - p.size / 2,
        p.size,
        p.size
      );
    }
    this.ctx.globalAlpha = 1;
  }

  /** Draw health bar for an entity */
  drawHealthBar(
    entity: Entity,
    color: string,
    offsetY: number = -20,
    barWidth?: number
  ): void {
    const w = barWidth || entity.width;
    const h = 6;
    const x = entity.position.x + (entity.width - w) / 2;
    const y = entity.position.y + offsetY;
    const ratio = Math.max(0, entity.health / entity.maxHealth);

    // Background
    this.ctx.fillStyle = HEALTH_BG;
    this.ctx.fillRect(x, y, w, h);

    // Health fill
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w * ratio, h);

    // Border
    this.ctx.strokeStyle = "rgba(255,255,255,0.2)";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, w, h);
  }

  /** Draw the boss health bar at top of screen */
  drawBossHealthBarUI(boss: BossState): void {
    const barW = Math.min(400, this.width * 0.5);
    const barH = 12;
    const x = (this.width - barW) / 2;
    const y = 30;
    const ratio = Math.max(0, boss.health / boss.maxHealth);
    const color = boss.config.colorScheme || BOSS_HEALTH_COLOR;

    // Boss name
    this.ctx.font = "bold 14px 'Courier New', monospace";
    this.ctx.fillStyle = color;
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      `◆ BOSS LV.${boss.config.level} ◆`,
      this.width / 2,
      y - 8
    );

    // Bar background
    this.ctx.fillStyle = HEALTH_BG;
    this.ctx.fillRect(x, y, barW, barH);

    // Bar fill with gradient
    const grad = this.ctx.createLinearGradient(x, y, x + barW * ratio, y);
    grad.addColorStop(0, color);
    grad.addColorStop(1, adjustAlpha(color, 0.7));
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(x, y, barW * ratio, barH);

    // Border
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, barW, barH);

    // HP text
    this.ctx.font = "10px 'Courier New', monospace";
    this.ctx.fillStyle = "#fff";
    this.ctx.fillText(
      `${Math.ceil(boss.health)} / ${boss.maxHealth}`,
      this.width / 2,
      y + barH + 14
    );
  }

  /** Draw player HUD (improved card style) */
  drawPlayerHUD(player: PlayerState, level: number, isPlayer2 = false): void {
    const cardW = 220;
    const cardH = 88;
    const cardX = isPlayer2 ? this.width - cardW - 16 : 16;
    const cardY = 16; // Top

    const primaryColor = isPlayer2 ? "#4a90e2" : PLAYER_HEALTH_COLOR;
    const borderColor = isPlayer2 ? "rgba(74, 144, 226, 0.3)" : "rgba(212, 175, 55, 0.3)";

    // HUD Background
    this.ctx.fillStyle = "rgba(10, 10, 20, 0.75)";
    this.ctx.beginPath();
    this.roundRect(cardX, cardY, cardW, cardH + 16, 6); // Tăng chiều cao thẻ thêm 16px để chứa dòng mới
    this.ctx.fill();
    this.ctx.strokeStyle = borderColor;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Death Count Banner (Màu sắc chữ nổi lên trên nền đỏ)
    const deathBannerY = cardY + cardH - 12;
    this.ctx.fillStyle = "rgba(200, 0, 0, 0.85)"; // Nền đỏ đục
    this.ctx.beginPath();
    this.roundRect(cardX + 8, deathBannerY, cardW - 16, 20, 3);
    this.ctx.fill();
    this.ctx.font = "bold 11px 'Courier New', monospace";
    this.ctx.fillStyle = "#ffffff"; // Chữ trắng nổi bật
    this.ctx.textAlign = "center";
    this.ctx.fillText(`DEATH COUNT: ${player.deathCount}`, cardX + cardW / 2, deathBannerY + 14);

    // Player icon
    this.ctx.fillStyle = primaryColor;
    this.ctx.fillRect(cardX + 12, cardY + 12, 8, 12);
    this.ctx.fillStyle = "#0a0a0f";
    this.ctx.fillRect(cardX + 17, cardY + 14, 2, 2);

    // HP label + value
    const ratio = Math.max(0, player.health / player.maxHealth);
    this.ctx.font = "bold 11px 'Courier New', monospace";
    this.ctx.fillStyle = "rgba(255,255,255,0.5)";
    this.ctx.textAlign = "left";
    this.ctx.fillText(isPlayer2 ? "P2 HP" : "P1 HP", cardX + 28, cardY + 22);
    this.ctx.fillStyle = ratio > 0.3 ? primaryColor : "#ff4757";
    this.ctx.font = "bold 13px 'Courier New', monospace";
    this.ctx.fillText(`${Math.ceil(player.health)} / ${player.maxHealth}`, cardX + 50, cardY + 22);

    // Health bar
    const barX = cardX + 12;
    const barY = cardY + 30;
    const barW = cardW - 24;
    const barH = 8;

    this.ctx.fillStyle = "rgba(255,255,255,0.08)";
    this.ctx.beginPath();
    this.roundRect(barX, barY, barW, barH, 3);
    this.ctx.fill();

    if (ratio > 0) {
      const hpColor = ratio > 0.3 ? primaryColor : "#ff4757";
      const grad = this.ctx.createLinearGradient(barX, barY, barX + barW * ratio, barY);
      grad.addColorStop(0, hpColor);
      grad.addColorStop(1, adjustAlpha(hpColor, 0.6));
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.roundRect(barX, barY, barW * ratio, barH, 3);
      this.ctx.fill();
    }

    // Score + Level row
    this.ctx.font = "10px 'Courier New', monospace";
    this.ctx.fillStyle = "rgba(255,255,255,0.4)";
    this.ctx.textAlign = "left";
    this.ctx.fillText(`SCORE`, barX, barY + 22);
    this.ctx.fillStyle = "#fff";
    this.ctx.fillText(`${player.score}`, barX + 42, barY + 22);

    this.ctx.fillStyle = "rgba(255,255,255,0.4)";
    this.ctx.fillText(`LV`, barX + 100, barY + 22);
    this.ctx.fillStyle = "#fff";
    this.ctx.fillText(`${level}`, barX + 118, barY + 22);

    // Cooldown circles
    const cdY = barY + 32;
    this.drawCooldownCircle(barX + 10, cdY, isPlayer2 ? "J" : "F", player.attackCooldown, 0.35, primaryColor);
    this.drawCooldownCircle(barX + 45, cdY, isPlayer2 ? "K" : "G", player.rangedCooldown, 0.6, "#8b0000");
    this.drawCooldownCircle(barX + 80, cdY, isPlayer2 ? "0" : "Sht", player.dashCooldown, 1.0, "#5c4033");
  }

  /** Draw a circular cooldown indicator */
  private drawCooldownCircle(
    cx: number,
    cy: number,
    label: string,
    current: number,
    max: number,
    color: string
  ): void {
    const r = 10;
    const ready = current <= 0;
    const progress = ready ? 1 : 1 - current / max;

    // Background circle
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fillStyle = "rgba(255,255,255,0.06)";
    this.ctx.fill();

    // Progress arc
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    this.ctx.closePath();
    this.ctx.fillStyle = ready ? adjustAlpha(color, 0.5) : adjustAlpha(color, 0.25);
    this.ctx.fill();

    // Border
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.strokeStyle = ready ? color : "rgba(255,255,255,0.15)";
    this.ctx.lineWidth = ready ? 1.5 : 1;
    this.ctx.stroke();

    // Label
    this.ctx.font = "bold 8px 'Courier New', monospace";
    this.ctx.fillStyle = ready ? color : "rgba(255,255,255,0.35)";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(label, cx, cy);
    this.ctx.textBaseline = "alphabetic";
  }

  /** Helper for rounded rectangle path */
  private roundRect(x: number, y: number, w: number, h: number, radius: number): void {
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + w - radius, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    this.ctx.lineTo(x + w, y + h - radius);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    this.ctx.lineTo(x + radius, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
  }

  /** Draw FPS counter */
  drawFPS(fps: number): void {
    this.ctx.font = "10px 'Courier New', monospace";
    this.ctx.fillStyle = "rgba(255,255,255,0.3)";
    this.ctx.textAlign = "right";
    this.ctx.fillText(`FPS: ${fps}`, this.width - 10, 20);
  }

  /** Draw taunt message from boss */
  drawTaunt(message: string, alpha: number): void {
    if (!message || alpha <= 0) return;
    this.ctx.globalAlpha = alpha;
    this.ctx.font = "bold 16px 'Press Start 2P', monospace";
    this.ctx.fillStyle = "#8b0000";
    this.ctx.textAlign = "center";
    // Glitch effect on text
    const offsetX = Math.random() * 3 - 1.5;
    this.ctx.fillText(`"${message}"`, this.width / 2 + offsetX, 80);
    this.ctx.globalAlpha = 1;
  }

  /** Full render pass */
  render(state: GameState): void {
    this.beginFrame(state.screenShake);
    this.drawPlatforms(state.map.platforms);
    // Draw characters first
    this.drawBoss(state.boss);
    for (const minion of state.minions) {
      if (minion.health > 0) this.drawBoss(minion);
    }
    this.drawPlayer(state.player);
    if (state.player2 && state.player2.health > 0) {
       this.drawPlayer(state.player2, true);
    }
    // Then draw projectiles so they overlap the characters
    this.drawProjectiles(state.projectiles, state.boss);
    
    this.drawParticles(state.particles);
    this.drawBossHealthBarUI(state.boss);
    this.drawPlayerHUD(state.player, state.level);
    if (state.player2) {
       this.drawPlayerHUD(state.player2, state.level, true);
    }
    this.drawFPS(state.fps);

    // Taunt display
    if (state.boss.currentTaunt && state.boss.tauntTimer > 0) {
      const alpha = Math.min(1, state.boss.tauntTimer);
      this.drawTaunt(state.boss.currentTaunt, alpha);
    }

    if (state.boss.health <= 0) {
       this.drawProceedInstruction();
    }

    this.endFrame();
  }

  private drawProceedInstruction() {
    this.ctx.font = "bold 24px 'Courier New', monospace";
    this.ctx.fillStyle = "#ffffff";
    this.ctx.textAlign = "center";
    this.ctx.shadowColor = "#d4af37";
    this.ctx.shadowBlur = 15;
    
    // Tạo hiệu ứng nhấp nháy 
    const alpha = 0.5 + Math.abs(Math.sin(Date.now() * 0.003)) * 0.5;
    this.ctx.globalAlpha = alpha;
    
    this.ctx.fillText("▶ TIẾN VỀ BÊN PHẢI ĐỂ QUA MÀN ▶", this.width / 2, this.height / 2 - 50);
    
    this.ctx.shadowBlur = 0;
    this.ctx.globalAlpha = 1;
  }
}

/** Adjust any CSS color's alpha. Handles hex, hsl, rgb, named colors. */
const _colorCanvas = typeof document !== "undefined"
  ? (() => { const c = document.createElement("canvas"); c.width = 1; c.height = 1; return c; })()
  : null;

function adjustAlpha(color: string, alpha: number): string {
  // Fast path for hex
  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
    const r = parseInt(color.length === 7 ? color.slice(1, 3) : color[1] + color[1], 16);
    const g = parseInt(color.length === 7 ? color.slice(3, 5) : color[2] + color[2], 16);
    const b = parseInt(color.length === 7 ? color.slice(5, 7) : color[3] + color[3], 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  // Fallback: render color to canvas and read back RGB
  if (_colorCanvas) {
    const ctx = _colorCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  // SSR fallback
  return color;
}
