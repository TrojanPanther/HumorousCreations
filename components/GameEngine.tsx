
import React, { useRef, useEffect, useState } from 'react';
import { 
  CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_Y, GRAVITY, JUMP_FORCE, 
  MOVE_SPEED, PLAYER_WIDTH, PLAYER_HEIGHT, ENEMY_WIDTH, ENEMY_HEIGHT, 
  PLAYER_COLOR, ENEMY_COLOR, FRICTION, INITIAL_PLAYER_HEALTH, 
  INITIAL_ENEMY_HEALTH, ATTACK_DURATION, ATTACK_COOLDOWN, DAMAGE,
  LASER_DAMAGE, LASER_COOLDOWN
} from '../constants';
import { GameState, Entity, GameAssets, KeyState } from '../types';
import { audioController } from '../services/audioService';

interface GameEngineProps {
  assets: GameAssets;
  onGameOver: (result: 'VICTORY' | 'GAME_OVER') => void;
}

export const GameEngine: React.FC<GameEngineProps> = ({ assets, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Processed Images
  const playerSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const enemySpriteRef = useRef<HTMLCanvasElement | null>(null);
  const bgImg = useRef<HTMLImageElement | null>(null);

  // Game State Refs
  const playerRef = useRef<Entity>({
    x: 50,
    y: GROUND_Y - PLAYER_HEIGHT,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    vx: 0,
    vy: 0,
    isGrounded: true,
    health: INITIAL_PLAYER_HEALTH,
    maxHealth: INITIAL_PLAYER_HEALTH,
    direction: 1,
    state: 'IDLE',
    attackCooldown: 0,
    color: PLAYER_COLOR,
    tick: 0,
    blinkTimer: 0
  });

  const enemyRef = useRef<Entity>({
    x: 500,
    y: GROUND_Y - ENEMY_HEIGHT,
    width: ENEMY_WIDTH,
    height: ENEMY_HEIGHT,
    vx: 0,
    vy: 0,
    isGrounded: true,
    health: INITIAL_ENEMY_HEALTH,
    maxHealth: INITIAL_ENEMY_HEALTH,
    direction: -1,
    state: 'IDLE',
    attackCooldown: 0,
    color: ENEMY_COLOR,
    tick: 0,
    blinkTimer: 0,
    mumbleTimer: 100
  });

  const keys = useRef<KeyState>({});
  
  const [pHealth, setPHealth] = useState(INITIAL_PLAYER_HEALTH);
  const [eHealth, setEHealth] = useState(INITIAL_ENEMY_HEALTH);

  const processSprite = (imgSrc: string): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imgSrc;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                if (r > 230 && g > 230 && b > 230) {
                    data[i + 3] = 0;
                }
            }
            ctx.putImageData(imgData, 0, 0);
            resolve(canvas);
        };
        img.onerror = reject;
    });
  };

  useEffect(() => {
    const load = async () => {
        if (assets.playerSprite) {
            try { playerSpriteRef.current = await processSprite(assets.playerSprite); } catch (e) {}
        }
        if (assets.enemySprite) {
            try { enemySpriteRef.current = await processSprite(assets.enemySprite); } catch (e) {}
        }
        if (assets.background) {
            const img = new Image();
            img.src = assets.background;
            bgImg.current = img;
        }
    };
    load();
  }, [assets]);

  useEffect(() => {
    audioController.startMusic();
    return () => { audioController.stopMusic(); };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === ' ') {
        if (playerRef.current.isGrounded) {
          playerRef.current.vy = JUMP_FORCE;
          playerRef.current.isGrounded = false;
          playerRef.current.state = 'JUMP';
          audioController.playSfx('JUMP');
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const updateEntity = (entity: Entity) => {
    entity.tick++;

    // STUMBLE Logic
    if (entity.state === 'STUMBLE') {
        // Friction is high, can't move
        entity.vx *= 0.5;
        // Recover after some time
        if (entity.attackCooldown > 0) {
            entity.attackCooldown--;
        } else {
            entity.state = 'IDLE';
        }
    }

    entity.vy += GRAVITY;
    entity.x += entity.vx;
    entity.y += entity.vy;

    if (entity.y + entity.height >= GROUND_Y) {
      entity.y = GROUND_Y - entity.height;
      entity.vy = 0;
      entity.isGrounded = true;
      if (entity.state === 'JUMP') entity.state = 'IDLE';
    } else {
        entity.isGrounded = false;
    }

    if (entity.x < -50) entity.x = -50;
    if (entity.x + entity.width > CANVAS_WIDTH + 50) entity.x = CANVAS_WIDTH + 50 - entity.width;

    if (entity.attackCooldown > 0 && entity.state !== 'STUMBLE') entity.attackCooldown--;

    if (entity.blinkTimer > 0) {
        entity.blinkTimer--;
    } else {
        if (Math.random() < 0.005) {
            entity.blinkTimer = 10;
        }
    }

    const recovery = entity.attackType === 'LASER' ? LASER_COOLDOWN - 30 : ATTACK_COOLDOWN - ATTACK_DURATION;
    if (entity.state === 'ATTACK' && entity.attackCooldown < recovery) {
        entity.state = 'IDLE';
    }
  };

  const checkCollision = (rect1: Entity, rect2: Entity) => {
    const shrink = 40;
    return (
      rect1.x + shrink < rect2.x + rect2.width - shrink &&
      rect1.x + rect1.width - shrink > rect2.x + shrink &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  const gameLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player = playerRef.current;
    const enemy = enemyRef.current;

    // --- PLAYER ---
    player.vx = 0;
    // Cannot move while attacking or laser cooldown
    const canMove = player.state !== 'ATTACK' || (player.attackType !== 'LASER' && player.attackCooldown < ATTACK_COOLDOWN - 10);
    
    if (canMove) {
        if (keys.current['arrowleft']) {
        player.vx = -MOVE_SPEED;
        player.direction = -1;
        if (player.isGrounded) player.state = 'WALK';
        } else if (keys.current['arrowright']) {
        player.vx = MOVE_SPEED;
        player.direction = 1;
        if (player.isGrounded) player.state = 'WALK';
        } else {
        if (player.isGrounded) player.state = 'IDLE';
        }
    }

    const isPunching = keys.current['e'];
    const isKicking = keys.current['s'];
    const isLaser = keys.current['d'];
    const isAttacking = isPunching || isKicking || isLaser;

    if (isAttacking && player.attackCooldown === 0) {
      player.state = 'ATTACK';
      
      if (isLaser) {
          player.attackType = 'LASER';
          player.attackCooldown = LASER_COOLDOWN;
          audioController.playSfx('LASER');
          // Laser Logic
          const laserRange = CANVAS_WIDTH; 
          const hitBox: Entity = {
            ...player,
            x: player.direction === 1 ? player.x + player.width/2 : player.x + player.width/2 - laserRange,
            y: player.y + player.height * 0.4,
            width: laserRange,
            height: 20,
            vx: 0, vy: 0, isGrounded: false, color: '', blinkTimer: 0, tick: 0, health: 0, maxHealth: 0, direction: 1, state: 'IDLE', attackCooldown: 0
          };

          if (checkCollision(hitBox, enemy)) {
             enemy.health -= LASER_DAMAGE;
             enemy.vx = player.direction * 5; 
             enemy.state = 'HIT';
             setEHealth(enemy.health);
             audioController.playSfx('HIT');
             audioController.playSfx('GRUNT');
          }

      } else {
          // Melee
          player.attackCooldown = ATTACK_COOLDOWN;
          player.attackType = isKicking ? 'KICK' : 'PUNCH';
          
          // Trigger Cat MEOW only on attack
          audioController.playSfx('ATTACK');
          if (Math.random() > 0.5) audioController.playSfx('MEOW'); 
          
          const attackRange = 100;
          const hitBox: Entity = {
            ...player,
            x: player.direction === 1 ? player.x + player.width - 50 : player.x - attackRange + 50,
            width: attackRange,
            vx: 0, vy: 0, isGrounded: false, color: '', blinkTimer: 0, tick: 0, health: 0, maxHealth: 0, direction: 1, state: 'IDLE', attackCooldown: 0
          };

          if (checkCollision(hitBox, enemy)) {
            enemy.health -= DAMAGE;
            enemy.vx = player.direction * 15;
            enemy.vy = -8;
            enemy.state = 'HIT';
            setEHealth(enemy.health);
            audioController.playSfx('HIT');
            audioController.playSfx('GRUNT');
          }
      }
    }
    updateEntity(player);

    // --- ENEMY ---
    const dist = (player.x + player.width/2) - (enemy.x + enemy.width/2);
    
    // Zombie Stumble
    if (enemy.state === 'IDLE' || enemy.state === 'WALK') {
        // 0.5% chance to stumble per frame
        if (Math.random() < 0.005) {
            enemy.state = 'STUMBLE';
            enemy.attackCooldown = 90; // Stunned for 1.5s
            audioController.playSfx('GRUNT');
            // Sometimes mumble while falling
            if (Math.random() < 0.5) audioController.playSfx('MUMBLE');
        }
    }

    if (enemy.state !== 'HIT' && enemy.state !== 'DEAD' && enemy.state !== 'STUMBLE') {
        enemy.direction = dist > 0 ? 1 : -1;

        if (Math.abs(dist) > 150) {
            enemy.vx = dist > 0 ? 2.5 : -2.5;
            enemy.state = 'WALK';
        } else {
            enemy.vx = 0;
            if (enemy.attackCooldown === 0 && Math.random() < 0.03) {
                enemy.state = 'ATTACK';
                enemy.attackType = Math.random() > 0.5 ? 'PUNCH' : 'KICK';
                enemy.attackCooldown = ATTACK_COOLDOWN + 15;
                audioController.playSfx('ATTACK');
                
                // Mumble trigger on Attack
                audioController.playSfx('MUMBLE');

                const enemyHitBox: Entity = {
                    ...enemy,
                    x: enemy.direction === 1 ? enemy.x + enemy.width - 50 : enemy.x - 100 + 50,
                    width: 100,
                    vx: 0, vy: 0, isGrounded: false, color: '', blinkTimer: 0, tick: 0, health: 0, maxHealth: 0, direction: 1, state: 'IDLE', attackCooldown: 0
                };

                if (checkCollision(enemyHitBox, player)) {
                    player.health -= DAMAGE;
                    player.vx = enemy.direction * 15;
                    player.vy = -5;
                    player.state = 'HIT';
                    setPHealth(player.health);
                    audioController.playSfx('HIT');
                    audioController.playSfx('GRUNT');
                }
            } else if (enemy.state !== 'ATTACK') {
                enemy.state = 'IDLE';
            }
        }
    } else if (enemy.state === 'HIT') {
        if (enemy.isGrounded && Math.abs(enemy.vx) < 1) {
            enemy.state = 'IDLE';
        }
        enemy.vx *= FRICTION;
    }

    updateEntity(enemy);

    if (enemy.health <= 0) { onGameOver('VICTORY'); return; }
    if (player.health <= 0) { onGameOver('GAME_OVER'); return; }

    // --- DRAW ---
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (bgImg.current) {
        ctx.drawImage(bgImg.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const drawShadow = (e: Entity) => {
        ctx.beginPath();
        ctx.ellipse(e.x + e.width/2, GROUND_Y, e.width/3, 15, 0, 0, Math.PI * 2);
        ctx.fill();
    };
    drawShadow(player);
    drawShadow(enemy);

    const drawEntity = (e: Entity, sprite: HTMLCanvasElement | null) => {
        ctx.save();
        let offsetY = 0;
        let scaleY = 1;
        let rotate = 0;
        
        if (e.state === 'IDLE') {
            offsetY = Math.sin(e.tick * 0.1) * 3;
            scaleY = 1 + Math.sin(e.tick * 0.05) * 0.02;
        } else if (e.state === 'WALK') {
            offsetY = Math.abs(Math.sin(e.tick * 0.3)) * -15; 
            rotate = Math.sin(e.tick * 0.3) * 0.05; 
        } else if (e.state === 'ATTACK') {
             offsetY = 5;
             rotate = -0.1 * e.direction;
        } else if (e.state === 'HIT') {
             offsetY = (Math.random() - 0.5) * 10;
             rotate = (Math.random() - 0.5) * 0.2;
        } else if (e.state === 'STUMBLE') {
             // Trip Logic
             rotate = 1.5 * e.direction; // 90 degrees faceplant
             offsetY = e.height * 0.4; // Move down to floor
        }

        const cx = e.x + e.width / 2;
        const cy = e.y + e.height; 

        ctx.translate(cx, cy);
        ctx.scale(e.direction, 1);
        ctx.rotate(rotate);
        ctx.scale(1, scaleY);
        ctx.translate(0, offsetY);

        if (sprite) {
             ctx.drawImage(sprite, -e.width/2, -e.height, e.width, e.height);
             if (e.blinkTimer > 0 && e.state !== 'HIT' && e.state !== 'STUMBLE') {
                 ctx.fillStyle = '#eeba98';
                 ctx.fillRect(-e.width * 0.15, -e.height * 0.65, e.width * 0.1, e.height * 0.02);
                 ctx.fillRect(e.width * 0.10, -e.height * 0.65, e.width * 0.1, e.height * 0.02);
             }
        } else {
            ctx.fillStyle = e.color;
            ctx.fillRect(-e.width/2, -e.height, e.width, e.height);
        }

        if (e.state === 'ATTACK' && e.attackType !== 'LASER') {
             ctx.fillStyle = '#eeba98'; 
             ctx.strokeStyle = '#000';
             ctx.lineWidth = 2;
             if (e.attackType === 'KICK') {
                 ctx.beginPath();
                 ctx.ellipse(e.width * 0.3, -e.height * 0.15, 30, 15, 0, 0, Math.PI*2);
                 ctx.fill();
                 ctx.stroke();
             } else {
                 ctx.beginPath();
                 ctx.ellipse(e.width * 0.35, -e.height * 0.55, 25, 20, 0, 0, Math.PI*2);
                 ctx.fill();
                 ctx.stroke();
             }
        }

        // --- LASER EYES CORRECTION ---
        if (e.state === 'ATTACK' && e.attackType === 'LASER') {
             // Position relative to sprite center (Cat's head approx area)
             // These are local coordinates inside the transformed context (rotated/scaled)
             // The cat is riding, so head is lower mid.
             const eyeY = -e.height * 0.55; 
             const eyeX = e.width * 0.25; 

             ctx.shadowBlur = 15;
             ctx.shadowColor = 'red';
             ctx.strokeStyle = '#ff0000';
             ctx.lineWidth = 6;
             ctx.beginPath();
             ctx.moveTo(eyeX, eyeY);
             ctx.lineTo(eyeX + 1000, eyeY); 
             ctx.stroke();
             
             ctx.strokeStyle = '#ffffff';
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.moveTo(eyeX, eyeY);
             ctx.lineTo(eyeX + 1000, eyeY); 
             ctx.stroke();
             
             ctx.shadowBlur = 0;
        }

        if (e.state === 'HIT' || e.state === 'STUMBLE') {
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 4;
            // X Eyes
            ctx.beginPath();
            ctx.moveTo(-e.width * 0.20, -e.height * 0.68);
            ctx.lineTo(-e.width * 0.10, -e.height * 0.62);
            ctx.moveTo(-e.width * 0.10, -e.height * 0.68);
            ctx.lineTo(-e.width * 0.20, -e.height * 0.62);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(e.width * 0.10, -e.height * 0.68);
            ctx.lineTo(e.width * 0.20, -e.height * 0.62);
            ctx.moveTo(e.width * 0.20, -e.height * 0.68);
            ctx.lineTo(e.width * 0.10, -e.height * 0.62);
            ctx.stroke();
        }

        ctx.restore();

        // Stumble Visual
        if (e.state === 'STUMBLE') {
             ctx.fillStyle = '#facc15';
             ctx.strokeStyle = '#000';
             ctx.lineWidth = 2;
             ctx.font = '900 30px Arial'; 
             ctx.fillText('!', e.x + e.width/2 - 5, e.y - 20);
             ctx.strokeText('!', e.x + e.width/2 - 5, e.y - 20);
        }
    };

    drawEntity(player, playerSpriteRef.current);
    drawEntity(enemy, enemySpriteRef.current);

    if (player.state === 'ATTACK' && player.attackType !== 'LASER') {
         ctx.fillStyle = 'rgba(255,255,255,0.5)';
         ctx.beginPath();
         let effY = 130;
         if (player.attackType === 'KICK') effY = 10;
         ctx.arc(player.x + (player.width/2) + (player.direction * 100), player.y + player.height - effY, 30, 0, Math.PI*2);
         ctx.fill();
    }
    
    if (enemy.state === 'HIT' && player.attackType === 'LASER' && player.state === 'ATTACK') {
        ctx.fillStyle = 'rgba(255, 69, 0, 0.5)';
        ctx.beginPath();
        const fireX = enemy.x + enemy.width/2 + (Math.random() - 0.5) * 50;
        const fireY = enemy.y + enemy.height/2 + (Math.random() - 0.5) * 50;
        ctx.arc(fireX, fireY, 60, 0, Math.PI * 2);
        ctx.fill();
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [assets]);

  return (
    <div className="relative border-4 border-gray-700 rounded-lg overflow-hidden shadow-2xl bg-black">
      <div className="absolute top-4 left-4 right-4 flex justify-between z-10 text-white font-bold text-shadow pointer-events-none">
        <div className="w-1/3">
          <div className="text-yellow-400 text-lg mb-1 drop-shadow-md">RHETT & CAT</div>
          <div className="h-8 bg-red-900 border-4 border-gray-800 skew-x-[-15deg] shadow-lg">
            <div 
              className="h-full bg-gradient-to-r from-yellow-400 to-red-500 transition-all duration-200" 
              style={{ width: `${(pHealth / INITIAL_PLAYER_HEALTH) * 100}%` }}
            ></div>
          </div>
        </div>
        
        <div className="flex flex-col items-center mt-2">
            <div className="text-4xl font-black text-red-600 drop-shadow-lg tracking-widest">VS</div>
        </div>

        <div className="w-1/3 text-right">
          <div className="text-purple-400 text-lg mb-1 drop-shadow-md">ZOMBIE BIDEN</div>
          <div className="h-8 bg-red-900 border-4 border-gray-800 skew-x-[15deg] ml-auto shadow-lg">
             <div 
              className="h-full bg-gradient-to-l from-green-400 to-blue-500 transition-all duration-200 float-right" 
              style={{ width: `${(eHealth / INITIAL_ENEMY_HEALTH) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        className="block bg-gray-800"
      />
    </div>
  );
};
