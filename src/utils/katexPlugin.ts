import type { HastNode, HastPluginDefinition } from 'satteri'
import katex from 'katex'

const whitespaceRegex = /\s+/

function renderMath(value: string, displayMode: boolean) {
  return katex.renderToString(value, {
    displayMode,
    throwOnError: false,
  })
}

function getClassNames(node: HastNode) {
  if (node.type !== 'element') {
    return []
  }

  const className = node.properties.className
  if (Array.isArray(className)) {
    return className
  }

  if (typeof className === 'string') {
    return className.split(whitespaceRegex)
  }

  return []
}

const katexPlugin: HastPluginDefinition = {
  name: 'katex',
  element: {
    filter: ['code'],
    visit(node, ctx) {
      const classNames = getClassNames(node)
      if (!classNames.includes('language-math')) {
        return
      }

      const value = ctx.textContent(node)
      if (classNames.includes('math-display')) {
        const parent = ctx.parent(node)
        if (parent?.type === 'element' && parent.tagName === 'pre') {
          ctx.replaceNode(parent, { type: 'raw', value: renderMath(value, true) })
        }
        return
      }

      if (classNames.includes('math-inline')) {
        return { type: 'raw', value: renderMath(value, false) }
      }
    },
  },
}

export default katexPlugin
