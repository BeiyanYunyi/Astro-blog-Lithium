const getText = (node: any) => {
  if (node.type === 'text' || node.type === 'inlineCode') {
    return node.value;
  }
  if (node.children) {
    return node.children.map(getText).join('');
  }
  return '';
};

const injectDefaultLayout = () => (tree: any, file: any) => {
  const moreLabel = tree.children.findIndex(
    (elem: any) => elem.type === 'html' && elem.value === '<!--more-->',
  );
  let val;
  if (moreLabel !== -1) {
    const targetNodes = tree.children.slice(0, moreLabel);
    val = targetNodes.map((node: any) => getText(node)).join('');
  } else {
    val = tree.children
      .slice(0, 1)
      .map((node: any) => getText(node))
      .join('');
  }
  file.data.astro.frontmatter.description = file.data.astro.frontmatter.description || val;
  file.data.astro.frontmatter.layout = '../../layouts/BlogPost.astro';
};

export default injectDefaultLayout;
