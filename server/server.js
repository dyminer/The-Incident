"use strict";

const path = require("node:path");
const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const gameManager = require("./gameManager");
const roomManager = require("./roomManager");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const PROMPT_DISPLAY_MS = 3500;

app.use(express.static(path.join(__dirname, "..", "public")));

function publishRoom(room) {
  io.to(room.roomCode).emit("room:updated", roomManager.createPublicRoomState(room));

  // Game state is personalized because voting answers must never include their
  // authors until results are ready; each player only sees whether an answer is theirs.
  room.players.forEach((player) => {
    if (!player.connected || !player.socketId) {
      return;
    }

    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      playerSocket.emit(
        "game:state",
        gameManager.createPrivateGameState(room, player.id)
      );
    }
  });
}

function sendError(socket, eventName, message) {
  socket.emit(eventName, { message });
}

function asPayload(value) {
  return value && typeof value === "object" ? value : {};
}

function attachPlayer(socket, room, player, eventName) {
  socket.join(room.roomCode);
  socket.data.roomCode = room.roomCode;
  socket.data.playerId = player.id;
  socket.emit(eventName, {
    roomCode: room.roomCode,
    playerId: player.id
  });
  publishRoom(room);
}

function publishGameError(socket, result) {
  if (result.error) {
    sendError(socket, "game:error", result.error);
    return false;
  }
  return true;
}

io.on("connection", (socket) => {
  // Client -> server: create a room and add its creator as the first (host) player.
  socket.on("room:create", (payload) => {
    const data = asPayload(payload);
    const result = roomManager.createRoom(socket.id, data.name, {
      mode: data.mode,
      rounds: data.rounds
    });
    if (result.error) {
      sendError(socket, "room:error", result.error);
      return;
    }
    attachPlayer(socket, result.room, result.player, "room:created");
  });

  // Client -> server: join an existing lobby by its four-letter room code.
  socket.on("room:join", (payload) => {
    const data = asPayload(payload);
    const result = roomManager.joinRoom(data.roomCode, socket.id, data.name);
    if (result.error) {
      sendError(socket, "room:error", result.error);
      return;
    }
    attachPlayer(socket, result.room, result.player, "room:joined");
  });

  // Client -> server: submit exactly three shared-deck prompts in player-prompt mode.
  socket.on("lobby:submit-prompts", (payload) => {
    const data = asPayload(payload);
    const room = roomManager.getRoom(socket.data.roomCode);
    if (!room) {
      sendError(socket, "room:error", "Join a room before submitting prompts.");
      return;
    }
    const result = gameManager.submitPrompts(room, socket.data.playerId, data.prompts);
    if (publishGameError(socket, result)) {
      publishRoom(room);
    }
  });

  // Client -> server: the host starts only after the player count and prompt
  // contribution requirements have been checked by the authoritative game manager.
  socket.on("game:start", () => {
    const room = roomManager.getRoom(socket.data.roomCode);
    if (!room) {
      sendError(socket, "game:error", "Join a room before starting a game.");
      return;
    }
    if (room.hostId !== socket.data.playerId) {
      sendError(socket, "game:error", "Only the host can start the game.");
      return;
    }

    const result = gameManager.startGame(room);
    if (!publishGameError(socket, result)) {
      return;
    }

    publishRoom(room);
    room.promptTimer = setTimeout(() => {
      if (gameManager.beginAnswering(room)) {
        room.promptTimer = null;
        publishRoom(room);
      }
    }, PROMPT_DISPLAY_MS);
  });

  // Client -> server: submit one answer; the server privately stores its author.
  socket.on("game:submit-answer", (payload) => {
    const data = asPayload(payload);
    const room = roomManager.getRoom(socket.data.roomCode);
    if (!room) {
      sendError(socket, "game:error", "Join a room before answering.");
      return;
    }
    const result = gameManager.submitAnswer(room, socket.data.playerId, data.text);
    if (publishGameError(socket, result)) {
      publishRoom(room);
    }
  });

  // Client -> server: cast one vote by opaque answer ID. The server rejects
  // missing answers, repeat votes, and votes for the voter's own answer.
  socket.on("game:submit-vote", (payload) => {
    const data = asPayload(payload);
    const room = roomManager.getRoom(socket.data.roomCode);
    if (!room) {
      sendError(socket, "game:error", "Join a room before voting.");
      return;
    }
    const result = gameManager.submitVote(
      room,
      socket.data.playerId,
      data.answerId
    );
    if (publishGameError(socket, result)) {
      publishRoom(room);
    }
  });

  // Client -> server: ask the host to begin the next round or end the game.
  socket.on("game:next-round", () => {
    const room = roomManager.getRoom(socket.data.roomCode);
    if (!room) {
      sendError(socket, "game:error", "Join a room before continuing.");
      return;
    }
    const result = gameManager.nextRound(room, socket.data.playerId);
    if (publishGameError(socket, result)) {
      publishRoom(room);
      if (room.gamePhase === "PROMPT") {
        room.promptTimer = setTimeout(() => {
          if (gameManager.beginAnswering(room)) {
            room.promptTimer = null;
            publishRoom(room);
          }
        }, PROMPT_DISPLAY_MS);
      }
    }
  });

  socket.on("disconnect", () => {
    const room = roomManager.getRoom(socket.data.roomCode);
    if (!room) {
      return;
    }

    roomManager.disconnectPlayer(room, socket.data.playerId);
    gameManager.handlePlayerDisconnect(room);
    publishRoom(room);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`The Incident is listening on port ${PORT}.`);
  console.log("Players on the same WiFi can open http://<host-laptop-LAN-IP>:" + PORT);
});
