
export enum GameState {
  MENU = 'MENU',
  GENERATING = 'GENERATING',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Entity extends Rect {
  vx: number;
  vy: number;
  isGrounded: boolean;
  health: number;
  maxHealth: number;
  direction: 1 | -1; // 1 = right, -1 = left
  state: 'IDLE' | 'WALK' | 'JUMP' | 'ATTACK' | 'HIT' | 'DEAD' | 'STUMBLE';
  attackType?: 'PUNCH' | 'KICK' | 'LASER';
  attackCooldown: number;
  sprite?: HTMLCanvasElement | HTMLImageElement; // Changed to allow processed canvas
  color: string;
  tick: number; // For animation timing
  blinkTimer: number; // For eye blinking
  mumbleTimer?: number; // For random zombie rambling
}

export interface GameAssets {
  playerSprite: string | null;
  enemySprite: string | null;
  background: string | null;
}

export interface KeyState {
  [key: string]: boolean;
}
