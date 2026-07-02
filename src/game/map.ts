// ========================
// Map: Fixed platform layout & level data
// ========================

import { MapData } from "./types";

/** Create default arena map
 *  Jump physics: GRAVITY=1800, JUMP_FORCE=-580
 *  Single jump max height ≈ 93px, double jump total ≈ 172px */
export function createArenaMap(canvasWidth: number, canvasHeight: number): MapData {
  const floorY = canvasHeight - 60;
  const floorThickness = 60;

  // Chiều cao các tầng dựa trên tầm nhảy thực tế
  const tier1 = 80;   // Nhảy đơn dễ dàng (< 93px)
  const tier2 = 150;  // Cần double jump từ sàn, hoặc single jump từ tier 1
  const tier3 = 230;  // Cần double jump từ tier 1

  return {
    platforms: [
      // Sàn chính
      { x: 0, y: floorY, width: canvasWidth, height: floorThickness, type: "ground" },
      
      // Tường biên
      { x: -50, y: 0, width: 50, height: canvasHeight, type: "wall" },
      { x: canvasWidth, y: 0, width: 50, height: canvasHeight, type: "wall" },

      // 1. Nền tảng thấp bên trái
      { x: canvasWidth * 0.15, y: floorY - 130, width: 240, height: 24, type: "platform" },
      
      // 2. Nền tảng thấp bên phải
      { x: canvasWidth * 0.85 - 240, y: floorY - 130, width: 240, height: 24, type: "platform" },

      // 3. Nền tảng trung tâm (Nhảy cao hơn)
      { x: canvasWidth / 2 - 140, y: floorY - 260, width: 280, height: 24, type: "platform" },
    ],
    spawnPoint: { x: 150, y: floorY - 50 },
    bossSpawnPoint: { x: canvasWidth - 250, y: floorY - 110 },
    bounds: { x: 0, y: 0, width: canvasWidth, height: canvasHeight },
  };
}
