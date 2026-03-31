(function initLifeSimulator() {
    const canvasElement = document.getElementById("cellCanvas");

    if (!canvasElement || typeof PIXI === "undefined") {
        return;
    }

    // ==========================
    // PIXI SETUP
    // ==========================
    const app = new PIXI.Application({
        view: canvasElement,
        resizeTo: window,
        backgroundAlpha: 0,
        antialias: true
    });

    // This shared layer lets the blur filter visually blend circles and effects.
    const metaballLayer = new PIXI.Container();
    app.stage.addChild(metaballLayer);

    const cellsContainer = new PIXI.Container();
    metaballLayer.addChild(cellsContainer);

    const transitions = new PIXI.Graphics();
    metaballLayer.addChild(transitions);

    const blurFilter = new PIXI.BlurFilter();
    blurFilter.blur = 4;
    blurFilter.quality = 2;
    metaballLayer.filters = [blurFilter];

    /**
     * Smooth the merge animation so cells accelerate and slow down naturally.
     */
    function easeInOut(t) {
        return t < 0.5
            ? 2 * t * t
            : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    // ==========================
    // CELL CLASS
    // ==========================
    class Cell {
        constructor(x, y, r, type = "small") {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 0.8;
            this.vy = (Math.random() - 0.5) * 0.8;
            this.radius = r !== undefined ? r : 10 + Math.random() * 8;
            this.type = type;

            this.graphics = new PIXI.Graphics();
            cellsContainer.addChild(this.graphics);
        }

        update(mouse) {
            // Keep the system alive with a bit of random drift.
            this.vx += (Math.random() - 0.5) * 0.16;
            this.vy += (Math.random() - 0.5) * 0.36;

            // Repel cells only while the user is actively pressing in the canvas.
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const repelDist = 150;

            if (dist < repelDist) {
                const force = (repelDist - dist) / repelDist;
                const angle = Math.atan2(dy, dx);
                this.vx += Math.cos(angle) * 0.8 * force;
                this.vy += Math.sin(angle) * 0.8 * force;
            }

            this.vx *= 0.97;
            this.vy *= 0.97;

            const speed = Math.hypot(this.vx, this.vy);
            const maxSpeed = 3;

            if (speed > maxSpeed) {
                this.vx = (this.vx / speed) * maxSpeed;
                this.vy = (this.vy / speed) * maxSpeed;
            }

            this.x += this.vx;
            this.y += this.vy;

            const width = app.renderer.width;
            const height = app.renderer.height;

            if (this.x < -50) this.x = width + 50;
            if (this.x > width + 50) this.x = -50;
            if (this.y < -50) this.y = height + 50;
            if (this.y > height + 50) this.y = -50;
        }

        draw() {
            const graphics = this.graphics;
            const fillColor = this.type === "big" ? 0xFFF5D9 : 0x88D4C7;

            graphics.clear();
            graphics.lineStyle(2, 0xFFF5D9, 1);
            graphics.beginFill(fillColor, 0.1);
            graphics.drawCircle(0, 0, this.radius);
            graphics.endFill();
            graphics.position.set(this.x, this.y);
        }

        destroy() {
            cellsContainer.removeChild(this.graphics);
            this.graphics.destroy();
        }
    }

    // ==========================
    // STATE
    // ==========================
    const cells = [];
    const mergeEvents = [];
    const deathEvents = [];
    const popEvents = [];
    const initialSmallCount = 25;

    for (let i = 0; i < initialSmallCount; i++) {
        cells.push(
            new Cell(
                Math.random() * app.renderer.width,
                Math.random() * app.renderer.height,
                undefined,
                "small"
            )
        );
    }

    // ==========================
    // INPUT
    // ==========================
    const canvas = app.view;
    const mouse = { x: -9999, y: -9999 };
    let pointerActive = false;

    function resetMouse() {
        mouse.x = -9999;
        mouse.y = -9999;
    }

    /**
     * Update the virtual pointer only while the current press is active.
     */
    function updateMouse(event) {
        if (!pointerActive) {
            return;
        }

        if (event.touches && event.touches.length) {
            mouse.x = event.touches[0].clientX;
            mouse.y = event.touches[0].clientY;
            return;
        }

        mouse.x = event.clientX;
        mouse.y = event.clientY;
    }

    /**
     * Create a light burst effect so popped cells do not disappear abruptly.
     */
    function spawnBubblePop(x, y, radius) {
        const particleCount = 8;
        const particles = [];

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                angle: (Math.PI * 2 * i) / particleCount,
                speed: radius * (0.6 + Math.random() * 0.4),
                radius: Math.max(2, radius * 0.14)
            });
        }

        popEvents.push({
            x,
            y,
            progress: 0,
            maxRadius: radius * 1.8,
            particles
        });
    }

    /**
     * Remove the topmost cell at the pointer position and play the pop effects.
     */
    function removeCellAtPointer(x, y) {
        for (let i = cells.length - 1; i >= 0; i--) {
            const cell = cells[i];
            const dx = x - cell.x;
            const dy = y - cell.y;

            if (Math.hypot(dx, dy) <= cell.radius) {
                deathEvents.push({
                    x: cell.x,
                    y: cell.y,
                    r: cell.radius,
                    alpha: 0.35,
                    color: cell.type === "big" ? 0xFFF5D9 : 0x88D4C7
                });

                spawnBubblePop(cell.x, cell.y, cell.radius);
                cell.destroy();
                cells.splice(i, 1);
                return true;
            }
        }

        return false;
    }

    /**
     * Pressing the canvas either pops a cell or starts the repel interaction.
     */
    function activatePointer(event) {
        const point = event.touches && event.touches.length ? event.touches[0] : event;
        const hitCell = removeCellAtPointer(point.clientX, point.clientY);

        if (hitCell) {
            pointerActive = false;
            resetMouse();
            return;
        }

        pointerActive = true;
        updateMouse(event);
    }

    /**
     * Stop the pointer influence as soon as the interaction ends.
     */
    function deactivatePointer() {
        pointerActive = false;
        resetMouse();
    }

    canvas.addEventListener("pointerdown", activatePointer);
    canvas.addEventListener("pointermove", updateMouse);
    canvas.addEventListener("pointerleave", deactivatePointer);
    window.addEventListener("pointerup", deactivatePointer);
    window.addEventListener("pointercancel", deactivatePointer);

    // ==========================
    // COLLISIONS + MERGING
    // ==========================
    function handleCollisions() {
        for (let i = 0; i < cells.length; i++) {
            const first = cells[i];

            for (let j = i + 1; j < cells.length; j++) {
                const second = cells[j];
                const dx = second.x - first.x;
                const dy = second.y - first.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = first.radius + second.radius;

                if (dist >= minDist) {
                    continue;
                }

                const bothSmall = first.type === "small" && second.type === "small";
                const mergeChance = 0.2;

                if (bothSmall && Math.random() < mergeChance) {
                    const midX = (first.x + second.x) / 2;
                    const midY = (first.y + second.y) / 2;
                    const midVx = (first.vx + second.vx) / 2;
                    const midVy = (first.vy + second.vy) / 2;

                    mergeEvents.push({
                        x1: first.x,
                        y1: first.y,
                        r1: first.radius,
                        x2: second.x,
                        y2: second.y,
                        r2: second.radius,
                        midVx,
                        midVy,
                        newR: (first.radius + second.radius) * 0.9,
                        progress: 0
                    });

                    deathEvents.push({
                        x: first.x,
                        y: first.y,
                        r: first.radius,
                        alpha: 0.7,
                        color: 0x88D4C7
                    });
                    deathEvents.push({
                        x: second.x,
                        y: second.y,
                        r: second.radius,
                        alpha: 0.7,
                        color: 0x88D4C7
                    });

                    first.destroy();
                    second.destroy();
                    cells.splice(j, 1);
                    cells.splice(i, 1);
                    i--;
                    break;
                }

                const angle = Math.atan2(dy, dx);
                const overlap = minDist - dist;

                first.x -= Math.cos(angle) * overlap / 2;
                first.y -= Math.sin(angle) * overlap / 2;
                second.x += Math.cos(angle) * overlap / 2;
                second.y += Math.sin(angle) * overlap / 2;

                const tempVx = first.vx;
                const tempVy = first.vy;
                first.vx = second.vx;
                first.vy = second.vy;
                second.vx = tempVx;
                second.vy = tempVy;
            }
        }
    }

    // ==========================
    // REPRODUCTION
    // ==========================
    function maybeSpawnSplits() {
        const reproductionChance = 0.00035;

        for (let i = cells.length - 1; i >= 0; i--) {
            const cell = cells[i];

            if (cell.type !== "small" || Math.random() >= reproductionChance) {
                continue;
            }

            const angle = Math.random() * Math.PI * 2;
            const offset = cell.radius * 2;
            const x1 = cell.x + Math.cos(angle) * offset;
            const y1 = cell.y + Math.sin(angle) * offset;
            const x2 = cell.x - Math.cos(angle) * offset;
            const y2 = cell.y - Math.sin(angle) * offset;
            const child1 = new Cell(x1, y1, cell.radius, "small");
            const child2 = new Cell(x2, y2, cell.radius, "small");
            const extraKick = 0.7;

            child1.vx = cell.vx + Math.cos(angle) * extraKick;
            child1.vy = cell.vy + Math.sin(angle) * extraKick;
            child2.vx = cell.vx - Math.cos(angle) * extraKick;
            child2.vy = cell.vy - Math.sin(angle) * extraKick;

            deathEvents.push({
                x: cell.x,
                y: cell.y,
                r: cell.radius,
                alpha: 0.7,
                color: 0x88D4C7
            });

            cell.destroy();
            cells.splice(i, 1);
        }
    }

    // ==========================
    // TRANSITIONS
    // ==========================
    function updateAndDrawDeaths() {
        for (let i = deathEvents.length - 1; i >= 0; i--) {
            const event = deathEvents[i];

            transitions.lineStyle(2, 0xFFF5D9, event.alpha * 0.6);
            transitions.beginFill(event.color, event.alpha);
            transitions.drawCircle(event.x, event.y, event.r);
            transitions.endFill();

            event.alpha -= 0.02;

            if (event.alpha <= 0) {
                deathEvents.splice(i, 1);
            }
        }
    }

    function updateAndDrawPops() {
        for (let i = popEvents.length - 1; i >= 0; i--) {
            const pop = popEvents[i];
            pop.progress += 0.08;

            const t = Math.min(pop.progress, 1);
            const ringRadius = pop.maxRadius * t;
            const alpha = 1 - t;

            transitions.lineStyle(2, 0xFFF5D9, alpha);
            transitions.drawCircle(pop.x, pop.y, ringRadius);

            for (let j = 0; j < pop.particles.length; j++) {
                const particle = pop.particles[j];
                const px = pop.x + Math.cos(particle.angle) * particle.speed * t;
                const py = pop.y + Math.sin(particle.angle) * particle.speed * t;

                transitions.beginFill(0xFFF5D9, alpha * 0.8);
                transitions.drawCircle(px, py, particle.radius * (1 - t * 0.35));
                transitions.endFill();
            }

            if (pop.progress >= 1) {
                popEvents.splice(i, 1);
            }
        }
    }

    function updateAndDrawMerges() {
        for (let i = mergeEvents.length - 1; i >= 0; i--) {
            const merge = mergeEvents[i];
            merge.progress += 0.02;

            if (merge.progress > 1) {
                merge.progress = 1;
            }

            const t = easeInOut(merge.progress);
            const midX = (merge.x1 + merge.x2) / 2;
            const midY = (merge.y1 + merge.y2) / 2;
            const cx1 = merge.x1 + (midX - merge.x1) * t;
            const cy1 = merge.y1 + (midY - merge.y1) * t;
            const cx2 = merge.x2 + (midX - merge.x2) * t;
            const cy2 = merge.y2 + (midY - merge.y2) * t;

            transitions.lineStyle(2, 0xFFF5D9, 0.3);
            transitions.beginFill(0x88D4C7, 0.3);
            transitions.drawCircle(cx1, cy1, merge.r1);
            transitions.endFill();

            transitions.beginFill(0x88D4C7, 0.3);
            transitions.drawCircle(cx2, cy2, merge.r2);
            transitions.endFill();

            transitions.beginFill(0xFFF5D9, 0.3);
            transitions.drawCircle(midX, midY, merge.newR);
            transitions.endFill();

            if (merge.progress >= 1) {
                const bigCell = new Cell(midX, midY, merge.newR, "big");
                bigCell.vx = merge.midVx;
                bigCell.vy = merge.midVy;
                cells.push(bigCell);
                mergeEvents.splice(i, 1);
            }
        }
    }

    // ==========================
    // MAIN LOOP
    // ==========================
    app.ticker.add(() => {
        transitions.clear();
        handleCollisions();

        for (let i = 0; i < cells.length; i++) {
            cells[i].update(mouse);
        }

        maybeSpawnSplits();
        updateAndDrawDeaths();
        updateAndDrawPops();
        updateAndDrawMerges();

        for (let i = 0; i < cells.length; i++) {
            cells[i].draw();
        }
    });
})();
