// ========================
// Shared Game Types & Interfaces
// ========================

export interface Vector2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Entity {
  position: Vector2;
  velocity: Vector2;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  facing: 1 | -1; // 1 = right, -1 = left
  isGrounded: boolean;
}

export interface Projectile {
  position: Vector2;
  velocity: Vector2;
  width: number;
  height: number;
  damage: number;
  owner: "player" | "boss";
  lifetime: number;
  color?: string;
  isHoming?: boolean;
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "ground" | "platform" | "wall";
}

export interface MapData {
  platforms: Platform[];
  spawnPoint: Vector2;
  bossSpawnPoint: Vector2;
  bounds: Rect;
}

// Input state map
export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  down: boolean;
  melee: boolean;
  ranged: boolean;
  dash: boolean;
  block: boolean;
}

export type PlayerAnimState = "idle" | "run" | "jump" | "fall" | "dash" | "attack1" | "attack2" | "roll" | "hit" | "death" | "block";

export interface PlayerState extends Entity {
  baseDamage: number;
  baseRangedDamage: number;
  maxDashCooldown: number;
  attackCooldown: number;
  rangedCooldown: number;
  dashCooldown: number;
  isDashing: boolean;
  dashTimer: number;
  invincibleTimer: number;
  isAttacking: boolean;
  isBlocking: boolean;
  attackTimer: number;
  comboCount: number;
  score: number;
  jumpCount: number;       // Đếm số lần nhảy (0 = chưa nhảy, 1 = đã nhảy 1 lần, 2 = double jump)
  maxJumps: number;        // Số lần nhảy tối đa (2 = double jump)
  deathCount: number;
  animState: PlayerAnimState;
  animTimer: number;
  
  // Special Mechanics
  hasLifesteal: boolean;
  hasTripleShot: boolean;
  hasReflectiveShield: boolean;
  hasExecute: boolean;
  hasFireAura: boolean;
  hasSlowAura: boolean;
  hasVampiricDash: boolean;
  hasGiantSword: boolean;
}

export type BossSkillId = "horizontal_laser" | "ground_smash" | "fly_laser_aoe" | "teleport" | "summon_adds" | "charge" | "single_shot" | "black_hole" | "homing_missiles" | "meteor_rain";

export interface BossSkill {
  id: BossSkillId;
  name: string;
  damage: number;
  range: number;
  cooldown: number;
  // Tunable via AI API
  projectileSpeed?: number;  // Tốc độ đạn/laser
  projectileSize?: number;   // Kích thước đạn (width & height multiplier)
  projectileCount?: number;  // Số lượng đạn (fly_laser_aoe)
  aoeRadius?: number;        // Bán kính sát thương phạm vi
  knockback?: number;        // Lực đẩy lùi khi trúng
  castTime?: number;         // Thời gian cast trước khi chiêu xuất hiện
  duration?: number;         // Thời gian hiệu ứng tồn tại
}

// Boss config from Gemini AI
export interface BossConfig {
  level: number;
  health: number;
  speed: number;
  attackDamage: number;       // Base melee damage (fallback)
  bodyWidth?: number;         // Boss body width override
  bodyHeight?: number;        // Boss body height override
  unlockedSkills: BossSkill[];
  behaviorPattern: "aggressive" | "defensive" | "adaptive" | "kiting";
  auraType?: "none" | "fire" | "frost" | "vampire" | "gravity";
  desperationMode?: "none" | "enrage" | "cloning" | "bullet_hell";
  tauntMessage: string;
  colorScheme: string;
  aiAwarenessLevel: number;
  aiReasoning?: string;
}

// Boss-specific state
export interface BossState extends Entity {
  config: BossConfig;
  attackCooldown: number;
  currentPhase: number;
  isAttacking: boolean;
  attackTimer: number;
  specialCooldowns: Map<string, number>;
  tauntTimer: number;
  currentTaunt: string;
  animState: "idle" | "moving" | "glowing" | "ranged" | "melee" | "laser_cast" | "laser_beam" | "armor_buff" | "defeated" | "appearance" | "block";
  animTimer: number;
  isBlocking: boolean;
  isMinion?: boolean;
}

// Telemetry data sent to Gemini
export interface TelemetryData {
  level: number;
  totalJumps: number;
  totalDodges: number;
  averageDistance: number;
  damageTaken: number;
  damageDealtMelee: number;
  damageDealtRanged: number;
  timeToClear: number;
  deathCount: number;
  dodgeSuccessRate: number;
  attackPreference: "melee" | "ranged" | "balanced";
  positionHeatmap: "aggressive" | "defensive" | "kiting";
  bossPhasesTimes: number[];
  previousBossSkills: string[];
}

// Particle effect
export interface Particle {
  position: Vector2;
  velocity: Vector2;
  color: string;
  size: number;
  lifetime: number;
  maxLifetime: number;
  alpha: number;
}

// Game state enum
export type GamePhase =
  | "menu"
  | "playing"
  | "boss_dead"
  | "player_dead"
  | "loading_ai"
  | "choosing_upgrade"
  | "dialog"
  | "transition"
  | "victory";

export interface DialogLine {
  speaker: "Aegis" | "Knight" | "System";
  text: string;
}

export type UpgradeId = "hp_max" | "hp_full" | "dmg_melee" | "dmg_ranged" | "dash_cd" | "speed_up" | "extra_jump" | "lifesteal" | "triple_shot" | "reflective_shield" | "execute" | "fire_aura" | "slow_aura" | "vampiric_dash" | "giant_sword" | "time_manipulator" | "shadow_clone" | "phoenix_feather";

export interface SkillUpgrade {
  id: UpgradeId;
  title: string;
  description: string;
  icon: string;
}

// Overall game state
export interface GameState {
  phase: GamePhase;
  level: number;
  player: PlayerState;
  player2: PlayerState | null;
  boss: BossState;
  minions: BossState[];
  projectiles: Projectile[];
  particles: Particle[];
  map: MapData;
  screenShake: number;
  slowMotion: number;
  fps: number;
  upgradeChoices: SkillUpgrade[];
  isTwoPlayerMode?: boolean; // Track để hồi sinh cả 2
}

// Callback from game engine to React
export interface GameCallbacks {
  onBossDead: (telemetry: TelemetryData) => void;
  onPlayerDead: () => void;
  onLevelStart: (level: number) => void;
  onTaunt: (message: string) => void;
  onPhaseChange: (phase: GamePhase) => void;
  onBossPhase2: (level: number) => void;
}
