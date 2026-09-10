import styles from './index.module.css';

export type PlaceholderKind = 'qc' | 'prod' | 'result' | 'mat' | '';
export type PlaceholderSize = 'sm' | 'md' | 'lg' | 'thumb' | 'fluid' | 'gallery';

interface ImagePlaceholderProps {
  label: string;
  kind?: PlaceholderKind;
  size?: PlaceholderSize;
  source?: string;
}

export function ImagePlaceholder({ label, kind = '', size = 'sm', source }: ImagePlaceholderProps) {
  const className = [styles.ph, kind ? styles[kind] : '', styles[size]].filter(Boolean).join(' ');
  return (
    <div className={className}>
      {label}
      {source ? <div className={styles.badge}>{source}</div> : null}
    </div>
  );
}
