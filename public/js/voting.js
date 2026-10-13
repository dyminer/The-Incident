import { escapeHtml } from "./common.js";

export function renderVoting(root, game, actions) {
  const cards = game.answers.map((answer, index) => `
    <article class="answer-card ${answer.isOwn ? "own-answer" : ""}">
      <span class="answer-index">ANSWER ${String(index + 1).padStart(2, "0")}</span>
      <p>${escapeHtml(answer.text)}</p>
      ${answer.isOwn
        ? '<span class="your-answer-tag">YOUR ANSWER</span>'
        : `<button class="button button-vote" data-answer-id="${escapeHtml(answer.id)}" ${game.ownVoteSubmitted ? "disabled" : ""}>${game.ownVoteSubmitted ? "Vote locked" : "Vote for this"}</button>`}
    </article>
  `).join("");

  root.innerHTML = `
    <header class="topbar">
      <a class="brand" href="/" aria-label="The Incident"><span class="brand-mark">!</span> THE INCIDENT</a>
      <span class="round-pill">ROUND ${game.currentRound} <span>/ ${game.totalRounds}</span></span>
    </header>
    <section class="voting-section">
      <p class="eyebrow">THE VERDICT IS YOURS</p>
      <h1>Which answer wins?</h1>
      <p class="muted">Answers are anonymous. You can’t vote for your own.</p>
      ${game.ownVoteSubmitted
        ? '<div class="submitted-card vote-confirm"><span class="check-mark">✓</span><div><strong>Your vote is in.</strong><span>The room is deciding…</span></div></div>'
        : game.canVote
          ? `<div class="answer-grid">${cards}</div>`
          : '<div class="waiting-note"><span class="pulse-dot"></span> Waiting for eligible answers…</div>'}
    </section>
  `;

  root.querySelectorAll("[data-answer-id]").forEach((button) => {
    button.addEventListener("click", () => actions.submitVote(button.dataset.answerId));
  });
}
