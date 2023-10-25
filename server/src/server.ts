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

import { computeToken, findRecoveredNode, findDefScope, findScopeInFile, setSymbolTable } from './go-to-definition';
import { ensurePath, findLamaFiles } from './path-utils';
import { LocationLink, Location } from 'vscode-languageserver';
import { SymbolTables } from './SymbolTable';

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
			documentHighlightProvider : true
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
	findLamaFiles().forEach((filePath) => {setSymbolTable(symbolTables, filePath);});
	connection.workspace.getWorkspaceFolders().then((folders) => {
		folders?.forEach((folder) => {
			findLamaFiles(ensurePath(folder.uri)).forEach((filePath) => {setSymbolTable(symbolTables, filePath);});
		});
	});
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
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample'
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

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
	const filePath = ensurePath(change.document.uri);
	setSymbolTable(symbolTables, filePath, change.document.getText());
	checkDefinitions(filePath);
	symbolTables.importedBy[filePath].forEach(modulePath => checkDefinitions(modulePath));
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	/* const settings = await getDocumentSettings(textDocument.uri);

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
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics }); */
}

function checkDefinitions(filePath: string) {
	const pScope = symbolTables.getST(filePath)?.publicScope;
	let diagnostics: Diagnostic[] = [];
	pScope?.getRefNames().forEach((name) => {
		if(!LAMA_DEFAULTS.has(name) && !findDefScope(name, filePath, symbolTables)) {
			pScope.getReferences(name)?.forEach(location => {
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
					range: location.range,
					message: `Cannot find name '` + name + `'.`,
					source: 'lama-lsp'
				};
				diagnostics.push(diagnostic);
			});
		}
	})
	connection.sendDiagnostics({uri: 'file://' + filePath, diagnostics});
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

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
	/* console.log(symbolTables); */
	const uri = params.textDocument.uri;
	const document = documents.get(uri);
	if(document !== undefined) {
		const pos = params.position;
		const offset = document.offsetAt(pos);
		const path = ensurePath(uri);
		const initNode = symbolTables.getPT(path);
		const token = computeToken(initNode, offset);		
		if(token && token.scope) {
			const defScope = findDefScope(token.image, path, symbolTables, token.scope);           
			if(defScope) {
				const definition = defScope.get(token.image);
				if(definition) {
					const location = Location.create(definition.uri, definition.range); //TODO LocationLink[] - ??
					return location;
				}
			}
		}
	}  
	return undefined;
});

connection.onReferences((params) => {
	const uri = params.textDocument.uri;
	const document = documents.get(uri);
	if(document !== undefined) {
		const pos = params.position;
		const offset = document.offsetAt(pos);
		const filePath = ensurePath(uri);
		const initNode = symbolTables.getPT(filePath);
		const token = computeToken(initNode, offset);	
		const fileSymbolTable = symbolTables.getST(filePath);	
		if(token && token.scope) {					                    
			const defScope = findDefScope(token.image, filePath, symbolTables, token.scope);           
			if(defScope) {
				let references: Location[] = defScope.getReferences(token.image) || [];
				if(defScope === fileSymbolTable?.publicScope) {
					for(const modulePath of symbolTables.importedBy[filePath] || []) {
						if(findDefScope(token.image, modulePath, symbolTables) === defScope) {
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
	if(document !== undefined) {
		const pos = params.position;
		const offset = document.offsetAt(pos);
		const filePath = ensurePath(uri);
		const initNode = symbolTables.getPT(filePath);
		const token = computeToken(initNode, offset);
		if(token && token.scope) {					                    
			const defScope = findScopeInFile(token);           
			if(defScope) {
				return defScope.getReferences(token.image);
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
