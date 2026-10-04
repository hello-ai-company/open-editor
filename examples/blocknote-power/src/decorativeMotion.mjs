/**
 * Decorative one-shot, deliberately independent from application/job state.
 * Usage: installDecorativeMotion(mediaWell, {assetBase: '/motion/idea-unfold'}).
 * The well must contain <img src=".../reduced-motion.webp" alt="" width="640" height="480">.
 * Call dispose() when the app view is removed. Nothing is sent to a server.
 */
const consumed = new WeakSet();

export function installDecorativeMotion(well, { assetBase, playOnEnter = true, once = {current: false} } = {}) {
  if (!well || !assetBase) throw new TypeError('A media well and assetBase are required');
  const still = well.querySelector('img');
  if (!still) throw new TypeError('Supply a static fallback image first');
  well.classList.add('decorative-motion');
  well.setAttribute('aria-hidden', 'true');
  still.alt = '';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let video = null, observer = null, disposed = false, state = 'idle';
  const allowed = () => !reduced.matches && !connection?.saveData &&
    !(typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4);

  function finish() {
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      video = null;
    }
    still.hidden = false;
    if (state !== 'idle') state = 'settled';
  }

  function stop() {
    if (state !== 'idle') consumed.add(well);
    finish();
  }

  async function start() {
    if (disposed || state !== 'idle' || consumed.has(well) ||
        !playOnEnter || once.current || !allowed() || document.hidden) return;
    consumed.add(well);
    once.current = true;
    state = 'starting';
    video = document.createElement('video');
    const current = video;
    current.muted = true;
    current.playsInline = true;
    current.preload = 'none';
    current.loop = false;
    current.controls = false;
    current.width = 640;
    current.height = 480;
    current.setAttribute('aria-hidden', 'true');
    current.setAttribute('tabindex', '-1');
    current.poster = `${assetBase}/poster.webp`;
    current.addEventListener('ended', stop, {once: true});
    current.addEventListener('error', stop, {once: true});
    // One selected source only. No preload of a hidden alternative codec.
    const mobile = window.matchMedia('(max-width: 600px)').matches;
    current.src = `${assetBase}/${mobile ? 'motion-mobile.mp4' : 'motion.mp4'}`;
    well.append(current);
    try {
      await current.play();
      if (disposed || video !== current || !allowed() || document.hidden) { stop(); return; }
      still.hidden = true;
      state = 'playing';
    } catch { stop(); }
  }

  function onInteraction() { once.current = true; stop(); }
  function onVisibility() { if (document.hidden) stop(); }
  function onPreference() { if (!allowed()) stop(); }
  reduced.addEventListener?.('change', onPreference);
  connection?.addEventListener?.('change', onPreference);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('pointerdown', onInteraction);
  document.addEventListener('keydown', onInteraction);
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      if (disposed) return;
      for (const entry of entries) {
        if (entry.target !== well) continue;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) void start();
        else stop();
      }
    }, {threshold: [0, 0.5]});
    observer.observe(well);
  }
  // Without IntersectionObserver retain the still; do not guess visibility.
  return {
    stop,
    get state() { return state; },
    dispose() {
      disposed = true;
      observer?.disconnect();
      reduced.removeEventListener?.('change', onPreference);
      connection?.removeEventListener?.('change', onPreference);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerdown', onInteraction);
      document.removeEventListener('keydown', onInteraction);
      stop();
    }
  };
}
