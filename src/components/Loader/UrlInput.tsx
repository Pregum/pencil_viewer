import { useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n/I18nContext';

export function UrlInput({ onSubmit }: { onSubmit: (url: string) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <form className="url-form" onSubmit={handleSubmit}>
      <input
        type="url"
        className="url-form__input"
        placeholder={t('url.placeholder')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="url-form__submit" disabled={!value.trim()}>
        {t('url.submit')}
      </button>
    </form>
  );
}
