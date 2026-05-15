const fs = require('fs');
const path = require('path');
const dir = 'js';

const importMap = {
  'collaboration.js': { utils: ['escHtml', 'escAttr'] },
  'demo-template.js': { utils: ['escHtml', 'escAttr', 'taskProgress', 'formatLastEdit'] },
  'detail-renderer.js': { utils: ['escHtml', 'escAttr', 'taskProgress', 'formatLastEdit'] },
  'drag.js': { utils: ['getScale'] },
  'export.js': { utils: ['escHtml', 'escAttr'], sync: ['updateTabBadges'] },
  'onboarding.js': { utils: ['escHtml', 'escAttr'] },
  'overview-renderer.js': { utils: ['escHtml', 'escAttr', 'taskProgress'] },
  'place-room.js': { utils: ['getPointerPos', 'getScale', 'generateKey', 'detectFloorId'] },
  'presence.js': { utils: ['escHtml', 'escAttr'] },
  'projects.js': { utils: ['escHtml', 'escAttr', '_resetScaleCache'], sync: ['updateTabBadges'] },
  'renderer.js': { utils: ['escHtml', '_resetScaleCache'], sync: ['updateTabBadges'] },
  'resize.js': { utils: ['getScale'] },
  'rooms.js': { utils: ['escHtml', 'escAttr', 'generateKey'] },
  'ui.js': { utils: ['_resetScaleCache'], sync: ['updateTabBadges'] }
};

for (const [f, needs] of Object.entries(importMap)) {
  const fp = path.join(dir, f);
  let src = fs.readFileSync(fp, 'utf8');
  let orig = src;

  if (needs.utils && needs.utils.length > 0) {
    const utilsImport = "import { " + needs.utils.join(', ') + " } from './utils.js';";
    if (!src.includes("from './utils.js'")) {
      const lastImportIdx = src.lastIndexOf('import ');
      const lineEnd = src.indexOf('\n', lastImportIdx);
      src = src.slice(0, lineEnd + 1) + utilsImport + '\n' + src.slice(lineEnd + 1);
    } else {
      const existingMatch = src.match(/import \{([^}]+)\} from ['"]\.\/utils\.js['"]/);
      if (existingMatch) {
        const existing = existingMatch[1].split(',').map(s => s.trim());
        const merged = [...new Set([...existing, ...needs.utils])];
        const newImport = "import { " + merged.join(', ') + " } from './utils.js';";
        src = src.replace(/import \{[^}]+\} from ['"]\.\/utils\.js['"];?/, newImport);
      }
    }
  }

  if (needs.sync) {
    const syncImport = "import { " + needs.sync.join(', ') + " } from './sync.js';";
    if (!src.includes("from './sync.js'")) {
      const lastImportIdx = src.lastIndexOf('import ');
      const lineEnd = src.indexOf('\n', lastImportIdx);
      src = src.slice(0, lineEnd + 1) + syncImport + '\n' + src.slice(lineEnd + 1);
    }
  }

  if (src !== orig) {
    fs.writeFileSync(fp, src);
    console.log('Added imports to: ' + f);
  }
}

// Fix ui.js: Remove broken UI.toast/dismissToast/executeUndo assignments
let uiSrc = fs.readFileSync(path.join(dir, 'ui.js'), 'utf8');
let uiOrig = uiSrc;
uiSrc = uiSrc.replace(/\n  UI\.toast = toast;\n  UI\.dismissToast = dismissToast;\n  UI\.executeUndo = executeUndo;\n  toast = toast;\n/, '\n');
if (uiSrc !== uiOrig) {
  fs.writeFileSync(path.join(dir, 'ui.js'), uiSrc);
  console.log('Fixed ui.js UI references');
}

console.log('Done');