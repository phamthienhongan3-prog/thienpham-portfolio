/* ==========================================================================
   HUYNH THIEN PHAM — PORTFOLIO INTERACTIONS & MOTION ENGINE
   ========================================================================== */

(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;

  /* ==================== HELPERS ==================== */
  const qs = (sel, scope = document) => scope.querySelector(sel);
  const qsa = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

  const getValue = (obj, path) =>
    path.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);

  const safeStorage = {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, val) {
      try {
        window.localStorage.setItem(key, val);
      } catch {
        /* ignore private mode storage errors */
      }
    },
  };

  /* ==================== STATE ==================== */
  const prefersReduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const savedMotion = safeStorage.get("thien_motion");
  let motionEnabled = savedMotion ? savedMotion === "on" : !prefersReduced;

  const urlLang = new URLSearchParams(window.location.search).get("lang");
  const savedLang = safeStorage.get("thien_lang");
  let currentLang =
    urlLang === "vi" || urlLang === "en"
      ? urlLang
      : savedLang === "vi" || savedLang === "en"
        ? savedLang
        : "en";

  let currentStep = 0;
  let lenis = null;
  let lenisRaf = null;

  /* ==================== I18N ENGINE ==================== */
  function t(path) {
    const dict = window.PORTFOLIO_I18N && window.PORTFOLIO_I18N[currentLang];
    return getValue(dict, path);
  }

  function applyLanguage(lang, animate = false) {
    if (!window.PORTFOLIO_I18N || !window.PORTFOLIO_I18N[lang]) return;
    currentLang = lang;
    safeStorage.set("thien_lang", lang);

    const updateDOM = () => {
      root.lang = lang;
      root.setAttribute("data-lang", lang);

      // Text nodes
      qsa("[data-i18n]").forEach((el) => {
        const val = t(el.dataset.i18n);
        if (typeof val === "string") el.textContent = val;
      });

      // Alt attributes
      qsa("[data-i18n-alt]").forEach((el) => {
        const val = t(el.dataset.i18nAlt);
        if (typeof val === "string") el.setAttribute("alt", val);
      });

      // Aria labels
      qsa("[data-i18n-aria]").forEach((el) => {
        const val = t(el.dataset.i18nAria);
        if (typeof val === "string") el.setAttribute("aria-label", val);
      });

      // Toggle buttons state
      qsa("[data-lang-btn]").forEach((btn) => {
        const active = btn.dataset.langBtn === lang;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", String(active));
      });

      // Sync dynamic modules
      renderProcessStep(currentStep, false);
      updateMotionUI();
      portraitPlayer.syncLabels();
      updateLocalClock();
    };

    if (animate && motionEnabled) {
      body.classList.add("lang-transitioning");
      window.setTimeout(() => {
        updateDOM();
        body.classList.remove("lang-transitioning");
      }, 150);
    } else {
      updateDOM();
    }
  }

  qsa("[data-lang-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.langBtn;
      if (next && next !== currentLang) applyLanguage(next, true);
    });
  });

  /* ==================== LENIS SMOOTH SCROLL ==================== */
  function startLenis() {
    if (lenis || typeof window.Lenis !== "function" || !motionEnabled) return;
    lenis = new window.Lenis({
      duration: 1.12,
      easing: (x) => Math.min(1, 1.001 - Math.pow(2, -10 * x)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    });
    lenis.on("scroll", onScroll);

    const raf = (time) => {
      if (!lenis) return;
      lenis.raf(time);
      lenisRaf = window.requestAnimationFrame(raf);
    };
    lenisRaf = window.requestAnimationFrame(raf);
  }

  function stopLenis() {
    if (lenisRaf) {
      window.cancelAnimationFrame(lenisRaf);
      lenisRaf = null;
    }
    if (lenis) {
      lenis.destroy();
      lenis = null;
    }
  }

  // Smooth anchor scrolling (works both with and without Lenis)
  qsa('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      const target = qs(href);
      if (!target) return;
      e.preventDefault();
      closeMobileMenu();

      const offset = href === "#home" ? 0 : -80;
      if (lenis && motionEnabled) {
        lenis.scrollTo(target, { offset });
      } else {
        const y = target.getBoundingClientRect().top + window.scrollY + offset;
        window.scrollTo({ top: Math.max(0, y), behavior: motionEnabled ? "smooth" : "auto" });
      }
    });
  });

  /* ==================== MOTION TOGGLE ==================== */
  const motionToggle = qs("#motion-toggle");
  const motionToggleLabel = qs("#motion-toggle-label");

  function updateMotionUI() {
    root.setAttribute("data-motion", motionEnabled ? "on" : "off");
    if (motionToggle) {
      motionToggle.setAttribute("aria-pressed", String(motionEnabled));
    }
    if (motionToggleLabel) {
      const key = motionEnabled ? "motion.on" : "motion.off";
      const val = t(key);
      if (val) motionToggleLabel.textContent = val;
    }
  }

  function setMotion(enabled) {
    motionEnabled = enabled;
    root.setAttribute("data-motion-override", "true");
    safeStorage.set("thien_motion", enabled ? "on" : "off");
    updateMotionUI();

    if (enabled) {
      startLenis();
      portraitPlayer.reset(true);
    } else {
      stopLenis();
      portraitPlayer.setStatic();
    }
  }

  if (motionToggle) {
    motionToggle.addEventListener("click", () => setMotion(!motionEnabled));
  }

  /* ==================== HEADER, SCROLL PROGRESS, REVEAL & SCROLL-SPY ==================== */
  const header = qs("#site-header");
  const progressBar = qs("#scroll-progress-bar");
  const siteFooter = qs(".site-footer");
  const revealEls = qsa(".reveal");
  const navLinks = qsa(".main-nav .nav-link[data-section]");
  const trackedNavSections = navLinks
    .map((a) => ({ link: a, el: qs(`#${a.dataset.section}`), id: a.dataset.section }))
    .filter((item) => item.el);
  const storyLinks = qsa("[data-story-link]");
  const storyChapters = qsa("[data-story-chapter]");

  let scrollTicking = false;

  function revealAboveFold() {
    const triggerY = window.innerHeight * 0.96;
    revealEls.forEach((el) => {
      if (el.classList.contains("is-visible")) return;
      const rect = el.getBoundingClientRect();
      if (rect.top <= triggerY) {
        el.classList.add("is-visible");
      }
    });
  }

  function updateScrollSpies() {
    const focalY = window.innerHeight * 0.36;

    // 1. Primary navigation active pill (clears cleanly in Hero, Hiring, and Contact)
    let activeNavId = null;
    for (const item of trackedNavSections) {
      const rect = item.el.getBoundingClientRect();
      // Keep Projects active while reading Skulta deep-dive right beneath it
      if (item.id === "projects") {
        const skultaEl = qs("#skulta-story");
        const bottom = skultaEl ? skultaEl.getBoundingClientRect().bottom : rect.bottom;
        if (rect.top <= focalY && bottom >= focalY) {
          activeNavId = "projects";
          break;
        }
      } else if (rect.top <= focalY && rect.bottom >= focalY) {
        activeNavId = item.id;
        break;
      }
    }
    navLinks.forEach((a) => a.classList.toggle("is-active", a.dataset.section === activeNavId));

    // 2. Skulta sticky sidebar active chapter
    if (storyChapters.length) {
      let activeStoryId = storyChapters[0].id;
      for (const ch of storyChapters) {
        if (ch.getBoundingClientRect().top <= focalY) {
          activeStoryId = ch.id;
        }
      }
      storyLinks.forEach((a) => a.classList.toggle("is-active", a.dataset.storyLink === activeStoryId));
    }

    // 3. Lift floating motion toggle cleanly above footer so it never overlaps Back to top
    if (motionToggle && siteFooter) {
      const footerTop = siteFooter.getBoundingClientRect().top;
      motionToggle.classList.toggle("is-lifted", footerTop < window.innerHeight - 16);
    }
  }

  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(() => {
      const y = window.scrollY || window.pageYOffset;
      if (header) header.classList.toggle("is-scrolled", y > 14);

      if (progressBar) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
        progressBar.style.transform = `scaleX(${pct})`;
      }

      revealAboveFold();
      updateScrollSpies();
      scrollTicking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  /* ==================== MOBILE MENU ==================== */
  const menuToggle = qs("#menu-toggle");
  const mobileMenu = qs("#mobile-menu");
  const mobileClose = qs("#mobile-menu-close");
  const mobileBackdrop = qs("#mobile-menu-backdrop");

  function openMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.add("is-open");
    mobileMenu.setAttribute("aria-hidden", "false");
    if (menuToggle) menuToggle.setAttribute("aria-expanded", "true");
    body.style.overflow = "hidden";
    if (lenis) lenis.stop();
  }

  function closeMobileMenu() {
    if (!mobileMenu || !mobileMenu.classList.contains("is-open")) return;
    mobileMenu.classList.remove("is-open");
    mobileMenu.setAttribute("aria-hidden", "true");
    if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
    body.style.overflow = "";
    if (lenis) lenis.start();
  }

  if (menuToggle) menuToggle.addEventListener("click", openMobileMenu);
  if (mobileClose) mobileClose.addEventListener("click", closeMobileMenu);
  if (mobileBackdrop) mobileBackdrop.addEventListener("click", closeMobileMenu);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMobileMenu();
  });

  /* ==================== SCROLL REVEALS & COUNTERS ==================== */
  root.classList.add("js-ready");

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      root.classList.add("hero-loaded");
      onScroll();
    });
  });

  if ("IntersectionObserver" in window) {
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" }
    );
    revealEls.forEach((el) => revealObs.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  // Animated Stat Numbers (06, 50+)
  const counterEls = qsa("[data-count]");
  function animateCounter(el) {
    const target = Number(el.dataset.count) || 0;
    const pad = Number(el.dataset.pad) || 0;
    const suffix = el.dataset.suffix || "";

    const format = (n) => {
      const str = String(Math.round(n));
      return (pad ? str.padStart(pad, "0") : str) + suffix;
    };

    if (!motionEnabled) {
      el.textContent = format(target);
      return;
    }

    const duration = 1050;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = format(target * eased);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = format(target);
      }
    };
    window.requestAnimationFrame(step);
  }

  if ("IntersectionObserver" in window) {
    const counterObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    counterEls.forEach((el) => counterObs.observe(el));
  }

  /* ==================== 18-SEC 3-SCENE PORTRAIT INTRO PLAYER ==================== */
  const portraitCard = qs("#portrait-intro");
  const portraitScenes = qsa(".portrait-scene", portraitCard || document);
  const timelineSegs = qsa(".timeline-seg", portraitCard || document);
  const introPlayBtn = qs("#intro-play");
  const introPlayIcon = qs("#intro-play-icon");
  const introPlayLabel = qs("#intro-play-label");
  const introDuration = qs("#intro-duration");

  const SCENE_MS = 6000;

  const portraitPlayer = {
    state: "playing", // playing | paused | ended | static
    scene: 0,
    timerId: null,
    startedAt: 0,
    remainingMs: SCENE_MS,

    init() {
      if (!portraitCard) return;

      if (introPlayBtn) {
        introPlayBtn.addEventListener("click", () => {
          if (this.state === "playing") {
            this.pause();
          } else if (this.state === "paused") {
            this.resume();
          } else {
            this.reset(true);
          }
        });
      }

      timelineSegs.forEach((seg, idx) => {
        seg.addEventListener("click", () => {
          if (!motionEnabled) return;
          this.jumpTo(idx);
        });
      });

      if (motionEnabled) {
        this.reset(true);
      } else {
        this.setStatic();
      }
    },

    clearTimer() {
      if (this.timerId) {
        window.clearTimeout(this.timerId);
        this.timerId = null;
      }
    },

    renderScene(idx, restartAnim = true) {
      this.scene = idx;
      portraitCard.setAttribute("data-scene", String(idx));

      portraitScenes.forEach((el, i) => el.classList.toggle("is-active", i === idx));

      timelineSegs.forEach((seg, i) => {
        seg.classList.remove("is-active", "is-done");
        if (i < idx) {
          seg.classList.add("is-done");
        } else if (i === idx && restartAnim) {
          // Force reflow so CSS timeline progress restarts cleanly
          const fill = qs(".timeline-seg__fill", seg);
          if (fill) {
            fill.style.animation = "none";
            void fill.offsetWidth;
            fill.style.animation = "";
          }
          seg.classList.add("is-active");
        }
      });
    },

    scheduleNext(delayMs) {
      this.clearTimer();
      this.startedAt = performance.now();
      this.remainingMs = delayMs;
      this.timerId = window.setTimeout(() => {
        if (this.scene < portraitScenes.length - 1) {
          this.renderScene(this.scene + 1, true);
          this.scheduleNext(SCENE_MS);
        } else {
          this.finish();
        }
      }, delayMs);
    },

    reset(autoPlay = true) {
      if (!portraitCard) return;
      this.clearTimer();
      const img = qs(".portrait-card__img", portraitCard);
      if (img) {
        img.style.animation = "none";
        void img.offsetWidth;
        img.style.animation = "";
      }

      this.state = autoPlay ? "playing" : "paused";
      portraitCard.setAttribute("data-state", this.state);
      this.renderScene(0, true);
      this.syncLabels();

      if (autoPlay) {
        this.scheduleNext(SCENE_MS);
      }
    },

    jumpTo(idx) {
      this.clearTimer();
      this.state = "playing";
      portraitCard.setAttribute("data-state", "playing");
      this.renderScene(idx, true);
      this.syncLabels();
      this.scheduleNext(SCENE_MS);
    },

    pause() {
      if (this.state !== "playing") return;
      const elapsed = performance.now() - this.startedAt;
      this.remainingMs = Math.max(200, this.remainingMs - elapsed);
      this.clearTimer();
      this.state = "paused";
      portraitCard.setAttribute("data-state", "paused");
      this.syncLabels();
    },

    resume() {
      if (this.state !== "paused") return;
      this.state = "playing";
      portraitCard.setAttribute("data-state", "playing");
      this.syncLabels();
      this.scheduleNext(this.remainingMs);
    },

    finish() {
      this.clearTimer();
      this.state = "ended";
      portraitCard.setAttribute("data-state", "ended");
      timelineSegs.forEach((seg) => {
        seg.classList.remove("is-active");
        seg.classList.add("is-done");
      });
      this.syncLabels();
    },

    setStatic() {
      this.clearTimer();
      this.state = "static";
      if (!portraitCard) return;
      portraitCard.setAttribute("data-state", "static");
      portraitScenes.forEach((el, i) => el.classList.toggle("is-active", i === 0));
      this.syncLabels();
    },

    syncLabels() {
      if (!introDuration || !introPlayLabel || !introPlayIcon) return;

      introDuration.textContent = motionEnabled
        ? t("hero.introDurationOn") || "Portrait in motion · 18 sec"
        : t("hero.introDurationOff") || "Personal portrait";

      if (this.state === "playing") {
        introPlayIcon.textContent = "❚❚";
        introPlayLabel.textContent = t("hero.introPause") || "Pause intro";
      } else if (this.state === "paused") {
        introPlayIcon.textContent = "▶";
        introPlayLabel.textContent = t("hero.introResume") || "Resume intro";
      } else {
        introPlayIcon.textContent = "↺";
        introPlayLabel.textContent = t("hero.introReplay") || "Replay intro";
      }
    },
  };

  /* ==================== SKULTA 4-STEP PROCESS DECK ==================== */
  const processTabs = qsa(".process-tab");
  const processStage = qs("#process-stage");
  const processPlate = qs("#process-plate");
  const deckStage = qs("#deck-stage");
  const deckNum = qs("#deck-num");
  const deckArtTitle = qs("#deck-art-title");
  const deckEyebrow = qs("#deck-eyebrow");
  const deckHeading = qs("#deck-heading");
  const deckBody = qs("#deck-body");
  const deckTags = qs("#deck-tags");
  const deckNextBtn = qs("#deck-next-btn");
  const deckNextLabel = qs("#deck-next-label");
  const plateDots = qsa(".process-plate__dots i");

  function renderProcessStep(index, animate = true) {
    const steps = t("process.steps");
    if (!Array.isArray(steps) || !steps[index]) return;

    currentStep = index;
    const data = steps[index];

    processTabs.forEach((tab, i) => {
      const active = i === index;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    if (processPlate) processPlate.setAttribute("data-step-bg", String(index));
    plateDots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));

    if (deckStage) deckStage.textContent = data.stage;
    if (deckNum) deckNum.textContent = data.num;
    if (deckArtTitle) deckArtTitle.textContent = data.artTitle;
    if (deckEyebrow) deckEyebrow.textContent = data.eyebrow;
    if (deckHeading) deckHeading.textContent = data.heading;
    if (deckBody) deckBody.textContent = data.body;
    if (deckNextLabel) deckNextLabel.textContent = data.nextLabel;

    if (deckTags) {
      deckTags.innerHTML = "";
      data.tags.forEach((tagText) => {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = tagText;
        deckTags.appendChild(span);
      });
    }

    if (animate && processStage && motionEnabled) {
      processStage.classList.remove("is-switching");
      void processStage.offsetWidth;
      processStage.classList.add("is-switching");
    }
  }

  processTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const idx = Number(tab.dataset.step);
      if (!Number.isNaN(idx)) renderProcessStep(idx, true);
    });

    tab.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const next = (currentStep + dir + processTabs.length) % processTabs.length;
        renderProcessStep(next, true);
        processTabs[next].focus();
      }
    });
  });

  if (deckNextBtn) {
    deckNextBtn.addEventListener("click", () => {
      const next = (currentStep + 1) % 4;
      renderProcessStep(next, true);
    });
  }

  /* ==================== DRAWERS (PROJECT CONTRIBUTIONS) ==================== */
  qsa("[data-drawer]").forEach((drawer) => {
    const trigger = qs(".drawer__trigger", drawer);
    if (!trigger) return;
    trigger.addEventListener("click", () => {
      const open = drawer.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", String(open));
    });
  });

  /* ==================== PRACTICE ACCORDIONS ==================== */
  qsa("[data-accordion]").forEach((item) => {
    const trigger = qs(".accordion-trigger", item);
    if (!trigger) return;
    trigger.addEventListener("click", () => {
      const open = item.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", String(open));
    });
  });

  /* ==================== COPY EMAIL BUTTONS ==================== */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve) => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
      resolve();
    });
  }

  qsa("[data-copy-email]").forEach((btn) => {
    let resetTimer = null;
    btn.addEventListener("click", () => {
      const email = btn.dataset.copyEmail;
      if (!email) return;

      copyText(email).then(() => {
        const statusEl = qs(".copy-pill__status", btn) || btn;
        const originalKey = statusEl.dataset.i18n || "common.copy";
        statusEl.textContent = t("common.copied") || "Copied ✓";

        if (resetTimer) window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(() => {
          statusEl.textContent = t(originalKey) || "Copy";
        }, 2200);
      });
    });
  });

  /* ==================== LIVE CAN THO CLOCK ==================== */
  const clockEl = qs("#local-clock");
  function updateLocalClock() {
    if (!clockEl) return;
    try {
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);
      const city = currentLang === "vi" ? "Cần Thơ" : "Can Tho";
      clockEl.textContent = `${city} · ${timeStr} ICT`;
    } catch {
      clockEl.textContent = currentLang === "vi" ? "Cần Thơ · UTC+7" : "Can Tho · UTC+7";
    }
  }
  updateLocalClock();
  window.setInterval(updateLocalClock, 30000);

  /* ==================== MAGNETIC BUTTONS & SUBTLE CURSOR ==================== */
  const finePointer =
    window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (finePointer) {
    // Magnetic buttons
    qsa(".magnetic").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        if (!motionEnabled) return;
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.2;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.24;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "";
      });
    });

    // Subtle editorial cursor follower
    const dot = qs("#cursor-dot");
    const ring = qs("#cursor-ring");
    const cursorLabel = qs("#cursor-label");

    if (dot && ring) {
      root.classList.add("has-cursor");
      let mx = -100;
      let my = -100;
      let rx = -100;
      let ry = -100;

      const animateCursor = () => {
        if (motionEnabled) {
          rx += (mx - rx) * 0.16;
          ry += (my - ry) * 0.16;
          dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
          ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
        }
        window.requestAnimationFrame(animateCursor);
      };
      window.requestAnimationFrame(animateCursor);

      window.addEventListener(
        "mousemove",
        (e) => {
          mx = e.clientX;
          my = e.clientY;
          root.classList.add("cursor-visible");
        },
        { passive: true }
      );

      document.addEventListener("mouseleave", () => {
        root.classList.remove("cursor-visible", "cursor-hover", "cursor-label-active");
      });

      const interactiveSel = "a, button, [data-cursor]";
      document.addEventListener("mouseover", (e) => {
        if (!motionEnabled) return;
        const target = e.target.closest(interactiveSel);
        if (!target) return;
        const label = target.getAttribute("data-cursor");
        if (label && cursorLabel) {
          cursorLabel.textContent = label;
          root.classList.add("cursor-label-active");
          root.classList.remove("cursor-hover");
        } else {
          root.classList.add("cursor-hover");
          root.classList.remove("cursor-label-active");
        }
      });

      document.addEventListener("mouseout", (e) => {
        const target = e.target.closest(interactiveSel);
        if (!target) return;
        root.classList.remove("cursor-hover", "cursor-label-active");
      });
    }
  }

  /* ==================== BOOTSTRAP ==================== */
  applyLanguage(currentLang, false);
  portraitPlayer.init();
  if (motionEnabled) startLenis();
})();
