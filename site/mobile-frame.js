function showMobileSiteLink() {
    if (window.self === window.top ||
        !window.matchMedia('(pointer: coarse)').matches ||
        Math.min(screen.width, screen.height) > 768) {
        return;
    }

    const link = document.createElement('a');
    link.className = 'mobile-frame-link';
    link.href = window.location.href;
    link.target = '_top';
    link.textContent = 'Open mobile site';
    document.body.appendChild(link);

    function resizeLink() {
        const scale = Math.max(1, Math.min(4, window.innerWidth / screen.width));
        link.style.setProperty('--mobile-frame-scale', String(scale));
    }
    resizeLink();
    window.addEventListener('resize', resizeLink);
}

document.addEventListener('DOMContentLoaded', showMobileSiteLink);
