"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPublicRoomState,
  createRoom,
  disconnectPlayer,
  getRoom,
  joinRoom
} = require("./roomManager");

test("room creation produces a unique four-letter code and adds its host", () => {
  const result = createRoom("host-test", "Host", { mode: "player", rounds: 8 });
  assert.ok(result.room);
  assert.match(result.room.roomCode, /^[A-HJ-NP-Z]{4}$/);
  assert.equal(getRoom(result.room.roomCode), result.room);
  assert.equal(result.room.hostId, "host-test");
  assert.equal(result.room.players.length, 1);
  assert.equal(result.room.mode, "player");
  assert.equal(result.room.requestedRounds, 8);
});

test("room joining enforces the 10-player limit and lobby-only access", () => {
  const created = createRoom("limit-host", "Host");
  let lastJoin;
  for (let index = 1; index < 10; index += 1) {
    lastJoin = joinRoom(created.room.roomCode, `player-${index}`, `Player ${index}`);
    assert.ok(lastJoin.room);
  }

  assert.equal(created.room.players.filter((player) => player.connected).length, 10);
  assert.match(joinRoom(created.room.roomCode, "extra", "Extra").error, /10 connected players/);
  created.room.gamePhase = "ANSWERING";
  assert.match(joinRoom(created.room.roomCode, "late", "Late").error, /already started/);
});

test("public lobby state omits prompt and answer text, and host disconnect transfers control", () => {
  const created = createRoom("host-disconnect", "Host");
  const joined = joinRoom(created.room.roomCode, "next-player", "Next");
  created.room.prompt = "private prompt text";
  created.room.answers.push({ id: "a1", playerId: "host-disconnect", text: "private answer" });

  const publicState = createPublicRoomState(created.room);
  assert.equal(JSON.stringify(publicState).includes("private prompt text"), false);
  assert.equal(JSON.stringify(publicState).includes("private answer"), false);

  assert.equal(disconnectPlayer(created.room, "host-disconnect"), true);
  assert.equal(created.room.hostId, joined.player.id);
});
