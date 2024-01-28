(() => {
  const toc = document.querySelector('aside#toc');
  if (!toc) return;
  const highlighted = new Set<Element>();
  let preserved: Element | undefined;
  const targets = document.querySelector('article')?.querySelectorAll('h2, h3, h4, h5, h6');
  const clearPreserved = () => {
    if (!preserved) return;
    preserved.classList.toggle('active', false);
    highlighted.delete(preserved);
    preserved = undefined;
  };
  const handleObserve: IntersectionObserverCallback = (e) => {
    e.forEach((en) => {
      const target = toc.querySelector(`a[href="#${encodeURIComponent(en.target.id)}"]`)
        ?.parentElement as HTMLLIElement;
      if (!target) return;
      if (en.isIntersecting) {
        target.classList.toggle('active', true);
        highlighted.add(target);
        clearPreserved();
      } else if (highlighted.size > 1) {
        target.classList.toggle('active', false);
        highlighted.delete(target);
      } else {
        preserved = target;
      }
    });
  };
  const observer = new IntersectionObserver(handleObserve, {
    rootMargin: '92px 0px 0px 0px',
    threshold: [0, 1],
  });
  targets?.forEach((target) => {
    observer.observe(target);
  });
})();

export default {};
