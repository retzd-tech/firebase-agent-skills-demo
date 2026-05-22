import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Serve static assets from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for single-page routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Active players database (in-memory)
// Keys are player IDs, values are player state objects
const players = new Map();

// Helper to broadcast JSON messages to all players (optionally excluding one)
const broadcast = (message, excludeId = null) => {
  const payload = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === 1 && (!excludeId || client.playerId !== excludeId)) {
      client.send(payload);
    }
  });
};

wss.on('connection', (ws) => {
  // Generate a random unique ID for the new session
  const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
  ws.playerId = playerId;

  console.log(`[Server] Connection established. Assigning ID: ${playerId}`);

  // Send initial handshake configuration
  ws.send(JSON.stringify({
    type: 'handshake',
    data: { playerId }
  }));

  ws.on('message', (message) => {
    let rawStr = '';
    try {
      rawStr = message.toString('utf8');
      const packet = JSON.parse(rawStr);
      const { type, data } = packet;

      switch (type) {
        case 'join': {
          // A player finalized nickname & color in lobby, spawning into the world
          const playerState = {
            id: playerId,
            nickname: data.nickname || `Player_${playerId.slice(-4)}`,
            color: data.color || '#3ddc84',
            characterType: data.characterType || 'android',
            x: data.x || (Math.random() * 10 - 5),
            y: data.y || 1.0, // Spawn hovering
            z: data.z || (Math.random() * 10 - 5),
            ry: data.ry || 0,
            isJumping: false,
            timestamp: Date.now()
          };

          players.set(playerId, playerState);
          console.log(`[Server] Player "${playerState.nickname}" (${playerId}) joined game.`);

          // Send currently active players to the new joiner
          ws.send(JSON.stringify({
            type: 'sync',
            data: Array.from(players.values())
          }));

          // Notify existing players about this new arrival
          broadcast({
            type: 'playerJoin',
            data: playerState
          }, playerId);
          break;
        }

        case 'update': {
          // Periodic position & rotation update
          const player = players.get(playerId);
          if (player) {
            player.x = data.x;
            player.y = data.y;
            player.z = data.z;
            player.ry = data.ry;
            player.isJumping = data.isJumping;
            player.timestamp = Date.now();

            // Broadcast movement updates at low latency
            broadcast({
              type: 'playerMove',
              data: {
                id: playerId,
                x: player.x,
                y: player.y,
                z: player.z,
                ry: player.ry,
                isJumping: player.isJumping
              }
            }, playerId);
          }
          break;
        }

        case 'chat': {
          // Chat message routing
          const player = players.get(playerId);
          if (player) {
            console.log(`[Chat] ${player.nickname}: ${data.text}`);
            broadcast({
              type: 'playerChat',
              data: {
                id: playerId,
                nickname: player.nickname,
                text: data.text
              }
            });
          }
          break;
        }

        case 'interact': {
          // Custom interactive effect (e.g. radial particle pulse or emote wave)
          const player = players.get(playerId);
          if (player) {
            broadcast({
              type: 'playerInteract',
              data: {
                id: playerId,
                action: data.action || 'pulse',
                color: player.color
              }
            });
          }
          break;
        }

        case 'customize': {
          // Runtime profile changes (nickname or custom tinting)
          const player = players.get(playerId);
          if (player) {
            player.nickname = data.nickname || player.nickname;
            player.color = data.color || player.color;
            player.characterType = data.characterType || player.characterType;
            broadcast({
              type: 'playerCustomize',
              data: {
                id: playerId,
                nickname: player.nickname,
                color: player.color,
                characterType: player.characterType
              }
            });
          }
          break;
        }

        default:
          // console.warn(`[Server] Unknown packet type received: ${type}`);
      }
    } catch (err) {
      console.error(`[Server] Failed to process message (raw: "${rawStr}"):`, err);
    }
  });

  ws.on('close', () => {
    console.log(`[Server] Connection closed by player: ${playerId}`);
    const player = players.get(playerId);
    
    if (player) {
      // Clean up player records
      players.delete(playerId);
      
      // Notify remaining players to remove this entity
      broadcast({
        type: 'playerLeave',
        data: { id: playerId }
      });
      console.log(`[Server] Cleaned up player state for "${player.nickname}".`);
    }
  });
});

server.listen(port, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Multiplayer 3D Game Server running locally at:`);
  console.log(`👉 http://localhost:${port}`);
  console.log(`======================================================\n`);
});
