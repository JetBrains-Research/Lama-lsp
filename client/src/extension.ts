/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext, commands } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

import {exec} from 'child_process';
import { ConnectionError } from 'vscode-languageserver';

let client: LanguageClient;


export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for .lama files
		documentSelector: [{ scheme: 'file', language: 'lama' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'testlspLama',
		'Test LSP Lama',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server

	exec('eval $(opam env); which lamac', (error, stdout, stderr) => {
		if (error) {
			console.error('Error while running "which lamac":', error.message);
			return;
		}
	
		const lamacPath = stdout.trim();
		if (lamacPath) {
			/* console.log('Lamac executable found:', lamacPath); */
			process.env.LAMAC_PATH = lamacPath;
		} else {
			console.log('Lamac executable not found.');
			// Handle the case when 'lamac' is not found
		}
		client.start();
		});
	
	client.onRequest('log_info', node => console.log(node));

}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
