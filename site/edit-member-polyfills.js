// Polyfill Array.from for older browsers.
if (!Array.from) {
    Array.from = function(arrayLike) {
        return Array.prototype.slice.call(arrayLike);
    };
}