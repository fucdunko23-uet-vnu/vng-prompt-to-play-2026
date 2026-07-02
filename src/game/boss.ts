// ========================
// Mecha-stone Boss Entity: Frame-based FSM
// ========================

import {
  BossConfig,
  BossState,
  MapData,
  Particle,
  PlayerState,
  Projectile,
} from "./types";
import {
  applyGravity,
  moveAndCollide,
  clampToBounds,
  horizontalDistance,
  directionTo,
  getAttackRect,
  aabbOverlap,
  getEntityRect,
} from "./physics";
import { sfx } from "./audio";

const DEFAULT_PROJECTILE_SPEED = 350;

/** Default Mecha-stone config */
export function getDefaultBossConfig(level: number): BossConfig {
  return {
    level,
    health: 200 + level * 50,
    speed: 100 + level * 10,
    attackDamage: 15 + level * 3,
    bodyWidth: 90,
    bodyHeight: 100,
    unlockedSkills: [
      {
        id: "ground_smash",
        name: "Đại Địa Chấn",
        damage: 15 + level * 3,
        range: 180,       // Tầm gần — only triggers when close
        cooldown: 2.0,
        aoeRadius: 160,   // Vùng sát thương rộng hơn body
        knockback: 300,
        castTime: 0.7,
      },
      {
        id: "horizontal_laser",
        name: "Laze Hủy Diệt",
        damage: 25 + level * 5,
        range: 700,       // Tầm xa — preferred khi player ở khoảng cách trung/xa
        cooldown: 5.0,
        projectileSpeed: 0,
        projectileSize: 1.2,
        duration: 0.9,
        castTime: 0.7,
      },
      {
        id: "single_shot",
        name: "Linh Hồn Pháo",
        damage: 15 + level * 5,
        range: 650,
        cooldown: 1.5,
        castTime: 0.5,
      }
    ],
    behaviorPattern: "adaptive",
    tauntMessage: level === 1 ? "Ngươi gọi đây là khiêu chiến sao?" : "",
    colorScheme: "#8b0000",
    aiAwarenessLevel: Math.min(level, 10),
  };
}

export function createBoss(x: number, y: number, config: BossConfig): BossState {
  return {
    position: { x, y },
    velocity: { x: 0, y: 0 },
    width: config.bodyWidth ?? 90,
    height: config.bodyHeight ?? 100,
    health: config.health,
    maxHealth: config.health,
    facing: -1,
    isGrounded: false,
    config,
    attackCooldown: 1.5,
    currentPhase: 0,
    isAttacking: false,
    attackTimer: 0,
    specialCooldowns: new Map(),
    tauntTimer: config.tauntMessage ? 3.0 : 0,
    currentTaunt: config.tauntMessage,
    animState: "appearance",
    animTimer: 1.4,
    isBlocking: false,
  };
}

export function updateBoss(
  boss: BossState,
  player: PlayerState,
  projectiles: Projectile[],
  map: MapData,
  dt: number
): { newProjectiles: Projectile[]; newParticles: Particle[]; damageToPlayer: number; newMinions?: BossState[]; enteredPhase2?: boolean } {
  const newProjectiles: Projectile[] = [];
  const newParticles: Particle[] = [];
  const newMinions: BossState[] = [];
  let damageToPlayer = 0;
  let enteredPhase2 = false;

  // Berserk / Phase Check
  const healthRatio = boss.health / boss.maxHealth;
  const isBerserk = healthRatio <= 0.3 && boss.currentPhase > 0;
  const cooldownMultiplier = isBerserk ? 1.6 : 1.0;

  // Update Timers
  boss.attackCooldown = Math.max(0, boss.attackCooldown - dt * cooldownMultiplier);
  boss.tauntTimer = Math.max(0, boss.tauntTimer - dt);
  boss.animTimer = Math.max(0, boss.animTimer - dt);
  boss.specialCooldowns.forEach((val, key) => boss.specialCooldowns.set(key, Math.max(0, val - dt * cooldownMultiplier)));

  // Death State Check
  if (boss.health <= 0 && boss.animState !== "defeated") {
    setBossAnim(boss, "defeated", 1.4); // 14 frames defeated
    boss.velocity.x = 0;
  }

  if (healthRatio <= 0.5 && boss.currentPhase === 0 && boss.animState !== "defeated") {
    boss.currentPhase = 1;
    enteredPhase2 = true;
    setBossAnim(boss, "glowing", 0.8); // 8 frames glowing
    boss.velocity.x = 0;
    
    // Áp dụng Desperation Mode
    if (boss.config.desperationMode === "enrage") {
       boss.config.speed *= 1.5;
       boss.config.attackDamage *= 1.5;
       boss.currentTaunt = "GIẬN DỮ TỘT CÙNG!";
    } else if (boss.config.desperationMode === "cloning") {
       boss.currentTaunt = "Đội quân bất tử, LÊN!";
       const cloneConfig: BossConfig = {
           ...boss.config,
           health: boss.maxHealth * 0.2,
           attackDamage: boss.config.attackDamage * 0.5,
           bodyWidth: boss.width * 0.6,
           bodyHeight: boss.height * 0.6,
           unlockedSkills: boss.config.unlockedSkills.filter(s => s.id === "charge" || s.id === "single_shot"),
           behaviorPattern: "aggressive",
           desperationMode: "none",
           auraType: "none"
       };
       for (let i = 0; i < 2; i++) {
          const minion = createBoss(boss.position.x + (i===0?-80:80), boss.position.y, cloneConfig);
          minion.isMinion = true;
          newMinions.push(minion);
       }
    } else if (boss.config.desperationMode === "bullet_hell") {
       boss.currentTaunt = "BÃO ĐẠN HOÀNG KIM!";
    } else {
       boss.currentTaunt = "Cảnh báo... Nguy hiểm...";
    }
    boss.tauntTimer = 3.0;
  }

  // Bullet Hell Passive (Bắn đạn liên tục khi ở Phase 2)
  if (boss.currentPhase > 0 && boss.config.desperationMode === "bullet_hell" && boss.animState !== "defeated") {
     const bhCd = boss.specialCooldowns.get("bullet_hell") || 0;
     if (bhCd <= 0) {
        boss.specialCooldowns.set("bullet_hell", 0.4); 
        newProjectiles.push({
           position: { x: boss.position.x + boss.width/2, y: boss.position.y + 20 },
           velocity: { x: (Math.random()-0.5)*300, y: -200 - Math.random()*200 },
           width: 15, height: 15, damage: boss.config.attackDamage * 0.4,
           owner: "boss", lifetime: 4, color: "#ffff00"
        });
     }
  }

  // --- Ai Dodge Logic Nhận diện né chiêu ---
  const dodgeCd = boss.specialCooldowns.get("dodge") || 0;
  if (dodgeCd <= 0 && boss.animState !== "defeated" && boss.animState !== "laser_beam" && boss.animState !== "laser_cast" && boss.animState !== "block") {
    // Detect incoming player threats
    const incomingProj = projectiles.find(p => p.owner === "player" && Math.abs(p.position.x - boss.position.x) < 280 && Math.abs(p.position.y - boss.position.y) < 150);
    const incomingMelee = player.isAttacking && player.attackTimer > 0 && horizontalDistance(boss, player) < 150;
    
    if (incomingProj || incomingMelee) {
      // Xác suất né cực cao ở AI level 10 (Lên đến ~90%)
      let dodgeChance = 0.2 + Math.min(10, boss.config.aiAwarenessLevel) * 0.07;
      
      // Nếu Awareness cao, 100% né đạn của người chơi khi người đang có iFrames (Tiết kiệm lượng máu vô ích)
      if (boss.config.aiAwarenessLevel >= 7 && player.invincibleTimer > 0) {
         dodgeChance = 1.0; 
      }

      if (Math.random() < dodgeChance) {
        boss.specialCooldowns.set("dodge", boss.config.aiAwarenessLevel > 7 ? 1.0 : 2.5);
        
        // Phát hạt (particle effect) khi né
        for (let i=0; i<10; i++) {
           newParticles.push({
             position: { x: boss.position.x + boss.width/2, y: boss.position.y + boss.height/2 },
             velocity: { x: (Math.random()-0.5)*300, y: (Math.random()-0.5)*300 },
             color: "#aaffff", size: 3, lifetime: 0.3, maxLifetime: 0.3, alpha: 0.6
           });
        }

        if (Math.random() < 0.5 || boss.config.unlockedSkills.find(s=>s.id==="teleport")) {
          // Teleport/Backdash
          setBossAnim(boss, "appearance", 0.3);
          const safeDir = (boss.position.x > player.position.x) ? 1 : -1;
          boss.position.x += safeDir * 300;
          boss.position.y -= 80;
        } else {
          // Hop away
          setBossAnim(boss, "moving", 0.4);
          boss.velocity.x = -boss.facing * 1000;
          boss.velocity.y = -350;
        }
        boss.currentTaunt = Math.random() < 0.5 ? "Đọc vị!" : "Chậm quá!";
        boss.tauntTimer = 1.0;
      }
    }
  }

  // --- Ai Block & Parry Logic ---
  // Nếu dodge đang cooldown, Boss > AI Lv 4 sẽ thử chặn đòn thay vì ăn trọn sát thương.
  if (!boss.isBlocking && boss.animState !== "defeated" && boss.animState !== "laser_beam" && boss.animState !== "laser_cast" && boss.animState !== "block") {
     const incomingProj = projectiles.find(p => p.owner === "player" && Math.abs(p.position.x - boss.position.x) < 180 && Math.abs(p.position.y - boss.position.y) < 80);
     const incomingMelee = player.isAttacking && player.attackTimer > 0 && horizontalDistance(boss, player) < 130;
     
     if (incomingProj || incomingMelee) {
        let blockChance = boss.config.aiAwarenessLevel * 0.06;
        if (dodgeCd > 0 && Math.random() < blockChance) { 
           // Parry / Đỡ đòn
           setBossAnim(boss, "block", 0.6);
           boss.isBlocking = true;
           boss.currentTaunt = Math.random() < 0.5 ? "Vô ích!" : "Quá chậm!";
           boss.tauntTimer = 0.8;
           // Nếu khoảng cách rất gần, Boss trả đòn nhanh giảm cooldown
           if (incomingMelee) {
               boss.attackCooldown = 0;
           }
        }
     }
  }

  // Animation FSM transitions
  if (boss.animTimer <= 0 && boss.animState !== "defeated" && boss.animState !== "idle" && boss.animState !== "moving") {
    if (boss.animState === "appearance") {
      setBossAnim(boss, "idle", 0.1);
    } else if (boss.animState === "glowing") {
      setBossAnim(boss, "armor_buff", 1.1); // 11 frames armor_buff
    } else if (boss.animState === "laser_cast") {
      sfx.playBossLaser();
      const laserSkill = boss.config.unlockedSkills.find(s => s.id === "horizontal_laser");
      const beamDuration = laserSkill?.duration ?? 0.9;
      const sizeMultiplier = laserSkill?.projectileSize ?? 1.2;
      const beamWidth = Math.round(1200 * sizeMultiplier);
      const beamHeight = Math.round(80 * sizeMultiplier);

      setBossAnim(boss, "laser_beam", beamDuration);
      newProjectiles.push({
         position: { x: boss.facing === 1 ? boss.position.x + boss.width : boss.position.x - beamWidth, y: boss.position.y + 45 },
         velocity: { x: 0, y: 0 },
         width: beamWidth,
         height: beamHeight,
         damage: laserSkill ? laserSkill.damage : 30,
         owner: "boss",
         lifetime: beamDuration,
      });
      // Spawn intense particles
      for (let i = 0; i < 15; i++) {
        newParticles.push({
           position: { x: boss.position.x + (boss.facing === 1 ? boss.width : 0), y: boss.position.y + 50 },
           velocity: { x: boss.facing * (200 + Math.random() * 200), y: (Math.random() - 0.5) * 100 },
           color: "#ff0000",
           size: 4 + Math.random() * 4,
           lifetime: 0.5,
           maxLifetime: 0.5,
           alpha: 1,
        });
      }
    } else if (boss.animState === "ranged") {
       sfx.playBossMagic();
       createBossRangedProjectile(boss, newProjectiles, player);
       setBossAnim(boss, "idle", 0.1);
    } else {
      // Returns to idle after attacks or blocks
      setBossAnim(boss, "idle", 0.1);
      boss.isBlocking = false;
    }
  }

  // Active Logic for Idle / Moving states
  if ((boss.animState === "idle" || boss.animState === "moving") && player.health > 0) {
    const dist = horizontalDistance(boss, player);
    boss.facing = directionTo(boss, player);
    
    // Chọn skill thông minh dựa trên khoảng cách
    if (boss.attackCooldown <= 0) {
      // Lọc skill đã hết cooldown
      const readySkills = boss.config.unlockedSkills.filter(s => {
         const cd = boss.specialCooldowns.get(s.id) || 0;
         return cd <= 0;
      });

      // Tính điểm ưu tiên cho từng skill dựa trên khoảng cách và loại AI
      const behavior = boss.config.behaviorPattern;
      const scored = readySkills.map(s => {
        let score = 0;
        const inRange = dist <= s.range;

        // Chiêu cận chiến (ground_smash): Rất nguy hiểm nếu đứng gần
        if (s.id === "ground_smash") {
          if (inRange) {
            score = 10 - (dist / s.range) * 3;
            if (behavior === "aggressive") score += 3; // Lên ưu tiên nếu hung hãn
          } else {
            score = -1; // Xa là bỏ
          }
        }
        // Chiêu tầm xa (Laser): Quét toàn bản đồ, cực kỳ ưu tiên khi Player trốn xa
        else if (s.id === "horizontal_laser") {
          if (dist < 150) score = 1; // Quá gần dễ hụt
          else score = 7 + (dist / 800) * 5; // Càng xa điểm càng cao
          if (behavior === "kiting" || behavior === "defensive") score += 3; // AI thích tỉa máu
        }
        // Teleport: Rút ngắn khoảng cách đột ngột
        else if (s.id === "teleport") {
          score = dist > 400 ? 9 : (dist > 150 ? 4 : 0);
          if (behavior === "aggressive" && dist > 250) score += 4; // Cực kỳ thích áp sát nhanh
        }
        // Charge: Lướt tới
        else if (s.id === "charge") {
          score = (dist > 200 && dist < 600) ? 8 : 2;
          if (behavior === "aggressive") score += 2;
        }
        // Fly AOE (Thiên Thạch Vũ / Meteor Rain): Ưu tiên rất cao để biểu diễn!
        else if (s.id === "fly_laser_aoe") {
          score = dist < 400 ? 15 : 10;
          if (behavior === "defensive") score += 5;
        }
        // Summon Adds (Triệu Hồi Ma Quỷ): Ưu tiên cao để tạo áp lực
        else if (s.id === "summon_adds") {
          score = dist > 300 ? 12 : 8;
          if (behavior === "adaptive") score += 4;
        }
        // Hố đen vũ trụ: Thích hợp mọi cự ly, đặc biệt làm phiền khi ở xa
        else if (s.id === "black_hole") {
          score = 8;
          if (behavior === "defensive") score += 3;
        }
        // Tên lửa truy kích: Rất tà giáo khi player nấp
        else if (s.id === "homing_missiles") {
          score = dist > 300 ? 10 : 4;
        }
        else if (s.id === "single_shot") {
          score = (dist > 250 && dist < 700) ? 6 : 2;
          if (behavior === "kiting") score += 2;
        }
        else if (s.id === "meteor_rain") {
          score = 12; // Mưa sao băng thích hợp tung ở mọi hoàn cảnh
          if (player.isGrounded) score += 5; // Cực kỳ hiệu quả nếu người chơi đang chạy trên đất
        }
        else {
          score = inRange ? 4 : 0;
        }

        // Thêm logic thông minh tuỳ thuộc trạng thái player
        // 1. Phân tích chiều dọc (Player đang bay/nhảy lên cao hay ở dưới)
        const verticalDiff = boss.position.y - player.position.y;
        if (verticalDiff > 80) { // Player đang ở trên không 
           if (s.id === "fly_laser_aoe" || s.id === "single_shot") score += 5;
           if (s.id === "ground_smash") score = -1; // Đập đất là lãng phí khi player bay
        }

        // 2. Nếu Player vừa bị dính đòn (đang có khung hình bất tử chớp nháy), Boss nên thủ hoặc bỏ chạy chứ ko xài mồi to
        if (player.invincibleTimer > 0) {
           if (s.id === "teleport" || s.id === "summon_adds") score += 4; // Rảnh thì spam chặn hoặc chuồn
           if (s.id === "horizontal_laser" || s.id === "fly_laser_aoe" || s.id === "charge") score -= 5;
        }

        // Tăng trí thông minh: Ép góc & Combo
        if (boss.config.aiAwarenessLevel >= 6) {
           if (s.id === "ground_smash" && dist < 120) score += 10;
           if (s.id === "single_shot" && player.isGrounded === false) score += 5; // Bắn bồi khi player đang bay ngã
           
           // 3. Đón đầu nếu player đang lướt nhanh hoặc đang sạc (Smart Intercept & Punish)
           if (boss.config.aiAwarenessLevel >= 8) {
              // Nếu player đang di chuyển nhanh, đón đầu bằng charge hoặc teleport
              if (Math.abs(player.velocity.x) > 250) {
                 if (s.id === "teleport") score += 8;
                 if (s.id === "charge") score += 6;
                 if (s.id === "horizontal_laser") score -= 5; // Dễ hụt
              }
              // Trừng phạt khi player vừa dùng xong dash (hết lướt)
              if (player.dashCooldown > 0.5) {
                 if (s.id === "ground_smash" || s.id === "horizontal_laser" || s.id === "fly_laser_aoe") score += 5; // Tranh thủ burst damage
              }
           }
        }

        // Thêm tính ngẫu nhiên (1-3 điểm) để không đánh theo script 100%
        score += Math.random() * 3;
        return { skill: s, score };
      }).filter(s => s.score > 0);

      // Lựa chọn skill theo xác suất (Weighted Probability). Chiêu điểm cao ra nhiều hơn, chiêu điểm thấp vẫn có tỉ lệ ra
      if (scored.length > 0) {
        const totalWeight = scored.reduce((sum, s) => sum + s.score, 0);
        let randomVal = Math.random() * totalWeight;
        let selectedSkill = scored[0].skill;
        for (const s of scored) {
           randomVal -= s.score;
           if (randomVal <= 0) {
              selectedSkill = s.skill;
              break;
           }
        }
        const skill = selectedSkill;

        const castTime = skill.castTime ?? 0.7;
        const projSpeed = skill.projectileSpeed ?? DEFAULT_PROJECTILE_SPEED;
        const sizeMultiplier = skill.projectileSize ?? 1.0;
        const projCount = skill.projectileCount ?? 8;

        switch (skill.id) {
          case "horizontal_laser":
             setBossAnim(boss, "laser_cast", castTime); 
             break;
          case "ground_smash":
             sfx.playBossSmash();
             setBossAnim(boss, "melee", castTime); 
             break;
          case "fly_laser_aoe":
             sfx.playBossMagic();
             setBossAnim(boss, "armor_buff", skill.duration ?? 1.1);
             boss.velocity.y = -400;
             for (let i = 0; i < projCount; i++) {
               const angle = (Math.PI * 2 / projCount) * i;
               const pSize = Math.round(35 * sizeMultiplier); 
               // Giảm tốc độ đạn từ mặc định (350) xuống tầm ~120-180 để tạo kiểu bullet hell
               const speed = 120 + Math.random() * 50; 
               newProjectiles.push({
                  position: { x: boss.position.x + boss.width/2, y: boss.position.y + boss.height/2 },
                  velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
                  width: pSize, height: pSize, damage: skill.damage, owner: "boss", lifetime: skill.duration ?? 4
               });
             }
             break;
          case "teleport":
             setBossAnim(boss, "appearance", castTime);
             boss.position.x = player.position.x + (boss.position.x > player.position.x ? 120 : -120);
             boss.position.y = player.position.y - 50; 
             // Combo AI cao: Teleport nhảy theo sau ép góc ground_smash trực tiếp 
             if (boss.config.aiAwarenessLevel >= 7) {
                 boss.specialCooldowns.set("ground_smash", 0);
                 boss.attackCooldown = 0.3; // Ra chiêu đập đất nhanh hơn sau khi đáp
             }
             break;
          case "charge":
             setBossAnim(boss, "moving", skill.duration ?? 0.5);
             const spd = projSpeed > 0 ? projSpeed * 2 : 800;
             boss.velocity.x = boss.facing * spd * (player.hasSlowAura ? 0.75 : 1.0);
             boss.currentTaunt = "Lưỡi Hái Tử Thần!";
             boss.tauntTimer = 1.0;
             break;
          case "summon_adds":
             sfx.playBossMagic();
             setBossAnim(boss, "block", skill.duration ?? 0.9);
             boss.isBlocking = true;
             boss.currentTaunt = "Đến đây, các bản sao!";
             boss.tauntTimer = 1.5;
             const cloneConfig: BossConfig = {
                 ...boss.config,
                 health: boss.config.health * 0.25,
                 speed: boss.config.speed * 1.5,
                 attackDamage: boss.config.attackDamage * 0.5,
                 bodyWidth: boss.width * 0.6,
                 bodyHeight: boss.height * 0.6,
                 unlockedSkills: boss.config.unlockedSkills.filter(s => s.id === "ground_smash" || s.id === "charge"),
                 behaviorPattern: "aggressive",
             };
             for (let i = 0; i < 2; i++) {
                const minion = createBoss(boss.position.x + boss.width/2 + (i===0?-50:50), boss.position.y, cloneConfig);
                minion.isMinion = true;
                newMinions.push(minion);
                for(let k=0;k<15;k++){
                  newParticles.push({
                     position: { x: minion.position.x + minion.width/2, y: minion.position.y + minion.height/2 },
                     velocity: { x: (Math.random()-0.5)*300, y: (Math.random()-0.5)*300 },
                     color: "#d500f9",
                     size: 4 + Math.random()*2, lifetime: 0.6, maxLifetime: 0.6, alpha: 1
                  });
                }
             }
             break;
          case "single_shot":
             setBossAnim(boss, "ranged", castTime);
             break;
          case "homing_missiles":
             sfx.playBossMagic();
             setBossAnim(boss, "ranged", castTime);
             for (let i = 0; i < 3; i++) {
                newProjectiles.push({
                  position: { x: boss.position.x + boss.width/2, y: boss.position.y - 20 },
                  velocity: { x: boss.facing * (150 + Math.random()*100), y: -200 - Math.random()*200 },
                  width: 15 * sizeMultiplier, height: 15 * sizeMultiplier,
                  damage: skill.damage, owner: "boss", lifetime: skill.duration ?? 4,
                  isHoming: true, color: "#ff00ff"
                });
             }
             break;
          case "black_hole":
             sfx.playBossMagic();
             setBossAnim(boss, "glowing", castTime);
             newProjectiles.push({
                position: { x: player.position.x - 75 * sizeMultiplier, y: player.position.y - 120 }, // Spawns above player
                velocity: { x: 0, y: 0 },
                width: 150 * sizeMultiplier, height: 150 * sizeMultiplier,
                damage: skill.damage, owner: "boss", lifetime: skill.duration ?? 3,
                color: "#110033", // Distinct color for renderer / engine
             });
             break;
          case "meteor_rain":
             sfx.playBossMagic();
             setBossAnim(boss, "armor_buff", castTime);
             boss.currentTaunt = "Nhận lấy thiên phạt đây!";
             boss.tauntTimer = 2.0;
             for (let i = 0; i < 15; i++) {
                const rx = map.bounds.x + (Math.random() * map.bounds.width);
                const ry = map.bounds.y - 100 - Math.random() * 500; // Rơi rải rác từ trên cao
                newProjectiles.push({
                   position: { x: rx, y: ry },
                   velocity: { x: (Math.random()-0.5)*100, y: 300 + Math.random()*200 },
                   width: 30 * sizeMultiplier, height: 50 * sizeMultiplier,
                   damage: skill.damage, owner: "boss", lifetime: 6, color: "#ff4400"
                });
             }
             break;
          default: 
             setBossAnim(boss, "melee", castTime);
             break;
        }
        boss.specialCooldowns.set(skill.id, skill.cooldown);
        boss.attackCooldown = 0.8; // GCD giữa các chiêu
      }
    } 


    // Movement — tiến vào tầm skill gần nhất có sẵn
    if (boss.animState === "idle" || boss.animState === "moving") {
      // Tìm skill khả dụng gần nhất (ready hoặc sắp ready) để tiến vào tầm
      const targetRange = getOptimalApproachRange(boss);
      const slowMulti = player.hasSlowAura ? 0.75 : 1.0;
      if (dist > targetRange) {
        boss.animState = "moving"; 

        // Trí thông minh cấp cao: Ép góc khi di chuyển. Nếu player chạy ra xa, tăng tốc độ truy đuổi!
        let speedBoost = boss.currentPhase > 0 ? 1.3 : 1;
        if (boss.config.aiAwarenessLevel >= 7 && Math.abs(player.velocity.x) > 100 && Math.sign(player.velocity.x) === boss.facing) {
           speedBoost *= 1.5; // Chạy nhanh bắt kịp player
        }
        boss.velocity.x = boss.facing * boss.config.speed * speedBoost * slowMulti;
        
        // Nhảy ngẫu nhiên hoặc AI xịn cố tình nhảy qua đạn tầm thấp bay tới
        if (boss.config.aiAwarenessLevel >= 5 && boss.isGrounded) {
             const lowerBound = boss.position.y + boss.height * 0.4;
             const incomingLowProj = projectiles.find(p => p.owner === "player" && p.position.y > lowerBound && Math.abs(p.position.x - boss.position.x) < 250);
             
             if (incomingLowProj || Math.random() < 0.015) {
                 boss.velocity.y = -500; // Bật nhảy tránh đòn
                 if (incomingLowProj) {
                    boss.currentTaunt = "Dễ đoán quá!";
                    boss.tauntTimer = 0.5;
                 }
             }
        }
      } else if (dist <= targetRange * 0.4 && (boss.config.behaviorPattern === "kiting" || boss.config.behaviorPattern === "defensive")) {
        // AI dạng Kiting/Thủ biết lùi ra giữ khoảng cách an toàn thay vì đứng im
        boss.velocity.x = -boss.facing * boss.config.speed * 1.2 * slowMulti;
        boss.animState = "moving";
      } else {
        boss.velocity.x = 0;
        boss.animState = "idle";
      }
    }
  } else {
    // Locked in animation (attacking/blocking/dead)
    if (boss.animState !== "moving") {
      boss.velocity.x = 0;
    }
  }

  // Apply Melee/Ground Smash Damage — sử dụng aoeRadius, knockback từ config
  if (boss.animState === "melee" && boss.animTimer > 0.3 && boss.animTimer < 0.5) {
     const smashSkill = boss.config.unlockedSkills.find(s => s.id === "ground_smash");
     const rng = smashSkill?.aoeRadius ?? smashSkill?.range ?? 180;
     const atkRect = getAttackRect(boss, rng, boss.height - 10);
     
     // Thêm hạt dậm đất (Chỉ xả hạt ở frame đầu tiên của lúc dậm)
     if (boss.animTimer > 0.45) {
        for (let i = 0; i < 30; i++) {
          newParticles.push({
            position: { x: boss.position.x + boss.width / 2 + (Math.random() - 0.5) * rng, y: boss.position.y + boss.height },
            velocity: { x: (Math.random() - 0.5) * 400, y: -(Math.random() * 200 + 50) },
            color: "#ff5722",
            size: 6 + Math.random() * 6,
            lifetime: 0.6,
            maxLifetime: 0.6,
            alpha: 1,
          });
        }
     }

     const playerRect = getEntityRect(player);
     if (aabbOverlap(atkRect, playerRect) && player.invincibleTimer <= 0) {
       damageToPlayer = smashSkill ? smashSkill.damage : boss.config.attackDamage;
       // Knockback tunable
       const kb = smashSkill?.knockback ?? 250;
       player.velocity.x = -boss.facing * kb;
       player.velocity.y = -kb * 0.6;
     }
  }

  // Contact damage during Charge
  const isCharging = boss.animState === "moving" && Math.abs(boss.velocity.x) > boss.config.speed * 2;
  if (isCharging) {
     if (aabbOverlap(getEntityRect(boss), getEntityRect(player)) && player.invincibleTimer <= 0) {
       damageToPlayer = 20;
       player.velocity.x = boss.facing * 400;
       player.velocity.y = -200;
     }
  }

  // Physics
  applyGravity(boss, dt);
  moveAndCollide(boss, map.platforms, dt);
  clampToBounds(boss, map.bounds);

  return { newProjectiles, newParticles, damageToPlayer, newMinions, enteredPhase2 };
}

/** Tính tầm tiếp cận tối ưu dựa trên skill sẵn sàng */
function getOptimalApproachRange(boss: BossState): number {
  // Ưu tiên skill gần nhất đã sẵn sàng (hoặc gần hết CD)
  let bestRange = 180; // Fallback: tiến sát để đánh melee
  let bestPriority = -1;

  for (const skill of boss.config.unlockedSkills) {
    const cd = boss.specialCooldowns.get(skill.id) || 0;
    if (cd > 2) continue; // Skip skill còn CD quá lâu

    // Skill cận chiến → ưu tiên cao khi CD gần hết
    if (skill.id === "ground_smash" || skill.id === "charge") {
      const priority = cd <= 0 ? 10 : 5;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestRange = skill.range * 0.85;
      }
    }
    // Skill tầm xa → giữ khoảng cách nếu sẵn sàng
    else if (skill.id === "horizontal_laser") {
      const priority = cd <= 0 ? 8 : 3;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestRange = skill.range * 0.7; // Tiến vào ~70% range
      }
    } else if (skill.id === "single_shot") {
      const priority = cd <= 0 ? 7 : 3;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestRange = skill.range * 0.8;
      }
    } else {
      const priority = cd <= 0 ? 6 : 2;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestRange = Math.min(skill.range * 0.8, 300);
      }
    }
  }

  return bestRange;
}

function setBossAnim(boss: BossState, anim: typeof boss.animState, time: number) {
  boss.animState = anim;
  boss.animTimer = time;
}

function createBossRangedProjectile(boss: BossState, projectiles: Projectile[], player: PlayerState) {
   const speed = DEFAULT_PROJECTILE_SPEED * 1.5;
   const projX = boss.facing === 1 ? boss.position.x + boss.width : boss.position.x - 20;

   // Predictive Aiming - AI tính toán vị trí bay của player
   const t = horizontalDistance(boss, player) / speed;
   const predictionFactor = boss.config.aiAwarenessLevel >= 8 ? 1.0 : (boss.config.aiAwarenessLevel > 4 ? 0.6 : 0);
   
   // Bắt bài Dash: Nếu player đang chạy lướt (shift) nhanh, dự đoán trước đầu xa hơn một khúc
   const isDashing = Math.abs(player.velocity.x) > 350;
   const dashMult = isDashing ? 1.3 : 1.0;
   
   const targetX = player.position.x + player.width/2 + player.velocity.x * t * predictionFactor * dashMult;
   
   // Dự đoán rơi (Gravity)
   const yPrediction = boss.config.aiAwarenessLevel >= 7 ? player.velocity.y * t : (player.velocity.y > 0 ? player.velocity.y * t * 0.5 : 0);
   const targetY = player.position.y + player.height/2 + yPrediction * predictionFactor;
   
   const dx = targetX - projX;
   const dy = targetY - (boss.position.y + boss.height / 2);
   const dist = Math.sqrt(dx*dx + dy*dy) || 1;
   
   const baseAngle = Math.atan2(dy, dx);

   // AI level cao -> Xả Shotgun/chùm đạn (spread) đè góc né của người chơi
   let shotCount = 1;
   let spreadAngle = 0;
   if (boss.config.aiAwarenessLevel >= 9) {
      shotCount = 3;
      spreadAngle = 0.3; // ~17 độ xoè
   } else if (boss.config.aiAwarenessLevel >= 6) {
      shotCount = 2; 
      spreadAngle = 0.15;
   }

   const projDmg = boss.config.attackDamage * (shotCount > 1 ? 0.5 : 0.8); // Bắn nhiều viên thì giảm sát thương mỗi viên tránh oneshot quá độ
   
   for (let i = 0; i < shotCount; i++) {
     const angle = shotCount === 1 ? baseAngle : baseAngle - spreadAngle/2 + (i / (shotCount - 1 || 1)) * spreadAngle;
     const yOffset = shotCount > 1 ? (i === 0 ? -12 : (i === 1 && shotCount === 2 ? 12 : (i === 1 ? 0 : 12))) : 0;
     
     projectiles.push({
      position: { x: projX, y: boss.position.y + boss.height / 2 - 10 + yOffset },
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      width: 25,
      height: 25,
      damage: projDmg,
      owner: "boss",
      lifetime: 3,
    });
   }
}

/** Apply damage to boss, return hit particles */
export function damageBoss(boss: BossState, damage: number): Particle[] {
  // If in Block state, mitigate 75% damage
  if (boss.isBlocking || boss.animState === "block") {
    damage *= 0.25; 
  }
  
  boss.health = Math.max(0, boss.health - damage);
  const particles: Particle[] = [];
  
  if (boss.health <= 0) return particles;

  const particleCount = boss.isBlocking ? 3 : 8;
  const particleColor = boss.isBlocking ? "#aaaaaa" : "#ffffff";
  
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      position: { x: boss.position.x + boss.width / 2, y: boss.position.y + boss.height / 2 },
      velocity: { x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 300 },
      color: particleColor,
      size: 2 + Math.random() * 3,
      lifetime: 0.25,
      maxLifetime: 0.25,
      alpha: 1,
    });
  }
  return particles;
}
