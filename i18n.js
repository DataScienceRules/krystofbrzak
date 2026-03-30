(function initI18n() {
    let translations = {};
    const DEFAULT_LANG = "en";

    /**
     * Read the current language from the last URL segment, e.g. /cs.
     */
    function getLangFromUrl() {
        const segments = window.location.pathname.split("/").filter(Boolean);
        const lang = segments[segments.length - 1];

        return lang && translations[lang] ? lang : null;
    }

    /**
     * Keep the language-specific URL in sync with the selected locale.
     */
    function updateUrlForLanguage(lang) {
        const url = new URL(window.location.href);
        const segments = url.pathname.split("/").filter(Boolean);
        const lastSegment = segments[segments.length - 1];

        if (translations[lastSegment]) {
            segments.pop();
        }

        segments.push(lang);
        url.pathname = "/" + segments.join("/");
        url.search = "";
        window.history.replaceState({}, "", url);
        updateCanonical(url);
    }

    /**
     * Update the canonical link whenever the language-specific URL changes.
     */
    function updateCanonical(url = new URL(window.location.href)) {
        const canonical = document.getElementById("canonical-link");

        if (canonical) {
            canonical.href = url.origin + url.pathname;
        }
    }

    /**
     * Safely read nested translation keys using dot notation.
     */
    function getNestedValue(obj, path) {
        return path.split(".").reduce((acc, part) => {
            return acc && acc[part] !== undefined ? acc[part] : undefined;
        }, obj);
    }

    /**
     * Push translated strings into all DOM nodes that declare data-translate.
     */
    function applyTranslations(lang) {
        const fallbackLang = translations[DEFAULT_LANG] || {};
        const currentLang = translations[lang] || fallbackLang;

        document.querySelectorAll("[data-translate]").forEach((element) => {
            const key = element.dataset.translate;
            const value =
                getNestedValue(currentLang, key) ??
                getNestedValue(fallbackLang, key) ??
                key;

            element.textContent = value;
        });

        document.documentElement.lang = lang;
    }

    /**
     * Reflect the currently active language in the visible flag selector.
     */
    function updateSelectedFlag(lang) {
        const selectedLangImage = document.querySelector(".selected-lang img");
        const activeFlag = document.querySelector(
            `.lang-options .flag[data-lang="${lang}"]`
        );

        if (selectedLangImage && activeFlag) {
            selectedLangImage.src = activeFlag.src;
            selectedLangImage.dataset.lang = lang;
        }
    }

    /**
     * Public language switcher used by the language UI.
     * Exposed on window so the rest of the site can switch locale safely.
     */
    function setLanguage(lang) {
        if (!translations[lang]) {
            lang = DEFAULT_LANG;
        }

        applyTranslations(lang);
        localStorage.setItem("lang", lang);
        updateSelectedFlag(lang);
        updateUrlForLanguage(lang);
    }

    /**
     * Prefer URL language, then saved preference, then browser language.
     */
    function detectLanguage() {
        const urlLang = getLangFromUrl();
        const savedLang = localStorage.getItem("lang");
        const browserLang = navigator.language.split("-")[0];

        if (urlLang) {
            return urlLang;
        }

        if (savedLang && translations[savedLang]) {
            return savedLang;
        }

        if (translations[browserLang]) {
            return browserLang;
        }

        return DEFAULT_LANG;
    }

    /**
     * Fetch translations and apply the best available language on startup.
     */
    async function loadTranslations() {
        try {
            const response = await fetch(`translations.json?v=${Date.now()}`);

            if (!response.ok) {
                throw new Error("Failed to load translations.json");
            }

            translations = await response.json();
            setLanguage(detectLanguage());
        } catch (error) {
            console.error("Translation loading error:", error);
        }
    }

    window.setLanguage = setLanguage;
    document.addEventListener("DOMContentLoaded", loadTranslations);
})();
