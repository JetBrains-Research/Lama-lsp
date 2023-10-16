import { IToken, CstNode } from 'chevrotain';
import { LamaParser } from './parser';
import type {ICstNodeVisitor, CompilationUnitCstChildren, ScopeExpressionCstChildren, DefinitionCstChildren, FunctionDefinitionCstChildren, FunctionArgumentsCstChildren, FunctionBodyCstChildren, InfixDefinitionCstChildren, VariableDefinitionCstChildren, VariableDefinitionItemCstChildren, ExpressionCstChildren, BasicExpressionCstNode, BasicExpressionCstChildren, PostfixCallCstChildren, PostfixExpressionCstChildren, PrimaryCstChildren, ArrayExpressionCstChildren, ListExpressionBodyCstChildren, SymbolExpressionCstChildren, IfExpressionCstChildren, ElsePartCstChildren, WhileDoExpressionCstChildren, DoWhileExpressionCstChildren, ForExpressionCstChildren, CaseExpressionCstChildren, LazyExpressionCstChildren, EtaExpressionCstChildren, SyntaxBindingCstChildren, SyntaxExpressionCstChildren, SyntaxSeqCstChildren, SyntaxPostfixCstChildren, SyntaxPrimaryCstChildren, PostfixCstChildren, PostfixIndexCstChildren, PatternCstChildren, SimplePatternCstChildren, SExprPatternCstChildren, ArrayPatternCstChildren, ListPatternCstChildren, AsPatternCstChildren, CaseBranchPrefixCstChildren,/* , CaseBranchCstChildren */
CurlyScopeExpressionCstChildren} from './lama_cst';
import { DefaultScope as Scope } from './Scope'
import { DocumentUri } from 'vscode-languageserver-textdocument';
import { Position, Range } from 'vscode-languageserver';
//const debug = process.env.NODE_ENV === 'development'

function getStartPosition (token: IToken): Position {
  return Position.create(
    token.startLine? - 1 : 0,
    token.startColumn? - 1 : 0
  )
}

function getEndPosition (token: IToken): Position {
  return Position.create(
    token.endLine? - 1 : 0,
    token.endColumn ?? 0
  )
}
const parser = new LamaParser()
const BaseLamaVisitor = parser.getBaseCstVisitorConstructor()

export class LamaVisitor extends BaseLamaVisitor implements ICstNodeVisitor<Scope, void> {

  constructor(
    public documentUri: DocumentUri,
    public only_public: Boolean
  ) {
    super()
    this.validateVisitor()
  }

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
    if (ctx.Public || !this.only_public) {
      scope.add(identifierToken.image, {
        range: Range.create(
          getStartPosition(identifierToken),
          getEndPosition(identifierToken),
        ),
        uri: this.documentUri
      })
    }
    this.registerScope(ctx.LIdentifier, scope)
    const fScope = new Scope(scope)
    this.visit(ctx.functionArguments, fScope)
    this.visit(ctx.functionBody, fScope)
  }

  functionArguments(ctx: FunctionArgumentsCstChildren, scope: Scope) {
/*     const identifierToken = ctx.pattern?.[0].children.simplePattern[0].children.asPattern?.[0].children.LIdentifier[0]
    if(identifierToken) {
      const identifier = identifierToken.image
      scope.add(identifier, {
        type: 'V',
        identifier,
        start: getStartPoint(identifierToken),
        end: getEndPoint(identifierToken)
      })
    } */
    this.visit(ctx.pattern, scope)
  }

  functionBody(ctx: FunctionBodyCstChildren, scope: Scope) {
    this.visit(ctx.scopeExpression, scope)
  }

  infixDefinition(ctx: InfixDefinitionCstChildren, scope: Scope) {    
    const operatorToken = ctx.Operator[0]
    const identifier = operatorToken.image
    if (ctx.Public || !this.only_public) {
      scope.add(identifier, {
        range: Range.create(
          getStartPosition(operatorToken),
          getEndPosition(operatorToken),
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
    if (ctx.Public || !this.only_public) {
      this.visit(ctx.variableDefinitionItem, scope)
    }
  }

  variableDefinitionItem(ctx: VariableDefinitionItemCstChildren, scope: Scope) {
    const identifierToken = ctx.LIdentifier[0]
    const identifier = identifierToken.image
    scope.add(identifier, {
      range: Range.create(
        getStartPosition(identifierToken),
        getEndPosition(identifierToken),
      ),
      uri: this.documentUri
    }) 
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
    /* const identifierTokens = ctx.expression[0].children.basicExpression[0].children.postfixExpression[0].children.primary[0].children.LIdentifier
    if(identifierTokens) {
      const identifierToken = identifierTokens[0]
      const identifier = identifierToken.image
      forScope.add(identifier, {
        type: 'V',
        identifier,
        start: getStartPoint(identifierToken),
        end: getEndPoint(identifierToken)
      })
    } */
    this.visit(ctx.expression, forScope)
    this.visit(ctx.scopeExpression, forScope)
  }

/*   caseExpression(ctx: CaseExpressionCstChildren, scope: Scope) {
    this.visit(ctx.expression, scope) 
    this.visit(ctx.pattern, scope)
    this.visit(ctx.scopeExpression, scope)
    this.visit(ctx.caseBranchPrefix, scope)
  } */

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

/*   caseExpression(ctx: CaseExpressionCstChildren, scope: Scope) {
    this.visit(ctx.expression, scope)
    this.visit(ctx.caseBranch, scope)
  }

  caseBranch(ctx: CaseBranchCstChildren, scope: Scope) {
    const caseScope = new Scope(scope)
    this.visit(ctx.pattern, caseScope)
    this.visit(ctx.scopeExpression, caseScope)
  } */

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
        getEndPosition(identifierToken),
      ),
      uri: this.documentUri
    })
    this.registerScope(ctx.LIdentifier, scope)
    this.visit(ctx.pattern, scope)
  }
}
