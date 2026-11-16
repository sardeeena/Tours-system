import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as ts from 'typescript-7';
import { isPrivateUiSourcePath, normalizePrivateUiText, privateUiMessageKey } from '../src/i18n/privateUiCatalog';

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, 'src');
const OUTPUT = path.join(SOURCE_ROOT, 'i18n/privateUiCatalog.generated.ts');
const BLOCKED_TEXT_PARENTS = new Set(['script', 'style', 'pre', 'code', 'textarea']);
const TRANSLATABLE_CALLS = new Set(['showToast', 'confirm', 'alert', 'setError', 'setFormError', 'setProfileError', 'setBookingError', 'setSupportError', 'setProfileNotice', 'setPasswordNotice', 'setSuccessMessage', 'setMessage']);
const TRANSLATABLE_TYPE_ALIASES = new Set(['BookingStatus', 'PaymentStatus', 'PaymentMethod']);

function containsJsx(node: ts.Node): boolean {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true;
  return node.getChildren().some(containsJsx);
}

function addMessage(message: string, messages: Map<string, string>): void {
  if (!message.trim() || !/\p{L}/u.test(message)) return;
  messages.set(privateUiMessageKey(message), message);
  if (/^[a-z][a-z_-]*$/.test(message)) {
    const titleCase = message.replace(/(^|[_-])([a-z])/g, (_match, separator, letter) => (separator ? ' ' : '') + letter.toUpperCase());
    addMessage(titleCase, messages);
    addMessage(message.toUpperCase(), messages);
  }
}

function addStringLiterals(node: ts.Node, messages: Map<string, string>): void {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    addMessage(node.text, messages);
    return;
  }
  ts.forEachChild(node, (child) => addStringLiterals(child, messages));
}

function addValueStrings(node: ts.Node, messages: Map<string, string>): void {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    addMessage(node.text, messages);
    return;
  }
  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property)) addValueStrings(property.initializer, messages);
    }
    return;
  }
  if (ts.isArrayLiteralExpression(node)) {
    node.elements.forEach((element) => addValueStrings(element, messages));
    return;
  }
  if (ts.isConditionalExpression(node)) {
    addValueStrings(node.whenTrue, messages);
    addValueStrings(node.whenFalse, messages);
  }
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) ? [fullPath] : [];
  });
}

export function collectPrivateUiMessages(): Record<string, string> {
  const messages = new Map<string, string>();
  for (const filePath of walk(SOURCE_ROOT).filter((filePath) => isPrivateUiSourcePath(filePath) || filePath.replace(/\\/g, '/').endsWith('/src/types/booking.ts')).sort()) {
    const source = readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node, blocked = false): void => {
      if (ts.isJsxElement(node)) {
        const tagName = node.openingElement.tagName.getText(sourceFile).toLowerCase();
        visit(node.openingElement, blocked);
        node.children.forEach((child) => visit(child, blocked || BLOCKED_TEXT_PARENTS.has(tagName)));
        return;
      }
      if (ts.isJsxExpression(node) && !blocked && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) && node.expression && !containsJsx(node.expression)) {
        addStringLiterals(node.expression, messages);
        return;
      }
      if (ts.isTypeAliasDeclaration(node) && TRANSLATABLE_TYPE_ALIASES.has(node.name.text) && ts.isUnionTypeNode(node.type)) {
        for (const member of node.type.types) if (ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)) addMessage(member.literal.text, messages);
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /(?:labels|options|messages|copy|text|titles)$/i.test(node.name.text) && node.initializer) {
        addValueStrings(node.initializer, messages);
      }
      if (ts.isCallExpression(node) && TRANSLATABLE_CALLS.has(ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : '') && node.arguments.length) {
        addStringLiterals(node.arguments[0], messages);
      }
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Error' && node.arguments?.length) {
        addStringLiterals(node.arguments[0], messages);
      }
      if (ts.isJsxText(node) && !blocked) {
        const message = normalizePrivateUiText(node.text);
        if (message.trim() && /\p{L}/u.test(message)) messages.set(privateUiMessageKey(message), message);
        return;
      }
      if (ts.isJsxAttribute(node) && ['placeholder', 'title', 'aria-label', 'aria-description', 'alt'].includes(node.name.getText(sourceFile))) {
        const initializer = node.initializer;
        if (initializer && ts.isStringLiteral(initializer)) {
          const message = initializer.text;
          if (message.trim() && /\p{L}/u.test(message)) messages.set(privateUiMessageKey(message), message);
        }
      }
      ts.forEachChild(node, (child) => visit(child, blocked));
    };
    visit(sourceFile);
  }
  return Object.fromEntries([...messages.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function generatePrivateUiCatalog(): number {
  const catalog = collectPrivateUiMessages();
  const content = '/* Generated by scripts/generate_private_ui_catalog.ts. Do not edit manually. */\n'
    + 'export const PRIVATE_UI_SOURCE_CATALOG: Record<string, string> = '
    + JSON.stringify(catalog, null, 2)
    + ';\n';
  writeFileSync(OUTPUT, content, 'utf8');
  return Object.keys(catalog).length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const count = generatePrivateUiCatalog();
  console.log(`Generated ${count} private customer UI translation messages.`);
}
