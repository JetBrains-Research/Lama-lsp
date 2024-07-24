/* eslint-disable no-prototype-builtins */
import { SymbolTable, SymbolTables } from './SymbolTable';
import { DefaultScope as Scope, SymbolClass } from './Scope';
import { CstNode, ILexingResult, IToken } from 'chevrotain';
import { LamaParser } from './parser';
import { DefinitionVisitor } from './def_visitor';
import { ReferenceVisitor } from './ref_visitor';
import { HoverVisitor } from './hover';
import { readFile, findPath } from './path-utils';
import { Range, MarkupContent, Location, SymbolKind } from 'vscode-languageserver';
import { DiagnosticSeverity } from 'vscode-languageserver/node';

export function setSymbolTable(symbolTables: SymbolTables, filePath: string, input?: string): void {
    if (input === undefined) {
        input = readFile(filePath) || undefined;
    }
    removeImportedBy(symbolTables, filePath);
    if (input) {
        const parser = new LamaParser();
        const initNode = parser.parse(input);
        symbolTables.updateParseErrors(filePath, parser.errors);
        // if(parser.errors.length > 0) {
        //     console.log(`Parse error in file ${filePath}: `, parser.errors);
        // }

        const publicScope = new Scope();
        const privateScope = new Scope(publicScope);
        const defVisitor = new DefinitionVisitor('file://' + filePath, publicScope, privateScope, input);
        defVisitor.visit(initNode, privateScope);
        // const symbolTable = new SymbolTable(publicScope);
        // symbolTable.imports = initNode.children.UIdentifier?.map((element) => (element as IToken).image);

        const refVisitor = new ReferenceVisitor('file://' + filePath);
        refVisitor.visit(initNode);
        const defNames = privateScope.getRefNames();

        for (const name of defNames) {
            const locs = privateScope.getReferences(name);
            if (locs?.length == 1) {
                const r = locs[0].range;
                const t = privateScope.get(name)?.symboltype == 3 ? 'Function' : 'Variable';
                if(r) {
                    publicScope.addUsageWarning({
                                severity: DiagnosticSeverity.Warning,
                                range: r,
                                message: `${t} initialized, but never used.`,
                                source: 'lama-lsp'
                            });
                }
            }
        }

        const symbolTable = new SymbolTable(publicScope);
        symbolTable.imports = initNode.children.UIdentifier?.map((element) => (element as IToken).image);


/*         const hoverVisitor = new HoverVisitor('file://' + filePath);
        hoverVisitor.visit(initNode); */    

        symbolTables.updateLexResult(filePath, parser.lexingResult);
        symbolTables.updatePT(filePath, initNode);
        symbolTables.updateST(filePath, symbolTable);
        addImportedBy(symbolTables, filePath);
    }
}

export function setParseTree(symbolTables: SymbolTables, filePath: string, input?: string): void {
    if (input === undefined) {
        input = readFile(filePath) || undefined;
    }
    removeImportedBy(symbolTables, filePath);
    if (input) {
        const parser = new LamaParser();
        const initNode = parser.parse(input);

        const publicScope = new Scope();
        const symbolTable = new SymbolTable(publicScope);
        symbolTable.imports = initNode.children.UIdentifier?.map((element) => (element as IToken).image);

        symbolTables.updateLexResult(filePath, parser.lexingResult);
        symbolTables.updatePT(filePath, initNode);
        symbolTables.updateST(filePath, symbolTable);
        addImportedBy(symbolTables, filePath);
    }
}

export function findDefScope(name: string, path: string, symbolTables: SymbolTables, scope?: Scope): Scope | undefined {
    if (!scope) {
        scope = symbolTables.getST(path)?.publicScope;
    }
    while (scope !== undefined) {
        if (scope.has(name)) {
            return scope;
        }
        scope = scope.parent;
    }
    const imports = symbolTables.getST(path)?.imports;
    if (imports) {
        for (const moduleName of imports) {
            const modulePath = findPath(moduleName, path);
            scope = symbolTables.getST(modulePath)?.publicScope;
            if (scope?.has(name)) {
                return scope;
            }
        }
    }
    return undefined;
}

export function findFileWithName(name: string, symbolTables: SymbolTables): string | undefined {
    for (const filePath of Object.keys(symbolTables.getSymbolTables()) ) {
        if(symbolTables.getST(filePath)?.publicScope.has(name)) {
            return filePath;
        }
    }
    return undefined;
}

export function collectNames(path: string, symbolTables: SymbolTables, scope?: Scope): {[name: string]: SymbolClass} {
    let names: {[name: string]: SymbolClass} = {};
    if (!scope) {
        scope = symbolTables.getST(path)?.publicScope;
    }
    while (scope !== undefined) {
        names = {...names, ... scope.getNames()};
        // names.push(...scope.getNames());
        scope = scope.parent;
    }
    const imports = symbolTables.getST(path)?.imports;
    if (imports) {
        for (const moduleName of imports) {
            const modulePath = findPath(moduleName, path);
            scope = symbolTables.getST(modulePath)?.publicScope;
            if (scope){
                names = {...names, ... scope.getNames()};
                // names.push(...scope.getNames());
            }
        }
    }
    return names;
}

export function findScopeInFile(token: any): Scope | undefined {
    const name = token.image;
    let scope = token.scope;
    while (scope.parent !== undefined) {
        if (scope.has(name)) {
            return scope;
        }
        scope = scope.parent;
    }
    return scope;
}

export function findPublicScope(token: any): Scope {
    let scope = token.scope;
    while (scope.parent !== undefined) {
        scope = scope.parent;
    }
    return scope;
}

export function computeToken(node: /* any */ CstNode | undefined, offset: number): any /* IToken | undefined */ {
    if(node) {
        for (const key in node.children) {
            const element = node.children[key];
            for (let i = 0; i < element.length; i++) {
                if (element[i].hasOwnProperty("location") && inside(offset, (element[i] as CstNode).location)) {
                    return computeToken((element[i] as CstNode), offset);
                }
                else {
                    if (inside(offset, element[i]) && element[i].hasOwnProperty("image")/* && element[i].scope */) {
                        return element[i];
                    }
                }
            }
        }
    }
    return undefined;
}

export function computeFArgs(node: CstNode, offset: number): any /* IToken | undefined */ {
    for (const key in node.children) {
        const element = node.children[key];
        for (let i = 0; i < element.length; i++) {
            if((element[i] as CstNode).name == "postfixCall" && inside(offset, (element[i] as CstNode).location)) {
                // console.log('detected fArgs: ', element[i]);
                return element[i];
            }
            if (element[i].hasOwnProperty("location") && inside(offset, (element[i] as CstNode).location)) {
                return computeFArgs((element[i] as CstNode), offset);
            }
            else {
                if (inside(offset, element[i]) && (element[i] as any).scope) {
                    return undefined;
                }
            }
        }
    }
    return undefined;
}

export function getHoveredInfo(lexResult: IToken[] | undefined, line: number): string {
	const hoveredInfo = '';
    if(lexResult && lexResult.length > 0) {
		let max = lexResult?.length - 1;
		let min = 0;
		while(max - min > 0) {
			const cur = Math.floor((max + min) / 2);
			if (lexResult[cur].endLine! < line) {
                min = cur + 1;
            }
            else {
                max = cur;
            }
		}
        if(lexResult[max].endLine == line) {
            if(lexResult[max].endLine == lexResult[max].startLine) {
                return lexResult[max].image.slice(2,);
            }
            else {
                return lexResult[max].image.slice(2,-3);
            }
        }
	}
	return hoveredInfo;
}

export function findRecoveredNode(childNode: CstNode | IToken, parentNode?: CstNode | IToken): {n: CstNode, s: string}[] {
    // const foundNodes: CstNode[] = [];
    const foundNodes: {n: any/*CstNode*/, s: string}[] = [];

    // if (isCstNode(node) && node.recoveredNode) {
    //     if (!hasRecoveredChildren(node)) {
    //         foundNodes.push(node);
    //     }
    // }

    // if (isCstNode(node) && node.children) {
    //     for (const key in node.children) {
    //         const childNodes = node.children[key].filter(isCstNode);
    //         for (const childNode of childNodes) {
    //             const childResult = findRecoveredNode(childNode);
    //             foundNodes.push(...childResult);
    //         }
    //     }
    // }
    if (isCstNode(childNode)) {
        if (/* childNode.recoveredNode &&  */isNaN(childNode.location?.startOffset ?? 0)) {
            // const breaker = findRecoveredChild(node);
            foundNodes.push({n: parentNode, s: childNode.name});
        }

        else if (childNode.recoveredNode) {
            foundNodes.push({n: childNode, s: childNode.name});
        }
    
        else if (childNode.children) {
            for (const key in childNode.children) {
                // const childNodes = node.children[key].filter(isCstNode);
                for (const node of childNode.children[key]) {
                    const childResult = findRecoveredNode(node, childNode);
                    foundNodes.push(...childResult);
                }
            }
        }
    }

    else if('isInsertedInRecovery' in childNode) {
        foundNodes.push({n: parentNode, s: (childNode as any).tokenType.name});
        // foundNodes.push({n: parentNode, s: childNode.image});
    }

    return foundNodes;
}

function findRecoveredChild(node: CstNode): CstNode {
    while(hasRecoveredChildren(node)) {
        for(const key in node.children) {
            for(const child of node.children[key].filter(isCstNode)) {
                if(child.recoveredNode) {
                    node = child;
                    break;
                }
            }
        }
    }
    return node;
}

export function CSTtoVSRange(node: CstNode): Range {
    return {
        start: { line: node.location?.startLine ? node.location.startLine - 1 : 0, character: node.location?.startColumn ? node.location.startColumn - 1 : 0 },
        end: { line: node.location?.endLine ? node.location.endLine - 1 : 0, character: node.location?.endColumn ?? 0 }
    };
}

export function ITokentoVSRange(token: IToken): Range {
    return {
        start: { line: token.startLine? token.startLine - 1 : 0, character: token.startColumn? token.startColumn - 1 : 0 },
        end: { line: token.endLine? token.endLine - 1 : 0, character: token.endColumn? token.endColumn : 0 }
    };
}


function hasRecoveredChildren(node: CstNode): boolean {
    for (const key in node.children) {
        const childNodes = node.children[key].filter(isCstNode);
        for (const childNode of childNodes) {
            if (childNode.recoveredNode) {
                return true;
            }
        }
    }
    return false;
}

export function removeImportedBy(symbolTables: SymbolTables, path: string): void {
    const imports = symbolTables.getST(path)?.imports;
    for (const moduleName of imports ?? []) {
        const modulePath = findPath(moduleName, path);
        symbolTables.importedBy[modulePath].delete(path);
    }
}

export function addImportedBy(symbolTables: SymbolTables, path: string): void {
    const imports = symbolTables.getST(path)?.imports;
    for (const moduleName of imports ?? []) {
        const modulePath = findPath(moduleName, path);
        if (symbolTables.importedBy[modulePath]) {
            symbolTables.importedBy[modulePath].add(path);
        } else {
            symbolTables.importedBy[modulePath] = new Set([path]);
        }
    }
}

export type LocationDictionary = {
    [key: string]: Location;
};

export function parseInterfaceFile(path: string): LocationDictionary {
    const input = readFile(path);
    const regex = /[,;]([^,;]+)[,;]/g;
    const identifiers: Set<string> = new Set();
    const locations: LocationDictionary = {};
    if(input) {
        let lineindex = 0;
        const lines = input.trim().split('\n');

        lines.forEach((line) => {
            let match;
            while ((match = regex.exec(line)) !== null) {
                if (match[1]) {
                    const id = match[1].trim();
                    if(id.startsWith('"') && id.endsWith('"')) {
                        identifiers.add(id.slice(1, -1));
                        locations[id.slice(1, -1)] = Location.create("file://" + path, 
                                        Range.create(
                                            {line: lineindex, character: line.indexOf(id) + 1}, 
                                            {line: lineindex, character: line.indexOf(id) + id.length - 1}));
                    } else {
                        identifiers.add(id);
                        locations[id] = Location.create("file://" + path, 
                                        Range.create(
                                            {line: lineindex, character: line.indexOf(id)}, 
                                            {line: lineindex, character: line.indexOf(id) + id.length}));
                    }
                }
            }
            lineindex+=1;
        });
        // console.log(identifiers);
    } else {
        console.log("problem with reading path: " + path);
    }
    return locations;
}

function isCstNode(node: CstNode | IToken): node is CstNode {
    return 'children' in node;
}

function isIToken(token: CstNode | IToken): token is IToken {
    return 'image' in token;
}

function inside(offset: number, range: any/* CstNodeLocation | IToken */): boolean {
    if (range.endOffset) {
        if (offset >= range.startOffset && offset <= range.endOffset + 1) {
            return true;
        }
    }
    return false;
}