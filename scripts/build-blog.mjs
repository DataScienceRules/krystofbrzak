#!/usr/bin/env node
// Static site generation for the blog. Reads blog-posts.json + translations.json
// and writes fully pre-rendered HTML for every article and blog list, per language,
// so GitHub Pages can serve crawlable, shareable pages without any client-side fetch.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    SITE_URL,
    LANGS,
    DEFAULT_LANG,
    OG_LOCALE,
    MONOGRAM_ARIA,
    FLAG_ARIA,
    CURRENT_LANG_ARIA,
    homePath,
    blogListPath,
    articlePath,
    absoluteUrl,
    urlPathToFsPath,
    slugify,
    escapeHtml,
    escapeAttr,
    toJsonLdScript,
    renderLangRedirectScript
} from "./lib/shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BLOG_POSTS_PATH = path.join(ROOT, "blog-posts.json");
const TRANSLATIONS_PATH = path.join(ROOT, "translations.json");
const SITEMAP_PATH = path.join(ROOT, "sitemap.xml");

const DATE_LOCALE = { cs: "cs-CZ", en: "en-US", de: "de-DE" };

const BLOG_UI = {
    cs: {
        allTopics: "Všechny články",
        noArticles: "K tomuto tagu zatím není přiřazený žádný článek.",
        backToList: "Zpět na přehled článků",
        filtersAriaLabel: "Filtr článků",
        minRead: (minutes) => `${minutes} min. čtení`
    },
    en: {
        allTopics: "All articles",
        noArticles: "There are no articles for this tag yet.",
        backToList: "Back to article list",
        filtersAriaLabel: "Article filters",
        minRead: (minutes) => `${minutes} min. read`
    },
    de: {
        allTopics: "Alle Artikel",
        noArticles: "Zu diesem Tag gibt es noch keine Artikel.",
        backToList: "Zurück zur Artikelübersicht",
        filtersAriaLabel: "Artikelfilter",
        minRead: (minutes) => `${minutes} Min. Lesezeit`
    }
};

function toRootRelativeAsset(src) {
    const withoutParents = src.replace(/^(\.\.\/)+/, "/");
    const rooted = withoutParents.startsWith("/") ? withoutParents : `/${withoutParents}`;
    return encodeURI(rooted);
}

function formatDate(dateString, lang) {
    return new Intl.DateTimeFormat(DATE_LOCALE[lang], {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(new Date(dateString));
}

function getArticleParagraphs(localizedArticle) {
    return (localizedArticle.content || [])
        .flatMap((block) =>
            String(block)
                .split(/\n\s*\n|\n/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
        );
}

function tagLabel(tags, tagId, lang) {
    return tags?.[tagId]?.labels?.[lang] || tags?.[tagId]?.labels?.en || tagId;
}

function renderHead({
    lang,
    title,
    description,
    canonicalUrl,
    hreflangs,
    ogType,
    ogImage,
    ogImageAlt,
    prefetchHref,
    jsonLd
}) {
    const hreflangLinks = hreflangs
        .map((alt) => `    <link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}">`)
        .join("\n");

    return `<head>
    <link rel="stylesheet" href="/style.css">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeAttr(description)}">
${renderLangRedirectScript()}

    <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png">
    <link rel="manifest" href="/favicon/site.webmanifest">
    <link rel="canonical" href="${canonicalUrl}">
${hreflangLinks}
    <link rel="prefetch" href="${prefetchHref}">

    <meta property="og:type" content="${ogType}">
    <meta property="og:site_name" content="Kryštof Brzák">
    <meta property="og:locale" content="${OG_LOCALE[lang]}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:image:alt" content="${escapeAttr(ogImageAlt)}">
${jsonLd ? `    <script type="application/ld+json">\n${jsonLd}\n    </script>\n` : ""}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,200;1,300;1,400;1,500;1,600;1,700;1,800&display=swap" rel="stylesheet">

    <title>${escapeHtml(title)}</title>
</head>`;
}

function renderHeader({ lang, translations, blogListHref, langLinks }) {
    const menu = translations[lang].menu;
    const homeProfile = `${homePath(lang)}?intro=skip#profile`;
    const homeJourney = `${homePath(lang)}#journey`;
    const homeContact = `${homePath(lang)}#contact`;

    const flagOptions = LANGS.map((optionLang) => {
        const href = langLinks[optionLang];
        return `                <a href="${href}" class="flag${optionLang === lang ? " active" : ""}" data-lang="${optionLang}" aria-label="${escapeAttr(FLAG_ARIA[optionLang])}">${optionLang.toUpperCase()}</a>`;
    }).join("\n");

    return `<header class="header">
    <a href="${homeProfile}" class="monogram-link scroll" aria-label="${escapeAttr(MONOGRAM_ARIA[lang])}">
        <img src="/photos/alrfhowhtf0vr9ctvpat.avif" alt="KB" class="monogram" width="48" height="48" decoding="async">
    </a>

    <nav id="nav-menu" class="nav">
        <a href="${homeProfile}" class="scroll">${escapeHtml(menu.profile)}</a>
        <a href="${homeJourney}" class="scroll">${escapeHtml(menu.journey)}</a>
        <a href="${blogListHref}" class="scroll active" aria-current="page">${escapeHtml(menu.etymology)}</a>
        <a href="${homeContact}" class="scroll">${escapeHtml(menu.contact)}</a>
        <div class="lang-dropdown">
            <div class="selected-lang">
                <span class="flag" data-lang="${lang}" aria-label="${escapeAttr(CURRENT_LANG_ARIA[lang])}">${lang.toUpperCase()}</span>
            </div>

            <div class="lang-options">
${flagOptions}
            </div>
        </div>
    </nav>

    <div class="hamburger" id="hamburger">&#9776;</div>
</header>`;
}

function renderFooter(lang, translations) {
    return `<footer class="footer">
    <p>${escapeHtml(translations[lang].footer)}</p>
</footer>`;
}

function renderCard(article, lang, tags) {
    const localized = article.locales[lang];
    const href = articlePath(lang, article.slug);
    const imgSrc = toRootRelativeAsset(article.image.src);
    const alt = article.image.alt[lang] || article.image.alt.en || localized.title;
    const dateLabel = formatDate(article.date, lang);
    const uiText = BLOG_UI[lang];
    const tagsHtml = article.tags
        .map((tagId) => `<span class="blog-tag">${escapeHtml(tagLabel(tags, tagId, lang))}</span>`)
        .join("");

    return `                    <a href="${href}" class="blog-article-card" data-tags="${escapeAttr(article.tags.join(","))}">
                        <img class="blog-card-image" src="${imgSrc}" alt="${escapeAttr(alt)}" loading="lazy">
                        <div class="blog-card-body">
                            <div class="blog-card-meta">${dateLabel} | ${uiText.minRead(article.readingTime)}</div>
                            <h3>${escapeHtml(localized.title)}</h3>
                            <p>${escapeHtml(localized.excerpt)}</p>
                            <div class="blog-card-tags">${tagsHtml}</div>
                        </div>
                    </a>`;
}

function renderListBody({ lang, tags, articles }) {
    const uiText = BLOG_UI[lang];
    const filterButtons = [
        `                    <button type="button" class="blog-filter-button active" data-tag="">${escapeHtml(uiText.allTopics)}</button>`,
        ...Object.keys(tags).map(
            (tagId) =>
                `                    <button type="button" class="blog-filter-button" data-tag="${escapeAttr(tagId)}">${escapeHtml(tagLabel(tags, tagId, lang))}</button>`
        )
    ].join("\n");

    const cards = articles
        .filter((article) => article.locales[lang])
        .map((article) => renderCard(article, lang, tags))
        .join("\n");

    return `<div class="container">
    <section id="blog" class="section">
        <div class="blog-layout">
            <aside class="blog-sidebar">
                <div class="blog-sidebar-card">
                    <div id="blog-filters" class="blog-filters" aria-label="${escapeAttr(uiText.filtersAriaLabel)}">
${filterButtons}
                    </div>
                </div>
            </aside>

            <div class="blog-main">
                <div id="blog-list-view" class="blog-list-view">
                    <div id="blog-grid" class="blog-grid">
${cards}
                    </div>
                    <div id="blog-empty-state" class="blog-empty-state" hidden>${escapeHtml(uiText.noArticles)}</div>
                </div>
            </div>
        </div>
    </section>
</div>`;
}

function renderArticleBody({ lang, article, tags, backHref }) {
    const uiText = BLOG_UI[lang];
    const localized = article.locales[lang];
    const imgSrc = toRootRelativeAsset(article.image.src);
    const alt = article.image.alt[lang] || article.image.alt.en || localized.title;
    const dateLabel = formatDate(article.date, lang);
    const tagsHtml = article.tags
        .map((tagId) => `<span class="blog-tag">${escapeHtml(tagLabel(tags, tagId, lang))}</span>`)
        .join("");
    const paragraphs = getArticleParagraphs(localized)
        .map((paragraph) => `                    <p class="blog-article-paragraph">${escapeHtml(paragraph)}</p>`)
        .join("\n");

    return `<div class="container">
    <section id="blog" class="section">
        <div class="blog-layout is-article-detail">
            <div class="blog-main">
                <article class="blog-article-view" data-article-id="${escapeAttr(article.id)}" data-article-tag="${escapeAttr(article.tags[0] || "untagged")}" data-reading-minutes="${article.readingTime}">
                    <a href="${backHref}" class="blog-back-button">${escapeHtml(uiText.backToList)}</a>
                    <img class="blog-article-hero" src="${imgSrc}" alt="${escapeAttr(alt)}" loading="eager" decoding="async">
                    <div class="blog-article-meta">${dateLabel} | ${uiText.minRead(article.readingTime)}</div>
                    <h1 class="blog-article-title">${escapeHtml(localized.title)}</h1>
                    <div class="blog-article-tags">${tagsHtml}</div>
${paragraphs}
                </article>
            </div>
        </div>
    </section>
</div>`;
}

function renderPage({ lang, head, header, body, footer }) {
    return `<!DOCTYPE html>
<html lang="${lang}">
${head}
<body class="blog-page">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-QRFSJ7JYQR"></script>
<script src="/analytics.js" defer></script>

${header}

${body}

${footer}

<script src="/site-ui.js" defer></script>
<script src="/blog.js" defer></script>
</body>
</html>
`;
}

function buildListPage(lang, tags, articles, translations) {
    const canonicalUrl = absoluteUrl(blogListPath(lang));
    const hreflangs = [
        ...LANGS.map((l) => ({ hreflang: l, href: absoluteUrl(blogListPath(l)) })),
        { hreflang: "x-default", href: absoluteUrl(blogListPath(DEFAULT_LANG)) }
    ];
    const title = `${translations[lang].blog?.header || "Blog"} — Kryštof Brzák`;
    const description = translations[lang].blog?.intro || translations[lang].profile?.header || "Blog";

    const head = renderHead({
        lang,
        title,
        description,
        canonicalUrl,
        hreflangs,
        ogType: "website",
        ogImage: `${SITE_URL}/favicon/android-chrome-512x512.png`,
        ogImageAlt: "Kryštof Brzák",
        prefetchHref: homePath(lang),
        jsonLd: null
    });

    const langLinks = Object.fromEntries(LANGS.map((l) => [l, blogListPath(l)]));
    const header = renderHeader({ lang, translations, blogListHref: blogListPath(lang), langLinks });
    const body = renderListBody({ lang, tags, articles });
    const footer = renderFooter(lang, translations);

    return renderPage({ lang, head, header, body, footer });
}

function buildArticlePage(lang, article, tags, translations) {
    const localized = article.locales[lang];
    const canonicalUrl = absoluteUrl(articlePath(lang, article.slug));
    const availableLangs = LANGS.filter((l) => article.locales[l]);
    const hreflangs = [
        ...availableLangs.map((l) => ({ hreflang: l, href: absoluteUrl(articlePath(l, article.slug)) })),
        { hreflang: "x-default", href: absoluteUrl(articlePath(availableLangs.includes(DEFAULT_LANG) ? DEFAULT_LANG : availableLangs[0], article.slug)) }
    ];
    const imageUrl = `${SITE_URL}${toRootRelativeAsset(article.image.src)}`;
    const title = `${localized.title} — Kryštof Brzák`;

    const jsonLd = toJsonLdScript({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: localized.title,
        description: localized.excerpt,
        image: imageUrl,
        datePublished: article.date,
        inLanguage: lang,
        author: { "@type": "Person", name: "Kryštof Brzák", url: `${SITE_URL}/` },
        publisher: { "@type": "Person", name: "Kryštof Brzák" },
        mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl }
    });

    const head = renderHead({
        lang,
        title,
        description: localized.excerpt,
        canonicalUrl,
        hreflangs,
        ogType: "article",
        ogImage: imageUrl,
        ogImageAlt: article.image.alt[lang] || article.image.alt.en || localized.title,
        prefetchHref: blogListPath(lang),
        jsonLd
    });

    const langLinks = Object.fromEntries(
        LANGS.map((l) => [l, article.locales[l] ? articlePath(l, article.slug) : blogListPath(l)])
    );
    const header = renderHeader({ lang, translations, blogListHref: blogListPath(lang), langLinks });
    const body = renderArticleBody({ lang, article, tags, backHref: blogListPath(lang) });
    const footer = renderFooter(lang, translations);

    return renderPage({ lang, head, header, body, footer });
}

async function writeSitemap(articles) {
    const homeUrls = LANGS.map((lang) => ({
        loc: absoluteUrl(homePath(lang)),
        alternates: [
            ...LANGS.map((l) => ({ hreflang: l, href: absoluteUrl(homePath(l)) })),
            { hreflang: "x-default", href: absoluteUrl(homePath(DEFAULT_LANG)) }
        ]
    }));

    const blogUrls = [];

    for (const lang of LANGS) {
        blogUrls.push({
            loc: absoluteUrl(blogListPath(lang)),
            alternates: LANGS.map((l) => ({ hreflang: l, href: absoluteUrl(blogListPath(l)) }))
        });
    }

    for (const article of articles) {
        const availableLangs = LANGS.filter((l) => article.locales[l]);

        for (const lang of availableLangs) {
            blogUrls.push({
                loc: absoluteUrl(articlePath(lang, article.slug)),
                lastmod: article.date,
                alternates: availableLangs.map((l) => ({ hreflang: l, href: absoluteUrl(articlePath(l, article.slug)) }))
            });
        }
    }

    const urlEntries = [...homeUrls, ...blogUrls]
        .map((entry) => {
            const lastmodTag = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : "";
            const alternateTags = (entry.alternates || [])
                .map((alt) => `\n    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}"/>`)
                .join("");
            return `  <url>\n    <loc>${entry.loc}</loc>${lastmodTag}${alternateTags}\n  </url>`;
        })
        .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urlEntries}\n</urlset>\n`;

    await fs.writeFile(SITEMAP_PATH, xml, "utf8");
}

async function main() {
    const blogData = JSON.parse(await fs.readFile(BLOG_POSTS_PATH, "utf8"));
    const translations = JSON.parse(await fs.readFile(TRANSLATIONS_PATH, "utf8"));

    const articles = blogData.articles.map((article) => ({ ...article, slug: slugify(article.id) }));

    const slugSet = new Set();
    for (const article of articles) {
        if (slugSet.has(article.slug)) {
            throw new Error(`Duplicate blog slug generated from id "${article.id}": ${article.slug}`);
        }
        slugSet.add(article.slug);
    }

    const outputFiles = [];

    for (const lang of LANGS) {
        outputFiles.push({
            urlPath: blogListPath(lang),
            content: buildListPage(lang, blogData.tags, articles, translations)
        });

        for (const article of articles) {
            if (!article.locales[lang]) {
                continue;
            }

            outputFiles.push({
                urlPath: articlePath(lang, article.slug),
                content: buildArticlePage(lang, article, blogData.tags, translations)
            });
        }
    }

    for (const file of outputFiles) {
        const fsPath = urlPathToFsPath(ROOT, file.urlPath);
        await fs.mkdir(path.dirname(fsPath), { recursive: true });
        await fs.writeFile(fsPath, file.content, "utf8");
    }

    await writeSitemap(articles);

    console.log(`Generated ${outputFiles.length} blog pages for ${articles.length} articles across ${LANGS.length} languages.`);
    console.log("Slugs:", articles.map((article) => article.slug).join(", "));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
