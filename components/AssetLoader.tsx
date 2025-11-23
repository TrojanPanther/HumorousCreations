
import React, { useEffect, useState } from 'react';
import { generateGameAsset, generateBackground } from '../services/geminiService';
import { GameAssets } from '../types';

interface AssetLoaderProps {
  onAssetsLoaded: (assets: GameAssets) => void;
}

export const AssetLoader: React.FC<AssetLoaderProps> = ({ onAssetsLoaded }) => {
  const [status, setStatus] = useState<string>("Initializing...");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        setStatus("Creating Hyper-Realistic Rhett & Cat...");
        // Updated prompt: Young man, hyper-realistic face, specific details.
        const playerPrompt = "Side view fighting game sprite. A hyper-realistic photorealistic young man (early 20s) named Rhett. He has short dark curly hair, no beard, and a very handsome, realistic face. He is wearing a blue soccer jersey. He is riding a giant, fluffy, realistic Maine Coon cat. The image should be high definition, isolated on a pure white background.";
        const playerImg = await generateGameAsset(playerPrompt);
        setProgress(33);

        setStatus("Summoning Zombie Biden...");
        // Detailed prompt for Zombie Biden
        const enemyPrompt = "Side view fighting game sprite of a bobblehead caricature of Zombie Joe Biden. He has a very large head, white hair, pale zombie skin, and is wearing a torn blue suit. He looks like a sick old man holding a pistol. Isolated on a pure white background.";
        const enemyImg = await generateGameAsset(enemyPrompt);
        setProgress(66);

        setStatus("Painting the Arena...");
        const bgImg = await generateBackground();
        setProgress(100);

        onAssetsLoaded({
          playerSprite: playerImg,
          enemySprite: enemyImg,
          background: bgImg
        });

      } catch (e) {
        console.error(e);
        setStatus("Error generating assets. Using placeholders.");
        // Proceed with null assets (engine handles fallbacks)
        setTimeout(() => {
            onAssetsLoaded({ playerSprite: null, enemySprite: null, background: null });
        }, 1000);
      }
    };

    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-8">
      <h2 className="text-2xl mb-4 text-yellow-400 animate-pulse">GENERATING FIGHTERS</h2>
      <div className="w-full max-w-md bg-gray-700 rounded-full h-6 mb-4 border-2 border-white">
        <div 
          className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <p className="text-sm text-gray-400">{status}</p>
      <div className="mt-8 text-xs text-gray-500 text-center max-w-lg">
        Powered by Gemini 2.5 Flash Image. <br/>
        Creating custom sprites.
      </div>
    </div>
  );
};
