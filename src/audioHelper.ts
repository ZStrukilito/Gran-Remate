// Helper to create simple cozy sound effects using Web Audio API and Speech Synthesis
let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Play a short pleasant click sound
export function playClickSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (error) {
    console.warn('Audio Context not allowed or failed:', error);
  }
}

// Play a hammer-knock sound (for auction table lock-in)
export function playHammerSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (error) {
    console.warn('Hammer sound failed:', error);
  }
}

// Cheery arpeggio for winning an auction
export function playWinSound() {
  try {
    const ctx = getAudioContext();
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.1);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime + index * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (index * 0.1) + 0.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + index * 0.1);
      osc.stop(ctx.currentTime + (index * 0.1) + 0.22);
    });
  } catch (error) {
    console.warn('Win sound failed:', error);
  }
}

// Gentle downward sound for skipping or losing an item
export function playLoseSound() {
  try {
    const ctx = getAudioContext();
    const notes = [392.00, 311.13, 261.63]; // G4, Eb4, C4
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.15);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime + index * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (index * 0.15) + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + index * 0.15);
      osc.stop(ctx.currentTime + (index * 0.15) + 0.37);
    });
  } catch (error) {
    console.warn('Lose sound failed:', error);
  }
}

let activeSpeech: SpeechSynthesisUtterance | null = null;

// Clean up any speaking voice and talk
export function playVoice(text: string, voiceEnabled: boolean) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;
  
  try {
    window.speechSynthesis.cancel(); // Stop anything currently running
    activeSpeech = null;
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to set Spanish, specifically Argentine es-AR if available
    utterance.lang = 'es-AR';
    utterance.rate = 0.88; // Slightly slow down for seniors' convenience
    utterance.pitch = 1.05; // Friendly pitch
    
    // Try to find a warm sounding Spanish voice
    const voices = window.speechSynthesis.getVoices();
    const optimalVoice = voices.find(v => v.lang.includes('es-AR')) || 
                        voices.find(v => v.lang.includes('es')) || 
                        voices[0];
    if (optimalVoice) {
      utterance.voice = optimalVoice;
    }
    
    activeSpeech = utterance;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error('Error speaking text:', e);
  }
}

// Stop current speech
export function stopVoice() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
