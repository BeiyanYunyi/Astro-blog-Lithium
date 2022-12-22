export default interface IFrontmatter {
  title: string;
  date: string;
  description?: string;
  tag?: string[];
  rawContent?: string;
  isMdx: boolean;
}
