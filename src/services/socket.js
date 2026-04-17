const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

function init(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Authenticate socket connections via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket: User ${socket.userId} connected (${socket.id})`);

    // Auto-join personal user room for targeted events
    const userRoom = `user_${socket.userId}`;
    socket.join(userRoom);
    console.log(`Socket: User joined personal room: ${userRoom}`);

    // Join a battle room
    socket.on('join-battle', (battleId) => {
      const roomId = `battle_${battleId.toString()}`;
      socket.join(roomId);
      console.log(`Socket: User ${socket.userId} joined battle room: ${roomId}`);
    });

    socket.on('leave-battle', (battleId) => {
      const roomId = `battle_${battleId.toString()}`;
      socket.leave(roomId);
      console.log(`Socket: User ${socket.userId} left battle room: ${roomId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket: User ${socket.userId} disconnected (${socket.id})`);
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
 * Emit to a specific user via their personal room
 */
function emitToUser(userId, event, data) {
  if (io) {
    const userRoom = `user_${userId.toString()}`;
    io.to(userRoom).emit(event, data);
  }
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
  emitToUser,
  emitToBattle,
  isRoomActive
};
