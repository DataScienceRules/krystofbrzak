(function initSiteUi() {
    const INTRO_SKIP_PARAM = "intro";
    const INTRO_SKIP_VALUE = "skip";
    const INTRO_SESSION_KEY = "krystofIntroAnimationPlayed";
    const INTRO_MOBILE_MEDIA_QUERY = "(max-width: 768px)";
    const HEADER_REVEAL_AFTER_SECONDS = 3;

    if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
    }

    function scrollToPageTop() {
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: "auto"
        });
    }

    function settlePageTop() {
        scrollToPageTop();
        window.requestAnimationFrame(scrollToPageTop);
        window.setTimeout(scrollToPageTop, 60);
        window.setTimeout(scrollToPageTop, 240);

        if (document.readyState !== "complete") {
            window.addEventListener("load", scrollToPageTop, { once: true });
        }
    }

    function shouldSettlePageTop() {
        return !window.location.hash || window.location.hash === "#profile";
    }

    function getNavigationType() {
        const navigationEntries = performance.getEntriesByType?.("navigation") || [];
        const navigationEntry = navigationEntries[0];

        if (navigationEntry?.type) {
            return navigationEntry.type;
        }

        if (performance.navigation?.type === 1) {
            return "reload";
        }

        return "navigate";
    }

    function hasIntroAnimationPlayed() {
        try {
            return window.sessionStorage.getItem(INTRO_SESSION_KEY) === "true";
        } catch {
            return false;
        }
    }

    function markIntroAnimationPlayed() {
        try {
            window.sessionStorage.setItem(INTRO_SESSION_KEY, "true");
        } catch {
            // Browsers can block sessionStorage in stricter privacy modes.
        }
    }

    function shouldSkipIntroAnimation() {
        const params = new URLSearchParams(window.location.search);

        if (params.get(INTRO_SKIP_PARAM) === INTRO_SKIP_VALUE) {
            return true;
        }

        if (getNavigationType() === "reload") {
            return false;
        }

        return hasIntroAnimationPlayed();
    }

    function clearIntroSkipParam() {
        const url = new URL(window.location.href);

        if (url.searchParams.get(INTRO_SKIP_PARAM) !== INTRO_SKIP_VALUE) {
            return;
        }

        url.searchParams.delete(INTRO_SKIP_PARAM);
        window.history.replaceState(
            window.history.state,
            "",
            `${url.pathname}${url.search}${url.hash}`
        );
    }

    function isMobileIntroViewport() {
        return window.matchMedia?.(INTRO_MOBILE_MEDIA_QUERY).matches || window.innerWidth <= 768;
    }

    /**
     * Toggle mobile navigation and language dropdown interactions.
     */
    function initNavigation() {
        const hamburger = document.getElementById("hamburger");
        const navMenu = document.getElementById("nav-menu");
        const langDropdown = document.querySelector(".lang-dropdown");
        const languageFlags = document.querySelectorAll(".lang-options .flag");

        if (!hamburger || !navMenu || !langDropdown) {
            return;
        }

        const syncMobileMenuState = () => {
            document.body.classList.toggle(
                "mobile-menu-open",
                navMenu.classList.contains("show")
            );
        };

        const closeMenus = () => {
            navMenu.classList.remove("show");
            langDropdown.classList.remove("open");
            syncMobileMenuState();
        };

        hamburger.addEventListener("click", (event) => {
            event.stopPropagation();
            navMenu.classList.toggle("show");
            syncMobileMenuState();
        });

        langDropdown.addEventListener("click", (event) => {
            event.stopPropagation();
            langDropdown.classList.toggle("open");
        });

        languageFlags.forEach((flag) => {
            flag.addEventListener("click", (event) => {
                event.stopPropagation();
                langDropdown.classList.remove("open");
                syncMobileMenuState();
            });
        });

        document.addEventListener("click", closeMenus);
    }

    /**
     * Animate external contact links with the existing jump CSS animation.
     */
    function initJumpLinks() {
        document.querySelectorAll(".jump").forEach((element) => {
            element.addEventListener("mouseenter", () => {
                element.classList.add("animate");

                window.setTimeout(() => {
                    element.classList.remove("animate");
                }, 400);
            });
        });
    }

    /**
     * Smooth-scroll navigation links that target sections on the same page.
     */
    function initSmoothScroll() {
        document.querySelectorAll(".scroll, .monogram").forEach((link) => {
            link.addEventListener("click", (event) => {
                const targetSelector = link.getAttribute("href");

                if (!targetSelector || !targetSelector.startsWith("#")) {
                    return;
                }

                const targetElement = document.querySelector(targetSelector);

                if (!targetElement) {
                    return;
                }

                event.preventDefault();
                const header = document.querySelector(".header");
                const headerOffset = header ? header.offsetHeight : 0;
                const extraOffset =
                    targetSelector === "#profile"
                        ? 0
                        : window.innerWidth <= 768 ? 14 : 24;
                const targetTop =
                    targetElement.getBoundingClientRect().top +
                    window.scrollY -
                    headerOffset -
                    extraOffset;

                window.scrollTo({
                    top: Math.max(targetTop, 0),
                    behavior: "smooth"
                });
            });
        });
    }

    /**
     * Make the intro video the default landing position on plain page visits.
     */
    function initLandingPage() {
        if (!shouldSettlePageTop()) {
            return;
        }

        settlePageTop();
    }

    /**
     * Keep the intro-video loader visible until the first playable frame is ready.
     */
    function initIntroVideoLoader() {
        const introSection = document.querySelector(".intro-video-section");
        const introVideo = introSection?.querySelector(".intro-video");
        const introFinalFrame = introSection?.querySelector(".intro-video-final-frame");
        const root = document.documentElement;
        const body = document.body;

        if (!introSection || !introVideo) {
            root.classList.remove("intro-scroll-locked");
            body.classList.remove("intro-scroll-locked", "intro-header-hidden");
            body.classList.add("intro-header-visible");
            return;
        }

        let isLoadingComplete = false;
        let isPlaybackStarting = false;
        let isHeaderVisible = false;
        let fallbackTimer = 0;
        const isMobileIntro = isMobileIntroViewport();

        root.classList.add("intro-scroll-locked");
        body.classList.add("intro-scroll-locked", "intro-header-hidden");
        body.classList.remove("intro-header-visible");

        function applyResponsiveIntroAssets({ loadVideo = false } = {}) {
            const variant = isMobileIntro ? "mobile" : "desktop";
            const videoSrc = introVideo.dataset[`${variant}Src`];
            const posterSrc = introVideo.dataset[`${variant}Poster`];
            const finalFrameSrc = introFinalFrame?.dataset[`${variant}Src`];

            if (posterSrc && introVideo.getAttribute("poster") !== posterSrc) {
                introVideo.setAttribute("poster", posterSrc);
            }

            if (introFinalFrame && finalFrameSrc && introFinalFrame.getAttribute("src") !== finalFrameSrc) {
                introFinalFrame.setAttribute("src", finalFrameSrc);
            }

            if (!loadVideo || !videoSrc || introVideo.getAttribute("src") === videoSrc) {
                return;
            }

            introVideo.setAttribute("src", videoSrc);
            introVideo.load();
        }

        function unlockScroll() {
            root.classList.remove("intro-scroll-locked");
            body.classList.remove("intro-scroll-locked");
        }

        function revealHeader() {
            if (isHeaderVisible) {
                return;
            }

            isHeaderVisible = true;
            body.classList.remove("intro-header-hidden");
            body.classList.add("intro-header-visible");
        }

        function maybeRevealHeader() {
            if (isHeaderVisible || !isLoadingComplete) {
                return;
            }

            if (introVideo.currentTime >= HEADER_REVEAL_AFTER_SECONDS) {
                revealHeader();
                return;
            }

            const duration = introVideo.duration;

            if (!Number.isFinite(duration) || duration <= 0) {
                return;
            }

            if (duration <= HEADER_REVEAL_AFTER_SECONDS) {
                revealHeader();
            }
        }

        function holdIntroFinalFrame() {
            introVideo.pause();
            introSection.classList.add("intro-video-final");
        }

        function completeIntroLoading({ revealHeaderNow = false } = {}) {
            if (isLoadingComplete) {
                return;
            }

            isLoadingComplete = true;
            window.clearTimeout(fallbackTimer);
            introSection.classList.remove("intro-video-loading");
            introSection.classList.add("intro-video-ready");
            introSection.setAttribute("aria-busy", "false");
            unlockScroll();

            if (revealHeaderNow) {
                revealHeader();
            } else {
                maybeRevealHeader();
            }
        }

        function bypassIntroLoading() {
            isLoadingComplete = true;
            holdIntroFinalFrame();

            introSection.classList.remove("intro-video-loading");
            introSection.classList.add("intro-video-ready");
            introSection.setAttribute("aria-busy", "false");
            unlockScroll();
            revealHeader();
            markIntroAnimationPlayed();
            clearIntroSkipParam();

            if (shouldSettlePageTop()) {
                settlePageTop();
            }
        }

        applyResponsiveIntroAssets();

        if (shouldSkipIntroAnimation()) {
            bypassIntroLoading();
            return;
        }

        markIntroAnimationPlayed();
        fallbackTimer = window.setTimeout(() => {
            completeIntroLoading({ revealHeaderNow: true });
        }, 10000);

        function startIntroVideo() {
            if (isPlaybackStarting || isLoadingComplete) {
                return;
            }

            isPlaybackStarting = true;

            if (!introVideo.paused && introVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                completeIntroLoading();
                return;
            }

            const playPromise = introVideo.play();

            if (playPromise && typeof playPromise.then === "function") {
                playPromise.then(() => {
                    completeIntroLoading();
                }).catch(() => {
                    completeIntroLoading({ revealHeaderNow: true });
                });
            } else {
                completeIntroLoading();
            }
        }

        introVideo.addEventListener("loadeddata", startIntroVideo, { once: true });
        introVideo.addEventListener("canplay", startIntroVideo, { once: true });
        introVideo.addEventListener("playing", () => completeIntroLoading(), { once: true });
        introVideo.addEventListener("timeupdate", maybeRevealHeader);
        introVideo.addEventListener("durationchange", maybeRevealHeader);
        introVideo.addEventListener("loadedmetadata", maybeRevealHeader);
        introVideo.addEventListener(
            "ended",
            () => {
                holdIntroFinalFrame();
                revealHeader();
            },
            { once: true }
        );
        introVideo.addEventListener(
            "error",
            () => {
                holdIntroFinalFrame();
                completeIntroLoading({ revealHeaderNow: true });
            },
            { once: true }
        );

        if (introVideo.error) {
            completeIntroLoading({ revealHeaderNow: true });
            return;
        }

        applyResponsiveIntroAssets({ loadVideo: true });

        if (introVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            startIntroVideo();
        }
    }

    /**
     * Fine-tune landing on hash targets after a full page navigation.
     */
    function initHashLanding() {
        if (!window.location.hash) {
            return;
        }

        const targetElement = document.querySelector(window.location.hash);

        if (!targetElement) {
            return;
        }

        const alignHashTarget = () => {
            if (window.location.hash === "#profile") {
                settlePageTop();
                return;
            }

            const header = document.querySelector(".header");
            const headerOffset = header ? header.offsetHeight : 0;
            const extraOffset =
                window.location.hash === "#profile"
                    ? 0
                    : window.innerWidth <= 768 ? 14 : 24;
            const targetTop =
                targetElement.getBoundingClientRect().top +
                window.scrollY -
                headerOffset -
                extraOffset;

            window.scrollTo({
                top: Math.max(targetTop, 0),
                behavior: "auto"
            });
        };

        window.requestAnimationFrame(alignHashTarget);
        window.setTimeout(alignHashTarget, 60);
        window.setTimeout(alignHashTarget, 240);

        if (document.readyState !== "complete") {
            window.addEventListener("load", alignHashTarget, { once: true });
        }
    }

    /**
     * Add a light page transition for cross-page navigation between index and blog.
     */
    function initPageTransitions() {
        document.querySelectorAll("a[data-lang-href]").forEach((link) => {
            link.addEventListener("click", (event) => {
                if (
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                ) {
                    return;
                }

                const href = link.getAttribute("href");

                if (!href || link.target === "_blank") {
                    return;
                }

                const targetUrl = new URL(href, window.location.href);
                const currentUrl = new URL(window.location.href);
                const sameDocument =
                    targetUrl.pathname === currentUrl.pathname &&
                    targetUrl.search === currentUrl.search &&
                    targetUrl.hash === currentUrl.hash;

                if (sameDocument) {
                    event.preventDefault();
                    return;
                }

                event.preventDefault();
                document.body.classList.add("page-transition-out");

                window.setTimeout(() => {
                    window.location.href = targetUrl.href;
                }, 180);
            });
        });
    }

    /**
     * Add a shared fade-in effect to text and media elements inside sections.
     */
    function initFadeIn() {
        const faders = document.querySelectorAll(
            "section .timeline-item, section .profile_card, section h2, section h3, section h4, section p, section .jump"
        );

        const appearOnScroll = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                });
            },
            {
                rootMargin: "-120px 0px -20% 0px",
                threshold: 0
            }
        );

        faders.forEach((element) => {
            if (element.matches(".blog-article-paragraph") || element.closest(".blog-list-view")) {
                return;
            }

            element.classList.add("fade-in-target");
            appearOnScroll.observe(element);
        });
    }

    /**
     * Highlight the currently visible section in the navigation.
     */
    function initActiveNav() {
        const sections = document.querySelectorAll("section[id]");
        const navLinks = document.querySelectorAll(".nav a");
        const sectionLinks = Array.from(navLinks).filter((link) => {
            const href = link.getAttribute("href");
            return href && href.startsWith("#");
        });
        const sectionLinkIds = new Set(
            sectionLinks.map((link) => link.getAttribute("href").slice(1))
        );
        const trackedSections = Array.from(sections).filter((section) =>
            sectionLinkIds.has(section.id)
        );

        if (!trackedSections.length || !sectionLinks.length) {
            return;
        }

        const updateActiveLink = () => {
            const header = document.querySelector(".header");
            const headerOffset = header ? header.offsetHeight : 0;
            const activationLine = headerOffset + (window.innerWidth <= 768 ? 12 : 28);
            let activeSection = trackedSections[0];

            trackedSections.forEach((section) => {
                if (section.getBoundingClientRect().top <= activationLine) {
                    activeSection = section;
                }
            });

            sectionLinks.forEach((link) => {
                link.classList.toggle(
                    "active",
                    link.getAttribute("href") === `#${activeSection.id}`
                );
            });
        };

        updateActiveLink();
        window.addEventListener("scroll", updateActiveLink, { passive: true });
        window.addEventListener("resize", updateActiveLink);
        window.setTimeout(updateActiveLink, 80);
    }

    /**
     * Position circle-scene items evenly around the orbit.
     */
    function updateCircleLayout() {
        const container = document.getElementById("circleScene");

        if (!container) {
            return;
        }

        const items = container.querySelectorAll(".circle-item");
        const count = items.length;

        if (!count) {
            return;
        }

        const width = container.offsetWidth;
        const height = container.offsetHeight;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 68;

        items.forEach((item, index) => {
            const angle = (index / count) * (2 * Math.PI) - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            item.style.left = `${x}px`;
            item.style.top = `${y}px`;
        });
    }

    /**
     * Re-run circle layout after the first render passes so absolute items
     * do not remain stacked if the container size settles a little later.
     */
    function initCircleLayout() {
        const container = document.getElementById("circleScene");

        if (!container) {
            return;
        }

        updateCircleLayout();
        window.requestAnimationFrame(updateCircleLayout);
        window.setTimeout(updateCircleLayout, 120);

        if (typeof ResizeObserver === "function") {
            const observer = new ResizeObserver(() => {
                updateCircleLayout();
            });

            observer.observe(container);
        }
    }

    /**
     * Apply a subtle depth effect to scene children marked with data-depth.
     */
    function initSceneParallax() {
        const scenes = document.querySelectorAll(".traits, .circle-scene");
        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;
        const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

        if (prefersReducedMotion || !canHover) {
            return;
        }

        scenes.forEach((scene) => {
            const layers = scene.querySelectorAll("[data-depth]");

            if (!layers.length) {
                return;
            }

            const isOrbitScene = scene.classList.contains("circle-scene");
            const maxLayerMove = isOrbitScene ? 76 : 30;
            const maxTilt = isOrbitScene ? 9 : 10;
            const state = {
                targetX: 0,
                targetY: 0,
                currentX: 0,
                currentY: 0,
                isActive: false,
                frameId: null
            };

            const setLayerOffset = (layer, x, y) => {
                const depth = Number(layer.dataset.depth || 0);
                const translateX = -x * depth * maxLayerMove;
                const translateY = -y * depth * maxLayerMove;
                const translateZ = isOrbitScene ? depth * 42 : 0;

                if (isOrbitScene) {
                    layer.style.setProperty("--parallax-x", `${translateX.toFixed(2)}px`);
                    layer.style.setProperty("--parallax-y", `${translateY.toFixed(2)}px`);
                    layer.style.setProperty("--parallax-z", `${translateZ.toFixed(2)}px`);
                    return;
                }

                layer.style.transform =
                    `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0)`;
            };

            const renderFrame = () => {
                state.currentX += (state.targetX - state.currentX) * 0.16;
                state.currentY += (state.targetY - state.currentY) * 0.16;

                layers.forEach((layer) => {
                    setLayerOffset(layer, state.currentX, state.currentY);
                });

                if (isOrbitScene) {
                    scene.style.setProperty(
                        "--scene-rotate-x",
                        `${(-state.currentY * maxTilt).toFixed(2)}deg`
                    );
                    scene.style.setProperty(
                        "--scene-rotate-y",
                        `${(state.currentX * maxTilt).toFixed(2)}deg`
                    );
                    scene.style.setProperty(
                        "--scene-glow-x",
                        `${(50 + state.currentX * 24).toFixed(2)}%`
                    );
                    scene.style.setProperty(
                        "--scene-glow-y",
                        `${(50 + state.currentY * 24).toFixed(2)}%`
                    );
                } else {
                    scene.style.transform =
                        `rotateX(${(-state.currentY * maxTilt).toFixed(2)}deg) ` +
                        `rotateY(${(state.currentX * maxTilt).toFixed(2)}deg)`;
                }

                const isSettled =
                    Math.abs(state.targetX - state.currentX) < 0.001 &&
                    Math.abs(state.targetY - state.currentY) < 0.001;

                if (!state.isActive && isSettled) {
                    state.currentX = 0;
                    state.currentY = 0;
                    layers.forEach((layer) => {
                        setLayerOffset(layer, 0, 0);
                    });

                    if (isOrbitScene) {
                        scene.style.setProperty("--scene-rotate-x", "0deg");
                        scene.style.setProperty("--scene-rotate-y", "0deg");
                        scene.style.setProperty("--scene-glow-x", "50%");
                        scene.style.setProperty("--scene-glow-y", "50%");
                    } else {
                        scene.style.transform = "";
                    }

                    state.frameId = null;
                    return;
                }

                state.frameId = window.requestAnimationFrame(renderFrame);
            };

            const requestRender = () => {
                if (!state.frameId) {
                    state.frameId = window.requestAnimationFrame(renderFrame);
                }
            };

            const resetScene = () => {
                state.isActive = false;
                state.targetX = 0;
                state.targetY = 0;
                requestRender();
            };

            scene.addEventListener("pointermove", (event) => {
                const rect = scene.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                state.isActive = true;
                state.targetX = Math.max(-1, Math.min(1, (event.clientX - centerX) / (rect.width / 2)));
                state.targetY = Math.max(-1, Math.min(1, (event.clientY - centerY) / (rect.height / 2)));
                requestRender();
            });

            scene.addEventListener("pointerleave", resetScene);
            scene.addEventListener("blur", resetScene, true);
        });
    }

    function initSiteInteractions() {
        document.body.classList.add("page-transition-ready");
        initNavigation();
        initJumpLinks();
        initPageTransitions();
        initSmoothScroll();
        initLandingPage();
        initIntroVideoLoader();
        initHashLanding();
        initFadeIn();
        initActiveNav();
        initSceneParallax();
        initCircleLayout();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initSiteInteractions, { once: true });
    } else {
        initSiteInteractions();
    }

    window.addEventListener("load", updateCircleLayout);
    window.addEventListener("resize", updateCircleLayout);
})();
