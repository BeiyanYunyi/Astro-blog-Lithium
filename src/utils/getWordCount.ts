import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(duration);
dayjs.extend(relativeTime);
/** Modified from [hexo-theme-icarus](https://github.com/ppoffice/hexo-theme-icarus/blob/master/layout/common/article.jsx)
 *
 * - Change moment.js to dayjs
 * - Pure Function
 */
const getWordCount = (content: string) => {
  let replacedContent = content.replace(/<\/?[a-z][^>]*>/gi, '');
  replacedContent = replacedContent.trim();
  const words = replacedContent
    ? (replacedContent.match(/[\u00ff-\uffff]|[a-zA-Z]+/g) || []).length
    : 0;
  const time = dayjs
    .duration((words / 150.0) * 60, 'seconds')
    .locale('zh-cn')
    .humanize();
  return { words, time };
};

export default getWordCount;
