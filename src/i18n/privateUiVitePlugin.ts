import path from 'node:path';
import ts from '@typescript/old';
import type { Block, Expression, Node as TsNode, SourceFile, StringLiteral } from '@typescript/old';
import type { Plugin } from 'vite';
import { isPrivateUiSourcePath, normalizePrivateUiText, privateUiMessageKey } from './privateUiCatalog.ts';

const BLOCKED_TEXT_PARENTS = new Set(['script', 'style', 'pre', 'code', 'textarea']);
const TRANSLATABLE_ATTRIBUTES = new Set(['placeholder', 'title', 'aria-label', 'aria-description', 'alt']);
const TRANSLATABLE_CALLS = new Set(['showToast', 'confirm', 'alert', 'setError', 'setFormError', 'setProfileError', 'setBookingError', 'setSupportError', 'setProfileNotice', 'setPasswordNotice', 'setSuccessMessage', 'setMessage']);

function importSpecifier(fromFile: string, targetFile: string): string {
  let relative = path.relative(path.dirname(fromFile), targetFile).replace(/\\/g, '/');
  if (!relative.startsWith('.')) relative = './' + relative;
  return relative;
}

function containsJsx(node: TsNode): boolean {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true;
  return node.getChildren().some(containsJsx);
}

function callName(node: Expression): string {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return '';
}

function hasNamedImport(sourceFile: SourceFile, name: string): boolean {
  return sourceFile.statements.some((statement) =>
    ts.isImportDeclaration(statement)
    && statement.importClause?.namedBindings
    && ts.isNamedImports(statement.importClause.namedBindings)
    && statement.importClause.namedBindings.elements.some((element) => element.name.text === name));
}

export function privateUiTranslationPlugin(): Plugin {
  return {
    name: 'awesome-private-ui-translation',
    enforce: 'pre',
    transform(code, id) {
      const filePath = id.split('?')[0];
      if (!isPrivateUiSourcePath(filePath)) return null;

      const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) as SourceFile;
      const edits: Array<{ start: number; end: number; value: string }> = [];
      const componentBodies = new Set<Block>();
      let usesLocalizedText = false;
      let usesLocalizedValue = false;
      let usesHookTranslator = false;

      const addHook = (body?: Block) => {
        if (body) {
          componentBodies.add(body);
          usesHookTranslator = true;
        }
      };

      const translateLiteral = (node: StringLiteral, componentBody?: Block, jsxAttribute = false) => {
        if (!componentBody || !node.text.trim() || !/\p{L}/u.test(node.text)) return;
        const key = privateUiMessageKey(node.text);
        edits.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          value: jsxAttribute ? `{__privateUiT(${JSON.stringify(key)}, ${JSON.stringify(node.text)})}` : `__privateUiT(${JSON.stringify(key)}, ${JSON.stringify(node.text)})`,
        });
        addHook(componentBody);
      };

      const translateMessageBranches = (node: TsNode, componentBody?: Block): void => {
        if (ts.isStringLiteral(node)) { translateLiteral(node, componentBody); return; }
        if (ts.isConditionalExpression(node)) {
          translateMessageBranches(node.whenTrue, componentBody);
          translateMessageBranches(node.whenFalse, componentBody);
          return;
        }
        if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.BarBarToken || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
          translateMessageBranches(node.right, componentBody);
        }
      };

      const visit = (node: TsNode, blocked = false, componentBody?: Block, jsxChild = false): void => {
        if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text)) {
          const owner = node.body && ts.isBlock(node.body) ? node.body : componentBody;
          ts.forEachChild(node, child => visit(child, blocked, owner));
          return;
        }

        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^[A-Z]/.test(node.name.text)) {
          const initializer = node.initializer;
          if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
            const owner = ts.isBlock(initializer.body) ? initializer.body : componentBody;
            ts.forEachChild(node, child => visit(child, blocked, owner));
            return;
          }
        }

        if (ts.isJsxElement(node)) {
          const tagName = node.openingElement.tagName.getText(sourceFile).toLowerCase();
          visit(node.openingElement, blocked, componentBody);
          node.children.forEach(child => visit(child, blocked || BLOCKED_TEXT_PARENTS.has(tagName), componentBody, true));
          return;
        }

        if (ts.isJsxFragment(node)) {
          node.children.forEach(child => visit(child, blocked, componentBody, true));
          return;
        }

        if (ts.isJsxExpression(node) && jsxChild && !blocked && node.expression && !containsJsx(node.expression)) {
          const expression = node.expression.getText(sourceFile);
          edits.push({
            start: node.getStart(sourceFile),
            end: node.getEnd(),
            value: `{<LocalizedValue value={${expression}} />}`,
          });
          usesLocalizedValue = true;
          return;
        }

        if (ts.isJsxText(node) && !blocked) {
          const message = normalizePrivateUiText(node.text);
          if (message.trim() && /\p{L}/u.test(message)) {
            const key = privateUiMessageKey(message);
            edits.push({
              start: node.getStart(sourceFile),
              end: node.getEnd(),
              value: `{<LocalizedText messageKey={${JSON.stringify(key)}} fallback={${JSON.stringify(message)}} />}`,
            });
            usesLocalizedText = true;
          }
          return;
        }

        if (ts.isJsxAttribute(node) && TRANSLATABLE_ATTRIBUTES.has(node.name.getText(sourceFile))) {
          const initializer = node.initializer;
          if (initializer && ts.isStringLiteral(initializer)) translateLiteral(initializer, componentBody, true);
        }

        if (ts.isCallExpression(node) && TRANSLATABLE_CALLS.has(callName(node.expression)) && node.arguments.length) {
          translateMessageBranches(node.arguments[0], componentBody);
        }

        if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Error' && node.arguments?.length && ts.isStringLiteral(node.arguments[0])) {
          translateLiteral(node.arguments[0], componentBody);
        }

        ts.forEachChild(node, child => visit(child, blocked, componentBody));
      };

      visit(sourceFile);
      for (const body of componentBodies) {
        const position = body.getStart(sourceFile) + 1;
        edits.push({ start: position, end: position, value: '\n  const __privateUiT = useLanguage().t;\n' });
      }

      if (!edits.length) return null;
      edits.sort((a, b) => b.start - a.start);
      let transformed = code;
      for (const edit of edits) transformed = transformed.slice(0, edit.start) + edit.value + transformed.slice(edit.end);

      const imports: string[] = [];
      if (usesLocalizedText && !hasNamedImport(sourceFile, 'LocalizedText')) {
        const target = path.resolve(process.cwd(), 'src/components/common/LocalizedText.tsx');
        imports.push(`import { LocalizedText } from ${JSON.stringify(importSpecifier(filePath, target))};`);
      }
      if (usesLocalizedValue && !hasNamedImport(sourceFile, 'LocalizedValue')) {
        const target = path.resolve(process.cwd(), 'src/components/common/LocalizedValue.tsx');
        imports.push(`import { LocalizedValue } from ${JSON.stringify(importSpecifier(filePath, target))};`);
      }
      if (usesHookTranslator && !hasNamedImport(sourceFile, 'useLanguage')) {
        const target = path.resolve(process.cwd(), 'src/contexts/LanguageContext.tsx');
        imports.push(`import { useLanguage } from ${JSON.stringify(importSpecifier(filePath, target))};`);
      }
      return { code: imports.join('\n') + '\n' + transformed, map: null };
    },
  };
}
