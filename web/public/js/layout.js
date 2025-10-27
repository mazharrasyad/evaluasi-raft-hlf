(function () {
    if (typeof window === 'undefined') {
        return;
    }

    const COMPONENT_PATHS = {
        header: '../components/header.html',
        sidebar: '../components/sidebar.html',
        footer: '../components/footer.html',
    };

    async function loadComponent(name) {
        const path = COMPONENT_PATHS[name];
        if (!path) {
            return null;
        }

        const response = await fetch(path, {
            credentials: 'same-origin',
            headers: {
                'X-Requested-With': 'component-loader',
            },
        });

        if (!response.ok) {
            throw new Error(`Gagal memuat komponen "${name}" (${response.status})`);
        }

        return response.text();
    }

    async function injectComponent(placeholder) {
        const name = placeholder?.dataset?.component;
        if (!name) {
            return;
        }

        try {
            const markup = await loadComponent(name);
            if (typeof markup !== 'string') {
                return;
            }

            placeholder.outerHTML = markup;
        } catch (error) {
            console.error(error);
        }
    }

    async function initComponents() {
        const placeholders = Array.from(document.querySelectorAll('[data-component]'));

        if (placeholders.length === 0) {
            return;
        }

        await Promise.all(placeholders.map((placeholder) => injectComponent(placeholder)));
    }

    const loaderPromise = initComponents().catch((error) => {
        console.error('Gagal menginisialisasi komponen tata letak:', error);
    });

    window.componentLoaderReady = loaderPromise instanceof Promise
        ? loaderPromise
        : Promise.resolve();
})();
