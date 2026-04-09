import { useDropzone } from 'react-dropzone';

export function DropZone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
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
        {isDragActive ? 'ここにドロップ' : '.pen ファイルをドロップ'}
      </div>
      <div className="dropzone__subtitle">または クリックしてファイルを選択</div>
    </div>
  );
}
