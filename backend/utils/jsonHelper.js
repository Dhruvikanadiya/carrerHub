const fs = require('fs');
const path = require('path');

/**
 * State-machine based JSON repair for LLM outputs.
 * Correctly repairs:
 * - Trailing commas before } and ] (e.g. [1, 2, ])
 * - Single-quoted keys and values ('key': 'val')
 * - Unquoted object keys (title: "val")
 * - Smart curly quotes (“ ” ’)
 * - JavaScript comments (// ... and /* ... * /)
 * - Literal newlines/tabs inside strings
 * - Truncated JSON (balances unclosed braces/brackets)
 */
function stateMachineRepair(input) {
  if (!input || typeof input !== 'string') return '';

  let src = input.trim();

  // Normalize smart quotes
  src = src.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

  let out = '';
  let i = 0;
  const len = src.length;
  const stack = []; // tracks '}' or ']' expected

  while (i < len) {
    const ch = src[i];

    // 1. Skip single-line comments // ...
    if (ch === '/' && src[i + 1] === '/') {
      while (i < len && src[i] !== '\n' && src[i] !== '\r') {
        i++;
      }
      continue;
    }

    // 2. Skip multi-line comments /* ... */
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < len && !(src[i] === '*' && src[i + 1] === '/')) {
        i++;
      }
      i += 2;
      continue;
    }

    // 3. String literals (double or single quoted)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += '"'; // always output standard double quote
      i++;
      let escaped = false;
      while (i < len) {
        const sc = src[i];
        if (escaped) {
          out += sc;
          escaped = false;
          i++;
          continue;
        }
        if (sc === '\\') {
          out += '\\';
          escaped = true;
          i++;
          continue;
        }
        if (sc === quote) {
          out += '"';
          i++;
          break;
        }
        // If single-quoted string contains literal double quote, escape it
        if (quote === "'" && sc === '"') {
          out += '\\"';
        } else if (sc === '\n') {
          out += '\\n';
        } else if (sc === '\r') {
          out += '\\r';
        } else if (sc === '\t') {
          out += '\\t';
        } else {
          out += sc;
        }
        i++;
      }
      continue;
    }

    // 4. Object open
    if (ch === '{') {
      stack.push('}');
      out += '{';
      i++;
      continue;
    }

    // 5. Array open
    if (ch === '[') {
      stack.push(']');
      out += '[';
      i++;
      continue;
    }

    // 6. Object close
    if (ch === '}') {
      if (stack.length && stack[stack.length - 1] === '}') {
        stack.pop();
      }
      out += '}';
      i++;
      continue;
    }

    // 7. Array close
    if (ch === ']') {
      if (stack.length && stack[stack.length - 1] === ']') {
        stack.pop();
      }
      out += ']';
      i++;
      continue;
    }

    // 8. Commas: drop trailing comma before } or ]
    if (ch === ',') {
      let nextPos = i + 1;
      while (nextPos < len) {
        const nc = src[nextPos];
        if (nc === '/' && src[nextPos + 1] === '/') {
          while (nextPos < len && src[nextPos] !== '\n' && src[nextPos] !== '\r') nextPos++;
        } else if (nc === '/' && src[nextPos + 1] === '*') {
          nextPos += 2;
          while (nextPos < len && !(src[nextPos] === '*' && src[nextPos + 1] === '/')) nextPos++;
          nextPos += 2;
        } else if (/\s/.test(nc)) {
          nextPos++;
        } else {
          break;
        }
      }

      const nextToken = src[nextPos];
      // If trailing comma before } or ], DROP THIS COMMA!
      if (nextToken === '}' || nextToken === ']' || nextPos >= len) {
        i++;
        continue;
      }

      out += ',';
      i++;
      continue;
    }

    // 9. Unquoted keys: e.g. key: -> "key":
    if (stack.length && stack[stack.length - 1] === '}' && /[a-zA-Z_$]/.test(ch)) {
      let p = i;
      while (p < len && /[a-zA-Z0-9_$-]/.test(src[p])) {
        p++;
      }
      let colonP = p;
      while (colonP < len && /\s/.test(src[colonP])) {
        colonP++;
      }
      if (src[colonP] === ':') {
        const keyName = src.slice(i, p);
        out += `"${keyName}"`;
        i = p;
        continue;
      }
    }

    out += ch;
    i++;
  }

  let repaired = out.trim();
  // Strip trailing comma before closing any remaining brackets
  repaired = repaired.replace(/,\s*$/, '');

  // Balance any unclosed brackets if truncated
  while (stack.length) {
    const closeChar = stack.pop();
    repaired = repaired.replace(/,\s*$/, '');
    repaired += closeChar;
  }

  return repaired;
}

function extractAndParseJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Response is empty or not a string');
  }

  let cleaned = text.trim();

  // 1. Strip markdown code fences if present
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();
  }

  // 2. Find outer JSON boundaries
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  let endChar = '}';

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endChar = '}';
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endChar = ']';
  }

  if (startIdx !== -1) {
    const lastIdx = cleaned.lastIndexOf(endChar);
    if (lastIdx > startIdx) {
      cleaned = cleaned.slice(startIdx, lastIdx + 1);
    } else {
      cleaned = cleaned.slice(startIdx);
    }
  }

  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    throw new Error('No JSON object or array found in AI output');
  }

  // Pass 1: Try direct parse (fast path)
  try {
    return JSON.parse(cleaned);
  } catch (err1) {
    // Pass 2: State-machine repair (handles trailing commas, unquoted keys, single quotes, etc.)
    try {
      const repaired = stateMachineRepair(cleaned);
      return JSON.parse(repaired);
    } catch (err2) {
      // Pass 3: Regex fallback
      try {
        let fallback = cleaned
          .replace(/\/\/[^\n\r]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
        while (/,\s*([}\]])/.test(fallback)) {
          fallback = fallback.replace(/,\s*([}\]])/g, '$1');
        }
        return JSON.parse(fallback);
      } catch (err3) {
        // Log to file for diagnostics
        try {
          fs.writeFileSync(
            path.join(__dirname, '..', 'ai_error_dump.log'),
            `=== DATE ===\n${new Date().toISOString()}\n\n=== RAW TEXT ===\n${text}\n\n=== CLEANED ===\n${cleaned}\n\n=== ERR1 ===\n${err1.message}\n\n=== ERR2 ===\n${err2.message}\n\n=== ERR3 ===\n${err3.message}\n`
          );
        } catch (_) {}

        throw new Error(`The AI returned an invalid JSON response (${err2.message || err1.message}).`);
      }
    }
  }
}

module.exports = {
  stateMachineRepair,
  extractAndParseJson
};
