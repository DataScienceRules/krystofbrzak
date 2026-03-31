(function initI18n() {
    let translations = {};
    const DEFAULT_LANG = "en";

    /**
     * Read the current language from the lang query parameter, e.g. ?lang=cs.
     */
    function getLangFromUrl() {
        const url = new URL(window.location.href);
        const lang = url.searchParams.get("lang");

        return lang && translations[lang] ? lang : null;
    }

    /**
     * Keep the language-specific query parameter in sync with the selected locale.
     */
    function updateUrlForLanguage(lang) {
        const url = new URL(window.location.href);
        url.searchParams.set("lang", lang);
        window.history.replaceState({}, "", url);
        updateCanonical(url);
    }

    /**
     * Update the canonical link whenever the language-specific URL changes.
     */
    function updateCanonical(url = new URL(window.location.href)) {
        const canonical = document.getElementById("canonical-link");
        const lang = url.searchParams.get("lang") || detectLanguage();

        if (canonical) {
            canonical.href = `${url.origin}${url.pathname}?lang=${lang}`;
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
     * Keep internal cross-page links aligned with the currently selected language.
     */
    function updateLocalizedLinks(lang) {
        document.querySelectorAll("[data-lang-href]").forEach((element) => {
            const rawTarget = element.dataset.langHref;

            if (!rawTarget) {
                return;
            }

            const [path, hash = ""] = rawTarget.split("#");
            const targetUrl = new URL(path || window.location.pathname, window.location.href);

            targetUrl.searchParams.set("lang", lang);
            targetUrl.hash = hash ? `#${hash}` : "";
            element.href = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
        });
    }

    /**
     * Keep document prefetch hints aligned with the active language.
     */
    function updatePrefetchLinks(lang) {
        document.querySelectorAll("link[data-lang-prefetch]").forEach((element) => {
            const rawTarget = element.dataset.langPrefetch;

            if (!rawTarget) {
                return;
            }

            const targetUrl = new URL(rawTarget, window.location.href);
            targetUrl.searchParams.set("lang", lang);
            element.href = `${targetUrl.pathname}${targetUrl.search}`;
        });
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
        updateLocalizedLinks(lang);
        updatePrefetchLinks(lang);
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
