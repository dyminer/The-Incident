import { escapeHtml } from "./common.js";

export function renderAnswering(root, room, game, playerId, actions) {
  const inPromptIntro = game.phase === "PROMPT";
  const answered = game.ownAnswerSubmitted;

  root.innerHTML = `
    <header class="topbar">
      <a class="brand" href="/" aria-label="The Incident"><span class="brand-mark">!</span> THE INCIDENT</a>
      <span class="round-pill">ROUND ${game.currentRound} <span>/ ${game.totalRounds}</span></span>
    </header>
    <section class="game-layout">
      <div class="game-main">
        <p class="eyebrow">${inPromptIntro ? "UP NEXT" : "YOUR PROMPT"}</p>
        <h1 class="prompt-card">${escapeHtml(game.prompt)}</h1>
        ${inPromptIntro
          ? '<div class="waiting-note"><span class="pulse-dot"></span> Get your answer ready…</div>'
          : answered
            ? '<div class="submitted-card"><span class="check-mark">✓</span><div><strong>Answer locked in.</strong><span>Hang tight while everyone else thinks.</span></div></div>'
            : `
              <form id="answer-form" class="answer-form">
                <label class="field-label" for="answer-text">Your answer <span class="muted">— make it count</span></label>
                <textarea id="answer-text" name="answer" maxlength="240" required placeholder="Type your funniest answer…" rows="3"></textarea>
                <div class="form-footer"><span id="answer-count" class="microcopy">0 / 240</span><button class="button button-primary" type="submit">Lock it in <span aria-hidden="true">→</span></button></div>
              </form>
            `}
        <p class="microcopy answer-progress">${game.answerCount} answer${game.answerCount === 1 ? "" : "s"} in</p>
      </div>
      <aside class="side-card">
        <p class="eyebrow">IN THE ROOM</p>
        <ul class="compact-player-list">
          ${room.players.map((player) => `
            <li><span class="live-dot ${player.connected ? "" : "offline-dot"}"></span>${escapeHtml(player.name)}${player.id === playerId ? " (you)" : ""}</li>
          `).join("")}
        </ul>
      </aside>
    </section>
  `;

  const form = root.querySelector("#answer-form");
  if (form) {
    const textarea = form.elements.answer;
    const count = root.querySelector("#answer-count");
    textarea.addEventListener("input", () => {
      count.textContent = `${textarea.value.length} / 240`;
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      actions.submitAnswer(textarea.value);
    });
  }
}
