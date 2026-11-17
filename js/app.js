import { EXERCISE_CATALOG, PROFILES } from './data.js?v=1.5';
import { sound } from './audio.js?v=1.5';
import { TimerManager, formatStopwatch } from './timers.js?v=1.5';
import { WorkoutScene3D } from './scene3d.js?v=1.5';

const CATEGORY_LABELS = {
  aquecimento: 'Aquecimento Dinâmico',
  esteira: 'Esteira',
  exercicio: 'Exercício',
  alongamento: 'Alongamento Final',
  descanso: 'Descanso'
};

class AppTreino {
  constructor() {
    this.timers = new TimerManager({
      onChange: (key) => this.onTimerChange(key),
      onComplete: (key, state, msg) => this.onTimerComplete(key, state, msg)
    });

    this.profileId = this.timers.getMeta('activeProfile', 'marcos');
    if (!PROFILES[this.profileId]) this.profileId = 'marcos';

    this.activeWeek = Number(this.timers.getMeta('activeWeek', 1)) || 1;
    this.applyWeekProgression = Boolean(this.timers.getMeta('applyWeekProgression', false));
    this.autoAdvanceTreadmill = Boolean(this.timers.getMeta('autoAdvanceTreadmill', true));
    this.incline = Number(this.timers.getMeta('incline', 0)) || 0;
    this.manualDaysDone = this.timers.getMeta('manualDaysDone', {});

    const todayWeekday = new Date().getDay(); // 0=Dom .. 6=Sab
    const marcosToday = PROFILES.marcos.days?.find(d => d.weekdayIndex === todayWeekday)?.id || 'segunda';
    this.activeDayByProfile = {
      marcos: marcosToday,
      gabi: 'dia01'
    };
    this.activeDayId = this.activeDayByProfile[this.profileId] || this.getProfile().days[0].id;
    this.selectedItemKey = null;
    this.dayItemsIndex = []; // ordered list of { key, section, title, prescription, exerciseId, speedKmh, itemConfig }

    this.cacheDom();
    this.setupAdaptiveViewport();
    this.init3D();
    this.bindGlobalEvents();
    this.renderAll();
  }

  cacheDom() {
    this.dom = {
      profileTagline: document.getElementById('profile-tagline'),
      dayNav: document.getElementById('day-nav'),
      workspace: document.getElementById('main-workspace'),
      placeholder: document.getElementById('profile-placeholder'),
      canvasContainer: document.getElementById('canvas-3d'),
      modelLoadingPill: document.getElementById('model-loading-pill'),
      activeCatBadge: document.getElementById('active-category-badge'),
      activeRxBadge: document.getElementById('active-prescription-badge'),
      activeTmBadge: document.getElementById('active-treadmill-badge'),
      activeTitle: document.getElementById('active-exercise-title'),
      stageSideToggle: document.getElementById('stage-side-toggle'),
      stageLiveHud: document.getElementById('stage-live-hud'),
      hudModeLabel: document.getElementById('hud-mode-label'),
      hudTimerValue: document.getElementById('hud-timer-value'),
      hudTimerToggle: document.getElementById('hud-timer-toggle'),
      stagePhaseCue: document.getElementById('stage-phase-cue'),
      activeMuscles: document.getElementById('active-muscles'),
      activeSteps: document.getElementById('active-steps'),
      activeTip: document.getElementById('active-tip'),
      daySchedulePill: document.getElementById('day-schedule-pill'),
      dayTitle: document.getElementById('day-title'),
      dayProgressText: document.getElementById('day-progress-text'),
      dayProgressFill: document.getElementById('day-progress-fill'),
      dayTotalTime: document.getElementById('day-total-time'),
      sectionsContainer: document.getElementById('sections-container'),
      evolutionTbody: document.getElementById('evolution-tbody'),
      evolutionCardTitle: document.getElementById('evolution-card-title'),
      evolutionMarcosBody: document.getElementById('evolution-marcos-body'),
      treadmillGuideList: document.getElementById('treadmill-guide-list'),
      activeWeekPill: document.getElementById('active-week-pill'),
      summaryCardTitle: document.getElementById('summary-card-title'),
      weeklyDoneCount: document.getElementById('weekly-done-count'),
      weeklySummaryList: document.getElementById('weekly-summary-list'),
      profileObjective: document.getElementById('profile-objective'),
      tipsCardTitle: document.getElementById('tips-card-title'),
      tipsList: document.getElementById('tips-list'),
      habitsCard: document.getElementById('habits-card'),
      habitsList: document.getElementById('habits-list'),
      weekSelector: document.getElementById('week-selector'),
      btnMute: document.getElementById('btn-mute'),
      btn3dPlay: document.getElementById('btn-3d-play'),
      btnAutoRotate: document.getElementById('btn-auto-rotate'),
      btnMuscleHl: document.getElementById('btn-muscle-hl'),
      btnGuidedNext: document.getElementById('btn-guided-next'),
      btnResetDay: document.getElementById('btn-reset-day'),
      btnBackMarcos: document.getElementById('btn-back-marcos'),
      btnToggle3d: document.getElementById('btn-toggle-3d'),
      btnToggleSteps: document.getElementById('btn-toggle-steps'),
      stageBody3d: document.getElementById('stage-body-3d'),
      coachingBox: document.getElementById('coaching-box'),
      toast: document.getElementById('toast')
    };
  }

  setupAdaptiveViewport() {
    this.mobile3dOpen = true;
    this.mobileStepsOpen = false;

    const update = () => {
      const vv = window.visualViewport;
      const w = Math.round(vv ? vv.width : window.innerWidth);
      const h = Math.round(vv ? vv.height : window.innerHeight);
      const rootEl = document.documentElement;

      rootEl.style.setProperty('--app-vw', `${w}px`);
      rootEl.style.setProperty('--app-vh', `${h}px`);

      const isLandscape = w > h;
      let device = 'desktop';
      if (w <= 375) device = 'compact-mobile';
      else if (w <= 480) device = 'mobile';
      else if (w <= 768) device = 'large-mobile';
      else if (w <= 1080) device = 'tablet';

      rootEl.dataset.device = device;
      rootEl.dataset.orientation = isLandscape ? 'landscape' : 'portrait';
      rootEl.dataset.mobileLandscape = (isLandscape && h <= 540 && w <= 960) ? '1' : '0';

      // Altura do palco 3D calculada proporcionalmente para a tela exata de cada aparelho
      let stageH = 390;
      if (rootEl.dataset.mobileLandscape === '1') {
        stageH = Math.max(170, Math.min(260, h - 145));
      } else if (w <= 768) {
        stageH = Math.round(Math.max(195, Math.min(310, h * 0.31)));
      } else if (w <= 1080) {
        stageH = Math.round(Math.max(260, Math.min(360, h * 0.36)));
      }
      rootEl.style.setProperty('--mobile-stage-h', `${stageH}px`);

      // Em telas desktop/tablet mostra dicas sempre; no celular (retrato ou paisagem) começa recolhido
      const isCompactScreen = w <= 768 || rootEl.dataset.mobileLandscape === '1';
      if (!isCompactScreen) {
        this.dom.coachingBox?.classList.remove('mobile-collapsed');
        this.dom.stageBody3d?.classList.remove('mobile-collapsed');
      } else {
        this.dom.coachingBox?.classList.toggle('mobile-collapsed', !this.mobileStepsOpen);
        this.dom.stageBody3d?.classList.toggle('mobile-collapsed', !this.mobile3dOpen);
      }

      this.scene3d?.resize();
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', () => setTimeout(update, 120));
    window.visualViewport?.addEventListener('resize', update);
  }

  init3D() {
    this.scene3d = new WorkoutScene3D(this.dom.canvasContainer, {
      onPhaseChange: (text) => {
        if (this.dom.stagePhaseCue) {
          this.dom.stagePhaseCue.textContent = text;
        }
      },
      onModelStatus: (status, detail) => {
        if (!this.dom.modelLoadingPill) return;
        if (status === 'ready') {
          this.dom.modelLoadingPill.classList.add('hidden');
        } else if (status === 'error') {
          this.dom.modelLoadingPill.textContent = `Erro 3D: ${detail || 'verifique conexão/servidor'}`;
        }
      }
    });
  }

  getProfile() {
    return PROFILES[this.profileId] || PROFILES.marcos;
  }

  getActiveDay() {
    const profile = this.getProfile();
    if (!profile.ready) return null;
    return profile.days.find(d => d.id === this.activeDayId) || profile.days[0];
  }

  makeItemKey(dayId, sectionId, uid) {
    return `${this.profileId}:${dayId}:${sectionId}:${uid}`;
  }

  resolveStageSpeed(stage) {
    if (!this.applyWeekProgression) return stage.speed;
    const profile = this.getProfile();
    const wk = profile.treadmillProgression.find(w => w.week === this.activeWeek);
    if (!wk) return stage.speed;
    if (stage.kind === 'caminhada') return wk.walkSpeed;
    if (stage.kind === 'trote') return wk.jogSpeed;
    return stage.speed;
  }

  formatSpeed(num) {
    return String(num).replace('.', ',') + ' km/h';
  }

  bindGlobalEvents() {
    document.querySelectorAll('.profile-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.profileId = btn.dataset.profile;
        this.timers.setMeta('activeProfile', this.profileId);
        this.activeDayId = this.activeDayByProfile[this.profileId] || this.getProfile().days[0].id;
        this.selectedItemKey = null;
        this.renderAll();
      });
    });

    document.querySelectorAll('.week-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setActiveWeek(Number(btn.dataset.week));
      });
    });

    this.dom.btnMute.addEventListener('click', () => {
      const muted = sound.toggleMute();
      this.updateMuteBtn();
      this.showToast(muted ? 'Sons desativados' : 'Sons dos cronômetros ativados');
    });

    this.dom.btnBackMarcos.addEventListener('click', () => {
      this.profileId = 'marcos';
      this.timers.setMeta('activeProfile', 'marcos');
      this.renderAll();
    });

    // Controles do palco 3D
    document.querySelectorAll('.cam-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.scene3d.setCameraPreset(btn.dataset.cam);
      });
    });

    this.dom.btn3dPlay.addEventListener('click', () => {
      const next = !this.scene3d.playing;
      this.scene3d.setPlaying(next);
      this.dom.btn3dPlay.classList.toggle('active', next);
      this.dom.btn3dPlay.textContent = next ? '⏸ 3D' : '▶ 3D';
    });

    this.dom.btnAutoRotate?.addEventListener('click', () => {
      const next = !this.scene3d.autoRotate;
      this.scene3d.setAutoRotate(next);
      this.dom.btnAutoRotate.classList.toggle('active', next);
    });

    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.scene3d.setSpeedMultiplier(Number(btn.dataset.speed));
      });
    });

    this.dom.btnMuscleHl.addEventListener('click', () => {
      const next = !this.scene3d.highlightMuscles;
      this.scene3d.setHighlightMuscles(next);
      this.dom.btnMuscleHl.classList.toggle('active', next);
    });

    this.dom.btnToggle3d?.addEventListener('click', () => {
      this.mobile3dOpen = !this.mobile3dOpen;
      this.dom.stageBody3d?.classList.toggle('mobile-collapsed', !this.mobile3dOpen);
      this.dom.btnToggle3d.textContent = this.mobile3dOpen ? '▾ 3D' : '▸ 3D';
      this.dom.btnToggle3d.setAttribute('aria-expanded', String(this.mobile3dOpen));
      if (this.mobile3dOpen) {
        requestAnimationFrame(() => this.scene3d?.resize());
      }
    });

    this.dom.btnToggleSteps?.addEventListener('click', () => {
      this.mobileStepsOpen = !this.mobileStepsOpen;
      this.dom.coachingBox?.classList.toggle('mobile-collapsed', !this.mobileStepsOpen);
      this.dom.btnToggleSteps.classList.toggle('active', this.mobileStepsOpen);
      this.dom.btnToggleSteps.setAttribute('aria-expanded', String(this.mobileStepsOpen));
    });

    this.dom.stageSideToggle.querySelectorAll('.side-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const side = btn.dataset.side;
        if (this.selectedItemKey) {
          this.timers.setSide(this.selectedItemKey, side);
        }
        this.scene3d.setSide(side);
        this.syncSideToggleUI(side);
      });
    });

    this.dom.hudTimerToggle.addEventListener('click', () => {
      if (!this.selectedItemKey) return;
      this.timers.toggle(this.selectedItemKey);
    });

    this.dom.btnGuidedNext.addEventListener('click', () => {
      this.startNextIncompleteItem();
    });

    this.dom.btnResetDay.addEventListener('click', () => {
      const day = this.getActiveDay();
      if (!day) return;
      this.timers.clearDayProgress(`${this.profileId}:${day.id}:`);
      delete this.manualDaysDone[`${this.profileId}:${day.id}`];
      this.timers.setMeta('manualDaysDone', this.manualDaysDone);
      this.renderDaySections();
      this.updateDaySummaryUI();
      this.renderDayNav();
      this.renderWeeklySummary();
      this.showToast(`Progresso de ${day.name} reiniciado`);
    });
  }

  setActiveWeek(week) {
    this.activeWeek = week;
    this.timers.setMeta('activeWeek', week);
    document.querySelectorAll('.week-btn').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.week) === week);
    });
    this.renderEvolutionTable();
    this.renderDaySections();
    // Atualiza velocidade na cena 3D se uma etapa da esteira estiver selecionada
    const selected = this.dayItemsIndex.find(i => i.key === this.selectedItemKey);
    if (selected?.section === 'esteira') {
      const kmh = this.resolveStageSpeed(selected.rawStage);
      this.scene3d.setTreadmillParams(kmh, this.incline);
      this.dom.activeTmBadge.textContent = `${this.formatSpeed(kmh)} • Incl. ${this.incline}%`;
    }
    this.showToast(`${week}ª Semana selecionada`);
  }

  updateMuteBtn() {
    const muted = sound.isMuted();
    this.dom.btnMute.innerHTML = muted ? '🔇 <span class="hide-sm">Mudo</span>' : '🔊 <span class="hide-sm">Som</span>';
  }

  renderAll() {
    const profile = this.getProfile();
    document.documentElement.dataset.theme = profile.theme || 'emerald';
    if (!profile.days.some(d => d.id === this.activeDayId)) {
      this.activeDayId = profile.days[0].id;
    }

    document.querySelectorAll('.profile-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.profile === this.profileId);
    });
    document.querySelectorAll('.week-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.week) === this.activeWeek);
    });
    this.dom.weekSelector?.classList.toggle('hidden', !profile.treadmillProgression);
    this.updateMuteBtn();

    this.dom.profileTagline.textContent = profile.subtitle;

    if (!profile.ready) {
      this.dom.dayNav.classList.add('hidden');
      this.dom.workspace.classList.add('hidden');
      this.dom.placeholder.classList.remove('hidden');
      return;
    }

    this.dom.dayNav.classList.remove('hidden');
    this.dom.workspace.classList.remove('hidden');
    this.dom.placeholder.classList.add('hidden');

    this.renderDayNav();
    this.renderDaySections();
    this.renderEvolutionTable();
    this.renderWeeklySummary();
    this.renderTips();
    this.selectDefaultExerciseForDay();
  }

  renderDayNav() {
    const profile = this.getProfile();
    this.dom.dayNav.innerHTML = '';

    for (const day of profile.days) {
      const stats = this.computeDayStats(day);
      const isActive = day.id === this.activeDayId;
      let dotClass = '';
      if (stats.isDone) dotClass = 'complete';
      else if (stats.doneCount > 0) dotClass = 'partial';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `day-tab ${isActive ? 'active' : ''}`;
      btn.innerHTML = `
        <div class="day-tab-top">
          <span>${day.shortName}</span>
          <span class="day-status-dot ${dotClass}"></span>
        </div>
        <div class="day-tab-focus">${day.focus}</div>
      `;
      btn.addEventListener('click', () => {
        this.activeDayId = day.id;
        this.activeDayByProfile[this.profileId] = day.id;
        this.selectedItemKey = null;
        this.renderDayNav();
        this.renderDaySections();
        this.selectDefaultExerciseForDay();
      });
      this.dom.dayNav.appendChild(btn);
    }
  }

  buildDayItemsList(day) {
    const profile = this.getProfile();
    const list = [];
    if (day.isRest) return list;

    if (profile.warmup?.items) {
      for (const item of profile.warmup.items) {
        const key = this.makeItemKey(day.id, 'warmup', item.uid);
        this.timers.registerItem(key, item);
        list.push({
          key,
          section: 'warmup',
          exerciseId: item.exerciseId,
          title: EXERCISE_CATALOG[item.exerciseId].name,
          prescription: item.prescription,
          config: item
        });
      }
    }

    if (day.treadmill) {
      for (const stage of day.treadmill.stages) {
        const key = this.makeItemKey(day.id, 'esteira', stage.uid);
        const cfg = { timerType: 'countdown', seconds: stage.minutes * 60, sets: 1, perSide: false };
        this.timers.registerItem(key, cfg);
        list.push({
          key,
          section: 'esteira',
          exerciseId: 'treadmill',
          title: `Esteira — ${stage.label}`,
          prescription: `${stage.minutes} min`,
          rawStage: stage,
          config: cfg
        });
      }
    }

    if (day.exercises?.length) {
      for (const ex of day.exercises) {
        const key = this.makeItemKey(day.id, 'exercicio', ex.uid);
        this.timers.registerItem(key, ex);
        list.push({
          key,
          section: 'exercicio',
          exerciseId: ex.exerciseId,
          title: ex.customName || EXERCISE_CATALOG[ex.exerciseId].name,
          prescription: ex.prescription,
          config: ex
        });
      }
    }

    if (profile.cooldown?.items) {
      for (const item of profile.cooldown.items) {
        const key = this.makeItemKey(day.id, 'cooldown', item.uid);
        this.timers.registerItem(key, item);
        list.push({
          key,
          section: 'cooldown',
          exerciseId: item.exerciseId,
          title: EXERCISE_CATALOG[item.exerciseId].name,
          prescription: item.prescription,
          config: item
        });
      }
    }

    return list;
  }

  computeDayStats(day) {
    const manualKey = `${this.profileId}:${day.id}`;
    if (day.isRest) {
      const done = Boolean(this.manualDaysDone[manualKey]);
      return { total: 1, doneCount: done ? 1 : 0, isDone: done };
    }
    const items = this.buildDayItemsList(day);
    let doneCount = 0;
    for (const it of items) {
      if (this.timers.getState(it.key)?.done) doneCount++;
    }
    const isDone = items.length > 0 && doneCount === items.length || Boolean(this.manualDaysDone[manualKey]);
    return { total: items.length, doneCount, isDone };
  }

  renderDaySections() {
    const profile = this.getProfile();
    const day = this.getActiveDay();
    if (!day) return;

    this.dom.daySchedulePill.textContent = day.schedule;
    this.dom.dayTitle.textContent = `${day.name} — ${day.focus}`;
    this.dayItemsIndex = this.buildDayItemsList(day);

    this.dom.sectionsContainer.innerHTML = '';

    if (day.isRest) {
      const manualKey = `${this.profileId}:${day.id}`;
      const isDone = Boolean(this.manualDaysDone[manualKey]);
      this.dom.sectionsContainer.innerHTML = `
        <div class="rest-card">
          <span class="cat-badge">Descanso Programado</span>
          <h3>${day.name} — Recuperação Muscular</h3>
          <p>Aproveite o dia de descanso para recuperar articulações, hidratar-se bem e manter a consistência para o próximo treino.</p>
          <button id="btn-rest-check" class="primary-btn" type="button">
            ${isDone ? '✓ Dia de descanso concluído' : 'Marcar descanso como concluído'}
          </button>
        </div>
      `;
      document.getElementById('btn-rest-check')?.addEventListener('click', () => {
        this.manualDaysDone[manualKey] = !this.manualDaysDone[manualKey];
        this.timers.setMeta('manualDaysDone', this.manualDaysDone);
        this.renderDaySections();
        this.updateDaySummaryUI();
        this.renderDayNav();
        this.renderWeeklySummary();
      });
      this.updateDaySummaryUI();
      return;
    }

    let stepCounter = 1;

    // 1. Alongamento Dinâmico (Aquecimento)
    if (profile.warmup?.items?.length) {
      this.dom.sectionsContainer.appendChild(
        this.createWorkoutSection({
          step: String(stepCounter++),
          title: profile.warmup.title,
          durationLabel: profile.warmup.durationLabel,
          items: this.dayItemsIndex.filter(i => i.section === 'warmup')
        })
      );
    }

    // 2. Esteira
    if (day.treadmill) {
      this.dom.sectionsContainer.appendChild(this.createTreadmillSection(day, String(stepCounter++)));
    }

    // 3. Exercícios do Dia
    if (day.exercises?.length) {
      this.dom.sectionsContainer.appendChild(
        this.createWorkoutSection({
          step: String(stepCounter++),
          title: day.exercisesTitle || `Exercícios — ${day.focus}`,
          durationLabel: `${day.exercisesDurationMin} min`,
          items: this.dayItemsIndex.filter(i => i.section === 'exercicio')
        })
      );
    }

    // 4. Alongamento Depois do Treino
    if (profile.cooldown?.items?.length) {
      this.dom.sectionsContainer.appendChild(
        this.createWorkoutSection({
          step: String(stepCounter++),
          title: profile.cooldown.title,
          durationLabel: profile.cooldown.durationLabel,
          items: this.dayItemsIndex.filter(i => i.section === 'cooldown')
        })
      );
    }

    this.updateDaySummaryUI();
  }

  createWorkoutSection({ step, title, durationLabel, items }) {
    const card = document.createElement('article');
    card.className = 'section-card';

    const head = document.createElement('div');
    head.className = 'section-head';
    head.innerHTML = `
      <div class="section-title-wrap">
        <span class="section-step">${step}</span>
        <h3>${title}</h3>
      </div>
      <span class="section-duration">${durationLabel}</span>
    `;
    card.appendChild(head);

    const listEl = document.createElement('div');
    listEl.className = 'item-list';

    for (const item of items) {
      listEl.appendChild(this.createItemRow(item));
    }
    card.appendChild(listEl);
    return card;
  }

  createTreadmillSection(day, stepNum = '2') {
    const profile = this.getProfile();
    const card = document.createElement('article');
    card.className = 'section-card';
    const stagesSum = day.treadmill.stages.reduce((acc, s) => acc + s.minutes, 0);
    const labelDuration = stagesSum === day.treadmill.durationMin
      ? `${day.treadmill.durationMin} min`
      : `${day.treadmill.durationMin} min (${stagesSum} min etapas)`;

    const head = document.createElement('div');
    head.className = 'section-head';
    head.innerHTML = `
      <div class="section-title-wrap">
        <span class="section-step">${stepNum}</span>
        <h3>Esteira — Etapas e Velocidade</h3>
      </div>
      <span class="section-duration">${labelDuration}</span>
    `;
    card.appendChild(head);

    // Barra de evolução e inclinação da esteira
    const bar = document.createElement('div');
    bar.className = 'treadmill-controls-bar';
    const progHtml = profile.treadmillProgression
      ? `<button type="button" class="pill-toggle ${this.applyWeekProgression ? 'active' : ''}" data-action="toggle-prog">
          ${this.applyWeekProgression ? `✓ Evolução Semana ${this.activeWeek} aplicada` : `Aplicar Evolução (Sem ${this.activeWeek})`}
        </button>`
      : '';
    bar.innerHTML = `
      ${progHtml}
      <button type="button" class="pill-toggle ${this.autoAdvanceTreadmill ? 'active' : ''}" data-action="toggle-auto-tm">
        ${this.autoAdvanceTreadmill ? '✓ Auto-próxima etapa' : 'Auto-próxima etapa'}
      </button>
      <div class="incline-group">
        <span>Inclinação:</span>
        ${[0, 0.5, 1].map(inc => `
          <button type="button" class="incline-btn ${this.incline === inc ? 'active' : ''}" data-incline="${inc}">${String(inc).replace('.', ',')}%</button>
        `).join('')}
      </div>
    `;

    bar.querySelector('[data-action="toggle-prog"]')?.addEventListener('click', () => {
      this.applyWeekProgression = !this.applyWeekProgression;
      this.timers.setMeta('applyWeekProgression', this.applyWeekProgression);
      this.renderDaySections();
      const selected = this.dayItemsIndex.find(i => i.key === this.selectedItemKey);
      if (selected?.section === 'esteira') this.selectItem(selected.key);
    });

    bar.querySelector('[data-action="toggle-auto-tm"]').addEventListener('click', () => {
      this.autoAdvanceTreadmill = !this.autoAdvanceTreadmill;
      this.timers.setMeta('autoAdvanceTreadmill', this.autoAdvanceTreadmill);
      this.renderDaySections();
    });

    bar.querySelectorAll('.incline-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.incline = Number(btn.dataset.incline);
        this.timers.setMeta('incline', this.incline);
        this.renderDaySections();
        const selected = this.dayItemsIndex.find(i => i.key === this.selectedItemKey);
        if (selected?.section === 'esteira') {
          this.scene3d.setTreadmillParams(this.resolveStageSpeed(selected.rawStage), this.incline);
          this.dom.activeTmBadge.textContent = `${this.formatSpeed(this.resolveStageSpeed(selected.rawStage))} • Incl. ${this.incline}%`;
        }
      });
    });

    card.appendChild(bar);

    const listEl = document.createElement('div');
    listEl.className = 'item-list';
    for (const item of this.dayItemsIndex.filter(i => i.section === 'esteira')) {
      listEl.appendChild(this.createItemRow(item));
    }
    card.appendChild(listEl);

    return card;
  }

  createItemRow(item) {
    const st = this.timers.getState(item.key);
    const row = document.createElement('div');
    row.className = `workout-row ${st.done ? 'done' : ''} ${this.selectedItemKey === item.key ? 'selected' : ''}`;
    row.dataset.itemKey = item.key;

    let subtitle = '';
    let speedBadge = '';
    if (item.section === 'esteira') {
      const kmh = this.resolveStageSpeed(item.rawStage);
      const changed = kmh !== item.rawStage.speed;
      speedBadge = changed
        ? `${this.formatSpeed(kmh)} (base ${this.formatSpeed(item.rawStage.speed)})`
        : this.formatSpeed(kmh);
      subtitle = `${speedBadge} • Inclinação ${String(this.incline).replace('.', ',')}%`;
    } else {
      subtitle = EXERCISE_CATALOG[item.exerciseId].musclesLabel;
    }

    const main = document.createElement('div');
    main.className = 'row-main';
    main.innerHTML = `
      <button type="button" class="check-btn ${st.done ? 'checked' : ''}" data-action="done" title="Marcar como concluído">
        ${st.done ? '✓' : ''}
      </button>
      <div class="item-info">
        <div class="item-name-line">
          <span class="item-name">${item.title}</span>
          <span class="item-rx">${item.prescription}</span>
        </div>
        <span class="item-sub">${subtitle}</span>
      </div>
    `;

    main.querySelector('[data-action="done"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.timers.toggleDone(item.key);
    });

    main.addEventListener('click', () => {
      this.selectItem(item.key);
    });

    // Controles à direita: Quantidade (séries/reps/lado) + Cronômetro individual
    const controls = document.createElement('div');
    controls.className = 'row-controls';

    // Lado (Dir / Esq) para exercícios ou alongamentos unilaterais
    if (st.perSide) {
      const sideStrip = document.createElement('div');
      sideStrip.className = 'side-strip';
      for (const s of ['right', 'left']) {
        const label = s === 'right' ? 'Dir' : 'Esq';
        const isDoneSide = s === 'right' ? st.rightDone : st.leftDone;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `side-chip ${st.side === s ? 'active' : ''} ${isDoneSide ? 'done' : ''}`;
        btn.dataset.side = s;
        btn.textContent = label;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectItem(item.key);
          this.timers.setSide(item.key, s);
          this.scene3d.setSide(s);
          this.syncSideToggleUI(s);
        });
        sideStrip.appendChild(btn);
      }
      controls.appendChild(sideStrip);
    }

    // Cronômetro individual ao lado de cada treino/alongamento
    const timerBox = document.createElement('div');
    timerBox.className = `inline-timer ${st.running ? 'running' : ''}`;
    timerBox.dataset.timerBox = item.key;
    timerBox.innerHTML = `
      <span class="timer-readout" data-readout="${item.key}">${this.timers.getDisplayTime(item.key)}</span>
      <button type="button" class="timer-btn play" data-action="play" title="${st.running ? 'Pausar' : 'Iniciar cronômetro'}">${st.running ? '⏸' : '▶'}</button>
      <button type="button" class="timer-btn reset" data-action="reset" title="Zerar cronômetro">↺</button>
    `;

    timerBox.querySelector('[data-action="play"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectItem(item.key);
      this.timers.toggle(item.key);
    });

    timerBox.querySelector('[data-action="reset"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.timers.resetTimer(item.key);
    });

    controls.appendChild(timerBox);
    row.appendChild(main);
    row.appendChild(controls);
    return row;
  }

  selectDefaultExerciseForDay() {
    const day = this.getActiveDay();
    if (!day) return;
    if (day.isRest) {
      this.selectedItemKey = null;
      this.applyExerciseToStage('rest_day', { title: `${day.name} — Descanso`, prescription: 'Recuperação', perSide: false });
      return;
    }
    const firstPending = this.dayItemsIndex.find(i => !this.timers.getState(i.key)?.done) || this.dayItemsIndex[0];
    if (firstPending) {
      this.selectItem(firstPending.key, false);
    }
  }

  selectItem(key, scrollIntoView = false) {
    const item = this.dayItemsIndex.find(i => i.key === key);
    if (!item) return;

    this.selectedItemKey = key;
    const isCompactScreen = window.innerWidth <= 768 || document.documentElement.dataset.mobileLandscape === '1';
    if (!this.mobile3dOpen && isCompactScreen) {
      this.mobile3dOpen = true;
      this.dom.stageBody3d?.classList.remove('mobile-collapsed');
      if (this.dom.btnToggle3d) {
        this.dom.btnToggle3d.textContent = '▾ 3D';
        this.dom.btnToggle3d.setAttribute('aria-expanded', 'true');
      }
      requestAnimationFrame(() => this.scene3d?.resize());
    }
    document.querySelectorAll('.workout-row').forEach(r => {
      r.classList.toggle('selected', r.dataset.itemKey === key);
    });

    if (scrollIntoView) {
      const targetRow = document.querySelector(`.workout-row[data-item-key="${CSS.escape(key)}"]`);
      targetRow?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const st = this.timers.getState(key);
    const speedKmh = item.section === 'esteira' ? this.resolveStageSpeed(item.rawStage) : 4.5;
    this.applyExerciseToStage(item.exerciseId, {
      title: item.title,
      prescription: item.prescription,
      perSide: Boolean(st?.perSide),
      side: st?.side || 'right',
      speedKmh,
      isTreadmill: item.section === 'esteira'
    });
    this.syncStageTimerHud();
  }

  applyExerciseToStage(exerciseId, { title, prescription, perSide, side = 'right', speedKmh = 4.5, isTreadmill = false }) {
    const ex = EXERCISE_CATALOG[exerciseId] || EXERCISE_CATALOG.squat;

    this.dom.activeCatBadge.textContent = CATEGORY_LABELS[ex.category] || 'Treino';
    this.dom.activeRxBadge.textContent = prescription || '';
    this.dom.activeTitle.textContent = title || ex.name;
    this.dom.activeMuscles.textContent = ex.musclesLabel;

    if (isTreadmill) {
      this.dom.activeTmBadge.classList.remove('hidden');
      this.dom.activeTmBadge.textContent = `${this.formatSpeed(speedKmh)} • Incl. ${this.incline}%`;
    } else {
      this.dom.activeTmBadge.classList.add('hidden');
    }

    this.dom.stageSideToggle.classList.toggle('hidden', !perSide);
    this.syncSideToggleUI(side);

    this.dom.activeSteps.innerHTML = ex.steps.map(s => `<li>${s}</li>`).join('');
    this.dom.activeTip.textContent = ex.tip;

    // Atualiza botão ativo de câmera
    document.querySelectorAll('.cam-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.cam === ex.defaultCamera);
    });

    this.scene3d.setSide(side);
    this.scene3d.setExercise({
      anim: ex.anim,
      prop: ex.prop,
      defaultCamera: ex.defaultCamera,
      muscles: ex.muscles,
      speedKmh,
      incline: this.incline
    });
  }

  syncSideToggleUI(side) {
    this.dom.stageSideToggle.querySelectorAll('.side-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.side === side);
    });
  }

  syncStageTimerHud() {
    if (!this.selectedItemKey) {
      this.dom.stageLiveHud.classList.add('hidden');
      return;
    }
    const st = this.timers.getState(this.selectedItemKey);
    if (!st) return;

    this.dom.stageLiveHud.classList.remove('hidden');
    this.dom.stageLiveHud.classList.toggle('running', st.running);
    this.dom.hudModeLabel.textContent = st.mode === 'countdown' ? 'TEMPO RESTANTE' : 'CRONÔMETRO';
    this.dom.hudTimerValue.textContent = this.timers.getDisplayTime(this.selectedItemKey);
    this.dom.hudTimerToggle.textContent = st.running ? '⏸' : '▶';
  }

  onTimerChange(key) {
    const st = this.timers.getState(key);
    if (!st) return;

    const row = document.querySelector(`.workout-row[data-item-key="${CSS.escape(key)}"]`);
    if (row) {
      row.classList.toggle('done', st.done);
      const chk = row.querySelector('[data-action="done"]');
      if (chk) {
        chk.classList.toggle('checked', st.done);
        chk.textContent = st.done ? '✓' : '';
      }

      const readout = row.querySelector(`[data-readout="${CSS.escape(key)}"]`);
      if (readout) readout.textContent = this.timers.getDisplayTime(key);

      const tBox = row.querySelector(`[data-timer-box="${CSS.escape(key)}"]`);
      if (tBox) {
        tBox.classList.toggle('running', st.running);
        const playBtn = tBox.querySelector('[data-action="play"]');
        if (playBtn) playBtn.textContent = st.running ? '⏸' : '▶';
      }

      row.querySelectorAll('.side-chip').forEach(sc => {
        const s = sc.dataset.side;
        sc.classList.toggle('active', st.side === s);
        sc.classList.toggle('done', s === 'right' ? st.rightDone : st.leftDone);
      });
    }

    if (key === this.selectedItemKey) {
      this.syncStageTimerHud();
      if (st.perSide) {
        this.scene3d.setSide(st.side);
        this.syncSideToggleUI(st.side);
      }
    }

    this.updateDaySummaryUI();
    this.renderDayNavStatusDots();
    this.renderWeeklySummary();
  }

  onTimerComplete(key, state, message) {
    const item = this.dayItemsIndex.find(i => i.key === key);
    if (item && message) {
      this.showToast(`${item.title}: ${message}`);
    }

    // Auto-avança para a próxima etapa da esteira quando ativado
    if (item?.section === 'esteira' && state.done && this.autoAdvanceTreadmill) {
      const idx = this.dayItemsIndex.findIndex(i => i.key === key);
      const nextItem = this.dayItemsIndex[idx + 1];
      if (nextItem && nextItem.section === 'esteira') {
        this.selectItem(nextItem.key, true);
        this.timers.start(nextItem.key);
        this.showToast(`Iniciando próxima etapa: ${nextItem.title}`);
        return;
      }
    }

    // Celebração se todo o dia acabou de ser concluído
    const day = this.getActiveDay();
    if (day && this.computeDayStats(day).isDone) {
      sound.playWorkoutComplete();
      this.showToast(`Parabéns! Treino de ${day.name} 100% concluído!`);
    }
  }

  startNextIncompleteItem() {
    const nextItem = this.dayItemsIndex.find(i => !this.timers.getState(i.key)?.done);
    if (!nextItem) {
      this.showToast('Todas as etapas deste dia já foram concluídas!');
      return;
    }
    this.selectItem(nextItem.key, true);
    this.timers.start(nextItem.key);
  }

  updateDaySummaryUI() {
    const day = this.getActiveDay();
    if (!day) return;

    const stats = this.computeDayStats(day);
    const pct = stats.total > 0 ? Math.round((stats.doneCount / stats.total) * 100) : 0;
    this.dom.dayProgressText.textContent = `${stats.doneCount} / ${stats.total} concluídos (${pct}%)`;
    this.dom.dayProgressFill.style.width = `${pct}%`;

    const totalSec = this.timers.getTotalLoggedSecondsForPrefix(`${this.profileId}:${day.id}:`);
    this.dom.dayTotalTime.textContent = formatStopwatch(totalSec);
  }

  renderDayNavStatusDots() {
    const profile = this.getProfile();
    const tabs = this.dom.dayNav.querySelectorAll('.day-tab');
    profile.days.forEach((day, idx) => {
      const tab = tabs[idx];
      if (!tab) return;
      const dot = tab.querySelector('.day-status-dot');
      if (!dot) return;
      const stats = this.computeDayStats(day);
      dot.classList.remove('partial', 'complete');
      if (stats.isDone) dot.classList.add('complete');
      else if (stats.doneCount > 0) dot.classList.add('partial');
    });
  }

  renderEvolutionTable() {
    const profile = this.getProfile();
    if (!profile.ready) return;

    if (profile.treadmillProgression) {
      this.dom.evolutionCardTitle.textContent = '📈 Evolução da Esteira (4 Semanas)';
      this.dom.activeWeekPill.classList.remove('hidden');
      this.dom.activeWeekPill.textContent = `Semana ${this.activeWeek} ativa`;
      this.dom.evolutionMarcosBody.classList.remove('hidden');
      this.dom.treadmillGuideList.classList.add('hidden');
      this.dom.evolutionTbody.innerHTML = '';

      for (const row of profile.treadmillProgression) {
        const tr = document.createElement('tr');
        tr.className = row.week === this.activeWeek ? 'active-week' : '';
        tr.innerHTML = `
          <td>${row.label}</td>
          <td>${this.formatSpeed(row.walkSpeed)}</td>
          <td>${this.formatSpeed(row.jogSpeed)}</td>
        `;
        tr.addEventListener('click', () => {
          this.setActiveWeek(row.week);
        });
        this.dom.evolutionTbody.appendChild(tr);
      }
    } else if (profile.treadmillGuide) {
      this.dom.evolutionCardTitle.textContent = '🏃‍♀️ Como fazer a esteira?';
      this.dom.activeWeekPill.classList.add('hidden');
      this.dom.evolutionMarcosBody.classList.add('hidden');
      this.dom.treadmillGuideList.classList.remove('hidden');
      this.dom.treadmillGuideList.innerHTML = profile.treadmillGuide.map(g => `<li>${g}</li>`).join('');
    }
  }

  renderWeeklySummary() {
    const profile = this.getProfile();
    if (!profile.ready) return;

    this.dom.summaryCardTitle.textContent = profile.days.length === 15 ? '📅 Calendário dos Treinos (15 Dias)' : '📋 Resumo da Semana';
    this.dom.weeklySummaryList.innerHTML = '';
    let completedDays = 0;

    for (const day of profile.days) {
      const stats = this.computeDayStats(day);
      if (stats.isDone) completedDays++;
      const li = document.createElement('li');
      li.className = `weekly-item ${stats.isDone ? 'done' : ''}`;
      li.innerHTML = `
        <span>${stats.isDone ? '☑' : '☐'} ${day.name.split('-')[0]} — ${day.focus}</span>
        <span>${day.isRest ? (stats.isDone ? 'Concluído' : 'Descanso') : `${stats.doneCount}/${stats.total}`}</span>
      `;
      li.addEventListener('click', () => {
        this.activeDayId = day.id;
        this.activeDayByProfile[this.profileId] = day.id;
        this.selectedItemKey = null;
        this.renderDayNav();
        this.renderDaySections();
        this.selectDefaultExerciseForDay();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      this.dom.weeklySummaryList.appendChild(li);
    }

    this.dom.weeklyDoneCount.textContent = `${completedDays}/${profile.days.length} dias`;
    this.dom.profileObjective.textContent = profile.objective;
  }

  renderTips() {
    const profile = this.getProfile();
    if (!profile.ready) return;
    this.dom.tipsCardTitle.textContent = profile.id === 'gabi' ? '✨ Dicas de Ouro' : '💡 Dicas Importantes';
    this.dom.tipsList.innerHTML = profile.tips.map(t => `<li>${t}</li>`).join('');

    if (profile.habits?.length) {
      this.dom.habitsCard?.classList.remove('hidden');
      this.dom.habitsList.innerHTML = profile.habits.map(h => `<li>${h}</li>`).join('');
    } else {
      this.dom.habitsCard?.classList.add('hidden');
    }
  }

  showToast(message) {
    this.dom.toast.textContent = message;
    this.dom.toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.dom.toast.classList.add('hidden');
    }, 3400);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__appTreino = new AppTreino();
});
