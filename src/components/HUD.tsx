"use client";

// ========================
// HUD: Overlay UI (menus, messages, loading, boss info panel)
// ========================

import { BossConfig, GamePhase, SkillUpgrade, DialogLine, UpgradeId } from "@/game/types";
import { useEffect, useState, useCallback } from "react";
import { sfx } from "@/game/audio";

// Ability display names (fallback or defaults)
const ABILITY_LABELS: Record<string, { icon: string }> = {
  horizontal_laser: { icon: "🔥" },
  ground_smash: { icon: "💥" },
  fly_laser_aoe: { icon: "☄️" },
  teleport: { icon: "⚡" },
  summon_adds: { icon: "👾" },
  charge: { icon: "🏃" },
  single_shot: { icon: "🎯" },
  black_hole: { icon: "🌌" },
  homing_missiles: { icon: "🚀" },
  meteor_rain: { icon: "🌠" },
};

const BEHAVIOR_LABELS: Record<string, string> = {
  aggressive: "🔴 Hung hãn",
  defensive: "🔵 Phòng thủ",
  adaptive: "🟣 Thích nghi",
  kiting: "🟢 Cấu rỉa",
};

const AURA_LABELS: Record<string, string> = {
  fire: "🔥 Thiêu đốt",
  frost: "❄️ Đóng băng",
  vampire: "🩸 Hút máu",
  gravity: "🌌 Lực hút",
  none: "Không có",
};

const DESPERATION_LABELS: Record<string, string> = {
  enrage: "💢 Phẫn nộ",
  cloning: "👯 Phân thân",
  bullet_hell: "☄️ Bão đạn",
  none: "Sụp đổ",
};

interface HUDProps {
  phase: GamePhase;
  level: number;
  taunt: string;
  tauntKey: number;
  isLoadingAI: boolean;
  bossConfig: BossConfig | null;
  prevBossConfig: BossConfig | null;
  upgradeChoices: SkillUpgrade[];
  dialogScript: DialogLine[] | null;
  dialogIndex: number;
  showDevLog?: boolean;
  onNextDialog: () => void;
  onSelectUpgrade: (id: UpgradeId) => void;
  onStart: (isTwoPlayer: boolean) => void;
  onRestart: () => void;
  onCommand: (cmd: string) => void;
}

/** Show stat change arrow */
function StatDelta({ prev, curr, unit = "", invert = false }: {
  prev: number | undefined;
  curr: number;
  unit?: string;
  invert?: boolean; // true = lower is harder
}) {
  if (prev === undefined) return <span className="stat-val">{curr}{unit}</span>;
  const diff = curr - prev;
  if (Math.abs(diff) < 0.01) return <span className="stat-val">{curr}{unit}</span>;
  const isUp = invert ? diff < 0 : diff > 0;
  return (
    <span className="stat-val">
      {curr}{unit}
      <span className={isUp ? "stat-up" : "stat-down"}>
        {isUp ? "▲" : "▼"}
      </span>
    </span>
  );
}

export default function HUD({
  phase,
  level,
  taunt,
  tauntKey,
  isLoadingAI,
  bossConfig,
  prevBossConfig,
  upgradeChoices,
  dialogScript,
  dialogIndex,
  showDevLog,
  onNextDialog,
  onSelectUpgrade,
  onStart,
  onRestart,
  onCommand,
}: HUDProps) {
  const [tauntVisible, setTauntVisible] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [typingIndex, setTypingIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number>(1); // Index cho chọn kỹ năng

  useEffect(() => {
    if (taunt) {
      setTauntVisible(true);
      const timer = setTimeout(() => setTauntVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [taunt, tauntKey]);

  const currentLine = dialogScript && dialogIndex < dialogScript.length ? dialogScript[dialogIndex] : null;

  useEffect(() => {
    if (!currentLine) {
      setDisplayedText("");
      return;
    }
    setDisplayedText("");
    setTypingIndex(0);
  }, [currentLine]);

  useEffect(() => {
    if (currentLine && phase === "dialog" && typingIndex < currentLine.text.length) {
      const timer = setTimeout(() => {
        setDisplayedText((prev) => prev + currentLine.text.charAt(typingIndex));
        setTypingIndex((prev) => prev + 1);
        if (typingIndex % 2 === 0) sfx.playDialogBlip();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [currentLine, phase, typingIndex]);

  const handleDialogAdvance = useCallback(() => {
    if (currentLine && typingIndex < currentLine.text.length) {
      // skip typing animation
      setDisplayedText(currentLine.text);
      setTypingIndex(currentLine.text.length);
    } else {
      onNextDialog();
    }
  }, [currentLine, typingIndex, onNextDialog]);

  useEffect(() => {
    if (phase !== "dialog") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handleDialogAdvance();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, handleDialogAdvance]);

  useEffect(() => {
    if (phase === "choosing_upgrade") {
      setSelectedIndex(1); // Default focus vào nút giữa
    }
  }, [phase]);

  // General keyboard navigation for menus and upgrades
  useEffect(() => {
    const handleNavigation = (e: KeyboardEvent) => {
      // Ignore if user is typing in the command input
      if (document.activeElement?.tagName === "INPUT") return;

      if (phase === "menu") {
        if (e.code === "Enter" || e.code === "Space") {
          e.preventDefault();
          onStart(false);
        }
      } else if (phase === "player_dead") {
        if (e.code === "Enter" || e.code === "Space") {
          e.preventDefault();
          onRestart();
        }
      } else if (phase === "choosing_upgrade" && upgradeChoices) {
        if (e.code === "ArrowLeft" || e.code === "KeyA") {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        } else if (e.code === "ArrowRight" || e.code === "KeyD") {
          setSelectedIndex((prev) => Math.min(upgradeChoices.length - 1, prev + 1));
        } else if (e.code === "Enter" || e.code === "Space") {
          e.preventDefault();
          if (upgradeChoices[selectedIndex]) {
            onSelectUpgrade(upgradeChoices[selectedIndex].id);
          }
        } else if (e.code === "Digit1" || e.code === "Numpad1") {
          if (upgradeChoices[0]) onSelectUpgrade(upgradeChoices[0].id);
        } else if (e.code === "Digit2" || e.code === "Numpad2") {
          if (upgradeChoices[1]) onSelectUpgrade(upgradeChoices[1].id);
        } else if (e.code === "Digit3" || e.code === "Numpad3") {
          if (upgradeChoices[2]) onSelectUpgrade(upgradeChoices[2].id);
        }
      } else if (phase === "victory") {
        if (e.code === "Enter" || e.code === "Space") {
          e.preventDefault();
          onRestart();
        }
      }
    };

    window.addEventListener("keydown", handleNavigation);
    return () => window.removeEventListener("keydown", handleNavigation);
  }, [phase, onStart, onRestart, upgradeChoices, selectedIndex, onSelectUpgrade]);

  // New abilities that weren't in previous config
  const newAbilities = bossConfig?.unlockedSkills?.filter(
    (a) => !prevBossConfig?.unlockedSkills?.some(p => p.id === a.id)
  ) || [];

  return (
    <div className="absolute inset-0 z-50 flex flex-col pointer-events-none">
      
      {/* Story Dialog Overlay */}
      {phase === "dialog" && currentLine && (
         <div className="absolute inset-0 pointer-events-auto flex flex-col z-50">
            {/* Dark cinematic background */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-all duration-700" />

            {/* Top: AI loading indicator (subtle, during transition) */}
            {isLoadingAI && (
              <div className="transition-loading-bar">
                <div className="transition-loading-fill" />
                <span className="transition-loading-text">Lõi Hỗn Độn đang tiến hóa...</span>
              </div>
            )}

            {/* Center area - click to advance */}
            <div className="flex-1 cursor-pointer" onClick={handleDialogAdvance} />

            {/* Bottom: Dialog box */}
            <div className="relative flex items-end justify-center pb-12 z-10 cursor-pointer" onClick={handleDialogAdvance}>
              <div className="w-[850px] min-h-[220px] rounded-xl border border-[#d4af37]/50 bg-[#0a0a0a]/70 backdrop-blur-md flex shadow-[0_8px_32px_rgba(212,175,55,0.2)] overflow-hidden transition-transform hover:scale-[1.01]" >
                  
                  {/* Left Avatar (Knight) */}
                  <div className={`w-[160px] shrink-0 border-r border-[#d4af37]/30 bg-gradient-to-b from-black/20 to-[#d4af37]/10 flex flex-col items-center justify-end overflow-hidden transition-all duration-300 ${currentLine.speaker === "Knight" ? "opacity-100 scale-100" : "opacity-30 blur-[2px] scale-95"}`}>
                      <div className="text-[#d4af37] text-xs font-bold font-mono mb-2 bg-black/60 px-3 py-1 border border-[#d4af37]/30 text-center uppercase tracking-widest rounded-full">Knight</div>
                      <div className="w-[110px] h-[110px] mb-4 border border-[#d4af37]/50 bg-cover bg-center rounded-lg shadow-[0_0_15px_rgba(212,175,55,0.3)]" style={{backgroundImage: "linear-gradient(to bottom, #d4af37, #8b0000)"}}></div>
                  </div>

                  {/* Text Container */}
                  <div className="flex-1 p-8 relative flex flex-col justify-center">
                     {currentLine.speaker === "System" ? (
                        <div className="text-red-500 font-sans font-bold text-center animate-pulse text-xl drop-shadow-[0_0_8px_rgba(255,0,0,0.5)]">[ HỆ THỐNG ]<br/><br/><span className="font-mono text-sm">{currentLine.text}</span></div>
                     ) : (
                        <>
                          <div className={`text-xl font-bold mb-3 font-display tracking-wide flex items-center gap-2 ${currentLine.speaker === "Aegis" ? "text-red-500 text-shadow-[0_0_10px_red]" : "text-[#d4af37] text-shadow-[0_0_10px_#d4af37]"}`}>
                            {currentLine.speaker === "Aegis" ? "AEGIS (LÕI HỖN ĐỘN)" : "VÔ DANH CHIẾN BINH"}
                          </div>
                          <div className="text-white/90 text-lg leading-relaxed font-sans whitespace-pre-wrap font-light">
                            &quot;{displayedText}&quot;
                          </div>
                          <div className="absolute bottom-4 right-6 flex items-center gap-2">
                             <div className="animate-pulse flex items-center gap-2 bg-[#d4af37]/20 border border-[#d4af37]/50 px-3 py-1.5 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.2)]">
                               <span className="text-[#d4af37] text-[11px] font-bold font-mono tracking-wider uppercase">Chạm / Space</span>
                               <span className="text-white text-[12px]">⮞</span>
                             </div>
                          </div>
                        </>
                     )}
                  </div>

                  {/* Right Avatar (Aegis) */}
                  <div className={`w-[160px] shrink-0 border-l border-red-500/30 bg-gradient-to-b from-black/20 to-red-900/10 flex flex-col items-center justify-end overflow-hidden transition-all duration-300 ${currentLine.speaker === "Aegis" ? "opacity-100 scale-100" : "opacity-30 blur-[2px] scale-95"}`}>
                      <div className="text-red-500 text-xs font-bold font-mono mb-2 bg-black/60 px-3 py-1 border border-red-500/30 text-center uppercase tracking-widest rounded-full">Aegis</div>
                      <div className="w-[110px] h-[110px] mb-4 border border-red-500/50 bg-cover bg-center rounded-lg shadow-[0_0_15px_rgba(255,0,0,0.3)] saturate-150" style={{backgroundImage: "linear-gradient(to bottom, #8b0000, #ff0000)"}}></div>
                  </div>
              </div>
            </div>

            {/* Dialog progress dots */}
            {dialogScript && (
              <div className="relative z-10 flex justify-center gap-3 pb-6">
                {dialogScript.map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      i === dialogIndex ? "bg-[#d4af37] scale-125 shadow-[0_0_10px_rgba(212,175,55,0.8)]" 
                      : i < dialogIndex ? "bg-[#d4af37]/40" 
                      : "bg-white/10"
                    }`} 
                  />
                ))}
              </div>
            )}
         </div>
      )}

      {/* Loading AI screen (shown briefly if dialog finishes before AI returns) */}
      {phase === "loading_ai" && (
        <div className="hud-center-panel loading-panel">
          <div className="loading-spinner" />
          <h2 className="loading-title">AEGIS ĐANG TÁI CẤU TRÚC...</h2>
          <p className="loading-sub">Lõi Hỗn Độn phân tích chiến thuật của ngươi...</p>
          <div className="loading-dots">
            <span>◆</span><span>◆</span><span>◆</span>
          </div>
        </div>
      )}

      {/* Phase Overlays */}
      {phase === "menu" && (
        <div className="hud-center-panel">
          <h1 className="game-title">
            <span className="title-glow">KNIGHT'S LEGACY</span>
            <br />
            <span className="title-sub">AWAKENED DEMON</span>
          </h1>
          <p className="title-desc">Chúa Tể Hắc Ám đang thức tỉnh. Hắn ghi nhớ từng nét kiếm của ngươi.</p>
          <div className="controls-info">
            <div className="flex gap-8 text-left">
              <div>
                <h3 className="text-[#d4af37] font-bold mb-2">PLAYER 1 (LEFT)</h3>
                <div className="control-row"><kbd>WASD</kbd> Di chuyển</div>
                <div className="control-row"><kbd>SPACE</kbd> Nhảy</div>
                <div className="control-row"><kbd>F</kbd> Đánh gần</div>
                <div className="control-row"><kbd>G</kbd> Bắn xa</div>
                <div className="control-row"><kbd>H</kbd> / <kbd>L</kbd> Đỡ đòn</div>
                <div className="control-row"><kbd>SHIFT</kbd> Lướt</div>
              </div>
              <div>
                <h3 className="text-[#4a90e2] font-bold mb-2">PLAYER 2 (RIGHT)</h3>
                <div className="text-xs text-gray-400 mb-2 italic">Trong trận, bấm phím bất kỳ để Join</div>
                <div className="control-row"><kbd>↑←↓→</kbd> Di chuyển</div>
                <div className="control-row"><kbd>↑</kbd> Nhảy</div>
                <div className="control-row"><kbd>Num1</kbd> / <kbd>1</kbd> Đánh gần</div>
                <div className="control-row"><kbd>Num2</kbd> / <kbd>2</kbd> Bắn xa</div>
                <div className="control-row"><kbd>Num3</kbd> / <kbd>3</kbd> Đỡ đòn</div>
                <div className="control-row"><kbd>Num0</kbd> / <kbd>0</kbd> Lướt</div>
              </div>
            </div>
          </div>
          <div className="flex gap-4 max-w-sm mx-auto mt-4">
            <button className="hud-btn hud-btn-primary flex-1 !p-3 whitespace-nowrap" onClick={() => onStart?.(false)}>
              ▶ BẮT ĐẦU (1P) <span className="text-xs opacity-70 block -mt-1 font-sans">Single</span>
            </button>
            <button className="hud-btn hud-btn-secondary flex-1 !p-3 whitespace-nowrap" onClick={() => onStart?.(true)}>
              ▶ BẮT ĐẦU (2P) <span className="text-xs opacity-70 block -mt-1 font-sans">Co-op</span>
            </button>
          </div>
        </div>
      )}

      {/* Boss Dead → Victory Level (between levels) */}
      {phase === "boss_dead" && !isLoadingAI && (
        <div className="hud-center-panel victory-panel">
          <h2 className="victory-title text-[#d4af37]">✦ LEVEL CLEARED ✦</h2>
          <p>Level {level} completed!</p>
        </div>
      )}

      {/* CHOOSING UPGRADE */}
      {phase === "choosing_upgrade" && upgradeChoices && onSelectUpgrade && (
        <div className="hud-center-panel upgrade-panel border-none !bg-black/80 !backdrop-blur-xl" style={{ width: 850, maxWidth: "95vw", padding: "3rem" }}>
          <h2 className="victory-title text-center text-4xl mb-2 font-display bg-gradient-to-r from-[#d4af37] via-[#fff] to-[#d4af37] text-transparent bg-clip-text" style={{ textShadow: "none" }}>✦ NÂNG CẤP KỸ NĂNG ✦</h2>
          <p className="text-center font-sans text-gray-400 mb-8 tracking-widest text-sm">CHỌN 1 LINH HỒN ĐỂ CƯỜNG HÓA <span className="text-[#d4af37] font-bold block mt-1">(Dùng A/D hoặc 1,2,3 để chọn)</span></p>
          <div className="upgrade-cards grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            {upgradeChoices.map((choice, i) => (
              <button 
                key={choice.id} 
                onClick={() => onSelectUpgrade(choice.id)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`upgrade-card-btn group relative overflow-hidden rounded-xl bg-gradient-to-b from-[#1a1a1a]/80 to-[#0a0a0a]/90 border transition-all duration-300 p-6 ${
                  selectedIndex === i 
                    ? "border-[#d4af37] -translate-y-2 shadow-[0_10px_30px_rgba(212,175,55,0.4)] scale-105" 
                    : "border-[#d4af37]/30 hover:border-[#d4af37]/70"
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br from-[#d4af37]/20 to-transparent transition-opacity duration-300 ${selectedIndex === i ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}></div>
                <div className={`absolute top-2 left-3 text-xs font-mono font-bold ${selectedIndex === i ? "text-[#d4af37]" : "text-gray-600"}`}>[{i + 1}]</div>
                <div className={`text-5xl mb-4 transition-transform duration-300 drop-shadow-[0_0_15px_rgba(212,175,55,0.5)] ${selectedIndex === i ? "scale-110" : ""}`}>{choice.icon}</div>
                <h3 className={`text-lg font-bold mb-3 font-display uppercase tracking-widest transition-colors ${selectedIndex === i ? "text-white" : "text-[#d4af37]"}`}>{choice.title}</h3>
                <p className="text-sm text-gray-300 font-sans leading-relaxed opacity-80">{choice.description}</p>
                {selectedIndex === i && (
                   <div className="absolute bottom-2 left-0 right-0 text-center text-[#d4af37] font-mono text-[10px] animate-pulse">Vào (Enter)</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* GAME OVER - LOSE */}
      {phase === "player_dead" && (
        <div className="hud-center-panel death-panel !bg-black/95 !backdrop-blur-2xl border border-red-900/50 shadow-[0_0_50px_rgba(255,0,0,0.3)]">
          <div className="text-red-500 text-6xl mb-4 font-display">☠</div>
          <h2 className="death-title text-6xl mb-4 text-red-600 bg-clip-text text-transparent bg-gradient-to-b from-red-500 to-red-900 drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]">YOU DIED</h2>
          <p className="death-sub text-gray-400 text-lg mb-8 font-sans">Hiệp sĩ đã gục ngã trước bóng tối... Hãy đứng lên lần nữa!</p>
          <button className="hud-btn hud-btn-danger animate-pulse w-full max-w-xs mx-auto py-4 text-xl border-red-500/50 hover:bg-red-900/40" onClick={onRestart}>
            ↻ CHƠI LẠI <span className="text-xs opacity-70 block -mt-1">(Enter)</span>
          </button>
        </div>
      )}

      {/* GAME OVER - WIN (VICTORY) */}
      {phase === "victory" && (
        <div className="hud-center-panel victory-panel !bg-black/95 !backdrop-blur-2xl border border-[#d4af37]/50 shadow-[0_0_50px_rgba(212,175,55,0.3)]">
          <div className="text-[#d4af37] text-6xl mb-4 font-display">👑</div>
          <h2 className="victory-title text-6xl mb-4 text-[#d4af37] bg-clip-text text-transparent bg-gradient-to-b from-[#ffe55c] to-[#d4af37] drop-shadow-[0_0_20px_rgba(212,175,55,0.8)]">CHÚA TỂ CỦA ÁNH SÁNG</h2>
          <p className="death-sub text-gray-300 text-lg mb-8 font-sans">Trải qua 10 vòng đấu ác liệt, Hỗn Độn đã bị đè bẹp.<br/>Ngươi chính là huyền thoại vô danh cuối cùng.</p>
          <button className="hud-btn hud-btn-primary animate-pulse w-full max-w-xs mx-auto py-4 text-xl hover:scale-105 transition-transform" onClick={onRestart}>
            ↻ CHƠI LẠI <span className="text-xs opacity-70 block -mt-1">(Enter)</span>
          </button>
        </div>
      )}

      {/* ═══════ Boss Info Panel (right side) ═══════ */}
      {phase === "playing" && bossConfig && (
        <div className={`boss-info-panel ${panelCollapsed ? "collapsed" : ""}`}>
          <button
            className="boss-info-toggle"
            onClick={() => setPanelCollapsed(!panelCollapsed)}
          >
            {panelCollapsed ? "◀ BOSS" : "▶"}
          </button>

          {!panelCollapsed && (
            <>
              {/* Header */}
              <div className="boss-info-header">
                <div
                  className="boss-color-dot"
                  style={{ background: bossConfig.colorScheme }}
                />
                <span className="boss-info-title">BOSS LV.{bossConfig.level}</span>
              </div>

              {/* Taunt */}
              {bossConfig.tauntMessage && (
                <div className="boss-info-taunt">
                  &ldquo;{bossConfig.tauntMessage}&rdquo;
                </div>
              )}

              {/* Core Stats */}
              <div className="boss-info-section">
                <div className="boss-info-label">THÔNG SỐ</div>
                <div className="boss-stat-row">
                  <span className="stat-name">❤️ HP</span>
                  <StatDelta prev={prevBossConfig?.health} curr={bossConfig.health} />
                </div>
                <div className="boss-stat-row">
                  <span className="stat-name">💨 Tốc độ</span>
                  <StatDelta prev={prevBossConfig?.speed} curr={bossConfig.speed} />
                </div>
              </div>

              {/* Behavior */}
              <div className="boss-info-section">
                <div className="boss-info-label">HÀNH VI</div>
                <div className="boss-stat-row">
                  <span className="stat-name">Chiến thuật</span>
                  <span className="stat-val">{BEHAVIOR_LABELS[bossConfig.behaviorPattern] || bossConfig.behaviorPattern}</span>
                </div>
                <div className="boss-stat-row">
                  <span className="stat-name">AI Level</span>
                  <span className="stat-val">
                    {"◆".repeat(Math.min(bossConfig.aiAwarenessLevel, 10))}
                    <span style={{ opacity: 0.2 }}>{"◆".repeat(Math.max(0, 10 - bossConfig.aiAwarenessLevel))}</span>
                  </span>
                </div>
              </div>

              {/* Special Mechanics */}
              {(bossConfig.auraType && bossConfig.auraType !== "none" || bossConfig.desperationMode && bossConfig.desperationMode !== "none") && (
                <div className="boss-info-section">
                  <div className="boss-info-label">CƠ CHẾ ĐẶC QUYỀN (AI)</div>
                  {bossConfig.auraType && bossConfig.auraType !== "none" && (
                     <div className="boss-stat-row">
                       <span className="stat-name">Aura</span>
                       <span className="stat-val">{AURA_LABELS[bossConfig.auraType] || bossConfig.auraType}</span>
                     </div>
                  )}
                  {bossConfig.desperationMode && bossConfig.desperationMode !== "none" && (
                     <div className="boss-stat-row">
                       <span className="stat-name">Nguy Kịch (&lt;50%)</span>
                       <span className="stat-val">{DESPERATION_LABELS[bossConfig.desperationMode] || bossConfig.desperationMode}</span>
                     </div>
                  )}
                </div>
              )}

              {/* Special Abilities */}
              {bossConfig.unlockedSkills && bossConfig.unlockedSkills.length > 0 && (
                <div className="boss-info-section">
                  <div className="boss-info-label">KỸ NĂNG ĐẶC BIỆT</div>
                  {bossConfig.unlockedSkills.map((ability) => {
                    const icon = ABILITY_LABELS[ability.id]?.icon || "✦";
                    const isNew = newAbilities.some(a => a.id === ability.id);
                    return (
                      <div key={ability.id} className={`boss-ability-tag ${isNew ? "ability-new" : ""}`}>
                        <span>{icon}</span>
                        <span>{ability.name}</span>
                        {isNew && <span className="ability-new-badge">MỚI</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Evolution changes summary */}
              {prevBossConfig && (
                <div className="boss-info-section">
                  <div className="boss-info-label">TIẾN HÓA</div>
                  <div className="evolution-summary">
                    {bossConfig.health > prevBossConfig.health && <div className="evo-change">▲ Máu tăng</div>}
                    {bossConfig.speed > prevBossConfig.speed && <div className="evo-change">▲ Nhanh hơn</div>}
                    {bossConfig.behaviorPattern !== prevBossConfig.behaviorPattern && <div className="evo-change">◆ Đổi chiến thuật</div>}
                    {newAbilities.length > 0 && <div className="evo-change evo-new">★ +{newAbilities.length} kỹ năng mới</div>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Level indicator */}
      {phase === "playing" && (
        <div className="level-indicator">
          LV.{level}
        </div>
      )}

      {/* QUICK RESET / MENU BUTTONS */}
      {phase === "playing" && (
        <div className="absolute top-4 left-4 z-[900] pointer-events-auto flex flex-col gap-2">
          <button 
            onClick={onRestart}
            className="px-4 py-2 bg-red-900/40 hover:bg-red-700/80 border border-red-500/30 rounded text-red-100 font-sans text-xs tracking-wider transition-all shadow-[0_0_10px_rgba(255,0,0,0.1)] flex items-center justify-center cursor-pointer backdrop-blur-md"
          >
            ↻ CHƠI LẠI LEVEL
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-black/40 hover:bg-gray-800/80 border border-gray-500/30 rounded text-gray-300 font-sans text-xs tracking-wider transition-all shadow-md flex items-center justify-center cursor-pointer backdrop-blur-md"
          >
            ✕ THOÁT RA MENU
          </button>
        </div>
      )}

      {/* ═══════ DEV LOG Panel (left side) ═══════ */}
      {phase === "playing" && showDevLog && bossConfig && (
        <div className="dev-log-panel" style={{ 
          position: "absolute", top: 100, left: 20, width: 300, 
          background: "rgba(0, 40, 10, 0.85)", border: "1px solid #0f0", 
          color: "#0f0", fontFamily: "var(--font-mono)", padding: 15, 
          fontSize: 12, borderRadius: 4, zIndex: 999 
        }}>
          <h3 style={{ borderBottom: "1px solid #0f0", paddingBottom: 5, marginBottom: 10, marginTop: 0 }}>[DEV LOG] LÕI PHÂN TÍCH AI</h3>
          <div style={{ marginBottom: 4 }}><strong>Level:</strong> {bossConfig.level}</div>
          <div style={{ marginBottom: 4 }}><strong>Khả năng nhận thức:</strong> {bossConfig.aiAwarenessLevel}/10</div>
          <div style={{ marginBottom: 4 }}><strong>Thiên hướng:</strong> {bossConfig.behaviorPattern.toUpperCase()}</div>
          <div style={{ marginBottom: 4 }}><strong>Aura (Bất lợi môi trường):</strong> {bossConfig.auraType?.toUpperCase() || "NONE"}</div>
          <div style={{ marginBottom: 4 }}><strong>Desperation (Nguy kịch):</strong> {bossConfig.desperationMode?.toUpperCase() || "NONE"}</div>
          <div style={{ marginTop: 10, padding: "5px", background: "rgba(0, 255, 0, 0.1)", borderLeft: "2px solid #0f0" }}>
             <strong>Suy luận AI:</strong>
             <p style={{ marginTop: 5, lineHeight: 1.4, marginBottom: 0 }}>
               {bossConfig.aiReasoning || "Chưa có dữ liệu phân tích từ vòng lặp trước."}
             </p>
          </div>
        </div>
      )}

      {/* Command Input Overlay */}
      {phase === "playing" && (
        <div className="command-overlay" style={{ position: "absolute", bottom: 20, left: 260, zIndex: 1000, pointerEvents: "auto" }}>
          <form onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const input = form.elements.namedItem("cmd") as HTMLInputElement;
            if (input && input.value && onCommand) {
              onCommand(input.value);
              input.value = "";
              input.blur(); // Remove focus so player can continue playing
            }
          }}>
            <input 
              name="cmd" 
              type="text" 
              placeholder="Nhập lệnh... (thử gõ 'dev')" 
              autoComplete="off" 
              style={{
                background: "rgba(20, 15, 10, 0.8)",
                border: "1px solid rgba(212, 175, 55, 0.5)",
                color: "#d4af37",
                padding: "8px 12px",
                borderRadius: "2px",
                outline: "none",
                fontFamily: "var(--font-mono)",
                width: "200px",
                fontSize: "12px"
              }}
            />
          </form>
        </div>
      )}
    </div>
  );
}
