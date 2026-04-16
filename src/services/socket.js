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
      socket.join(`battle_${battleId}`);
      console.log(`Socket: User joined battle room: battle_${battleId}`);
    });

    socket.on('leave-battle', (battleId) => {
      socket.leave(`battle_${battleId}`);
      console.log(`Socket: User left battle room: battle_${battleId}`);
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
    io.to(`battle_${battleId}`).emit(event, data);
  }
}

module.exports = {
  init,
  getIO,
  emitToBattle
};
