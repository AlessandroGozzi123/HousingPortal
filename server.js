const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = 3000;
const API_KEY = "";
const HYPIXEL_URL = "https://api.hypixel.net/v2/housing/active";

// Helper to content types
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

const CACHE_FILE = path.join(__dirname, 'username_cache.json');
let usernameCache = {};

// Load cache from disk
try {
    if (fs.existsSync(CACHE_FILE)) {
        usernameCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        console.log(`Loaded ${Object.keys(usernameCache).length} usernames from cache.`);
    }
} catch (e) {
    console.error('Failed to load username cache:', e);
}

// Helper to save cache
function saveCache() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(usernameCache, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save username cache:', e);
    }
}

const ARCHIVE_FILE = path.join(__dirname, 'archived_houses.json');
let archivedHouses = [];

// Load archived houses from disk
try {
    if (fs.existsSync(ARCHIVE_FILE)) {
        archivedHouses = JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf8'));
        console.log(`Loaded ${archivedHouses.length} archived houses from disk.`);
    }
} catch (e) {
    console.error('Failed to load archived houses:', e);
}

// Save archived houses to disk
function saveArchive() {
    try {
        fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(archivedHouses, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save archived houses:', e);
    }
}

// Strip color codes for backend categorization keyword search
function stripColorCodes(text) {
    if (!text) return '';
    return text.replace(/[&§][0-9a-fk-or]/gi, '');
}

// Determine if a house name belongs to one of the archived categories
function getBackendCategory(name) {
    if (!name) return null;
    const cleanName = stripColorCodes(name).toLowerCase();
    
    if (cleanName.includes('2p') || 
        cleanName.includes('3p') || 
        cleanName.includes('coop') || 
        cleanName.includes('co-op') || 
        cleanName.includes('2player') || 
        cleanName.includes('2 player')) {
        return '2player';
    }
    
    if (cleanName.includes('adventure') || cleanName.includes('story')) {
        return 'adventure';
    }
    
    if (cleanName.includes('escape') || cleanName.includes('puzzle')) {
        return 'escape';
    }
    
    return null;
}

// Lookup single player name (caching, PlayerDB lookup, Ashcon fallback)
function lookupUsername(uuid) {
    if (!uuid) return Promise.resolve(null);
    const cleanUuid = uuid.replace(/-/g, '').toLowerCase();
    
    if (usernameCache[cleanUuid]) {
        return Promise.resolve(usernameCache[cleanUuid]);
    }
    
    return new Promise((resolve) => {
        const url = `https://playerdb.co/api/player/minecraft/${cleanUuid}`;
        
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.success && parsed.data && parsed.data.player) {
                        const username = parsed.data.player.username;
                        usernameCache[cleanUuid] = username;
                        saveCache();
                        console.log(`[Cache Update] Resolved ${cleanUuid} to ${username}`);
                        resolve(username);
                        return;
                    }
                } catch (e) {}
                
                // Fallback to Ashcon API
                lookupUsernameAshcon(cleanUuid).then(resolve);
            });
        });
        
        req.on('error', () => {
            lookupUsernameAshcon(cleanUuid).then(resolve);
        });
        
        req.setTimeout(2000, () => {
            req.destroy();
            lookupUsernameAshcon(cleanUuid).then(resolve);
        });
    });
}

function lookupUsernameAshcon(cleanUuid) {
    return new Promise((resolve) => {
        const url = `https://api.ashcon.app/mojang/v2/user/${cleanUuid}`;
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.username) {
                        const username = parsed.username;
                        usernameCache[cleanUuid] = username;
                        saveCache();
                        console.log(`[Cache Update] Resolved ${cleanUuid} to ${username} (Ashcon)`);
                        resolve(username);
                        return;
                    }
                } catch (e) {}
                resolve(null);
            });
        });
        
        req.on('error', () => {
            resolve(null);
        });
        
        req.setTimeout(2000, () => {
            req.destroy();
            resolve(null);
        });
    });
}

// Concurrency-limited processing
async function resolveAllOwners(owners) {
    const limit = 5;
    for (let i = 0; i < owners.length; i += limit) {
        const chunk = owners.slice(i, i + limit);
        await Promise.all(chunk.map(owner => lookupUsername(owner)));
    }
}

const server = http.createServer((req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    // Route: Proxy for Hypixel API
    if (req.url.startsWith('/api/active-housing')) {
        const targetUrl = `${HYPIXEL_URL}?key=${API_KEY}`;
        
        https.get(targetUrl, (apiRes) => {
            let body = '';
            
            apiRes.on('data', (chunk) => {
                body += chunk;
            });
            
            apiRes.on('end', async () => {
                try {
                    const rawData = JSON.parse(body);
                    
                    let sessionsList = [];
                    if (Array.isArray(rawData)) {
                        sessionsList = rawData;
                    } else if (typeof rawData === 'object' && rawData !== null) {
                        const arrayFields = ['active', 'sessions', 'houses', 'data', 'body'];
                        for (const field of arrayFields) {
                            if (Array.isArray(rawData[field])) {
                                sessionsList = rawData[field];
                                break;
                            }
                        }
                    }
                    
                    const owners = [...new Set(sessionsList.map(h => h.owner).filter(Boolean))];
                    if (owners.length > 0) {
                        console.log(`Resolving ${owners.length} owner usernames for active houses...`);
                        await resolveAllOwners(owners);
                    }
                    
                    const enrichedSessions = sessionsList.map(h => {
                        if (!h.owner) return { ...h, ownerName: 'Unknown' };
                        const cleanUuid = h.owner.replace(/-/g, '').toLowerCase();
                        return {
                            ...h,
                            ownerName: usernameCache[cleanUuid] || h.owner.substring(0, 8) + '...'
                        };
                    });
                    
                    // Scan and update the archive with co-op, adventure, and escape maps
                    let archiveUpdated = false;
                    enrichedSessions.forEach(h => {
                        const cat = getBackendCategory(h.name);
                        if (cat) {
                            const cleanName = stripColorCodes(h.name || '').toLowerCase().trim();
                            const cleanOwner = h.owner ? h.owner.replace(/-/g, '').toLowerCase() : '';
                            
                            const existingIndex = archivedHouses.findIndex(arch => {
                                const archCleanName = stripColorCodes(arch.name || '').toLowerCase().trim();
                                const archCleanOwner = arch.owner ? arch.owner.replace(/-/g, '').toLowerCase() : '';
                                return archCleanOwner === cleanOwner && archCleanName === cleanName;
                            });
                            
                            const houseData = {
                                name: h.name,
                                owner: h.owner,
                                ownerName: h.ownerName,
                                category: cat,
                                cookies: h.cookies,
                                lastSeen: Date.now()
                            };
                            
                            if (existingIndex !== -1) {
                                archivedHouses[existingIndex] = houseData;
                            } else {
                                archivedHouses.push(houseData);
                            }
                            archiveUpdated = true;
                        }
                    });
                    
                    if (archiveUpdated) {
                        saveArchive();
                    }
                    
                    // Construct online list
                    const responseList = enrichedSessions.map(h => ({
                        ...h,
                        online: true
                    }));
                    
                    // Find archived houses that are NOT in the active response list
                    const offlineArchived = archivedHouses.filter(arch => {
                        const archCleanName = stripColorCodes(arch.name || '').toLowerCase().trim();
                        const archCleanOwner = arch.owner ? arch.owner.replace(/-/g, '').toLowerCase() : '';
                        
                        return !enrichedSessions.some(onlineHouse => {
                            const onlineCleanName = stripColorCodes(onlineHouse.name || '').toLowerCase().trim();
                            const onlineCleanOwner = onlineHouse.owner ? onlineHouse.owner.replace(/-/g, '').toLowerCase() : '';
                            return onlineCleanOwner === archCleanOwner && onlineCleanName === archCleanName;
                        });
                    }).map(arch => ({
                        name: arch.name,
                        owner: arch.owner,
                        ownerName: arch.ownerName,
                        category: arch.category,
                        cookies: arch.cookies,
                        players: 0,
                        online: false,
                        createdAt: arch.lastSeen
                    }));
                    
                    const mergedSessions = [...responseList, ...offlineArchived];
                    
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify(mergedSessions));
                } catch (e) {
                    console.error('Enrichment error:', e);
                    res.writeHead(500, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ success: false, cause: 'Internal Enrichment Error: ' + e.message }));
                }
            });
        }).on('error', (err) => {
            console.error('Proxy request error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, cause: 'Failed to fetch from Hypixel API: ' + err.message }));
        });
        
        return;
    }

    // Default: Static File Serving
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    
    // Safety check: ensure file path stays within current directory
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Access Forbidden');
        return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`Hypixel Housing Monitor Server running successfully!`);
    console.log(`Local Access URL: http://localhost:${PORT}`);
    console.log(`API Proxy Route:  http://localhost:${PORT}/api/active-housing`);
    console.log(`==================================================`);

    // Automatically open in default browser on Windows
    if (process.platform === 'win32') {
        require('child_process').exec(`start http://localhost:${PORT}`);
    }
});
