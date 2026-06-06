import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy initialization helper for Gemini client (server-side only)
let aiClient: GoogleGenAI | null = null;
function getAiClient(apiKey: string): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// -----------------------------------------------------------------
// MULTIPLAYER ROOM TYPES & STATE
// -----------------------------------------------------------------
interface PlayerState {
  id: string;
  name: string;
  budget: number;
  connected: boolean;
}

interface RoomState {
  id: string; // 4-digit code e.g. "1234"
  hostName: string;
  currentItem: {
    id: string;
    name: string;
    description: string;
    realPrice: number;
    startingBid: number;
    category: string;
    emoji: string;
  } | null;
  players: Record<string, PlayerState>;
  bids: {
    bidderId: string;
    bidderName: string;
    amount: number;
    timestamp: string;
  }[];
  currentBid: number;
  highestBidder: {
    id: string;
    name: string;
    avatar: string;
  } | null;
  status: 'setup' | 'bidding' | 'results';
  countdownPhase: number; // 0, 1, 2, 3 (3 means Sold)
  auctionMessage: string;
}

// Global in-memory rooms registry
const rooms: Record<string, RoomState & {
  hostWs: WebSocket | null;
  playerSockets: Record<string, WebSocket>;
}> = {};

// Helper to broadcast room state to all players & host in a room
function broadcastToRoom(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;

  // Clean state to send
  const cleanState: RoomState = {
    id: room.id,
    hostName: room.hostName,
    currentItem: room.currentItem,
    players: room.players,
    bids: room.bids,
    currentBid: room.currentBid,
    highestBidder: room.highestBidder,
    status: room.status,
    countdownPhase: room.countdownPhase,
    auctionMessage: room.auctionMessage,
  };

  const payload = JSON.stringify({ type: "room-state", state: cleanState });

  // Send to host
  if (room.hostWs && room.hostWs.readyState === WebSocket.OPEN) {
    room.hostWs.send(payload);
  }

  // Send to players
  Object.entries(room.playerSockets).forEach(([pid, ws]) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

// REST: API endpoint to analyze current price of custom item in Argentina (remains accessible)
app.post("/api/analyze", async (req, res) => {
  try {
    const rawApiKey = process.env.GEMINI_API_KEY || "";
    const cleanApiKey = rawApiKey.trim();

    if (!cleanApiKey || cleanApiKey === "MY_GEMINI_API_KEY" || cleanApiKey.includes("PLACEHOLDER")) {
      return res.status(400).json({ 
        error: "Falta configurar la clave de API (GEMINI_API_KEY) de Google.",
        details: "Por favor, ingresá tu clave de API en Settings > Secrets en AI Studio con el nombre: GEMINI_API_KEY."
      });
    }

    const { itemName } = req.body;
    if (!itemName || typeof itemName !== "string" || !itemName.trim()) {
      return res.status(400).json({ error: "Por favor, ingresá un nombre de artículo para cotizar." });
    }

    const trimmedItemName = itemName.trim();

    const prompt = `Analiza el precio real hoy de este objeto en el mercado de Argentina para usarlo en un juego interactivo de subasta de barrio: "${trimmedItemName}".
    Calculá el precio promedio de venta al público hoy en Pesos Argentinos (ARS).
    Busca de ser posible con información de mercado real o precios históricos ajustados.
    Devuelve EXACTAMENTE un objeto JSON con el siguiente formato:
    {
      "realPrice": 12500,
      "startingBid": 5000,
      "category": "Comida",
      "emoji": "🥩",
      "description": "Una breve descripción amigable (máximo 2 oraciones) indicando qué es y comentando divertidamente por qué cuesta eso en el contexto inflacionario o de importación de Argentina."
    }
    
    Por favor, sé amigable, ameno y respetuoso, ideal para adultos mayores de barrio argentino.`;

    const ai = getAiClient(cleanApiKey);
    let modelResponse;

    try {
      modelResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }],
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              realPrice: { type: Type.INTEGER, description: "El precio real actual del objeto hoy en pesos argentinos (ARS)" },
              startingBid: { type: Type.INTEGER, description: "Precio sugerido para la subasta (40-50% del realPrice)" },
              category: { type: Type.STRING, description: "Categoría corta (Comida, Bazar, Matiada, Indumentaria, etc.)" },
              emoji: { type: Type.STRING, description: "Un solo emoji representativo del objeto" },
              description: { type: Type.STRING, description: "Descripción y comentario amigable de por qué vale eso" }
            },
            required: ["realPrice", "startingBid", "category", "emoji", "description"]
          }
        }
      });
    } catch (searchError: any) {
      console.warn("Failing back due to Search grounding limit:", searchError.message);
      modelResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              realPrice: { type: Type.INTEGER, description: "El precio real actual del objeto hoy en pesos argentinos (ARS)" },
              startingBid: { type: Type.INTEGER, description: "Precio sugerido para la subasta (40-50% del realPrice)" },
              category: { type: Type.STRING, description: "Categoría corta (Comida, Bazar, Matiada, etc.)" },
              emoji: { type: Type.STRING, description: "Un solo emoji representativo del objeto" },
              description: { type: Type.STRING, description: "Descripción y comentario amigable de por qué vale eso" }
            },
            required: ["realPrice", "startingBid", "category", "emoji", "description"]
          }
        }
      });
    }

    const text = modelResponse.text;
    if (!text) {
      throw new Error("No se pudo obtener una respuesta analítica de la Inteligencia Artificial.");
    }

    const parsedData = JSON.parse(text.trim());
    return res.json(parsedData);

  } catch (error: any) {
    console.error("Error analyzing item:", error);
    let userFriendlyMsg = "No pudimos calcular el precio del objeto en este momento.";
    if (error.message && (error.message.includes("API key") || error.message.includes("API_KEY") || error.message.includes("not valid"))) {
      userFriendlyMsg = "La clave de API (GEMINI_API_KEY) parece ser inválida o no estar habilitada.";
    }
    return res.status(500).json({ 
      error: userFriendlyMsg,
      details: error.message 
    });
  }
});

// Create HTTP and Web Server Wrapper
const httpServer = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Upgrade WebSocket request with validation
httpServer.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

// wss event handler
wss.on("connection", (ws: WebSocket) => {
  let joinedRoomId = "";
  let joinedPlayerId = "";
  let joinedIsHost = false;

  ws.on("message", (message: string) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case "join": {
          const { roomId, name, isHost, playerId } = data;
          if (!roomId || !name) {
            ws.send(JSON.stringify({ type: "error", message: "Faltan datos para unirse a la subasta." }));
            return;
          }

          const cleanRoomId = roomId.trim().toUpperCase();
          const cleanName = name.trim();

          joinedRoomId = cleanRoomId;
          joinedPlayerId = playerId;
          joinedIsHost = !!isHost;

          // Check/Create Room
          if (isHost) {
            // Host creates/re-connects
            if (!rooms[cleanRoomId]) {
              rooms[cleanRoomId] = {
                id: cleanRoomId,
                hostName: cleanName,
                currentItem: null,
                players: {},
                bids: [],
                currentBid: 0,
                highestBidder: null,
                status: 'setup',
                countdownPhase: 0,
                auctionMessage: `¡Bienvenido! Subasta ${cleanRoomId} creada por el rematador ${cleanName}.`,
                hostWs: ws,
                playerSockets: {}
              };
            } else {
              // Update/Restore host socket
              rooms[cleanRoomId].hostWs = ws;
            }
          } else {
            // Player joins
            const room = rooms[cleanRoomId];
            if (!room) {
              ws.send(JSON.stringify({ type: "error", message: `La subasta "${cleanRoomId}" no existe. Pedile al rematador que la cree primero.` }));
              return;
            }

            // Limit of 500 players checking
            const totalPlayers = Object.keys(room.players).length;
            if (!room.players[playerId] && totalPlayers >= 500) {
              ws.send(JSON.stringify({ type: "error", message: "La subasta está llena. Se alcanzó el límite de 500 jugadores." }));
              return;
            }

            // Register/Reconnect player
            room.players[playerId] = {
              id: playerId,
              name: cleanName,
              budget: room.players[playerId]?.budget || 350000,
              connected: true
            };
            room.playerSockets[playerId] = ws;

            // Welcome greeting
            room.auctionMessage = `¡${cleanName} se unió a la subasta! Somos ${Object.keys(room.players).length} personas en la subasta.`;
          }

          // Broadcast Room updates
          broadcastToRoom(cleanRoomId);
          break;
        }

        case "submit-item": {
          const room = rooms[joinedRoomId];
          if (!room || !joinedIsHost) return;

          const { item } = data;
          room.currentItem = item;
          room.status = 'bidding';
          room.bids = [];
          room.currentBid = item.startingBid;
          room.highestBidder = null;
          room.countdownPhase = 0;
          room.auctionMessage = `¡Arranca la subasta de "${item.name}"! La base es de $${item.startingBid.toLocaleString('es-AR')} ARS. ¿Quién ofrece más?`;
          
          broadcastToRoom(joinedRoomId);
          break;
        }

        case "place-bid": {
          const room = rooms[joinedRoomId];
          if (!room || room.status !== 'bidding') return;

          const { amount } = data;
          
          // Bid validations
          if (amount <= room.currentBid) {
            ws.send(JSON.stringify({ type: "error", message: "La oferta debe ser mayor a la actual." }));
            return;
          }

          const player = room.players[joinedPlayerId];
          if (!player) return;

          if (amount > player.budget) {
            ws.send(JSON.stringify({ type: "error", message: "No tenés presupuesto suficiente para esa oferta." }));
            return;
          }

          // Update current stats
          room.currentBid = amount;
          room.highestBidder = {
            id: joinedPlayerId,
            name: player.name,
            avatar: "🙋‍♂️"
          };
          room.countdownPhase = 0; // Reset countdown
          room.bids.unshift({
            bidderId: joinedPlayerId,
            bidderName: player.name,
            amount: amount,
            timestamp: new Date().toLocaleTimeString('es-AR')
          });
          room.auctionMessage = `¡${player.name} ofertó $${amount.toLocaleString('es-AR')} pesos!`;
          
          broadcastToRoom(joinedRoomId);
          break;
        }

        case "host-action": {
          const room = rooms[joinedRoomId];
          if (!room || !joinedIsHost || room.status !== 'bidding') return;

          const { action } = data;

          if (action === "ala-una") {
            room.countdownPhase = 1;
            room.auctionMessage = `¡A la una por $${room.currentBid.toLocaleString('es-AR')} pesos argentinos!`;
          } else if (action === "ala-dos") {
            room.countdownPhase = 2;
            room.auctionMessage = `¡A las dos por $${room.currentBid.toLocaleString('es-AR')} pesos argentinos! ¿Nadie ofrece más?`;
          } else if (action === "sold") {
            room.countdownPhase = 3;
            room.status = 'results';
            
            if (room.highestBidder) {
              const winnerId = room.highestBidder.id;
              const winner = room.players[winnerId];
              if (winner) {
                // Deduct budget
                winner.budget = Math.max(0, winner.budget - room.currentBid);
              }
              room.auctionMessage = `🔨 ¡VENDIDO! Su objeto "${room.currentItem?.name}" se vendió a ${room.highestBidder.name} por $${room.currentBid.toLocaleString('es-AR')} pesos. ¡Felicitaciones!`;
            } else {
              room.auctionMessage = `🔨 El remate de "${room.currentItem?.name}" terminó sin ofertas compradas.`;
            }
          }

          broadcastToRoom(joinedRoomId);
          break;
        }

        case "reset": {
          const room = rooms[joinedRoomId];
          if (!room || !joinedIsHost) return;

          room.status = 'setup';
          room.currentItem = null;
          room.bids = [];
          room.currentBid = 0;
          room.highestBidder = null;
          room.countdownPhase = 0;
          room.auctionMessage = `El rematador ${room.hostName} limpió la mesa para empezar una nueva ronda. ¡Preparen sus bolsillos!`;

          broadcastToRoom(joinedRoomId);
          break;
        }
      }

    } catch (e) {
      console.error("WS error parsing message:", e);
    }
  });

  ws.on("close", () => {
    const room = rooms[joinedRoomId];
    if (room) {
      if (joinedIsHost) {
        // Let players know the host temporarily disconnected
        room.auctionMessage = `La conexión del rematador/host se pausó temporariamente...`;
        broadcastToRoom(joinedRoomId);
      } else {
        // Set player status as disconnected
        const player = room.players[joinedPlayerId];
        if (player) {
          player.connected = false;
        }
        delete room.playerSockets[joinedPlayerId];
        room.auctionMessage = `Una persona se desconectó. Quedan ${Object.values(room.players).filter(p => p.connected).length} activas.`;
        broadcastToRoom(joinedRoomId);
      }
    }
  });
});

// Vite middleware flow integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Use httpServer wrapper for WebSocket upgrade capability
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
