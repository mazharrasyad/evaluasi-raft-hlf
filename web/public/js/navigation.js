(function () {
    if (typeof window === 'undefined') {
        return;
    }

    const navLinks = Array.from(document.querySelectorAll('[data-nav-target]'));
    if (navLinks.length === 0) {
        return;
    }

    function normalizePath(pathname) {
        if (!pathname || typeof pathname !== 'string') {
            return '/';
        }

        let normalized = pathname.trim();
        if (normalized === '') {
            return '/';
        }

        try {
            const url = new URL(normalized, window.location.origin);
            normalized = url.pathname;
        } catch (error) {
            // Ignore invalid URL parsing, fall back to original string.
        }

        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }

        return normalized || '/';
    }

    const currentPath = normalizePath(window.location.pathname);

    navLinks.forEach((link) => {
        const target = normalizePath(link.dataset.navTarget || '/');
        const isRoot = target === '/';
        const isActive = isRoot ? currentPath === '/' : currentPath === target;

        link.dataset.active = isActive ? 'true' : 'false';

        if (isActive) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });
})();
