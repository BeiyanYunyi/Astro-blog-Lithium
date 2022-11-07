import type { MarkdownInstance, MDXInstance } from 'astro';
import type IFrontmatter from './IFrontmatter';

type MDInstance =
  | MarkdownInstance<Record<string, any> & IFrontmatter>
  | MDXInstance<Record<string, any> & IFrontmatter>;

export default MDInstance;
