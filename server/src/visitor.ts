import { IToken, CstNode } from 'chevrotain';
import {Point} from 'unist'
import { LamaParser } from './parser';
import type {ICstNodeVisitor, CompilationUnitCstChildren, ScopeExpressionCstChildren, DefinitionCstChildren, FunctionDefinitionCstChildren, FunctionArgumentsCstChildren, FunctionBodyCstChildren, InfixDefinitionCstChildren, VariableDefinitionCstChildren, VariableDefinitionItemCstChildren, ExpressionCstChildren, BasicExpressionCstNode, BasicExpressionCstChildren, PostfixCallCstChildren, PostfixExpressionCstChildren, PrimaryCstChildren, ArrayExpressionCstChildren, ListExpressionBodyCstChildren, SymbolExpressionCstChildren, IfExpressionCstChildren, ElsePartCstChildren, WhileDoExpressionCstChildren, DoWhileExpressionCstChildren, ForExpressionCstChildren, CaseExpressionCstChildren, CaseBranchPrefixCstChildren, LazyExpressionCstChildren, EtaExpressionCstChildren, SyntaxBindingCstChildren, SyntaxExpressionCstChildren, SyntaxSeqCstChildren, SyntaxPostfixCstChildren, SyntaxPrimaryCstChildren, PostfixCstChildren, PostfixIndexCstChildren, PatternCstChildren, SimplePatternCstChildren, SExprPatternCstChildren, ArrayPatternCstChildren, ListPatternCstChildren, AsPatternCstChildren} from './lama_cst';
import { AbstractScope } from './scope'
import { InterfaceItem } from './interface'
import { Position } from 'unist'
import { DocumentUri } from 'vscode-languageserver-textdocument';
//const debug = process.env.NODE_ENV === 'development'

export class Scope extends AbstractScope<InterfaceItem & Position> { }

function getStartPoint (token: IToken): Point {
  return {
    offset: token.startOffset,
    line: token.startLine ?? 0,
    column: token.startColumn ?? 0
  }
}

function getEndPoint (token: IToken): Point {
  return {
    offset: token.endOffset,
    line: token.endLine ?? 0,
    column: token.endColumn ?? 0
  }
}

const parser = new LamaParser()
const BaseLamaVisitor = parser.getBaseCstVisitorConstructor()

export class LamaVisitor extends BaseLamaVisitor implements ICstNodeVisitor<Scope, void> {

  constructor(
    public documentUri: DocumentUri
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
      }
    }
  }

  compilationUnit(ctx: CompilationUnitCstChildren, scope: Scope) {
    this.visit(ctx.scopeExpression, new Scope(scope))
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
    scope.add(identifierToken.image, {
      type: 'F',
      identifier: identifierToken.image,
      start: getStartPoint(identifierToken),
      end: getEndPoint(identifierToken)
    })
    this.registerScope(ctx.LIdentifier, scope)
    this.visit(ctx.functionArguments, scope)
    this.visit(ctx.functionBody, scope)
  }

  functionArguments(ctx: FunctionArgumentsCstChildren, scope: Scope) {
    this.visit(ctx.pattern, scope)
  }

  functionBody(ctx: FunctionBodyCstChildren, scope: Scope) {
    this.visit(ctx.scopeExpression, new Scope(scope))
  }

  infixDefinition(ctx: InfixDefinitionCstChildren, scope: Scope) {    
    const operatorToken = ctx.Operator[0]
    const identifier = operatorToken.image
    scope.add(identifier, {
      type: 'F',
      identifier,
      start: getStartPoint(operatorToken),
      end: getEndPoint(operatorToken)
    })
    this.visit(ctx.functionArguments, scope)
    this.visit(ctx.functionBody, scope)
  }

  variableDefinition(ctx: VariableDefinitionCstChildren, scope: Scope) {
    this.visit(ctx.variableDefinitionItem, scope)
  }

  variableDefinitionItem(ctx: VariableDefinitionItemCstChildren, scope: Scope) {
    const identifierToken = ctx.LIdentifier[0]
    const identifier = identifierToken.image
    scope.add(identifier, {
      type: 'V',
      identifier,
      start: getStartPoint(identifierToken),
      end: getEndPoint(identifierToken)
    })
    this.registerScope(ctx.LIdentifier, scope)
    this.visit(ctx.basicExpression, scope)
  }

  expression(ctx: ExpressionCstChildren, scope: Scope) {
    this.visit(ctx.basicExpression, scope)
    this.visit(ctx.expression, scope)
  }

  basicExpression(ctx: BasicExpressionCstChildren, scope: Scope) { // FIXME, all above is correct
    this.visit(ctx.postfixExpression, scope)
    this.visit(ctx.postfixExpression, scope)
  }

  postfixExpression(ctx: PostfixExpressionCstChildren, scope: Scope) {
    this.visit(ctx.primary, scope)
    this.visit(ctx.postfix, scope)
  }

  primary(ctx: PrimaryCstChildren, scope: Scope){ // TODO: Apply     
    this.registerScope(ctx.LIdentifier, scope)
    this.visit(ctx.functionArguments, scope)
    this.visit(ctx.functionBody, scope)
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
    this.visit(this.expression, scope)
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
    this.visit(ctx.scopeExpression, new Scope(scope))
    this.visit(ctx.expression, scope)
  }

  forExpression(ctx: ForExpressionCstChildren, scope: Scope) {
    this.visit(ctx.expression, scope)
    this.visit(ctx.scopeExpression, new Scope(scope))
  }

  caseExpression(ctx: CaseExpressionCstChildren, scope: Scope) {
    this.visit(ctx.expression, scope)
    this.visit(ctx.pattern, scope)
    this.visit(ctx.scopeExpression, new Scope(scope))
    this.visit(ctx.caseBranchPrefix, scope)
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
    this.visit(ctx.expression, scope)
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
    this.visit(ctx.syntaxExpression, scope)
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
    this.registerScope(ctx.LIdentifier, scope)
    this.visit(ctx.pattern, scope)
  }
}
