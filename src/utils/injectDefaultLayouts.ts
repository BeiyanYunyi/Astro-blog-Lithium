import type MDInstance from '@app-types/MDInstance';
import type { Root, Content } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

const getText: (node: Content) => string = (node) => {
  if (node.type === 'text' || node.type === 'inlineCode') {
    return node.value;
  }
  if ('children' in node) {
    return node.children.map(getText).join('');
  }
  return '';
};

const injectDefaultLayout: Plugin<[], Root> = () => (tree, file) => {
  const astro = file.data.astro as MDInstance;
  if (file.history[0]?.endsWith('.mdx') && !astro.frontmatter.rawContent) {
    let rawContent = '';
    visit(tree, (node) => {
      if ((node.type as 'mdxjsEsm' | string) !== 'mdxjsEsm' && 'value' in node) {
        rawContent += (node as { value: string }).value;
      }
    });
    astro.frontmatter.rawContent = rawContent;
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
