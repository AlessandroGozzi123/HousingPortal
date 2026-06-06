# Hypixel Housing Portal & Archive 🚀

A premium web application designed to monitor and archive active public housings on the **Hypixel** Minecraft server. The application features a fully responsive, pixel-perfect layout inspired by the classic Minecraft UI, complete with glowing ambient backdrops, custom status indicators, and web-synthesized game sound effects.

## Features ✨

* **Permanent Offline Archiving**: Whenever a housing room categorized under **2Player/Co-op**, **Adventure**, or **Escape/Puzzle** is detected online, the backend archives its session details. If the owner takes the housing offline, the card remains visible on the portal marked as `OFFLINE`, keeping a history of your favorite maps. The command box `/visit ownername` remains fully functional for clipboard copies.
* **Automated Category Mapping**: Filters housings dynamically by parsing Minecraft color codes and scanning names for keywords (e.g., Parkour, PvP, Escape/Puzzle, Adventure, Hangout).
* **Secure API Key Handling**: The Hypixel API key is held securely on the server-side (Node.js/PHP). No API credentials are coded inside the client-side JavaScript (`script.js`), preventing unauthorized access via browser inspection tools (F12).
* **High-Speed UUID Resolution & Caching**: Converts player UUIDs to real Minecraft usernames. Resolved names are cached locally inside `username_cache.json` to bypass Mojang API rate-limiting and deliver sub-20ms page load speeds.
* **In-Game Sound Synthesis**: Uses the HTML5 Web Audio API to synthesize classic game sounds natively (wooden button clicks, level-up fanfares for visit copies, XP orb chimes for bookmarked items) without downloading heavy external audio files. Includes a global mute switch.
* **Favorites System**: Bookmark active public sessions using the star toggle. Bookmarks are saved persistently to the browser's `localStorage` and display in a dedicated carousel.

## Dual-Backend Architecture (Node.js & PHP) 🛠️

To keep hosting 100% free and persistent, the project supports a dual-mode proxy system:
1. **Local Development (Node.js)**: Launching `server.js` serves files on `http://localhost:3000` and proxies the Hypixel API for fast local iteration.
2. **Production Hosting (PHP)**: The `api.php` script translates the server logic to run on traditional shared PHP hosting (like **InfinityFree**). Because shared hosts write directly to persistent disks (unlike Render's sleeping containers which wipe local files), your archived housings and username cache will remain saved permanently and for free.

## Quick Start 🚀

### Running Locally (Node.js)
1. Add your Hypixel API key to the `API_KEY` constant in `server.js`.
2. Run the server using Node:
   ```bash
   node server.js
   ```
3. Open `http://localhost:3000` in your web browser.

### Deploying Online (InfinityFree)
1. Add your Hypixel API key to the `$apiKey` variable in `api.php`.
2. Connect to your web hosting account via any FTP client (e.g., FileZilla).
3. Upload the files `index.html`, `style.css`, `script.js`, `api.php`, and the `img/` folder into the remote `htdocs` directory.
4. Open your hosting domain. The frontend automatically detects the production environment and routes requests securely through the PHP backend.
