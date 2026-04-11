import { useDropzone } from 'react-dropzone';
import { useI18n } from '../../i18n/I18nContext';

export function DropZone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    disabled,
    accept: {
      'application/json': ['.pen', '.json'],
      'text/plain': ['.pen'],
    },
    onDrop: (accepted) => {
      if (accepted.length > 0) onFile(accepted[0]);
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`dropzone${isDragActive ? ' dropzone--active' : ''}`}
      role="button"
      tabIndex={0}
    >
      <input {...getInputProps()} />
      <div className="dropzone__icon" aria-hidden>
        📄
      </div>
      <div className="dropzone__title">
        {isDragActive ? t('dropzone.active') : t('dropzone.title')}
      </div>
      <div className="dropzone__subtitle">{t('dropzone.subtitle')}</div>
    </div>
  );
}
