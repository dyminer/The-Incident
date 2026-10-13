"use strict";

const { randomUUID } = require("node:crypto");
const { BUILT_IN_PROMPTS } = require("./prompts");
const { getPlayer, MAX_PLAYERS, MIN_PLAYERS } = require("./roomManager");

const MAX_PROMPT_LENGTH = 180;
const MAX_ANSWER_LENGTH = 240;
const POINTS_PER_VOTE = 100;

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function submitPrompts(room, playerId, values) {
  const player = getPlayer(room, playerId);
  if (room.gamePhase !== "LOBBY" || room.mode !== "player") {
    return { error: "Player prompts can only be submitted in this room's lobby." };
  }
  if (!player || !player.connected) {
    return { error: "You are not a connected player in this room." };
  }
  if (!Array.isArray(values) || values.length !== 3) {
    return { error: "Submit exactly three prompts." };
  }

  const prompts = values.map((value) => (
    typeof value === "string" ? value.trim() : ""
  ));
  if (prompts.some((prompt) => prompt.length === 0 || prompt.length > MAX_PROMPT_LENGTH)) {
    return { error: `Each prompt must be between 1 and ${MAX_PROMPT_LENGTH} characters.` };
  }

  player.promptSubmissions = prompts;
  return { ok: true };
}

function startGame(room) {
  if (room.gamePhase !== "LOBBY") {
    return { error: "The game has already started." };
  }

  const connectedPlayers = room.players.filter((player) => player.connected);
  if (connectedPlayers.length < MIN_PLAYERS || connectedPlayers.length > MAX_PLAYERS) {
    return { error: `The game needs ${MIN_PLAYERS}–${MAX_PLAYERS} connected players to start.` };
  }

  const deck = room.mode === "player"
    ? connectedPlayers.flatMap((player) => player.promptSubmissions)
    : BUILT_IN_PROMPTS;
  if (room.mode === "player" && connectedPlayers.some(
    (player) => player.promptSubmissions.length !== 3
  )) {
    return { error: "Every connected player must submit three prompts first." };
  }

  room.promptDeck = shuffle(deck);
  room.totalRounds = Math.min(room.requestedRounds, room.promptDeck.length);
  room.currentRound = 0;
  room.players.forEach((player) => {
    player.score = 0;
  });
  beginNextRound(room);
  return { ok: true };
}

function beginNextRound(room) {
  if (room.currentRound >= room.totalRounds) {
    room.gamePhase = "GAME_OVER";
    room.prompt = "";
    return;
  }

  room.currentRound += 1;
  room.prompt = room.promptDeck[room.currentRound - 1];
  room.answers = [];
  room.votes = [];
  room.gamePhase = "PROMPT";
}

function beginAnswering(room) {
  if (room.gamePhase !== "PROMPT") {
    return false;
  }

  room.gamePhase = "ANSWERING";
  return true;
}

function connectedPlayers(room) {
  return room.players.filter((player) => player.connected);
}

function findAnswer(room, playerId) {
  return room.answers.find((answer) => answer.playerId === playerId);
}

function eligibleVoters(room) {
  return connectedPlayers(room).filter((player) => (
    Boolean(findAnswer(room, player.id)) &&
    room.answers.some((answer) => answer.playerId !== player.id)
  ));
}

function completeVotingIfReady(room) {
  if (room.gamePhase !== "VOTING") {
    return false;
  }

  const eligible = eligibleVoters(room);
  if (eligible.some((player) => !room.votes.some((vote) => vote.voterId === player.id))) {
    return false;
  }

  room.answers.forEach((answer) => {
    const receivedVotes = room.votes.filter((vote) => vote.answerId === answer.id).length;
    const author = getPlayer(room, answer.playerId);
    if (author) {
      author.score += receivedVotes * POINTS_PER_VOTE;
    }
  });
  room.gamePhase = "RESULTS";
  return true;
}

function beginVoting(room) {
  room.gamePhase = "VOTING";
  completeVotingIfReady(room);
}

function completeAnswersIfReady(room) {
  if (
    room.gamePhase !== "ANSWERING" ||
    connectedPlayers(room).some((player) => !findAnswer(room, player.id))
  ) {
    return false;
  }

  beginVoting(room);
  return true;
}

function submitAnswer(room, playerId, value) {
  const player = getPlayer(room, playerId);
  const text = typeof value === "string" ? value.trim() : "";
  if (room.gamePhase !== "ANSWERING") {
    return { error: "Answers are not being accepted right now." };
  }
  if (!player || !player.connected) {
    return { error: "You are not a connected player in this room." };
  }
  if (findAnswer(room, playerId)) {
    return { error: "You have already submitted an answer for this round." };
  }
  if (text.length === 0 || text.length > MAX_ANSWER_LENGTH) {
    return { error: `Your answer must be between 1 and ${MAX_ANSWER_LENGTH} characters.` };
  }

  room.answers.push({ id: randomUUID(), playerId, text });
  completeAnswersIfReady(room);
  return { ok: true };
}

function submitVote(room, voterId, answerId) {
  const voter = getPlayer(room, voterId);
  if (room.gamePhase !== "VOTING") {
    return { error: "Voting is not open right now." };
  }
  if (!voter || !voter.connected || !findAnswer(room, voterId)) {
    return { error: "Only connected players who answered may vote." };
  }
  if (!eligibleVoters(room).some((player) => player.id === voterId)) {
    return { error: "There is no other answer for you to vote for." };
  }
  if (room.votes.some((vote) => vote.voterId === voterId)) {
    return { error: "You have already voted this round." };
  }

  const answer = room.answers.find((candidate) => candidate.id === answerId);
  if (!answer || answer.playerId === voterId) {
    return { error: "Choose another player's answer." };
  }

  room.votes.push({ voterId, answerId });
  completeVotingIfReady(room);
  return { ok: true };
}

function nextRound(room, playerId) {
  if (room.gamePhase !== "RESULTS") {
    return { error: "The next round can only start from the results screen." };
  }
  if (room.hostId !== playerId) {
    return { error: "Only the host can continue to the next round." };
  }

  beginNextRound(room);
  return { ok: true };
}

function handlePlayerDisconnect(room) {
  if (room.gamePhase === "ANSWERING") {
    completeAnswersIfReady(room);
  } else if (room.gamePhase === "VOTING") {
    completeVotingIfReady(room);
  }
}

function createPrivateGameState(room, playerId) {
  const player = getPlayer(room, playerId);
  const state = {
    phase: room.gamePhase,
    mode: room.mode,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    prompt: room.prompt,
    answerCount: room.answers.length,
    ownAnswerSubmitted: Boolean(findAnswer(room, playerId)),
    ownVoteSubmitted: room.votes.some((vote) => vote.voterId === playerId),
    canVote: eligibleVoters(room).some((voter) => voter.id === playerId),
    standings: room.players
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        score: candidate.score,
        connected: candidate.connected
      }))
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
  };

  if (room.gamePhase === "VOTING") {
    state.answers = room.answers.map((answer) => ({
      id: answer.id,
      text: answer.text,
      isOwn: answer.playerId === playerId
    }));
  } else if (room.gamePhase === "RESULTS" || room.gamePhase === "GAME_OVER") {
    state.answers = room.answers.map((answer) => {
      const author = getPlayer(room, answer.playerId);
      return {
        id: answer.id,
        text: answer.text,
        playerName: author ? author.name : "Player",
        votes: room.votes.filter((vote) => vote.answerId === answer.id).length
      };
    }).sort((left, right) => right.votes - left.votes);
  }

  if (player) {
    state.isHost = room.hostId === playerId;
  }
  return state;
}

module.exports = {
  MAX_ANSWER_LENGTH,
  MAX_PROMPT_LENGTH,
  beginAnswering,
  createPrivateGameState,
  handlePlayerDisconnect,
  nextRound,
  startGame,
  submitAnswer,
  submitPrompts,
  submitVote
};
