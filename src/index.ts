import { Server } from 'socket.io';
import { Deck } from './cards';
import { User } from './user'

const PORT: number = Number.parseInt(process.env.port || "6969");
const io = new Server({
  cors: {
    origin: ["http://localhost:5173", "https://cah.mnogueira.ca"],
  }
});

const users: Map<string, User[]> = new Map<string, User[]>;
const deck: Deck = new Deck();
const minPlayers = 3;

io.on("connection", (socket) => {
  console.log(`socket ${socket.id} connected`);

  socket.on("joinRoom", ({ roomName, username }) => {
    socket.data.roomName = roomName;
    socket.data.username = username;

    socket.join(roomName);
    if (!users.has(roomName)) {
      users.set(roomName, []);
    }

    const roomUsers = users.get(roomName)!;
    roomUsers.push({
      name: username,
      ready: false,
      socketId: socket.id
    });
  
    io.to(roomName).emit("updatePlayers", roomUsers);
    serverMessage(roomName);
  })

  socket.on("ready", () => {
    const roomUsers = users.get(socket.data.roomName);
    if (!roomUsers) {
      return;
    }

    const user = roomUsers.find(u => u.socketId === socket.id);
    if (!user) {
      return;
    }

    user.ready = true;
    serverMessage(socket.data.roomName);
  })

  socket.on("cardPlayed", (card: string) => {
    // update player list
    console.log("Card Played")
  })

  socket.on("requestWhiteCards", (amount: number) => {
    const cards: string[] = [];
    for (let i = 0; i < amount; ++i) {
      cards.push(deck.drawWhiteCard());
    }
    io.to(socket.id).emit("recieveWhiteCards", cards);
  })

  socket.on("disconnect", () => {
    users.set(socket.data.roomName, users.get(socket.data.roomName)?.filter(u => u.socketId !== socket.id) ?? []);
    console.log(`Socket ${socket.id} disconnected`);
    io.emit("updatePlayers", users.get(socket.data.roomName));
  })
});

io.listen(PORT);
console.log(`Socket server listening on port ${PORT}`)

function serverMessage(roomName: string) {
  const roomUsers = users.get(roomName);
  if (!roomUsers) return;

  if (roomUsers.length < minPlayers) {
    io.emit("serverMessage", `Waiting for ${minPlayers - roomUsers.length} more players to join...`);
    return;
  }

  const readyPlayers = roomUsers.filter(u => u.ready).length;
  if (readyPlayers < roomUsers.length) {
    io.emit("serverMessage", `${readyPlayers}/${roomUsers.length} ready...`);
    return;
  }

  io.emit("serverMessage", "Starting game...");
  startGame();
}

function startGame() {
  const prompt = deck.drawBlackCard();
  io.emit("start");
  io.emit("prompt", prompt);
  io.emit("serverMessage", "Waiting for players...")
}
