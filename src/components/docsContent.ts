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
    advancedTitle: string;
    advancedItems: { icon: string; title: string; desc: string }[];
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

  collab: {
    title: string;
    intro: string;
    p2pTitle: string;
    p2pSteps: string[];
    howItWorksTitle: string;
    howItWorksDesc: string;
    noTraceTitle: string;
    noTraceDesc: string;
    limitationsTitle: string;
    limitations: string[];
  };

  apiIntegration: {
    title: string;
    betaNote: string;
    bridgeTitle: string;
    bridgeSetup: string;
    restTitle: string;
    restTable: TableData;
    curlTitle: string;
    curlExamples: string[];
    mcpTitle: string;
    mcpDesc: string;
    mcpConfig: string;
    claudeExampleTitle: string;
    claudeExampleDesc: string;
  };

  designQuality: {
    title: string;
    intro: string;
    fiveStatesTitle: string;
    fiveStatesDesc: string;
    fiveStatesConvention: string;
    designDocTitle: string;
    designDocDesc: string;
    restApiTitle: string;
    restApiExamples: string[];
    mcpToolsTitle: string;
    mcpToolsDesc: string;
    aiReviewTitle: string;
    aiReviewDesc: string;
    aiReviewAccess: string;
    aiReviewModesTitle: string;
    aiReviewModesTable: TableData;
    aiReviewSetup: string;
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
    { id: 'collab', title: 'Collaborative Editing' },
    { id: 'api-integration', title: 'API & CLI Integration' },
    { id: 'design-quality', title: 'Design Quality' },
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
    advancedTitle: 'Beyond Viewing',
    advancedItems: [
      { icon: '🎨', title: 'Vim-style Editing', desc: 'Navigate and edit with hjkl, EasyMotion hints, text objects — all from your keyboard.' },
      { icon: '👥', title: 'P2P Collaborative Editing', desc: 'Share a URL, edit together in real-time. No server, no account. Data disappears when everyone leaves.' },
      { icon: '🤖', title: 'AI Integration (Claude Code)', desc: 'Connect Claude Code via REST API or MCP. Watch AI edits appear live in your browser.' },
      { icon: '📦', title: 'Export & Save', desc: 'Cmd+S to export edited .pen files. All changes stay local until you choose to share.' },
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

  collab: {
    title: 'Collaborative Editing',
    intro:
      'Pencil Viewer supports real-time collaborative editing directly in the browser with no server required.',
    p2pTitle: 'P2P Mode',
    p2pSteps: [
      'Click the "Collab" button in the toolbar.',
      'A unique room URL is generated automatically.',
      'Share the URL with collaborators.',
      'Others open the link to join the session.',
      'All changes sync in real-time across participants.',
    ],
    howItWorksTitle: 'How It Works',
    howItWorksDesc:
      'Collaborative editing is powered by Yjs CRDT combined with WebRTC for peer-to-peer communication. No server stores your design data — synchronization happens directly between connected browsers.',
    noTraceTitle: 'No Trace, No Server, No Cost',
    noTraceDesc:
      'Since data lives only in participant browsers, when everyone leaves the room the data is gone. There is no server to maintain, no storage cost, and no data retention.',
    limitationsTitle: 'Limitations',
    limitations: [
      'All participants must be online simultaneously — there is no offline sync.',
      'Best for small groups of 5-8 people. Performance may degrade with more participants.',
      'NAT traversal issues may prevent connections for some network configurations.',
    ],
  },

  apiIntegration: {
    title: 'API & CLI Integration',
    betaNote:
      '[BETA] This is an experimental feature. The bridge runs on localhost only and stores data in memory. It is not intended for production use.',
    bridgeTitle: 'Collab Bridge Setup',
    bridgeSetup: 'cd tools/collab-bridge && npm install && node index.js',
    restTitle: 'REST API',
    restTable: {
      headers: ['Method', 'Endpoint', 'Description'],
      rows: [
        { cols: ['GET', '/status', 'Bridge status'] },
        { cols: ['GET', '/document', 'Full document JSON'] },
        { cols: ['GET', '/frames', 'Frame list'] },
        { cols: ['GET', '/node/:id', 'Read a node'] },
        { cols: ['PUT', '/node/:id', 'Update a node (body: patch JSON)'] },
        { cols: ['POST', '/document', 'Set full document'] },
      ],
    },
    curlTitle: 'curl Examples',
    curlExamples: [
      'curl http://localhost:4567/frames',
      "curl -X PUT http://localhost:4567/node/abc123 -H 'Content-Type: application/json' -d '{\"fill\":\"#ff0000\"}'",
    ],
    mcpTitle: 'MCP Integration with Claude Code',
    mcpDesc:
      'You can connect Collab Bridge to Claude Code via MCP (Model Context Protocol). Add the following to your .mcp.json configuration:',
    mcpConfig: JSON.stringify(
      {
        mcpServers: {
          'pencil-bridge': {
            command: 'node',
            args: ['tools/collab-bridge/index.js'],
          },
        },
      },
      null,
      2,
    ),
    claudeExampleTitle: 'Claude Code Example',
    claudeExampleDesc:
      'With MCP configured, you can give natural language commands such as "change the header color to blue". Claude Code will call update_node via MCP and the change appears in the browser in real-time.',
  },

  designQuality: {
    title: 'Design Quality',
    intro:
      'Pencil Viewer includes built-in tools for auditing design quality and exporting design documentation.',
    fiveStatesTitle: 'Five UI States Audit',
    fiveStatesDesc:
      'Open the command palette (Cmd + Shift + P) and run "Five UI States Audit". This checks every screen in your document for coverage of the five essential UI states: Empty, Loading, Error, Partial, and Ideal.',
    fiveStatesConvention:
      'Detection is based on frame naming conventions. Append a state suffix to your frame names to mark them \u2014 for example "UserList - Empty", "UserList - Loading", "UserList - Error". The audit reports which states are present and which are missing for each screen.',
    designDocTitle: 'Design Doc Export',
    designDocDesc:
      'Open the command palette (Cmd + Shift + P) and run "Export Design Doc". This generates a Markdown document containing a screen summary table, component tree, color palette, and design tokens. The output can be imported directly into Notion or any Markdown-compatible tool.',
    restApiTitle: 'REST API / MCP',
    restApiExamples: [
      'curl http://localhost:4567/check-ui-states',
      'curl http://localhost:4567/export-design-doc?project=MyProject&locale=ja',
    ],
    mcpToolsTitle: 'MCP Tools',
    mcpToolsDesc:
      'The following MCP tools are available for design quality workflows: check_ui_states (audit all screens), suggest_missing_states (recommend states to add), and export_design_doc (generate Markdown documentation).',
    aiReviewTitle: 'AI Design Review [BETA]',
    aiReviewDesc:
      'Pencil Viewer integrates with Cloudflare Workers AI (Llama 3.1) to provide AI-powered design analysis. No design data is stored on the server --- the feature is fully stateless and costs $0.',
    aiReviewAccess:
      'Open the command palette (Cmd + Shift + P) and run "AI Design Review" to launch the review panel.',
    aiReviewModesTitle: 'Review Modes',
    aiReviewModesTable: {
      headers: ['Mode', 'Description'],
      rows: [
        { cols: ['Full Review', 'Comprehensive analysis covering layout, typography, color, and consistency'] },
        { cols: ['Five UI States', 'Checks coverage of Empty / Loading / Error / Partial / Ideal states'] },
        { cols: ['Accessibility', 'Evaluates contrast, touch targets, screen reader friendliness, and WCAG compliance'] },
        { cols: ['Quick Feedback', 'Short, actionable feedback for rapid iteration'] },
      ],
    },
    aiReviewSetup:
      'This feature requires a Cloudflare Workers AI backend. See workers/ai-review/README.md for setup instructions.',
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
    { id: 'collab', title: '共同編集' },
    { id: 'api-integration', title: 'API & CLI 連携' },
    { id: 'design-quality', title: 'デザイン品質' },
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
    advancedTitle: 'ビューアーを超えて',
    advancedItems: [
      { icon: '🎨', title: 'Vim スタイル編集', desc: 'hjkl 移動、EasyMotion ヒント、テキストオブジェクト — キーボードだけで高速操作。' },
      { icon: '👥', title: 'P2P 共同編集', desc: 'URL を共有するだけでリアルタイム共同編集。サーバー不要、アカウント不要。全員が離れたらデータは消えます。' },
      { icon: '🤖', title: 'AI 連携 (Claude Code)', desc: 'REST API または MCP で Claude Code を接続。AI の編集がブラウザにリアルタイム反映。' },
      { icon: '📦', title: 'エクスポート & 保存', desc: 'Cmd+S で編集済み .pen ファイルをエクスポート。共有するまで全てローカルで完結。' },
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

  collab: {
    title: '共同編集',
    intro:
      'Pencil Viewer はサーバー不要でブラウザ上のリアルタイム共同編集に対応しています。',
    p2pTitle: 'P2P モード',
    p2pSteps: [
      'ツールバーの「Collab」ボタンをクリックします。',
      'ルーム URL が自動生成されます。',
      'URL を共同作業者に共有します。',
      'リンクを開くとセッションに参加できます。',
      '全員の変更がリアルタイムで同期されます。',
    ],
    howItWorksTitle: '仕組み',
    howItWorksDesc:
      '共同編集は Yjs CRDT と WebRTC によるピアツーピア通信で実現されています。サーバーにデザインデータは保存されず、接続中のブラウザ間で直接同期されます。',
    noTraceTitle: '痕跡なし・サーバーなし・コストなし',
    noTraceDesc:
      'データは参加者のブラウザにのみ存在するため、全員がルームを退出するとデータは消えます。サーバー維持費もストレージ費用もデータ保持もありません。',
    limitationsTitle: '制限事項',
    limitations: [
      '全参加者が同時にオンラインである必要があります。オフライン同期はありません。',
      '5〜8 人程度の小規模グループに最適です。人数が多いとパフォーマンスが低下する可能性があります。',
      'ネットワーク構成によっては NAT トラバーサルの問題で接続できない場合があります。',
    ],
  },

  apiIntegration: {
    title: 'API & CLI 連携',
    betaNote:
      '[BETA] これは実験的機能です。ブリッジは localhost のみで動作し、データはメモリ上にのみ保持されます。本番環境での使用は想定していません。',
    bridgeTitle: 'Collab Bridge セットアップ',
    bridgeSetup: 'cd tools/collab-bridge && npm install && node index.js',
    restTitle: 'REST API',
    restTable: {
      headers: ['メソッド', 'エンドポイント', '説明'],
      rows: [
        { cols: ['GET', '/status', 'ブリッジの状態'] },
        { cols: ['GET', '/document', 'ドキュメント全体の JSON'] },
        { cols: ['GET', '/frames', 'フレーム一覧'] },
        { cols: ['GET', '/node/:id', 'ノードの読み取り'] },
        { cols: ['PUT', '/node/:id', 'ノードの更新（ボディ: パッチ JSON）'] },
        { cols: ['POST', '/document', 'ドキュメント全体を設定'] },
      ],
    },
    curlTitle: 'curl の例',
    curlExamples: [
      'curl http://localhost:4567/frames',
      "curl -X PUT http://localhost:4567/node/abc123 -H 'Content-Type: application/json' -d '{\"fill\":\"#ff0000\"}'",
    ],
    mcpTitle: 'Claude Code との MCP 連携',
    mcpDesc:
      'MCP（Model Context Protocol）を使って Collab Bridge を Claude Code に接続できます。以下を .mcp.json 設定に追加してください:',
    mcpConfig: JSON.stringify(
      {
        mcpServers: {
          'pencil-bridge': {
            command: 'node',
            args: ['tools/collab-bridge/index.js'],
          },
        },
      },
      null,
      2,
    ),
    claudeExampleTitle: 'Claude Code の使用例',
    claudeExampleDesc:
      'MCP を設定すると「ヘッダーの色を青に変更して」のような自然言語コマンドを実行できます。Claude Code が MCP 経由で update_node を呼び出し、変更がブラウザにリアルタイムで反映されます。',
  },

  designQuality: {
    title: 'デザイン品質',
    intro:
      'Pencil Viewer にはデザイン品質の監査とデザインドキュメントのエクスポートのためのツールが組み込まれています。',
    fiveStatesTitle: 'Five UI States 監査',
    fiveStatesDesc:
      'コマンドパレット (Cmd + Shift + P) を開き「Five UI States Audit」を実行します。ドキュメント内の各画面について、5 つの重要な UI 状態（Empty、Loading、Error、Partial、Ideal）のカバレッジを自動チェックします。',
    fiveStatesConvention:
      '検出はフレームの命名規則に基づいています。フレーム名に状態サフィックスを追加してマークします。例:「UserList - Empty」「UserList - Loading」「UserList - Error」。監査レポートでは各画面の状態の有無が表示されます。',
    designDocTitle: 'デザインドキュメントエクスポート',
    designDocDesc:
      'コマンドパレット (Cmd + Shift + P) を開き「Export Design Doc」を実行します。画面サマリーテーブル、コンポーネントツリー、カラーパレット、デザイントークンを含む Markdown ドキュメントが生成されます。出力は Notion や Markdown 対応ツールに直接インポートできます。',
    restApiTitle: 'REST API / MCP',
    restApiExamples: [
      'curl http://localhost:4567/check-ui-states',
      'curl http://localhost:4567/export-design-doc?project=MyProject&locale=ja',
    ],
    mcpToolsTitle: 'MCP ツール',
    mcpToolsDesc:
      'デザイン品質ワークフロー用の MCP ツール: check_ui_states（全画面監査）、suggest_missing_states（追加すべき状態の提案）、export_design_doc（Markdown ドキュメント生成）。',
    aiReviewTitle: 'AI デザインレビュー [BETA]',
    aiReviewDesc:
      'Pencil Viewer は Cloudflare Workers AI（Llama 3.1）と連携し、AI によるデザイン分析を提供します。デザインデータはサーバーに保存されません。完全にステートレスで $0 コストです。',
    aiReviewAccess:
      'コマンドパレット (Cmd + Shift + P) を開き「AI Design Review」を実行してレビューパネルを起動します。',
    aiReviewModesTitle: 'レビューモード',
    aiReviewModesTable: {
      headers: ['モード', '説明'],
      rows: [
        { cols: ['フルレビュー', 'レイアウト、タイポグラフィ、色、一貫性を包括的に分析'] },
        { cols: ['Five UI States', 'Empty / Loading / Error / Partial / Ideal 状態のカバレッジを確認'] },
        { cols: ['アクセシビリティ', 'コントラスト、タッチターゲット、スクリーンリーダー対応、WCAG 準拠を評価'] },
        { cols: ['クイックフィードバック', '素早い反復のための短く実用的なフィードバック'] },
      ],
    },
    aiReviewSetup:
      'この機能には Cloudflare Workers AI バックエンドが必要です。セットアップ手順は workers/ai-review/README.md を参照してください。',
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
    { id: 'collab', title: '协同编辑' },
    { id: 'api-integration', title: 'API 与 CLI 集成' },
    { id: 'design-quality', title: '设计质量' },
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
    advancedTitle: '超越查看',
    advancedItems: [
      { icon: '🎨', title: 'Vim 风格编辑', desc: '使用 hjkl 导航、EasyMotion 提示、文本对象 — 全键盘高效操作。' },
      { icon: '👥', title: 'P2P 协同编辑', desc: '分享链接即可实时协同编辑。无需服务器、无需账号。所有人离开后数据自动消失。' },
      { icon: '🤖', title: 'AI 集成 (Claude Code)', desc: '通过 REST API 或 MCP 连接 Claude Code。AI 的编辑实时显示在浏览器中。' },
      { icon: '📦', title: '导出与保存', desc: 'Cmd+S 导出编辑后的 .pen 文件。所有更改保持本地，直到你选择分享。' },
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

  collab: {
    title: '协同编辑',
    intro:
      'Pencil Viewer 支持无需服务器的浏览器端实时协同编辑。',
    p2pTitle: 'P2P 模式',
    p2pSteps: [
      '点击工具栏中的"Collab"按钮。',
      '系统自动生成唯一的房间 URL。',
      '将 URL 分享给协作者。',
      '其他人打开链接即可加入会话。',
      '所有更改在参与者之间实时同步。',
    ],
    howItWorksTitle: '工作原理',
    howItWorksDesc:
      '协同编辑基于 Yjs CRDT 和 WebRTC 点对点通信实现。服务器不存储任何设计数据，同步直接在连接的浏览器之间进行。',
    noTraceTitle: '无痕迹、无服务器、无成本',
    noTraceDesc:
      '数据仅存在于参与者的浏览器中，所有人离开房间后数据即消失。无需维护服务器，无存储费用，无数据留存。',
    limitationsTitle: '限制',
    limitations: [
      '所有参与者必须同时在线，不支持离线同步。',
      '最适合 5-8 人的小型团队。参与者过多可能导致性能下降。',
      '某些网络配置下可能存在 NAT 穿透问题导致无法连接。',
    ],
  },

  apiIntegration: {
    title: 'API 与 CLI 集成',
    betaNote:
      '[BETA] 这是实验性功能。桥接服务仅在 localhost 运行，数据仅保存在内存中，不适用于生产环境。',
    bridgeTitle: 'Collab Bridge 设置',
    bridgeSetup: 'cd tools/collab-bridge && npm install && node index.js',
    restTitle: 'REST API',
    restTable: {
      headers: ['方法', '端点', '说明'],
      rows: [
        { cols: ['GET', '/status', '桥接服务状态'] },
        { cols: ['GET', '/document', '完整文档 JSON'] },
        { cols: ['GET', '/frames', '画框列表'] },
        { cols: ['GET', '/node/:id', '读取节点'] },
        { cols: ['PUT', '/node/:id', '更新节点（请求体: 补丁 JSON）'] },
        { cols: ['POST', '/document', '设置完整文档'] },
      ],
    },
    curlTitle: 'curl 示例',
    curlExamples: [
      'curl http://localhost:4567/frames',
      "curl -X PUT http://localhost:4567/node/abc123 -H 'Content-Type: application/json' -d '{\"fill\":\"#ff0000\"}'",
    ],
    mcpTitle: 'Claude Code MCP 集成',
    mcpDesc:
      '您可以通过 MCP（模型上下文协议）将 Collab Bridge 连接到 Claude Code。请将以下内容添加到 .mcp.json 配置中:',
    mcpConfig: JSON.stringify(
      {
        mcpServers: {
          'pencil-bridge': {
            command: 'node',
            args: ['tools/collab-bridge/index.js'],
          },
        },
      },
      null,
      2,
    ),
    claudeExampleTitle: 'Claude Code 示例',
    claudeExampleDesc:
      '配置 MCP 后，您可以使用"将标题颜色改为蓝色"等自然语言命令。Claude Code 将通过 MCP 调用 update_node，更改会实时反映在浏览器中。',
  },

  designQuality: {
    title: '设计质量',
    intro:
      'Pencil Viewer 内置了设计质量审计和设计文档导出工具。',
    fiveStatesTitle: 'Five UI States 审计',
    fiveStatesDesc:
      '打开命令面板 (Cmd + Shift + P) 并运行"Five UI States Audit"。这将检查文档中每个画面的五种关键 UI 状态覆盖情况：Empty、Loading、Error、Partial 和 Ideal。',
    fiveStatesConvention:
      '检测基于画框命名规则。在画框名称后添加状态后缀来标记，例如"UserList - Empty"、"UserList - Loading"、"UserList - Error"。审计报告会显示每个画面已有和缺失的状态。',
    designDocTitle: '设计文档导出',
    designDocDesc:
      '打开命令面板 (Cmd + Shift + P) 并运行"Export Design Doc"。生成包含画面摘要表、组件树、调色板和设计令牌的 Markdown 文档。输出可直接导入 Notion 或任何 Markdown 兼容工具。',
    restApiTitle: 'REST API / MCP',
    restApiExamples: [
      'curl http://localhost:4567/check-ui-states',
      'curl http://localhost:4567/export-design-doc?project=MyProject&locale=ja',
    ],
    mcpToolsTitle: 'MCP 工具',
    mcpToolsDesc:
      '可用于设计质量工作流的 MCP 工具：check_ui_states（审计所有画面）、suggest_missing_states（建议需要添加的状态）、export_design_doc（生成 Markdown 文档）。',
    aiReviewTitle: 'AI 设计审查 [BETA]',
    aiReviewDesc:
      'Pencil Viewer 集成了 Cloudflare Workers AI（Llama 3.1），提供 AI 驱动的设计分析。不会在服务器上存储任何设计数据，完全无状态，$0 成本。',
    aiReviewAccess:
      '打开命令面板 (Cmd + Shift + P) 并运行"AI Design Review"以启动审查面板。',
    aiReviewModesTitle: '审查模式',
    aiReviewModesTable: {
      headers: ['模式', '说明'],
      rows: [
        { cols: ['全面审查', '涵盖布局、排版、颜色和一致性的综合设计分析'] },
        { cols: ['Five UI States', '检查 Empty / Loading / Error / Partial / Ideal 状态的覆盖情况'] },
        { cols: ['无障碍性', '评估对比度、触摸目标、屏幕阅读器友好性和 WCAG 合规性'] },
        { cols: ['快速反馈', '用于快速迭代的简短可操作反馈'] },
      ],
    },
    aiReviewSetup:
      '此功能需要 Cloudflare Workers AI 后端。有关设置说明，请参阅 workers/ai-review/README.md。',
  },
};

/* ------------------------------------------------------------------ */
/*  Lookup                                                             */
/* ------------------------------------------------------------------ */

const docsContent: Record<SupportedLocale, DocsLocale> = { en, ja, zh };

export function getDocsContent(locale: SupportedLocale): DocsLocale {
  return docsContent[locale] ?? docsContent.en;
}
