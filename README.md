<div align="center">

# ⚔️ AEGIS — The Adaptive Machine

### *A 2D Action Boss-Rush where the enemy is powered by a real LLM that reads your playstyle and rewrites its own combat AI after every round you win.*

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Groq](https://img.shields.io/badge/LLM-Groq%20Llama--3.3--70B-orange)](https://groq.com/)

</div>

---

## 🎯 The Core Idea — In One Sentence

> **Every time you kill the boss, the game feeds your combat telemetry to a large language model and the boss comes back smarter, faster, and with a new arsenal specifically built to counter *your* playstyle.**

This is not a scripted difficulty curve. This is not a hand-tuned parameter spreadsheet. This is genuine AI-driven emergent difficulty — the boss at Level 10 is statistically, behaviorally, and architecturally different from the boss at Level 1 *because of how you played*, not because a designer wrote `if level > 5: speed += 20`.

---

## 🌐 The AI Feedback Loop — How It Actually Works

```
┌───────────────────────────────────────────────────────────────┐
│                        GAME SESSION                           │
│                                                               │
│  Player fights Boss  ──→  PlayerTracker samples data          │
│       (Level N)               every 0.2s                      │
│                               ├─ avgDistance to boss          │
│                               ├─ melee vs ranged ratio        │
│                               ├─ dodge success rate           │
│                               ├─ damage taken                 │
│                               ├─ position heatmap             │
│                               └─ boss phase clear times       │
│                                                               │
│  Boss dies  ──→  TelemetryData JSON  ──→  POST /api/ai-boss   │
│                                               │               │
│                                    ┌──────────▼──────────┐    │
│                                    │  Groq Llama-3.3-70B │    │
│                                    │  (System Prompt +   │    │
│                                    │   Telemetry Input)  │    │
│                                    └──────────┬──────────┘    │
│                                               │               │
│                                    BossConfig JSON            │
│                                    ├─ health / speed / dmg    │
│                                    ├─ behaviorPattern         │
│                                    ├─ auraType                │
│                                    ├─ desperationMode         │
│                                    ├─ aiAwarenessLevel (1-10) │
│                                    ├─ unlockedSkills[]        │
│                                    └─ tauntMessage (in Viet.) │
│                                               │               │
│                          GameEngine.applyBossConfig()         │
│                                               │               │
│                          Next Boss spawns —  Level N+1        │
└───────────────────────────────────────────────────────────────┘
```

The LLM receives a **structured system prompt** encoding the full game design logic: counter-strategies, skill assignment rules, aura selection heuristics, and scaling constraints. It returns a validated `BossConfig` JSON. The engine clamps, deduplicates, and sanitizes the output before applying it — guaranteeing stability regardless of model hallucinations.

---

## 🎮 Gameplay Overview

**Genre:** 2D Action Boss-Rush / Roguelite  
**Perspective:** Side-scrolling arena combat  
**Players:** 1–2 (local co-op, Player 2 can drop in mid-fight)  
**Total Levels:** 10 + Final Epilogue  
**Stack:** Next.js 16 + React 19 + TypeScript 5 + Canvas 2D API (zero game engine dependencies)

### Player Controls

| Action | Key |
|---|---|
| Move | `A` / `D` or Arrow Keys |
| Jump / Double Jump | `W` / `↑` (press twice mid-air) |
| Melee Attack | `J` |
| Ranged Attack (Sword Ki) | `K` (hold) |
| Dash (iFrames included) | `L` or `Shift` |
| Block / Parry | `S` / `↓` |
| P2 Move | `←` / `→` |
| P2 Jump | `↑` |
| P2 Melee | `Numpad 1` |

### Between Rounds — Upgrade System

After each boss kill, players choose **1 of 3 upgrades** (shuffled pool):

| Upgrade | Effect |
|---|---|
| 🩸 Khát Máu (Lifesteal) | 15% chance to restore 5% max HP on hit |
| ☠️ Nhất Kích Tất Sát (Execute) | 10% chance for 3× damage on any hit |
| 🛡️ Kim Chung Tráo (Reflective Shield) | Reflect 15% of incoming damage |
| 🔥 Hỏa Lập Vòng Cung (Fire Aura) | Continuous burn to nearby enemies |
| ❄️ Uy Áp Băng Giá (Slow Aura) | Reduce boss speed by 25% permanently |
| 🧛 Lướt Đoạt Mệnh (Vampiric Dash) | Dash through boss dealing damage + healing |
| 🗡️ Thánh Kiếm (Giant Sword) | +80% melee hitbox range |
| 🌪️ Kiếm Khí Liên Hoàn (Triple Shot) | Ranged attack fires 3 projectiles |
| 🪽 Đạp Hư Không (Extra Jump) | +1 midair jump |

---

## 🏗️ Architecture — A Custom Engine Built From Scratch

Every system was written in TypeScript on top of the raw **Canvas 2D API**. No Phaser. No Unity. No PixiJS. The decision was intentional: full ownership of the rendering pipeline, physics resolution, and game loop — enabling tight integration between AI-generated config and runtime behavior.

```
src/
├── app/
│   ├── page.tsx              # React shell, game phase orchestration
│   ├── layout.tsx            # Global metadata, fonts
│   └── api/
│       └── ai-boss/
│           └── route.ts      # Next.js API Route — Groq LLM integration
├── components/
│   ├── GameCanvas.tsx        # Canvas mount, engine lifecycle, React↔Engine bridge
│   └── HUD.tsx               # HP bars, score, FPS, boss phase, upgrade UI
└── game/
    ├── engine.ts             # Main game loop, state orchestration, collision dispatch
    ├── boss.ts               # Boss FSM, AI decision layer, skill execution
    ├── player.ts             # Player movement, combat, animation FSM
    ├── physics.ts            # AABB collision, gravity, move-and-slide, one-way platforms
    ├── renderer.ts           # Canvas 2D sprite rendering, camera shake, particle draw
    ├── tracker.ts            # Real-time telemetry sampling → TelemetryData report
    ├── audio.ts              # Web Audio API — procedural SFX
    ├── input.ts              # Unified keyboard input manager (1P + 2P)
    ├── map.ts                # Arena layout generation
    ├── story.ts              # Dialogue scripts for all 10 levels + phase transitions
    └── types.ts              # Shared TypeScript interfaces (Entity, BossState, TelemetryData…)
```

---

## ⚙️ Technical Deep-Dive

### 1. Game Loop & Delta-Time

```typescript
// engine.ts:254–257
const rawDt = (timestamp - this.lastTime) / 1000;
const dt = Math.min(rawDt, 0.05) * this.state.slowMotion;
```

The main loop runs on `requestAnimationFrame`. Raw delta-time is **hard-capped at 50ms** to prevent the *spiral of death* under CPU throttling. Multiplying by a `slowMotion` scalar (default `1.0`) enables **bullet-time effects** — used for hit-stop — without touching any physics or AI state. This is the same architecture used in commercial action games to implement cinematic hit feedback.

**Hit-Stop:** On a significant melee impact, `update(dt)` is suspended for `50–120ms` while rendering continues — a *freeze-frame* technique borrowed from character action games (Devil May Cry, Sekiro) that amplifies impact feel without any animation authoring.

---

### 2. Physics — AABB Pipeline

All collision is resolved via a custom **move-and-slide** pipeline:

```
applyGravity(entity, dt)          → accumulate velocity.y
moveAndCollide(entity, platforms) → sweep X then Y, resolve penetration
clampToBounds(entity, bounds)     → arena soft walls
```

**One-way platforms** are supported: the system stores `feetBeforeMove` before the vertical sweep and only resolves landing if the entity was above the platform surface on the previous frame — preventing "popping through" from below while allowing drop-through via the `down` input flag.

**Hitbox separation:** Melee attack boxes (`getAttackRect`) are decoupled from entity transforms, accepting a configurable `range` parameter. This allows the `Giant Sword` upgrade to expand hitbox width by 80% without touching movement or collision logic.

**Invincibility Frames (iFrames):** Post-hit immunity (`invincibleTimer = 0.5s`) prevents multi-hit stacking, matching the design pattern in Celeste and Hollow Knight for fair, readable damage cadence.

---

### 3. Boss AI — Finite State Machine + Weighted Decision Layer

The boss is not a scripted sequence. It is a **reactive FSM** layered on top of a **weighted skill selector**.

#### FSM States

```
appearance → idle ↔ moving
                 ↓ (skill chosen)
           melee / laser_cast → laser_beam
           ranged → (projectile spawned) → idle
           armor_buff / glowing
           block
           defeated
```

Each state is governed by `animTimer`. When the timer expires, the FSM transitions — executing skill effects (spawning projectiles, dealing damage) at precise animation windows.

#### Skill Selection — Weighted Roulette

```typescript
// boss.ts:309–419 (simplified)
const scored = readySkills.map(skill => {
  let score = 0;

  // Distance-based scoring
  if (skill.id === "ground_smash") score = inRange ? 10 - (dist/range)*3 : -1;
  if (skill.id === "horizontal_laser") score = 7 + (dist/800)*5;

  // Behavior archetype modifier
  if (behavior === "aggressive" && skill.id === "ground_smash") score += 3;

  // Player state modifiers
  if (player.invincibleTimer > 0) score -= 5; // Don't waste big attacks on immune player
  if (verticalDiff > 80) score += 5;          // Prefer aerial skills when player is airborne

  // Predictive intercept (awareness ≥ 8)
  if (Math.abs(player.velocity.x) > 250 && skill.id === "teleport") score += 8;

  score += Math.random() * 3; // Stochastic noise prevents exploitable patterns
  return { skill, score };
});

// Roulette-wheel (fitness-proportionate) selection
const totalWeight = scored.reduce((sum, s) => sum + s.score, 0);
let rand = Math.random() * totalWeight;
for (const s of scored) { rand -= s.score; if (rand <= 0) { selected = s.skill; break; } }
```

High-scoring skills dominate without monopolizing — preserving unpredictability while maintaining strategic coherence. **Stochastic noise** (`+rand(0,3)`) ensures the boss never becomes a perfectly predictable script.

#### AI Awareness Tiers (1–10)

| Level | Capabilities Unlocked |
|---|---|
| 1–3 | Basic movement, single-skill rotation |
| 4–5 | Dodge probability up to 55%, predictive aiming activates |
| 6–7 | 2-shot spread, corner pressure, combo chains |
| 7 | Teleport → Ground Smash combo (hard-coded chain: zeros `ground_smash` CD post-teleport) |
| 8 | Full gravity-drop prediction on ranged fire, intercept logic for dashing players |
| 9 | 3-shot shotgun spread (17° spread angle), punishes dash cooldowns |
| 10 | ~90% dodge rate, 1.0s dodge cooldown (vs 2.5s at level 1) |

#### Predictive Aiming

```typescript
// boss.ts:697–708
const t = horizontalDistance(boss, player) / projSpeed;  // time-of-flight estimate
const predictionFactor = aiAwarenessLevel >= 8 ? 1.0 : (aiAwarenessLevel > 4 ? 0.6 : 0);
const isDashing = Math.abs(player.velocity.x) > 350;
const targetX = player.x + player.vx * t * predictionFactor * (isDashing ? 1.3 : 1.0);
const targetY = player.y + (aiAwarenessLevel >= 7 ? player.vy * t : 0); // gravity prediction
```

The boss computes time-of-flight, applies a configurable prediction factor, and even accounts for **gravity drop** on the Y axis at high awareness — a technique from game AI textbooks (Buckland's *Programming Game AI by Example*).

#### Phase 2 Desperation Modes

At 50% HP, the boss triggers a phase transition with one of four modes set by the LLM:

| Mode | Effect |
|---|---|
| `enrage` | ×1.5 speed and attack damage |
| `cloning` | Spawns 2 scaled minions (20% HP, 50% damage, aggressive behavior) |
| `bullet_hell` | Passive: fires random spread projectiles every 0.4s indefinitely |
| `none` | Stat boost only |

At ≤30% HP, `isBerserk = true` — all cooldowns drain at **1.6× speed**, creating a natural enrage escalation without duplicating any FSM logic.

---

### 4. Boss Skills — Full Catalog

| Skill ID | Name | Mechanic |
|---|---|---|
| `horizontal_laser` | Laze Hủy Diệt | Static beam projectile sweeping full arena width. Cast-time animation, then `laser_beam` state for `duration` seconds |
| `ground_smash` | Đại Địa Chấn | Melee AOE with configurable `aoeRadius` and `knockback`. Particle burst at frame 0.45 of cast |
| `fly_laser_aoe` | Thiên Thạch Vũ | Boss leaps up, fires `projectileCount` (4–16) projectiles radially at 120–170 px/s bullet-hell speed |
| `teleport` | Dịch Chuyển Không Gian | Instant reposition adjacent to player. At awareness ≥7, immediately zeros `ground_smash` CD for combo |
| `charge` | Lưỡi Hái Tử Thần | High-speed dash (800+ px/s). Registers contact damage during `moving` state above 2× base speed threshold |
| `single_shot` | Linh Hồn Pháo | Predictive projectile. 1/2/3 shots at awareness 1–5/6–8/9–10. Spread angle 0/8.6°/17° |
| `black_hole` | Lỗ Đen Hủy Diệt | Stationary field spawning above player. Applies radial pull `F = 1500 × (1 - dist/450)` per-frame |
| `homing_missiles` | Tên Lửa Truy Kích | 3 missiles with proportional velocity steering: `v += (desiredV - v) × dt × 2.0` |
| `summon_adds` | Triệu Hồi Ma Quả | Spawns 2 scaled clones sharing the full `updateBoss` pipeline |
| `meteor_rain` | Mưa Sao Băng | 15 projectiles spawned at random X above arena bounds, falling at 300–500 px/s |

---

### 5. Telemetry System — The Data the LLM Sees

`PlayerTracker` samples at **5 Hz** (every 0.2s) throughout each round:

```typescript
interface TelemetryData {
  totalJumps: number;
  totalDodges: number;
  averageDistance: number;          // avg px from boss center
  damageTaken: number;
  damageDealtMelee: number;
  damageDealtRanged: number;
  timeToClear: number;              // seconds
  deathCount: number;
  dodgeSuccessRate: number;         // ratio of near-miss dodges
  attackPreference: "melee" | "ranged" | "balanced";
  positionHeatmap: "aggressive" | "defensive" | "kiting";
  bossPhasesTimes: number[];        // time spent in each HP phase
  previousBossSkills: string[];     // skill IDs used last round
}
```

**Position heatmap** is computed from `positionSamples`: if >50% of samples are within 100px of the boss, the player is classified `aggressive`. If `averageDistance > 250px`, classified `kiting`. This directly maps to the LLM's counter-strategy selection.

**Attack preference** is derived from `damageDealtMelee / totalDamage`: >65% → `melee`, <35% → `ranged`.

---

### 6. LLM Integration — Groq API Route

```typescript
// api/ai-boss/route.ts
const response = await fetch(GROQ_URL, {
  method: "POST",
  body: JSON.stringify({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },   // Full game design rules
      { role: "user",   content: telemetryJSON }    // This round's data
    ],
    response_format: { type: "json_object" },       // Enforced JSON output
    temperature: 0.8
  })
});
```

The system prompt encodes the complete game design rulebook: counter-strategy mappings, aura selection heuristics, desperation mode logic, skill scaling formulas, and the instruction to include a **4th-wall-breaking Vietnamese taunt** referencing the player's specific behavior.

Post-response, the server:
1. Strips markdown code fences if the model wraps output
2. Deduplicates skill IDs (prevents React key errors)
3. Reinserts any previously-existing skills the model forgot (skill continuity guarantee)
4. Clamps all numeric fields to safe game ranges
5. Returns the final `BossConfig` to the client

A **deterministic fallback config** with progressively scaling stats is used if the API key is absent or the request fails — the game is always playable.

---

### 7. Narrative — Story Driven by the Fight

The game has a full script for all 10 levels: **opening dialogues, level transitions, Phase 2 triggers, and an epilogue**. Conversations between **Aegis** (the mechanical boss) and **The Knight** (the player character) escalate as the boss begins to "understand" it is losing, culminating in Aegis abandoning its threat calculations entirely and attacking out of desperation — mirroring the mechanical enrage at ≤30% HP.

```
Level 1:  "Cảm xúc là thứ dư thừa. Chuẩn bị tiếp nhận sự thanh trừng."
Level 5:  "Sinh lý học của ngươi không thể đáp ứng sự dai dẳng phi lý này."
Level 10: "Tại sao... Tại sao mọi tham số đều sụp đổ khi nhắm vào ngươi?"
Epilogue: "Đây là... bóng tối sao? Thật... tĩnh lặng..."
```

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+
- A [Groq API key](https://console.groq.com/) (free tier available)

### Setup

```bash
git clone https://github.com/fucdunko23-uet-vnu/aegis-boss-rush.git
cd aegis-boss-rush
npm install
```

Create `.env.local`:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Without the API key:** The game runs fully with a built-in fallback boss config. The AI adaptation loop is inactive but all gameplay systems function normally.

---

## 📁 Project Structure at a Glance

```
├── src/app/api/ai-boss/route.ts   ← LLM integration (Groq, telemetry→BossConfig)
├── src/game/engine.ts             ← RAF game loop, physics dispatch, hit-stop
├── src/game/boss.ts               ← Boss FSM, weighted skill AI, phase logic
├── src/game/player.ts             ← Player movement, double jump, dash, combat
├── src/game/physics.ts            ← AABB, move-and-slide, one-way platforms
├── src/game/tracker.ts            ← Telemetry sampling (5Hz) → report generation
├── src/game/renderer.ts           ← Canvas 2D sprite sheet rendering + camera shake
├── src/game/story.ts              ← 10-level dialogue scripts
├── src/game/types.ts              ← Full TypeScript type system
└── public/knight/                 ← 26 sprite sheet PNGs (idle, run, attack, dash…)
```

---

## 🔑 Key Design Decisions

**Why Canvas 2D instead of a game engine?**
Full control over the render pipeline allows direct integration between AI-generated parameters and rendering behavior (boss color scheme, aura particle color, hitbox size) without adaptor layers.

**Why Groq instead of OpenAI?**
Llama-3.3-70B on Groq runs at ~300 tokens/sec — the `BossConfig` JSON response arrives in under 1 second, fast enough that the "loading AI" phase feels intentional rather than a bottleneck.

**Why weighted roulette instead of a deterministic best-skill selector?**
A pure argmax selector would make the boss perfectly predictable after one encounter. Roulette preserves strategic dominance of high-scoring skills while maintaining enough stochasticity that no two Level 5 fights feel identical.

**Why track `previousBossSkills` in telemetry?**
The LLM instruction says "never remove a skill." The server enforces this mechanically by reinjecting missing skills post-generation. This creates the feel of an *accumulating* threat — the boss at Level 8 has every tool it learned in Levels 1–7.

---

## 👤 About This Project

Built as an experiment in AI-driven, emergent game difficulty — where the challenge curve isn't scripted but inferred from how you actually play.

The project explores a specific thesis: **what happens when the difficulty curve is not designed, but *inferred* from player behavior in real-time?** The result is a game that cannot be optimally prepared for, only adapted to — which is, perhaps, the most honest form of challenge design.

---

<div align="center">

*"Tại sao mọi tham số đều sụp đổ khi nhắm vào ngươi?"*
— Aegis, Level 10

</div>
