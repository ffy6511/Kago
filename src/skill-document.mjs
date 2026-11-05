import MarkdownIt from 'markdown-it';
import { yaml } from './skills.mjs';

// Skill files are untrusted content. Never execute HTML or load remote images.
const markdown = new MarkdownIt({ html: false, linkify: false }).disable('image');
// Local reference files are not HTTP routes. Keep their text instead of
// offering a link to a missing service URL; external documentation stays usable.
markdown.core.ruler.after('inline', 'document-links', (state) => {
  for (const block of state.tokens) {
    const localLinks = [];
    for (const token of block.children || []) {
      if (token.type === 'link_open') {
        const href = token.attrGet('href') || '';
        const local = !/^(https?:|mailto:)/i.test(href);
        localLinks.push(local);
        if (local) {
          token.tag = 'span';
          token.attrs = [['title', href]];
        } else {
          token.attrSet('target', '_blank');
          token.attrSet('rel', 'noopener noreferrer');
        }
      } else if (token.type === 'link_close' && localLinks.pop()) token.tag = 'span';
    }
  }
});

export function renderSkillDocument(text) {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  return {
    metadata: match ? yaml(match[1]) : {},
    html: markdown.render(match ? normalized.slice(match[0].length) : normalized),
  };
}
