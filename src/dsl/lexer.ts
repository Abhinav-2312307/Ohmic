// ─────────────────────────────────────────────────────────────────────────────
// OhmScript Lexer — Tokenizer with line/column tracking
// ─────────────────────────────────────────────────────────────────────────────

import {
  Token,
  TokenType,
  COMPONENT_KEYWORDS,
  COMMAND_KEYWORDS,
  DiagnosticMessage,
} from './types';

export interface LexResult {
  tokens: Token[];
  errors: DiagnosticMessage[];
}

const DIRECTIVE_MAP: Record<string, TokenType> = {
  '@circuit':     TokenType.DIR_CIRCUIT,
  '@description': TokenType.DIR_DESCRIPTION,
  '@desc':        TokenType.DIR_DESCRIPTION,
  '@author':      TokenType.DIR_AUTHOR,
  '@version':     TokenType.DIR_VERSION,
  '@board':       TokenType.DIR_BOARD,
  '@temp':        TokenType.DIR_TEMP,
  '@sim':         TokenType.DIR_SIM,
  '@probe_mode':  TokenType.DIR_PROBE_MODE,
};

// Match values like: 9V, 470Ω, 0.25W, 100uF, 10mH, 10k, 4.7k, 100nF
const VALUE_UNIT_REGEX = /^(\d+\.?\d*)(V|Ω|W|uF|µF|nF|pF|mH|H|k|K|M)$/;

export function tokenize(source: string): LexResult {
  const tokens: Token[] = [];
  const errors: DiagnosticMessage[] = [];
  const lines = source.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNum = lineIdx + 1;
    let col = 0;

    // Skip empty lines and comments
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      tokens.push({ type: TokenType.NEWLINE, value: '\n', line: lineNum, col: 0 });
      continue;
    }

    while (col < line.length) {
      // Skip whitespace
      if (line[col] === ' ' || line[col] === '\t') {
        col++;
        continue;
      }

      // Inline comment — skip rest of line
      if (line[col] === '#') {
        break;
      }

      const startCol = col + 1; // 1-indexed

      // Arrow ->
      if (line[col] === '-' && col + 1 < line.length && line[col + 1] === '>') {
        tokens.push({ type: TokenType.ARROW, value: '->', line: lineNum, col: startCol });
        col += 2;
        continue;
      }

      // Dash -
      if (line[col] === '-') {
        tokens.push({ type: TokenType.DASH, value: '-', line: lineNum, col: startCol });
        col++;
        continue;
      }

      // Colon :
      if (line[col] === ':') {
        tokens.push({ type: TokenType.COLON, value: ':', line: lineNum, col: startCol });
        col++;
        continue;
      }

      // Dot .
      if (line[col] === '.') {
        tokens.push({ type: TokenType.DOT, value: '.', line: lineNum, col: startCol });
        col++;
        continue;
      }

      // Equals =
      if (line[col] === '=') {
        tokens.push({ type: TokenType.EQUALS, value: '=', line: lineNum, col: startCol });
        col++;
        continue;
      }

      // String literal "..."
      if (line[col] === '"') {
        col++;
        let str = '';
        while (col < line.length && line[col] !== '"') {
          if (line[col] === '\\' && col + 1 < line.length) {
            str += line[col + 1];
            col += 2;
          } else {
            str += line[col];
            col++;
          }
        }
        if (col < line.length) col++; // skip closing quote
        tokens.push({ type: TokenType.STRING, value: str, line: lineNum, col: startCol });
        continue;
      }

      // Color hex #xxxxxx
      if (line[col] === '#' && col + 1 < line.length && /[0-9a-fA-F]/.test(line[col + 1])) {
        let hex = '#';
        col++;
        while (col < line.length && /[0-9a-fA-F]/.test(line[col])) {
          hex += line[col];
          col++;
        }
        tokens.push({ type: TokenType.COLOR_HEX, value: hex, line: lineNum, col: startCol });
        continue;
      }

      // Directive @keyword
      if (line[col] === '@') {
        let directive = '@';
        col++;
        while (col < line.length && /[a-zA-Z_]/.test(line[col])) {
          directive += line[col];
          col++;
        }
        const dirType = DIRECTIVE_MAP[directive.toLowerCase()];
        if (dirType) {
          tokens.push({ type: dirType, value: directive, line: lineNum, col: startCol });
        } else {
          errors.push({
            severity: 'error',
            message: `Unknown directive '${directive}'`,
            line: lineNum,
            col: startCol,
            endCol: startCol + directive.length,
          });
        }
        continue;
      }

      // Number, Value+Unit, or Part Identifier starting with digit (e.g. 9V, 470Ω, 100uF, 1N4148, 2N2222)
      if (/[0-9]/.test(line[col])) {
        let text = '';
        while (col < line.length && /[0-9a-zA-Z_Ωµ]/.test(line[col])) {
          text += line[col];
          col++;
        }
        if (VALUE_UNIT_REGEX.test(text)) {
          tokens.push({ type: TokenType.VALUE_WITH_UNIT, value: text, line: lineNum, col: startCol });
        } else if (/^[0-9]+(\.[0-9]+)?$/.test(text)) {
          tokens.push({ type: TokenType.NUMBER, value: text, line: lineNum, col: startCol });
        } else {
          // Part numbers or identifiers starting with digit (e.g. 1N4148, 1N4007, 2N2222, 74HC595)
          tokens.push({ type: TokenType.IDENTIFIER, value: text, line: lineNum, col: startCol });
        }
        continue;
      }

      // Identifier or Keyword (alphanumeric starting with letter or _)
      if (/[a-zA-Z_]/.test(line[col])) {
        let word = '';
        while (col < line.length && /[a-zA-Z0-9_]/.test(line[col])) {
          word += line[col];
          col++;
        }

        const lower = word.toLowerCase();

        // Check component keywords
        if (COMPONENT_KEYWORDS[lower]) {
          tokens.push({ type: COMPONENT_KEYWORDS[lower], value: word, line: lineNum, col: startCol });
        }
        // Check command keywords
        else if (COMMAND_KEYWORDS[lower]) {
          tokens.push({ type: COMMAND_KEYWORDS[lower], value: word, line: lineNum, col: startCol });
        }
        // Regular identifier
        else {
          tokens.push({ type: TokenType.IDENTIFIER, value: word, line: lineNum, col: startCol });
        }
        continue;
      }

      // Unknown character
      errors.push({
        severity: 'error',
        message: `Unexpected character '${line[col]}'`,
        line: lineNum,
        col: startCol,
      });
      col++;
    }

    tokens.push({ type: TokenType.NEWLINE, value: '\n', line: lineNum, col: line.length + 1 });
  }

  tokens.push({ type: TokenType.EOF, value: '', line: lines.length + 1, col: 0 });
  return { tokens, errors };
}

export class Lexer {
  constructor(private source: string) {}

  tokenize(): Token[] {
    return tokenize(this.source).tokens;
  }

  tokenizeWithErrors(): LexResult {
    return tokenize(this.source);
  }
}
