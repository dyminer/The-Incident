import { escapeHtml } from "./common.js";

export function renderLobby(root, room, playerId, drafts, actions) {
  const isHost = room.hostId === playerId;
  const connectedCount = room.players.filter((player) => player.connected).length;
  const submittedPlayers = room.players.filter(
    (player) => player.connected && player.submittedPrompts === 3
  ).length;

  root.innerHTML = `
    <header class="topbar">
      <a class="brand" href="/" aria-label="The Incident home"><span class="brand-mark">!</span> THE INCIDENT</a>
      <span class="connection-pill"><span class="live-dot"></span> Local room</span>
    </header>
    <section class="panel lobby-panel">
      <p class="eyebrow">THE LOBBY</p>
      <h1>Room <span class="room-code">${escapeHtml(room.roomCode)}</span></h1>
      <p class="muted">Share this code with everyone on your WiFi network.</p>
      <div class="lobby-summary">
        <div><span class="stat-value">${connectedCount}<small> / 10</small></span><span class="stat-label">PLAYERS</span></div>
        <div><span class="stat-value">${room.requestedRounds}</span><span class="stat-label">ROUNDS</span></div>
        <div><span class="stat-value">${room.mode === "player" ? "YOU" : "THE"}<small> PROMPTS</small></span><span class="stat-label">PROMPT DECK</span></div>
      </div>
      <div class="player-list-heading"><h2>Who’s playing?</h2><span class="muted">${connectedCount} connected</span></div>
      <ul class="player-list">
        ${room.players.map((player) => `
          <li class="player-row ${player.connected ? "" : "disconnected"}">
            <span class="avatar">${escapeHtml(player.name.slice(0, 1).toUpperCase())}</span>
            <span class="player-name">${escapeHtml(player.name)}${player.id === playerId ? " <small>(you)</small>" : ""}</span>
            ${player.id === room.hostId ? '<span class="host-tag">HOST</span>' : ""}
            ${room.mode === "player" ? `<span class="prompt-progress">${player.submittedPrompts}/3 prompts</span>` : ""}
            ${player.connected ? "" : '<span class="muted">offline</span>'}
          </li>
        `).join("")}
      </ul>
      ${room.mode === "player" ? `
        <form id="prompts-form" class="prompt-form">
          <div>
            <p class="eyebrow">YOUR PROMPTS</p>
            <h2>Seed the question deck</h2>
            <p class="muted">Write three funny fill-in-the-blank prompts. They’ll be shuffled together and shown to everyone.</p>
          </div>
          ${[0, 1, 2].map((index) => `
            <label class="field-label">Prompt ${index + 1}
              <input name="prompt${index}" maxlength="180" required value="${escapeHtml(drafts[index] || "")}" placeholder="The worst thing to find in your fridge is...">
            </label>
          `).join("")}
          <button class="button button-secondary" type="submit">Save my three prompts</button>
          <p class="microcopy">${submittedPlayers}/${connectedCount} connected players have contributed.</p>
        </form>
      ` : ""}
      <div class="lobby-actions">
        ${isHost ? `
          <button id="start-game" class="button button-primary" ${connectedCount < 4 || (room.mode === "player" && submittedPlayers !== connectedCount) ? "disabled" : ""}>Start the game <span aria-hidden="true">→</span></button>
          <p class="microcopy">${connectedCount < 4 ? "At least four connected players are needed." : room.mode === "player" && submittedPlayers !== connectedCount ? "Everyone needs to submit three prompts first." : "You can start when everyone is ready."}</p>
        ` : '<p class="waiting-note"><span class="pulse-dot"></span> Waiting for the host to start…</p>'}
      </div>
    </section>
  `;

  const promptForm = root.querySelector("#prompts-form");
  if (promptForm) {
    promptForm.addEventListener("input", (event) => {
      const index = Number(event.target.name.replace("prompt", ""));
      drafts[index] = event.target.value;
    });
    promptForm.addEventListener("submit", (event) => {
      event.preventDefault();
      actions.submitPrompts([0, 1, 2].map((index) => drafts[index] || ""));
    });
  }

  const startButton = root.querySelector("#start-game");
  if (startButton) {
    startButton.addEventListener("click", actions.startGame);
  }
}
