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

import {
	LamaParser
} from './parser';

import { findDefinition, PositionToRange, fictiveRange, computeToken} from './go-to-definition';
import { LocationLink, Location, DocumentUri } from 'vscode-languageserver';
import * as pathFunctions from "path";
import * as fs from "fs";
import fileUriToPath = require("file-uri-to-path");
import {
	LamaVisitor, Scope
} from './visitor';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

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
			completionProvider: {
				resolveProvider: true
			},
			// Tell the client that this server supports go to definition.
			definitionProvider: true
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
	//reparse(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
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
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
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
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
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
);

function computeBaseUri(uri: string) {
	const lastSep = uri.lastIndexOf("/");
	if (lastSep > 0) {
		/* uri = uri.substring(0, lastSep + 1); */
		uri = uri.substring(0, lastSep);
	} else {
		uri = "";
	}
	return uri;
}

function findStdlib(): string {
	let lamacPath = process.env.LAMAC_PATH ? process.env.LAMAC_PATH : "";
	if (lamacPath){
		const lamaPath = computeBaseUri(computeBaseUri(lamacPath));
		const path = lamaPath + "/share/Lama";
		return path;
	}
	return "";
}

function processImports(imports: any[], uri: DocumentUri):Scope {

	let stdlibPath = findStdlib();

	const baseUri = computeBaseUri(uri);
	const basePath = ensurePath(baseUri);
	let init_scope = new Scope();
	for(const i in imports) {
		const filename = "/" + imports[i].image + ".lama";
		const std_filepath = stdlibPath + filename;
		const filepath = basePath + filename;
		if (fs.existsSync(std_filepath)) {
			const documentUri = "file://" + stdlibPath + filename;
			init_scope = new Scope(processImport(std_filepath, init_scope, documentUri));
		} else if (fs.existsSync(filepath)) {
			const documentUri = baseUri + filename;
			init_scope = new Scope(processImport(filepath, init_scope, documentUri));
		} else {
			connection.window.showErrorMessage("Imported file not found: " + std_filepath);
		}
	}
	return init_scope;
}

function processImport(path: string, init_scope: Scope, documentUri: DocumentUri): Scope {
	try {
		const data = fs.readFileSync(path);
		const input = data.toString();
		const parser = new LamaParser();
		const init_node = parser.parse(input);

		const visitor = new LamaVisitor(documentUri, true);
		visitor.visit(init_node, init_scope);
		return init_scope;
	} catch (e) {
		connection.window.showErrorMessage("Cannot read from imported file " + path + ": " + e);
		console.error(e);
		return init_scope;
	}
}

function ensurePath(path: string) {
	if (path.startsWith("file:")) {
		//Decode for Windows paths like /C%3A/...
		let decoded = decodeURIComponent(fileUriToPath(path));
		if(!decoded.startsWith("\\\\") && decoded.startsWith("\\")) {
			//Windows doesn't seem to like paths like \C:\...
			decoded = decoded.substring(1);
		}
		return decoded;
	} else if(!pathFunctions.isAbsolute(path)) {
		return pathFunctions.resolve(path);
	} else {
		return path;
	}
}

//WIP                                                                      
connection.onDefinition((params) => {
	const uri = params.textDocument.uri;
	const document = documents.get(uri);
	if(document !== undefined) {
		//const {parser, parseTree, visitor} = ensureParsed(document);    //4TODO - optimization with caching
		const input = document.getText();      
		const parser = new LamaParser();
		const init_node = parser.parse(input); 

		let init_scope = new Scope();
		const imports = init_node.children.UIdentifier;
		if(imports) {
			init_scope = processImports(imports, uri);
		}
		/* console.log(init_node); */
		/* parser.lex(input);  */
		const visitor = new LamaVisitor(uri, false);
		visitor.visit(init_node, init_scope);
		const pos = params.position;
		const offset = document.offsetAt(pos);
		if(parser.lexingResult) {
			const token = computeToken(init_node, offset);		
			if(token && token.scope) {					                    
				const definition = findDefinition(token.image, token.scope);           
				if(definition !== undefined) {
					const targetSelectionRange = PositionToRange(definition);
					const location = Location.create(definition.uri, targetSelectionRange); //2TODO LocationLink[] - ??
					return location;
				}
			}
		}
		/* const smth_for_test = connection.sendRequest('c/textDocument/definition', params);
		console.log(smth_for_test); */
	}  
	return undefined;
});

/* function markForReparsing(document: TextDocument) {
	document["parser"] = undefined;
	document["parseTree"] = undefined;
	document["symbolTableVisitor"] = undefined;
} */

/*function ensureParsed(document: TextDocument) {
	if(document["parser"]) {
		return { parser: document["parser"], parseTree: document["parseTree"] , visitor: document["symbolTableVisitor"] };
	}
	const input = document.getText(); //не уверен, что сработает
	const parser = new LamaParser();
	const parseTree = parser.parse(input);//не уверен, что сработает
	const symbolTableVisitor = new SymbolTableVisitor(document.uri); 

	const imports = parseTree?.preamble()?.importList()?.importHeader();
	if(imports) {
		processImports(imports, symbolTableVisitor);
	}
	symbolTableVisitor.visit(parseTree);

	document["parser"] = parser;
	document["parseTree"] = parseTree;
	document["symbolTableVisitor"] = symbolTableVisitor;
	return {parser, parseTree , visitor: symbolTableVisitor};
} */



// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
