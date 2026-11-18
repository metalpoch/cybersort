(() => {
  const main = document.querySelector('#main-content');
  if (!main || !('fetch' in window) || !('pushState' in history)) return;

  let activeRequest = null;
  const revealInView = (root) => {
    const cards = root.querySelectorAll('.reveal');
    cards.forEach((card, index) => {
      card.style.setProperty('--reveal-delay', `${Math.min(index, 8) * 65}ms`);
      card.getBoundingClientRect();
      requestAnimationFrame(() => card.classList.add('is-visible'));
    });
  };

  function updateNavigation(pathname) {
    document.querySelectorAll('.main-nav a').forEach((link) => {
      const linkPath = new URL(link.href, location.href).pathname;
      const isHome = linkPath === '/' && pathname === '/';
      const isResults = linkPath === '/results' && pathname.startsWith('/results');
      const isAdmin = linkPath === '/admin' && pathname.startsWith('/admin');
      if (isHome || isResults || isAdmin) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  async function fetchPage(url, options = {}) {
    activeRequest?.abort();
    const controller = new AbortController();
    activeRequest = controller;
    main.setAttribute('aria-busy', 'true');

    try {
      const { historyMode, ...requestOptions } = options;
      const response = await fetch(url, {
        ...requestOptions,
        credentials: 'same-origin',
        redirect: 'follow',
        headers: { Accept: 'text/html', 'X-Requested-With': 'CyberSort-Navigation', ...(requestOptions.headers || {}) },
        signal: controller.signal,
      });
      const contentType = response.headers.get('content-type') || '';
      const finalUrl = new URL(response.url);
      if (response.status === 401) {
        location.assign(options.method === 'POST' ? '/admin' : finalUrl.href);
        return;
      }
      if (!response.ok || !contentType.includes('text/html') || finalUrl.origin !== location.origin) {
        throw new Error(`Navigation returned ${response.status}`);
      }

      const documentText = await response.text();
      const nextDocument = new DOMParser().parseFromString(documentText, 'text/html');
      const nextMain = nextDocument.querySelector('#main-content');
      if (!nextMain) throw new Error('The response did not contain the app content.');

      main.replaceChildren(...Array.from(nextMain.childNodes, (node) => document.importNode(node, true)));
      document.title = nextDocument.title;
      updateNavigation(finalUrl.pathname);
      revealInView(main);

      if (historyMode === 'push') {
        history.replaceState({ ...(history.state || {}), scrollY: window.scrollY }, '', location.href);
        history.pushState({ scrollY: 0 }, '', `${finalUrl.pathname}${finalUrl.search}${finalUrl.hash}`);
        window.scrollTo({ top: 0, behavior: 'auto' });
      } else if (historyMode === 'pop') {
        window.scrollTo({ top: history.state?.scrollY || 0, behavior: 'auto' });
      }

      main.setAttribute('aria-busy', 'false');
      main.focus({ preventScroll: true });
    } catch (error) {
      if (error.name !== 'AbortError') {
        if (options.method === 'POST') location.reload();
        else location.assign(url.href);
      }
    } finally {
      if (activeRequest === controller) {
        activeRequest = null;
        main.setAttribute('aria-busy', 'false');
      }
    }
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.target || link.hasAttribute('download') || link.dataset.noSpa !== undefined) return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || (url.hash && url.pathname === location.pathname && url.search === location.search)) return;
    if (url.href === location.href) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    event.preventDefault();
    fetchPage(url.href, { historyMode: 'push' });
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.method.toUpperCase() !== 'POST') return;

    const url = new URL(form.action, location.href);
    if (url.origin !== location.origin || form.enctype === 'multipart/form-data') return;

    const fields = new FormData(form);
    const body = new URLSearchParams();
    for (const [key, value] of fields.entries()) {
      if (typeof value !== 'string') return;
      body.append(key, value);
    }

    event.preventDefault();
    fetchPage(url.href, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      historyMode: 'push',
    });
  });

  window.addEventListener('popstate', () => {
    fetchPage(location.href, { historyMode: 'pop' });
  });
})();
