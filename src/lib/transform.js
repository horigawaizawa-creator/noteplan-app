export function splitNonEmptyLines(content) {
  return (content || '').split('\n').filter((l) => l.trim() !== '');
}

export function getIndentLevel(line) {
  const match = line.match(/^[ \t]*/)[0];
  let width = 0;
  for (const ch of match) {
    width += ch === '\t' ? 4 : 1;
  }
  return Math.floor(width / 2);
}

function cleanText(rawLine) {
  const text = rawLine.trim().replace(/^[-*•]\s+/, '');
  return text || 'Без назви';
}

// Builds a nested block tree from indented lines (2 spaces / 1 tab per level).
export function linesToBlocks(lines, makeId) {
  const root = [];
  const stack = [];
  lines.forEach((rawLine) => {
    const level = getIndentLevel(rawLine);
    const block = { id: makeId(), text: cleanText(rawLine), stageId: null, deadline: null, children: [] };
    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(block);
    } else {
      stack[stack.length - 1].block.children.push(block);
    }
    stack.push({ level, block });
  });
  return root;
}

// Builds a flat (non-hierarchical) list of plan items, ignoring indentation.
export function linesToFlatItems(lines, makeId) {
  return lines.map((rawLine) => ({ id: makeId(), text: cleanText(rawLine), stageId: null, deadline: null }));
}

// ---- Reverse direction: structured data -> plain text lines ----
export function blocksToLines(blocks, depth = 0) {
  let lines = [];
  for (const b of blocks) {
    lines.push('  '.repeat(depth) + b.text);
    lines = lines.concat(blocksToLines(b.children, depth + 1));
  }
  return lines;
}

export function itemsToLines(items) {
  return items.map((i) => i.text);
}
