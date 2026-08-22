/**
 * Formula Parser for SpreadsheetViewer
 * Parses Excel formulas into an AST for evaluation
 */

import * as XLSX from 'xlsx';

// Token types
export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'CELL_REF'
  | 'RANGE'
  | 'FUNCTION'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'COMPARISON'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// AST Node types
export type ASTNodeType =
  | 'NumberLiteral'
  | 'StringLiteral'
  | 'CellReference'
  | 'RangeReference'
  | 'BinaryExpression'
  | 'FunctionCall'
  | 'UnaryExpression';

export interface ASTNode {
  type: ASTNodeType;
  value?: string | number;
  raw?: string;
  left?: ASTNode;
  right?: ASTNode;
  operator?: string;
  arguments?: ASTNode[];
  name?: string;
  start?: { r: number; c: number };
  end?: { r: number; c: number };
}

export interface ParseResult {
  ast: ASTNode | null;
  error: string | null;
  isFormula: boolean;
}

// Check if a string is a formula
export function isFormula(value: string): boolean {
  return value.startsWith('=') || value.startsWith('+') || value.startsWith('-');
}

// Tokenizer
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  const str = input.trim();

  while (pos < str.length) {
    const char = str[pos];

    // Skip whitespace
    if (/\s/.test(char)) {
      pos++;
      continue;
    }

    // Numbers (including decimals)
    if (/\d/.test(char) || (char === '.' && /\d/.test(str[pos + 1]))) {
      let num = '';
      while (pos < str.length && /[\d.]/.test(str[pos])) {
        num += str[pos];
        pos++;
      }
      tokens.push({ type: 'NUMBER', value: num, position: pos - num.length });
      continue;
    }

    // Strings (quoted)
    if (char === '"') {
      let strVal = '';
      pos++; // Skip opening quote
      while (pos < str.length && str[pos] !== '"') {
        if (str[pos] === '\\' && pos + 1 < str.length) {
          strVal += str[++pos];
        } else {
          strVal += str[pos];
        }
        pos++;
      }
      pos++; // Skip closing quote
      tokens.push({ type: 'STRING', value: strVal, position: pos - strVal.length - 2 });
      continue;
    }

    // Cell references (A1, AA123, etc.) and ranges (A1:B10)
    if (/[A-Za-z]/.test(char)) {
      let ident = '';
      const startPos = pos;
      while (pos < str.length && /[A-Za-z0-9$]/.test(str[pos])) {
        ident += str[pos];
        pos++;
      }

      // Check for range (followed by :)
      if (str[pos] === ':') {
        const leftRef = ident;
        pos++; // Skip :
        let rightIdent = '';
        while (pos < str.length && /[A-Za-z0-9$]/.test(str[pos])) {
          rightIdent += str[pos];
          pos++;
        }
        tokens.push({ type: 'RANGE', value: `${leftRef}:${rightIdent}`, position: startPos });
      } else {
        // Check if it's a function (followed by parenthesis)
        if (str[pos] === '(') {
          tokens.push({ type: 'FUNCTION', value: ident.toUpperCase(), position: startPos });
        } else {
          tokens.push({ type: 'CELL_REF', value: ident.toUpperCase(), position: startPos });
        }
      }
      continue;
    }

    // Operators
    if ('+-*/%^'.includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char, position: pos });
      pos++;
      continue;
    }

    // Comparison operators
    if (char === '=' || (char === '<' && ['=', '>'].includes(str[pos + 1])) ||
        (char === '>' && ['=', '<'].includes(str[pos + 1]))) {
      let op = char;
      if (str[pos + 1] === '=') {
        op += '=';
        pos++;
      } else if (str[pos + 1] === '<' || str[pos + 1] === '>') {
        op = char + str[++pos];
      }
      tokens.push({ type: 'COMPARISON', value: op, position: pos });
      pos++;
      continue;
    }

    // Parentheses
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(', position: pos });
      pos++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')', position: pos });
      pos++;
      continue;
    }

    // Comma
    if (char === ',') {
      tokens.push({ type: 'COMMA', value: ',', position: pos });
      pos++;
      continue;
    }

    // Unknown character - skip
    pos++;
  }

  tokens.push({ type: 'EOF', value: '', position: pos });
  return tokens;
}

// Parser class
class FormulaParser {
  private tokens: Token[] = [];
  private pos = 0;

  parse(input: string): ParseResult {
    // Remove leading = or + or -
    const formula = input.replace(/^[=+-]+/, '');

    if (!formula.trim()) {
      return { ast: null, error: 'Empty formula', isFormula: false };
    }

    try {
      this.tokens = tokenize(formula);
      this.pos = 0;
      const ast = this.expression();

      if (this.current().type !== 'EOF') {
        return { ast: null, error: 'Unexpected token', isFormula: true };
      }

      return { ast, error: null, isFormula: true };
    } catch (e) {
      return { ast: null, error: (e as Error).message, isFormula: true };
    }
  }

  private current(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: '', position: 0 };
  }

  private consume(type?: TokenType): Token {
    const token = this.current();
    if (type && token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type}`);
    }
    this.pos++;
    return token;
  }

  private expression(): ASTNode {
    return this.comparison();
  }

  private comparison(): ASTNode {
    let left = this.addition();

    while (this.current().type === 'COMPARISON') {
      const op = this.consume().value;
      const right = this.addition();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        raw: `${left.raw || left.value}${op}${right.raw || right.value}`
      };
    }

    return left;
  }

  private addition(): ASTNode {
    let left = this.multiplication();

    while (this.current().type === 'OPERATOR' && ['+', '-'].includes(this.current().value)) {
      const op = this.consume().value;
      const right = this.multiplication();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        raw: `${left.raw || left.value}${op}${right.raw || right.value}`
      };
    }

    return left;
  }

  private multiplication(): ASTNode {
    let left = this.power();

    while (this.current().type === 'OPERATOR' && ['*', '/', '%'].includes(this.current().value)) {
      const op = this.consume().value;
      const right = this.power();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        raw: `${left.raw || left.value}${op}${right.raw || right.value}`
      };
    }

    return left;
  }

  private power(): ASTNode {
    let left = this.unary();

    while (this.current().type === 'OPERATOR' && this.current().value === '^') {
      const op = this.consume().value;
      const right = this.unary();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        raw: `${left.raw || left.value}^${right.raw || right.value}`
      };
    }

    return left;
  }

  private unary(): ASTNode {
    if (this.current().type === 'OPERATOR' && this.current().value === '-') {
      this.consume();
      const operand = this.unary();
      return {
        type: 'UnaryExpression',
        operator: '-',
        right: operand,
        raw: `-${operand.raw || operand.value}`
      };
    }
    return this.primary();
  }

  private primary(): ASTNode {
    const token = this.current();

    // Number
    if (token.type === 'NUMBER') {
      this.consume();
      return { type: 'NumberLiteral', value: parseFloat(token.value), raw: token.value };
    }

    // String
    if (token.type === 'STRING') {
      this.consume();
      return { type: 'StringLiteral', value: token.value, raw: `"${token.value}"` };
    }

    // Cell reference
    if (token.type === 'CELL_REF') {
      this.consume();
      const parsed = XLSX.utils.decode_cell(token.value);
      return {
        type: 'CellReference',
        name: token.value,
        start: parsed,
        raw: token.value
      };
    }

    // Range
    if (token.type === 'RANGE') {
      this.consume();
      const [start, end] = token.value.split(':').map((v) => v.toUpperCase());
      return {
        type: 'RangeReference',
        name: token.value,
        start: XLSX.utils.decode_cell(start),
        end: XLSX.utils.decode_cell(end),
        raw: token.value
      };
    }

    // Function call
    if (token.type === 'FUNCTION') {
      const name = this.consume().value;
      this.consume('LPAREN'); // (
      const args: ASTNode[] = [];

      if (this.current().type !== 'RPAREN') {
        args.push(this.expression());
        while (this.current().type === 'COMMA') {
          this.consume();
          args.push(this.expression());
        }
      }

      this.consume('RPAREN'); // )
      return { type: 'FunctionCall', name, arguments: args, raw: `${name}()` };
    }

    // Parenthesized expression
    if (token.type === 'LPAREN') {
      this.consume();
      const expr = this.expression();
      this.consume('RPAREN');
      return expr;
    }

    throw new Error(`Unexpected token: ${token.type}`);
  }
}

// Singleton parser instance
const parser = new FormulaParser();

/**
 * Parse a formula string into an AST
 */
export function parseFormula(formula: string): ParseResult {
  if (!isFormula(formula)) {
    return { ast: null, error: null, isFormula: false };
  }
  return parser.parse(formula);
}

/**
 * Extract cell references from a formula
 */
export function extractCellRefs(formula: string): string[] {
  const refs: string[] = [];

  function traverse(node: ASTNode | null) {
    if (!node) return;

    switch (node.type) {
      case 'CellReference':
        if (node.name) refs.push(node.name);
        break;
      case 'RangeReference':
        if (node.start && node.end) {
          const [startCol, startRow] = [node.start.c, node.start.r];
          const [endCol, endRow] = [node.end.c, node.end.r];
          for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
            for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
              refs.push(XLSX.utils.encode_cell({ r, c }));
            }
          }
        }
        break;
      default:
        if (node.left) traverse(node.left);
        if (node.right) traverse(node.right);
        if (node.arguments) node.arguments.forEach(traverse);
        if (node.name) refs.push(node.name);
    }
  }

  const result = parseFormula(formula);
  traverse(result.ast);
  return [...new Set(refs)];
}

/**
 * Format a cell reference for display
 */
export function formatCellRef(r: number, c: number): string {
  return XLSX.utils.encode_cell({ r, c });
}

/**
 * Common Excel functions list for autocomplete
 */
export const EXCEL_FUNCTIONS = [
  // Math
  'SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'MAX', 'MIN', 'ABS', 'ROUND', 'ROUNDUP', 'ROUNDDOWN',
  'SUMIF', 'COUNTIF', 'AVERAGEIF', 'SUMIFS', 'COUNTIFS',
  // Text
  'CONCATENATE', 'LEFT', 'RIGHT', 'MID', 'LEN', 'UPPER', 'LOWER', 'TRIM', 'SUBSTITUTE',
  'TEXT', 'VALUE', 'CONCAT', 'TEXTJOIN',
  // Date/Time
  'TODAY', 'NOW', 'DATE', 'DAY', 'MONTH', 'YEAR', 'HOUR', 'MINUTE', 'SECOND',
  'DATEDIF', 'WEEKDAY', 'WEEKNUM', 'EDATE', 'EOMONTH',
  // Logic
  'IF', 'IFERROR', 'IFNA', 'AND', 'OR', 'NOT', 'XOR', 'TRUE', 'FALSE', 'SWITCH',
  // Lookup
  'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH', 'CHOOSE', 'LOOKUP', 'OFFSET', 'INDIRECT',
  'XLOOKUP', 'XMATCH',
  // Financial
  'PMT', 'PV', 'FV', 'NPER', 'RATE', 'NPV', 'IRR', 'PPMT', 'IPMT',
  // Information
  'ISBLANK', 'ISERROR', 'ISNA', 'ISNUMBER', 'ISTEXT', 'ISLOGICAL', 'ISREF', 'TYPE',
  'ERROR.TYPE', 'CELL', 'INFO', 'N', 'T',
] as const;

/**
 * Get autocomplete suggestions for a partial formula
 */
export function getAutocompleteSuggestions(input: string, position: number): string[] {
  const beforeCursor = input.slice(0, position);

  // Check if typing a function name
  const funcMatch = beforeCursor.match(/([A-Z]+)$/i);
  if (funcMatch) {
    const prefix = funcMatch[1].toUpperCase();
    return EXCEL_FUNCTIONS.filter(fn => fn.startsWith(prefix)).slice(0, 10);
  }

  // Check if after a function name (should suggest opening paren)
  if (beforeCursor.match(/[A-Z]+\($/i)) {
    return ['('];
  }

  // Check if typing a cell reference
  const cellMatch = beforeCursor.match(/([A-Z]+\d*)$/i);
  if (cellMatch) {
    const prefix = cellMatch[1].toUpperCase();
    // Generate possible cell references
    const suggestions: string[] = [];
    const colPrefix = prefix.match(/^[A-Z]*/)?.[0] || '';
    const rowPrefix = prefix.match(/\d*$/)?.[0] || '';

    // If typing column letters, suggest column names
    if (/^[A-Z]+$/i.test(prefix)) {
      const colNum = XLSX.utils.decode_col(prefix);
      if (colNum >= 0 && colNum < 26) {
        suggestions.push(`${prefix}1`); // Complete to row 1
      }
    }

    return suggestions;
  }

  return [];
}
