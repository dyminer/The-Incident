# The Incident

A browser-based multiplayer party game for a house, Airbnb, or other local WiFi network. One laptop runs the Node.js server; other players open its LAN address on phones or laptops. Game state exists only in server memory.

## Run it

### Native Node.js

1. Install Node.js 18 or newer on the host laptop.
2. From this project folder, run `npm install`.
3. Start the server with `npm start`.
4. On the host laptop, open `http://localhost:3000` and create a room.
5. Find the host laptop's WiFi IPv4 address (`ipconfig` on Windows; look for the WiFi adapter's IPv4 address). Other players on the same network open `http://HOST-IP:3000` and enter the four-letter room code.

### Docker

1. From this project folder, build the image: `docker build -t the-incident .`
2. Run it with `docker run --rm -p 3000:3000 -e PORT=3000 the-incident`
3. Or use Docker Compose: `docker compose up --build`
4. Open `http://localhost:3000` on the host machine, or point players at your public IP / port-forwarded address.

### Secure public access with a Cloudflare tunnel (recommended for a weekend event)

This is the easiest way to let players join from outside your local network with a clickable link and without opening port `3000` directly on your router.

#### Quickest no-domain option

1. Install the Cloudflare Tunnel CLI on the host machine: `winget install --id=Cloudflare.cloudflared -e`
2. Start the app on port `3000`.
3. In a second terminal, run `cloudflared tunnel --url http://localhost:3000`.
4. Cloudflare will print a public URL like `https://abc123xyz.trycloudflare.com`.
5. Share that URL with your players. The tunnel stays open while the terminal remains running.

This is the simplest public-link setup for a weekend game night, but the URL may change if you restart the tunnel.

#### More stable option with a domain

1. Install the Cloudflare Tunnel CLI on the machine running Docker: `winget install --id=Cloudflare.cloudflared -e`
2. Create a tunnel and a public hostname in Cloudflare Zero Trust.
3. Copy `.env.example` to `.env` and set `CLOUDFLARE_TUNNEL_TOKEN`.
4. Start the app and tunnel together: `docker compose -f docker-compose.public.yml up --build`
5. Your players connect to the hostname you configured in Cloudflare, for example `https://incident.example.com`.

This keeps the Node.js app private inside Docker while Cloudflare terminates TLS, verifies identity, and avoids exposing the app directly to the internet.

#### Restarting after a reboot

If you restart your desktop, start the app and tunnel again before sharing the link:

```powershell
cd C:\Main\The-Incident
npm install
npm start
```

Then, in a second terminal:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Or with Docker:

```powershell
docker run -d --name the-incident -p 3000:3000 the-incident
cloudflared tunnel --url http://localhost:3000
```

The host machine must stay awake and connected to the internet for the game to run. If other devices cannot reach it, allow Node.js through the host operating system's private-network firewall. The server binds to `0.0.0.0` so it can accept connections from the local network.

No cloud hosting, database, account, external font, or internet service is needed.

## Play

- The room creator is also a player and the initial host.
- Gather 4–10 connected players. Choose 3–10 rounds when creating the room (5 by default).
- **Built-in prompts:** play from the included 20-prompt deck.
- **Everyone writes 3 prompts:** each connected player contributes exactly three prompts in the lobby. The server combines and shuffles them into one shared deck; every player sees the same prompt each round. The selected round count is capped by the number of available prompts.
- Each player submits one answer per round. Answers are shown anonymously for voting, and players cannot vote for their own answer.
- Each vote for an answer's author earns that player 100 points. The host advances from each results screen; the final round shows the final leaderboard.

Disconnected players stay listed in the room and retain any earned points. A disconnected host's controls pass to the first connected player. Players who disconnect during a round are no longer required to submit or vote, but already-submitted answers and votes remain in the round.

## Project structure

```text
server/
  server.js          Express app, static hosting, and Socket.IO event wiring
  roomManager.js     In-memory rooms, players, room codes, and public lobby state
  gameManager.js     Prompt, answer, vote, phase, scoring, and private game-state rules
  prompts.js         Twenty built-in prompts
public/
  index.html
  css/styles.css
  js/client.js       Socket connection and screen routing
  js/lobby.js        Lobby and prompt contribution UI
  js/answering.js    Prompt and answer UI
  js/voting.js       Anonymous voting UI
  js/scoreboard.js   Round results and final leaderboard UI
```

Run the game-logic tests with `npm test`.

## Socket.IO events

Commands from a browser to the server:

| Event | Purpose |
| --- | --- |
| `room:create` | Create a four-letter room, add the creator as host/player, and choose prompt mode and round count. |
| `room:join` | Join an existing lobby with a room code and display name. |
| `lobby:submit-prompts` | Submit or update the player's three prompts before the game starts. |
| `game:start` | Ask the host to start; server validates player count and prompt readiness. |
| `game:submit-answer` | Submit the player's one answer for the active round. |
| `game:submit-vote` | Vote once for an eligible answer using its opaque answer ID. |
| `game:next-round` | Ask the host to leave results and start the next round or show the final leaderboard. |

Events from the server to browsers:

| Event | Purpose |
| --- | --- |
| `room:created` | Confirm room creation with the new room code and the creator's player ID. |
| `room:joined` | Confirm a successful join with the player's ID. |
| `room:updated` | Broadcast the room code, phase, roster, scores, and prompt-submission progress. It excludes prompt text, answers, and votes. |
| `game:state` | Send phase-specific game state to each player. During voting, each player sees whether an answer is their own, never its author. Results include authors and vote counts. |
| `room:error` | Report invalid room creation/join or prompt-submission context. |
| `game:error` | Report invalid game commands or rejected answers/votes. |

## State flow

The browser sends player actions over Socket.IO; it does not decide phases, scores, accepted submissions, or vote validity. `server.js` routes each action to `roomManager.js` or `gameManager.js`. Those modules mutate the in-memory room and enforce the rules. The server then broadcasts a deliberately limited public lobby snapshot and a personalized game snapshot to every connected room member.

The phases are `LOBBY` → `PROMPT` → `ANSWERING` → `VOTING` → `RESULTS` → (`PROMPT` for another round, or `GAME_OVER`). `PROMPT` displays the prompt briefly before answers open. In player-prompt mode, contributions happen while the room remains in `LOBBY`; the game starts only after every connected player has submitted three.

Room IDs use random Socket.IO connection IDs for this local MVP. There is no account system or reconnect identity; a disconnected player remains in the room roster, and refreshing/reconnecting joins as a new player if the lobby is still open.
