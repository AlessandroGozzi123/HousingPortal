<img width="1842" height="903" alt="Snímek obrazovky 2026-05-28 202059" src="https://github.com/user-attachments/assets/f56fabea-58de-41c1-9f3d-c649b658969e" />

# Hypixel Housing Portal & Archive 🚀

A web application designed to monitor and archive housings on the **Hypixel** Minecraft server. The application features a responsive layout inspired by the classic Minecraft UI.

## Features ✨

* **Permanent Offline Archiving**: Replayable houses like Escape/Parkour are permanently stored in a JSON file.
* **Automated Category Mapping**: Filters housings  by parsing Minecraft color codes and scanning names for keywords (e.g., Parkour, PvP, Escape/Puzzle, Adventure, Hangout).
* **Secure API Key Handling**: The Hypixel API key is held securely on the server-side.
* **High-Speed UUID Resolution & Caching**: Converts player UUIDs to Minecraft usernames. Resolved names are cached locally inside `username_cache.json` to bypass Mojang API rate-limiting and deliver sub-20ms page load speeds.
* **In-Game Sound Synthesis**: Uses the HTML5 Web Audio API to synthesize classic game sounds natively (wooden button clicks, level-up fanfares for visit copies, XP orb chimes for bookmarked items) without downloading heavy external audio files. Includes a mute switch.
* **Favorites System**: Bookmark active public sessions using the star toggle. Bookmarks are saved persistently to the browser's `localStorage` and display in a dedicated carousel.

## Dual-Backend Architecture (Node.js & PHP) 🛠️

To keep hosting free there are two ways to call the API.
1. **Local Development (Node.js)**: Launching locally on Node uses the `server.js` script.
2. **Production Hosting (PHP)**: Once the webpage is deployed on a provider API gets called with `api.php` in order for it to work on free hostings that don't allow Node.js.

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
2. Connect to your web hosting account via any FTP client.
3. Upload the files.
