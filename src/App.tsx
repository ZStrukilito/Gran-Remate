import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown,
  ChevronUp,
  Plus,
  Gavel, 
  Volume2, 
  VolumeX, 
  Coins, 
  RotateCcw, 
  Sparkles, 
  ZoomIn, 
  Contrast, 
  ArrowRight,
  Sparkle,
  Home,
  Users,
  AlertCircle,
  Menu,
  X
} from 'lucide-react';
import { AuctionItem } from './types';
import { 
  playClickSound, 
  playHammerSound, 
  playWinSound, 
  playLoseSound, 
  playVoice, 
  stopVoice 
} from './audioHelper';

// Uniquely identify browser session so reconnection keeps current profile
const getOrCreatePlayerId = (): string => {
  let pid = localStorage.getItem('remate_player_id');
  if (!pid) {
    pid = 'p-' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('remate_player_id', pid);
  }
  return pid;
};

// Simple visual avatars to display in player lists
const AVATARS = ['👴', '👵', '👨', '👩', '🧉', '🥩', '🍞', '🏡', '🐕', '🐈', '🚗', '🩺'];

export default function App() {
  const myPlayerId = getOrCreatePlayerId();

  // Settings
  const [fontSize, setFontSize] = useState<'normal' | 'grande' | 'super'>('grande');
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);

  // Connection & Role State
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [role, setRole] = useState<'setup_lobby' | 'rematador' | 'postor'>('setup_lobby');
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('remate_player_name') || '';
  });
  const [roomId, setRoomId] = useState<string>('');
  const [isCreatingRoomView, setIsCreatingRoomView] = useState<boolean>(false);
  const [showCreateDropdown, setShowCreateDropdown] = useState<boolean>(false);
  
  // Custom Object State (Host only)
  const [customItemInput, setCustomItemInput] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  
  // Manual object entry (Host only)
  const [isManual, setIsManual] = useState<boolean>(false);
  const [manualItemName, setManualItemName] = useState<string>('');
  const [manualRealPrice, setManualRealPrice] = useState<string>('');
  const [manualStartingBid, setManualStartingBid] = useState<string>('');
  const [manualCategory, setManualCategory] = useState<string>('Bazar');
  const [manualEmoji, setManualEmoji] = useState<string>('🎁');
  
  // Real-time Room State (Synced from server WebSockets)
  const [roomState, setRoomState] = useState<any | null>(null);
  const [apiError, setApiError] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);

  // Suggestions for rapid item testing
  const SUGGESTIONS = [
    { text: '1 Kilo de Yerba Mate Playadito', label: 'Yerba 🧉' },
    { text: '1 Kilo de Asado de Novillo', label: 'Asado 🥩' },
    { text: 'Docena de Facturas de Crema y dulce', label: 'Facturas 🥐' },
    { text: 'Termo de acero clásica de un Litro', label: 'Termo 🌡️' },
    { text: 'Pava eléctrica de mate', label: 'Pava ⚡' }
  ];

  // System Text Voice Assist
  const speak = (text: string) => {
    // Voice audio completely disabled per user preference
  };

  // Welcome announcement when loading
  useEffect(() => {
    speak("¡Hola! Bienvenidos al Gran Remate del Barrio. Elegí si vas a organizar vos la subasta o si querés sumarte a ofertar.");
  }, []);

  // WebSockets Connection
  const connectWS = (roomIdVal: string, nameVal: string, isHostVal: boolean) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${loc.host}/`;

    console.log("Connecting to subasta server at", wsUrl);
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("Joined socket successfully!");
      const joinPayload = {
        type: "join",
        roomId: roomIdVal,
        name: nameVal,
        isHost: isHostVal,
        playerId: myPlayerId
      };
      socket.send(JSON.stringify(joinPayload));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "room-state") {
          setRoomState(data.state);
          setApiError("");
          setIsJoined(true);
        } else if (data.type === "error") {
          setApiError(data.message);
          speak(data.message);
          // Auto-close on critical join error
          socket.close();
        }
      } catch (err) {
        console.error("Error reading message frame:", err);
      }
    };

    socket.onclose = () => {
      console.log("Socket connection closed.");
    };
  };

  // Trigger sound when server states synchronize
  const prevStatusRef = useRef<string>('');
  const prevCountdownRef = useRef<number>(0);
  const prevBidRef = useRef<number>(0);

  useEffect(() => {
    if (!roomState) return;
    
    // Play sound when bidding starts
    if (roomState.status === 'bidding' && prevStatusRef.current !== 'bidding') {
      playHammerSound();
    }
    
    // Play sound when bid is updated
    if (roomState.currentBid > prevBidRef.current && prevBidRef.current > 0) {
      playClickSound();
    }

    // Countdown sounds on clients in sync!
    if (roomState.countdownPhase !== prevCountdownRef.current) {
      if (roomState.countdownPhase === 1) {
        playHammerSound();
        speak(`¡A la una por ${roomState.currentBid.toLocaleString('es-AR')} pesos!`);
      } else if (roomState.countdownPhase === 2) {
        playHammerSound();
        speak(`¡A las dos por ${roomState.currentBid.toLocaleString('es-AR')} pesos! ¿Alguien ofrece más?`);
      } else if (roomState.countdownPhase === 3) {
        playHammerSound();
        if (roomState.highestBidder) {
          if (roomState.highestBidder.id === myPlayerId) {
            playWinSound();
            speak(`¡Felicitaciones! Ganaste el remate por ${roomState.currentBid.toLocaleString('es-AR')} pesos.`);
          } else {
            playLoseSound();
            speak(`¡Vendido a ${roomState.highestBidder.name} por ${roomState.currentBid.toLocaleString('es-AR')} pesos argentinos!`);
          }
        } else {
          speak(`Subasta de objeto finalizada.`);
        }
      }
    }

    // Capture previous records
    prevStatusRef.current = roomState.status;
    prevCountdownRef.current = roomState.countdownPhase;
    prevBidRef.current = roomState.currentBid;
  }, [roomState]);

  // Clean-up WebSocket connection on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Action: Create Room as Host
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      speak("Por favor, ingresá tu nombre antes de organizar.");
      return;
    }

    playClickSound();
    // Generate simple 4 digit Room ID for senior convenience
    const generatedRoom = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomId(generatedRoom);
    setRole('rematador');
    localStorage.setItem('remate_player_name', playerName.trim());
    setShowCreateDropdown(false);
    
    // Connect WebSocket
    connectWS(generatedRoom, playerName.trim(), true);
    speak(`Perfecto rematador. Creamos la subasta número ${generatedRoom}. Anotalo en un papel para pasárselo a los vecinos.`);
  };

  // Action: Join Room as Bidding Player
  const handleJoinAsPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      speak("Por favor, ingresá tu primer nombre.");
      return;
    }
    if (!roomId.trim()) {
      speak("Por favor, escribí el código de cuatro números para entrar.");
      return;
    }

    playClickSound();
    const cleanRoom = roomId.trim().toUpperCase();
    setRole('postor');
    localStorage.setItem('remate_player_name', playerName.trim());

    // Connect WebSocket
    connectWS(cleanRoom, playerName.trim(), false);
    speak("Conectando con la subasta...");
  };

  // Pre-load suggestions
  const selectSuggestion = (text: string) => {
    playClickSound();
    setCustomItemInput(text);
    speak(`Elegiste: ${text}. Presioná el botón de analizar.`);
  };

  // Gemini price verification today
  const handleAnalyzeAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemInput.trim()) {
      speak("Escribí qué objeto querés rematar.");
      return;
    }

    playClickSound();
    setIsAnalyzing(true);
    setApiError("");
    speak("Analizando precio oficial argentino hoy...");

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName: customItemInput.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "No se pudo cotizar ahora.");
      }

      const data = await response.json();
      
      const parsedItem: AuctionItem = {
        id: 'host-item-' + Date.now(),
        name: customItemInput.trim(),
        description: data.description,
        realPrice: data.realPrice,
        startingBid: data.startingBid,
        imagePath: '',
        category: data.category,
        emoji: data.emoji || '🎁'
      };

      setIsAnalyzing(false);

      // Submit over socket to trigger subasta automatically
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "submit-item",
          item: parsedItem
        }));
      }

    } catch (err: any) {
      console.error(err);
      setIsAnalyzing(false);
      setApiError(err.message || "Error al conectar hoy.");
      speak("Se produjo un error al analizar. Probá con otro texto.");
    }
  };

  // Manual object entry submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");

    if (!manualItemName.trim()) {
      setApiError("Por favor, ingresá el nombre del objeto.");
      return;
    }
    const realPriceNum = parseInt(manualRealPrice.replace(/\D/g, ''), 10);
    const startingBidNum = parseInt(manualStartingBid.replace(/\D/g, ''), 10);

    if (isNaN(realPriceNum) || realPriceNum <= 0) {
      setApiError("Por favor, ingresá un precio real hoy válido.");
      return;
    }
    if (isNaN(startingBidNum) || startingBidNum <= 0) {
      setApiError("Por favor, ingresá un precio mínimo de subasta válido.");
      return;
    }

    playClickSound();

    const parsedItem: AuctionItem = {
      id: 'host-item-manual-' + Date.now(),
      name: manualItemName.trim(),
      description: "Cargado de forma manual por el rematador a valor real estimado hoy.",
      realPrice: realPriceNum,
      startingBid: startingBidNum,
      imagePath: '',
      category: manualCategory,
      emoji: manualEmoji || '📦'
    };

    // Submit over socket to trigger subasta automatically
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "submit-item",
        item: parsedItem
      }));

      // Reset fields ONLY on successful submit to the WebSocket!
      setManualItemName('');
      setManualRealPrice('');
      setManualStartingBid('');
      setIsManual(false);
      setApiError('');
    } else {
      setApiError("No se pudo iniciar la subasta. La conexión con el servidor está cerrada.");
    }
  };

  // Send Host Gavel Tick
  const sendHostAction = (actionType: "ala-una" | "ala-dos" | "sold") => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "host-action",
        action: actionType
      }));
    }
    playClickSound();
  };

  // Send Host Restart Room
  const handleHostReset = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "reset"
      }));
    }
    setCustomItemInput('');
    playClickSound();
  };

  // Player Places Bid
  const handlePlayerBid = () => {
    if (!roomState) return;
    
    playClickSound();

    let nextBidAmount = roomState.currentBid;
    if (roomState.highestBidder === null) {
      nextBidAmount = roomState.currentItem.startingBid;
    } else {
      nextBidAmount = roomState.currentBid + 1000; // Simpler steps (+1000 ARS)
    }

    const myDetails = roomState.players[myPlayerId];
    if (myDetails && nextBidAmount > myDetails.budget) {
      speak("¡Atención! No tenés pesos suficientes virtuales.");
      setApiError("No te alcanza el presupuesto para esta ronda.");
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "place-bid",
        amount: nextBidAmount
      }));
    }
  };

  // Exit Room completely
  const handleExitToHome = () => {
    if (wsRef.current) wsRef.current.close();
    setIsJoined(false);
    setRoomState(null);
    setRole('setup_lobby');
    setApiError("");
    playClickSound();
    speak("Volviste a la pantalla principal.");
  };

  // Helper method for Font Sizing Class mappings
  const getTextSizeClass = (type: 'title' | 'body' | 'button' | 'badge') => {
    if (fontSize === 'normal') {
      switch (type) {
        case 'title': return 'text-xl font-bold font-display';
        case 'body': return 'text-sm text-stone-700 font-medium leading-relaxed';
        case 'button': return 'text-sm font-bold px-4 py-2 bg-emerald-600 rounded-xl';
        case 'badge': return 'text-xs px-2 py-0.5 rounded';
      }
    }
    if (fontSize === 'grande') {
      switch (type) {
        case 'title': return 'text-2xl font-black font-display tracking-tight text-amber-900';
        case 'body': return 'text-lg text-stone-800 font-bold leading-normal';
        case 'button': return 'text-lg font-black px-6 py-4 rounded-2xl';
        case 'badge': return 'text-sm px-3 py-1 font-extrabold rounded-lg';
      }
    }
    switch (type) {
      case 'title': return 'text-3xl font-black tracking-tight text-amber-950';
      case 'body': return 'text-xl text-stone-900 font-black leading-snug';
      case 'button': return 'text-xl font-black px-8 py-5 rounded-3xl border-3';
      case 'badge': return 'text-base px-4 py-2 font-black rounded-xl';
    }
  };

  // Custom visual theme setups (Normal vs High Contrast)
  const getThemeClass = () => {
    if (highContrast) {
      return {
        bg: 'bg-zinc-950 text-[#FFFF00]',
        card: 'bg-black border-4 border-[#FFFF00] rounded-2xl p-5',
        buttonAction: 'bg-[#FFFF00] text-black hover:bg-yellow-300 font-black border-2 border-white cursor-pointer active:scale-95 transition-all text-center flex items-center justify-center',
        buttonSecondary: 'bg-zinc-950 text-[#FFFF00] hover:bg-zinc-900 border-2 border-[#FFFF00] active:scale-95 font-bold',
        badge: 'bg-zinc-900 text-[#FFFF00] border border-[#FFFF00]',
        textAccent: 'text-[#FFFF00]',
        textMuted: 'text-zinc-200'
      };
    }
    return {
      bg: 'bg-[#FAF6F0] text-stone-900',
      card: 'bg-white border-2 border-stone-200 shadow-xl rounded-3xl p-6',
      buttonAction: 'bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/10 cursor-pointer active:scale-95 text-center flex items-center justify-center',
      buttonSecondary: 'bg-amber-100 text-amber-950 hover:bg-amber-200 transition-colors border border-amber-200 active:scale-95 py-2.5 font-bold text-center block rounded-2xl',
      badge: 'bg-amber-50 text-amber-950 border border-amber-200',
      textAccent: 'text-amber-900',
      textMuted: 'text-stone-600'
    };
  };

  const theme = getThemeClass();

  // Pick player avatar index based on name or playerId length
  const getPlayerAvatar = (name: string, id: string) => {
    const sum = (name || '').length + (id || '').length;
    return AVATARS[sum % AVATARS.length];
  };

  return (
    <div className={`min-h-screen py-3 px-3 md:py-8 md:px-6 flex flex-col items-center justify-start md:justify-center transition-colors duration-200 bg-[#EFEBE4] ${highContrast ? 'bg-zinc-950' : ''}`}>
      
      {/* CORTINA DESPLEGABLE DE CREAR SUBASTA (DRAWER SLIDING FROM LEFT TO RIGHT) */}
      <AnimatePresence>
        {showCreateDropdown && !isJoined && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowCreateDropdown(false)}
              className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs z-50 cursor-pointer"
            />

            {/* Sidebar Curtain (Drawer) */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 left-0 h-full w-[88%] max-w-sm bg-[#EFEBE4] text-stone-900 z-50 p-6 flex flex-col justify-start overflow-y-auto shadow-2xl border-r-4 border-amber-800"
              id="dropdown-create-section"
            >
              <div className="flex justify-between items-center pb-4 border-b border-stone-300">
                <div className="flex items-center gap-2">
                  <span className="text-3xl animate-bounce">🔨</span>
                  <div>
                    <h2 className="text-base font-black text-amber-950 uppercase">Nueva Subasta</h2>
                    <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Modo Rematador (Host)</p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowCreateDropdown(false)}
                  className="bg-stone-200 hover:bg-stone-300 text-stone-700 p-2 rounded-full cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4 mt-6">
                <p className="text-xs text-stone-650 leading-relaxed font-semibold">
                  Comenzá una subasta nueva como organizador. Vas a poder cargar tus propios objetos, cotizarlos al instante con el mercado real de argentina 🧠 y manejar el martillo del remate. El sistema te dará un código de 4 números para que las personas se unan.
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="hostName-field-drawer" className="text-xs font-black block text-amber-950 uppercase">
                    Tu nombre como Organizador (Rematador):
                  </label>
                  <input 
                    type="text" 
                    id="hostName-field-drawer"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Ej: Doña Rosa o Rematador José"
                    className="w-full text-base font-bold p-3 rounded-xl border-2 border-stone-300 bg-white text-stone-900 focus:outline-none focus:border-amber-800"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  id="host-create-btn"
                  className="w-full py-4 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-black cursor-pointer shadow-md transition-all active:scale-[0.98] uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <span>¡Crear y Empezar Subasta! 🔨✨</span>
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* HEADER CONTROLS (ACCESSIBILITY ON TOP) */}
      <div className="w-full max-w-lg bg-stone-900 text-stone-100 rounded-2xl p-3 mb-4 flex justify-between items-center gap-2 shadow-lg border border-stone-700/60" id="access-panel">
        <div className="flex items-center gap-1.5 shrink-0 select-none">
          {!isJoined ? (
            <button
              id="header-create-subasta-btn"
              onClick={() => {
                playClickSound();
                setShowCreateDropdown(!showCreateDropdown);
                setApiError('');
              }}
              className="p-1.5 px-3 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all active:scale-95 bg-zinc-850 hover:bg-zinc-800 text-amber-300"
              title="Crear Subasta"
            >
              <Menu className="w-4 h-4 text-amber-400" />
              <span>Crear Subasta</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Gavel className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-black tracking-wider text-amber-200 uppercase">EL REMATE DE BARRIO</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1 overflow-x-auto">
          {/* High Contrast */}
          <button 
            id="accessibility-contrast"
            onClick={() => {
              playClickSound();
              setHighContrast(!highContrast);
            }}
            className="p-1.5 px-3 bg-zinc-800 text-yellow-300 hover:bg-zinc-700 rounded-xl text-[10px] font-extrabold flex items-center gap-1 cursor-pointer select-none"
            title="Cambiar Contraste visual"
          >
            <Contrast className="w-3.5 h-3.5" />
            <span>Contraste</span>
          </button>
          
          {/* Font Sizes Toggle */}
          <button 
            id="accessibility-fontsize"
            onClick={() => {
              playClickSound();
              if (fontSize === 'normal') setFontSize('grande');
              else if (fontSize === 'grande') setFontSize('super');
              else setFontSize('normal');
            }}
            className="p-1.5 px-3 bg-zinc-800 text-stone-200 hover:bg-zinc-700 rounded-xl text-[10px] font-extrabold cursor-pointer select-none"
            title="Cambiar tamaño de Letra"
          >
            <ZoomIn className="w-3.5 h-3.5 inline mr-1" />
            <span>Letra: {fontSize === 'normal' ? 'Mediana' : fontSize === 'grande' ? 'Grande' : 'Súper'}</span>
          </button>

        </div>
      </div>

      {/* CORE GRAPHIC CARD WINDOW */}
      <div className={`w-full max-w-lg overflow-hidden flex flex-col justify-between transition-all duration-300 ${theme.card}`} style={{ minHeight: '560px' }} id="app-card">
        
        {/* ROOM AND RE-CONNECT HEADER BAR */}
        {isJoined && roomState && (
          <div className="bg-amber-50 p-2.5 rounded-2xl text-xs flex justify-between items-center border border-amber-200 mb-4 font-bold" id="live-header">
            <span className="text-amber-950 flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 bg-green-600 rounded-full animate-ping mr-1"></span>
              SUBASTA: <span className="bg-amber-700 text-white px-2.5 py-0.5 rounded-lg font-black ml-1 text-sm tracking-wider">{roomState.id}</span>
            </span>
            <div className="flex items-center gap-1.5 text-stone-600">
              <Users className="w-3.5 h-3.5 inline text-amber-800" />
              <span>Personas: {Object.keys(roomState.players).length}/500</span>
            </div>
            <button 
              id="exit-room-top-btn"
              onClick={handleExitToHome}
              className="text-[10px] bg-stone-200 text-stone-800 hover:bg-stone-300 font-extrabold py-0.5 px-2 rounded-lg cursor-pointer"
            >
              Salir
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center" id="main-viewports">
          
          {/* VIEW A: INITIAL SETUP LOBBY */}
          {!isJoined && (
            <div className="space-y-4" id="view-setup-selection">
              
              {/* SECTION 1: JOIN AUCTION FOR SENIORS / PLAYERS (DEFAULT / CLEAN) */}
              <div className="space-y-4" id="view-join-section">
                <div className="text-center pb-2 border-b border-stone-100">
                  <span className="text-5xl block mb-2 filter drop-shadow">🧉🇦🇷</span>
                  <h1 className="text-2xl font-black text-amber-950 tracking-tight">El Gran Remate de Barrio</h1>
                  <p className="text-xs text-stone-500 font-bold mt-1 uppercase tracking-widest">Juego Multijugador en Vivo</p>
                </div>

                <form onSubmit={handleJoinAsPlayer} className="space-y-4" id="setup-player-form">
                  {/* INPUT NAME */}
                  <div className="space-y-1.5 text-left" id="global-name-input">
                    <label htmlFor="playerName-field" className="text-xs font-black block text-stone-700 uppercase">
                      1. Escribí tu nombre:
                    </label>
                    <input 
                      type="text" 
                      id="playerName-field"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Ej: Abuelo Tito o Doña Rosa"
                      className="w-full text-lg font-bold p-3.5 rounded-xl border-2 border-stone-300 bg-white text-stone-900 focus:outline-none focus:border-emerald-700 text-center font-sans shadow-xs"
                      required
                    />
                  </div>

                  {/* INPUT AUCTION CODE */}
                  <div className="space-y-1.5 text-left" id="global-code-input">
                    <label htmlFor="roomCode-field" className="text-xs font-black block text-stone-700 uppercase">
                      2. Escribí el código de la subasta:
                    </label>
                    <input 
                      type="text" 
                      id="roomCode-field"
                      maxLength={4}
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value.replace(/\D/g, ''))}
                      placeholder="Código de 4 números"
                      className="w-full text-center tracking-widest text-2xl font-black p-3.5 bg-white rounded-xl border-2 border-stone-300 focus:outline-none focus:border-emerald-700 text-stone-900 placeholder:tracking-normal placeholder:text-sm font-mono"
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    id="player-join-btn"
                    className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-base font-black cursor-pointer shadow-md transition-all active:scale-[0.98]"
                  >
                    ENTRAR A LA SUBASTA 👋
                  </button>
                </form>
              </div>

              {apiError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-xs text-red-700 font-bold flex items-start gap-1.5" id="api-error-lobby">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p>{apiError}</p>
                </div>
              )}
            </div>
          )}

          {/* VIEW B: ACTIVE SYNCED ROOM */}
          {isJoined && roomState && (
            <div className="space-y-4" id="view-room-active">

              {/* ========================================== */}
              {/* STATUS 1: SETUP/PREPARING FOR ROUND        */}
              {/* ========================================== */}
              {roomState.status === 'setup' && (
                <div className="space-y-4 py-2" id="arena-status-setup">
                  
                  {/* If HOST/REMATADOR: CAN ENTER AND CHOOSE ITEMS TO AUCTION */}
                  {role === 'rematador' ? (
                    <div className="space-y-3" id="setup-rematador-controls">
                      <div className="text-center bg-amber-50 p-3 rounded-2xl border border-amber-200">
                        <span className="text-3xl block">📋</span>
                        <h2 className={`${getTextSizeClass('title')} mt-1`}>Cargar objeto a subastar</h2>
                        <p className="text-xs text-stone-600 mt-1 font-semibold">Las personas están esperando en la subasta. Escribí un producto de tu propiedad o casa para comenzar la subasta.</p>
                      </div>

                      {isManual ? (
                        <form onSubmit={handleManualSubmit} className="space-y-3 bg-stone-50 p-3 border rounded-xl text-left" id="manual-item-form">
                          <h3 className="text-sm font-black text-amber-900 uppercase">Subasta Manual</h3>
                          
                          {apiError && (
                            <div className="bg-red-50 text-red-800 p-2 text-xs rounded-xl font-bold">{apiError}</div>
                          )}
                          
                          <div>
                            <label className="text-xs font-bold text-stone-600 block mb-1">Nombre de lo que vas a rematar:</label>
                            <input 
                              type="text" 
                              value={manualItemName}
                              onChange={(e) => setManualItemName(e.target.value)}
                              placeholder="Ej: Termo de Acero Estilo Stanley"
                              className="w-full text-base font-bold p-2.5 rounded-xl border-2 border-stone-300 text-stone-900 bg-white focus:outline-none focus:border-amber-850"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-bold text-stone-600 block mb-1">Precio de mercado hoy ($):</label>
                              <input 
                                type="text" 
                                value={manualRealPrice}
                                onChange={(e) => setManualRealPrice(e.target.value.replace(/\D/g, ''))}
                                placeholder="Ej: 25000"
                                className="w-full text-base font-mono font-bold p-2.5 rounded-xl border-2 border-stone-300 text-stone-900 bg-white focus:outline-none focus:border-amber-850"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-stone-600 block mb-1 font-sans">Mínimo para comenzar ($):</label>
                              <input 
                                type="text" 
                                value={manualStartingBid}
                                onChange={(e) => setManualStartingBid(e.target.value.replace(/\D/g, ''))}
                                placeholder="Ej: 10000"
                                className="w-full text-base font-mono font-bold p-2.5 rounded-xl border-2 border-stone-300 text-stone-900 bg-white focus:outline-none focus:border-amber-850"
                                required
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1.5 font-bold">
                            <button
                              type="button"
                              onClick={() => {
                                playClickSound();
                                setIsManual(false);
                              }}
                              className="py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-black cursor-pointer shadow-xs"
                            >
                              Volver a Cotizar
                            </button>
                            <button
                              type="submit"
                              className="py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
                            >
                              Comenzar Subasta 🔨
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <form onSubmit={handleAnalyzeAndSubmit} className="space-y-3" id="rematador-item-form">
                            <div className="relative">
                              <input 
                                type="text" 
                                value={customItemInput}
                                onChange={(e) => setCustomItemInput(e.target.value)}
                                placeholder="Ej: Un Kilo de Asado, o un paquete de yerba mate"
                                className="w-full text-lg font-black p-3.5 rounded-xl border-2 border-stone-300 text-stone-900 bg-white focus:outline-none"
                                disabled={isAnalyzing}
                                required
                              />
                            </div>

                            {apiError && (
                              <div className="bg-red-50 text-red-800 p-2 text-xs rounded-xl font-bold">{apiError}</div>
                            )}

                            {isAnalyzing ? (
                              <div className="py-4 text-center space-y-2 border-2 border-dashed rounded-2xl bg-amber-50/20" id="analyzer-card">
                                <Gavel className="w-10 h-10 mx-auto text-amber-700 animate-bounce" />
                                <p className="text-xs font-black text-amber-800 uppercase tracking-wider animate-pulse">Buscando precio hoy en comercios de Argentina...</p>
                                <span className="text-[10px] text-stone-500 block">Calculando la inflación y el valor justo en pesos hoy.</span>
                              </div>
                            ) : (
                              <div className="space-y-2 font-bold">
                                <button
                                  type="submit"
                                  id="submit-host-item-btn"
                                  className={`w-full ${getTextSizeClass('button')} ${theme.buttonAction}`}
                                >
                                  <span>COTIZAR A DIA DE HOY Y COMENZAR 🔥</span>
                                </button>
                                
                                <button
                                  type="button"
                                  id="btn-trigger-manual-mode"
                                  onClick={() => {
                                    playClickSound();
                                    setIsManual(true);
                                  }}
                                  className="w-full py-3 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-2xl text-sm font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-amber-300/80"
                                >
                                  ✍️ HACERLO MANUAL (Elegir precio y base)
                                </button>
                              </div>
                            )}
                          </form>

                          {/* Suggestion Chips */}
                          {!isAnalyzing && (
                            <div className="pt-2 border-t border-stone-100 text-left" id="host-suggestions">
                              <span className="text-[10px] text-stone-400 font-bold block mb-1.5 uppercase">Ejemplos Rápidos de Argentina:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {SUGGESTIONS.map((s, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => selectSuggestion(s.text)}
                                    type="button"
                                    className="text-xs py-1.5 px-3 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl text-stone-800 font-extrabold cursor-pointer"
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    // If PLAYER: WAIT SCREEN
                    <div className="text-center py-8 space-y-4" id="setup-player-waiting">
                      <div className="relative inline-block">
                        <span className="text-6xl animate-bounce block">⏳</span>
                        <span className="absolute -bottom-1 -right-1 text-2xl">🧉</span>
                      </div>
                      <div>
                        <h2 className={`${getTextSizeClass('title')}`} id="player-waiting-title">Esperando al rematador</h2>
                        <p className={`${getTextSizeClass('body')} mt-2`} id="player-waiting-desc">
                          Hola <strong>{playerName}</strong>, estás cómodamente en tu casa. El rematador <strong>{roomState.hostName}</strong> está preparando el próximo objeto para cotizarlo y subastarlo hoy.
                        </p>
                      </div>

                      <div className="bg-stone-50 p-3 rounded-2xl border text-left" id="lobby-playerlist">
                        <span className="text-[10px] uppercase font-bold text-stone-500 block mb-1.5">Personas esperando en la vereda ({Object.keys(roomState.players).length}):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.values(roomState.players).map((p: any) => (
                            <span key={p.id} className="text-xs bg-white border px-2 py-1 rounded-lg font-extrabold flex items-center gap-1 shrink-0">
                              <span>{getPlayerAvatar(p.name, p.id)}</span>
                              <span>{p.name} {p.id === myPlayerId ? "(Vos)" : ""}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* ========================================== */}
              {/* STATUS 2: ACTIVE BIDDING PROCESS           */}
              {/* ========================================== */}
              {roomState.status === 'bidding' && roomState.currentItem && (
                <div className="space-y-4" id="arena-status-bidding">
                  
                  {/* ITEM CARD CONTAINER */}
                  <div className="bg-amber-50/50 rounded-2xl p-4 border border-stone-200 flex flex-col items-center relative" id="bidding-item-box">
                    <span className="text-6xl filter drop-shadow hover:scale-105 transition-transform" id="bidding-emoji">{roomState.currentItem.emoji}</span>
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 font-black text-[10px] rounded-full uppercase mt-2">{roomState.currentItem.category}</span>
                    <h3 className="text-xl font-black text-stone-900 mt-1 leading-tight text-center">{roomState.currentItem.name}</h3>

                    {/* BIG MONETARY OFFERS DISPLAY */}
                    <div className="w-full max-w-xs mt-3 p-3 bg-white border border-stone-200 rounded-2xl text-center shadow-xs" id="bidding-value">
                      <span className="text-xs font-extrabold text-stone-500 block uppercase mb-1">OFERTA MAYOR EN VIVO</span>
                      <span className="text-3xl font-black font-mono text-emerald-800 leading-none">${roomState.currentBid.toLocaleString('es-AR')}</span>
                      
                      <div className="mt-1 pb-1 border-t border-stone-100 pt-1 flex justify-center items-center gap-1 text-xs" id="highest-bidder">
                        <span className="text-lg">{roomState.highestBidder ? roomState.highestBidder.avatar : '👴'}</span>
                        <span className="font-extrabold text-stone-700">
                          {roomState.highestBidder ? (roomState.highestBidder.id === myPlayerId ? '¡VAS GANANDO VOS! ⭐' : roomState.highestBidder.name) : 'Aún sin ofertas (¿Quién rompe el hielo?)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ROOM CHRONO TICK GAVEL DISPLAY */}
                  {roomState.countdownPhase > 0 && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-2xl text-center animate-pulse shrink-0" id="gavel-ticks-bar">
                      <span className="text-[10px] text-orange-850 font-black tracking-widest block uppercase leading-none mb-1">¡EL MARTILLO ESTÁ EN EL AIRE!</span>
                      <div className="flex justify-center gap-2 text-xs font-bold">
                        <span className={`px-2.5 py-1 rounded-xl ${roomState.countdownPhase >= 1 ? 'bg-orange-700 text-white' : 'bg-stone-200 text-stone-500'}`}>A la una</span>
                        <span className={`px-2.5 py-1 rounded-xl ${roomState.countdownPhase >= 2 ? 'bg-orange-700 text-white' : 'bg-stone-200 text-stone-500'}`}>A las dos</span>
                        <span className={`px-2.5 py-1 rounded-xl ${roomState.countdownPhase >= 3 ? 'bg-red-700 text-white font-black' : 'bg-stone-200 text-stone-500'}`}>¡VENDIDO (FIN)!</span>
                      </div>
                    </div>
                  )}

                  {/* NEWS AND CHATROOM FEED ticker */}
                  <div className="bg-[#FAF6F0] p-3 rounded-xl border text-center text-stone-800 text-sm font-bold leading-normal italic" id="scrolling-news">
                    "{roomState.auctionMessage}"
                  </div>

                  {/* ==================== CONTROL CONTROLLER PANELS ==================== */}
                  {/* CASE A: USER IS HOST (CONTROLS THE PACE) */}
                  {role === 'rematador' ? (
                    <div className="space-y-2.5 bg-stone-50 p-3.5 rounded-2xl border" id="host-gavel-panel">
                      <span className="text-[10px] text-stone-500 font-extrabold block uppercase tracking-wider text-center">Panel de Control de Rematador:</span>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <button 
                          id="btn-tick-1"
                          onClick={() => sendHostAction("ala-una")}
                          disabled={!roomState.highestBidder}
                          className="p-3.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-black rounded-xl text-center text-xs tracking-tight uppercase leading-none disabled:opacity-50 cursor-pointer"
                        >
                          📢 ¡A la una!
                        </button>

                        <button 
                          id="btn-tick-2"
                          onClick={() => sendHostAction("ala-dos")}
                          disabled={!roomState.highestBidder || roomState.countdownPhase < 1}
                          className="p-3.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-black rounded-xl text-center text-xs tracking-tight uppercase leading-none disabled:opacity-50 cursor-pointer"
                        >
                          📢 ¡A las dos!
                        </button>

                        <button 
                          id="btn-gavel-sold"
                          onClick={() => sendHostAction("sold")}
                          disabled={!roomState.highestBidder}
                          className="p-3.5 bg-red-800 text-white hover:bg-red-900 font-black rounded-xl text-center text-xs tracking-tight uppercase leading-none disabled:opacity-50 cursor-pointer animate-bounce"
                        >
                          🔨 ¡VENDIDO!
                        </button>
                      </div>

                      <p className="text-[10px] text-center text-stone-500 leading-normal">
                        Para mayor diversión de las personas: cuando alguien oferte, cantá el precio en voz alta y apretá los botones en orden. ¡A la una, a las dos, y vendido para cerrar!
                      </p>
                    </div>
                  ) : (
                    // CASE B: USER IS PLAYER (GIANT BID BUTTON)
                    <div className="space-y-3" id="player-bid-panel">
                      {apiError && (
                        <div className="bg-red-50 text-red-800 p-2 text-xs rounded-xl font-bold border border-red-200">
                          ⚠️ {apiError}
                        </div>
                      )}
                      {roomState.highestBidder && roomState.highestBidder.id === myPlayerId ? (
                        <div className="py-4 bg-emerald-50 text-emerald-800 rounded-3xl border-2 border-emerald-300 text-center uppercase tracking-wider font-extrabold" id="winning-badge-feedback">
                          <span className="text-4xl block mb-1">⭐</span>
                          <span className="text-lg font-black">¡Sos el mayor postor hoy!</span>
                          <p className="text-xs text-emerald-700 font-semibold normal-case mt-0.5">Esperá a ver si alguna persona sube la oferta.</p>
                        </div>
                      ) : (
                        <button
                          id="btn-giant-player-bid"
                          onClick={handlePlayerBid}
                          className={`w-full ${getTextSizeClass('button')} ${theme.buttonAction} py-5 flex flex-col items-center h-auto cursor-pointer`}
                        >
                          <span className="text-[10px] tracking-widest uppercase opacity-90 mb-1 font-black">¡QUEDATE CON EL OBJETO!</span>
                          <span className="text-2xl font-black">
                            {roomState.highestBidder === null ? `OFERTAR BASE: $${roomState.currentItem.startingBid.toLocaleString('es-AR')}` : 'OFERTAR: +$1.000'}
                          </span>
                          <span className="text-xs opacity-90 font-medium mt-1">
                            {roomState.highestBidder === null 
                              ? `Inicia la subasta oficial en pesos` 
                              : `Hacer oferta por $${(roomState.currentBid + 1000).toLocaleString('es-AR')} Pesos`
                            }
                          </span>
                        </button>
                      )}

                      {/* Display players list during bidiing so you see who you play against */}
                      <div className="bg-white/60 p-2 border rounded-xl text-xs flex justify-between items-center" id="budget-bar">
                        <span>Mi Monedero de la Suerte:</span>
                        <strong className="text-sm font-black text-amber-950 font-mono">${(roomState.players[myPlayerId]?.budget || 350000).toLocaleString('es-AR')} ARS</strong>
                      </div>
                    </div>
                  )}

                  {/* MINI BIDS HISTORIC TABLE */}
                  {roomState.bids.length > 0 && (
                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-3" id="realtime-bids-scroller">
                      <span className="text-[10px] text-stone-500 uppercase font-bold block mb-1">Historial del Remate ({roomState.bids.length} Ofertas):</span>
                      <div className="space-y-1 max-h-[110px] overflow-y-auto" id="bids-rendered-list">
                        {roomState.bids.map((b: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs border-b border-stone-100 py-1 font-bold">
                            <span className="text-stone-700 flex items-center gap-1">
                              <span>{getPlayerAvatar(b.bidderName, b.bidderId)}</span>
                              <span>{b.bidderName} {b.bidderId === myPlayerId ? "(Vos)" : ""}</span>
                            </span>
                            <span className="font-mono text-emerald-800">${b.amount.toLocaleString('es-AR')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* ========================================== */}
              {/* STATUS 3: RESULTS/CONCLUSION ANALYSIS      */}
              {/* ========================================== */}
              {roomState.status === 'results' && roomState.currentItem && (
                <div className="space-y-4" id="arena-status-results">
                  
                  <div className="text-center py-2" id="verdict-banner">
                    <span className="text-5xl block animate-bounce">🔨</span>
                    <h2 className={`${getTextSizeClass('title')} text-center mt-1`}>El veredicto del Martillo</h2>
                  </div>

                  {/* FINAL WINNER DISPLAY */}
                  <div className="bg-white rounded-2xl p-4 border border-stone-200 flex flex-col items-center text-center shadow-xs" id="winner-reveal-board">
                    <span className="text-6xl" id="results-emoji">{roomState.currentItem.emoji}</span>
                    <h4 className="font-black text-stone-900 text-lg leading-tight mt-2">{roomState.currentItem.name}</h4>
                    
                    <div className="text-sm font-extrabold mt-3 w-full" id="results-verdict-text">
                      {roomState.highestBidder ? (
                        roomState.highestBidder.id === myPlayerId ? (
                          <div className="text-emerald-800 bg-emerald-50 px-4 py-2.5 rounded-2xl border border-emerald-200">
                            <span className="text-xl block">🎉 ¡FELICIDADES! 🎉</span>
                            ¡Te lo ganaste por <strong>${roomState.currentBid.toLocaleString('es-AR')}</strong> pesos de la suerte!
                          </div>
                        ) : (
                          <div className="text-stone-800 bg-stone-50 px-4 py-2.5 rounded-2xl border border-stone-200">
                            Comprado por <strong>{roomState.highestBidder.name}</strong> por un valor de <strong>${roomState.currentBid.toLocaleString('es-AR')}</strong>.
                          </div>
                        )
                      ) : (
                        <div className="text-amber-900 bg-amber-50 px-4 py-2 rounded-2xl">
                          Nadie ofertó. El objeto volvió al estante de su dueño.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* COGNITIVE ARGENTINIAN REAL-MARKET VERIFICATION today */}
                  <div className="bg-amber-50/70 border-2 border-dashed border-amber-300 p-4 rounded-2xl text-xs space-y-2 relative" id="analyzed-truth">
                    <div className="flex items-center gap-1.5" id="analysis-icon">
                      <Coins className="w-4 h-4 text-amber-800 animate-spin" />
                      <span className="text-[10px] font-black tracking-widest text-amber-950 uppercase">Precio Real hoy en Comercios Argentinos:</span>
                    </div>
                    
                    <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-amber-200" id="analysis-value-panel">
                      <span className="font-extrabold text-stone-600 block">En Góndolas hoy:</span>
                      <strong className="text-lg font-black font-mono text-emerald-800">${roomState.currentItem.realPrice.toLocaleString('es-AR')} ARS</strong>
                    </div>

                    <p className="text-stone-800 text-sm font-semibold leading-relaxed" id="analysis-desc">
                      {roomState.currentItem.description}
                    </p>

                    {roomState.highestBidder && (
                      <div className="pt-2 border-t border-amber-200/50 text-[11px] font-bold text-stone-600">
                        {roomState.currentItem.realPrice - roomState.currentBid > 0 ? (
                          <span className="text-emerald-700">💰 ¡Se ahorró ${(roomState.currentItem.realPrice - roomState.currentBid).toLocaleString('es-AR')} Pesos del valor real de mercado de hoy! Buen negocio del barrio.</span>
                        ) : (
                          <span className="text-amber-800">🧉 Pagaron levemente más que en un supermercado tradicional, ¡pero las risas y la previa no tienen precio!</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* MINI WALLET FOR INDIVIDUAL PLAYERS ONLY */}
                  {role === 'postor' && (
                    <div className="bg-white/90 p-3 border rounded-xl flex justify-between items-center text-xs" id="post-round-wallet">
                      <span className="font-bold">Tu presupuesto restante:</span>
                      <strong className="font-mono text-sm text-stone-850">${(roomState.players[myPlayerId]?.budget || 350000).toLocaleString('es-AR')} ARS</strong>
                    </div>
                  )}

                  {/* FOOTER ACTIONS FOR ACTIVE RE-TRIGGER */}
                  <div className="space-y-2 pt-2" id="results-footer-actions">
                    {role === 'rematador' ? (
                      <button
                        id="btn-host-reset"
                        onClick={handleHostReset}
                        className={`w-full ${getTextSizeClass('button')} ${theme.buttonAction}`}
                      >
                        SUBASTAR OTRO OBJETO 🔄
                      </button>
                    ) : (
                      <div className="text-center bg-stone-100 p-3 rounded-2xl text-[11px] font-extrabold text-stone-500 uppercase tracking-wider" id="player-waiting-reset-notice">
                        Esperando que el rematador limpie la mesa para el próximo objeto...
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          )}

        </div>

        {/* RECOGNIZABLE FOOTER (ACCESSIBLE TO ELDERS) */}
        <footer className="mt-4 p-3 bg-stone-100 text-center border-t border-stone-200 text-[10px] text-stone-600 rounded-b-2xl space-y-1 shrink-0 select-none" id="footer-legals">
          <p className="font-extrabold">Remate de Barrio 🧉🇦🇷 - Conexión viva sin salir de tu casa.</p>
          <p className="text-[8px] text-stone-450 font-bold block">Integrado en vivo para hasta 500 personas en simultáneo.</p>
        </footer>

      </div>
    </div>
  );
}
