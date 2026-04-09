import { useState, type FormEvent } from 'react';

export function UrlInput({ onSubmit }: { onSubmit: (url: string) => void }) {
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
        placeholder="https://example.com/design.pen"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="url-form__submit" disabled={!value.trim()}>
        開く
      </button>
    </form>
  );
}
