import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { privateUiMessageKey } from '../../i18n/privateUiCatalog';

export interface LocalizedValueProps {
  value: React.ReactNode;
}

/** Translate dynamic string values only when an exact reviewed catalogue entry exists. */
export const LocalizedValue: React.FC<LocalizedValueProps> = ({ value }) => {
  const { t } = useLanguage();
  const render = (item: React.ReactNode): React.ReactNode => {
    if (typeof item === 'string') return t(privateUiMessageKey(item), item);
    if (Array.isArray(item)) return item.map(render);
    return item;
  };
  return <>{render(value)}</>;
};
