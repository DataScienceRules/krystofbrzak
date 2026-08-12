(function initBlogPage() {
    function isBlogPage() {
        return document.body.classList.contains("blog-page");
    }

    function trackEvent(eventName, payload = {}) {
        if (typeof window.gtag !== "function") {
            return;
        }

        window.gtag("event", eventName, payload);
    }

    function getTagFromUrl() {
        return new URL(window.location.href).searchParams.get("tag") || "";
    }

    function updateTagInUrl(tag, replace) {
        const url = new URL(window.location.href);

        if (tag) {
            url.searchParams.set("tag", tag);
        } else {
            url.searchParams.delete("tag");
        }

        const method = replace ? "replaceState" : "pushState";
        window.history[method]({ tag }, "", url);
    }

    function applyFilter(tag) {
        const grid = document.getElementById("blog-grid");
        const emptyState = document.getElementById("blog-empty-state");

        if (!grid) {
            return;
        }

        let visibleCount = 0;

        grid.querySelectorAll(".blog-article-card").forEach((card) => {
            const cardTags = (card.dataset.tags || "").split(",").filter(Boolean);
            const matches = !tag || cardTags.includes(tag);
            card.hidden = !matches;

            if (matches) {
                visibleCount += 1;
            }
        });

        if (emptyState) {
            emptyState.hidden = visibleCount > 0;
        }

        document.querySelectorAll(".blog-filter-button").forEach((button) => {
            button.classList.toggle("active", (button.dataset.tag || "") === tag);
        });
    }

    function initTagFiltering() {
        const grid = document.getElementById("blog-grid");

        if (!grid) {
            return;
        }

        document.querySelectorAll(".blog-filter-button").forEach((button) => {
            button.addEventListener("click", () => {
                const tag = button.dataset.tag || "";
                updateTagInUrl(tag, false);
                applyFilter(tag);
            });
        });

        window.addEventListener("popstate", () => applyFilter(getTagFromUrl()));
        applyFilter(getTagFromUrl());
    }

    function initReadingAnalytics() {
        const article = document.querySelector(".blog-article-view[data-article-id]");

        if (!article) {
            return;
        }

        const articleId = article.dataset.articleId;
        const articleTag = article.dataset.articleTag || "untagged";
        const readingTimeMinutes = Number(article.dataset.readingMinutes) || undefined;
        const articleTitle =
            document.querySelector(".blog-article-title")?.textContent?.trim() || articleId;
        const engagedThresholdSeconds = 20;
        const startedAt = Date.now();
        let engagedSent = false;

        trackEvent("blog_article_open", {
            article_id: articleId,
            article_title: articleTitle,
            article_tag: articleTag,
            reading_time_minutes: readingTimeMinutes
        });

        function sendEngaged(elapsedSeconds, trigger) {
            if (engagedSent) {
                return;
            }

            engagedSent = true;
            trackEvent("blog_article_engaged", {
                article_id: articleId,
                article_title: articleTitle,
                article_tag: articleTag,
                engaged_seconds: Math.round(elapsedSeconds),
                trigger
            });
        }

        const timerId = window.setTimeout(() => {
            if (document.hidden) {
                return;
            }

            sendEngaged(engagedThresholdSeconds, "timer");
        }, engagedThresholdSeconds * 1000);

        window.addEventListener("pagehide", () => {
            window.clearTimeout(timerId);
            const elapsedSeconds = (Date.now() - startedAt) / 1000;

            if (elapsedSeconds >= engagedThresholdSeconds) {
                sendEngaged(elapsedSeconds, "page_unload");
            }
        });
    }

    function bootstrapBlog() {
        if (!isBlogPage()) {
            return;
        }

        initTagFiltering();
        initReadingAnalytics();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrapBlog, { once: true });
    } else {
        bootstrapBlog();
    }
})();
