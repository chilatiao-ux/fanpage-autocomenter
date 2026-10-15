// Este script se ejecuta ANTES de que Facebook cargue (document_start)
// Intercepta y bloquea la capacidad de Facebook de mostrar "Deseas salir del sitio"

// 1. Bloquear addEventListener('beforeunload', ...)
const originalAddEventListener = window.addEventListener;
window.addEventListener = function(type, listener, options) {
    if (type === 'beforeunload') {
        console.log('🛑 Bloqueado: Facebook intentó agregar un listener de beforeunload');
        return; // Lo ignoramos silenciosamente
    }
    return originalAddEventListener.call(this, type, listener, options);
};

// 2. Bloquear window.onbeforeunload = function...
Object.defineProperty(window, 'onbeforeunload', {
    set: function(value) {
        console.log('🛑 Bloqueado: Facebook intentó asignar onbeforeunload');
        // No hacemos nada
    },
    get: function() {
        return null; // Siempre devolvemos null
    }
});