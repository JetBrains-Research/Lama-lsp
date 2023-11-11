import { ReferenceVisitor } from './ref_visitor';
import { DocumentUri } from 'vscode-languageserver-textdocument';
import { FunctionDefinitionCstChildren } from './lama_cst';
import { CstNode, IToken } from 'chevrotain';

function isCstNode(node: CstNode | IToken): node is CstNode {
	return 'children' in node;
}

function collectTokensFromSubtree(node: CstNode, tokens: IToken[]): void {
	for (const childKey in node.children) {
		if (node.children[childKey] instanceof Array) {
			for (const child of node.children[childKey]) {
				if (isCstNode(child)) {
					// If the child is another CST node, recurse into it
					collectTokensFromSubtree(child, tokens);
				} else if (child.image != ","){
					// If the child is a token, add it to the list
					tokens.push(child);
				}
			}
		}
	}
}

export class HoverVisitor extends ReferenceVisitor {

	constructor(
		public documentUri: DocumentUri
	) {
		super(documentUri);
		this.validateVisitor();
	}

	protected registerFArgs(ftoken: any, fargnode: CstNode) {
		let fargs: IToken[] = [];
		collectTokensFromSubtree(fargnode, fargs);
		ftoken.scope.addFArgs(ftoken.image, fargs.map(token => token.image));
	}

	functionDefinition(ctx: FunctionDefinitionCstChildren) { 
		super.functionDefinition(ctx);
		this.registerFArgs(ctx.LIdentifier[0], ctx.functionArguments[0]);
	}

}