import { IToken, CstNode } from 'chevrotain';
import { LamaParser } from './parser';
import type {ICstNodeVisitor, CompilationUnitCstChildren, ScopeExpressionCstChildren, DefinitionCstChildren, 
  FunctionDefinitionCstChildren, FunctionArgumentsCstChildren, FunctionBodyCstChildren, InfixDefinitionCstChildren, 
  VariableDefinitionCstChildren, VariableDefinitionItemCstChildren, ExpressionCstChildren, BasicExpressionCstNode, 
  BasicExpressionCstChildren, PostfixCallCstChildren, PostfixExpressionCstChildren, PrimaryCstChildren, ArrayExpressionCstChildren, 
  ListExpressionBodyCstChildren, SymbolExpressionCstChildren, IfExpressionCstChildren, ElsePartCstChildren, WhileDoExpressionCstChildren, 
  DoWhileExpressionCstChildren, ForExpressionCstChildren, CaseExpressionCstChildren, LazyExpressionCstChildren, EtaExpressionCstChildren, 
  SyntaxBindingCstChildren, SyntaxExpressionCstChildren, SyntaxSeqCstChildren, SyntaxPostfixCstChildren, SyntaxPrimaryCstChildren, PostfixCstChildren, 
  PostfixIndexCstChildren, PatternCstChildren, SimplePatternCstChildren, SExprPatternCstChildren, ArrayPatternCstChildren, ListPatternCstChildren, 
  AsPatternCstChildren, CaseBranchPrefixCstChildren,/* , CaseBranchCstChildren */
  CurlyScopeExpressionCstChildren, PrimaryCstNode, PostfixCstNode, FunctionArgumentsCstNode} from './lama_cst';
import { DefaultScope as Scope } from './Scope';
import { DocumentUri } from 'vscode-languageserver-textdocument';
import { Range, Position } from 'vscode-languageserver';
import { ensurePath, readFile } from './path-utils';

export function getStartPosition (token: any /* IToken */): Position {
  return Position.create(
    token.startLine? token.startLine - 1 : 0,
    token.startColumn? token.startColumn - 1 : 0
  )
}

export function getEndPosition (token: any /* IToken */): Position {
  return Position.create(
    token.endLine? token.endLine - 1 : 0,
    token.endColumn? token.endColumn - 1 : 0
  )
}

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

const parser = new LamaParser()
const BaseLamaVisitor = parser.getBaseCstVisitorConstructor()

export class DefinitionVisitor extends BaseLamaVisitor implements ICstNodeVisitor<Scope, void> {

  constructor(
    public documentUri: DocumentUri,
	  public public_scope: Scope,
	  public private_scope: Scope,
    private filecontent: string
  ) {
    super()
    this.validateVisitor()
  }

  // filecontent = readFile(ensurePath(this.documentUri));

  visit(node: any, param?: any) {
    if(node === undefined) {
      return;
    }
    else if(Array.isArray(node)) {
      node.forEach((element: any) => {
        super.visit(element, param);
        /* console.log(element.name) */
      });
    }
    else {
      super.visit(node, param);
      /* console.log(node.name) */
    }
  }

  protected registerScope(token: any[] | undefined, scope: Scope) {
    if(token) {
      for(let i = 0; i < token.length; i++) {
        token[i].scope = scope
        /* console.log(token[i].image) */
      }
    }
  }

  protected registerFArgs(ftoken: any, fargnode: FunctionArgumentsCstNode, isPublic: boolean) {
    let fargs = "";
    if(fargnode.location && fargnode.location.endOffset) {
      fargs = this.filecontent?.substring(fargnode.location?.startOffset, fargnode.location?.endOffset + 1);
    }
    if(isPublic) {
      this.public_scope.addFArgs(ftoken.image, fargs);
      this.public_scope.addNArgs(ftoken.image, fargnode.children.pattern?.length ?? 0);
    } else {
      ftoken.scope.addFArgs(ftoken.image, fargs);
      ftoken.scope.addNArgs(ftoken.image, fargnode.children.pattern?.length ?? 0);
    }
	}

  protected regArgs(token: any, n: number) {
    token.nArgs = n;
  }

  protected countArgs(primary: PrimaryCstNode[], postfix: PostfixCstNode[] | undefined) {
    const prim = primary[0];
    const post = postfix ? postfix[0] : undefined;
    const funId = prim.children.LIdentifier;
    const funCall = post?.children.postfixCall;
    if(funId && funCall) {
      this.regArgs(funId[0], funCall[0].children.expression?.length ?? 0);
    }
  }

  compilationUnit(ctx: CompilationUnitCstChildren, scope: Scope) {
    this.visit(ctx.scopeExpression, scope/* new Scope(scope) */)
  } 

  scopeExpression(ctx: ScopeExpressionCstChildren, scope: Scope) {
    this.visit(ctx.definition, scope)
    this.visit(ctx.expression, scope)
  }

  definition(ctx: DefinitionCstChildren, scope: Scope){
    this.visit(ctx.functionDefinition, scope)
    this.visit(ctx.infixDefinition, scope)
    this.visit(ctx.variableDefinition, scope)
  }

  functionDefinition(ctx: FunctionDefinitionCstChildren, scope: Scope) { 
    const identifierToken = ctx.LIdentifier[0]
    if (ctx.Public && scope === this.private_scope) {
      this.public_scope.add(identifierToken.image, {
        range: Range.create(
          getStartPosition(identifierToken),
          getEndPosition(identifierToken)
        ),
        uri: this.documentUri
      })
    }
	else {
	  scope.add(identifierToken.image, {
      range: Range.create(
        getStartPosition(identifierToken),
        getEndPosition(identifierToken)
      ),
		  uri: this.documentUri
	  })
	}
	
    this.registerScope(ctx.LIdentifier, scope)
    this.registerFArgs(ctx.LIdentifier[0], ctx.functionArguments[0], ctx.Public !== undefined);
    // ctx.functionArguments[0].children.pattern[0].location
    const fScope = new Scope(scope)
    this.visit(ctx.functionArguments, fScope)
    this.visit(ctx.functionBody, fScope)
  }

  functionArguments(ctx: FunctionArgumentsCstChildren, scope: Scope) {
    this.visit(ctx.pattern, scope)
  }

  functionBody(ctx: FunctionBodyCstChildren, scope: Scope) {
    this.visit(ctx.scopeExpression, scope)
  }

  infixDefinition(ctx: InfixDefinitionCstChildren, scope: Scope) {    
    const operatorToken = ctx.Operator[0]
    const identifier = operatorToken.image
    if (ctx.Public && scope === this.private_scope) {
      this.public_scope.add(identifier, {
        range: Range.create(
          getStartPosition(operatorToken),
          getEndPosition(operatorToken)
        ),
        uri: this.documentUri
      })
    }
	else {
	  scope.add(identifier, {
      range: Range.create(
        getStartPosition(operatorToken),
        getEndPosition(operatorToken)
      ),
		  uri: this.documentUri
	  })
	}

    this.registerScope(ctx.Operator, scope)
    const iScope = new Scope(scope)
    this.visit(ctx.functionArguments, iScope)
    this.visit(ctx.functionBody, iScope)
  }

  variableDefinition(ctx: VariableDefinitionCstChildren, scope: Scope) {
    if (ctx.Public && scope === this.private_scope) {
      this.visit(ctx.variableDefinitionItem, this.public_scope)
    }
	else {
	  this.visit(ctx.variableDefinitionItem, scope)	
	}
  }

  variableDefinitionItem(ctx: VariableDefinitionItemCstChildren, scope: Scope) {
    const identifierToken = ctx.LIdentifier[0]
    const identifier = identifierToken.image
    scope.add(identifier, {
      range: Range.create(
        getStartPosition(identifierToken),
        getEndPosition(identifierToken)
      ),
      uri: this.documentUri
    }) 
	if (scope === this.public_scope) {
		scope = this.private_scope;	
	}
    this.registerScope(ctx.LIdentifier, scope)
    this.visit(ctx.basicExpression, scope)
  }

  expression(ctx: ExpressionCstChildren, scope: Scope) {
    this.visit(ctx.basicExpression, scope)
    this.visit(ctx.expression, scope)
  }

  basicExpression(ctx: BasicExpressionCstChildren, scope: Scope) { // FIXME, all above is correct
    this.registerScope(ctx.Operator, scope)
    this.visit(ctx.postfixExpression, scope)
  }

  postfixExpression(ctx: PostfixExpressionCstChildren, scope: Scope) {
    this.visit(ctx.primary, scope)
    this.visit(ctx.postfix, scope)
    this.countArgs(ctx.primary, ctx.postfix)
  }

  primary(ctx: PrimaryCstChildren, scope: Scope){ // TODO: Apply     
    this.registerScope(ctx.LIdentifier, scope)
    this.registerScope(ctx.Operator, scope)
    const fScope = new Scope(scope)
    this.visit(ctx.functionArguments, fScope)
    this.visit(ctx.functionBody, fScope)
    this.visit(ctx.listExpressionBody, scope)
    this.visit(ctx.scopeExpression, scope)
    this.visit(ctx.arrayExpression, scope)
    this.visit(ctx.symbolExpression, scope)
    this.visit(ctx.ifExpression, scope)
    this.visit(ctx.whileDoExpression, scope)
    this.visit(ctx.doWhileExpression, scope)
    this.visit(ctx.forExpression, scope)
    this.visit(ctx.caseExpression, scope)
    this.visit(ctx.lazyExpression, scope)
    this.visit(ctx.etaExpression, scope)
    this.visit(ctx.syntaxExpression, scope)
  }

  arrayExpression(ctx: ArrayExpressionCstChildren, scope: Scope) {
    this.visit(ctx.expression, scope)    
  }

  listExpressionBody(ctx: ListExpressionBodyCstChildren, scope: Scope) {
    this.visit(ctx.expression, scope)
  }

  symbolExpression(ctx: SymbolExpressionCstChildren, scope: Scope) {
    this.visit(ctx.expression, scope)
  }

  ifExpression(ctx: IfExpressionCstChildren, scope: Scope) {  
    this.visit(ctx.expression, scope)
    this.visit(ctx.scopeExpression, new Scope(scope))
    this.visit(ctx.elsePart, scope)
  }

  elsePart(ctx: ElsePartCstChildren, scope: Scope) {
    this.visit(ctx.expression, scope)
    this.visit(ctx.scopeExpression, new Scope(scope))
    this.visit(ctx.elsePart, scope)
    this.visit(ctx.scopeExpression, new Scope(scope))
  }

  whileDoExpression(ctx: WhileDoExpressionCstChildren, scope: Scope) {
    this.visit(ctx.expression, scope)
    this.visit(ctx.scopeExpression, new Scope(scope))
  }

  doWhileExpression(ctx: DoWhileExpressionCstChildren, scope: Scope) {
    const dwScope = new Scope(scope)
    this.visit(ctx.scopeExpression, dwScope)
    this.visit(ctx.expression, dwScope)
  }

  forExpression(ctx: ForExpressionCstChildren, scope: Scope) {
    const forScope = new Scope(scope)
    this.visit(ctx.expression, forScope)
    this.visit(ctx.scopeExpression, forScope)
  }

  caseExpression(ctx: CaseExpressionCstChildren, scope: Scope) {
    this.visit(ctx.expression, scope) 
    const firstScope = new Scope(scope)
    this.visit(ctx.pattern[0], firstScope)
    this.visit(ctx.scopeExpression[0], firstScope)
    for(let i = 1; i < ctx.scopeExpression.length; i++) {
      const curScope = new Scope(scope)
      this.visit(ctx.caseBranchPrefix?.[i-1], curScope)
      this.visit(ctx.scopeExpression[i], curScope)
    }
  }

  caseBranchPrefix(ctx: CaseBranchPrefixCstChildren, scope: Scope) {
    this.visit(ctx.pattern, scope)
  }

  lazyExpression(ctx: LazyExpressionCstChildren, scope: Scope) {
    this.visit(ctx.basicExpression, scope)
  }

  etaExpression(ctx: EtaExpressionCstChildren, scope: Scope) {
    this.visit(ctx.basicExpression, scope)
  }

  syntaxExpression(ctx: SyntaxExpressionCstChildren, scope: Scope) {
    this.visit(ctx.syntaxSeq, scope)
  }

  syntaxSeq(ctx: SyntaxSeqCstChildren, scope: Scope) {
    this.visit(ctx.syntaxBinding, scope)
    this.visit(ctx.scopeExpression, scope)
  }

  curlyScopeExpression(ctx: CurlyScopeExpressionCstChildren, scope: Scope): void {
    
  }

  syntaxBinding(ctx: SyntaxBindingCstChildren, scope: Scope) {
    this.visit(ctx.pattern, scope)
    this.visit(ctx.syntaxPostfix, scope)
  }

  syntaxPostfix(ctx: SyntaxPostfixCstChildren, scope: Scope) {
    this.visit(ctx.syntaxPrimary, scope)
  }

  syntaxPrimary(ctx: SyntaxPrimaryCstChildren, scope: Scope) {
    this.registerScope(ctx.LIdentifier, scope)
    this.visit(ctx.expression, scope)
    this.visit(ctx.syntaxSeq, scope)
  }

  postfix(ctx: PostfixCstChildren, scope: Scope) {
    this.registerScope(ctx.LIdentifier, scope)
    this.visit(ctx.postfixCall, scope)
    this.visit(ctx.postfixIndex, scope)
  }

  postfixCall(ctx: PostfixCallCstChildren, scope: Scope) {
    this.visit(ctx.expression, scope)
  }

  postfixIndex(ctx: PostfixIndexCstChildren, scope: Scope) {
    this.visit(ctx.expression, scope)
  }

  /// PATTERNS

  pattern(ctx: PatternCstChildren, scope: Scope) {
    this.visit(ctx.simplePattern, scope)
    this.visit(ctx.pattern, scope)
  }

  simplePattern(ctx: SimplePatternCstChildren, scope: Scope) {
    this.visit(ctx.sExprPattern, scope)
    this.visit(ctx.arrayPattern, scope)
    this.visit(ctx.listPattern, scope)
    this.visit(ctx.pattern, scope)
    this.visit(ctx.asPattern, scope)
  }

  sExprPattern(ctx: SExprPatternCstChildren, scope: Scope) {
    this.visit(ctx.pattern, scope)
  }

  arrayPattern(ctx: ArrayPatternCstChildren, scope: Scope) {
    this.visit(ctx.pattern, scope)
  }

  listPattern(ctx: ListPatternCstChildren, scope: Scope) {
    this.visit(ctx.pattern, scope)
  }

  asPattern(ctx: AsPatternCstChildren, scope: Scope) {
    const identifierToken = ctx.LIdentifier[0]
    const identifier = identifierToken.image
    scope.add(identifier, {
      range: Range.create(
        getStartPosition(identifierToken),
        getEndPosition(identifierToken)
      ),
      uri: this.documentUri
    })
    this.registerScope(ctx.LIdentifier, scope)
    this.visit(ctx.pattern, scope)
  }
}
