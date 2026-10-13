"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  beginAnswering,
  createPrivateGameState,
  nextRound,
  startGame,
  submitAnswer,
  submitPrompts,
  submitVote
} = require("./gameManager");

function createTestRoom(mode = "built-in") {
  const players = Array.from({ length: 4 }, (_, index) => ({
    id: `player-${index + 1}`,
    socketId: `player-${index + 1}`,
    name: `Player ${index + 1}`,
    score: 0,
    connected: true,
    promptSubmissions: []
  }));
  return {
    roomCode: "TEST",
    hostId: players[0].id,
    gamePhase: "LOBBY",
    mode,
    requestedRounds: 5,
    totalRounds: 5,
    currentRound: 0,
    prompt: "",
    players,
    answers: [],
    votes: [],
    promptDeck: [],
    promptTimer: null
  };
}

test("player-prompt rooms require three prompts from each player before starting", () => {
  const room = createTestRoom("player");
  assert.equal(startGame(room).error, "Every connected player must submit three prompts first.");

  for (const player of room.players) {
    assert.equal(
      submitPrompts(room, player.id, ["A prompt", "Another prompt", "One more prompt"]).ok,
      true
    );
  }

  assert.equal(startGame(room).ok, true);
  assert.equal(room.promptDeck.length, 12);
  assert.equal(room.totalRounds, 5);
  assert.equal(room.gamePhase, "PROMPT");
});

test("answers remain anonymous during voting and voters cannot vote for themselves", () => {
  const room = createTestRoom();
  assert.equal(startGame(room).ok, true);
  assert.equal(beginAnswering(room), true);

  for (const player of room.players) {
    assert.equal(submitAnswer(room, player.id, `Answer from ${player.name}`).ok, true);
  }

  assert.equal(room.gamePhase, "VOTING");
  const firstAnswer = room.answers[0];
  const authorView = createPrivateGameState(room, firstAnswer.playerId);
  assert.equal(authorView.answers.find((answer) => answer.id === firstAnswer.id).isOwn, true);
  assert.equal("playerName" in authorView.answers[0], false);
  assert.equal(submitVote(room, firstAnswer.playerId, firstAnswer.id).error, "Choose another player's answer.");

  const voter = room.players.find((player) => player.id !== firstAnswer.playerId);
  assert.equal(submitVote(room, voter.id, firstAnswer.id).ok, true);
  assert.equal(submitVote(room, voter.id, firstAnswer.id).error, "You have already voted this round.");
});

test("scores are awarded after all eligible votes and only the host advances rounds", () => {
  const room = createTestRoom();
  assert.equal(startGame(room).ok, true);
  beginAnswering(room);
  for (const player of room.players) {
    submitAnswer(room, player.id, `Answer from ${player.name}`);
  }

  const winner = room.answers[0];
  for (const player of room.players) {
    if (player.id !== winner.playerId) {
      assert.equal(submitVote(room, player.id, winner.id).ok, true);
    } else {
      const otherAnswer = room.answers.find((answer) => answer.playerId !== player.id);
      assert.equal(submitVote(room, player.id, otherAnswer.id).ok, true);
    }
  }

  assert.equal(room.gamePhase, "RESULTS");
  assert.equal(room.players.find((player) => player.id === winner.playerId).score, 300);
  assert.ok(nextRound(room, "not-the-host").error);
  assert.equal(nextRound(room, room.hostId).ok, true);
  assert.equal(room.currentRound, 2);
  assert.equal(room.gamePhase, "PROMPT");
});

test("input bounds are enforced for prompt and answer submissions", () => {
  const room = createTestRoom("player");
  assert.ok(submitPrompts(room, room.players[0].id, ["", "b", "c"]).error);
  assert.ok(submitPrompts(room, room.players[0].id, ["x".repeat(181), "b", "c"]).error);

  const builtInRoom = createTestRoom();
  startGame(builtInRoom);
  beginAnswering(builtInRoom);
  assert.ok(submitAnswer(builtInRoom, builtInRoom.players[0].id, "x".repeat(241)).error);
});
