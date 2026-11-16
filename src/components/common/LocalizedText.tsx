import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export interface LocalizedTextProps {
  messageKey: string;
  fallback: string;
}

/**
 * Translates a static customer-facing JSX text node through the same
 * reviewed, checksum-protected UI catalogue used by locale activation.
 */
export const LocalizedText: React.FC<LocalizedTextProps> = ({ messageKey, fallback }) => {
  const { t } = useLanguage();
  return <>{t(messageKey, fallback)}</>;
};
