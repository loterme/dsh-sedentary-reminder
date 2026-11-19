window.__ModuleLoader__.load({
  id: 'dsh-sedentary-reminder',
  factory(require) {
    'use strict';

    var React = require('react');
    var h = React.createElement;

    var NS = 'dsh-sedentary-reminder';
    var STORE_KEY = 'dsh-sedentary-reminder:v1';
    var SIT_OPTIONS = [30, 45, 60, 90];
    var BREAK_OPTIONS = [3, 5, 10];
    var SNOOZE_MINUTES = 10;
    var IDLE_RESET_MS = 5 * 60 * 1000;
    var PAUSE_MS = 60 * 60 * 1000;
    var TOAST_MS = 4200;

    var DICT = {
      zh: {
        name: '久坐提醒',
        pillSitting: '久坐 {time}',
        pillBreak: '休息 {time}',
        pillRemind: '该起来啦',
        pillPaused: '暂停中 · {n} 分',
        pillOff: '提醒已关',
        pillAria: '久坐提醒，{state}，点击打开设置',
        remindTitle: '该起来动一动啦',
        remindBody: '{minutes} 分钟没挪窝了，接杯水、看看远处吧。',
        remindGo: '去走走 · {minutes} 分钟',
        remindSnooze: '再坐 {minutes} 分钟',
        remindPause: '暂停 1 小时',
        settings: '提醒设置',
        close: '关闭',
        breakTitle: '休息一下',
        breakBody: '四处走走，或者站着伸个懒腰。',
        breakEnd: '结束休息',
        breakAria: '休息倒计时 {time}',
        cheer: '休息结束，继续加油',
        snoozed: '好，{minutes} 分钟后再提醒你',
        pausedNotice: '已暂停 1 小时，安心忙你的',
        resumedNotice: '提醒已恢复',
        resetNotice: '计时已重新开始',
        enabledNotice: '提醒已开启',
        settingsTitle: '久坐提醒',
        enableLabel: '开启提醒',
        intervalLabel: '提醒间隔',
        breakLabel: '休息时长',
        hint: '只在你使用页面时计时；离开 5 分钟会自动清零，不会打扰你。',
        offHint: '提醒已关闭。打开开关后重新开始计时。',
        nowBreak: '现在休息',
        resetTimer: '重置计时',
        resume: '恢复提醒',
        pauseAgain: '暂停 1 小时',
        minutes: '{n} 分钟',
      },
      en: {
        name: 'Sedentary reminder',
        pillSitting: 'Sitting {time}',
        pillBreak: 'Break {time}',
        pillRemind: 'Time to move',
        pillPaused: 'Paused · {n}m',
        pillOff: 'Reminders off',
        pillAria: 'Sedentary reminder, {state}. Click to open settings.',
        remindTitle: 'Time to move a little',
        remindBody: 'Sitting for {minutes} minutes. Stand up, stretch, and look out the window.',
        remindGo: 'Take a walk · {minutes} min',
        remindSnooze: 'Sit for {minutes} more',
        remindPause: 'Pause for 1 hour',
        settings: 'Reminder settings',
        close: 'Close',
        breakTitle: 'Take a break',
        breakBody: 'Walk around, or just stand up and stretch.',
        breakEnd: 'End break',
        breakAria: 'Break countdown {time}',
        cheer: 'Break over. Nice work.',
        snoozed: 'Okay, I will remind you in {minutes} minutes',
        pausedNotice: 'Paused for 1 hour. Carry on.',
        resumedNotice: 'Reminders are back on',
        resetNotice: 'Timer restarted',
        enabledNotice: 'Reminders are on',
        settingsTitle: 'Sedentary reminder',
        enableLabel: 'Enable reminders',
        intervalLabel: 'Remind every',
        breakLabel: 'Break length',
        hint: 'Counts only while you are using this page. Leaving for 5 minutes resets it, so it never nags an empty desk.',
        offHint: 'Reminders are off. Turn the switch on to start the timer again.',
        nowBreak: 'Take a break now',
        resetTimer: 'Reset timer',
        resume: 'Resume reminders',
        pauseAgain: 'Pause for 1 hour',
        minutes: '{n} min',
      },
    };

    // ── state ────────────────────────────────────────────────────────────
    var state = loadState();
    var listeners = new Set();
    var saveTimer = 0;
    var lastActivity = Date.now();
    var localeSvc = null;
    var translate = function (key) { return key; };

    function defaults() {
      return {
        enabled: true,
        sitMinutes: 45,
        breakMinutes: 5,
        phase: 'sitting', // sitting | remind | break
        elapsed: 0,
        breakLeft: 0,
        breakUntil: 0,
        pausedUntil: 0,
        cheerUntil: 0,
        toastKey: '',
        toastUntil: 0,
        panelOpen: false,
        savedAt: 0,
      };
    }

    function loadState() {
      var base = defaults();
      var raw = null;
      try { raw = window.localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
      if (!raw) return base;
      var parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      if (!parsed || typeof parsed !== 'object') return base;

      if (typeof parsed.enabled === 'boolean') base.enabled = parsed.enabled;
      if (SIT_OPTIONS.indexOf(parsed.sitMinutes) >= 0) base.sitMinutes = parsed.sitMinutes;
      if (BREAK_OPTIONS.indexOf(parsed.breakMinutes) >= 0) base.breakMinutes = parsed.breakMinutes;

      var now = Date.now();
      if (typeof parsed.pausedUntil === 'number' && parsed.pausedUntil > now) {
        base.pausedUntil = parsed.pausedUntil;
      }

      var savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : 0;
      var delta = savedAt ? Math.floor((now - savedAt) / 1000) : 0;
      var target = base.sitMinutes * 60;
      var elapsed = typeof parsed.elapsed === 'number' ? parsed.elapsed : 0;
      if (parsed.phase === 'remind' && savedAt && delta < 600) {
        base.phase = 'remind';
        base.elapsed = target;
      } else if (parsed.phase === 'break' && typeof parsed.breakUntil === 'number' && parsed.breakUntil > now) {
        // A reload during a break keeps the break going: it is wall-clock based.
        base.phase = 'break';
        base.breakUntil = parsed.breakUntil;
        base.breakLeft = Math.max(0, Math.round((parsed.breakUntil - now) / 1000));
      } else if (parsed.phase === 'sitting' && savedAt && delta > 0 && delta < 300) {
        // A reload keeps the session going, but time with the page closed never counts.
        base.elapsed = Math.min(Math.max(0, elapsed) + delta, target - 1);
      }
      return base;
    }

    function toPersist() {
      return {
        enabled: state.enabled,
        sitMinutes: state.sitMinutes,
        breakMinutes: state.breakMinutes,
        phase: state.phase,
        elapsed: state.elapsed,
        breakLeft: state.breakLeft,
        breakUntil: state.breakUntil,
        pausedUntil: state.pausedUntil,
        savedAt: Date.now(),
      };
    }

    function persistNow() {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(toPersist())); } catch (e) { /* storage full or blocked */ }
    }

    function persistSoon() {
      if (saveTimer) return;
      saveTimer = setTimeout(function () { saveTimer = 0; persistNow(); }, 400);
    }

    function notifyAll() {
      var snapshot = Array.from(listeners);
      for (var i = 0; i < snapshot.length; i++) {
        try { snapshot[i](); } catch (e) { /* one broken listener must not stop the rest */ }
      }
    }

    function set(patch) {
      var changed = false;
      for (var key in patch) {
        if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
        if (state[key] !== patch[key]) { state[key] = patch[key]; changed = true; }
      }
      if (!changed) return;
      notifyAll();
    }

    function subscribe(fn) {
      listeners.add(fn);
      return function () { listeners.delete(fn); };
    }

    function setToast(key) {
      var now = Date.now();
      set({ toastKey: key, toastUntil: now + TOAST_MS });
    }

    // ── actions ──────────────────────────────────────────────────────────
    function startBreak() {
      var minutes = state.breakMinutes;
      set({
        phase: 'break',
        breakLeft: minutes * 60,
        breakUntil: Date.now() + minutes * 60000,
        pausedUntil: 0,
        panelOpen: false,
      });
      persistSoon();
    }

    function endBreak() {
      set({ phase: 'sitting', breakLeft: 0, breakUntil: 0, elapsed: 0, toastKey: '', toastUntil: 0 });
      persistSoon();
    }

    function snooze() {
      var target = state.sitMinutes * 60;
      set({
        phase: 'sitting',
        elapsed: Math.max(0, target - SNOOZE_MINUTES * 60),
        panelOpen: false,
      });
      setToast('snoozed');
      persistSoon();
    }

    function pauseHour() {
      set({
        pausedUntil: Date.now() + PAUSE_MS,
        phase: 'sitting',
        elapsed: 0,
        breakLeft: 0,
        breakUntil: 0,
        panelOpen: false,
      });
      setToast('pausedNotice');
      persistSoon();
    }

    function resumeReminders() {
      set({ pausedUntil: 0, phase: 'sitting', elapsed: 0 });
      setToast('resumedNotice');
      persistSoon();
    }

    function resetTimer() {
      set({ phase: 'sitting', elapsed: 0, breakLeft: 0, breakUntil: 0, pausedUntil: 0 });
      setToast('resetNotice');
      persistSoon();
    }

    function setSitMinutes(n) {
      set({ sitMinutes: n, elapsed: Math.min(state.elapsed, n * 60 - 1) });
      persistSoon();
    }

    function setBreakMinutes(n) {
      set({ breakMinutes: n });
      persistSoon();
    }

    function toggleEnabled() {
      if (state.enabled) {
        set({ enabled: false, pausedUntil: 0, breakLeft: 0, breakUntil: 0, phase: 'sitting', elapsed: 0 });
      } else {
        set({ enabled: true, phase: 'sitting', elapsed: 0, pausedUntil: 0 });
        setToast('enabledNotice');
      }
      persistSoon();
    }

    function togglePanel() {
      set({ panelOpen: !state.panelOpen });
    }

    // ── clock ────────────────────────────────────────────────────────────
    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    function clock(seconds) {
      var total = Math.max(0, Math.round(seconds));
      var hours = Math.floor(total / 3600);
      var minutes = Math.floor((total % 3600) / 60);
      var secs = total % 60;
      if (hours > 0) return hours + ':' + pad2(minutes) + ':' + pad2(secs);
      return pad2(minutes) + ':' + pad2(secs);
    }

    function fmt(template, vars) {
      var out = template;
      for (var key in vars) {
        if (!Object.prototype.hasOwnProperty.call(vars, key)) continue;
        out = out.split('{' + key + '}').join(String(vars[key]));
      }
      return out;
    }

    function toneOf(st) {
      if (!st.enabled || st.pausedUntil) return 'muted';
      if (st.phase === 'break') return 'ok';
      if (st.phase === 'remind') return 'warn';
      return 'idle';
    }

    function pillText(st, t) {
      if (!st.enabled) return t('pillOff');
      if (st.pausedUntil) {
        var pausedMinutes = Math.max(1, Math.ceil((st.pausedUntil - Date.now()) / 60000));
        return fmt(t('pillPaused'), { n: pausedMinutes });
      }
      if (st.phase === 'break') return fmt(t('pillBreak'), { time: clock(st.breakLeft) });
      if (st.phase === 'remind') return t('pillRemind');
      return fmt(t('pillSitting'), { time: clock(st.elapsed) });
    }

    function pillProgress(st) {
      if (st.phase === 'break' && st.breakMinutes > 0) {
        return Math.max(0, Math.min(1, st.breakLeft / (st.breakMinutes * 60)));
      }
      if (st.phase === 'remind') return 1;
      if (st.phase === 'sitting' && st.sitMinutes > 0) {
        return Math.max(0, Math.min(1, st.elapsed / (st.sitMinutes * 60)));
      }
      return 0;
    }

    // ── ticking ──────────────────────────────────────────────────────────
    var tickCount = 0;
    var lastPausedMinute = 0;

    function step() {
      var now = Date.now();
      var st = state;

      if (st.toastUntil && now >= st.toastUntil) {
        set({ toastKey: '', toastUntil: 0 });
      }
      if (!st.enabled) return;
      if (st.pausedUntil) {
        if (now >= st.pausedUntil) {
          set({ pausedUntil: 0, phase: 'sitting', elapsed: 0 });
          setToast('resumedNotice');
          persistSoon();
        } else {
          // The pill speaks in whole minutes; re-render only when that number changes.
          var pausedMinute = Math.ceil((st.pausedUntil - now) / 60000);
          if (pausedMinute !== lastPausedMinute) {
            lastPausedMinute = pausedMinute;
            notifyAll();
          }
        }
        return;
      }
      lastPausedMinute = 0;

      if (st.phase === 'break') {
        // A break is wall-clock based, so it finishes on its own even if you walk away,
        // switch apps, or the browser throttles the timer. That is the whole point.
        var left = Math.round((st.breakUntil - now) / 1000);
        if (left <= 0) {
          set({ phase: 'sitting', breakLeft: 0, breakUntil: 0, elapsed: 0, toastKey: 'cheer', toastUntil: now + TOAST_MS });
          persistSoon();
        } else {
          set({ breakLeft: left });
          tickCount += 1;
          if (tickCount % 15 === 0) persistSoon();
        }
        return;
      }

      // Sitting only counts while this page is actually being used.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      // Five quiet minutes without input means the desk was empty; do not count it.
      if (now - lastActivity > IDLE_RESET_MS) {
        if (st.elapsed > 0) { set({ elapsed: 0 }); persistSoon(); }
        return;
      }

      if (st.phase === 'sitting') {
        var target = st.sitMinutes * 60;
        if (st.elapsed < target) {
          var next = Math.min(target, st.elapsed + 1);
          if (next >= target) {
            set({ elapsed: target, phase: 'remind' });
            persistSoon();
          } else {
            set({ elapsed: next });
            tickCount += 1;
            if (tickCount % 15 === 0) persistSoon();
          }
        }
      }
    }

    // ── React glue ───────────────────────────────────────────────────────
    function useStore() {
      var pair = React.useState(state);
      var st = pair[0];
      var setSt = pair[1];
      React.useEffect(function () {
        return subscribe(function () { setSt(Object.assign({}, state)); });
      }, []);
      return st;
    }

    function useLocaleRevision() {
      var pair = React.useState(0);
      var bump = pair[1];
      React.useEffect(function () {
        if (!localeSvc || typeof localeSvc.subscribe !== 'function') return undefined;
        return localeSvc.subscribe(function () {
          bump(function (n) { return n + 1; });
        });
      }, []);
    }

    function useTicker() {
      React.useEffect(function () {
        lastActivity = Date.now();
        var timer = window.setInterval(step, 1000);

        function noteActivity() { lastActivity = Date.now(); }
        function onVisibility() {
          if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
            lastActivity = Date.now();
            persistSoon();
          }
        }
        function onPageHide() { persistNow(); }

        var events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
        for (var i = 0; i < events.length; i++) {
          window.addEventListener(events[i], noteActivity, { passive: true, capture: true });
        }
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pagehide', onPageHide);

        return function () {
          window.clearInterval(timer);
          for (var j = 0; j < events.length; j++) {
            window.removeEventListener(events[j], noteActivity, { capture: true });
          }
          document.removeEventListener('visibilitychange', onVisibility);
          window.removeEventListener('pagehide', onPageHide);
          persistNow();
        };
      }, []);
    }

    function useEscape() {
      React.useEffect(function () {
        function onKey(event) {
          if (event.key !== 'Escape') return;
          if (state.panelOpen) { set({ panelOpen: false }); return; }
          // Dismissing the reminder from the keyboard is the gentlest interpretation of "not now".
          if (state.phase === 'remind') snooze();
        }
        window.addEventListener('keydown', onKey);
        return function () { window.removeEventListener('keydown', onKey); };
      }, []);
    }

    // ── icons ────────────────────────────────────────────────────────────
    function Icon(props) {
      var size = props.size || 16;
      var base = {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': 'true',
      };
      if (props.name === 'close') return h('svg', base, h('path', { d: 'M6 6l12 12M18 6L6 18' }));
      if (props.name === 'sliders') {
        return h('svg', base,
          h('path', { d: 'M4 7h10M18 7h2M4 17h2M10 17h10' }),
          h('circle', { cx: 16, cy: 7, r: 2 }),
          h('circle', { cx: 8, cy: 17, r: 2 })
        );
      }
      if (props.name === 'walk') {
        return h('svg', base,
          h('circle', { cx: 13, cy: 4, r: 2 }),
          h('path', { d: 'M13 6l-2.5 5.5L14 13l1.5 6' }),
          h('path', { d: 'M10.5 11.5L7 13' }),
          h('path', { d: 'M13 8l3-2' })
        );
      }
      if (props.name === 'stretch') {
        return h('svg', base,
          h('circle', { cx: 12, cy: 4, r: 2 }),
          h('path', { d: 'M12 6v6' }),
          h('path', { d: 'M12 8L8 4M12 8l4-4' }),
          h('path', { d: 'M12 12l-3 7M12 12l3 7' })
        );
      }
      // 'seat'
      return h('svg', base,
        h('path', { d: 'M7 11h9a2 2 0 0 1 2 2v3M7 16H6a2 2 0 0 1-2-2v-3' }),
        h('path', { d: 'M8 11V7a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v4' }),
        h('path', { d: 'M8 16v4M16 16v4' })
      );
    }

    function Ring(props) {
      var C = 2 * Math.PI * 5.4;
      var progress = Math.max(0, Math.min(1, props.progress));
      // Below a few percent the arc is a stray speck, not information: draw nothing.
      var filled = progress >= 0.04 ? progress : 0;
      return h('svg', {
        className: 'dsr-ring', 'data-tone': props.tone,
        width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': 'true',
      },
        h('circle', { cx: 7, cy: 7, r: 5.4, className: 'dsr-ring-track' }),
        h('circle', {
          cx: 7, cy: 7, r: 5.4, className: 'dsr-ring-fill',
          transform: 'rotate(-90 7 7)',
          strokeDasharray: C.toFixed(2),
          strokeDashoffset: (C * (1 - filled)).toFixed(2),
        })
      );
    }

    // ── components ───────────────────────────────────────────────────────
    function StatusPill() {
      useLocaleRevision();
      var st = useStore();
      var t = translate;
      var text = pillText(st, t);
      var anchorRef = React.useRef(null);

      // The bottom card belongs to the composer, not to the window: measure the composer
      // itself so the card sits over it, and above it, at any window size.
      React.useEffect(function () {
        var el = anchorRef.current;
        if (!el) return undefined;

        function composerRect() {
          var nodes = document.querySelectorAll('textarea, [contenteditable="true"]');
          var bestEl = null;
          var bestRect = null;
          for (var i = 0; i < nodes.length; i += 1) {
            var rect = nodes[i].getBoundingClientRect();
            if (rect.width < 120 || rect.height < 16) continue;
            if (rect.bottom < window.innerHeight * 0.5) continue;
            if (!bestRect || rect.bottom > bestRect.bottom) { bestEl = nodes[i]; bestRect = rect; }
          }
          if (!bestEl) return null;
          // Walk up a few levels from the input and keep the lowest box that is still
          // roughly the composer's width: that is the white card the input sits in.
          var box = bestRect;
          var node = bestEl.parentElement;
          var steps = 0;
          while (node && node !== document.body && node !== document.documentElement && steps < 6) {
            var outer = node.getBoundingClientRect();
            steps += 1;
            if (outer.width > window.innerWidth * 0.92) break;
            if (outer.width < window.innerWidth * 0.45) break;
            if (outer.bottom > box.bottom) box = outer;
            node = node.parentElement;
          }
          return box;
        }

        function sync() {
          var box = composerRect();
          var root = document.documentElement;
          if (!root || !root.style) return;
          if (!box) {
            root.style.removeProperty('--dsr-anchor-x');
            root.style.removeProperty('--dsr-anchor-bottom');
            return;
          }
          root.style.setProperty('--dsr-anchor-x', (box.left + box.width / 2).toFixed(1) + 'px');
          root.style.setProperty('--dsr-anchor-bottom', Math.max(96, window.innerHeight - box.top + 18).toFixed(1) + 'px');
        }

        sync();
        var frame = window.requestAnimationFrame(sync);
        window.addEventListener('resize', sync);
        var observer = null;
        if (typeof ResizeObserver === 'function') {
          observer = new ResizeObserver(sync);
          observer.observe(document.body);
          if (el.parentElement) observer.observe(el.parentElement);
        }
        return function () {
          window.cancelAnimationFrame(frame);
          window.removeEventListener('resize', sync);
          if (observer) observer.disconnect();
        };
      }, []);

      return h('button', {
        type: 'button',
        className: 'dsr-pill',
        ref: anchorRef,
        'data-tone': toneOf(st),
        'data-open': st.panelOpen ? 'true' : 'false',
        title: t('settings'),
        'aria-label': fmt(t('pillAria'), { state: text }),
        onClick: togglePanel,
      },
        h(Ring, { progress: pillProgress(st), tone: toneOf(st) }),
        h('span', { className: 'dsr-pill-text' }, text)
      );
    }

    function RemindCard(props) {
      var st = props.st;
      var t = props.t;
      return h('section', {
        className: 'dsr-card',
        role: 'dialog',
        'aria-labelledby': 'dsr-remind-title',
      },
        h('div', { className: 'dsr-card-head' },
          h('span', { className: 'dsr-badge', 'data-tone': 'warn' }, h(Icon, { name: 'walk' })),
          h('div', { className: 'dsr-head-text' },
            h('h2', { className: 'dsr-title', id: 'dsr-remind-title' }, t('remindTitle')),
            h('p', { className: 'dsr-body' }, fmt(t('remindBody'), { minutes: st.sitMinutes }))
          )
        ),
        h('div', { className: 'dsr-actions' },
          h('button', { type: 'button', className: 'dsr-btn dsr-btn-primary', onClick: startBreak },
            fmt(t('remindGo'), { minutes: st.breakMinutes })),
          h('button', { type: 'button', className: 'dsr-btn dsr-btn-soft', onClick: snooze },
            fmt(t('remindSnooze'), { minutes: SNOOZE_MINUTES })),
          h('button', { type: 'button', className: 'dsr-btn dsr-btn-ghost', onClick: pauseHour }, t('remindPause')),
          h('button', {
            type: 'button', className: 'dsr-icon-btn dsr-settings-btn',
            title: t('settings'), 'aria-label': t('settings'), onClick: togglePanel,
          }, h(Icon, { name: 'sliders' }))
        )
      );
    }

    function BreakCard(props) {
      var st = props.st;
      var t = props.t;
      var total = st.breakMinutes * 60;
      var progress = total > 0 ? Math.max(0, Math.min(1, st.breakLeft / total)) : 0;
      return h('section', {
        className: 'dsr-card',
        role: 'dialog',
        'aria-labelledby': 'dsr-break-title',
      },
        h('div', { className: 'dsr-card-head' },
          h('span', { className: 'dsr-badge', 'data-tone': 'ok' }, h(Icon, { name: 'stretch' })),
          h('div', { className: 'dsr-head-text' },
            h('h2', { className: 'dsr-title', id: 'dsr-break-title' }, t('breakTitle')),
            h('p', { className: 'dsr-body' }, t('breakBody'))
          )
        ),
        h('div', {
          className: 'dsr-count',
          role: 'timer',
          'aria-label': fmt(t('breakAria'), { time: clock(st.breakLeft) }),
        }, clock(st.breakLeft)),
        h('div', { className: 'dsr-progress' },
          h('div', { className: 'dsr-progress-fill', style: { width: (progress * 100).toFixed(1) + '%' } })
        ),
        h('div', { className: 'dsr-actions' },
          h('button', { type: 'button', className: 'dsr-btn dsr-btn-soft', onClick: endBreak }, t('breakEnd'))
        )
      );
    }

    function Chip(props) {
      return h('button', {
        type: 'button',
        className: 'dsr-chip',
        'data-on': props.on ? 'true' : 'false',
        onClick: props.onClick,
      }, props.label);
    }

    function SettingsCard(props) {
      var st = props.st;
      var t = props.t;
      var paused = st.pausedUntil > 0;
      return h('section', {
        className: 'dsr-card',
        role: 'dialog',
        'aria-labelledby': 'dsr-settings-title',
      },
        h('div', { className: 'dsr-card-head' },
          h('span', { className: 'dsr-badge', 'data-tone': 'brand' }, h(Icon, { name: 'seat' })),
          h('div', { className: 'dsr-head-text' },
            h('h2', { className: 'dsr-title', id: 'dsr-settings-title' }, t('settingsTitle'))
          ),
          h('button', {
            type: 'button', className: 'dsr-icon-btn',
            title: t('close'), 'aria-label': t('close'),
            onClick: function () { set({ panelOpen: false }); },
          }, h(Icon, { name: 'close' }))
        ),
        h('div', { className: 'dsr-setting-row' },
          h('span', { className: 'dsr-setting-label' }, t('enableLabel')),
          h('button', {
            type: 'button', className: 'dsr-switch', role: 'switch',
            'aria-checked': st.enabled ? 'true' : 'false',
            'aria-label': t('enableLabel'),
            'data-on': st.enabled ? 'true' : 'false',
            onClick: toggleEnabled,
          }, h('span', { className: 'dsr-switch-knob' }))
        ),
        st.enabled ? h('div', { className: 'dsr-field' },
          h('div', { className: 'dsr-field-label' }, t('intervalLabel')),
          h('div', { className: 'dsr-chips' },
            SIT_OPTIONS.map(function (n) {
              return h(Chip, {
                key: 'sit-' + n,
                on: st.sitMinutes === n,
                label: fmt(t('minutes'), { n: n }),
                onClick: function () { setSitMinutes(n); },
              });
            })
          )
        ) : null,
        st.enabled ? h('div', { className: 'dsr-field' },
          h('div', { className: 'dsr-field-label' }, t('breakLabel')),
          h('div', { className: 'dsr-chips' },
            BREAK_OPTIONS.map(function (n) {
              return h(Chip, {
                key: 'break-' + n,
                on: st.breakMinutes === n,
                label: fmt(t('minutes'), { n: n }),
                onClick: function () { setBreakMinutes(n); },
              });
            })
          )
        ) : null,
        h('p', { className: 'dsr-hint' }, st.enabled ? t('hint') : t('offHint')),
        h('div', { className: 'dsr-footer' },
          st.enabled ? h('button', { type: 'button', className: 'dsr-btn dsr-btn-primary', onClick: startBreak }, t('nowBreak')) : null,
          st.enabled ? h('button', { type: 'button', className: 'dsr-btn dsr-btn-ghost', onClick: resetTimer }, t('resetTimer')) : null,
          paused
            ? h('button', { type: 'button', className: 'dsr-btn dsr-btn-ghost', onClick: resumeReminders }, t('resume'))
            : (st.enabled ? h('button', {
              type: 'button', className: 'dsr-btn dsr-btn-ghost dsr-footer-end', onClick: pauseHour,
            }, t('pauseAgain')) : null)
        )
      );
    }

    function Overlay() {
      useLocaleRevision();
      useTicker();
      var st = useStore();
      var t = translate;
      useEscape();

      var showSettings = st.panelOpen;
      var showBreak = !showSettings && st.phase === 'break';
      var showRemind = !showSettings && st.phase === 'remind';
      var showToast = !showSettings && !!st.toastKey && Date.now() < st.toastUntil;

      var stack = [];
      if (showSettings) stack.push(h(SettingsCard, { key: 'settings', st: st, t: t }));
      if (showBreak) stack.push(h(BreakCard, { key: 'break', st: st, t: t }));
      if (showRemind) stack.push(h(RemindCard, { key: 'remind', st: st, t: t }));
      if (showToast) stack.push(h('div', { key: 'toast', className: 'dsr-toast', role: 'status' }, t(st.toastKey)));

      return h('div', { className: 'dsr-root' },
        h('style', null, CSS),
        stack.length ? h('div', { className: 'dsr-stack' }, stack) : null
      );
    }

    // ── styles ───────────────────────────────────────────────────────────
    var CSS = [
      '.dsr-root{position:fixed;inset:0;pointer-events:none;z-index:45}',
      '.dsr-stack{position:fixed;left:var(--dsr-anchor-x,50%);bottom:var(--dsr-anchor-bottom,160px);transform:translateX(-50%);width:min(420px,calc(100vw - 24px));display:flex;flex-direction:column;gap:10px;align-items:stretch}',
      '.dsr-card{pointer-events:auto;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.14),0 2px 8px rgba(0,0,0,.06);padding:14px 16px 15px;color:var(--dsw-alias-label-primary);animation:dsr-rise .22s cubic-bezier(.2,.8,.3,1)}',
      '@keyframes dsr-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
      '.dsr-pill{pointer-events:auto;display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:1;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,color .15s}',
      '.dsr-pill:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}',
      '.dsr-pill:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.dsr-pill[data-open="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}',
      '.dsr-pill-text{font-variant-numeric:tabular-nums;letter-spacing:.01em}',
      '.dsr-ring{flex:none;overflow:visible}',
      '.dsr-ring-track{fill:none;stroke:var(--dsw-alias-border-l2);stroke-width:2}',
      '.dsr-ring-fill{fill:none;stroke:var(--dsw-alias-brand-primary);stroke-width:2;stroke-linecap:butt;transition:stroke-dashoffset .4s linear,stroke .2s}',
      '.dsr-ring[data-tone="muted"] .dsr-ring-fill{stroke:var(--dsw-alias-state-idle-primary);opacity:.5}',
      '.dsr-ring[data-tone="ok"] .dsr-ring-fill{stroke:var(--dsw-alias-state-success-primary)}',
      '.dsr-ring[data-tone="warn"] .dsr-ring-fill{stroke:var(--dsw-alias-state-warn-primary);animation:dsr-pulse 1.8s ease-in-out infinite}',
      '@keyframes dsr-pulse{0%,100%{opacity:1}50%{opacity:.4}}',
      '.dsr-card-head{display:flex;align-items:flex-start;gap:10px}',
      '.dsr-badge{flex:none;width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}',
      '.dsr-badge[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary)}',
      '.dsr-badge[data-tone="ok"]{color:var(--dsw-alias-state-success-primary)}',
      '.dsr-badge[data-tone="brand"]{color:var(--dsw-alias-brand-primary)}',
      '.dsr-head-text{min-width:0;flex:1}',
      '.dsr-title{margin:0;font-size:14px;font-weight:650;line-height:20px;letter-spacing:.01em}',
      '.dsr-body{margin:3px 0 0;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-secondary)}',
      '.dsr-icon-btn{flex:none;width:24px;height:24px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;justify-content:center;cursor:pointer}',
      '.dsr-icon-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.dsr-actions{display:flex;align-items:center;gap:8px;margin-top:12px;flex-wrap:wrap}',
      '.dsr-btn{height:32px;padding:0 12px;border-radius:9px;font:inherit;font-size:12.5px;font-weight:550;line-height:1;cursor:pointer;border:1px solid transparent;white-space:nowrap;transition:background .15s,filter .15s}',
      '.dsr-btn-primary{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}',
      '.dsr-btn-primary:hover{filter:brightness(1.07)}',
      '.dsr-btn-soft{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}',
      '.dsr-btn-soft:hover{filter:brightness(.98)}',
      '.dsr-btn-ghost{background:transparent;color:var(--dsw-alias-label-secondary)}',
      '.dsr-btn-ghost:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.dsr-card button:focus-visible,.dsr-card [role="switch"]:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.dsr-settings-btn{margin-left:auto}',
      '.dsr-count{font-size:30px;font-weight:650;letter-spacing:.02em;font-variant-numeric:tabular-nums;line-height:1;margin:14px 0 10px;color:var(--dsw-alias-label-primary)}',
      '.dsr-progress{height:4px;border-radius:99px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}',
      '.dsr-progress-fill{height:100%;border-radius:99px;background:var(--dsw-alias-state-success-primary);transition:width .5s linear}',
      '.dsr-setting-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}',
      '.dsr-setting-label{font-size:12.5px;font-weight:550;color:var(--dsw-alias-label-primary)}',
      '.dsr-switch{position:relative;width:36px;height:21px;border-radius:99px;border:0;background:var(--dsw-alias-bg-layer-2);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1);cursor:pointer;transition:background .18s;padding:0}',
      '.dsr-switch[data-on="true"]{background:var(--dsw-alias-brand-primary);box-shadow:none}',
      '.dsr-switch-knob{position:absolute;top:3px;left:3px;width:15px;height:15px;border-radius:50%;background:var(--dsw-alias-bg-base);transition:transform .18s;box-shadow:0 1px 2px rgba(0,0,0,.2)}',
      '.dsr-switch[data-on="true"] .dsr-switch-knob{transform:translateX(15px)}',
      '.dsr-field{margin-top:12px}',
      '.dsr-field-label{font-size:12px;font-weight:550;letter-spacing:0;color:var(--dsw-alias-label-secondary)}',
      '.dsr-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}',
      '.dsr-chip{height:28px;padding:0 11px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;transition:border-color .15s,color .15s,background .15s}',
      '.dsr-chip:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.dsr-chip[data-on="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);font-weight:650;background:var(--dsw-alias-bg-layer-2)}',
      '.dsr-hint{margin:13px 0 0;font-size:11.5px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dsr-footer{display:flex;align-items:center;gap:8px;margin-top:13px;flex-wrap:wrap}',
      '.dsr-footer-end{margin-left:auto}',
      '.dsr-toast{pointer-events:none;align-self:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:7px 14px;font-size:12px;color:var(--dsw-alias-label-secondary);box-shadow:0 8px 24px rgba(0,0,0,.14);animation:dsr-rise .2s ease-out}',
      '@media (prefers-reduced-motion:reduce){.dsr-card,.dsr-toast{animation:none}.dsr-ring[data-tone="warn"] .dsr-ring-fill{animation:none}}',
    ].join('\n');

    // ── plugin entry ─────────────────────────────────────────────────────
    return {
      inject: ['slots', 'locale'],
      apply: function (ctx) {
        localeSvc = ctx.locale;
        translate = ctx.locale.bind(NS);

        ctx.effect(function () {
          return ctx.locale.register(NS, { zh: DICT.zh, en: DICT.en });
        }, 'sedentary-reminder: dictionaries');

        ctx.effect(function () {
          return function () { persistNow(); };
        }, 'sedentary-reminder: flush on dispose');



        ctx.slots.inject('shell.overlay', function () {
          return ctx.slots.register({
            name: 'shell.overlay',
            id: 'sedentary-reminder',
            order: 60,
            label: function () { return translate('name'); },
          }, Overlay);
        });

        ctx.slots.inject('conversation.composer.dock', function () {
          return ctx.slots.register({
            name: 'conversation.composer.dock',
            id: 'sedentary-reminder-pill',
            order: 3,
            label: function () { return translate('name'); },
          }, StatusPill);
        });
      },
    };
  },
});
