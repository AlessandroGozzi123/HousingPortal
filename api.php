<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");

$apiKey = "";
$hypixelUrl = "https://api.hypixel.net/v2/housing/active?key=" . $apiKey;

$cacheFile = 'username_cache.json';
$archiveFile = 'archived_houses.json';

// Load username cache from disk
$usernameCache = array();
if (file_exists($cacheFile)) {
    $cacheData = file_get_contents($cacheFile);
    if ($cacheData) {
        $decoded = json_decode($cacheData, true);
        if (is_array($decoded)) {
            $usernameCache = $decoded;
        }
    }
}

// Save username cache helper
function saveCache($cache) {
    global $cacheFile;
    $fp = fopen($cacheFile, 'w');
    if ($fp) {
        if (flock($fp, LOCK_EX)) {
            fwrite($fp, json_encode($cache, JSON_PRETTY_PRINT));
            fflush($fp);
            flock($fp, LOCK_UN);
        }
        fclose($fp);
    }
}

// Load archived houses from disk
$archivedHouses = array();
if (file_exists($archiveFile)) {
    $archiveData = file_get_contents($archiveFile);
    if ($archiveData) {
        $decoded = json_decode($archiveData, true);
        if (is_array($decoded)) {
            $archivedHouses = $decoded;
        }
    }
}

// Save archived houses helper
function saveArchive($archive) {
    global $archiveFile;
    $fp = fopen($archiveFile, 'w');
    if ($fp) {
        if (flock($fp, LOCK_EX)) {
            fwrite($fp, json_encode($archive, JSON_PRETTY_PRINT));
            fflush($fp);
            flock($fp, LOCK_UN);
        }
        fclose($fp);
    }
}

// Helper to strip color codes
function stripColorCodes($text) {
    if (!$text) return '';
    return preg_replace('/[&§][0-9a-fk-or]/i', '', $text);
}

// Determine backend category
function getBackendCategory($name) {
    if (!$name) return null;
    $cleanName = strtolower(stripColorCodes($name));
    
    if (strpos($cleanName, '2p') !== false || 
        strpos($cleanName, '3p') !== false || 
        strpos($cleanName, 'coop') !== false || 
        strpos($cleanName, 'co-op') !== false || 
        strpos($cleanName, '2player') !== false || 
        strpos($cleanName, '2 player') !== false) {
        return '2player';
    }
    
    if (strpos($cleanName, 'adventure') !== false || strpos($cleanName, 'story') !== false) {
        return 'adventure';
    }
    
    if (strpos($cleanName, 'escape') !== false || strpos($cleanName, 'puzzle') !== false) {
        return 'escape';
    }
    
    return null;
}

// Fetch URL content with cURL (includes timeouts & custom user-agent)
function fetchUrl($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    curl_setopt($ch, CURLOPT_TIMEOUT, 2);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // compatibility fallback for old SSL bundles on cheap shared hosts
    $output = curl_exec($ch);
    curl_close($ch);
    return $output;
}

// Fetch UUID from Ashcon v2 API
function lookupUsernameAshcon($cleanUuid) {
    $url = "https://api.ashcon.app/mojang/v2/user/" . $cleanUuid;
    $response = fetchUrl($url);
    if ($response) {
        $parsed = json_decode($response, true);
        if (isset($parsed['username'])) {
            return $parsed['username'];
        }
    }
    return null;
}

// Resolve single Minecraft username (with local cache and external fallback)
function lookupUsername($uuid, &$usernameCache) {
    if (!$uuid) return null;
    $cleanUuid = strtolower(str_replace('-', '', $uuid));
    
    if (isset($usernameCache[$cleanUuid])) {
        return $usernameCache[$cleanUuid];
    }
    
    // Query PlayerDB
    $url = "https://playerdb.co/api/player/minecraft/" . $cleanUuid;
    $response = fetchUrl($url);
    if ($response) {
        $parsed = json_decode($response, true);
        if (isset($parsed['success']) && $parsed['success'] && isset($parsed['data']['player']['username'])) {
            $username = $parsed['data']['player']['username'];
            $usernameCache[$cleanUuid] = $username;
            saveCache($usernameCache);
            return $username;
        }
    }
    
    // Fallback to Ashcon
    $username = lookupUsernameAshcon($cleanUuid);
    if ($username) {
        $usernameCache[$cleanUuid] = $username;
        saveCache($usernameCache);
        return $username;
    }
    
    return null;
}

// Fetch active housing data from Hypixel
$rawDataRaw = fetchUrl($hypixelUrl);
if (!$rawDataRaw) {
    http_response_code(500);
    echo json_encode(array("success" => false, "cause" => "Failed to fetch from Hypixel API"));
    exit;
}

$rawData = json_decode($rawDataRaw, true);
$sessionsList = array();

if (is_array($rawData)) {
    if (isset($rawData[0])) {
        $sessionsList = $rawData;
    } else {
        $arrayFields = array('active', 'sessions', 'houses', 'data', 'body');
        foreach ($arrayFields as $field) {
            if (isset($rawData[$field]) && is_array($rawData[$field])) {
                $sessionsList = $rawData[$field];
                break;
            }
        }
    }
}

// Collect unique owners that need resolution
$uniqueOwners = array();
foreach ($sessionsList as $h) {
    if (isset($h['owner']) && $h['owner']) {
        $uniqueOwners[] = $h['owner'];
    }
}
$uniqueOwners = array_values(array_unique($uniqueOwners));

// Resolve owners that are not already cached
foreach ($uniqueOwners as $ownerUuid) {
    $cleanUuid = strtolower(str_replace('-', '', $ownerUuid));
    if (!isset($usernameCache[$cleanUuid])) {
        lookupUsername($ownerUuid, $usernameCache);
    }
}

// Enrich session lists with owner names
$enrichedSessions = array();
foreach ($sessionsList as $h) {
    if (!isset($h['owner']) || !$h['owner']) {
        $h['ownerName'] = 'Unknown';
    } else {
        $cleanUuid = strtolower(str_replace('-', '', $h['owner']));
        $h['ownerName'] = isset($usernameCache[$cleanUuid]) ? $usernameCache[$cleanUuid] : (substr($h['owner'], 0, 8) . '...');
    }
    $enrichedSessions[] = $h;
}

// Scan and update the archive with co-op, adventure, and escape maps
$archiveUpdated = false;
foreach ($enrichedSessions as $h) {
    $cat = getBackendCategory(isset($h['name']) ? $h['name'] : '');
    if ($cat) {
        $cleanName = trim(strtolower(stripColorCodes(isset($h['name']) ? $h['name'] : '')));
        $cleanOwner = isset($h['owner']) ? strtolower(str_replace('-', '', $h['owner'])) : '';
        
        $existingIndex = -1;
        foreach ($archivedHouses as $idx => $arch) {
            $archCleanName = trim(strtolower(stripColorCodes(isset($arch['name']) ? $arch['name'] : '')));
            $archCleanOwner = isset($arch['owner']) ? strtolower(str_replace('-', '', $arch['owner'])) : '';
            if ($archCleanOwner === $cleanOwner && $archCleanName === $cleanName) {
                $existingIndex = $idx;
                break;
            }
        }
        
        $houseData = array(
            'name' => isset($h['name']) ? $h['name'] : '',
            'owner' => isset($h['owner']) ? $h['owner'] : '',
            'ownerName' => $h['ownerName'],
            'category' => $cat,
            'cookies' => isset($h['cookies']) ? $h['cookies'] : array('current' => 0),
            'lastSeen' => round(microtime(true) * 1000)
        );
        
        if ($existingIndex !== -1) {
            $archivedHouses[$existingIndex] = $houseData;
        } else {
            $archivedHouses[] = $houseData;
        }
        $archiveUpdated = true;
    }
}

if ($archiveUpdated) {
    saveArchive($archivedHouses);
}

// Build merged output response list
$responseList = array();
foreach ($enrichedSessions as $h) {
    $h['online'] = true;
    $responseList[] = $h;
}

// Find offline archived sessions
$offlineArchived = array();
foreach ($archivedHouses as $arch) {
    $archCleanName = trim(strtolower(stripColorCodes(isset($arch['name']) ? $arch['name'] : '')));
    $archCleanOwner = isset($arch['owner']) ? strtolower(str_replace('-', '', $arch['owner'])) : '';
    
    $isOnline = false;
    foreach ($enrichedSessions as $onlineHouse) {
        $onlineCleanName = trim(strtolower(stripColorCodes(isset($onlineHouse['name']) ? $onlineHouse['name'] : '')));
        $onlineCleanOwner = isset($onlineHouse['owner']) ? strtolower(str_replace('-', '', $onlineHouse['owner'])) : '';
        if ($onlineCleanOwner === $archCleanOwner && $onlineCleanName === $archCleanName) {
            $isOnline = true;
            break;
        }
    }
    
    if (!$isOnline) {
        $offlineArchived[] = array(
            'name' => isset($arch['name']) ? $arch['name'] : '',
            'owner' => isset($arch['owner']) ? $arch['owner'] : '',
            'ownerName' => $arch['ownerName'],
            'category' => $arch['category'],
            'cookies' => isset($arch['cookies']) ? $arch['cookies'] : array('current' => 0),
            'players' => 0,
            'online' => false,
            'createdAt' => $arch['lastSeen']
        );
    }
}

$mergedSessions = array_merge($responseList, $offlineArchived);
echo json_encode($mergedSessions);
?>
