import type { ParentComponent } from 'solid-js';

const PrefetchLink: ParentComponent<{ href: string }> = (prop) => {
  let content: string;
  const loadPage = async () => {
    if (content) return;
    const href = prop.href;
    content = await (await fetch(href)).text();
    // document.querySelector('html')!.outerHTML = content;
  };
  const handleClick = async (e: MouseEvent) => {
    e.preventDefault();
    if (!content) await loadPage();
    const newDom = new DOMParser().parseFromString(content, 'text/html');
    document.head.innerHTML = newDom.head.innerHTML;
    document.body.innerHTML = newDom.body.innerHTML;
    window.history.pushState({}, '', prop.href);
  };
  return (
    <a href={prop.href} onClick={handleClick} onMouseOver={loadPage}>
      {prop.children}
    </a>
  );
};

export default PrefetchLink;
