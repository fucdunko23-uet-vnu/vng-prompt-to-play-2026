// ========================
// Groq API Route: Analyze telemetry → generate BossConfig
// ========================

import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are the AI controller for a 2D action game boss. 
You receive player telemetry data and must generate a BossConfig that adapts to counter the player's specific playstyle.

RULES:
- If the player is aggressive (close range, melee-heavy), make the boss use AOE attacks and zone control
- If the player is defensive (kiting, ranged-heavy), make the boss faster with gap-closing abilities  
- If the player dodges a lot, reduce dodge effectiveness or add tracking attacks
- The game will strictly end or reach its climax at Level 10.
- STAT SCALING: Instead of abrupt spikes, the boss's total stats must increase GRADUALLY and PROPORTIONALLY based on the level.
- Distribute stat points logically based on telemetry (e.g. against dodgers, put more into speed; against tanks, put more into damage).
- SKILLS: You must return an array of 'unlockedSkills'. IMPORTANT: You must include ALL previously added skills from earlier levels PLUS 1 or 2 new skills to counter the player. NEVER remove a skill! By Level 7, the boss MUST have all skills.
- AURA TYPE: Control the environment.
  - "fire": Burn close players (counters melee/close distance).
  - "frost": Drops player movement speed (counters high mobility without dashing).
  - "vampire": Boss heals on hit (counters trading damage).
  - "gravity": Pulls player constantly (counters kiting).
- DESPERATION MODE: What happens when Boss HP < 50%?
  - "enrage": +50% speed and damage.
  - "cloning": Spawns 2 smaller clones.
  - "bullet_hell": Sprays projectiles over time.
- Observe "damageTaken": if the player takes 0 damage, they are highly skilled - boost speed and AOE.
- Observe "positionHeatmap" and "attackPreference" to select the perfect counter skills. 
- The boss should feel like it is LEARNING the player.
- Include a 4th-wall-breaking taunt message (in Vietnamese) that references the player's behavior.
- "horizontal_laser": Sweep a laser beam horizontally.
- "ground_smash": Melee AOE ground slam.
- "fly_laser_aoe": Fly up, shoot projectiles radially.
- "teleport": Reposition quickly to or away from player.
- "summon_adds": Shoot 3 massive floating orbs to zone the player.
- "charge": Forward dash to deal physical damage.
- "single_shot": Shoot 1 fast projectile directly at player.
- "black_hole": Spawn a gravity well that slowly pulls the player in.
- "homing_missiles": Shoot 3 missiles that curve toward the player.
- "meteor_rain": Call down a devastating massive area-of-effect meteor shower across the map.

Respond with ONLY valid JSON matching this exact schema:
{
  "level": number,
  "health": number (Gradual scaling, baseline roughly 300 + level * 150),
  "speed": number (Gradual scaling, baseline roughly 120 + level * 25),
  "attackDamage": number (Gradual scaling, baseline roughly 20 + level * 7),
  "bodyWidth": number (optional, default 60, range 50-100),
  "bodyHeight": number (optional, default 70, range 50-120),
  "unlockedSkills": [
    {
      "id": "horizontal_laser" | "ground_smash" | "fly_laser_aoe" | "teleport" | "summon_adds" | "charge" | "single_shot" | "black_hole" | "homing_missiles" | "meteor_rain",
      "name": string (creative skill name in Vietnamese),
      "damage": number,
      "range": number (detection range to trigger skill),
      "cooldown": number (seconds between uses),
      "projectileSpeed": number (optional, speed of projectiles, 0 for static beams),
      "projectileSize": number (optional, multiplier 0.5-3.0, default 1.0),
      "projectileCount": number (optional, for fly_laser_aoe, default 8, range 4-16),
      "aoeRadius": number (optional, for ground_smash, pixels of hit area),
      "knockback": number (optional, pushback force on hit, default 250),
      "castTime": number (optional, wind-up time before skill fires, default 0.7),
      "duration": number (optional, how long the effect/projectile persists)
    }
  ],
  "behaviorPattern": "aggressive" | "defensive" | "adaptive" | "kiting",
  "auraType": "none" | "fire" | "frost" | "vampire" | "gravity" (pick one based on telemetry),
  "desperationMode": "none" | "enrage" | "cloning" | "bullet_hell" (pick one based on telemetry),
  "tauntMessage": string,
  "colorScheme": string (hex color),
  "aiAwarenessLevel": number (1-10),
  "aiReasoning": string (A one-sentence explanation of WHY you chose these stats and skills to counter the player's telemetry)
}`;

export async function POST(req: NextRequest) {
  try {
    const telemetry = await req.json();

    if (!GROQ_API_KEY) {
      console.warn("[AI Route] No GROQ_API_KEY, returning fallback config");
      return NextResponse.json(getFallbackConfig(telemetry.level + 1));
    }

    const userPrompt = `Player Telemetry for Level ${telemetry.level}:
${JSON.stringify(telemetry, null, 2)}

Generate the BossConfig JSON cho Level ${telemetry.level + 1}.`;

    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Mô hình mới nhất thay thế các bản cũ
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }, // Ép trả về chuẩn JSON không kèm văn bản thừa
        temperature: 0.8
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[AI Route] Groq API error:", response.status, errText);
      return NextResponse.json(getFallbackConfig(telemetry.level + 1));
    }

    const data = await response.json();
    
    let rawText = data.choices?.[0]?.message?.content;

    if (!rawText) {
      console.error("[AI Route] Missing result text from Groq response", JSON.stringify(data).substring(0, 500));
      return NextResponse.json(getFallbackConfig(telemetry.level + 1));
    }

    // Clean up markdown block if present
    let textForJson = rawText;
    if (textForJson.includes("```json")) {
       textForJson = textForJson.split("```json")[1].split("```")[0].trim();
    } else if (textForJson.includes("```")) {
       textForJson = textForJson.split("```")[1].split("```")[0].trim();
    }

    const bossConfig = JSON.parse(textForJson);
    // Validate & clamp required fields
    bossConfig.level = telemetry.level + 1;

    // Filter out duplicated skill ids to prevent React key errors
    if (Array.isArray(bossConfig.unlockedSkills)) {
      const uniqueSkills = new Map();
      for (const skill of bossConfig.unlockedSkills) {
        if (skill && skill.id && !uniqueSkills.has(skill.id)) {
          uniqueSkills.set(skill.id, skill);
        }
      }
      bossConfig.unlockedSkills = Array.from(uniqueSkills.values());
    }

    // Safety check: ensure no skills are lost
    if (Array.isArray(telemetry.previousBossSkills) && Array.isArray(bossConfig.unlockedSkills)) {
      const currentSkillIds = new Set(bossConfig.unlockedSkills.map((s: any) => s.id));
      const fallback = getFallbackConfig(telemetry.level + 1);
      for (const oldSkillId of telemetry.previousBossSkills) {
        if (!currentSkillIds.has(oldSkillId)) {
          const missingSkill = fallback.unlockedSkills.find((s: any) => s.id === oldSkillId);
          if (missingSkill) {
            bossConfig.unlockedSkills.push(missingSkill);
          }
        }
      }
    }

    // Scale health for 10 levels cap
    bossConfig.health = Math.max(100, bossConfig.health || 200 + telemetry.level * 120);
    bossConfig.speed = Math.max(80, Math.min(550, bossConfig.speed || 150 + telemetry.level * 20));
    bossConfig.attackDamage = Math.max(5, bossConfig.attackDamage || 15 + telemetry.level * 10);
    bossConfig.aiAwarenessLevel = Math.max(1, Math.min(10, bossConfig.aiAwarenessLevel || 1));
    // Clamp body size
    if (bossConfig.bodyWidth) bossConfig.bodyWidth = Math.max(50, Math.min(100, bossConfig.bodyWidth));
    if (bossConfig.bodyHeight) bossConfig.bodyHeight = Math.max(50, Math.min(120, bossConfig.bodyHeight));
    // Clamp skill params
    if (Array.isArray(bossConfig.unlockedSkills)) {
      for (const skill of bossConfig.unlockedSkills) {
        skill.damage = Math.max(1, skill.damage || 10);
        skill.range = Math.max(50, skill.range || 120);
        skill.cooldown = Math.max(0.5, skill.cooldown || 2);
        if (skill.projectileSize != null) skill.projectileSize = Math.max(0.5, Math.min(3.0, skill.projectileSize));
        if (skill.projectileCount != null) skill.projectileCount = Math.max(4, Math.min(16, skill.projectileCount));
        if (skill.knockback != null) skill.knockback = Math.max(0, Math.min(600, skill.knockback));
        if (skill.castTime != null) skill.castTime = Math.max(0.2, Math.min(2.0, skill.castTime));
      }
    }

    return NextResponse.json(bossConfig);
  } catch (error) {
    console.error("[AI Route] Error:", error);
    return NextResponse.json(getFallbackConfig(2), { status: 500 });
  }
}

function getFallbackConfig(level: number) {
  return {
    level,
    health: 300 + level * 150,
    speed: 140 + level * 25,
    attackDamage: 20 + level * 10,
    unlockedSkills: [
      {
        id: "horizontal_laser",
        name: "Laze Hủy Diệt",
        damage: 15 + level * 3,
        range: 600,
        cooldown: Math.max(1.5, 3 - level * 0.1),
        projectileSpeed: 0,
        projectileSize: 1.0 + level * 0.1,
        duration: 0.9,
        castTime: 0.7,
      },
      ...(level >= 2 ? [{
        id: "ground_smash" as const,
        name: "Đại Địa Chấn",
        damage: 20 + level * 4,
        range: 150,
        cooldown: Math.max(2, 4 - level * 0.2),
        aoeRadius: 100 + level * 10,
        knockback: 250 + level * 20,
        castTime: 0.7,
      }] : []),
      ...(level >= 3 ? [{
        id: "teleport" as const,
        name: "Dịch Chuyển Không Gian",
        damage: 0,
        range: 800,
        cooldown: 5,
        castTime: 0.5,
        duration: 0.5,
      }] : []),
      ...(level >= 4 ? [{
        id: "single_shot" as const,
        name: "Linh Hồn Pháo",
        damage: 25 + level * 5,
        range: 650,
        cooldown: Math.max(1, 2 - level * 0.1),
        castTime: 0.5,
      }] : []),
      ...(level >= 5 ? [{
        id: "charge" as const,
        name: "Lưỡi Hái Tử Thần",
        damage: 30 + level * 6,
        range: 400,
        cooldown: 4,
        projectileSpeed: 600 + level * 30,
        castTime: 0.5,
      }] : []),
      ...(level >= 6 ? [{
        id: "summon_adds" as const,
        name: "Triệu Hồi Ma Quả",
        damage: 20 + level * 4,
        range: 500,
        cooldown: 6,
        castTime: 0.8,
      }] : []),
      ...(level >= 7 ? [{
        id: "fly_laser_aoe" as const,
        name: "Thiên Thạch Vũ",
        damage: 15 + level * 5,
        range: 999,
        cooldown: Math.max(3, 7 - level * 0.3),
        projectileSpeed: 300 + level * 20,
        projectileSize: 1.0 + level * 0.15,
        projectileCount: 6 + Math.min(level, 15),
        duration: 3,
        castTime: 1.0,
      }] : []),
      ...(level >= 8 ? [{
        id: "meteor_rain" as const,
        name: "Mưa Sao Băng",
        damage: 30 + level * 5,
        range: 1500,
        cooldown: Math.max(5, 10 - level * 0.5),
        castTime: 1.2,
      }] : []),
    ],
    behaviorPattern: level % 2 === 0 ? "aggressive" : "adaptive",
    auraType: level >= 5 ? "gravity" : (level >= 3 ? "fire" : "none"),
    desperationMode: level >= 6 ? "bullet_hell" : (level >= 4 ? "enrage" : "none"),
    tauntMessage: `Hệ thống phân tích đã hoàn tất sơ đồ tác chiến Level ${level}... Ngươi đã sẵn sàng chưa?`,
    colorScheme: ["#ff006e", "#e040fb", "#7c4dff", "#00e5ff", "#ff6e40", "#ffab00", "#ff1744", "#d500f9", "#651fff", "#00e676"][level % 10],
    aiAwarenessLevel: Math.min(level, 10),
  };
}
