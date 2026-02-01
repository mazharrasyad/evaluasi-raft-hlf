(function () {
    if (typeof window === 'undefined') {
        return;
    }

    const yearEl = document.getElementById('currentYear');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
})();
