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

import { computeToken, findDefScope, findScopeInFile, setSymbolTable, removeImportedBy, addImportedBy, ITokentoVSRange, getHoveredInfo, parseInterfaceFile, LocationDictionary, setParseTree, computeFArgs, collectNames, findFileWithName } from './go-to-definition';
import { ensurePath, findInterfaceFiles, findLamaFiles, findPath } from './path-utils';
import { Location, TextEdit, Range, Position, MarkupContent, MarkupKind, WorkspaceEdit, DocumentUri, HandlerResult, SignatureHelpParams, SignatureHelp, SymbolKind } from 'vscode-languageserver';
import { SymbolTables } from './SymbolTable';
import * as fs from 'fs';
import { IToken } from 'chevrotain';
import { handleParseErrors } from './parse_errors';
import { printTextDocument } from './printer_combinators/printing_visitor';
import { updateDefaultWidth } from './printer_combinators/formatList';

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
	findInterfaceFiles()?.forEach((filePath) => { LAMA_STD_DICT = parseInterfaceFile(filePath); });
	LAMA_STD = new Set(Object.keys(LAMA_STD_DICT));
	findLamaFiles()?.forEach((filePath) => { setSymbolTable(symbolTables, filePath); });
	connection.window.showInformationMessage('Initialization done.');
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number,
	maxFormatWidth: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000, maxFormatWidth: 125 };
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

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	const filePath = ensurePath(change.document.uri);
	setSymbolTable(symbolTables, filePath, change.document.getText());
	symbolTables.getST(filePath)?.imports?.forEach(importName => {
		const importPath = findPath(importName, filePath);
		if(fs.existsSync(importPath)) {
			setSymbolTable(symbolTables, importPath);
		}
	});
	validateFile(filePath, true);
});

function validateFile(filePath: string, alsoImported?: boolean) {
	const diagnostics: Diagnostic[] = [];
	checkDefinitions(filePath, diagnostics);
	findParseErrors(filePath, diagnostics);
	checkImports(filePath, diagnostics);
	checkNumArgs(filePath, diagnostics);
	findNonUsage(filePath, diagnostics);
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
}

function findParseErrors(filePath: string, diagnostics: Diagnostic[]) {
	const initNode = symbolTables.getPT(filePath);
	if (initNode) {
		handleParseErrors(symbolTables.getParseErrors(filePath) ?? []).forEach(d => {diagnostics.push(d);});
	}
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

function findNonUsage(filePath: string, diagnostics: Diagnostic[]) {
	const pScope = symbolTables.getST(filePath)?.publicScope;
	pScope?.getUsageWarnings()?.forEach(warning => diagnostics.push(warning));
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

connection.onDefinition((params) => {
	const uri = params.textDocument.uri;
	const document = documents.get(uri);
	if (document !== undefined) {
		const pos = params.position;
		const offset = document.offsetAt(pos);
		const path = ensurePath(uri);
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
	const settings = await getDocumentSettings(params.textDocument.uri);
	const width = settings.maxFormatWidth;
	updateDefaultWidth(width);
    if (textDocument) {
		const filePath = ensurePath(params.textDocument.uri);
		let formattedText = "";
		const initNode = symbolTables.getPT(filePath);
		if(initNode) {
			try {
				formattedText = printTextDocument(initNode, filePath, symbolTables.getLexResult(filePath)?.groups['comments']);	
			} catch (error) {
				connection.window.showErrorMessage(`Impossible to format the file with a maximum line width of ${width}. Try increasing the 'maxFormatWidth' setting.`);
				return undefined;
			}
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
					};
				}
			}
		}
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

connection.onSignatureHelp(params => {
	const document = documents.get(params.textDocument.uri);
	const filePath = ensurePath(params.textDocument.uri);
	const activeSH = params.context?.activeSignatureHelp;
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
																					 insertText: ntype.symboltype == CompletionItemKind.Function ? name+'()' : name}));
			}
			response.push({label: 'if-expression', insertText: 'if _ then _ else _ fi', kind: CompletionItemKind.Keyword});
			response.push({label: 'case-expression', insertText: 'case _ of \n	_ -> _ \nesac', kind: CompletionItemKind.Keyword});
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

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
