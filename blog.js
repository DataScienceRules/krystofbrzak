(function initBlogPage() {
    const BLOG_DATA_URL = "blog-posts.json";
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
            backToList: "Zuruck zur Artikelubersicht",
            filtersAriaLabel: "Artikelfilter",
            minRead: (minutes) => `${minutes} Min. Lesezeit`
        }
    };

    let blogData = null;
    let transitionToken = 0;
    let readingSession = null;

    function trackEvent(eventName, payload = {}) {
        if (typeof window.gtag !== "function") {
            return;
        }

        window.gtag("event", eventName, payload);
    }

    function stopReadingSession(reason = "view_exit") {
        if (!readingSession) {
            return;
        }

        const elapsedSeconds =
            (Date.now() - readingSession.startedAt) / 1000;

        if (
            !readingSession.engagedSent &&
            elapsedSeconds >= readingSession.engagedThresholdSeconds
        ) {
            trackEvent("blog_article_engaged", {
                article_id: readingSession.articleId,
                article_title: readingSession.articleTitle,
                article_tag: readingSession.primaryTag,
                engaged_seconds: Math.round(elapsedSeconds),
                trigger: reason
            });
        }

        if (readingSession.timerId) {
            window.clearTimeout(readingSession.timerId);
        }

        readingSession = null;
    }

    function startReadingSession(article, localizedArticle) {
        stopReadingSession("article_switch");

        readingSession = {
            articleId: article.id,
            articleTitle: localizedArticle.title,
            primaryTag: article.tags[0] || "untagged",
            startedAt: Date.now(),
            engagedThresholdSeconds: 20,
            engagedSent: false,
            timerId: null
        };

        trackEvent("blog_article_open", {
            article_id: article.id,
            article_title: localizedArticle.title,
            article_tag: article.tags[0] || "untagged",
            reading_time_minutes: article.readingTime
        });

        readingSession.timerId = window.setTimeout(() => {
            if (!readingSession || readingSession.articleId !== article.id) {
                return;
            }

            if (document.hidden) {
                return;
            }

            readingSession.engagedSent = true;
            trackEvent("blog_article_engaged", {
                article_id: article.id,
                article_title: localizedArticle.title,
                article_tag: article.tags[0] || "untagged",
                engaged_seconds: readingSession.engagedThresholdSeconds,
                trigger: "timer"
            });
        }, readingSession.engagedThresholdSeconds * 1000);
    }

    function isBlogPage() {
        return document.body.classList.contains("blog-page");
    }

    function getLanguage() {
        if (typeof window.getCurrentLanguage === "function") {
            return window.getCurrentLanguage();
        }

        return document.documentElement.lang || "en";
    }

    function getUiText(lang) {
        return BLOG_UI[lang] || BLOG_UI.en;
    }

    function getTagLabel(tagId, lang) {
        return (
            blogData.tags?.[tagId]?.labels?.[lang] ||
            blogData.tags?.[tagId]?.labels?.en ||
            tagId
        );
    }

    function getLocalizedArticle(article, lang) {
        return article.locales?.[lang] || article.locales?.en || null;
    }

    function getCurrentTagFromUrl() {
        const url = new URL(window.location.href);
        return url.searchParams.get("tag") || "";
    }

    function getCurrentArticleIdFromUrl() {
        const url = new URL(window.location.href);
        return url.searchParams.get("article") || "";
    }

    function formatArticleDate(dateString, lang) {
        try {
            return new Intl.DateTimeFormat(lang, {
                day: "numeric",
                month: "long",
                year: "numeric"
            }).format(new Date(dateString));
        } catch (error) {
            return dateString;
        }
    }

    function getFilteredArticles(tagId) {
        if (!blogData?.articles) {
            return [];
        }

        if (!tagId) {
            return blogData.articles;
        }

        return blogData.articles.filter((article) => article.tags.includes(tagId));
    }

    function updateBlogUrl(nextState, replace = false) {
        const url = new URL(window.location.href);

        if (nextState.tag) {
            url.searchParams.set("tag", nextState.tag);
        } else {
            url.searchParams.delete("tag");
        }

        if (nextState.article) {
            url.searchParams.set("article", nextState.article);
        } else {
            url.searchParams.delete("article");
        }

        const historyState = {
            tag: nextState.tag || "",
            article: nextState.article || ""
        };

        if (replace) {
            window.history.replaceState(historyState, "", url);
            return;
        }

        window.history.pushState(historyState, "", url);
    }

    function createTagPill(tagId, lang) {
        const tag = document.createElement("span");
        tag.className = "blog-tag";
        tag.textContent = getTagLabel(tagId, lang);
        return tag;
    }

    function renderFilters(lang, selectedTag) {
        const filtersRoot = document.getElementById("blog-filters");
        const ui = getUiText(lang);

        if (!filtersRoot || !blogData?.tags) {
            return;
        }

        filtersRoot.innerHTML = "";
        filtersRoot.setAttribute("aria-label", ui.filtersAriaLabel);

        const allButton = document.createElement("button");
        allButton.type = "button";
        allButton.className = "blog-filter-button";
        allButton.textContent = ui.allTopics;
        allButton.classList.toggle("active", !selectedTag);
        allButton.addEventListener("click", () => {
            updateBlogUrl({ tag: "", article: "" });
            renderBlogPage(true);
        });
        filtersRoot.appendChild(allButton);

        Object.keys(blogData.tags).forEach((tagId) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "blog-filter-button";
            button.textContent = getTagLabel(tagId, lang);
            button.classList.toggle("active", selectedTag === tagId);
            button.addEventListener("click", () => {
                updateBlogUrl({ tag: tagId, article: "" });
                renderBlogPage(true);
            });
            filtersRoot.appendChild(button);
        });
    }

    function renderArticleCards(lang, selectedTag) {
        const listView = document.getElementById("blog-list-view");
        const articleView = document.getElementById("blog-article-view");
        const grid = document.getElementById("blog-grid");
        const emptyState = document.getElementById("blog-empty-state");
        const ui = getUiText(lang);
        const filteredArticles = getFilteredArticles(selectedTag);

        if (!listView || !articleView || !grid || !emptyState) {
            return;
        }

        stopReadingSession("back_to_list");
        articleView.hidden = true;
        listView.hidden = false;
        grid.innerHTML = "";

        if (!filteredArticles.length) {
            emptyState.hidden = false;
            emptyState.textContent = ui.noArticles;
            return;
        }

        emptyState.hidden = true;

        filteredArticles.forEach((article) => {
            const localizedArticle = getLocalizedArticle(article, lang);

            if (!localizedArticle) {
                return;
            }

            const card = document.createElement("button");
            card.type = "button";
            card.className = "blog-article-card";
            card.addEventListener("click", () => {
                updateBlogUrl({ tag: selectedTag, article: article.id });
                renderBlogPage(true);
            });

            const image = document.createElement("img");
            image.className = "blog-card-image";
            image.src = article.image.src;
            image.alt =
                article.image.alt?.[lang] ||
                article.image.alt?.en ||
                localizedArticle.title;
            image.loading = "lazy";
            card.appendChild(image);

            const body = document.createElement("div");
            body.className = "blog-card-body";

            const meta = document.createElement("div");
            meta.className = "blog-card-meta";
            meta.textContent = `${formatArticleDate(article.date, lang)} | ${ui.minRead(article.readingTime)}`;
            body.appendChild(meta);

            const title = document.createElement("h3");
            title.textContent = localizedArticle.title;
            body.appendChild(title);

            const excerpt = document.createElement("p");
            excerpt.textContent = localizedArticle.excerpt;
            body.appendChild(excerpt);

            const tags = document.createElement("div");
            tags.className = "blog-card-tags";
            article.tags.forEach((tagId) => {
                tags.appendChild(createTagPill(tagId, lang));
            });
            body.appendChild(tags);

            card.appendChild(body);
            grid.appendChild(card);
        });
    }

    function renderArticleDetail(lang, selectedTag, articleId) {
        const listView = document.getElementById("blog-list-view");
        const articleView = document.getElementById("blog-article-view");
        const ui = getUiText(lang);
        const article = blogData?.articles?.find((item) => item.id === articleId);

        if (!listView || !articleView) {
            return;
        }

        if (!article) {
            updateBlogUrl({ tag: selectedTag, article: "" }, true);
            renderArticleCards(lang, selectedTag);
            return;
        }

        if (selectedTag && !article.tags.includes(selectedTag)) {
            updateBlogUrl({ tag: selectedTag, article: "" }, true);
            renderArticleCards(lang, selectedTag);
            return;
        }

        const localizedArticle = getLocalizedArticle(article, lang);

        if (!localizedArticle) {
            renderArticleCards(lang, selectedTag);
            return;
        }

        startReadingSession(article, localizedArticle);
        listView.hidden = true;
        articleView.hidden = false;
        articleView.innerHTML = "";

        const backButton = document.createElement("button");
        backButton.type = "button";
        backButton.className = "blog-back-button";
        backButton.textContent = ui.backToList;
        backButton.addEventListener("click", () => {
            updateBlogUrl({ tag: selectedTag, article: "" });
            renderBlogPage(true);
        });
        articleView.appendChild(backButton);

        const heroImage = document.createElement("img");
        heroImage.className = "blog-article-hero";
        heroImage.src = article.image.src;
        heroImage.alt =
            article.image.alt?.[lang] ||
            article.image.alt?.en ||
            localizedArticle.title;
        articleView.appendChild(heroImage);

        const meta = document.createElement("div");
        meta.className = "blog-article-meta";
        meta.textContent = `${formatArticleDate(article.date, lang)} | ${ui.minRead(article.readingTime)}`;
        articleView.appendChild(meta);

        const title = document.createElement("h2");
        title.className = "blog-article-title";
        title.textContent = localizedArticle.title;
        articleView.appendChild(title);

        const tagList = document.createElement("div");
        tagList.className = "blog-article-tags";
        article.tags.forEach((tagId) => {
            tagList.appendChild(createTagPill(tagId, lang));
        });
        articleView.appendChild(tagList);

        localizedArticle.content.forEach((paragraphText) => {
            const paragraph = document.createElement("p");
            paragraph.className = "blog-article-paragraph";
            paragraph.textContent = paragraphText;
            articleView.appendChild(paragraph);
        });
    }

    function updateStaticUi(lang) {
        const ui = getUiText(lang);

        document.querySelectorAll("[data-blog-ui]").forEach((element) => {
            const key = element.dataset.blogUi;
            const value = ui[key];

            if (typeof value === "string") {
                element.textContent = value;
            }
        });
    }

    function applyBlogViewState(lang, selectedTag, articleId) {
        updateStaticUi(lang);
        renderFilters(lang, selectedTag);

        if (articleId) {
            renderArticleDetail(lang, selectedTag, articleId);
            return;
        }

        renderArticleCards(lang, selectedTag);
    }

    function runViewTransition(renderAction) {
        const blogMain = document.querySelector(".blog-main");

        if (!blogMain) {
            renderAction();
            return;
        }

        transitionToken += 1;
        const currentToken = transitionToken;

        blogMain.classList.add("blog-transition-out");
        blogMain.classList.remove("blog-transition-in");

        window.setTimeout(() => {
            if (currentToken !== transitionToken) {
                return;
            }

            renderAction();

            blogMain.classList.remove("blog-transition-out");
            blogMain.classList.add("blog-transition-in");

            window.setTimeout(() => {
                if (currentToken !== transitionToken) {
                    return;
                }

                blogMain.classList.remove("blog-transition-in");
            }, 180);
        }, 120);
    }

    function renderBlogPage(useTransition = false) {
        if (!blogData) {
            return;
        }

        const lang = getLanguage();
        const selectedTag = getCurrentTagFromUrl();
        const articleId = getCurrentArticleIdFromUrl();
        const renderAction = () =>
            applyBlogViewState(lang, selectedTag, articleId);

        if (useTransition) {
            runViewTransition(renderAction);
            return;
        }

        renderAction();
    }

    async function loadBlogData() {
        const response = await fetch(`${BLOG_DATA_URL}?v=${Date.now()}`);

        if (!response.ok) {
            throw new Error("Failed to load blog-posts.json");
        }

        blogData = await response.json();
    }

    async function bootstrapBlog() {
        if (!isBlogPage()) {
            return;
        }

        try {
            await loadBlogData();
            renderBlogPage();
            window.addEventListener("popstate", () => renderBlogPage(true));
            document.addEventListener("languagechange", () => renderBlogPage(true));
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    stopReadingSession("tab_hidden");
                }
            });
            window.addEventListener("beforeunload", () => {
                stopReadingSession("page_unload");
            });
        } catch (error) {
            console.error("Blog loading error:", error);
        }
    }

    document.addEventListener("DOMContentLoaded", bootstrapBlog);
})();
