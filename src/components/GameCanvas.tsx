"use client";

// ========================
// GameCanvas: React wrapper for HTML5 Canvas + Game Engine
// ========================

import { useRef, useEffect, useCallback, useState } from "react";
import { GameEngine } from "@/game/engine";
import { GamePhase, TelemetryData, BossConfig } from "@/game/types";
import { getDefaultBossConfig } from "@/game/boss";
import { sfx } from "@/game/audio";
import HUD from "./HUD";
import { StoryScripts, TransitionScripts, Phase2Scripts } from "@/game/story";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [level, setLevel] = useState(1);
  const [taunt, setTaunt] = useState("");
  const [tauntKey, setTauntKey] = useState(0);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [bossConfig, setBossConfig] = useState<BossConfig | null>(null);
  const [prevBossConfig, setPrevBossConfig] = useState<BossConfig | null>(null);
  const [pendingBossConfig, setPendingBossConfig] = useState<BossConfig | null>(null);
  const [upgradeChoices, setUpgradeChoices] = useState<import("@/game/types").SkillUpgrade[]>([]);
  const [dialogScript, setDialogScript] = useState<import("@/game/types").DialogLine[] | null>(null);
  const [dialogIndex, setDialogIndex] = useState(0);
  const [showDevLog, setShowDevLog] = useState(false);

  // Tracks whether the transition dialog has finished (player clicked through all lines)
  const [transitionDialogDone, setTransitionDialogDone] = useState(false);
  // Tracks whether AI has returned the config
  const [aiConfigReady, setAiConfigReady] = useState(false);

  // Use ref for bossConfig inside callbacks to avoid dependency issues
  const bossConfigRef = useRef<BossConfig | null>(null);
  bossConfigRef.current = bossConfig;

  const isFetchingAIRef = useRef(false);
  // Store pending config in ref so upgrade callback can access latest value
  const pendingBossConfigRef = useRef<BossConfig | null>(null);
  pendingBossConfigRef.current = pendingBossConfig;

  const handleBossDead = useCallback(async (telemetry: TelemetryData) => {
    if (isFetchingAIRef.current) return;
    isFetchingAIRef.current = true;
    setIsLoadingAI(true);
    setAiConfigReady(false);
    setTransitionDialogDone(false);

    // Immediately show transition story dialog
    const completedLevel = telemetry.level;
    const transitionScript = TransitionScripts[completedLevel];
    if (transitionScript) {
      setDialogScript(transitionScript);
      setDialogIndex(0);
      setPhase("dialog");
      if (engineRef.current) engineRef.current.setDialogMode(true);
    }

    // Fetch AI config in background
    try {
      const res = await fetch("/api/ai-boss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(telemetry),
      });

      const config: BossConfig = res.ok
        ? await res.json()
        : getDefaultBossConfig(telemetry.level + 1);

      isFetchingAIRef.current = false;
      setIsLoadingAI(false);
      setPrevBossConfig(bossConfigRef.current);
      setBossConfig(config);
      setPendingBossConfig(config);
      if (engineRef.current) {
        setUpgradeChoices(engineRef.current.generateUpgrades());
      }
      setAiConfigReady(true);
    } catch {
      const config = getDefaultBossConfig(telemetry.level + 1);
      isFetchingAIRef.current = false;
      setIsLoadingAI(false);
      setPrevBossConfig(bossConfigRef.current);
      setBossConfig(config);
      setPendingBossConfig(config);
      if (engineRef.current) {
        setUpgradeChoices(engineRef.current.generateUpgrades());
      }
      setAiConfigReady(true);
    }
  }, []);

  // When transition dialog is done AND AI is ready → move to choosing_upgrade
  useEffect(() => {
    if (transitionDialogDone && aiConfigReady && phase !== "choosing_upgrade" && phase !== "playing") {
      setPhase("choosing_upgrade");
    }
  }, [transitionDialogDone, aiConfigReady, phase]);

  const handleUpgradeChoice = useCallback((id: import("@/game/types").UpgradeId) => {
    const cfg = pendingBossConfigRef.current;
    if (engineRef.current && cfg) {
      sfx.playPowerup();
      engineRef.current.applyUpgrade(id);
      engineRef.current.applyBossConfig(cfg);
      setLevel(cfg.level);
      setPendingBossConfig(null);
      setTransitionDialogDone(false);
      setAiConfigReady(false);
    }
  }, []);

  const handlePlayerDead = useCallback(() => {}, []);

  const handleCommand = useCallback((cmd: string) => {
    if (cmd.trim() === "dev") {
      setShowDevLog(prev => !prev);
      return;
    }
    if (engineRef.current) {
      engineRef.current.executeCommand(cmd);
    }
  }, []);

  const handleLevelStart = useCallback((lvl: number) => {
    setLevel(lvl);
    if (StoryScripts[lvl]) {
      setDialogScript(StoryScripts[lvl]);
      setDialogIndex(0);
      setPhase("dialog");
      if (engineRef.current) engineRef.current.setDialogMode(true);
    }
  }, []);

  const handleBossPhase2 = useCallback((lvl: number) => {
    const p2Scripts = Phase2Scripts[lvl] || [
      { speaker: "Aegis", text: "[ CẢNH BÁO ] Kích hoạt Hình thái 2. Chế độ Tử Chiến." },
      { speaker: "Knight", text: "Tới luôn đi!" }
    ];
    setDialogScript(p2Scripts);
    setDialogIndex(0);
    setPhase("dialog");
    if (engineRef.current) engineRef.current.setDialogMode(true);
  }, []);

  const handleNextDialog = useCallback(() => {
    if (dialogScript && dialogIndex < dialogScript.length - 1) {
      setDialogIndex(i => i + 1);
    } else {
      // Dialog finished - check if this is a transition dialog (during boss_dead/loading)
      if (isLoadingAI || phase === "dialog") {
        // During transition: mark dialog as done
        setTransitionDialogDone(true);
        // If AI is already done, useEffect will move to choosing_upgrade
        // If AI is still loading, show a brief "waiting" state
        if (!aiConfigReady) {
          setPhase("loading_ai");
        }
      }
      // Level-start dialog (level 1, 5, 10 etc.)
      if (!isLoadingAI && !pendingBossConfig) {
        if (level === 11) {
          setPhase("victory");
        } else {
          setPhase("playing");
          if (engineRef.current) engineRef.current.setDialogMode(false);
        }
      }
    }
  }, [dialogScript, dialogIndex, level, isLoadingAI, aiConfigReady, phase, pendingBossConfig]);

  const handleTaunt = useCallback((msg: string) => {
    setTaunt(msg);
    setTauntKey((k) => k + 1);
  }, []);

  const handlePhaseChange = useCallback((p: GamePhase) => {
    setPhase(p);
  }, []);

  const handleRestart = useCallback(() => {
    sfx.init();
    if (engineRef.current) {
      engineRef.current.restart();
      engineRef.current.start();
    }
  }, []);

  const handleStartGame = useCallback((isTwoPlayer: boolean = false) => {
    sfx.init();
    if (engineRef.current) {
      const config = getDefaultBossConfig(1);
      setBossConfig(config);
      setPrevBossConfig(null);
      engineRef.current.initLevel(1, config, false, false, isTwoPlayer);
      engineRef.current.start();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      engineRef.current?.resize(canvas.width, canvas.height);
    };
    updateSize();

    const engine = new GameEngine(canvas, {
      onBossDead: handleBossDead,
      onPlayerDead: handlePlayerDead,
      onLevelStart: handleLevelStart,
      onTaunt: handleTaunt,
      onPhaseChange: handlePhaseChange,
      onBossPhase2: handleBossPhase2,
    });
    engineRef.current = engine;

    window.addEventListener("resize", updateSize);

    return () => {
      window.removeEventListener("resize", updateSize);
      engine.destroy();
    };
  }, [handleBossDead, handlePlayerDead, handleLevelStart, handleTaunt, handlePhaseChange, handleBossPhase2]);

  return (
    <div className="game-container">
      <canvas
        ref={canvasRef}
        id="game-canvas"
        className="game-canvas"
      />
      <HUD
        phase={phase}
        level={level}
        taunt={taunt}
        tauntKey={tauntKey}
        isLoadingAI={isLoadingAI}
        bossConfig={bossConfig}
        prevBossConfig={prevBossConfig}
        upgradeChoices={upgradeChoices}
        dialogScript={dialogScript}
        dialogIndex={dialogIndex}
        showDevLog={showDevLog}
        onNextDialog={handleNextDialog}
        onSelectUpgrade={handleUpgradeChoice}
        onStart={handleStartGame}
        onRestart={handleRestart}
        onCommand={handleCommand}
      />
    </div>
  );
}
