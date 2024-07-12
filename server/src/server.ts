/* eslint-disable no-mixed-spaces-and-tabs */
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { computeToken, findRecoveredNode, findDefScope, findScopeInFile, setSymbolTable, removeImportedBy, addImportedBy, ITokentoVSRange, getHoveredInfo, parseInterfaceFile, LocationDictionary, setParseTree, computeFArgs, collectNames, findFileWithName } from './go-to-definition';
import { ensurePath, findInterfaceFiles, findLamaFiles, findPath } from './path-utils';
import { LocationLink, Location, TextEdit, Range, Position, MarkupContent, MarkupKind, WorkspaceEdit, DocumentUri, HandlerResult, SignatureHelpParams, SignatureHelp, SymbolKind } from 'vscode-languageserver';
import { SymbolTable, SymbolTables } from './SymbolTable';
import { formatTextDocument } from './formatter';
import * as fs from 'fs';
import { IToken } from 'chevrotain';
import { basename } from 'path';
import { connect } from 'http2';
import { handleParseErrors } from './parse_errors';
import { printTextDocument } from './printer_combinators/printing_visitor';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

const symbolTables = new SymbolTables();
const LAMA_DEFAULTS: Set<string> = new Set(['+', '-', '*', '/', ':=', ':', '!!', '&&', '==', '!=', '<=', '<', '>=', '>', '%']);
let LAMA_STD: Set<string>;
let LAMA_STD_DICT: LocationDictionary = {};

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			/* completionProvider: {
				resolveProvider: true
			}, */
			// Tell the client that this server supports go to definition.
			definitionProvider: true,
			referencesProvider: true,
			documentHighlightProvider: true,
			documentFormattingProvider: true,
			hoverProvider: true,
			renameProvider: true,
			signatureHelpProvider: {
				"triggerCharacters" : ['('],
				"retriggerCharacters": [',']
			},
			completionProvider: {
				"resolveProvider" : false
			},
			codeActionProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
	//TODO: cache these 2
	findInterfaceFiles()?.forEach((filePath) => { LAMA_STD_DICT = parseInterfaceFile(filePath); });
	LAMA_STD = new Set(Object.keys(LAMA_STD_DICT));
	findLamaFiles()?.forEach((filePath) => { setSymbolTable(symbolTables, filePath); });
	// await connection.workspace.getWorkspaceFolders().then(async (folders) => {
	// 	folders?.forEach((folder) => {
	// 		findLamaFiles(ensurePath(folder.uri)).forEach((filePath) => { setSymbolTable(symbolTables, filePath); });
	// 		// findLamaFiles(ensurePath(folder.uri)).forEach((filePath) => { setParseTree(symbolTables, filePath); });
	// 	});
	// });
	// await connection.workspace.getWorkspaceFolders().then(async (folders) => {
	// 	folders?.forEach((folder) => {
	// 		findLamaFiles(ensurePath(folder.uri)).forEach((filePath) => { validateFile(filePath, false); });
	// 	});
	// });
	connection.window.showInformationMessage('Initialization done.');
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerLama || defaultSettings)
		);
	}

	// Revalidate all open text documents
	/* documents.all().forEach(validateTextDocument); */
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerLama'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

/* function reparse(document: TextDocument) {
	markForReparsing(document);
	ensureParsed(document);
} */
connection.onNotification('fileRename', files => {
	const oldPath = files.oldUri.path;
	removeImportedBy(symbolTables, oldPath);
	const ST = symbolTables.getST(oldPath);
	symbolTables.deleteST(oldPath);
	const newPath = files.newUri.path;
	if (ST) {
		symbolTables.updateST(newPath, ST);
		addImportedBy(symbolTables, newPath);
	}
});

// connection.window.showErrorMessage("Cannot find lamac file");

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	// const filePath = ensurePath(change.document.uri);
	// setSymbolTable(symbolTables, filePath);
	// symbolTables.getST(filePath)?.imports?.forEach(importName => {
	// 	const importPath = findPath(importName, filePath);
	// 	if(fs.existsSync(importPath)) {
	// 		setSymbolTable(symbolTables, importPath);
	// 	}
	// });
	// validateFile(filePath, true);

	const filePath = ensurePath(change.document.uri);
	setSymbolTable(symbolTables, filePath, change.document.getText());
	symbolTables.getST(filePath)?.imports?.forEach(importName => {
		const importPath = findPath(importName, filePath);
		if(fs.existsSync(importPath)) {
			setSymbolTable(symbolTables, importPath);
		}
	});
	// console.log(symbolTables.getPT(filePath));
	// connection.sendRequest('log_info', symbolTables.getPT(filePath));
	validateFile(filePath, true);
	/* console.log(symbolTables); */
});

// documents.onDidOpen(e => {
// 	const filePath = ensurePath(e.document.uri);
// 	setSymbolTable(symbolTables, filePath);
// 	symbolTables.getST(filePath)?.imports?.forEach(importName => {
// 		const importPath = findPath(importName, filePath);
// 		if(fs.existsSync(importPath)) {
// 			setSymbolTable(symbolTables, importPath);
// 		}
// 	});
// 	validateFile(filePath, true);
// });

/* async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	const text = textDocument.getText();
	const pattern = /\b[A-Z]{2,}\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} is all uppercase.`,
			source: 'ex'
		};
		if (hasDiagnosticRelatedInformationCapability) {
			diagnostic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Spelling matters'
				},
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Particularly for names'
				}
			];
		}
		diagnostics.push(diagnostic);	
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
} */

function validateFile(filePath: string, alsoImported?: boolean) {
	const diagnostics: Diagnostic[] = [];
	checkDefinitions(filePath, diagnostics);
	findParseErrors(filePath, diagnostics);
	checkImports(filePath, diagnostics);
	checkNumArgs(filePath, diagnostics);
	if(diagnostics) {
		connection.sendDiagnostics({ uri: 'file://' + filePath, diagnostics });
	}
	if (alsoImported) {
		symbolTables.importedBy[filePath]?.forEach(modulePath => validateFile(modulePath, false));
	}
}

function checkDefinitions(filePath: string, diagnostics: Diagnostic[]) {
	const pScope = symbolTables.getST(filePath)?.publicScope;
	pScope?.getRefNames()?.forEach((name) => {
		if (!LAMA_DEFAULTS.has(name) && !LAMA_STD.has(name) && !findDefScope(name, filePath, symbolTables)) {
			pScope.getReferences(name)?.forEach(location => {
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
					range: location.range,
					message: `Cannot find name '` + name + `'.`,
					source: 'lama-lsp',
					data: name
				};
				diagnostics.push(diagnostic);
			});
		}
	});
	/* connection.sendDiagnostics({ uri: 'file://' + filePath, diagnostics }); */
}

function findParseErrors(filePath: string, diagnostics: Diagnostic[]) {
	const initNode = symbolTables.getPT(filePath);
	if (initNode) {
		// findRecoveredNode(initNode)?.forEach(x => {
		// 	const node = x.n;
		// 	const name = x.s;
		// 	if (node.location?.startLine) {
		// 		const diagnostic: Diagnostic = {
		// 			severity: DiagnosticSeverity.Error,
		// 			range: {
		// 				start: { line: node.location.startLine ? node.location.startLine - 1 : 0, character: node.location.startColumn ? node.location.startColumn - 1 : 0 },
		// 				end: { line: node.location.endLine ? node.location.endLine - 1 : 0, character: node.location.endColumn ?? 0 }
		// 			},
		// 			// range: {
		// 			// 	start: {line: 0, character: 0},
		// 			// 	end: {line: 1, character: 1}
		// 			// },
		// 			// message: `Parse error. Was expected: ` + node.name,
		// 			message: `Parse error in ${node.name}.` + (name.toUpperCase()[0] !== name[0] ? ` Was expected: ${name}` : ` Missing token: ${name}`),
		// 			source: 'lama-lsp'
		// 		};
		// 		diagnostics.push(diagnostic);
		// 	}
		// 	else if(name.toUpperCase()[0] == name[0]) {
		// 		connection.sendRequest('log_info', "found inserted token: " + name);
		// 		connection.sendRequest('log_info', "its location: " + node.location);
		// 	}
		// });
		// if(symbolTables.getParseErrors(filePath)?.length) {
		handleParseErrors(symbolTables.getParseErrors(filePath) ?? []).forEach(d => {diagnostics.push(d);});
		// }
	}
	/* connection.sendDiagnostics({ uri: 'file://' + filePath, diagnostics }); */
}

function checkImports(filePath: string, diagnostics: Diagnostic[]) {
	const importNames = symbolTables.getPT(filePath)?.children['UIdentifier'];
	importNames?.forEach(importToken => {
		if(!fs.existsSync(findPath((importToken as IToken).image, filePath)) && !((importToken as IToken).image == 'Std')) {
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: ITokentoVSRange(importToken as IToken),
				message: `Import error. Can't find module: ` + (importToken as IToken).image,
				source: 'lama-lsp'
			};
			diagnostics.push(diagnostic);
		} 
	});
}

function checkNumArgs(filePath: string, diagnostics: Diagnostic[]) {
	const pScope = symbolTables.getST(filePath)?.publicScope;
	pScope?.getArgErrors()?.forEach((argError) => { 
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
					range: argError[0],
					message: `Number of arguments: ` + argError[1] + `, but expected: ` + argError[2],
					source: 'lama-lsp'
				};
				diagnostics.push(diagnostic);
	});
	pScope?.getArgResolves()?.forEach((argResolve) => {
		const defScope = findDefScope(argResolve[0], filePath, symbolTables);
		const defArgs = defScope?.getNArgs(argResolve[0]);
		if(defScope && defArgs != argResolve[2]) {
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: argResolve[1],
				message: `Number of arguments: ` + argResolve[2] + `, but expected: ` + defArgs,
				source: 'lama-lsp'
			};
			diagnostics.push(diagnostic);
		}
	});
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

/* connection.onDidChangeTextDocument(change => {
	connection.console.log(change.contentChanges.toString());
}); */

// This handler provides the initial list of the completion items.
/* connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
); */

// This handler resolves additional information for the item selected in
// the completion list.
/* connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
); */

connection.onDefinition((params) => {
	// console.log(symbolTables);
	const uri = params.textDocument.uri;
	const document = documents.get(uri);
	if (document !== undefined) {
		const pos = params.position;
		const offset = document.offsetAt(pos);
		const path = ensurePath(uri);
		// console.log(symbolTables.getPT(path));
		// connection.sendRequest('log_info', symbolTables.getPT(path));
		const initNode = symbolTables.getPT(path);
		const token = computeToken(initNode, offset);
		if (token && token.scope) {
			const defScope = findDefScope(token.image, path, symbolTables, token.scope);
			if (defScope) {
				const definition = defScope.get(token.image);
				if (definition) {
					const location = Location.create(definition.uri, definition.range); //TODO LocationLink[] - ??
					return location;
				}
			} else if (LAMA_STD.has(token.image)) {
				return LAMA_STD_DICT[token.image];
				// return connection.sendRequest('runtimeDefinition', params);
			}
		}
	}
	return undefined;
});

connection.onReferences(async (params) => {
	const uri = params.textDocument.uri;
	const document = documents.get(uri);
	await connection.workspace.getWorkspaceFolders().then(async (folders) => {
		folders?.forEach((folder) => {
			findLamaFiles(ensurePath(folder.uri)).forEach((filePath) => {
				if(!symbolTables.getST(filePath)) {
					setSymbolTable(symbolTables, filePath);	
				}
			});
		});
	});
	if (document !== undefined) {
		const pos = params.position;
		const offset = document.offsetAt(pos);
		const filePath = ensurePath(uri);
		const initNode = symbolTables.getPT(filePath);
		const token = computeToken(initNode, offset);
		const fileSymbolTable = symbolTables.getST(filePath);
		if (token && token.scope) {
			const defScope = findDefScope(token.image, filePath, symbolTables, token.scope);
			if (defScope) {
				let references: Location[] = defScope.getReferences(token.image) || [];
				if (defScope === fileSymbolTable?.publicScope) {
					for (const modulePath of symbolTables.importedBy[filePath] || []) {
						if (findDefScope(token.image, modulePath, symbolTables) === defScope) {
							references = references.concat(symbolTables.getST(modulePath)?.publicScope.getReferences(token.image) || []);
						}
					}
				}
				return references;
			}
		}
	}
	return undefined;
});

connection.onDocumentHighlight((params) => {
	const uri = params.textDocument.uri;
	const document = documents.get(uri);
	if (document !== undefined) {
		const pos = params.position;
		const offset = document.offsetAt(pos);
		const filePath = ensurePath(uri);
		const initNode = symbolTables.getPT(filePath);
		const token = computeToken(initNode, offset);
		if (token && token.scope) {
			const defScope = findScopeInFile(token);
			if (defScope) {
				return defScope.getReferences(token.image);
			}
		}
	}
	return undefined;
});

connection.onDocumentFormatting(async(params) => {
	const textDocument = documents.get(params.textDocument.uri);
    if (textDocument) {
		const filePath = ensurePath(params.textDocument.uri);
		let formattedText = "";
		// console.log(symbolTables.getLexResult(filePath)?.groups['comments']);
		const initNode = symbolTables.getPT(filePath);
		if(initNode) {
			// console.log(collectVerticesByDistance(initNode));
			// formattedText = formatTextDocument(initNode, filePath, symbolTables.getLexResult(filePath)?.groups['comments']);
			formattedText = printTextDocument(initNode, filePath, symbolTables.getLexResult(filePath)?.groups['comments']);
		}
        const range = Range.create(Position.create(0, 0), Position.create(textDocument.getText().length, 0));
        return [TextEdit.replace(range, formattedText)];
    }
});

connection.onHover(params => {
	const document = documents.get(params.textDocument.uri);
	const filePath = ensurePath(params.textDocument.uri);
	if (document) {
		const pos = params.position;
		const offset = document.offsetAt(pos);
		const initNode = symbolTables.getPT(filePath);
		const token = computeToken(initNode, offset);
		if (token && token.scope) {
			const defScope = findDefScope(token.image, filePath, symbolTables, token.scope);
			if (defScope) {
				const funArgs = defScope.getFArgs(token.image);
				const definition = defScope.get(token.image);
				if (definition && funArgs !== undefined) {
					const comment = getHoveredInfo(symbolTables.getLexResult(ensurePath(definition?.uri))?.groups['comments'], definition?.range.start.line ?? 0);
					const markdown: MarkupContent = {
						kind: MarkupKind.Markdown,
						value: [
							'```lama',
							`fun ${token?.image} (${funArgs})`,
							'```',
							comment
						].join('\n')
					};
					return {
						contents: markdown
						// contents: `fun ${token?.image} (${funArgs}) \n${hoveredInfo.slice(2)}`,
					};
				}
			}
		}
		/* if (token?.image) {
            return {
                contents: `Hovered: ${token?.image}` ,
            };
        } */
	}
	return undefined;
});

connection.onRenameRequest(params => {
	const uri = params.textDocument.uri;
	const document = documents.get(uri);
	if (document !== undefined) {
		const pos = params.position;
		const offset = document.offsetAt(pos);
		const filePath = ensurePath(uri);
		const initNode = symbolTables.getPT(filePath);
		const token = computeToken(initNode, offset);
		const fileSymbolTable = symbolTables.getST(filePath);
		if (token && token.scope) {
			const defScope = findScopeInFile(token);
			if (defScope) {
				let references: Location[] = defScope.getReferences(token.image) || [];
				if (defScope === fileSymbolTable?.publicScope) {
					for (const modulePath of symbolTables.importedBy[filePath] || []) {
						if (findDefScope(token.image, modulePath, symbolTables) === defScope) {
							references = references.concat(symbolTables.getST(modulePath)?.publicScope.getReferences(token.image) || []);
						}
					}
				}
				const edit: WorkspaceEdit = {};
				const changes: { [uri: DocumentUri]: TextEdit[] } = {};
				references.forEach(location => {
					const tEdit: TextEdit = {range: location.range, newText: params.newName};
					if(!changes[location.uri]) {
						changes[location.uri] = [];
					}
					changes[location.uri].push(tEdit);
				});
				edit.changes = changes;
				return edit;
			}
		}
	}
	return undefined;
});

// let signatureConst = 0;

connection.onSignatureHelp(params => {
	const document = documents.get(params.textDocument.uri);
	const filePath = ensurePath(params.textDocument.uri);
	const activeSH = params.context?.activeSignatureHelp;
	// console.log(params.context?.triggerCharacter, params.context?.triggerKind, params.context?.isRetrigger);
	const pos = params.position;
	if(document) {
		const initNode = symbolTables.getPT(filePath);
		const offset = document.offsetAt(pos) - 1;
		const token = computeToken(initNode, offset);
		const callArgs = initNode ? computeFArgs(initNode, offset + 1) : undefined;
		if (document && !params.context?.isRetrigger) {
			if (token && token.scope) {
				const defScope = findDefScope(token.image, filePath, symbolTables, token.scope);
				if (defScope) {
					const funArgs = defScope.getFArgs(token.image);
					const definition = defScope.get(token.image);
					const signature_label = funArgs ?? 'failed_signature';
					const response: SignatureHelp = {signatures: [{label: signature_label, 
																documentation: getHoveredInfo(symbolTables.getLexResult(ensurePath(definition?.uri ?? ''))?.groups['comments'], definition?.range.start.line ?? 0),
																parameters: signature_label.split(',').map(p => ({ label: p.trim()}))
																}], activeParameter: 0};
					return response;
				}
			}
		}
		else if(activeSH && callArgs) {
			return {...activeSH,
				activeParameter: callArgs.children?.Comma?.length ?? 0};
		}
		else if(params.context?.triggerCharacter == ')') {
			return undefined;
		}
		return undefined;
	}
});

connection.onCompletion(params => {
	const document = documents.get(params.textDocument.uri);
	const filePath = ensurePath(params.textDocument.uri);
	if (document) {
		const offset = document.offsetAt(params.position);
		const initNode = symbolTables.getPT(filePath);
		const token = computeToken(initNode, offset);
		if (token) {
			let response: CompletionItem[] = [];
			if(token.scope) {
				const sufficientNames = collectNames(filePath, symbolTables, token.scope);	
				response = Object.entries(sufficientNames).map(([name, ntype]) => ({ label: name, 
																					 kind: ntype.symboltype, 
																					 insertText: ntype.symboltype == CompletionItemKind.Function ? name+'() {\n\n}' : name}));
			}
			response.push({label: 'if-expression', insertText: 'if _ then _ else _ fi', kind: CompletionItemKind.Keyword});
			response.push({label: 'case-expression', insertText: 'case _ of \n	_ -> _ \nesac', kind: CompletionItemKind.Keyword});
			// if (TOKEN_DEFAULTS.has(token.image)) {
			// 	response.push(handleDefaultToken(token.image));
			// }
			return response;
		}
	}
	return undefined;
});

connection.onCodeAction(params => {
	if(params.context.diagnostics.length > 0) {
		const name = params.context.diagnostics[0].data;
		if(name) {
			connection.workspace.getWorkspaceFolders().then((folders) => {
					folders?.forEach((folder) => {
						findLamaFiles(ensurePath(folder.uri)).forEach((filePath) => { setSymbolTable(symbolTables, filePath); });
					});
				});
			// console.log(symbolTables);
			const nameFilePath = findFileWithName(name, symbolTables);
			const moduleFile = nameFilePath?.split('/').pop();
			if(moduleFile) {
				const moduleName = moduleFile.split('.')[0];
				return [{title: `Add import of '${moduleName}' module?`,
						 kind: 'quickfix',
						 diagnostics: params.context.diagnostics,
						 edit: {
							changes: { // Example of a possible edit
								[params.textDocument.uri]: [{
									range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
									newText: `import ${moduleName};\n`
								}]
							}
						}}];
			}
		}
	}
	return undefined;
});

// connection.onCompletionResolve(params => {
// 	const document = documents.get(params.textDocument.uri);
// 	const filePath = ensurePath(params.textDocument.uri);
// 	return undefined;
// });

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
