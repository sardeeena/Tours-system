import React from 'react';

interface BlogContentProps {
  content: string;
  className?: string;
}

function safeHref(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'mailto:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function renderInline(source: string, keyPrefix: string): React.ReactNode[] {
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((?:https:\/\/|mailto:)[^)]+\))/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = tokenPattern.exec(source)) !== null) {
    if (match.index > lastIndex) nodes.push(source.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('**')) nodes.push(<strong key={keyPrefix + index}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('*')) nodes.push(<em key={keyPrefix + index}>{token.slice(1, -1)}</em>);
    else if (token.startsWith('`')) nodes.push(<code key={keyPrefix + index} className="rounded bg-stone-100 dark:bg-slate-800 px-1.5 py-0.5 text-[0.9em]">{token.slice(1, -1)}</code>);
    else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = link ? safeHref(link[2]) : null;
      nodes.push(href && link
        ? <a key={keyPrefix + index} href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0A6C74] underline underline-offset-2 dark:text-teal-300">{link[1]}</a>
        : token);
    }
    lastIndex = match.index + token.length;
    index += 1;
  }
  if (lastIndex < source.length) nodes.push(source.slice(lastIndex));
  return nodes;
}

export const BlogContent: React.FC<BlogContentProps> = ({ content, className = '' }) => {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let ordered = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(' ').trim();
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(text, `p-${blocks.length}-`)}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    const items = list.map((item, index) => <li key={index}>{renderInline(item, `l-${blocks.length}-${index}-`)}</li>);
    blocks.push(ordered
      ? <ol key={`ol-${blocks.length}`} className="list-decimal pl-6 space-y-2">{items}</ol>
      : <ul key={`ul-${blocks.length}`} className="list-disc pl-6 space-y-2">{items}</ul>);
    list = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); flushList(); return; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const number = line.match(/^\d+[.)]\s+(.+)$/);
    const quote = line.match(/^>\s?(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const Tag = heading[1].length === 1 ? 'h2' : 'h3';
      blocks.push(<Tag key={`h-${blocks.length}`} className="font-display font-bold text-[#102B35] dark:text-white mt-8 mb-3">{renderInline(heading[2], `h-${blocks.length}-`)}</Tag>);
    } else if (bullet || number) {
      flushParagraph();
      const isOrdered = Boolean(number);
      if (list.length && ordered !== isOrdered) flushList();
      ordered = isOrdered;
      list.push((bullet || number)![1]);
    } else if (quote) {
      flushParagraph(); flushList();
      blocks.push(<blockquote key={`q-${blocks.length}`} className="border-l-4 border-[#C28D32] pl-5 italic text-stone-600 dark:text-slate-300">{renderInline(quote[1], `q-${blocks.length}-`)}</blockquote>);
    } else if (/^---+$/.test(line)) {
      flushParagraph(); flushList();
      blocks.push(<hr key={`hr-${blocks.length}`} className="border-[#E8E3DA] dark:border-[#243447] my-8"/>);
    } else {
      flushList();
      paragraph.push(line);
    }
  });
  flushParagraph();
  flushList();

  return <div className={`space-y-5 leading-8 text-stone-700 dark:text-slate-200 ${className}`}>{blocks}</div>;
};
