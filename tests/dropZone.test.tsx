/**
 * DropZone のスモークテスト。
 *
 * react-dropzone は 14 → 20 と 6 メジャー飛んでおり (#67)、
 * useDropzone の戻り値 (getRootProps / getInputProps / isDragActive) の
 * 契約が変わっていないことをマウントして確かめる。
 * ファイル選択の実挙動は jsdom の DataTransfer 制約があるため、
 * drop イベントを直接組み立てて onDrop まで到達することを見る。
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DropZone } from '../src/components/Loader/DropZone';
import { I18nProvider } from '../src/i18n/I18nContext';

function renderDropZone(props: Partial<Parameters<typeof DropZone>[0]> = {}) {
  const onFile = vi.fn();
  const utils = render(
    <I18nProvider>
      <DropZone onFile={onFile} {...props} />
    </I18nProvider>,
  );
  return { ...utils, onFile };
}

/** jsdom には DataTransfer が無いので drop イベントの中身を手で組む */
function fileDropEvent(files: File[]) {
  return {
    dataTransfer: {
      files,
      items: files.map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f })),
      types: ['Files'],
    },
  };
}

describe('DropZone', () => {
  it('マウントできる (react-dropzone の API 契約)', () => {
    const { container } = renderDropZone();
    expect(container.querySelector('.dropzone')).toBeTruthy();
  });

  it('getInputProps が file input を生成する', () => {
    const { container } = renderDropZone();
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
  });

  it('role=button でキーボード到達可能', () => {
    renderDropZone();
    const zone = screen.getByRole('button');
    expect(zone.getAttribute('tabIndex')).toBe('0');
  });

  it('初期状態では dropzone--active が付かない', () => {
    const { container } = renderDropZone();
    expect(container.querySelector('.dropzone')?.className).not.toContain('dropzone--active');
  });

  it('ドラッグ中は isDragActive が立って active クラスが付く', async () => {
    const { container } = renderDropZone();
    const zone = container.querySelector('.dropzone')!;

    fireEvent.dragEnter(zone, fileDropEvent([new File(['{}'], 'a.pen', { type: 'application/json' })]));

    await waitFor(() => {
      expect(container.querySelector('.dropzone')?.className).toContain('dropzone--active');
    });
  });

  it('ドロップされたファイルを onFile に渡す', async () => {
    const { container, onFile } = renderDropZone();
    const zone = container.querySelector('.dropzone')!;
    const file = new File(['{"version":"2.10","children":[]}'], 'doc.pen', { type: 'application/json' });

    fireEvent.drop(zone, fileDropEvent([file]));

    await waitFor(() => {
      expect(onFile).toHaveBeenCalledTimes(1);
    });
    expect(onFile.mock.calls[0][0].name).toBe('doc.pen');
  });

  it('disabled のときはドロップしても onFile を呼ばない', async () => {
    const { container, onFile } = renderDropZone({ disabled: true });
    const zone = container.querySelector('.dropzone')!;
    const file = new File(['{}'], 'doc.pen', { type: 'application/json' });

    fireEvent.drop(zone, fileDropEvent([file]));

    await new Promise((r) => setTimeout(r, 50));
    expect(onFile).not.toHaveBeenCalled();
  });
});
