import Link from 'next/link';
import styles from '@/styles/SimplePageHeader.module.css';

/**
 * 内页轻品牌页头（观察鸟种页验证后的标准）
 * 左侧湖色竖条 + 标题说明 + 右侧操作，替代满宽 PageIntro。
 */
export default function SimplePageHeader({
  eyebrow = '',
  title,
  description = '',
  descriptionVariant = 'lede',
  actions = null,
}) {
  const descriptionClass =
    descriptionVariant === 'caption' ? styles.pageCaption : styles.pageLede;

  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderAccent} aria-hidden="true" />
      <div className={styles.pageHeaderBody}>
        <div className={styles.pageHeaderTop}>
          <div>
            {eyebrow ? <p className={styles.pageEyebrow}>{eyebrow}</p> : null}
            <h1 className={styles.pageTitle}>{title}</h1>
            {description ? <p className={descriptionClass}>{description}</p> : null}
          </div>
          {actions ? <div className={styles.pageHeaderActions}>{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}

export function HeaderPrimaryLink({ href, children }) {
  return (
    <Link href={href} className="btn btn-primary">
      {children}
    </Link>
  );
}

export function HeaderSecondaryLink({ href, children }) {
  return (
    <Link href={href} className="btn btn-secondary">
      {children}
    </Link>
  );
}

export function HeaderTextLink({ href, children }) {
  return (
    <Link href={href} className={styles.headerTextLink}>
      {children}
    </Link>
  );
}

export function HeaderTextButton({ onClick, children, disabled = false, type = 'button' }) {
  return (
    <button type={type} className={styles.headerTextLink} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function HeaderPrimaryButton({ onClick, children, disabled = false, type = 'button' }) {
  return (
    <button type={type} className="btn btn-primary" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function HeaderSecondaryButton({
  onClick,
  children,
  disabled = false,
  type = 'button',
  ...rest
}) {
  return (
    <button type={type} className="btn btn-secondary" onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}

export function HeaderDangerButton({ onClick, children, disabled = false, type = 'button' }) {
  return (
    <button type={type} className="btn btn-danger" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
