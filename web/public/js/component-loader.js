const componentContainers = Array.from(document.querySelectorAll('[data-component]'));

const loadPromises = componentContainers.map(async (container) => {
    const componentName = container.dataset.component;
    if (!componentName) {
        return;
    }

    const response = await fetch(`../components/${componentName}.html`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Gagal memuat komponen "${componentName}".`);
    }

    const html = await response.text();
    container.innerHTML = html;
});

const componentsReady = Promise.all(loadPromises).then(() => {
    const links = Array.from(document.querySelectorAll('.component-link'));

    function setActiveLink(targetId) {
        links.forEach((link) => {
            const isActive = link.dataset.target === targetId;
            link.dataset.active = isActive ? 'true' : 'false';
        });
    }

    links.forEach((link) => {
        link.addEventListener('click', () => {
            const targetId = link.dataset.target;
            const targetSection = targetId ? document.getElementById(targetId) : null;
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setActiveLink(targetId);
            }
        });
    });

    const observedSections = componentContainers
        .map((container) => container.querySelector('section[id]'))
        .filter(Boolean);

    if (observedSections.length) {
        const observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

            if (visible.length > 0) {
                const sectionId = visible[0].target.id;
                setActiveLink(sectionId);
            }
        }, {
            threshold: [0.25, 0.5, 0.75],
        });

        observedSections.forEach((section) => observer.observe(section));
    }

    if (observedSections.length) {
        setActiveLink(observedSections[0].id);
    }
});

window.componentLoaderReady = componentsReady.catch((error) => {
    console.error(error);
});
