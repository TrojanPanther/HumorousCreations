
import React, { useState, useRef } from 'react';
import { GameState, GameAssets } from './types';
import { AssetLoader } from './components/AssetLoader';
import { GameEngine } from './components/GameEngine';
import { audioController } from './services/audioService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [assets, setAssets] = useState<GameAssets>({ playerSprite: null, enemySprite: null, background: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStart = () => {
    audioController.init();
    setGameState(GameState.GENERATING);
  };

  const handleAssetsLoaded = (loadedAssets: GameAssets) => {
    setAssets(loadedAssets);
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = (result: 'VICTORY' | 'GAME_OVER') => {
    setGameState(result === 'VICTORY' ? GameState.VICTORY : GameState.GAME_OVER);
    audioController.stopMusic();
    audioController.playSfx(result === 'VICTORY' ? 'WIN' : 'LOSE');
  };

  const resetGame = () => {
    setGameState(GameState.PLAYING);
    audioController.startMusic();
  };

  const saveFighters = () => {
    if (!assets.playerSprite) return;
    const json = JSON.stringify(assets);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cat-fighter-memory-card.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerLoad = () => {
    audioController.init();
    fileInputRef.current?.click();
  };

  const loadFighters = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const loadedAssets = JSON.parse(e.target?.result as string);
            if (loadedAssets.playerSprite && loadedAssets.enemySprite) {
                setAssets(loadedAssets);
                setGameState(GameState.PLAYING);
            } else {
                alert("Invalid Memory Card Data!");
            }
        } catch (err) {
            console.error("Failed to load memory card", err);
            alert("Corrupted Memory Card!");
        }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={loadFighters} 
        accept=".json" 
        className="hidden" 
      />

      {gameState === GameState.MENU && (
        <div className="text-center space-y-8 animate-fade-in relative max-w-2xl w-full">
          <h1 className="text-6xl text-yellow-500 font-black tracking-tighter" style={{ textShadow: '4px 4px #b91c1c' }}>
            CAT RIDER<br/><span className="text-white text-4xl">FIGHTER</span>
          </h1>
          
          <div className="bg-gray-800 p-6 rounded-lg border-2 border-gray-600 mx-auto text-left text-gray-300 text-xs leading-5 shadow-xl">
             <p className="mb-2 text-yellow-400 font-bold uppercase border-b border-gray-600 pb-1">Mission Log:</p>
             <p className="mb-4">Defeat the Zombie Politician using your Maine Coon battle mount.</p>
             <p className="mb-2 text-yellow-400 font-bold uppercase border-b border-gray-600 pb-1">Controls:</p>
             <ul className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
                <li><span className="bg-gray-700 px-2 py-1 rounded border border-gray-500 text-white">Arrows</span> Move</li>
                <li><span className="bg-gray-700 px-2 py-1 rounded border border-gray-500 text-white">Space</span> Jump</li>
                <li><span className="bg-gray-700 px-2 py-1 rounded border border-gray-500 text-white">E</span> Punch</li>
                <li><span className="bg-gray-700 px-2 py-1 rounded border border-gray-500 text-white">S</span> Kick</li>
                <li><span className="bg-gray-700 px-2 py-1 rounded border border-gray-500 text-white">D</span> Laser</li>
             </ul>
          </div>

          <div className="flex flex-col gap-4 items-center">
            <button 
                onClick={handleStart}
                className="w-64 px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-[0_4px_0_rgb(127,29,29)] active:shadow-[0_0px_0_rgb(127,29,29)] active:translate-y-1 transition-all text-xl"
            >
                INSERT COIN
            </button>
            
            <button 
                onClick={triggerLoad}
                className="w-64 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-[0_4px_0_rgb(30,58,138)] active:shadow-[0_0px_0_rgb(30,58,138)] active:translate-y-1 transition-all text-sm uppercase"
            >
                Load Memory Card
            </button>
          </div>
        </div>
      )}

      {gameState === GameState.GENERATING && (
        <AssetLoader onAssetsLoaded={handleAssetsLoaded} />
      )}

      {gameState === GameState.PLAYING && (
        <GameEngine assets={assets} onGameOver={handleGameOver} />
      )}

      {(gameState === GameState.VICTORY || gameState === GameState.GAME_OVER) && (
        <div className="text-center z-50 absolute inset-0 bg-black/90 flex flex-col items-center justify-center animate-fade-in">
          <h2 className={`text-6xl mb-8 ${gameState === GameState.VICTORY ? 'text-green-500' : 'text-red-600'} font-black tracking-widest`} style={{ textShadow: '0 0 20px currentColor' }}>
            {gameState === GameState.VICTORY ? 'VICTORY' : 'GAME OVER'}
          </h2>
          
          <div className="flex gap-4 mb-8">
             <button 
                onClick={resetGame}
                className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded shadow-[0_4px_0_rgb(161,98,7)] active:translate-y-1 active:shadow-none"
              >
                REMATCH
              </button>
              <button 
                onClick={() => setGameState(GameState.MENU)}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded shadow-[0_4px_0_rgb(75,85,99)] active:translate-y-1 active:shadow-none"
              >
                MAIN MENU
              </button>
          </div>

          {assets.playerSprite && (
            <button 
                onClick={saveFighters}
                className="text-gray-400 hover:text-white underline text-sm flex items-center gap-2"
            >
                <span>💾</span> SAVE FIGHTER DATA TO DISK
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
