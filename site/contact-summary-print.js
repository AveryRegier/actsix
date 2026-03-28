// Inject a print-only colgroup just before printing and remove it after.
// This avoids changing the on-screen layout while giving the print renderer
// explicit column widths to align headers and body.
(function() {
    const colgroupId = 'print-colgroup';
    const widths = ['10%','10%','11.5%','11%','7.5%','7%','43%'];

    function createColGroup() {
        if (document.getElementById(colgroupId)) return;
        const table = document.getElementById('summaryTable');
        if (!table) return;
        const cg = document.createElement('colgroup');
        cg.id = colgroupId;
        widths.forEach(w => {
            const c = document.createElement('col');
            c.style.width = w;
            cg.appendChild(c);
        });
        // Insert as first child of the table so it affects layout
        table.insertBefore(cg, table.firstChild);
    }

    function removeColGroup() {
        const cg = document.getElementById(colgroupId);
        if (cg) cg.remove();
    }

    // Modern browsers: matchMedia for print
    if (window.matchMedia) {
        const m = window.matchMedia('print');
        try { m.addListener(e => { if (e.matches) createColGroup(); else removeColGroup(); }); } catch (e) {}
    }

    // fallback: beforeprint/afterprint events
    window.addEventListener('beforeprint', createColGroup);
    window.addEventListener('afterprint', removeColGroup);

    // Safety: remove if page is navigated or on load complete
    window.addEventListener('pageshow', removeColGroup);
    window.addEventListener('DOMContentLoaded', removeColGroup);
})();
