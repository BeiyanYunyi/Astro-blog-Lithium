import type { Element as WorkerElement } from '@cloudflare/workers-types';

const allowedTags = new Set(['p', 'span', 'br', 'a']);
// Drop foreign content and raw-text contexts rather than exposing their contents
// as HTML when the result is parsed again by a browser.
const droppedTags = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
  'noscript',
  'noembed',
  'noframes',
  'xmp',
  'plaintext',
  'textarea',
  'title',
]);
const semanticClass =
  /^(?:[hpue]-|dt-)|^(?:mention|hashtag|ellipsis|invisible)$/;

function safeHref(value: string) {
  // Require a literal scheme: relative URLs and entity-obfuscated schemes are
  // not accepted. URL parsing also rejects malformed absolute URLs.
  if (!/^(?:https?:\/\/|mailto:)/i.test(value)) return false;
  try {
    return ['https:', 'http:', 'mailto:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Sanitize remote comment HTML before either insertion or an edit. */
export async function sanitizeCommentContent(content: string): Promise<string> {
  return new HTMLRewriter()
    .on('*', {
      element(input) {
        // Astro's DOM types merge Element.attributes with NamedNodeMap.
        const element = input as unknown as WorkerElement;
        if (droppedTags.has(element.tagName)) {
          element.remove();
          return;
        }
        if (!allowedTags.has(element.tagName)) {
          element.removeAndKeepContent();
          return;
        }
        for (const [name, value] of Array.from(element.attributes)) {
          if (name === 'class') {
            const classes = value
              .split(/\s+/)
              .filter((value) => semanticClass.test(value));
            if (classes.length)
              element.setAttribute('class', classes.join(' '));
            else element.removeAttribute(name);
          } else if (
            !(element.tagName === 'a' && name === 'href' && safeHref(value))
          ) {
            element.removeAttribute(name);
          }
        }
        if (element.tagName === 'a' && element.hasAttribute('href')) {
          element.setAttribute('rel', 'nofollow noopener noreferrer');
        }
      },
    })
    .onDocument({
      comments(comment) {
        comment.remove();
      },
    })
    .transform(new Response(content))
    .text();
}
