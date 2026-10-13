// ─────────────────────────────────────────────────────────────────────────────
// OhmScript Parser — Recursive-descent parser producing an AST
// ─────────────────────────────────────────────────────────────────────────────

import {
  Token,
  TokenType,
  OhmScriptAST,
  ASTNode,
  DirectiveNode,
  ComponentNode,
  PlacementNode,
  WireNode,
  SetNode,
  ProbeNode,
  ComponentOption,
  DiagnosticMessage,
} from './types';
import { tokenize } from './lexer';

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private errors: DiagnosticMessage[] = [];
  private nodes: ASTNode[] = [];

  constructor(tokens: Token[], lexErrors: DiagnosticMessage[] = []) {
    this.tokens = tokens;
    this.errors = [...lexErrors];
  }

  // ── Token Navigation ─────────────────────────────────────────────────────
  private peek(): Token {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: '', line: 0, col: 0 };
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  private expect(type: TokenType, context: string): Token | null {
    const t = this.peek();
    if (t.type === type) {
      return this.advance();
    }
    this.errors.push({
      severity: 'error',
      message: `Expected ${type} in ${context}, got '${t.value}' (${t.type})`,
      line: t.line,
      col: t.col,
    });
    return null;
  }

  private skipNewlines(): void {
    while (this.peek().type === TokenType.NEWLINE) {
      this.advance();
    }
  }

  private skipToNextLine(): void {
    while (this.peek().type !== TokenType.NEWLINE && this.peek().type !== TokenType.EOF) {
      this.advance();
    }
    if (this.peek().type === TokenType.NEWLINE) this.advance();
  }

  // ── Main Parse Loop ───────────────────────────────────────────────────────
  parse(): OhmScriptAST {
    while (this.peek().type !== TokenType.EOF) {
      this.skipNewlines();
      if (this.peek().type === TokenType.EOF) break;

      const t = this.peek();

      // Directives
      if (this.isDirective(t.type)) {
        this.parseDirective();
      }
      // Component declarations
      else if (this.isComponentKeyword(t.type)) {
        this.parseComponent();
      }
      // Commands
      else if (t.type === TokenType.KW_PLACE) {
        this.parsePlacement();
      }
      else if (t.type === TokenType.KW_WIRE) {
        this.parseWire();
      }
      else if (t.type === TokenType.KW_SET) {
        this.parseSet();
      }
      else if (t.type === TokenType.KW_PROBE) {
        this.parseProbe();
      }
      else if (t.type === TokenType.NEWLINE) {
        this.advance();
      }
      else {
        this.errors.push({
          severity: 'error',
          message: `Unexpected token '${t.value}' at start of statement`,
          line: t.line,
          col: t.col,
        });
        this.skipToNextLine();
      }
    }

    return { nodes: this.nodes, errors: this.errors };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private isDirective(type: TokenType): boolean {
    return [
      TokenType.DIR_CIRCUIT, TokenType.DIR_DESCRIPTION, TokenType.DIR_AUTHOR,
      TokenType.DIR_VERSION, TokenType.DIR_BOARD, TokenType.DIR_TEMP,
      TokenType.DIR_SIM, TokenType.DIR_PROBE_MODE,
    ].includes(type);
  }

  private isComponentKeyword(type: TokenType): boolean {
    return [
      TokenType.KW_BAT, TokenType.KW_RES, TokenType.KW_LED, TokenType.KW_POT,
      TokenType.KW_BULB, TokenType.KW_SPK, TokenType.KW_SW, TokenType.KW_CAP,
      TokenType.KW_IND, TokenType.KW_IC555, TokenType.KW_SEG7,
      TokenType.KW_DIODE, TokenType.KW_NPN, TokenType.KW_PNP,
      TokenType.KW_MOSFET, TokenType.KW_LDR, TokenType.KW_LM358, TokenType.KW_MB102,
    ].includes(type);
  }

  private directiveName(type: TokenType): DirectiveNode['name'] {
    const map: Record<string, DirectiveNode['name']> = {
      [TokenType.DIR_CIRCUIT]: 'circuit',
      [TokenType.DIR_DESCRIPTION]: 'description',
      [TokenType.DIR_AUTHOR]: 'author',
      [TokenType.DIR_VERSION]: 'version',
      [TokenType.DIR_BOARD]: 'board',
      [TokenType.DIR_TEMP]: 'temp',
      [TokenType.DIR_SIM]: 'sim',
      [TokenType.DIR_PROBE_MODE]: 'probe_mode',
    };
    return map[type] || 'circuit';
  }

  private componentTypeName(type: TokenType): string {
    const map: Record<string, string> = {
      [TokenType.KW_BAT]: 'bat',
      [TokenType.KW_RES]: 'res',
      [TokenType.KW_LED]: 'led',
      [TokenType.KW_POT]: 'pot',
      [TokenType.KW_BULB]: 'bulb',
      [TokenType.KW_SPK]: 'spk',
      [TokenType.KW_SW]: 'sw',
      [TokenType.KW_CAP]: 'cap',
      [TokenType.KW_IND]: 'ind',
      [TokenType.KW_IC555]: 'ic555',
      [TokenType.KW_SEG7]: 'seg7',
      [TokenType.KW_DIODE]: 'diode',
      [TokenType.KW_NPN]: 'npn',
      [TokenType.KW_PNP]: 'pnp',
      [TokenType.KW_MOSFET]: 'mosfet',
      [TokenType.KW_LDR]: 'ldr',
      [TokenType.KW_LM358]: 'lm358',
      [TokenType.KW_MB102]: 'mb102',
    };
    return map[type] || 'unknown';
  }

  // ── Parse Directive ───────────────────────────────────────────────────────
  private parseDirective(): void {
    const dir = this.advance();
    const name = this.directiveName(dir.type);
    let value = '';

    const next = this.peek();
    if (next.type === TokenType.STRING) {
      value = this.advance().value;
    } else if (next.type === TokenType.NUMBER || next.type === TokenType.VALUE_WITH_UNIT) {
      value = this.advance().value;
    } else if (next.type === TokenType.IDENTIFIER) {
      value = this.advance().value;
    } else {
      this.errors.push({
        severity: 'error',
        message: `Expected value after directive @${name}`,
        line: dir.line,
        col: dir.col,
      });
      this.skipToNextLine();
      return;
    }

    this.nodes.push({
      kind: 'directive',
      name,
      value,
      loc: { line: dir.line, col: dir.col },
    } as DirectiveNode);
  }

  // ── Parse Component ───────────────────────────────────────────────────────
  private parseComponent(): void {
    const typeToken = this.advance();
    const compType = this.componentTypeName(typeToken.type);
    const loc = { line: typeToken.line, col: typeToken.col };

    // Component ID
    const idToken = this.peek();
    if (idToken.type !== TokenType.IDENTIFIER) {
      this.errors.push({
        severity: 'error',
        message: `Expected component ID after '${compType}'`,
        line: typeToken.line,
        col: typeToken.col,
      });
      this.skipToNextLine();
      return;
    }
    const id = this.advance().value;

    // Primary value (required for most types, optional for ic555/seg7)
    let primaryValue = '';
    const pv = this.peek();
    if (pv.type === TokenType.VALUE_WITH_UNIT || pv.type === TokenType.NUMBER || pv.type === TokenType.IDENTIFIER) {
      primaryValue = this.advance().value;
    }

    // Optional key=value options until end of line
    const options: ComponentOption[] = [];
    while (this.peek().type !== TokenType.NEWLINE && this.peek().type !== TokenType.EOF) {
      const opt = this.peek();

      // key=value pattern
      if (opt.type === TokenType.IDENTIFIER || opt.type === TokenType.VALUE_WITH_UNIT) {
        const keyOrFlag = this.advance().value;

        if (this.peek().type === TokenType.EQUALS) {
          this.advance(); // consume =
          const val = this.peek();
          if (val.type === TokenType.VALUE_WITH_UNIT || val.type === TokenType.NUMBER || val.type === TokenType.IDENTIFIER || val.type === TokenType.STRING) {
            options.push({ key: keyOrFlag, value: this.advance().value });
          } else {
            this.errors.push({
              severity: 'error',
              message: `Expected value after '${keyOrFlag}='`,
              line: val.line,
              col: val.col,
            });
            this.skipToNextLine();
            break;
          }
        } else {
          // Flag option (e.g., "electrolytic", "ceramic", "tactile", "toggle")
          options.push({ key: keyOrFlag, value: 'true' });
        }
      } else {
        break;
      }
    }

    this.nodes.push({
      kind: 'component',
      componentType: compType,
      id,
      primaryValue,
      options,
      loc,
    } as ComponentNode);
  }

  // ── Parse Placement ───────────────────────────────────────────────────────
  private parsePlacement(): void {
    const placeToken = this.advance(); // consume 'place'
    const loc = { line: placeToken.line, col: placeToken.col };

    const idToken = this.expect(TokenType.IDENTIFIER, 'place statement');
    if (!idToken) { this.skipToNextLine(); return; }
    const componentId = idToken.value;

    // Location: "bench" | "E15-E19" | "E10:E11:E12"
    // Consume all tokens until NEWLINE to build location string
    let location = '';
    while (this.peek().type !== TokenType.NEWLINE && this.peek().type !== TokenType.EOF) {
      const t = this.advance();
      location += t.value;
    }

    if (!location) {
      this.errors.push({
        severity: 'error',
        message: `Expected placement location for '${componentId}'`,
        line: loc.line,
        col: loc.col,
      });
      return;
    }

    this.nodes.push({
      kind: 'placement',
      componentId,
      location: location.trim(),
      loc,
    } as PlacementNode);
  }

  // ── Parse Wire ────────────────────────────────────────────────────────────
  private parseWire(): void {
    const wireToken = this.advance(); // consume 'wire'
    const loc = { line: wireToken.line, col: wireToken.col };

    // FROM endpoint: could be "BAT1.pos" or "TOP_POS_10" or "A15"
    const from = this.parseEndpoint('wire from');
    if (!from) { this.skipToNextLine(); return; }

    // Arrow ->
    if (!this.expect(TokenType.ARROW, 'wire statement')) {
      this.skipToNextLine();
      return;
    }

    // TO endpoint
    const to = this.parseEndpoint('wire to');
    if (!to) { this.skipToNextLine(); return; }

    // Optional color
    let color: string | undefined;
    const next = this.peek();
    if (next.type === TokenType.IDENTIFIER) {
      color = this.advance().value;
    } else if (next.type === TokenType.COLOR_HEX) {
      color = this.advance().value;
    }

    this.nodes.push({
      kind: 'wire',
      from,
      to,
      color,
      loc,
    } as WireNode);
  }

  private parseEndpoint(context: string): string | null {
    const t = this.peek();
    if (t.type !== TokenType.IDENTIFIER) {
      this.errors.push({
        severity: 'error',
        message: `Expected hole or component.pin identifier in ${context}`,
        line: t.line,
        col: t.col,
      });
      return null;
    }
    let endpoint = this.advance().value;

    // Check for dot notation: BAT1.pos
    if (this.peek().type === TokenType.DOT) {
      this.advance(); // consume .
      const pin = this.peek();
      if (pin.type === TokenType.IDENTIFIER) {
        endpoint += '.' + this.advance().value;
      }
    }

    return endpoint;
  }

  // ── Parse Set ─────────────────────────────────────────────────────────────
  private parseSet(): void {
    const setToken = this.advance(); // consume 'set'
    const loc = { line: setToken.line, col: setToken.col };

    // Target: "POT1.wiper"
    const target = this.parseEndpoint('set target');
    if (!target) { this.skipToNextLine(); return; }

    // Value
    const val = this.peek();
    let value = '';
    if (val.type === TokenType.NUMBER || val.type === TokenType.VALUE_WITH_UNIT || val.type === TokenType.IDENTIFIER) {
      value = this.advance().value;
    } else {
      this.errors.push({
        severity: 'error',
        message: `Expected value after 'set ${target}'`,
        line: val.line,
        col: val.col,
      });
      this.skipToNextLine();
      return;
    }

    this.nodes.push({
      kind: 'set',
      target,
      value,
      loc,
    } as SetNode);
  }

  // ── Parse Probe ───────────────────────────────────────────────────────────
  private parseProbe(): void {
    const probeToken = this.advance(); // consume 'probe'
    const loc = { line: probeToken.line, col: probeToken.col };

    const colorToken = this.peek();
    if (colorToken.type !== TokenType.IDENTIFIER) {
      this.errors.push({
        severity: 'error',
        message: `Expected 'red' or 'black' after 'probe'`,
        line: colorToken.line,
        col: colorToken.col,
      });
      this.skipToNextLine();
      return;
    }
    const probeColor = this.advance().value.toLowerCase();
    if (probeColor !== 'red' && probeColor !== 'black') {
      this.errors.push({
        severity: 'warning',
        message: `Probe color should be 'red' or 'black', got '${probeColor}'`,
        line: colorToken.line,
        col: colorToken.col,
      });
    }

    const holeToken = this.peek();
    if (holeToken.type !== TokenType.IDENTIFIER) {
      this.errors.push({
        severity: 'error',
        message: `Expected hole ID after 'probe ${probeColor}'`,
        line: holeToken.line,
        col: holeToken.col,
      });
      this.skipToNextLine();
      return;
    }
    const holeId = this.advance().value;

    this.nodes.push({
      kind: 'probe',
      probeColor: probeColor as 'red' | 'black',
      holeId,
      loc,
    } as ProbeNode);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────
export function parse(source: string): OhmScriptAST {
  const { tokens, errors } = tokenize(source);
  const parser = new Parser(tokens, errors);
  return parser.parse();
}
