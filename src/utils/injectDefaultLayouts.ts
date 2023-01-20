import type MDInstance from '@app-types/MDInstance';
import type { Content, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { toc } from 'mdast-util-toc';
import { toHast } from 'mdast-util-to-hast';
import { toHtml } from 'hast-util-to-html';

const getText: (node: Content) => string = (node) => {
  let value = '';
  visit(node, (node1) => {
    if (node1.type === 'text' || node1.type === 'inlineCode') {
      value += node1.value;
    }
  });
  return value;
};

const getToc = (tree: Root) => {
  // const astro = file.data.astro as MDInstance;
  const result = toc(tree);
  if (!result.map) {
    return undefined;
  }
  const hast = toHast(result.map);
  const html = toHtml(hast!);
  return html;
};

const injectDefaultLayout: Plugin<[], Root> = () => (tree, file) => {
  const astro = file.data.astro as MDInstance;
  const fileToc = getToc(tree);
  if (!astro.frontmatter.toc && fileToc) {
    astro.frontmatter.toc = fileToc;
  }
  if (file.extname === '.mdx' && !astro.frontmatter.rawContent) {
    let rawContent = '';
    visit(tree, (node) => {
      if ((node.type as 'mdxjsEsm' | string) !== 'mdxjsEsm' && 'value' in node) {
        rawContent += (node as { value: string }).value;
      }
    });
    astro.frontmatter.rawContent = rawContent;
    astro.frontmatter.isMdx = true;
  } else {
    astro.frontmatter.isMdx = false;
  }
  const moreLabel = tree.children.findIndex(
    (elem) => elem.type === 'html' && elem.value === '<!--more-->',
  );
  let val = '';
  if (!astro.frontmatter.description) {
    if (moreLabel !== -1) {
      const targetNodes = tree.children.slice(0, moreLabel);
      val = targetNodes.map((node) => getText(node)).join('');
    } else {
      val = tree.children
        .slice(0, 1)
        .map((node) => getText(node))
        .join('');
    }
  }
  astro.frontmatter.description = astro.frontmatter.description || val;
  astro.frontmatter.layout = '@layouts/BlogPost.astro';
};

export default injectDefaultLayout;
