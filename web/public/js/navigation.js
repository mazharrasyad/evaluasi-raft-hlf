(async function () {
    if (typeof window === 'undefined') {
        return;
    }

    const readyPromise = window.componentLoaderReady instanceof Promise
        ? window.componentLoaderReady
        : Promise.resolve();

    try {
        await readyPromise;
    } catch (error) {
        console.error('Gagal menunggu komponen tata letak selesai dimuat:', error);
    }

    const navLinks = Array.from(document.querySelectorAll('[data-nav-target]'));

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

    if (navLinks.length > 0) {
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
    }

    const sidebar = document.querySelector('[data-sidebar]');
    if (!sidebar) {
        return;
    }

    const toggleButtons = Array.from(document.querySelectorAll('[data-sidebar-toggle]'));
    const closeButtons = Array.from(document.querySelectorAll('[data-sidebar-close]'));
    const overlay = document.querySelector('[data-sidebar-overlay]');
    const body = document.body;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const OPEN_CLASS = 'translate-x-0';
    const CLOSED_CLASS = '-translate-x-full';

    function lockBodyScroll(shouldLock) {
        if (!body) {
            return;
        }

        body.classList.toggle('overflow-hidden', shouldLock);
    }

    function setToggleAria(isExpanded) {
        const value = isExpanded ? 'true' : 'false';
        toggleButtons.forEach((button) => {
            button.setAttribute('aria-expanded', value);
        });
    }

    function openSidebar(options = {}) {
        sidebar.dataset.state = 'open';
        sidebar.classList.add(OPEN_CLASS);
        sidebar.classList.remove(CLOSED_CLASS);
        setToggleAria(true);

        if (overlay) {
            if (mediaQuery.matches) {
                overlay.classList.add('hidden');
            } else {
                overlay.classList.remove('hidden');
            }
        }

        lockBodyScroll(!mediaQuery.matches);

        if (!options.skipFocus) {
            const activeLink = sidebar.querySelector('[data-nav-target][data-active="true"]');
            const focusTarget = activeLink || sidebar.querySelector('a, button, input, [tabindex]:not([tabindex="-1"])');

            if (focusTarget && typeof focusTarget.focus === 'function') {
                focusTarget.focus({ preventScroll: true });
            }
        }
    }

    function closeSidebar(options = {}) {
        if (mediaQuery.matches) {
            return;
        }

        sidebar.dataset.state = 'closed';
        sidebar.classList.add(CLOSED_CLASS);
        sidebar.classList.remove(OPEN_CLASS);
        setToggleAria(false);

        if (overlay) {
            overlay.classList.add('hidden');
        }

        lockBodyScroll(false);

        if (!options.skipFocus && toggleButtons.length > 0) {
            const target = options.focusTarget || toggleButtons[0];

            if (target && typeof target.focus === 'function') {
                target.focus({ preventScroll: true });
            }
        }
    }

    function toggleSidebar(event) {
        event?.preventDefault();
        const isOpen = sidebar.dataset.state === 'open';

        if (isOpen) {
            closeSidebar({ focusTarget: event?.currentTarget || null });
        } else {
            openSidebar();
        }
    }

    toggleButtons.forEach((button) => {
        button.addEventListener('click', toggleSidebar);
    });

    closeButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            closeSidebar({ focusTarget: toggleButtons[0] });
        });
    });

    if (overlay) {
        overlay.addEventListener('click', (event) => {
            event.preventDefault();
            closeSidebar({ focusTarget: toggleButtons[0] });
        });
    }

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const isOpen = sidebar.dataset.state === 'open';

            if (isOpen && !mediaQuery.matches) {
                closeSidebar({ focusTarget: toggleButtons[0] });
            }
        }
    });

    function handleMediaChange() {
        if (mediaQuery.matches) {
            openSidebar({ skipFocus: true });
        } else if (sidebar.dataset.state !== 'open') {
            closeSidebar({ skipFocus: true });
        } else {
            openSidebar({ skipFocus: true });
        }
    }

    handleMediaChange();
    mediaQuery.addEventListener('change', handleMediaChange);

    if (navLinks.length > 0) {
        navLinks.forEach((link) => {
            link.addEventListener('click', () => {
                if (!mediaQuery.matches) {
                    closeSidebar({ skipFocus: true });
                }
            });
        });
    }
})();
