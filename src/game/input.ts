// ========================
// Keyboard Input Handler
// ========================

import { InputState } from "./types";

// Key bindings cho Player 1
const P1_MAP: Record<string, keyof InputState> = {
  a: "left",
  d: "right",
  w: "jump",
  s: "down",
  " ": "jump",
  f: "melee",
  g: "ranged",
  h: "block",
  Shift: "dash",
  // Hỗ trợ thêm cho người chơi 1 quen xài JKL (khi chơi 1 mình vẫn xài đc)
  j: "melee",
  k: "ranged",
  l: "block",
};

// Key bindings cho Player 2
const P2_MAP: Record<string, keyof InputState> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "jump",
  ArrowDown: "down",
  Numpad1: "melee",
  Numpad2: "ranged",
  Numpad3: "block",
  Numpad0: "dash",
  // Backup cho máy không có phím số (sử dụng các phím gần Mũi tên)
  ",": "melee",
  ".": "ranged",
  "/": "block",
  "ShiftRight": "dash",
  // Backup cho người quen xài phím 1 2 3 ở trên cùng (dùng e.code)
  Digit1: "melee",
  Digit2: "ranged",
  Digit3: "block",
  Digit0: "dash",
  "1": "melee",
  "2": "ranged",
  "3": "block",
  "0": "dash",
};

class InputManager {
  private stateP1: InputState;
  private stateP2: InputState;
  
  private justPressedP1: Set<keyof InputState> = new Set();
  private justPressedP2: Set<keyof InputState> = new Set();


  private attached = false;

  constructor() {
    this.stateP1 = this.createEmptyState();
    this.stateP2 = this.createEmptyState();
    this.init();
  }

  private createEmptyState(): InputState {
    return {
      left: false, right: false, jump: false, down: false,
      melee: false, ranged: false, dash: false, block: false,
    };
  }

  /** Attach keyboard listeners (safe to call multiple times) */
  init(): void {
    if (typeof window === "undefined" || this.attached) return;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.attached = true;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    
    // Player 1
    const p1Action = P1_MAP[e.code] || P1_MAP[e.key];
    if (p1Action) {
      e.preventDefault();
      if (!this.stateP1[p1Action]) this.justPressedP1.add(p1Action);
      this.stateP1[p1Action] = true;
    }
    
    // Player 2
    const p2Action = P2_MAP[e.code] || P2_MAP[e.key];
    if (p2Action) {
      e.preventDefault();
      if (!this.stateP2[p2Action]) this.justPressedP2.add(p2Action);
      this.stateP2[p2Action] = true;
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const p1Action = P1_MAP[e.code] || P1_MAP[e.key];
    if (p1Action) {
      e.preventDefault();
      this.stateP1[p1Action] = false;
    }
    const p2Action = P2_MAP[e.code] || P2_MAP[e.key];
    if (p2Action) {
      e.preventDefault();
      this.stateP2[p2Action] = false;
    }
  };

  /** Current continuous input state */
  getState(player: 1 | 2 = 1): Readonly<InputState> {
    return player === 1 ? this.stateP1 : this.stateP2;
  }

  /** Returns true only on the first frame a key is pressed */
  isJustPressed(action: keyof InputState, player: 1 | 2 = 1): boolean {
    return player === 1 ? this.justPressedP1.has(action) : this.justPressedP2.has(action);
  }

  /** Call at end of each frame to reset one-shot flags */
  endFrame(): void {
    this.justPressedP1.clear();
    this.justPressedP2.clear();
  }

  destroy(): void {
    if (typeof window === "undefined" || !this.attached) return;
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.attached = false;
  }
}

// Singleton
export const inputManager = new InputManager();
export { InputManager };
