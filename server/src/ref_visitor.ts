import { Location, Position, Range } from 'vscode-languageserver';
import { LamaParser } from './parser';
import { AsPatternCstChildren, BasicExpressionCstChildren, FunctionDefinitionCstChildren, InfixDefinitionCstChildren, PostfixCstChildren, PrimaryCstChildren, SyntaxPrimaryCstChildren, VariableDefinitionItemCstChildren } from './lama_cst';
import { DocumentUri } from 'vscode-languageserver-textdocument';
import { findPublicScope, findScopeInFile } from './go-to-definition';

const parser = new LamaParser()
const LamaVisitorWithDefaults = parser.getBaseCstVisitorConstructorWithDefaults()

export class ReferenceVisitor extends LamaVisitorWithDefaults {
	
	constructor(
		public documentUri: DocumentUri
	) {
		super();
		this.validateVisitor();
	}

	visit(node: any, param?: any) {
		if(node === undefined) {
		  return;
		}
		else if(Array.isArray(node)) {
		  node.forEach((element: any) => {
			super.visit(element, param);
		  });
		}
		else {
		  super.visit(node, param);
		}
	}
	
	protected registerReference(tokens: any[] | undefined) {
		if(tokens) {
			for(let i = 0; i < tokens.length; i++) {
				const token = tokens[i];
				const range = Range.create(
					Position.create(token.startLine - 1, token.startColumn - 1),
					Position.create(token.endLine - 1, token.endColumn)
				);
				const location = Location.create(this.documentUri, range);
				const scope = findScopeInFile(token);
				scope?.addReference(token.image, location);
			}
		}
	}
	
	protected checkArgErrors(tokens: any[] | undefined) {
		if(tokens) {
			for(let i = 0; i < tokens.length; i++) {
				const token = tokens[i];
				const range = Range.create(
					Position.create(token.startLine - 1, token.startColumn - 1),
					Position.create(token.endLine - 1, token.endColumn)
				);
				const scope = findScopeInFile(token);
				if(scope) {
					let pScope = findPublicScope(token);
					if(token.nArgs) {
						if(scope?.has(token.image)) {
							const def_nArgs = scope?.getNArgs(token.image);
							// const def_nArgs = scope?.getFArgs(token.image)?.split(', ').length;
							if(def_nArgs && token.nArgs !== def_nArgs) {
								pScope?.addArgError(range, token.nArgs, def_nArgs);
							}
						} else {
								scope?.addArgResolve(token.image, range, token.nArgs);
						}
					} 
				}
			}
		}
	}

	functionDefinition(ctx: FunctionDefinitionCstChildren) { 
		this.registerReference(ctx.LIdentifier);
		this.visit(ctx.functionArguments);
		this.visit(ctx.functionBody);
	}
	
	infixDefinition(ctx: InfixDefinitionCstChildren) {    
		this.registerReference(ctx.Operator);
		this.visit(ctx.functionArguments);
		this.visit(ctx.functionBody);
	}

	variableDefinitionItem(ctx: VariableDefinitionItemCstChildren) {
		this.registerReference(ctx.LIdentifier);
		this.visit(ctx.basicExpression);
	}

	basicExpression(ctx: BasicExpressionCstChildren) {
		this.registerReference(ctx.Operator);
		this.visit(ctx.postfixExpression);
	}

	primary(ctx: PrimaryCstChildren){   
		this.registerReference(ctx.LIdentifier);
		this.checkArgErrors(ctx.LIdentifier);
		this.registerReference(ctx.Operator);
		this.visit(ctx.functionArguments);
		this.visit(ctx.functionBody);
		this.visit(ctx.listExpressionBody);
		this.visit(ctx.scopeExpression);
		this.visit(ctx.arrayExpression);
		this.visit(ctx.symbolExpression);
		this.visit(ctx.ifExpression);
		this.visit(ctx.whileDoExpression);
		this.visit(ctx.doWhileExpression);
		this.visit(ctx.forExpression);
		this.visit(ctx.caseExpression);
		this.visit(ctx.lazyExpression);
		this.visit(ctx.etaExpression);
		this.visit(ctx.syntaxExpression);
	}

	syntaxPrimary(ctx: SyntaxPrimaryCstChildren) {
		this.registerReference(ctx.LIdentifier);
		this.visit(ctx.expression);
		this.visit(ctx.syntaxSeq);
	}
	
	postfix(ctx: PostfixCstChildren) {
		this.registerReference(ctx.LIdentifier);
		this.visit(ctx.postfixCall);
		this.visit(ctx.postfixIndex);
	}

	asPattern(ctx: AsPatternCstChildren) {
		this.registerReference(ctx.LIdentifier);
		this.visit(ctx.pattern);
	}
}