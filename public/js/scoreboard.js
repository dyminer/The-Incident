import { escapeHtml, renderStandings } from "./common.js";

export function renderResults(root, room, game, playerId, actions) {
  const final = game.phase === "GAME_OVER";
  root.innerHTML = `
    <header class="topbar">
      <a class="brand" href="/" aria-label="The Incident"><span class="brand-mark">!</span> THE INCIDENT</a>
      <span class="round-pill">${final ? "FINAL RESULTS" : `ROUND ${game.currentRound} RESULTS`}</span>
    </header>
    <section class="results-layout">
      <div class="results-main">
        <p class="eyebrow">${final ? "THAT’S A WRAP" : "THE PEOPLE HAVE SPOKEN"}</p>
        <h1>${final ? "The final verdict." : "And the winner is…"}</h1>
        ${game.answers && game.answers.length ? `
          <div class="result-answer-list">
            ${game.answers.map((answer, index) => `
              <article class="result-answer ${index === 0 ? "winning-answer" : ""}">
                <div class="result-vote-count">${answer.votes}<small> vote${answer.votes === 1 ? "" : "s"}</small></div>
                <div class="result-answer-copy"><p>${escapeHtml(answer.text)}</p><span>— ${escapeHtml(answer.playerName)}</span></div>
              </article>
            `).join("")}
          </div>
        ` : ""}
        <div class="results-action">
          ${final
            ? '<p class="waiting-note">Thanks for playing The Incident.</p>'
            : game.isHost
              ? '<button id="next-round" class="button button-primary">Continue <span aria-hidden="true">→</span></button>'
              : '<p class="waiting-note"><span class="pulse-dot"></span> Waiting for the host…</p>'}
        </div>
      </div>
      <aside class="score-card">
        <p class="eyebrow">${final ? "FINAL LEADERBOARD" : "CURRENT STANDINGS"}</p>
        <ol class="standings-list">${renderStandings(game.standings, playerId)}</ol>
      </aside>
    </section>
  `;
  const nextButton = root.querySelector("#next-round");
  if (nextButton) {
    nextButton.addEventListener("click", actions.nextRound);
  }
}
