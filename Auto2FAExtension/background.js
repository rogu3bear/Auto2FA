import { ErrorTypes, showErrorInPopup, parseNativeError } from './errorHandler.js';

const NATIVE_APP_NAME = "com.auchdev.Auto2FA.XPCHelper"; // Matches Info.plist & XPC key
let nativePort = null;
let domainMappings = []; // In-memory cache of mappings
let accountsCache = []; // Optional: Cache basic account info if needed for selector

// --- Native App Connection ---

function connectToNativeApp() {
    console.log("Attempting to connect to native app:", NATIVE_APP_NAME);
    try {
        nativePort = browser.runtime.connectNative(NATIVE_APP_NAME);
        console.log("Native port connected (or connection attempt initiated).");

        nativePort.onMessage.addListener((message) => {
            console.log("Received message FROM native app:", message);
            handleNativeMessage(message);
        });

        nativePort.onDisconnect.addListener(() => {
            console.error("Native port disconnected.", browser.runtime.lastError?.message || "No error details");
            nativePort = null;
            showErrorInPopup(ErrorTypes.CONNECTION_LOST);
            // Optional: Implement retry logic
            // setTimeout(connectToNativeApp, 5000); // Retry after 5 seconds
        });
        
        // Initial fetch of mappings after connection
        fetchAllMappingsFromNativeApp();

    } catch (error) {
        console.error("Error connecting to native app:", error);
        nativePort = null;
        showErrorInPopup(ErrorTypes.CONNECTION_LOST);
    }
}

function ensureNativeConnection(callback) {
    if (nativePort) {
        callback(nativePort);
    } else {
        console.log("Native port not connected. Attempting reconnection...");
        connectToNativeApp();
        // Wait a short time for connection before trying callback
        setTimeout(() => {
            if (nativePort) {
                callback(nativePort);
            } else {
                console.error("Failed to establish native connection after retry.");
                // Handle failure - maybe notify content script?
            }
        }, 1000); // Adjust delay as needed
    }
}

// --- Mapping Management ---

function fetchAllMappingsFromNativeApp() {
    ensureNativeConnection(port => {
        console.log("Sending 'getAllMappings' request to native app.");
        port.postMessage({ command: "getAllMappings" }); // Use a command structure
    });
    // Need to handle the response in nativePort.onMessage
    // For now, let's assume it updates `domainMappings` directly or via storage
    // We'll refine this later based on actual XPC response handling
}

async function loadMappingsFromStorage() {
    try {
        const data = await browser.storage.local.get('domainMappingsCache');
        if (data.domainMappingsCache) {
            domainMappings = data.domainMappingsCache;
            console.log(`Loaded ${domainMappings.length} mappings from local storage cache.`);
        } else {
            console.log("No mappings found in local storage cache.");
            // Optionally trigger a fetch if cache is empty
             fetchAllMappingsFromNativeApp(); 
        }
    } catch (error) {
        console.error("Error loading mappings from storage:", error);
    }
}

async function saveMappingsToStorage(mappings) {
    try {
        await browser.storage.local.set({ domainMappingsCache: mappings });
        console.log(`Saved ${mappings.length} mappings to local storage cache.`);
    } catch (error) {
        console.error("Error saving mappings to storage:", error);
    }
}

// Update mappings cache and save to storage
function updateMappingsCache(newMappings) {
    if (Array.isArray(newMappings)) {
        domainMappings = newMappings;
        saveMappingsToStorage(domainMappings); // Persist the update
    } else {
        console.error("updateMappingsCache received invalid data:", newMappings);
    }
}

// --- Domain Matching (JavaScript version) ---

function convertWildcardToRegex(pattern) {
    // Escape regex special characters, then replace wildcard * with .*
    const escaped = pattern.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&\'); // Escape most specials
    const regexString = escaped.replace(/\\\\\\*/g, '.*'); // Replace escaped * with .* 
    return new RegExp(`^${regexString}$`, 'i'); // Anchor and case-insensitive
}

function findMatchingMappings(domain) {
    const targetDomain = domain.toLowerCase();
    console.log(`Background: Searching mappings for domain: ${targetDomain}`);
    const matches = domainMappings.filter(mapping => {
        try {
            const regex = convertWildcardToRegex(mapping.domain);
            return regex.test(targetDomain);
        } catch (e) {
            console.error(`Error creating/testing regex for pattern: ${mapping.domain}`, e);
            return false;
        }
    });
    console.log(`Background: Found ${matches.length} matches.`);
    // TODO: Add sorting logic if desired (e.g., more specific patterns first)
    // matches.sort((a, b) => b.domain.length - a.domain.length);
    return matches;
}

// --- Account Selection UI --- 

function showAccountSelector(candidateMappings, tabId, frameId) {
    console.log(`Background: Showing account selector for tab ${tabId}, frame ${frameId}`);
    // Prepare data for the selector UI
    const accountsToShow = candidateMappings.map(m => ({ 
        id: m.accountId, 
        name: m.accountName // Pass name for display
        // Add username if needed: username: accountsCache.find(a => a.id === m.accountId)?.username ?? 'N/A' 
    }));
    
    // Store candidate accounts temporarily for the selector page to access
    browser.storage.local.set({ [`selectorCandidates_${tabId}_${frameId}`]: accountsToShow }, () => {
         if (browser.runtime.lastError) {
             console.error("Error storing selector candidates:", browser.runtime.lastError);
             // Handle error - maybe inform content script?
             return;
         }
        
        // Open the selector UI page (e.g., in a new small window or tab)
        // We need to pass tabId and frameId so the selector knows where to send the result
        const selectorUrl = browser.runtime.getURL(`selector.html?tabId=${tabId}&frameId=${frameId}`);
        browser.windows.create({
            url: selectorUrl,
            type: 'popup',
            width: 350,
            height: 400
        });
         console.log("Background: Opened selector window.");
    });
}

// --- Message Handling (from Content Script & Selector UI) ---

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background received message:", request, "from sender:", sender);

    if (request.command === "getAccountForDomain") {
        const domain = request.domain;
        const tabId = sender.tab?.id;
        const frameId = sender.frameId;
        
        if (!domain || tabId === undefined || frameId === undefined) {
            console.error("Background: Invalid getAccountForDomain request", request, sender);
            showErrorInPopup(ErrorTypes.UNHANDLED_ERROR, "Invalid request parameters");
            sendResponse({ error: "Invalid request parameters" });
            return true;
        }

        const matchingMappings = findMatchingMappings(domain);

        if (matchingMappings.length === 1) {
            console.log(`Background: Found single match for ${domain}:`, matchingMappings[0]);
            sendResponse({ accountMapping: matchingMappings[0] });
        } else if (matchingMappings.length === 0) {
            console.log(`Background: No matches found for ${domain}`);
            showErrorInPopup(ErrorTypes.NO_MAPPING_FOUND);
            sendResponse({ needsSelection: true, candidates: [] });
        } else {
            console.log(`Background: Found ${matchingMappings.length} matches for ${domain}. Triggering selector.`);
            showAccountSelector(matchingMappings, tabId, frameId);
            sendResponse({ needsSelection: true });
        }
        return true;

    } else if (request.command === "accountSelected") {
        const { selectedAccountId, tabId, frameId } = request;
        console.log(`Background: Account ${selectedAccountId} selected for tab ${tabId}, frame ${frameId}`);
        if (selectedAccountId && tabId !== undefined && frameId !== undefined) {
            const selectedMapping = domainMappings.find(m => m.accountId === selectedAccountId);
            if (selectedMapping) {
                browser.tabs.sendMessage(tabId, { 
                    command: "useSelectedAccount", 
                    accountMapping: selectedMapping 
                }, { frameId: frameId });
            } else {
                console.error("Background: Could not find mapping details for selected account ID:", selectedAccountId);
                showErrorInPopup(ErrorTypes.UNHANDLED_ERROR, "Selected account not found");
            }
        } else {
            console.error("Background: Invalid accountSelected message", request);
            showErrorInPopup(ErrorTypes.UNHANDLED_ERROR, "Invalid account selection");
        }
    } else if (request.command === "fetchMappings") {
         // Allow content script or popup to trigger a manual refresh
         console.log("Background: Manual mapping fetch requested.");
         fetchAllMappingsFromNativeApp();
         sendResponse({ status: "Fetching initiated"}); // Acknowledge
         return false; // Synchronous response ok here
    }

    // Default: Indicate async response if unsure, or return false if handled synchronously
     // return true; 
});

// --- Native Port Message Handling ---
// Need to properly integrate this with the above logic
function handleNativeMessage(message) {
    console.log("Handling message FROM native app:", message);
    if (message && message.response === "allMappings") {
        if (message.data) {
            try {
                const decodedMappings = JSON.parse(message.data);
                console.log(`Background: Received ${decodedMappings.length} mappings from native app.`);
                updateMappingsCache(decodedMappings);
            } catch (e) {
                console.error("Background: Error parsing mappings data from native app:", e);
                showErrorInPopup(ErrorTypes.UNHANDLED_ERROR, "Failed to parse domain mappings from app");
            }
        } else if (message.error) {
            console.error("Background: Native app reported error fetching mappings:", message.error);
            const errorType = parseNativeError(message.error);
            showErrorInPopup(errorType);
        } else {
             console.warn("Background: Received mappings response from native app, but no data or error found.", message);
        }
    } else if (message && message.response === "credentials") {
        if (message.error) {
            console.error("Background: Native app reported error fetching credentials:", message.error);
            const errorType = parseNativeError(message.error);
            showErrorInPopup(errorType);
        }
        // TODO: Handle credential responses (likely route back to content script)
         console.log("Background: Received credentials (TODO: handle)", message);
     } 
     // Add handlers for other response types
}

// Modify the nativePort listener to use the handler
nativePort?.onMessage.addListener(handleNativeMessage);

// --- Initialization ---
console.log("Background script started.");
connectToNativeApp(); // Initial connection attempt
loadMappingsFromStorage(); // Load mappings from cache on startup

// Optional: Periodically refresh mappings from native app
// setInterval(fetchAllMappingsFromNativeApp, 15 * 60 * 1000); // Refresh every 15 minutes 