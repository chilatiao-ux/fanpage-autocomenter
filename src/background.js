// Service Worker - Maneja la navegación y orquesta la automatización

console.log("✅ Background service worker cargado");

// ==========================================================
// 🔌 PORT KEEP-ALIVE & OFFSCREEN
// ==========================================================
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'keepAlive') {
        port.onDisconnect.addListener(() => {});
    }
});

async function ensureOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL('src/dashboard.html')] 
    });
    if (existingContexts.length > 0) return;
    await chrome.offscreen.createDocument({
        url: 'src/dashboard.html',
        reasons: ['WORKERS'],
        justification: 'Mantener Service Worker activo'
    });
}
ensureOffscreenDocument();
// ==========================================================

let automationState = {
    isRunning: false,
    config: null,
    currentPageIndex: 0,
    currentPhotoIndex: 0,
    commentedCount: 0,
    tabId: null,
    windowId: null, // NUEVO: Guarda el ID de la ventanita Popup
    pageLoadTimeout: null,
    consecutiveFailures: 0,
    maxConsecutiveFailures: 1,
    lastActivityTime: null,
    watchdogInterval: null
};

// ==========================================================
// 🛑 DETECTAR CIERRE DE VENTANA: Si cierran el Popup, se detiene
// ==========================================================
chrome.windows.onRemoved.addListener((closedWindowId) => {
    if (automationState.isRunning && automationState.windowId === closedWindowId) {
        console.log("🛑 Ventana Popup cerrada. Deteniendo automatización automáticamente...");
        automationState.isRunning = false;
        
        if (automationState.pageLoadTimeout) clearTimeout(automationState.pageLoadTimeout);
        if (automationState.watchdogInterval) { clearInterval(automationState.watchdogInterval); automationState.watchdogInterval = null; }
        
        chrome.storage.local.set({ 
            status: { 
                isRunning: false, 
                commentedCount: automationState.commentedCount, 
                lastUpdate: new Date().toLocaleTimeString(),
                reason: "Ventana cerrada manualmente" 
            },
            automationWindowId: null
        });
    }
});
// ==========================================================

// ==========================================================
// 💾 GUARDAR PROGRESO
// ==========================================================
function saveAutomationProgress() {
    chrome.storage.local.set({
        automationProgress: {
            currentPageIndex: automationState.currentPageIndex,
            currentPhotoIndex: automationState.currentPhotoIndex,
            commentedCount: automationState.commentedCount
        }
    });
}
// ==========================================================

// ==========================================================
// 🧟‍♂️ AUTO-REANIMACIÓN AGRESIVA
// ==========================================================
async function autoResumeAfterRestart() {
    const result = await chrome.storage.local.get(['status', 'automationConfig', 'automationWindowId']);
    if (result.status?.isRunning && result.automationConfig) {
        console.log("🧟‍♂️ Service Worker reviviendo... forzando reanudación.");
        automationState.isRunning = true;
        automationState.config = result.automationConfig;
        automationState.windowId = result.automationWindowId; // Recuperar ID de ventana
        
        const progress = await chrome.storage.local.get(['automationProgress']);
        if (progress.automationProgress) {
            automationState.currentPageIndex = progress.automationProgress.currentPageIndex;
            automationState.currentPhotoIndex = progress.automationProgress.currentPhotoIndex;
            automationState.commentedCount = progress.automationProgress.commentedCount;
        }
        
        const tabs = await chrome.tabs.query({ url: "*://www.facebook.com/*" });
        if (tabs.length > 0) {
            automationState.tabId = tabs[0].id;
            automationState.lastActivityTime = Date.now();
            startWatchdog();
            console.log("🚀 Forzando navegación para recuperar el hilo...");
            navigateToNextPage(); 
        } else {
            automationState.isRunning = false;
            chrome.storage.local.set({ status: { isRunning: false }});
        }
    }
}
autoResumeAfterRestart();
// ==========================================================

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install" || details.reason === "update") {
        chrome.tabs.create({ url: chrome.runtime.getURL("src/dashboard.html") });
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/dashboard.html") });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!automationState.isRunning || tabId !== automationState.tabId) return;
    
    if (changeInfo.status === "complete" && tab.url && tab.url.includes("/photos/")) {
        console.log("✅ Página de fotos cargada");
        automationState.lastActivityTime = Date.now();
        
        setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
                action: "commentOnCurrentPhoto",
                config: automationState.config
            }, (response) => {
                automationState.lastActivityTime = Date.now();
                
                if (chrome.runtime.lastError) {
                    setTimeout(() => { navigateToNextPhoto(); }, 2000);
                } else if (response && response.success) {
                    automationState.commentedCount++;
                    console.log(`✅ Comentario ${automationState.commentedCount}`);
                    automationState.currentPhotoIndex++;
                    
                    if (automationState.currentPhotoIndex < automationState.config.postsPerPage) {
                        setTimeout(() => { navigateToNextPhoto(); }, automationState.config.delayBetweenPosts);
                    } else {
                        automationState.currentPageIndex++;
                        automationState.currentPhotoIndex = 0;
                        saveAutomationProgress();
                        setTimeout(() => { navigateToNextPage(); }, automationState.config.delayBetweenPages);
                    }
                } else if (response && !response.success) {
                    automationState.currentPageIndex++;
                    automationState.currentPhotoIndex = 0;
                    saveAutomationProgress();
                    setTimeout(() => { navigateToNextPage(); }, automationState.config.delayBetweenPages);
                }
            });
        }, 2000);
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("📨 Mensaje en background:", request.action);
    
    if (request.action === "startAutomation") {
        (async () => {
            automationState.isRunning = true;
            automationState.config = request.config;
            automationState.tabId = request.tabId || sender.tab.id;
            automationState.windowId = request.windowId; // NUEVO: Guardar ID de la ventanita
            automationState.lastActivityTime = Date.now();
            
            if (request.mode === 'new') {
                automationState.currentPageIndex = 0;
                automationState.currentPhotoIndex = 0;
                automationState.commentedCount = 0;
                
                const shuffled = [...request.config.fanPageUrls];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                automationState.config.fanPageUrls = shuffled;
                saveAutomationProgress();
            } else {
                const result = await chrome.storage.local.get(['automationProgress']);
                if (result.automationProgress) {
                    automationState.currentPageIndex = result.automationProgress.currentPageIndex;
                    automationState.currentPhotoIndex = result.automationProgress.currentPhotoIndex;
                    automationState.commentedCount = result.automationProgress.commentedCount;
                } else {
                    automationState.currentPageIndex = 0;
                    automationState.currentPhotoIndex = 0;
                    automationState.commentedCount = 0;
                }
            }
            
            chrome.storage.local.set({ 
                automationConfig: request.config,
                automationWindowId: request.windowId, // NUEVO: Guardar en storage
                status: { isRunning: true, commentedCount: automationState.commentedCount, lastUpdate: new Date().toLocaleTimeString() }
            });
            
            startWatchdog();
            sendResponse({ success: true });
            setTimeout(() => { navigateToNextPage(); }, 500);
        })();
        return true;
        
       } else if (request.action === "stopAutomation") {
        automationState.isRunning = false;
        if (automationState.pageLoadTimeout) clearTimeout(automationState.pageLoadTimeout);
        if (automationState.watchdogInterval) { clearInterval(automationState.watchdogInterval); automationState.watchdogInterval = null; }
        
        if (automationState.windowId) {
            chrome.windows.remove(automationState.windowId);
        }

        chrome.storage.local.set({ 
            status: { isRunning: false, commentedCount: automationState.commentedCount, lastUpdate: new Date().toLocaleTimeString() },
            automationWindowId: null
        });
        sendResponse({ success: true });
        return false;
        
    } else if (request.action === "skipCurrentPage") {
        if (!automationState.isRunning) { sendResponse({ success: false }); return false; }
        automationState.currentPageIndex++;
        automationState.currentPhotoIndex = 0;
        automationState.consecutiveFailures = 0;
        saveAutomationProgress();
        sendResponse({ success: true });
        setTimeout(() => { navigateToNextPage(); }, 500);
        return false;
        
    } else if (request.action === "photoCommented") {
        if (request.success) {
            automationState.commentedCount++;
            automationState.consecutiveFailures = 0;
            chrome.storage.local.set({ status: { isRunning: true, commentedCount: automationState.commentedCount, lastUpdate: new Date().toLocaleTimeString() }});
            automationState.currentPhotoIndex++;
            
            if (automationState.currentPhotoIndex < automationState.config.postsPerPage) {
                setTimeout(() => { navigateToNextPhoto(); }, automationState.config.delayBetweenPosts);
            } else {
                automationState.currentPageIndex++;
                automationState.currentPhotoIndex = 0;
                saveAutomationProgress();
                setTimeout(() => { navigateToNextPage(); }, automationState.config.delayBetweenPages);
            }
        } else {
            automationState.consecutiveFailures++;
            if (automationState.consecutiveFailures >= automationState.maxConsecutiveFailures) {
                automationState.consecutiveFailures = 0;
                automationState.currentPageIndex++;
                automationState.currentPhotoIndex = 0;
                saveAutomationProgress();
                setTimeout(() => { navigateToNextPage(); }, automationState.config.delayBetweenPages);
            } else {
                automationState.currentPhotoIndex++;
                if (automationState.currentPhotoIndex < automationState.config.postsPerPage) {
                    setTimeout(() => { navigateToNextPhoto(); }, automationState.config.delayBetweenPosts);
                } else {
                    automationState.consecutiveFailures = 0;
                    automationState.currentPageIndex++;
                    automationState.currentPhotoIndex = 0;
                    saveAutomationProgress();
                    setTimeout(() => { navigateToNextPage(); }, automationState.config.delayBetweenPages);
                }
            }
        }
        sendResponse({ success: true });
        return false;
        
    } else if (request.action === "facebookLimitationDetected") {
        chrome.tabs.update(automationState.tabId, { url: "https://www.google.com/#clear" }, () => {
            automationState.isRunning = false;
            if (automationState.watchdogInterval) { clearInterval(automationState.watchdogInterval); automationState.watchdogInterval = null; }
            chrome.storage.local.set({ status: { isRunning: false, commentedCount: automationState.commentedCount, lastUpdate: new Date().toLocaleTimeString(), reason: "Limitación de Facebook detectada" }});
        });
        sendResponse({ success: true });
        return false;
        
    } else if (request.action === "anotherProfileDetected") {
        if (!automationState.config?.backupFanPageUrl) { automationState.isRunning = false; sendResponse({ success: false }); return false; }
        const backupPhotosUrl = convertToPhotosUrl(automationState.config.backupFanPageUrl);
        chrome.tabs.update(automationState.tabId, { url: backupPhotosUrl }, () => {
            setTimeout(() => {
                chrome.tabs.sendMessage(automationState.tabId, { action: "followFanPage" }, (response) => {
                    if (!chrome.runtime.lastError) automationState.lastActivityTime = Date.now();
                });
            }, 3000);
        });
        sendResponse({ success: true });
        return false;
        
    } else if (request.action === "getStatus") {
        sendResponse({ isRunning: automationState.isRunning, commentedCount: automationState.commentedCount, currentPage: automationState.currentPageIndex + 1, totalPages: automationState.config?.fanPageUrls?.length || 0 });
        return false;
    }
    return false;
});

async function ensureTabIsActive() {
    if (!automationState.tabId) return;
    try { await chrome.tabs.update(automationState.tabId, { active: true }); } catch (e) {}
}

function navigateToNextPage() {
    if (!automationState.isRunning) return;
    if (automationState.currentPageIndex >= automationState.config.fanPageUrls.length) {
        console.log(`✅ Completado: ${automationState.commentedCount} comentarios`);
        automationState.isRunning = false;
        chrome.storage.local.set({ status: { isRunning: false, commentedCount: automationState.commentedCount, lastUpdate: new Date().toLocaleTimeString() }});
        return;
    }
    
    const pageUrl = automationState.config.fanPageUrls[automationState.currentPageIndex];
    const photosUrl = convertToPhotosUrl(pageUrl);
    
    console.log(`\n📄 [${automationState.currentPageIndex + 1}/${automationState.config.fanPageUrls.length}] Navegando a: ${photosUrl}`);
    
    chrome.scripting.executeScript({
        target: { tabId: automationState.tabId },
        func: (url) => { window.location.replace(url); },
        args: [photosUrl]
    }).catch(err => {
        chrome.tabs.update(automationState.tabId, { url: photosUrl });
    });
}

function navigateToNextPhoto() {
    if (!automationState.isRunning) return;
    ensureTabIsActive();
    chrome.tabs.sendMessage(automationState.tabId, { action: "nextPhoto", config: automationState.config }, (response) => {
        if (chrome.runtime.lastError) console.error("Error al navegar:", chrome.runtime.lastError.message);
    });
}

function convertToPhotosUrl(url) {
    url = url.replace(/\/$/, '');
    if (url.includes('/photos/')) return url + '/';
    const profileMatch = url.match(/id=(\d+)/);
    if (profileMatch) return `https://www.facebook.com/${profileMatch[1]}/photos/`;
    return url + '/photos/';
}

function startWatchdog() {
    if (automationState.watchdogInterval) clearInterval(automationState.watchdogInterval);
    automationState.watchdogInterval = setInterval(() => {
        if (!automationState.isRunning) { clearInterval(automationState.watchdogInterval); automationState.watchdogInterval = null; return; }
        const timeSinceLastActivity = Date.now() - (automationState.lastActivityTime || Date.now());
        if (timeSinceLastActivity > 60000) {
            console.log("🚨 ALERTA: Bloqueada, recuperando...");
            automationState.lastActivityTime = Date.now();
            if (automationState.currentPageIndex < automationState.config.fanPageUrls.length) {
                automationState.currentPageIndex++;
                automationState.currentPhotoIndex = 0;
                saveAutomationProgress();
                navigateToNextPage();
            } else {
                automationState.isRunning = false;
                clearInterval(automationState.watchdogInterval);
                automationState.watchdogInterval = null;
            }
        }
    }, 10000);
}