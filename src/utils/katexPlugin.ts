import { htmlToHast, type HastNode, type HastPluginDefinition } from 'satteri';
import katex from 'katex';

const whitespaceRegex = /\s+/;

function normalizeXmlnsProperty(node: HastNode) {
  if (
    node.type === 'element' &&
    typeof node.properties[':xmlns'] === 'string'
  ) {
    node.properties.xmlns = node.properties[':xmlns'];
    delete node.properties[':xmlns'];
  }

  if ('children' in node) {
    node.children.forEach(normalizeXmlnsProperty);
  }
}

function renderMath(value: string, displayMode: boolean) {
  const tree = htmlToHast(
    katex.renderToString(value, {
      displayMode,
      throwOnError: false,
    }),
    { fragment: true },
  );

  if (tree.type !== 'root' || tree.children[0]?.type !== 'element') {
    throw new Error('Expected KaTeX to render an HTML element');
  }

  normalizeXmlnsProperty(tree.children[0]);
  return tree.children[0];
}

function getClassNames(node: HastNode) {
  if (node.type !== 'element') {
    return [];
  }

  const className = node.properties.className;
  if (Array.isArray(className)) {
    return className;
  }

  if (typeof className === 'string') {
    return className.split(whitespaceRegex);
  }

  return [];
}

const katexPlugin: HastPluginDefinition = {
  name: 'katex',
  element: {
    filter: ['code'],
    visit(node, ctx) {
      const classNames = getClassNames(node);
      if (!classNames.includes('language-math')) {
        return;
      }

      const value = ctx.textContent(node);
      if (classNames.includes('math-display')) {
        const parent = ctx.parent(node);
        if (parent?.type === 'element' && parent.tagName === 'pre') {
          ctx.replaceNode(parent, renderMath(value, true));
        }
        return;
      }

      if (classNames.includes('math-inline')) {
        return renderMath(value, false);
      }
    },
  },
};

export default katexPlugin;
