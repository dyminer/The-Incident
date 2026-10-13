"use strict";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MIN_PLAYERS = 4;
const MAX_PLAYERS = 10;
const rooms = new Map();

function normalizeName(value) {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim();
  return name.length > 0 && name.length <= 16 ? name : null;
}

function generateRoomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => {
      const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
      return ROOM_CODE_ALPHABET[index];
    }).join("");
  } while (rooms.has(code));

  return code;
}

function createRoom(socketId, nameValue, options = {}) {
  const name = normalizeName(nameValue);
  if (!name) {
    return { error: "Enter a name between 1 and 16 characters." };
  }

  const mode = options.mode === "player" ? "player" : "built-in";
  const requestedRounds = Number.parseInt(options.rounds, 10);
  const rounds = Number.isInteger(requestedRounds)
    ? Math.min(10, Math.max(3, requestedRounds))
    : 5;
  const roomCode = generateRoomCode();
  const host = {
    id: socketId,
    socketId,
    name,
    score: 0,
    connected: true,
    promptSubmissions: []
  };

  const room = {
    roomCode,
    hostId: host.id,
    gamePhase: "LOBBY",
    mode,
    requestedRounds: rounds,
    totalRounds: rounds,
    currentRound: 0,
    prompt: "",
    players: [host],
    answers: [],
    votes: [],
    promptDeck: [],
    promptTimer: null
  };

  rooms.set(roomCode, room);
  return { room, player: host };
}

function joinRoom(roomCodeValue, socketId, nameValue) {
  const roomCode = typeof roomCodeValue === "string"
    ? roomCodeValue.trim().toUpperCase()
    : "";
  const room = rooms.get(roomCode);

  if (!room) {
    return { error: "That room code was not found." };
  }
  if (room.gamePhase !== "LOBBY") {
    return { error: "That game has already started." };
  }

  const name = normalizeName(nameValue);
  if (!name) {
    return { error: "Enter a name between 1 and 16 characters." };
  }

  const connectedPlayers = room.players.filter((player) => player.connected);
  if (connectedPlayers.length >= MAX_PLAYERS) {
    return { error: "This room already has 10 connected players." };
  }

  const player = {
    id: socketId,
    socketId,
    name,
    score: 0,
    connected: true,
    promptSubmissions: []
  };
  room.players.push(player);
  return { room, player };
}

function getRoom(roomCode) {
  return rooms.get(roomCode);
}

function getPlayer(room, playerId) {
  return room.players.find((player) => player.id === playerId);
}

function disconnectPlayer(room, playerId) {
  const player = getPlayer(room, playerId);
  if (!player) {
    return false;
  }

  player.connected = false;
  player.socketId = null;

  // Keep the room playable if its host leaves by handing control to the first
  // remaining connected player. The original host remains in the scoreboard.
  if (room.hostId === player.id) {
    const replacement = room.players.find((candidate) => candidate.connected);
    if (replacement) {
      room.hostId = replacement.id;
    }
  }

  return true;
}

function createPublicRoomState(room) {
  return {
    roomCode: room.roomCode,
    gamePhase: room.gamePhase,
    mode: room.mode,
    requestedRounds: room.requestedRounds,
    totalRounds: room.totalRounds,
    currentRound: room.currentRound,
    hostId: room.hostId,
    promptSubmissionCount: room.players.reduce(
      (count, player) => count + player.promptSubmissions.length,
      0
    ),
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      connected: player.connected,
      submittedPrompts: player.promptSubmissions.length
    }))
  };
}

module.exports = {
  MAX_PLAYERS,
  MIN_PLAYERS,
  createPublicRoomState,
  createRoom,
  disconnectPlayer,
  getPlayer,
  getRoom,
  joinRoom
};
