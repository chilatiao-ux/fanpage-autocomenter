// Dashboard Script - Interfaz principal

let config = {
    fanPageUrls: [],
    mentionedPages: [],
    commentText: "❌️wao que buenos son los videos de esta pagina💯\n@𝗣𝗢𝗞𝗨𝗙= 𝗨𝗦𝗕𝗬𝗘𝗥𝗖𝗟𝗗 𝗠𝗦𝘂𝗲",
    postsPerPage: 5,
    delayBetweenPosts: 3000,
    delayBetweenPages: 5000,
    backupFanPageUrl: null
};

const DEFAULT_COMMENT_TEXT = "❗️wao que buenos son los videos de esta pagina👇\n@𝗩𝗶𝗱𝗲𝗼 𝗿𝗼𝗺𝗽𝗹𝗲𝘁𝗼 𝗮𝗾𝘂𝗶";

// Elementos del DOM
const fanPageUrlInput = document.getElementById("fanPageUrl");
const addPageBtn = document.getElementById("addPageBtn");
const fanPagesList = document.getElementById("fanPagesList");
const deleteAllPagesBtn = document.getElementById("deleteAllPagesBtn");

const mentionPageNameInput = document.getElementById("mentionPageName");
const addMentionBtn = document.getElementById("addMentionBtn");
const mentionPagesList = document.getElementById("mentionPagesList");
const deleteAllMentionsBtn = document.getElementById("deleteAllMentionsBtn");

const commentTextarea = document.getElementById("commentText");
const resetCommentBtn = document.getElementById("resetCommentBtn");

const postsPerPageInput = document.getElementById("postsPerPage");
const delayBetweenPostsInput = document.getElementById("delayBetweenPosts");
const delayBetweenPagesInput = document.getElementById("delayBetweenPages");

const saveConfigBtn = document.getElementById("saveConfigBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

const statusRunning = document.getElementById("statusRunning");
const statusCommented = document.getElementById("statusCommented");
const statusLastUpdate = document.getElementById("statusLastUpdate");

const backupFanPageUrlInput = document.getElementById("backupFanPageUrl");
const setBackupBtn = document.getElementById("setBackupBtn");
const backupPageDisplay = document.getElementById("backupPageDisplay");

// Inicializar
document.addEventListener("DOMContentLoaded", () => {
    console.log("🔧 Inicializando dashboard...");
    loadConfig();
    setupEventListeners();
    updateStatus();
    setInterval(updateStatus, 2000);
});

function setupEventListeners() {
    document.querySelectorAll(".tab-mini").forEach(tab => {
        tab.addEventListener("click", () => {
            const tabName = tab.getAttribute("data-tab");
            switchMiniTab(tabName);
        });
    });
    
    addPageBtn.addEventListener("click", addFanPage);
    fanPageUrlInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") addFanPage();
    });
    
    document.getElementById("addMultipleBtn").addEventListener("click", addMultipleFanPages);

    addMentionBtn.addEventListener("click", addMentionedPage);
    mentionPageNameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") addMentionedPage();
    });

    resetCommentBtn.addEventListener("click", resetCommentText);
    saveConfigBtn.addEventListener("click", saveConfig);

    setBackupBtn.addEventListener("click", setBackupFanPage);
    backupFanPageUrlInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") setBackupFanPage();
    });

    startBtn.addEventListener("click", startAutomation);
    stopBtn.addEventListener("click", stopAutomation);
    document.getElementById("skipPageBtn").addEventListener("click", skipCurrentPage);
    
    deleteAllPagesBtn.addEventListener("click", removeAllFanPages);
    deleteAllMentionsBtn.addEventListener("click", removeAllMentionedPages);
}

function switchMiniTab(tabName) {
    document.querySelectorAll(".tab-mini").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".tab-mini-content").forEach(content => content.classList.remove("active"));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
    document.getElementById(`${tabName}-tab`).classList.add("active");
}

function addFanPage() {
    const url = fanPageUrlInput.value.trim();
    if (!url) { showNotification("Por favor ingresa una URL", "warning"); return; }
    if (!isValidUrl(url)) { showNotification("Por favor ingresa una URL válida de Facebook", "error"); return; }
    if (config.fanPageUrls.includes(url)) { showNotification("Esta URL ya está en la lista", "warning"); return; }

    config.fanPageUrls.push(url);
    fanPageUrlInput.value = "";
    renderFanPagesList();
    showNotification("✅ Fan page agregada", "success");
}

function addMultipleFanPages() {
    const text = document.getElementById("fanPageUrls").value.trim();
    if (!text) { showNotification("Por favor pega las URLs", "warning"); return; }
    
    const urls = text.split("\n").map(url => url.trim()).filter(url => url.length > 0);
    let added = 0, duplicates = 0, invalid = 0;
    
    urls.forEach(url => {
        if (!isValidUrl(url)) { invalid++; return; }
        if (config.fanPageUrls.includes(url)) { duplicates++; return; }
        config.fanPageUrls.push(url);
        added++;
    });
    
    document.getElementById("fanPageUrls").value = "";
    renderFanPagesList();
    let message = `✅ ${added} agregadas`;
    if (duplicates > 0) message += ` (${duplicates} duplicadas)`;
    if (invalid > 0) message += ` (${invalid} inválidas)`;
    showNotification(message, "success");
}

function removeFanPage(index) {
    config.fanPageUrls.splice(index, 1);
    renderFanPagesList();
    showNotification("✅ Fan page eliminada", "success");
}

function removeAllFanPages() {
    if (config.fanPageUrls.length === 0) { showNotification("No hay fan pages para eliminar", "warning"); return; }
    if (confirm("⚠️ ¿Estás seguro de que deseas eliminar TODAS las Fan Pages de la lista?")) {
        config.fanPageUrls = [];
        renderFanPagesList();
        showNotification("🗑️ Todas las Fan Pages eliminadas", "success");
    }
}

function renderFanPagesList() {
    fanPagesList.innerHTML = "";
    deleteAllPagesBtn.disabled = config.fanPageUrls.length === 0;
    if (config.fanPageUrls.length === 0) { fanPagesList.innerHTML = '<p class="empty-message">No hay fan pages agregadas</p>'; return; }

    config.fanPageUrls.forEach((url, index) => {
        const item = document.createElement("div");
        item.className = "list-item";
        const textSpan = document.createElement("span");
        textSpan.className = "list-item-text";
        textSpan.textContent = url;
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "list-item-delete";
        deleteBtn.textContent = "✕ Eliminar";
        deleteBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); removeFanPage(index); });
        item.appendChild(textSpan);
        item.appendChild(deleteBtn);
        fanPagesList.appendChild(item);
    });
}

function addMentionedPage() {
    const name = mentionPageNameInput.value.trim();
    if (!name) { showNotification("Por favor ingresa un nombre", "warning"); return; }
    if (config.mentionedPages.includes(name)) { showNotification("Esta fan page ya está en la lista", "warning"); return; }

    config.mentionedPages.push(name);
    mentionPageNameInput.value = "";
    renderMentionedPagesList();
    showNotification("✅ Fan page a mencionar agregada", "success");
}

function removeMentionedPage(index) {
    config.mentionedPages.splice(index, 1);
    renderMentionedPagesList();
    showNotification("✅ Fan page eliminada", "success");
}

function removeAllMentionedPages() {
    if (config.mentionedPages.length === 0) { showNotification("No hay menciones para eliminar", "warning"); return; }
    if (confirm("⚠️ ¿Estás seguro de que deseas eliminar TODAS las Fan Pages a Mencionar?")) {
        config.mentionedPages = [];
        renderMentionedPagesList();
        showNotification("🗑️ Todas las menciones eliminadas", "success");
    }
}

function renderMentionedPagesList() {
    mentionPagesList.innerHTML = "";
    deleteAllMentionsBtn.disabled = config.mentionedPages.length === 0;
    if (config.mentionedPages.length === 0) { mentionPagesList.innerHTML = '<p class="empty-message">No hay fan pages para mencionar</p>'; return; }

    config.mentionedPages.forEach((name, index) => {
        const item = document.createElement("div");
        item.className = "list-item";
        const textSpan = document.createElement("span");
        textSpan.className = "list-item-text";
        textSpan.textContent = "@" + name;
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "list-item-delete";
        deleteBtn.textContent = "✕ Eliminar";
        deleteBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); removeMentionedPage(index); });
        item.appendChild(textSpan);
        item.appendChild(deleteBtn);
        mentionPagesList.appendChild(item);
    });
}

function resetCommentText() {
    commentTextarea.value = DEFAULT_COMMENT_TEXT;
    config.commentText = DEFAULT_COMMENT_TEXT;
    showNotification("✅ Texto restaurado", "success");
}

function loadConfig() {
    chrome.storage.local.get(["config"], (result) => {
        if (result.config) { config = result.config; }
        updateUI();
    });
}

function updateUI() {
    commentTextarea.value = config.commentText;
    postsPerPageInput.value = config.postsPerPage;
    delayBetweenPostsInput.value = config.delayBetweenPosts;
    delayBetweenPagesInput.value = config.delayBetweenPages;
    renderFanPagesList();
    renderMentionedPagesList();
    updateBackupPageDisplay();
}

function saveConfig() {
    config.commentText = commentTextarea.value;
    config.postsPerPage = parseInt(postsPerPageInput.value);
    config.delayBetweenPosts = parseInt(delayBetweenPostsInput.value);
    config.delayBetweenPages = parseInt(delayBetweenPagesInput.value);
    chrome.storage.local.set({ config: config }, () => {
        showNotification("✅ Configuración guardada correctamente", "success");
    });
}

// 🪟 FUNCIÓN MODIFICADA: Abre Facebook en ventanita automáticamente
function startAutomation() {
    console.log("🚀 Iniciando automatización...");
    
    if (config.fanPageUrls.length === 0) { showNotification("❌ Agrega al menos una fan page", "error"); return; }
    if (config.mentionedPages.length === 0) { showNotification("❌ Agrega al menos una fan page a mencionar", "error"); return; }

    config.commentText = commentTextarea.value;
    config.postsPerPage = parseInt(postsPerPageInput.value);
    config.delayBetweenPosts = parseInt(delayBetweenPostsInput.value);
    config.delayBetweenPages = parseInt(delayBetweenPagesInput.value);
    saveConfig();

    chrome.tabs.query({ url: "*://www.facebook.com/*" }, (tabs) => {
        
        const startMode = document.getElementById('startMode').value;

        if (tabs.length > 0) {
            // CASO 1: Ya hay una pestaña de Facebook. La movemos a la ventanita.
            const facebookTab = tabs[0];
            chrome.windows.create({
                tabId: facebookTab.id,
                type: 'popup',
                width: 800,
                height: 600,
                focused: false
            }, (newWindow) => {
                triggerStart(newWindow.id, facebookTab.id, startMode);
            });
        } else {
            // CASO 2: No hay pestaña. Abrimos Facebook en una ventanita nueva.
            chrome.windows.create({
                url: "https://www.facebook.com/",
                type: 'popup',
                width: 800,
                height: 600,
                focused: false
            }, (newWindow) => {
                const newTabId = newWindow.tabs[0].id;
                triggerStart(newWindow.id, newTabId, startMode);
            });
        }
    });
}

// Función auxiliar para enviar el mensaje (evita repetir código)
function triggerStart(windowId, tabId, startMode) {
    setTimeout(() => {
        chrome.runtime.sendMessage(
            { action: "startAutomation", config: config, tabId: tabId, windowId: windowId, mode: startMode },
            (response) => {
                if (chrome.runtime.lastError) {
                    showNotification("❌ Error: Recarga Facebook y intenta de nuevo", "error");
                    return;
                }
                if (response && response.success) {
                    showNotification("🚀 Automatización iniciada (Cierra la ventana para detener)", "success");
                    startBtn.disabled = true;
                    stopBtn.disabled = false;
                } else {
                    const error = response?.error || "Error desconocido";
                    showNotification(`❌ Error: ${error}`, "error");
                }
            }
        );
    }, 1500); // 1.5 segundos para asegurar que la pestaña cargue
}

function stopAutomation() {
    chrome.runtime.sendMessage({ action: "stopAutomation" }, (response) => {
        if (response && response.success) {
            showNotification("⏹️ Automatización detenida", "success");
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    });
}

function skipCurrentPage() {
    chrome.runtime.sendMessage({ action: "skipCurrentPage" }, (response) => {
        if (response && response.success) { showNotification("⏭️ Saltando a siguiente fan page", "success"); }
    });
}

function updateStatus() {
    chrome.storage.local.get(["status"], (result) => {
        if (result.status && Object.keys(result.status).length > 0) {
            const status = result.status;
            statusRunning.textContent = status.isRunning ? "🟢 En ejecución" : "🔴 Detenido";
            statusCommented.textContent = status.commentedCount || 0;
            statusLastUpdate.textContent = status.lastUpdate || "-";
            startBtn.disabled = status.isRunning;
            stopBtn.disabled = !status.isRunning;
            document.getElementById("skipPageBtn").disabled = !status.isRunning;
        }
    });
}

function showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = "slideOut 0.3s ease";
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function isValidUrl(string) {
    try { new URL(string); return string.includes("facebook.com"); } catch (_) { return false; }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function setBackupFanPage() {
    const url = backupFanPageUrlInput.value.trim();
    if (!url) { showNotification("Por favor ingresa una URL", "warning"); return; }
    if (!isValidUrl(url)) { showNotification("URL inválida. Debe ser una URL de Facebook", "error"); return; }
    
    config.backupFanPageUrl = url;
    chrome.storage.local.set({ automationConfig: config }, () => {
        showNotification("✅ Fan page de respaldo configurada", "success");
        updateBackupPageDisplay();
        backupFanPageUrlInput.value = "";
    });
}

function updateBackupPageDisplay() {
    if (config.backupFanPageUrl) {
        backupPageDisplay.innerHTML = `
            <div class="list-item">
                <span>${escapeHtml(config.backupFanPageUrl)}</span>
                <button class="btn-remove" onclick="clearBackupFanPage()">✕</button>
            </div>
        `;
    } else {
        backupPageDisplay.innerHTML = '<p class="empty-message">No hay fan page de respaldo configurada</p>';
    }
}

function clearBackupFanPage() {
    config.backupFanPageUrl = null;
    chrome.storage.local.set({ automationConfig: config }, () => {
        showNotification("✅ Fan page de respaldo eliminada", "success");
        updateBackupPageDisplay();
    });
}