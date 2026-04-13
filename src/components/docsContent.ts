import type { SupportedLocale } from '../i18n/detectLocale';

/* ------------------------------------------------------------------ */
/*  Type definitions                                                   */
/* ------------------------------------------------------------------ */

export interface TableRow {
  cols: string[];
}

export interface TableData {
  headers: string[];
  rows: TableRow[];
}

export interface DocsLocale {
  back: string;
  sections: { id: string; title: string }[];

  gettingStarted: {
    title: string;
    intro: string;
    dragTitle: string;
    dragDesc: string;
    urlTitle: string;
    urlDesc: string;
    sampleTitle: string;
    sampleDesc: string;
    nodeTypesTitle: string;
    nodeTypesIntro: string;
    nodeTypes: { name: string; desc: string }[];
  };

  canvasNavigation: {
    title: string;
    zoomTitle: string;
    zoomTable: TableData;
    panTitle: string;
    panTable: TableData;
    frameSearchTitle: string;
    frameSearchDesc: string;
    frameHistoryTitle: string;
    frameHistoryDesc: string;
  };

  vimMode: {
    title: string;
    intro: string;
    normalTitle: string;
    normalTable: TableData;
    hintsTitle: string;
    hintsTable: TableData;
    insertTitle: string;
    insertTable: TableData;
    textObjectTitle: string;
    textObjectIntro: string;
    textObjectTable: TableData;
    numberPrefixTitle: string;
    numberPrefixDesc: string;
  };

  commandPalette: {
    title: string;
    intro: string;
    availableTitle: string;
    commands: { name: string; desc: string }[];
  };

  nodeEditing: {
    title: string;
    selectingTitle: string;
    selectingDesc: string;
    propertyPanelTitle: string;
    propertyPanelIntro: string;
    properties: { name: string; desc: string }[];
    transformTitle: string;
    transformTable: TableData;
    undoRedoTitle: string;
    undoRedoDesc: string;
  };

  exportSection: {
    title: string;
    table: TableData;
    desc: string;
  };

  shortcuts: {
    title: string;
    generalTitle: string;
    generalTable: TableData;
    zoomTitle: string;
    zoomTable: TableData;
    panTitle: string;
    panTable: TableData;
    navigationTitle: string;
    navigationTable: TableData;
    vimTitle: string;
    vimTable: TableData;
  };
}

/* ------------------------------------------------------------------ */
/*  English                                                            */
/* ------------------------------------------------------------------ */

const en: DocsLocale = {
  back: 'Back',
  sections: [
    { id: 'getting-started', title: 'Getting Started' },
    { id: 'canvas-navigation', title: 'Canvas Navigation' },
    { id: 'vim-mode', title: 'Vim Mode' },
    { id: 'command-palette', title: 'Command Palette' },
    { id: 'node-editing', title: 'Node Editing' },
    { id: 'export', title: 'Export' },
    { id: 'shortcuts', title: 'Keyboard Shortcuts' },
  ],

  gettingStarted: {
    title: 'Getting Started',
    intro:
      'Pencil Viewer lets you view and edit .pen design files directly in the browser. There are three ways to load a file:',
    dragTitle: 'Drag & Drop',
    dragDesc:
      'Drag any .pen file onto the landing page drop zone. The file is parsed entirely on the client \u2014 nothing is uploaded to a server.',
    urlTitle: 'URL Parameter',
    urlDesc:
      'Append ?src=https://example.com/design.pen to the page URL. The viewer will fetch the file on load. This is useful for sharing links to hosted design files.',
    sampleTitle: 'Sample Files',
    sampleDesc:
      'Click any sample card on the landing page to explore built-in example files without needing your own .pen document.',
    nodeTypesTitle: 'Supported Node Types',
    nodeTypesIntro:
      'The viewer supports the following node types defined in the .pen format:',
    nodeTypes: [
      { name: 'Frame', desc: 'top-level artboard container' },
      { name: 'Group', desc: 'logical grouping of child nodes' },
      { name: 'Rectangle', desc: 'basic rectangular shape' },
      { name: 'Ellipse', desc: 'circular / oval shape' },
      { name: 'Text', desc: 'text layer with font, size, and color' },
      { name: 'Icon Font', desc: 'icon rendered from an icon font' },
      { name: 'Image', desc: 'embedded or referenced bitmap' },
      { name: 'Vector', desc: 'custom vector path' },
    ],
  },

  canvasNavigation: {
    title: 'Canvas Navigation',
    zoomTitle: 'Zoom',
    zoomTable: {
      headers: ['Action', 'Shortcut'],
      rows: [
        { cols: ['Zoom in / out', 'Cmd + scroll wheel'] },
        { cols: ['Zoom in', 'Cmd + +'] },
        { cols: ['Zoom out', 'Cmd + -'] },
        { cols: ['Zoom to fit', 'Cmd + 0'] },
        { cols: ['Zoom to 100%', 'Cmd + 1'] },
      ],
    },
    panTitle: 'Pan',
    panTable: {
      headers: ['Action', 'Shortcut'],
      rows: [
        { cols: ['Pan canvas', 'Scroll (trackpad or mouse wheel)'] },
        { cols: ['Pan (drag)', 'Space + drag'] },
        { cols: ['Pan (alt drag)', 'Alt + drag'] },
        { cols: ['Pan (middle button)', 'Middle mouse button + drag'] },
      ],
    },
    frameSearchTitle: 'Frame Search',
    frameSearchDesc:
      'Press Cmd + P to open frame search. Type to filter frames by name. Results include a minimap preview, category labels, and are sorted by distance from the current viewport.',
    frameHistoryTitle: 'Frame Navigation History',
    frameHistoryDesc:
      'Navigate between previously visited frames using Cmd + [ (back) and Cmd + ] (forward), similar to browser history.',
  },

  vimMode: {
    title: 'Vim Mode',
    intro:
      'Enable Vim mode via the Command Palette (Cmd + Shift + P) and search for "Vim Mode". When active, the canvas responds to Vim-style keybindings.',
    normalTitle: 'Normal Mode',
    normalTable: {
      headers: ['Key', 'Action'],
      rows: [
        { cols: ['h j k l', 'Nudge selected node (or pan camera if nothing selected)'] },
        { cols: ['H J K L', 'Half-page scroll in the corresponding direction'] },
        { cols: ['g + h/j/k/l', 'Jump to adjacent frame in that direction'] },
      ],
    },
    hintsTitle: 'Hints & Focus',
    hintsTable: {
      headers: ['Key', 'Action'],
      rows: [
        { cols: ['f', 'Show hint labels for frames (EasyMotion style) \u2014 type label to jump'] },
        { cols: ['t', 'Show hint labels for all nodes'] },
        { cols: ['F', 'Zoom-focus on the currently selected node'] },
      ],
    },
    insertTitle: 'Insert Mode',
    insertTable: {
      headers: ['Key', 'Action'],
      rows: [
        { cols: ['i / I', 'Enter insert mode (edit text content of selected node)'] },
        { cols: ['Esc', 'Exit insert mode, return to normal mode'] },
      ],
    },
    textObjectTitle: 'Text Object Selection',
    textObjectIntro: 'Select text regions using Vim-style text objects:',
    textObjectTable: {
      headers: ['Command', 'Action'],
      rows: [
        { cols: ['vif', 'Select inner frame'] },
        { cols: ['vaf', 'Select around frame (including frame itself)'] },
        { cols: ['vir', 'Select inner row'] },
        { cols: ['vic', 'Select inner column'] },
      ],
    },
    numberPrefixTitle: 'Number Prefix',
    numberPrefixDesc:
      'Prepend a count to repeat a motion. For example, 3l moves the node 3 px to the right, and 5gj jumps 5 frames down.',
  },

  commandPalette: {
    title: 'Command Palette',
    intro:
      'Open the command palette with Cmd + Shift + P. Start typing to search for commands, then press Enter to execute.',
    availableTitle: 'Available Commands',
    commands: [
      { name: 'Align Left / Right / Top / Bottom', desc: 'Align selected nodes to an edge' },
      { name: 'Align Center Horizontal / Vertical', desc: 'Center-align selected nodes' },
      { name: 'Distribute Horizontal / Vertical', desc: 'Evenly space selected nodes' },
      { name: 'Vim Mode', desc: 'Toggle Vim keybindings on or off' },
      { name: 'Zoom to Fit', desc: 'Fit all content in the viewport' },
      { name: 'Zoom to 100%', desc: 'Reset zoom to actual size' },
      { name: 'Export .pen', desc: 'Save the current document' },
    ],
  },

  nodeEditing: {
    title: 'Node Editing',
    selectingTitle: 'Selecting Nodes',
    selectingDesc:
      'Click on any node to select it. When nodes overlap, the innermost (deepest) node wins. Hold Shift to add to the selection.',
    propertyPanelTitle: 'Property Panel',
    propertyPanelIntro:
      'The right-side property panel lets you edit attributes of the selected node:',
    properties: [
      { name: 'Position', desc: 'X and Y coordinates' },
      { name: 'Size', desc: 'Width and Height' },
      { name: 'Fill', desc: 'Background color' },
      { name: 'Stroke', desc: 'Border color and width' },
      { name: 'Opacity', desc: 'Transparency (0\u2013100%)' },
      { name: 'Font', desc: 'Family, size, weight (for text nodes)' },
      { name: 'Content', desc: 'Text content (for text nodes)' },
    ],
    transformTitle: 'Transform',
    transformTable: {
      headers: ['Action', 'How'],
      rows: [
        { cols: ['Move node', 'Drag the selected node'] },
        { cols: ['Resize node', 'Drag a corner or edge handle'] },
        { cols: ['Delete node', 'Backspace or Delete'] },
      ],
    },
    undoRedoTitle: 'Undo / Redo',
    undoRedoDesc:
      'Cmd + Z to undo, Cmd + Shift + Z to redo. The history stack tracks all property changes, moves, resizes, and deletions.',
  },

  exportSection: {
    title: 'Export',
    table: {
      headers: ['Action', 'Shortcut'],
      rows: [
        { cols: ['Quick export (default filename)', 'Cmd + S'] },
        { cols: ['Save as (custom filename)', 'Cmd + Shift + S'] },
      ],
    },
    desc: 'Both options export the raw .pen JSON format with all your edits applied. The file is downloaded directly to your machine \u2014 nothing is sent to a server.',
  },

  shortcuts: {
    title: 'Keyboard Shortcuts Reference',
    generalTitle: 'General',
    generalTable: {
      headers: ['Shortcut', 'Action'],
      rows: [
        { cols: ['Cmd + Shift + P', 'Open command palette'] },
        { cols: ['Cmd + P', 'Frame search'] },
        { cols: ['Cmd + S', 'Quick export'] },
        { cols: ['Cmd + Shift + S', 'Save as'] },
        { cols: ['Cmd + Z', 'Undo'] },
        { cols: ['Cmd + Shift + Z', 'Redo'] },
        { cols: ['Backspace', 'Delete selected node'] },
      ],
    },
    zoomTitle: 'Zoom',
    zoomTable: {
      headers: ['Shortcut', 'Action'],
      rows: [
        { cols: ['Cmd + scroll', 'Zoom in / out'] },
        { cols: ['Cmd + +', 'Zoom in'] },
        { cols: ['Cmd + -', 'Zoom out'] },
        { cols: ['Cmd + 0', 'Zoom to fit'] },
        { cols: ['Cmd + 1', 'Zoom to 100%'] },
      ],
    },
    panTitle: 'Pan',
    panTable: {
      headers: ['Shortcut', 'Action'],
      rows: [
        { cols: ['Scroll', 'Pan canvas'] },
        { cols: ['Space + drag', 'Pan (hand tool)'] },
        { cols: ['Alt + drag', 'Pan'] },
        { cols: ['Middle mouse + drag', 'Pan'] },
      ],
    },
    navigationTitle: 'Navigation',
    navigationTable: {
      headers: ['Shortcut', 'Action'],
      rows: [
        { cols: ['Cmd + [', 'Navigate back (frame history)'] },
        { cols: ['Cmd + ]', 'Navigate forward (frame history)'] },
      ],
    },
    vimTitle: 'Vim Mode',
    vimTable: {
      headers: ['Key', 'Action'],
      rows: [
        { cols: ['h j k l', 'Nudge / pan'] },
        { cols: ['H J K L', 'Half-page scroll'] },
        { cols: ['g + h/j/k/l', 'Jump to adjacent frame'] },
        { cols: ['f', 'Frame hint labels'] },
        { cols: ['t', 'All-node hint labels'] },
        { cols: ['F', 'Zoom-focus selected'] },
        { cols: ['i / I', 'Enter insert mode'] },
        { cols: ['Esc', 'Exit insert mode'] },
        { cols: ['vif', 'Select inner frame'] },
        { cols: ['vaf', 'Select around frame'] },
        { cols: ['vir', 'Select inner row'] },
        { cols: ['vic', 'Select inner column'] },
        { cols: ['N + motion', 'Repeat motion N times'] },
      ],
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Japanese                                                           */
/* ------------------------------------------------------------------ */

const ja: DocsLocale = {
  back: '戻る',
  sections: [
    { id: 'getting-started', title: 'はじめに' },
    { id: 'canvas-navigation', title: 'キャンバス操作' },
    { id: 'vim-mode', title: 'Vim モード' },
    { id: 'command-palette', title: 'コマンドパレット' },
    { id: 'node-editing', title: 'ノード編集' },
    { id: 'export', title: 'エクスポート' },
    { id: 'shortcuts', title: 'キーボードショートカット' },
  ],

  gettingStarted: {
    title: 'はじめに',
    intro:
      'Pencil Viewer を使うと、ブラウザ上で .pen デザインファイルを表示・編集できます。ファイルを読み込むには3つの方法があります:',
    dragTitle: 'ドラッグ＆ドロップ',
    dragDesc:
      '.pen ファイルをランディングページのドロップゾーンにドラッグしてください。ファイルはすべてクライアント側で解析され、サーバーにはアップロードされません。',
    urlTitle: 'URL パラメータ',
    urlDesc:
      'ページ URL に ?src=https://example.com/design.pen を追加すると、読み込み時にファイルを取得します。ホスティングされたデザインファイルへのリンクを共有する際に便利です。',
    sampleTitle: 'サンプルファイル',
    sampleDesc:
      'ランディングページのサンプルカードをクリックすると、自分の .pen ドキュメントがなくても組み込みのサンプルファイルを閲覧できます。',
    nodeTypesTitle: '対応ノードタイプ',
    nodeTypesIntro:
      '.pen フォーマットで定義されている以下のノードタイプに対応しています:',
    nodeTypes: [
      { name: 'Frame', desc: 'トップレベルのアートボードコンテナ' },
      { name: 'Group', desc: '子ノードの論理的なグループ' },
      { name: 'Rectangle', desc: '基本的な矩形' },
      { name: 'Ellipse', desc: '円形・楕円形' },
      { name: 'Text', desc: 'フォント、サイズ、色を持つテキストレイヤー' },
      { name: 'Icon Font', desc: 'アイコンフォントから描画されるアイコン' },
      { name: 'Image', desc: '埋め込みまたは参照されたビットマップ' },
      { name: 'Vector', desc: 'カスタムベクターパス' },
    ],
  },

  canvasNavigation: {
    title: 'キャンバス操作',
    zoomTitle: 'ズーム',
    zoomTable: {
      headers: ['操作', 'ショートカット'],
      rows: [
        { cols: ['ズームイン / アウト', 'Cmd + スクロールホイール'] },
        { cols: ['ズームイン', 'Cmd + +'] },
        { cols: ['ズームアウト', 'Cmd + -'] },
        { cols: ['全体表示', 'Cmd + 0'] },
        { cols: ['100% 表示', 'Cmd + 1'] },
      ],
    },
    panTitle: 'パン',
    panTable: {
      headers: ['操作', 'ショートカット'],
      rows: [
        { cols: ['キャンバスをパン', 'スクロール (トラックパッドまたはマウスホイール)'] },
        { cols: ['パン (ドラッグ)', 'Space + ドラッグ'] },
        { cols: ['パン (Alt ドラッグ)', 'Alt + ドラッグ'] },
        { cols: ['パン (中ボタン)', 'マウス中ボタン + ドラッグ'] },
      ],
    },
    frameSearchTitle: 'フレーム検索',
    frameSearchDesc:
      'Cmd + P でフレーム検索を開きます。名前でフレームを絞り込めます。結果にはミニマッププレビュー、カテゴリラベルが含まれ、現在のビューポートからの距離順に並びます。',
    frameHistoryTitle: 'フレームナビゲーション履歴',
    frameHistoryDesc:
      'Cmd + [ (戻る) と Cmd + ] (進む) で、過去に訪問したフレーム間を移動できます。ブラウザの履歴と同様の操作感です。',
  },

  vimMode: {
    title: 'Vim モード',
    intro:
      'コマンドパレット (Cmd + Shift + P) から「Vim Mode」を検索して Vim モードを有効にできます。有効にすると、キャンバスが Vim スタイルのキーバインドに対応します。',
    normalTitle: 'ノーマルモード',
    normalTable: {
      headers: ['キー', '操作'],
      rows: [
        { cols: ['h j k l', '選択ノードを微調整 (未選択時はカメラをパン)'] },
        { cols: ['H J K L', '対応する方向に半ページスクロール'] },
        { cols: ['g + h/j/k/l', 'その方向の隣接フレームにジャンプ'] },
      ],
    },
    hintsTitle: 'ヒントとフォーカス',
    hintsTable: {
      headers: ['キー', '操作'],
      rows: [
        { cols: ['f', 'フレームのヒントラベルを表示 (EasyMotion 方式) \u2014 ラベルを入力してジャンプ'] },
        { cols: ['t', 'すべてのノードのヒントラベルを表示'] },
        { cols: ['F', '選択中のノードにズームフォーカス'] },
      ],
    },
    insertTitle: 'インサートモード',
    insertTable: {
      headers: ['キー', '操作'],
      rows: [
        { cols: ['i / I', 'インサートモードに入る (選択ノードのテキストを編集)'] },
        { cols: ['Esc', 'インサートモードを終了し、ノーマルモードに戻る'] },
      ],
    },
    textObjectTitle: 'テキストオブジェクト選択',
    textObjectIntro: 'Vim スタイルのテキストオブジェクトでリージョンを選択できます:',
    textObjectTable: {
      headers: ['コマンド', '操作'],
      rows: [
        { cols: ['vif', 'フレーム内部を選択'] },
        { cols: ['vaf', 'フレーム全体を選択 (フレーム自体を含む)'] },
        { cols: ['vir', '行内部を選択'] },
        { cols: ['vic', '列内部を選択'] },
      ],
    },
    numberPrefixTitle: '数値プレフィックス',
    numberPrefixDesc:
      '数値を前置してモーションを繰り返せます。例: 3l でノードを右に 3px 移動、5gj で 5 フレーム下にジャンプします。',
  },

  commandPalette: {
    title: 'コマンドパレット',
    intro:
      'Cmd + Shift + P でコマンドパレットを開きます。入力してコマンドを検索し、Enter で実行します。',
    availableTitle: '利用可能なコマンド',
    commands: [
      { name: 'Align Left / Right / Top / Bottom', desc: '選択ノードを端に揃える' },
      { name: 'Align Center Horizontal / Vertical', desc: '選択ノードを中央揃え' },
      { name: 'Distribute Horizontal / Vertical', desc: '選択ノードを等間隔に配置' },
      { name: 'Vim Mode', desc: 'Vim キーバインドのオン・オフ切り替え' },
      { name: 'Zoom to Fit', desc: 'すべてのコンテンツをビューポートに収める' },
      { name: 'Zoom to 100%', desc: 'ズームを実寸に戻す' },
      { name: 'Export .pen', desc: '現在のドキュメントを保存' },
    ],
  },

  nodeEditing: {
    title: 'ノード編集',
    selectingTitle: 'ノードの選択',
    selectingDesc:
      '任意のノードをクリックして選択します。ノードが重なっている場合、最も内側 (深い) ノードが選択されます。Shift を押しながらクリックで選択に追加できます。',
    propertyPanelTitle: 'プロパティパネル',
    propertyPanelIntro:
      '右側のプロパティパネルで、選択ノードの属性を編集できます:',
    properties: [
      { name: 'Position', desc: 'X / Y 座標' },
      { name: 'Size', desc: '幅と高さ' },
      { name: 'Fill', desc: '背景色' },
      { name: 'Stroke', desc: '枠線の色と太さ' },
      { name: 'Opacity', desc: '不透明度 (0\u2013100%)' },
      { name: 'Font', desc: 'フォントファミリー、サイズ、太さ (テキストノード用)' },
      { name: 'Content', desc: 'テキスト内容 (テキストノード用)' },
    ],
    transformTitle: 'トランスフォーム',
    transformTable: {
      headers: ['操作', '方法'],
      rows: [
        { cols: ['ノードの移動', '選択ノードをドラッグ'] },
        { cols: ['ノードのリサイズ', '角または辺のハンドルをドラッグ'] },
        { cols: ['ノードの削除', 'Backspace または Delete'] },
      ],
    },
    undoRedoTitle: '元に戻す / やり直す',
    undoRedoDesc:
      'Cmd + Z で元に戻す、Cmd + Shift + Z でやり直します。変更履歴にはプロパティの変更、移動、リサイズ、削除がすべて記録されます。',
  },

  exportSection: {
    title: 'エクスポート',
    table: {
      headers: ['操作', 'ショートカット'],
      rows: [
        { cols: ['クイックエクスポート (デフォルトファイル名)', 'Cmd + S'] },
        { cols: ['名前を付けて保存 (カスタムファイル名)', 'Cmd + Shift + S'] },
      ],
    },
    desc: 'どちらのオプションも、編集内容をすべて反映した .pen JSON 形式でエクスポートします。ファイルはお使いのマシンに直接ダウンロードされ、サーバーには送信されません。',
  },

  shortcuts: {
    title: 'キーボードショートカット一覧',
    generalTitle: '全般',
    generalTable: {
      headers: ['ショートカット', '操作'],
      rows: [
        { cols: ['Cmd + Shift + P', 'コマンドパレットを開く'] },
        { cols: ['Cmd + P', 'フレーム検索'] },
        { cols: ['Cmd + S', 'クイックエクスポート'] },
        { cols: ['Cmd + Shift + S', '名前を付けて保存'] },
        { cols: ['Cmd + Z', '元に戻す'] },
        { cols: ['Cmd + Shift + Z', 'やり直す'] },
        { cols: ['Backspace', '選択ノードを削除'] },
      ],
    },
    zoomTitle: 'ズーム',
    zoomTable: {
      headers: ['ショートカット', '操作'],
      rows: [
        { cols: ['Cmd + スクロール', 'ズームイン / アウト'] },
        { cols: ['Cmd + +', 'ズームイン'] },
        { cols: ['Cmd + -', 'ズームアウト'] },
        { cols: ['Cmd + 0', '全体表示'] },
        { cols: ['Cmd + 1', '100% 表示'] },
      ],
    },
    panTitle: 'パン',
    panTable: {
      headers: ['ショートカット', '操作'],
      rows: [
        { cols: ['スクロール', 'キャンバスをパン'] },
        { cols: ['Space + ドラッグ', 'パン (ハンドツール)'] },
        { cols: ['Alt + ドラッグ', 'パン'] },
        { cols: ['マウス中ボタン + ドラッグ', 'パン'] },
      ],
    },
    navigationTitle: 'ナビゲーション',
    navigationTable: {
      headers: ['ショートカット', '操作'],
      rows: [
        { cols: ['Cmd + [', '戻る (フレーム履歴)'] },
        { cols: ['Cmd + ]', '進む (フレーム履歴)'] },
      ],
    },
    vimTitle: 'Vim モード',
    vimTable: {
      headers: ['キー', '操作'],
      rows: [
        { cols: ['h j k l', '微調整 / パン'] },
        { cols: ['H J K L', '半ページスクロール'] },
        { cols: ['g + h/j/k/l', '隣接フレームにジャンプ'] },
        { cols: ['f', 'フレームヒントラベル'] },
        { cols: ['t', '全ノードヒントラベル'] },
        { cols: ['F', '選択ノードにズームフォーカス'] },
        { cols: ['i / I', 'インサートモードに入る'] },
        { cols: ['Esc', 'インサートモードを終了'] },
        { cols: ['vif', 'フレーム内部を選択'] },
        { cols: ['vaf', 'フレーム全体を選択'] },
        { cols: ['vir', '行内部を選択'] },
        { cols: ['vic', '列内部を選択'] },
        { cols: ['N + モーション', 'モーションを N 回繰り返す'] },
      ],
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Simplified Chinese                                                 */
/* ------------------------------------------------------------------ */

const zh: DocsLocale = {
  back: '返回',
  sections: [
    { id: 'getting-started', title: '快速入门' },
    { id: 'canvas-navigation', title: '画布导航' },
    { id: 'vim-mode', title: 'Vim 模式' },
    { id: 'command-palette', title: '命令面板' },
    { id: 'node-editing', title: '节点编辑' },
    { id: 'export', title: '导出' },
    { id: 'shortcuts', title: '键盘快捷键' },
  ],

  gettingStarted: {
    title: '快速入门',
    intro:
      'Pencil Viewer 可让您直接在浏览器中查看和编辑 .pen 设计文件。加载文件有三种方式:',
    dragTitle: '拖放',
    dragDesc:
      '将任何 .pen 文件拖到着陆页的放置区域。文件完全在客户端解析，不会上传到服务器。',
    urlTitle: 'URL 参数',
    urlDesc:
      '在页面 URL 后追加 ?src=https://example.com/design.pen。查看器会在加载时获取该文件。这对于分享托管设计文件的链接非常有用。',
    sampleTitle: '示例文件',
    sampleDesc:
      '点击着陆页上的任何示例卡片，无需自己的 .pen 文档即可浏览内置示例文件。',
    nodeTypesTitle: '支持的节点类型',
    nodeTypesIntro:
      '查看器支持 .pen 格式中定义的以下节点类型:',
    nodeTypes: [
      { name: 'Frame', desc: '顶层画板容器' },
      { name: 'Group', desc: '子节点的逻辑分组' },
      { name: 'Rectangle', desc: '基本矩形' },
      { name: 'Ellipse', desc: '圆形/椭圆形' },
      { name: 'Text', desc: '包含字体、大小和颜色的文本图层' },
      { name: 'Icon Font', desc: '从图标字体渲染的图标' },
      { name: 'Image', desc: '嵌入或引用的位图' },
      { name: 'Vector', desc: '自定义矢量路径' },
    ],
  },

  canvasNavigation: {
    title: '画布导航',
    zoomTitle: '缩放',
    zoomTable: {
      headers: ['操作', '快捷键'],
      rows: [
        { cols: ['放大 / 缩小', 'Cmd + 滚轮'] },
        { cols: ['放大', 'Cmd + +'] },
        { cols: ['缩小', 'Cmd + -'] },
        { cols: ['适应窗口', 'Cmd + 0'] },
        { cols: ['100% 显示', 'Cmd + 1'] },
      ],
    },
    panTitle: '平移',
    panTable: {
      headers: ['操作', '快捷键'],
      rows: [
        { cols: ['平移画布', '滚动 (触控板或鼠标滚轮)'] },
        { cols: ['平移 (拖拽)', 'Space + 拖拽'] },
        { cols: ['平移 (Alt 拖拽)', 'Alt + 拖拽'] },
        { cols: ['平移 (中键)', '鼠标中键 + 拖拽'] },
      ],
    },
    frameSearchTitle: '画框搜索',
    frameSearchDesc:
      '按 Cmd + P 打开画框搜索。输入名称筛选画框。结果包含小地图预览和分类标签，按与当前视口的距离排序。',
    frameHistoryTitle: '画框导航历史',
    frameHistoryDesc:
      '使用 Cmd + [ (后退) 和 Cmd + ] (前进) 在之前访问过的画框之间导航，类似于浏览器历史记录。',
  },

  vimMode: {
    title: 'Vim 模式',
    intro:
      '通过命令面板 (Cmd + Shift + P) 搜索 "Vim Mode" 来启用 Vim 模式。启用后，画布将响应 Vim 风格的键绑定。',
    normalTitle: '普通模式',
    normalTable: {
      headers: ['按键', '操作'],
      rows: [
        { cols: ['h j k l', '微调选中节点 (未选中时平移相机)'] },
        { cols: ['H J K L', '向对应方向半页滚动'] },
        { cols: ['g + h/j/k/l', '跳转到该方向的相邻画框'] },
      ],
    },
    hintsTitle: '提示与聚焦',
    hintsTable: {
      headers: ['按键', '操作'],
      rows: [
        { cols: ['f', '显示画框提示标签 (EasyMotion 风格) \u2014 输入标签跳转'] },
        { cols: ['t', '显示所有节点的提示标签'] },
        { cols: ['F', '缩放聚焦到当前选中节点'] },
      ],
    },
    insertTitle: '插入模式',
    insertTable: {
      headers: ['按键', '操作'],
      rows: [
        { cols: ['i / I', '进入插入模式 (编辑选中节点的文本内容)'] },
        { cols: ['Esc', '退出插入模式，返回普通模式'] },
      ],
    },
    textObjectTitle: '文本对象选择',
    textObjectIntro: '使用 Vim 风格的文本对象选择区域:',
    textObjectTable: {
      headers: ['命令', '操作'],
      rows: [
        { cols: ['vif', '选择画框内部'] },
        { cols: ['vaf', '选择画框周围 (包括画框本身)'] },
        { cols: ['vir', '选择行内部'] },
        { cols: ['vic', '选择列内部'] },
      ],
    },
    numberPrefixTitle: '数字前缀',
    numberPrefixDesc:
      '在动作前输入数字来重复执行。例如，3l 将节点向右移动 3 像素，5gj 向下跳转 5 个画框。',
  },

  commandPalette: {
    title: '命令面板',
    intro:
      '使用 Cmd + Shift + P 打开命令面板。输入文字搜索命令，然后按 Enter 执行。',
    availableTitle: '可用命令',
    commands: [
      { name: 'Align Left / Right / Top / Bottom', desc: '将选中节点对齐到边缘' },
      { name: 'Align Center Horizontal / Vertical', desc: '将选中节点居中对齐' },
      { name: 'Distribute Horizontal / Vertical', desc: '均匀分布选中节点' },
      { name: 'Vim Mode', desc: '切换 Vim 键绑定的开/关' },
      { name: 'Zoom to Fit', desc: '将所有内容适应到视口' },
      { name: 'Zoom to 100%', desc: '将缩放重置为实际大小' },
      { name: 'Export .pen', desc: '保存当前文档' },
    ],
  },

  nodeEditing: {
    title: '节点编辑',
    selectingTitle: '选择节点',
    selectingDesc:
      '点击任意节点进行选择。当节点重叠时，最内层 (最深) 的节点优先。按住 Shift 点击可添加到选择中。',
    propertyPanelTitle: '属性面板',
    propertyPanelIntro:
      '右侧属性面板可编辑选中节点的属性:',
    properties: [
      { name: 'Position', desc: 'X 和 Y 坐标' },
      { name: 'Size', desc: '宽度和高度' },
      { name: 'Fill', desc: '背景颜色' },
      { name: 'Stroke', desc: '边框颜色和宽度' },
      { name: 'Opacity', desc: '不透明度 (0\u2013100%)' },
      { name: 'Font', desc: '字体、大小、粗细 (文本节点)' },
      { name: 'Content', desc: '文本内容 (文本节点)' },
    ],
    transformTitle: '变换',
    transformTable: {
      headers: ['操作', '方法'],
      rows: [
        { cols: ['移动节点', '拖拽选中的节点'] },
        { cols: ['调整节点大小', '拖拽角或边的手柄'] },
        { cols: ['删除节点', 'Backspace 或 Delete'] },
      ],
    },
    undoRedoTitle: '撤销 / 重做',
    undoRedoDesc:
      'Cmd + Z 撤销，Cmd + Shift + Z 重做。历史记录会跟踪所有属性更改、移动、调整大小和删除操作。',
  },

  exportSection: {
    title: '导出',
    table: {
      headers: ['操作', '快捷键'],
      rows: [
        { cols: ['快速导出 (默认文件名)', 'Cmd + S'] },
        { cols: ['另存为 (自定义文件名)', 'Cmd + Shift + S'] },
      ],
    },
    desc: '两种方式都会导出包含所有编辑的原始 .pen JSON 格式文件。文件直接下载到您的设备，不会发送到服务器。',
  },

  shortcuts: {
    title: '键盘快捷键参考',
    generalTitle: '通用',
    generalTable: {
      headers: ['快捷键', '操作'],
      rows: [
        { cols: ['Cmd + Shift + P', '打开命令面板'] },
        { cols: ['Cmd + P', '画框搜索'] },
        { cols: ['Cmd + S', '快速导出'] },
        { cols: ['Cmd + Shift + S', '另存为'] },
        { cols: ['Cmd + Z', '撤销'] },
        { cols: ['Cmd + Shift + Z', '重做'] },
        { cols: ['Backspace', '删除选中节点'] },
      ],
    },
    zoomTitle: '缩放',
    zoomTable: {
      headers: ['快捷键', '操作'],
      rows: [
        { cols: ['Cmd + 滚动', '放大 / 缩小'] },
        { cols: ['Cmd + +', '放大'] },
        { cols: ['Cmd + -', '缩小'] },
        { cols: ['Cmd + 0', '适应窗口'] },
        { cols: ['Cmd + 1', '100% 显示'] },
      ],
    },
    panTitle: '平移',
    panTable: {
      headers: ['快捷键', '操作'],
      rows: [
        { cols: ['滚动', '平移画布'] },
        { cols: ['Space + 拖拽', '平移 (手形工具)'] },
        { cols: ['Alt + 拖拽', '平移'] },
        { cols: ['鼠标中键 + 拖拽', '平移'] },
      ],
    },
    navigationTitle: '导航',
    navigationTable: {
      headers: ['快捷键', '操作'],
      rows: [
        { cols: ['Cmd + [', '后退 (画框历史)'] },
        { cols: ['Cmd + ]', '前进 (画框历史)'] },
      ],
    },
    vimTitle: 'Vim 模式',
    vimTable: {
      headers: ['按键', '操作'],
      rows: [
        { cols: ['h j k l', '微调 / 平移'] },
        { cols: ['H J K L', '半页滚动'] },
        { cols: ['g + h/j/k/l', '跳转到相邻画框'] },
        { cols: ['f', '画框提示标签'] },
        { cols: ['t', '所有节点提示标签'] },
        { cols: ['F', '缩放聚焦选中项'] },
        { cols: ['i / I', '进入插入模式'] },
        { cols: ['Esc', '退出插入模式'] },
        { cols: ['vif', '选择画框内部'] },
        { cols: ['vaf', '选择画框周围'] },
        { cols: ['vir', '选择行内部'] },
        { cols: ['vic', '选择列内部'] },
        { cols: ['N + 动作', '重复动作 N 次'] },
      ],
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Lookup                                                             */
/* ------------------------------------------------------------------ */

const docsContent: Record<SupportedLocale, DocsLocale> = { en, ja, zh };

export function getDocsContent(locale: SupportedLocale): DocsLocale {
  return docsContent[locale] ?? docsContent.en;
}
