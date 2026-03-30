/**
 * Google Analytics bootstrap.
 * The remote gtag library is loaded separately in index.html.
 */
(function initAnalytics() {
    window.dataLayer = window.dataLayer || [];

    function gtag() {
        window.dataLayer.push(arguments);
    }

    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", "G-QRFSJ7JYQR");
})();
