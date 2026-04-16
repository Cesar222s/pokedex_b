const { Server } = require('socket.io');

let io;

function init(server) {
  io = new Server(server, {
    cors: {
      origin: "*", // Adjust for production if needed
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('Socket: User connected', socket.id);

    // Join a battle room
    socket.on('join-battle', (battleId) => {
      const roomId = `battle_${battleId.toString()}`;
      socket.join(roomId);
      socket.userId = socket.handshake.auth.token ? 'some-way-to-get-id' : null; // We need to store user ID
      console.log(`Socket: User joined battle room: ${roomId}`);
    });

    socket.on('leave-battle', (battleId) => {
      const roomId = `battle_${battleId.toString()}`;
      socket.leave(roomId);
      console.log(`Socket: User left battle room: ${roomId}`);
    });

    socket.on('disconnect', () => {
      console.log('Socket: User disconnected', socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}

/**
 * Emit to a specific battle room
 */
function emitToBattle(battleId, event, data) {
  if (io) {
    const roomId = `battle_${battleId.toString()}`;
    io.to(roomId).emit(event, data);
  }
}

/**
 * Check if at least one person is in the room
 * (Simplified: if anyone is in the room, we assume real-time is active)
 */
async function isRoomActive(battleId) {
  if (!io) return false;
  const roomId = `battle_${battleId.toString()}`;
  const sockets = await io.in(roomId).fetchSockets();
  return sockets.length > 1; // Both players are in the room
}

module.exports = {
  init,
  getIO,
  emitToBattle,
  isRoomActive
};
