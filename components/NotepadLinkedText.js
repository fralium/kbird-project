'use client';

import Link from 'next/link';
import { linkifyMentions } from '../utils/linkifyMentions';
import styles from '../styles/NotepadLinkedText.module.css';

export default function NotepadLinkedText({ text = '', terms = [], className = '' }) {
  const parts = linkifyMentions(text, terms);
  if (!parts.length) {
    return <div className={`${styles.root} ${className}`.trim()}>（空白）</div>;
  }

  return (
    <div className={`${styles.root} ${className}`.trim()}>
      {parts.map((part, index) => {
        if (part.href) {
          return (
            <Link
              key={`${part.href}-${index}`}
              href={part.href}
              className={
                part.kind === 'location' ? styles.linkLocation : styles.linkBird
              }
              title={part.kind === 'location' ? '地点词典' : '鸟类详情'}
              onClick={(e) => e.stopPropagation()}
            >
              {part.text}
            </Link>
          );
        }
        return <span key={`t-${index}`}>{part.text}</span>;
      })}
    </div>
  );
}
