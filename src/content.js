// Content Script - Comunica con el injected script y el background

console.log("✅ Content script cargado");

// ==========================================================
// 🎵 ANTI-THROTTLE: Audio Silencioso para evitar congelamiento al minimizar
// ==========================================================
const audioHack = document.createElement('script');
audioHack.textContent = `
    (function() {
        // Audio WAV silencioso en Base64 (tamaño mínimo)
        const silentWav = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        const audio = document.createElement('audio');
        audio.src = silentWav;
        audio.loop = true;
        audio.volume = 0; // Completamente mudo
        
        // Intentar reproducir (Edge lo bloqueará al principio si no hay interacción)
        audio.play().catch(() => {
            console.log("⏳ Autoplay bloqueado, esperando interacción...");
            // Si lo bloquea, escuchar el primer clic humano o programático para iniciar
            const startAudio = () => {
                audio.play().catch(e => console.error("Audio error:", e));
                document.removeEventListener('click', startAudio);
                document.removeEventListener('keydown', startAudio);
            };
            document.addEventListener('click', startAudio, { once: true });
            document.addEventListener('keydown', startAudio, { once: true });
        });
        
        document.body.appendChild(audio);
        console.log("🎵 Hack Anti-Throttle instalado");
    })();
`;
(document.head || document.documentElement).appendChild(audioHack);
audioHack.remove();
// ==========================================================

// Inyectar el script en la página
const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/injected-script.js');
script.onload = function() { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// ==========================================================
// 👁️ SIMULAR VENTANA ACTIVA (Para cuando está minimizada)
// ==========================================================
const overrideVisibility = document.createElement('script');
overrideVisibility.textContent = `
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
    window.addEventListener('visibilitychange', function(e) { e.stopImmediatePropagation(); }, true);
`;
(document.head || document.documentElement).appendChild(overrideVisibility);
overrideVisibility.remove();
// ==========================================================

// ==========================================================
// 🔌 MANTENER SERVICE WORKER DESPIERTO
// ==========================================================
let keepAlivePort = null;
function connectKeepAlive() {
    keepAlivePort = chrome.runtime.connect({ name: 'keepAlive' });
    keepAlivePort.onDisconnect.addListener(() => {
        setTimeout(connectKeepAlive, 1000);
    });
}
setTimeout(() => {
    chrome.runtime.sendMessage({ action: "contentScriptReady" }).catch(err => {});
    connectKeepAlive();
}, 1000);
// ==========================================================

// Escuchar mensajes del background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("📨 Mensaje del background:", request.action);
    
    if (request.action === "commentOnCurrentPhoto") {
        window.postMessage({ type: 'AUTOMATION_STATE', running: true }, '*');
        
        (async () => {
        console.log("💬 Comentando en foto actual");
        
        const allElements = document.querySelectorAll('div, span, p, h1, h2');
        let limitationDetected = false;
        let anotherProfileDetected = false;
        
        for (const el of allElements) {
            const text = el.innerText || el.textContent;
            if (!text) continue;
            
            if (text.includes("No podes utilizar esta funcionalidad en este momento") ||
                text.includes("No puedes usar esta función en este momento") ||
                text.includes("Limitamos a frecuencia") ||
                text.includes("You can't use this feature right now")) {
                limitationDetected = true;
                const closeButtons = document.querySelectorAll('button, [role="button"]');
                for (const btn of closeButtons) {
                    const btnText = btn.textContent || btn.innerText || '';
                    if (btnText.toLowerCase().includes('aceptar') || btnText.toLowerCase().includes('ok') || btnText.toLowerCase().includes('accept') || btnText.trim() === 'X' || btn.getAttribute('aria-label') === 'Cerrar') {
                        btn.click();
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        break;
                    }
                }
                break;
            }
            
            if (text.includes("Parece que iniciaste sesión con otra cuenta") || text.includes("It looks like you signed in with a different account") || text.includes("otro perfil")) {
                anotherProfileDetected = true;
                break;
            }
        }
        
        if (limitationDetected) {
            chrome.runtime.sendMessage({ action: "facebookLimitationDetected" }).catch(err => {});
            sendResponse({ success: false });
            return true;
        }
        
        if (anotherProfileDetected) {
            chrome.runtime.sendMessage({ action: "anotherProfileDetected" }).catch(err => {});
            sendResponse({ success: false });
            return true;
        }
        
        let isUnavailable = false;
        for (const el of allElements) {
            const text = el.innerText || el.textContent;
            if (text && (text.includes("Este contenido no está disponible") || text.includes("This content isn't available") || text.includes("contenido no está disponible"))) {
                isUnavailable = true;
                break;
            }
        }
        
        if (isUnavailable) {
            sendResponse({ success: false });
            return true;
        }
        
        window.postMessage({ type: 'FROM_CONTENT_SCRIPT', action: 'commentOnCurrentPhoto', config: request.config }, '*');
        
        const handleResponse = (event) => {
            if (event.source !== window) return;
            if (event.data.type === 'FROM_INJECTED' && event.data.action === 'photoCommented') {
                window.removeEventListener('message', handleResponse);
                sendResponse({ success: event.data.success });
            }
        };
        
        window.addEventListener('message', handleResponse);
        setTimeout(() => { window.removeEventListener('message', handleResponse); sendResponse({ success: false }); }, 15000);
        
        return true;
        })();
        return true;
        
    } else if (request.action === "stopAutomation") {
        window.postMessage({ type: 'AUTOMATION_STATE', running: false }, '*');
        sendResponse({ success: true });
        return true;
        
    } else if (request.action === "followFanPage") {
        const followButtons = document.querySelectorAll('button, [role="button"]');
        let followBtn = null;
        for (const btn of followButtons) {
            const text = btn.textContent || btn.innerText || '';
            if (text.toLowerCase().includes('seguir') || text.toLowerCase().includes('follow') || text.toLowerCase().includes('seguindo')) {
                followBtn = btn;
                break;
            }
        }
        if (followBtn) { followBtn.click(); sendResponse({ success: true }); } else { sendResponse({ success: false }); }
        return true;
        
    } else if (request.action === "nextPhoto") {
        window.postMessage({ type: 'FROM_CONTENT_SCRIPT', action: 'nextPhoto' }, '*');
        
        const handleNextPhotoPressed = (event) => {
            if (event.source !== window) return;
            if (event.data.type === 'FROM_INJECTED' && event.data.action === 'nextPhotoPressed') {
                window.removeEventListener('message', handleNextPhotoPressed);
                setTimeout(() => {
                    window.postMessage({ type: 'FROM_CONTENT_SCRIPT', action: 'commentOnCurrentPhoto', config: request.config }, '*');
                    const handleResponse = (event) => {
                        if (event.source !== window) return;
                        if (event.data.type === 'FROM_INJECTED' && event.data.action === 'photoCommented') {
                            window.removeEventListener('message', handleResponse);
                            chrome.runtime.sendMessage({ action: "photoCommented", success: event.data.success }).catch(err => {});
                        }
                    };
                    window.addEventListener('message', handleResponse);
                    setTimeout(() => { window.removeEventListener('message', handleResponse); chrome.runtime.sendMessage({ action: "photoCommented", success: false }).catch(err => {}); }, 75000);
                }, 5000);
            }
        };
        
        window.addEventListener('message', handleNextPhotoPressed);
        setTimeout(() => { window.removeEventListener('message', handleNextPhotoPressed); }, 10000);
        sendResponse({ success: true });
    }
    
    return true;
});