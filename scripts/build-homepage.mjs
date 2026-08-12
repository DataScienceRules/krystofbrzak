#!/usr/bin/env node
// Static site generation for the homepage. Reads the hand-authored template
// (scripts/templates/homepage.template.html) + translations.json and writes a
// fully pre-rendered page per language to /, /en/, /de/ — no client-side
// translation fetch, real per-language canonical/hreflang/meta tags.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    LANGS,
    DEFAULT_LANG,
    OG_LOCALE,
    MONOGRAM_ARIA,
    FLAG_ARIA,
    CURRENT_LANG_ARIA,
    homePath,
    blogListPath,
    absoluteUrl,
    urlPathToFsPath,
    escapeAttr,
    applyDataTranslate,
    rootRelativizeAssets,
    renderLangRedirectScript
} from "./lib/shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const TEMPLATE_PATH = path.join(__dirname, "templates", "homepage.template.html");
const TRANSLATIONS_PATH = path.join(ROOT, "translations.json");

const OG_META = {
    cs: {
        title: "Kryštof Brzák | Projektové vedení, vývoj systémů a delivery",
        description: "Projektové vedení, týmová koordinace a technický přesah. Osobní web Kryštofa Brzáka."
    },
    en: {
        title: "Kryštof Brzák | Project management, systems development and delivery",
        description: "Project management, team coordination, and technical depth. Kryštof Brzák's personal website."
    },
    de: {
        title: "Kryštof Brzák | Projektmanagement, Systementwicklung und Delivery",
        description: "Projektmanagement, Teamkoordination und technischer Hintergrund. Persönliche Website von Kryštof Brzák."
    }
};

function replaceOnce(html, search, replacement, label) {
    if (!html.includes(search)) {
        throw new Error(`Homepage template is missing an expected block: ${label}`);
    }

    return html.replace(search, replacement);
}

function buildHeadReplacement(lang) {
    const canonicalUrl = absoluteUrl(homePath(lang));
    const hreflangs = [
        ...LANGS.map((l) => `    <link rel="alternate" hreflang="${l}" href="${absoluteUrl(homePath(l))}">`),
        `    <link rel="alternate" hreflang="x-default" href="${absoluteUrl(homePath(DEFAULT_LANG))}">`
    ].join("\n");
    const meta = OG_META[lang];

    return `    <meta name="description" content="${escapeAttr(meta.description)}">

    <link rel="canonical" href="${canonicalUrl}">
${hreflangs}
    <link rel="prefetch" href="${blogListPath(lang)}">

    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Kryštof Brzák">
    <meta property="og:locale" content="${OG_LOCALE[lang]}">
    <meta property="og:title" content="${escapeAttr(meta.title)}">
    <meta property="og:description" content="${escapeAttr(meta.description)}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="https://krystofbrzak.com/favicon/android-chrome-512x512.png">
    <meta property="og:image:alt" content="Kryštof Brzák">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="512">
    <meta property="og:image:height" content="512">`;
}

function buildLangDropdownReplacement(lang) {
    const flags = LANGS.map((optionLang) => {
        const active = optionLang === lang ? " active" : "";
        return `                <a href="${homePath(optionLang)}" class="flag${active}" data-lang="${optionLang}" aria-label="${escapeAttr(FLAG_ARIA[optionLang])}">${optionLang.toUpperCase()}</a>`;
    }).join("\n");

    return `        <div class="lang-dropdown">
            <div class="selected-lang">
                <span class="flag" data-lang="${lang}" aria-label="${escapeAttr(CURRENT_LANG_ARIA[lang])}">${lang.toUpperCase()}</span>
            </div>

            <div class="lang-options">
${flags}
            </div>
        </div>`;
}

function buildHomepage(lang, template, translations) {
    let html = template;

    html = replaceOnce(html, '<html lang="cs">', `<html lang="${lang}">`, "<html> tag");

    html = replaceOnce(
        html,
        `    <link rel="canonical" id="canonical-link" href="https://krystofbrzak.com/?lang=cs">
    <link rel="prefetch" href="blog/" data-lang-path-map='{"cs":"blog/","en":"en/blog/","de":"de/blog/"}'>

    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Kryštof Brzák">
    <meta property="og:locale" content="cs_CZ">
    <meta property="og:title" content="Kryštof Brzák | Projektové vedení, vývoj systémů a delivery">
    <meta property="og:description" content="Projektové vedení, týmová koordinace a technický přesah. Osobní web Kryštofa Brzáka.">
    <meta property="og:url" content="https://krystofbrzak.com/?lang=cs">
    <meta property="og:image" content="https://krystofbrzak.com/favicon/android-chrome-512x512.png">
    <meta property="og:image:alt" content="Kryštof Brzák">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="512">
    <meta property="og:image:height" content="512">`,
        buildHeadReplacement(lang),
        "canonical/OG head block"
    );

    html = replaceOnce(
        html,
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        `<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\n${renderLangRedirectScript()}`,
        "viewport meta (redirect script anchor)"
    );

    html = replaceOnce(
        html,
        'aria-label="Přejít na profil"',
        `aria-label="${escapeAttr(MONOGRAM_ARIA[lang])}"`,
        "monogram aria-label"
    );

    html = replaceOnce(
        html,
        '<a href="blog/" class="scroll" data-lang-path-map=\'{"cs":"blog/","en":"en/blog/","de":"de/blog/"}\' data-translate="menu.etymology"></a>',
        `<a href="${blogListPath(lang)}" class="scroll" data-translate="menu.etymology"></a>`,
        "Blog nav link"
    );

    html = replaceOnce(
        html,
        `        <div class="lang-dropdown">
            <div class="selected-lang">
                <span class="flag" data-lang="cs" aria-label="Current language">CS</span>
            </div>

            <div class="lang-options">
                <button type="button" class="flag" data-lang="cs" aria-label="Cestina">CS</button>
                <button type="button" class="flag" data-lang="en" aria-label="English">EN</button>
                <button type="button" class="flag" data-lang="de" aria-label="Deutsch">DE</button>

            </div>
        </div>`,
        buildLangDropdownReplacement(lang),
        "language dropdown"
    );

    html = replaceOnce(
        html,
        '    <script src="i18n.js" defer></script>\n    <script src="site-ui.js" defer></script>',
        '    <script src="site-ui.js" defer></script>',
        "script tags (drop i18n.js)"
    );

    html = applyDataTranslate(html, translations, lang);
    html = rootRelativizeAssets(html);

    return html;
}

async function main() {
    const template = (await fs.readFile(TEMPLATE_PATH, "utf8")).replace(/\r\n/g, "\n");
    const translations = JSON.parse(await fs.readFile(TRANSLATIONS_PATH, "utf8"));

    for (const lang of LANGS) {
        const html = buildHomepage(lang, template, translations);
        const fsPath = urlPathToFsPath(ROOT, homePath(lang));
        await fs.mkdir(path.dirname(fsPath), { recursive: true });
        await fs.writeFile(fsPath, html, "utf8");
    }

    console.log(`Generated ${LANGS.length} homepage variants: ${LANGS.map((lang) => homePath(lang)).join(", ")}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
