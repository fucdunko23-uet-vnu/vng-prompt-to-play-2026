// ========================
// Telemetry Tracker: Collects player behavior data
// ========================

import { BossState, PlayerState, TelemetryData } from "./types";
import { horizontalDistance } from "./physics";

export class PlayerTracker {
  private level: number;
  private totalJumps = 0;
  private totalDodges = 0;
  private dodgeAttempts = 0;
  private dodgeSuccesses = 0;
  private damageTaken = 0;
  private damageDealtMelee = 0;
  private damageDealtRanged = 0;
  private deathCount = 0;
  private startTime = 0;
  private distanceSamples: number[] = [];
  private positionSamples: number[] = []; // x positions relative to boss
  private bossPhaseStartTimes: number[] = [0];
  private sampleInterval = 0;
  private lastBossPhase = 0;

  constructor(level: number) {
    this.level = level;
    this.startTime = performance.now();
  }

  /** Called every frame to sample distance */
  update(player: PlayerState, boss: BossState, dt: number): void {
    this.sampleInterval += dt;
    // Sample every 0.2s to avoid huge arrays
    if (this.sampleInterval >= 0.2) {
      this.sampleInterval = 0;
      const dist = horizontalDistance(player, boss);
      this.distanceSamples.push(dist);

      // Track position relative to boss
      const relX = player.position.x - boss.position.x;
      this.positionSamples.push(relX);
    }

    // Track boss phase transitions
    if (boss.currentPhase !== this.lastBossPhase) {
      const elapsed = (performance.now() - this.startTime) / 1000;
      this.bossPhaseStartTimes.push(elapsed);
      this.lastBossPhase = boss.currentPhase;
    }
  }

  trackJump(): void {
    this.totalJumps++;
  }

  trackDodge(success: boolean): void {
    this.totalDodges++;
    this.dodgeAttempts++;
    if (success) this.dodgeSuccesses++;
  }

  trackDamageTaken(amount: number): void {
    this.damageTaken += amount;
  }

  trackDamageDealt(amount: number, type: "melee" | "ranged"): void {
    if (type === "melee") this.damageDealtMelee += amount;
    else this.damageDealtRanged += amount;
  }

  trackDeath(): void {
    this.deathCount++;
  }

  /** Generate final telemetry report */
  generateReport(bossConfig: import("./types").BossConfig): TelemetryData {
    const timeToClear = (performance.now() - this.startTime) / 1000;

    // Average distance to boss
    const avgDist =
      this.distanceSamples.length > 0
        ? this.distanceSamples.reduce((a, b) => a + b) / this.distanceSamples.length
        : 200;

    // Attack preference
    const totalDamageDealt = this.damageDealtMelee + this.damageDealtRanged;
    let attackPreference: "melee" | "ranged" | "balanced" = "balanced";
    if (totalDamageDealt > 0) {
      const meleeRatio = this.damageDealtMelee / totalDamageDealt;
      if (meleeRatio > 0.65) attackPreference = "melee";
      else if (meleeRatio < 0.35) attackPreference = "ranged";
    }

    // Position heatmap analysis
    let positionHeatmap: "aggressive" | "defensive" | "kiting" = "defensive";
    if (this.positionSamples.length > 0) {
      const avgRelPos =
        this.positionSamples.reduce((a, b) => a + Math.abs(b), 0) / this.positionSamples.length;
      const closeCount = this.positionSamples.filter((p) => Math.abs(p) < 100).length;
      const closeRatio = closeCount / this.positionSamples.length;

      if (closeRatio > 0.5) positionHeatmap = "aggressive";
      else if (avgDist > 250) positionHeatmap = "kiting";
    }

    // Boss phase times
    const bossPhasesTimes: number[] = [];
    for (let i = 1; i < this.bossPhaseStartTimes.length; i++) {
      bossPhasesTimes.push(
        this.bossPhaseStartTimes[i] - this.bossPhaseStartTimes[i - 1]
      );
    }
    // Add final phase time
    bossPhasesTimes.push(timeToClear - (this.bossPhaseStartTimes[this.bossPhaseStartTimes.length - 1] || 0));

    return {
      level: this.level,
      totalJumps: this.totalJumps,
      totalDodges: this.totalDodges,
      averageDistance: Math.round(avgDist),
      damageTaken: Math.round(this.damageTaken),
      damageDealtMelee: Math.round(this.damageDealtMelee),
      damageDealtRanged: Math.round(this.damageDealtRanged),
      timeToClear: Math.round(timeToClear * 10) / 10,
      deathCount: this.deathCount,
      dodgeSuccessRate:
        this.dodgeAttempts > 0
          ? Math.round((this.dodgeSuccesses / this.dodgeAttempts) * 100) / 100
          : 0,
      attackPreference,
      positionHeatmap,
      bossPhasesTimes,
      previousBossSkills: bossConfig.unlockedSkills.map(s => s.id)
    };
  }
}
