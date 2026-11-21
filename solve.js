export function run({ text, header }) {
  const rows = [];
  const errors = [];
  let columns = null;
  let width = 0;
  let line = 1;
  let cursor = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const length = text.length;
  const quotedToken = /["\r\n]/g;

  while (cursor < length) {
    const startLine = line;
    const row = header && columns === null ? null : rows.length;
    const fields = [];

    for (;;) {
      let value = '';
      let closed = false;
      let junk = false;
      if (text.charCodeAt(cursor) === 34) {
        let segment = cursor + 1;
        let quotedLines = 0;
        quotedToken.lastIndex = segment;
        let match;
        while ((match = quotedToken.exec(text)) !== null) {
          const index = match.index;
          if (match[0] === '"') {
            value += text.slice(segment, index);
            if (text.charCodeAt(index + 1) !== 34) {
              cursor = index + 1;
              line += quotedLines;
              closed = true;
              break;
            }
            value += '"';
            segment = index + 2;
            quotedToken.lastIndex = segment;
          } else {
            value += text.slice(segment, index) + '\n';
            quotedLines++;
            segment = index + (match[0] === '\r' && text.charCodeAt(index + 1) === 10 ? 2 : 1);
            quotedToken.lastIndex = segment;
          }
        }
        if (!closed) {
          errors.push({ code: 'unterminated_quote', line: startLine, row });
          value = '';
        }
      }

      let delimiter;
      for (;;) {
        let end = cursor;
        while (end < length) {
          delimiter = text.charCodeAt(end);
          if (delimiter === 44 || delimiter === 10 || delimiter === 13) break;
          end++;
        }
        junk ||= closed && end > cursor;
        value += text.slice(cursor, end);
        cursor = end;
        if (end === length || delimiter !== 13 || text.charCodeAt(cursor + 1) === 10) break;
        errors.push({ code: 'stray_cr', line: startLine, row });
        cursor++;
      }
      if (junk) errors.push({ code: 'quote_junk', line: startLine, row });
      if (cursor < length && delimiter === 44) {
        fields.push(value);
        cursor++;
        continue;
      }
      if (closed || value.length || fields.length) fields.push(value);
      if (cursor < length) {
        cursor += delimiter === 13 ? 2 : 1;
        line++;
      }
      break;
    }

    const count = fields.length;
    if (!count) continue;
    if (row === null) {
      columns = fields;
      width = count;
    } else {
      if (!width) width = count;
      if (count < width) {
        errors.push({ code: 'short_row', line: startLine, row, fields: count });
        while (fields.length < width) fields.push('');
      } else if (count > width) {
        const extra = fields.slice(width);
        fields.length = width;
        errors.push({ code: 'long_row', line: startLine, row, extra });
      }
      rows.push(fields);
    }
  }

  return { columns: header ? columns ?? [] : null, rows, errors };
}
