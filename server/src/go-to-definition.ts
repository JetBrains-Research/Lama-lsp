import { SymbolTable, SymbolTables} from './SymbolTable'
import { DefaultScope as Scope } from './Scope';
import { CstNode, IToken } from 'chevrotain';
import { LamaParser } from './parser';
import { DefinitionVisitor } from './def_visitor';
import { ReferenceVisitor } from './ref_visitor';
import { readFile, findPath} from './path-utils';

export function setSymbolTable(symbolTables: SymbolTables, filePath: string, input?: string): void {
    if(input === undefined){
        input = readFile(filePath) || undefined;
    }
    removeImportedBy(symbolTables, filePath);
    if(input) {
        const parser = new LamaParser();
        const initNode = parser.parse(input);
        
        let publicScope = new Scope();
        let privateScope = new Scope(publicScope);
        const defVisitor = new DefinitionVisitor('file://' + filePath, publicScope, privateScope);
        defVisitor.visit(initNode, privateScope);
        let symbolTable = new SymbolTable(publicScope); 
        symbolTable.imports = initNode.children.UIdentifier?.map((element) => (element as IToken).image);

        const refVisitor = new ReferenceVisitor('file://' + filePath);
        refVisitor.visit(initNode);

        symbolTables.updatePT(filePath, initNode);
        symbolTables.updateST(filePath, symbolTable);
        addImportedBy(symbolTables, filePath)
    }
}

export function findDefScope(token: any, path: string, symbolTables: SymbolTables, scope?: Scope): Scope | undefined {
    const name = token.image;
    if(!scope) {
        scope = token.scope;
    } 
    while (scope !== undefined) {
        if(scope.has(name)) {
            return scope;
        }
        scope = scope.parent;
    }
	const imports = symbolTables.getST(path)?.imports;
	if (imports) {
		for (const moduleName of imports) {
            const modulePath = findPath(moduleName, path);
            scope = symbolTables.getST(modulePath)?.publicScope;
			if(scope?.has(name)) {
				return scope;
			}
		}
	}
    return undefined;
}

export function findScopeInFile(token: any): Scope | undefined {
    const name = token.image;
    let scope = token.scope; 
    while (scope.parent !== undefined) {
        if(scope.has(name)) {
            return scope;
        }
        scope = scope.parent;
    }
    return scope;
}

export function computeToken(node: any /* CstNode */, offset: number): any /* IToken | undefined */ {
    for(const key in node.children) {
        const element = node.children[key];
        for(let i = 0; i < element.length; i++) {
            if(element[i].hasOwnProperty("location") && inside(offset, element[i].location)) {
                    return computeToken(element[i], offset);
            }
            else {
                if(inside(offset, element[i]) && element[i].scope) {
                    return element[i];
                }
            }
        }
    }
    return undefined;
}

export function findRecoveredNode(node: CstNode | IToken): CstNode[] {
    if(isCstNode(node) && node.recoveredNode) {
        return [node];
    }
    if(isCstNode(node) && node.children) {
        const foundNodes: CstNode[] = [];
        for (const key in node.children) {
            const childNodes = node.children[key].filter(isCstNode);
            for (const childNode of childNodes) {
                const childResult = findRecoveredNode(childNode);
                foundNodes.push(...childResult);
            }
        }
        return foundNodes;
    }
    return [];
}

function removeImportedBy(symbolTables: SymbolTables, path: string): void {
    const imports = symbolTables.getST(path)?.imports;
    for (const moduleName of imports ?? []) {
        const modulePath = findPath(moduleName, path);
        symbolTables.importedBy[modulePath].delete(path);
    }
}

function addImportedBy(symbolTables: SymbolTables, path: string): void {
    const imports = symbolTables.getST(path)?.imports;
    for (const moduleName of imports ?? []) {
        const modulePath = findPath(moduleName, path);
        if(symbolTables.importedBy[modulePath]) {
            symbolTables.importedBy[modulePath].add(path);
        } else {
            symbolTables.importedBy[modulePath] = new Set([path]);
        }
    }
}

function isCstNode(node: CstNode | IToken): node is CstNode {
    return 'children' in node;
}

function inside(offset: number, range: any/* CstNodeLocation | IToken */): Boolean {
    if(range.endOffset) {
        if(offset >= range.startOffset && offset <= range.endOffset + 1) {
            return true;
        }
    }
    return false;
}