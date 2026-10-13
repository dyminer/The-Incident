import { renderAnswering } from "./answering.js";
import { escapeHtml } from "./common.js";
import { renderLobby } from "./lobby.js";
import { renderResults } from "./scoreboard.js";
import { renderVoting } from "./voting.js";

const socket = window.io();
const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const state = {
  playerId: null,
  room: null,
  game: null,
  promptDrafts: ["", "", ""]
};
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3600);
}

function renderHome() {
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="/" aria-label="The Incident"><span class="brand-mark">!</span> THE INCIDENT</a>
      <span class="connection-pill"><span class="live-dot"></span> House-party mode</span>
    </header>
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">A PARTY GAME FOR QUESTIONABLE IDEAS</p>
        <h1>It was a normal night.<br><span>Then someone said that.</span></h1>
        <p class="hero-description">Write ridiculous answers. Judge your friends. Deny everything.</p>
        <div class="local-note"><span class="wifi-icon">⌁</span><span>Plays on your local WiFi. No accounts. No internet required.</span></div>
      </div>
      <div class="entry-grid">
        <form id="create-form" class="panel entry-card">
          <p class="eyebrow">START THE INCIDENT</p>
          <h2>Host a game</h2>
          <label class="field-label" for="host-name">Your name</label>
          <input id="host-name" name="name" maxlength="16" required placeholder="e.g. Alex">
          <label class="field-label" for="prompt-mode">Prompt deck</label>
          <select id="prompt-mode" name="mode">
            <option value="built-in">Built-in prompts</option>
            <option value="player">Everyone writes 3 prompts</option>
          </select>
          <label class="field-label" for="round-count">Rounds</label>
          <select id="round-count" name="rounds">
            ${[3, 4, 5, 6, 7, 8, 9, 10].map((round) => `<option value="${round}" ${round === 5 ? "selected" : ""}>${round} rounds</option>`).join("")}
          </select>
          <button class="button button-primary full-width" type="submit">Create a room <span aria-hidden="true">→</span></button>
        </form>
        <form id="join-form" class="panel entry-card join-card">
          <p class="eyebrow">JUMP INTO THE CHAOS</p>
          <h2>Join a game</h2>
          <label class="field-label" for="join-name">Your name</label>
          <input id="join-name" name="name" maxlength="16" required placeholder="e.g. Sam">
          <label class="field-label" for="join-code">Four-letter room code</label>
          <input id="join-code" name="roomCode" maxlength="4" minlength="4" required placeholder="ABCD" autocomplete="off">
          <button class="button button-secondary full-width" type="submit">Join the room <span aria-hidden="true">→</span></button>
        </form>
      </div>
      <p class="minimum-note">Gather 4–10 players · One device hosts · Everyone else joins in a browser</p>
    </section>
  `;

  app.querySelector("#create-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    socket.emit("room:create", {
      name: form.get("name"),
      mode: form.get("mode"),
      rounds: form.get("rounds")
    });
  });
  app.querySelector("#join-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    socket.emit("room:join", {
      name: form.get("name"),
      roomCode: form.get("roomCode")
    });
  });
  app.querySelector("#join-code").addEventListener("input", (event) => {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  });
}

function renderCurrentView() {
  if (!state.room || !state.playerId) {
    renderHome();
    return;
  }

  if (state.room.gamePhase === "LOBBY" || !state.game) {
    renderLobby(app, state.room, state.playerId, state.promptDrafts, {
      submitPrompts: (prompts) => {
        state.promptDrafts = prompts;
        socket.emit("lobby:submit-prompts", { prompts });
      },
      startGame: () => socket.emit("game:start")
    });
    return;
  }

  if (["PROMPT", "ANSWERING"].includes(state.game.phase)) {
    renderAnswering(app, state.room, state.game, state.playerId, {
      submitAnswer: (text) => socket.emit("game:submit-answer", { text })
    });
  } else if (state.game.phase === "VOTING") {
    renderVoting(app, state.game, {
      submitVote: (answerId) => socket.emit("game:submit-vote", { answerId })
    });
  } else {
    renderResults(app, state.room, state.game, state.playerId, {
      nextRound: () => socket.emit("game:next-round")
    });
  }
}

socket.on("connect", () => {
  if (!state.room) {
    renderHome();
  }
});

socket.on("disconnect", () => {
  showToast("Connection lost. Refresh to rejoin the room.");
});

socket.on("room:created", ({ roomCode, playerId }) => {
  state.playerId = playerId;
  showToast(`Room ${roomCode} is ready to go.`);
});

socket.on("room:joined", ({ playerId }) => {
  state.playerId = playerId;
  state.promptDrafts = ["", "", ""];
});

socket.on("room:updated", (room) => {
  state.room = room;
  renderCurrentView();
});

socket.on("game:state", (game) => {
  state.game = game;
  renderCurrentView();
});

socket.on("room:error", ({ message }) => showToast(message));
socket.on("game:error", ({ message }) => showToast(message));
socket.on("connect_error", () => showToast("Could not connect to the host. Check the WiFi address and try again."));

renderHome();
