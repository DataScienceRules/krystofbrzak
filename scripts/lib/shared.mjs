// Constants and helpers shared by every static-page generator (blog + homepage).
import path from "node:path";

export const SITE_URL = "https://krystofbrzak.com";
export const LANGS = ["cs", "en", "de"];
export const DEFAULT_LANG = "cs";

export const OG_LOCALE = { cs: "cs_CZ", en: "en_US", de: "de_DE" };

export const MONOGRAM_ARIA = {
    cs: "Přejít na profil",
    en: "Go to homepage",
    de: "Zur Startseite gehen"
};

export const FLAG_ARIA = { cs: "Čeština", en: "English", de: "Deutsch" };

export const CURRENT_LANG_ARIA = {
    cs: "Aktuální jazyk: Čeština",
    en: "Current language: English",
    de: "Aktuelle Sprache: Deutsch"
};

export function langPrefix(lang) {
    return lang === DEFAULT_LANG ? "" : `/${lang}`;
}

export function homePath(lang) {
    return lang === DEFAULT_LANG ? "/" : `/${lang}/`;
}

export function blogListPath(lang) {
    return `${langPrefix(lang)}/blog/`;
}

export function articlePath(lang, slug) {
    return `${langPrefix(lang)}/blog/${slug}/`;
}

export function absoluteUrl(urlPath) {
    return `${SITE_URL}${urlPath}`;
}

export function urlPathToFsPath(root, urlPath) {
    const segments = urlPath.split("/").filter(Boolean);
    return path.join(root, ...segments, "index.html");
}

export function slugify(value) {
    return value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

export function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, "&quot;");
}

export function toJsonLdScript(data) {
    return JSON.stringify(data, null, 4).replace(/<\//g, "<\\/");
}

/**
 * Safely read nested translation keys using dot notation (mirrors i18n.js's
 * former client-side resolver, so build-time and any leftover runtime logic
 * agree on lookup semantics).
 */
export function getNestedValue(obj, keyPath) {
    return keyPath.split(".").reduce((acc, part) => {
        return acc && acc[part] !== undefined ? acc[part] : undefined;
    }, obj);
}

/**
 * Bake every [data-translate] element's text at build time. Mirrors i18n.js's
 * former applyTranslations() fallback order: current language, then default
 * language, then the raw key as a last resort.
 */
export function applyDataTranslate(html, translations, lang) {
    const fallback = translations[DEFAULT_LANG] || {};
    const current = translations[lang] || fallback;

    return html.replace(
        /(<([a-zA-Z0-9-]+)([^>]*)\sdata-translate="([^"]+)"([^>]*)>)([\s\S]*?)(<\/\2>)/g,
        (match, openTag, tagName, beforeAttrs, key, afterAttrs, inner, closeTag) => {
            const value = getNestedValue(current, key) ?? getNestedValue(fallback, key) ?? key;
            return `${openTag}${escapeHtml(value)}${closeTag}`;
        }
    );
}

/**
 * Rewrite every author-relative asset reference (src/href/poster) to a
 * root-relative path, so the same markup works whether the generated page
 * lives at / or one level deep at /en/ or /de/.
 */
export function rootRelativizeAssets(html) {
    return html.replace(/\b(src|href|poster)="([^"]*)"/g, (match, attr, value) => {
        if (value === "" || /^(https?:|\/\/|\/|#|mailto:|data:|javascript:)/.test(value)) {
            return match;
        }

        return `${attr}="/${value}"`;
    });
}

/**
 * Inline, render-blocking redirect for legacy ?lang= links (the site used to
 * be entirely query-param localized). Derives the sibling URL by swapping
 * the language path prefix, so it works for the homepage and every blog
 * page alike without needing to know the site's full URL map.
 */
export function renderLangRedirectScript() {
    return `    <script>
    (function redirectLegacyLangQuery() {
        var params = new URLSearchParams(window.location.search);
        var requestedLang = params.get("lang");
        var LANGS = ${JSON.stringify(LANGS)};
        var DEFAULT_LANG = ${JSON.stringify(DEFAULT_LANG)};

        if (!requestedLang || LANGS.indexOf(requestedLang) === -1) {
            return;
        }

        var currentLang = document.documentElement.lang;
        params.delete("lang");
        var remainingQuery = params.toString();

        if (requestedLang === currentLang) {
            var cleanUrl = window.location.pathname + (remainingQuery ? "?" + remainingQuery : "") + window.location.hash;
            if (cleanUrl !== window.location.pathname + window.location.search + window.location.hash) {
                window.history.replaceState(null, "", cleanUrl);
            }
            return;
        }

        var segments = window.location.pathname.split("/").filter(Boolean);
        if (LANGS.indexOf(segments[0]) !== -1 && segments[0] !== DEFAULT_LANG) {
            segments.shift();
        }
        var suffix = segments.length ? "/" + segments.join("/") + "/" : "/";
        var prefix = requestedLang === DEFAULT_LANG ? "" : "/" + requestedLang;
        var target = prefix + suffix + (remainingQuery ? "?" + remainingQuery : "") + window.location.hash;
        window.location.replace(target);
    })();
    </script>`;
}
