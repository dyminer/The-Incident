export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

export function renderStandings(standings, currentPlayerId) {
  return standings.map((player, index) => `
    <li class="standings-row ${player.id === currentPlayerId ? "is-you" : ""}">
      <span class="rank">${index + 1}</span>
      <span class="standing-name">${escapeHtml(player.name)}${player.id === currentPlayerId ? " (you)" : ""}</span>
      <strong>${player.score} pts</strong>
    </li>
  `).join("");
}

export function setButtonBusy(button, busy, busyText = "Sending...") {
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
    return;
  }
  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}
