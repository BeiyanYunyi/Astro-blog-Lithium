import type IFrontmatter from '@app-types/IFrontmatter';
import type MDInstance from '@app-types/MDInstance';
import { toHtml } from 'hast-util-to-html';
import type { RootContent, Root } from 'mdast';
import { toHast } from 'mdast-util-to-hast';
import { toc } from 'mdast-util-toc';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

const getText: (node: RootContent) => string = (node) => {
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

const frontmatterCache: Map<string, Partial<IFrontmatter>> = new Map();

const injectDefaultLayout: Plugin<[], Root> = () => (tree, file) => {
  const astro = file.data.astro as MDInstance;
  const getFrontmatterToSet = () => {
    const frontmatterToSet: Partial<IFrontmatter> = {};
    const fileToc = getToc(tree);
    if (!astro.frontmatter.toc && fileToc) {
      frontmatterToSet.toc = fileToc;
    }
    if (!file.dirname?.includes('posts')) {
      frontmatterToSet.layout = '@layouts/BlogPost.astro';
    }
    frontmatterCache.set(file.basename!, frontmatterToSet);
    return frontmatterToSet;
  };
  const frontmatterToSet = frontmatterCache.get(file.basename!) || getFrontmatterToSet();
  astro.frontmatter = { ...astro.frontmatter, ...frontmatterToSet };
};

export default injectDefaultLayout;
