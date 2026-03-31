(function initSiteUi() {
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

        const closeMenus = () => {
            navMenu.classList.remove("show");
            langDropdown.classList.remove("open");
        };

        hamburger.addEventListener("click", (event) => {
            event.stopPropagation();
            navMenu.classList.toggle("show");
        });

        langDropdown.addEventListener("click", (event) => {
            event.stopPropagation();
            langDropdown.classList.toggle("open");
        });

        languageFlags.forEach((flag) => {
            flag.addEventListener("click", (event) => {
                event.stopPropagation();

                if (typeof window.setLanguage === "function") {
                    window.setLanguage(flag.dataset.lang);
                }

                langDropdown.classList.remove("open");
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
                targetElement.scrollIntoView({ behavior: "smooth" });
            });
        });
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
            const header = document.querySelector(".header");
            const headerOffset = header ? header.offsetHeight : 0;
            const extraOffset = window.innerWidth <= 768 ? 16 : 24;
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

        window.setTimeout(alignHashTarget, 60);
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
        const sectionLinkIds = new Set(
            Array.from(navLinks)
                .map((link) => link.getAttribute("href"))
                .filter((href) => href && href.startsWith("#"))
                .map((href) => href.slice(1))
        );

        if (!sections.length || !navLinks.length || !sectionLinkIds.size) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    const activeId = entry.target.id;

                    navLinks.forEach((link) => {
                        const href = link.getAttribute("href");

                        if (!href || !href.startsWith("#")) {
                            return;
                        }

                        link.classList.toggle(
                            "active",
                            href === `#${activeId}`
                        );
                    });
                });
            },
            {
                rootMargin: "-100px 0px -40% 0px",
                threshold: 0
            }
        );

        sections
            .filter((section) => sectionLinkIds.has(section.id))
            .forEach((section) => observer.observe(section));
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
        const radius = Math.min(width, height) / 2 - 10;

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

        scenes.forEach((scene) => {
            const layers = scene.querySelectorAll("[data-depth]");

            if (!layers.length) {
                return;
            }

            const resetScene = () => {
                layers.forEach((layer) => {
                    const baseTransform = layer.classList.contains("circle-item")
                        ? "translate(-50%, -50%) "
                        : "";

                    layer.style.transform = `${baseTransform}translate(0px, 0px)`;
                });

                scene.style.transform = "";
            };

            scene.addEventListener("mousemove", (event) => {
                const rect = scene.getBoundingClientRect();
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const moveX = (event.clientX - rect.left - centerX) / centerX;
                const moveY = (event.clientY - rect.top - centerY) / centerY;

                layers.forEach((layer) => {
                    const depth = Number(layer.dataset.depth || 0);
                    const translateX = -moveX * depth * 30;
                    const translateY = -moveY * depth * 30;
                    const baseTransform = layer.classList.contains("circle-item")
                        ? "translate(-50%, -50%) "
                        : "";

                    layer.style.transform =
                        `${baseTransform}translate(${translateX}px, ${translateY}px)`;
                });

                scene.style.transform =
                    `rotateX(${moveY * 15}deg) rotateY(${moveX * 15}deg)`;
            });

            scene.addEventListener("mouseleave", resetScene);
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.body.classList.add("page-transition-ready");
        initNavigation();
        initJumpLinks();
        initPageTransitions();
        initSmoothScroll();
        initHashLanding();
        initFadeIn();
        initActiveNav();
        initSceneParallax();
        initCircleLayout();
    });

    window.addEventListener("load", updateCircleLayout);
    window.addEventListener("resize", updateCircleLayout);
})();
