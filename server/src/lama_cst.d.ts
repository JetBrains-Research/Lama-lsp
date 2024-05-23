import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface CompilationUnitCstNode extends CstNode {
  name: "compilationUnit";
  children: CompilationUnitCstChildren;
}

export type CompilationUnitCstChildren = {
  Import?: IToken[];
  UIdentifier?: IToken[];
  Semicolon?: IToken[];
  scopeExpression: ScopeExpressionCstNode[];
};

export interface ScopeExpressionCstNode extends CstNode {
  name: "scopeExpression";
  children: ScopeExpressionCstChildren;
}

export type ScopeExpressionCstChildren = {
  definition?: DefinitionCstNode[];
  expression?: ExpressionCstNode[];
};

export interface DefinitionCstNode extends CstNode {
  name: "definition";
  children: DefinitionCstChildren;
}

export type DefinitionCstChildren = {
  functionDefinition?: FunctionDefinitionCstNode[];
  infixDefinition?: InfixDefinitionCstNode[];
  variableDefinition?: VariableDefinitionCstNode[];
};

export interface FunctionDefinitionCstNode extends CstNode {
  name: "functionDefinition";
  children: FunctionDefinitionCstChildren;
}

export type FunctionDefinitionCstChildren = {
  Public?: IToken[];
  Fun: IToken[];
  LIdentifier: IToken[];
  LRound: IToken[];
  functionArguments: FunctionArgumentsCstNode[];
  RRound: IToken[];
  functionBody: FunctionBodyCstNode[];
};

export interface FunctionArgumentsCstNode extends CstNode {
  name: "functionArguments";
  children: FunctionArgumentsCstChildren;
}

export type FunctionArgumentsCstChildren = {
  pattern?: PatternCstNode[];
  Comma?: IToken[];
};

export interface FunctionBodyCstNode extends CstNode {
  name: "functionBody";
  children: FunctionBodyCstChildren;
}

export type FunctionBodyCstChildren = {
  LCurly: IToken[];
  scopeExpression: ScopeExpressionCstNode[];
  RCurly: IToken[];
};

export interface InfixDefinitionCstNode extends CstNode {
  name: "infixDefinition";
  children: InfixDefinitionCstChildren;
}

export type InfixDefinitionCstChildren = {
  Public?: IToken[];
  Infixity: IToken[];
  Operator: (IToken)[];
  InfixLevel: IToken[];
  LRound: IToken[];
  functionArguments: FunctionArgumentsCstNode[];
  RRound: IToken[];
  functionBody: FunctionBodyCstNode[];
};

export interface VariableDefinitionCstNode extends CstNode {
  name: "variableDefinition";
  children: VariableDefinitionCstChildren;
}

export type VariableDefinitionCstChildren = {
  Var?: IToken[];
  Public?: IToken[];
  variableDefinitionItem: VariableDefinitionItemCstNode[];
  Comma?: IToken[];
  Semicolon: IToken[];
};

export interface VariableDefinitionItemCstNode extends CstNode {
  name: "variableDefinitionItem";
  children: VariableDefinitionItemCstChildren;
}

export type VariableDefinitionItemCstChildren = {
  LIdentifier: IToken[];
  Equal?: IToken[];
  basicExpression?: BasicExpressionCstNode[];
};

export interface ExpressionCstNode extends CstNode {
  name: "expression";
  children: ExpressionCstChildren;
}

export type ExpressionCstChildren = {
  letInExpression?: LetInExpressionCstNode[];
  basicExpression?: BasicExpressionCstNode[];
  Semicolon?: IToken[];
  expression?: ExpressionCstNode[];
};

export interface BasicExpressionCstNode extends CstNode {
  name: "basicExpression";
  children: BasicExpressionCstChildren;
}

export type BasicExpressionCstChildren = {
  postfixExpression: (PostfixExpressionCstNode)[];
  Operator?: IToken[];
};

export interface PostfixExpressionCstNode extends CstNode {
  name: "postfixExpression";
  children: PostfixExpressionCstChildren;
}

export type PostfixExpressionCstChildren = {
  Minus?: IToken[];
  primary: PrimaryCstNode[];
  postfix?: PostfixCstNode[];
};

export interface PrimaryCstNode extends CstNode {
  name: "primary";
  children: PrimaryCstChildren;
}

export type PrimaryCstChildren = {
  DecimalLiteral?: IToken[];
  StringLiteral?: IToken[];
  CharLiteral?: IToken[];
  BooleanLiteral?: IToken[];
  Infix?: IToken[];
  Operator?: IToken[];
  Fun?: IToken[];
  LRound?: (IToken)[];
  functionArguments?: FunctionArgumentsCstNode[];
  RRound?: (IToken)[];
  functionBody?: FunctionBodyCstNode[];
  Skip?: IToken[];
  LCurly?: IToken[];
  listExpressionBody?: ListExpressionBodyCstNode[];
  RCurly?: IToken[];
  arrayExpression?: ArrayExpressionCstNode[];
  symbolExpression?: SymbolExpressionCstNode[];
  ifExpression?: IfExpressionCstNode[];
  whileDoExpression?: WhileDoExpressionCstNode[];
  doWhileExpression?: DoWhileExpressionCstNode[];
  forExpression?: ForExpressionCstNode[];
  caseExpression?: CaseExpressionCstNode[];
  lazyExpression?: LazyExpressionCstNode[];
  etaExpression?: EtaExpressionCstNode[];
  syntaxExpression?: SyntaxExpressionCstNode[];
  scopeExpression?: ScopeExpressionCstNode[];
  LIdentifier?: IToken[];
};

export interface ArrayExpressionCstNode extends CstNode {
  name: "arrayExpression";
  children: ArrayExpressionCstChildren;
}

export type ArrayExpressionCstChildren = {
  LSquare: IToken[];
  expression?: ExpressionCstNode[];
  Comma?: IToken[];
  RSquare: IToken[];
};

export interface ListExpressionBodyCstNode extends CstNode {
  name: "listExpressionBody";
  children: ListExpressionBodyCstChildren;
}

export type ListExpressionBodyCstChildren = {
  expression?: ExpressionCstNode[];
  Comma?: IToken[];
};

export interface SymbolExpressionCstNode extends CstNode {
  name: "symbolExpression";
  children: SymbolExpressionCstChildren;
}

export type SymbolExpressionCstChildren = {
  UIdentifier: IToken[];
  LRound?: IToken[];
  expression?: ExpressionCstNode[];
  Comma?: IToken[];
  RRound?: IToken[];
};

export interface IfExpressionCstNode extends CstNode {
  name: "ifExpression";
  children: IfExpressionCstChildren;
}

export type IfExpressionCstChildren = {
  If: IToken[];
  expression: ExpressionCstNode[];
  Then: IToken[];
  scopeExpression: ScopeExpressionCstNode[];
  elsePart?: ElsePartCstNode[];
  Fi: IToken[];
};

export interface ElsePartCstNode extends CstNode {
  name: "elsePart";
  children: ElsePartCstChildren;
}

export type ElsePartCstChildren = {
  Elif?: IToken[];
  expression?: ExpressionCstNode[];
  Then?: IToken[];
  scopeExpression?: (ScopeExpressionCstNode)[];
  elsePart?: ElsePartCstNode[];
  Else?: IToken[];
};

export interface WhileDoExpressionCstNode extends CstNode {
  name: "whileDoExpression";
  children: WhileDoExpressionCstChildren;
}

export type WhileDoExpressionCstChildren = {
  While: IToken[];
  expression: ExpressionCstNode[];
  Do: IToken[];
  scopeExpression: ScopeExpressionCstNode[];
  Od: IToken[];
};

export interface DoWhileExpressionCstNode extends CstNode {
  name: "doWhileExpression";
  children: DoWhileExpressionCstChildren;
}

export type DoWhileExpressionCstChildren = {
  Do: IToken[];
  scopeExpression: ScopeExpressionCstNode[];
  While: IToken[];
  expression: ExpressionCstNode[];
  Od: IToken[];
};

export interface ForExpressionCstNode extends CstNode {
  name: "forExpression";
  children: ForExpressionCstChildren;
}

export type ForExpressionCstChildren = {
  For: IToken[];
  scopeExpression: (ScopeExpressionCstNode)[];
  Comma: (IToken)[];
  expression: (ExpressionCstNode)[];
  Do: IToken[];
  Od: IToken[];
};

export interface LetInExpressionCstNode extends CstNode {
  name: "letInExpression";
  children: LetInExpressionCstChildren;
}

export type LetInExpressionCstChildren = {
  Let: IToken[];
  pattern: PatternCstNode[];
  Equal: IToken[];
  expression: (ExpressionCstNode)[];
  In: IToken[];
};

export interface CaseExpressionCstNode extends CstNode {
  name: "caseExpression";
  children: CaseExpressionCstChildren;
}

export type CaseExpressionCstChildren = {
  Case: IToken[];
  expression: ExpressionCstNode[];
  Of: IToken[];
  pattern: PatternCstNode[];
  Arrow: IToken[];
  scopeExpression: (ScopeExpressionCstNode)[];
  caseBranchPrefix?: CaseBranchPrefixCstNode[];
  Esac: IToken[];
};

export interface CaseBranchPrefixCstNode extends CstNode {
  name: "caseBranchPrefix";
  children: CaseBranchPrefixCstChildren;
}

export type CaseBranchPrefixCstChildren = {
  Bar: IToken[];
  pattern: PatternCstNode[];
  Arrow: IToken[];
};

export interface LazyExpressionCstNode extends CstNode {
  name: "lazyExpression";
  children: LazyExpressionCstChildren;
}

export type LazyExpressionCstChildren = {
  Lazy: IToken[];
  basicExpression: BasicExpressionCstNode[];
};

export interface EtaExpressionCstNode extends CstNode {
  name: "etaExpression";
  children: EtaExpressionCstChildren;
}

export type EtaExpressionCstChildren = {
  Eta: IToken[];
  basicExpression: BasicExpressionCstNode[];
};

export interface SyntaxExpressionCstNode extends CstNode {
  name: "syntaxExpression";
  children: SyntaxExpressionCstChildren;
}

export type SyntaxExpressionCstChildren = {
  Syntax: IToken[];
  LRound: IToken[];
  syntaxSeq: SyntaxSeqCstNode[];
  Bar?: IToken[];
  RRound: IToken[];
};

export interface SyntaxSeqCstNode extends CstNode {
  name: "syntaxSeq";
  children: SyntaxSeqCstChildren;
}

export type SyntaxSeqCstChildren = {
  syntaxBinding: SyntaxBindingCstNode[];
  LCurly?: IToken[];
  scopeExpression?: ScopeExpressionCstNode[];
  RCurly?: IToken[];
};

export interface CurlyScopeExpressionCstNode extends CstNode {
  name: "curlyScopeExpression";
  children: CurlyScopeExpressionCstChildren;
}

export type CurlyScopeExpressionCstChildren = {
  LCurly: IToken[];
  scopeExpression: ScopeExpressionCstNode[];
  RCurly: IToken[];
};

export interface SyntaxBindingCstNode extends CstNode {
  name: "syntaxBinding";
  children: SyntaxBindingCstChildren;
}

export type SyntaxBindingCstChildren = {
  Minus?: IToken[];
  pattern?: PatternCstNode[];
  Equal?: IToken[];
  syntaxPostfix: SyntaxPostfixCstNode[];
};

export interface SyntaxPostfixCstNode extends CstNode {
  name: "syntaxPostfix";
  children: SyntaxPostfixCstChildren;
}

export type SyntaxPostfixCstChildren = {
  syntaxPrimary: SyntaxPrimaryCstNode[];
  Plus?: IToken[];
  Question?: IToken[];
  Star?: IToken[];
};

export interface SyntaxPrimaryCstNode extends CstNode {
  name: "syntaxPrimary";
  children: SyntaxPrimaryCstChildren;
}

export type SyntaxPrimaryCstChildren = {
  LIdentifier?: IToken[];
  LSquare?: IToken[];
  expression?: (ExpressionCstNode)[];
  Comma?: IToken[];
  RSquare?: IToken[];
  LRound?: (IToken)[];
  syntaxSeq?: SyntaxSeqCstNode[];
  RRound?: (IToken)[];
  Dollar?: IToken[];
};

export interface PostfixCstNode extends CstNode {
  name: "postfix";
  children: PostfixCstChildren;
}

export type PostfixCstChildren = {
  Dot?: (IToken)[];
  Length?: IToken[];
  String?: IToken[];
  postfixCall?: (PostfixCallCstNode)[];
  postfixIndex?: PostfixIndexCstNode[];
  LIdentifier?: IToken[];
};

export interface PostfixCallCstNode extends CstNode {
  name: "postfixCall";
  children: PostfixCallCstChildren;
}

export type PostfixCallCstChildren = {
  LRound: IToken[];
  expression?: ExpressionCstNode[];
  Comma?: IToken[];
  RRound: IToken[];
};

export interface PostfixIndexCstNode extends CstNode {
  name: "postfixIndex";
  children: PostfixIndexCstChildren;
}

export type PostfixIndexCstChildren = {
  LSquare: IToken[];
  expression: ExpressionCstNode[];
  RSquare: IToken[];
};

export interface PatternCstNode extends CstNode {
  name: "pattern";
  children: PatternCstChildren;
}

export type PatternCstChildren = {
  simplePattern: SimplePatternCstNode[];
  Colon?: IToken[];
  pattern?: PatternCstNode[];
};

export interface SimplePatternCstNode extends CstNode {
  name: "simplePattern";
  children: SimplePatternCstChildren;
}

export type SimplePatternCstChildren = {
  Underscore?: IToken[];
  sExprPattern?: SExprPatternCstNode[];
  arrayPattern?: ArrayPatternCstNode[];
  listPattern?: ListPatternCstNode[];
  asPattern?: AsPatternCstNode[];
  DecimalLiteral?: IToken[];
  StringLiteral?: IToken[];
  CharLiteral?: IToken[];
  BooleanLiteral?: IToken[];
  Hash?: IToken[];
  Shape?: IToken[];
  LRound?: IToken[];
  pattern?: PatternCstNode[];
  RRound?: IToken[];
};

export interface SExprPatternCstNode extends CstNode {
  name: "sExprPattern";
  children: SExprPatternCstChildren;
}

export type SExprPatternCstChildren = {
  UIdentifier: IToken[];
  LRound?: IToken[];
  pattern?: PatternCstNode[];
  Comma?: IToken[];
  RRound?: IToken[];
};

export interface ArrayPatternCstNode extends CstNode {
  name: "arrayPattern";
  children: ArrayPatternCstChildren;
}

export type ArrayPatternCstChildren = {
  LSquare: IToken[];
  pattern?: PatternCstNode[];
  Comma?: IToken[];
  RSquare: IToken[];
};

export interface ListPatternCstNode extends CstNode {
  name: "listPattern";
  children: ListPatternCstChildren;
}

export type ListPatternCstChildren = {
  LCurly: IToken[];
  pattern?: PatternCstNode[];
  Comma?: IToken[];
  RCurly: IToken[];
};

export interface AsPatternCstNode extends CstNode {
  name: "asPattern";
  children: AsPatternCstChildren;
}

export type AsPatternCstChildren = {
  LIdentifier: IToken[];
  AtSign?: IToken[];
  pattern?: PatternCstNode[];
  AtHash?: IToken[];
  Shape?: IToken[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  compilationUnit(children: CompilationUnitCstChildren, param?: IN): OUT;
  scopeExpression(children: ScopeExpressionCstChildren, param?: IN): OUT;
  definition(children: DefinitionCstChildren, param?: IN): OUT;
  functionDefinition(children: FunctionDefinitionCstChildren, param?: IN): OUT;
  functionArguments(children: FunctionArgumentsCstChildren, param?: IN): OUT;
  functionBody(children: FunctionBodyCstChildren, param?: IN): OUT;
  infixDefinition(children: InfixDefinitionCstChildren, param?: IN): OUT;
  variableDefinition(children: VariableDefinitionCstChildren, param?: IN): OUT;
  variableDefinitionItem(children: VariableDefinitionItemCstChildren, param?: IN): OUT;
  expression(children: ExpressionCstChildren, param?: IN): OUT;
  basicExpression(children: BasicExpressionCstChildren, param?: IN): OUT;
  postfixExpression(children: PostfixExpressionCstChildren, param?: IN): OUT;
  primary(children: PrimaryCstChildren, param?: IN): OUT;
  arrayExpression(children: ArrayExpressionCstChildren, param?: IN): OUT;
  listExpressionBody(children: ListExpressionBodyCstChildren, param?: IN): OUT;
  symbolExpression(children: SymbolExpressionCstChildren, param?: IN): OUT;
  ifExpression(children: IfExpressionCstChildren, param?: IN): OUT;
  elsePart(children: ElsePartCstChildren, param?: IN): OUT;
  whileDoExpression(children: WhileDoExpressionCstChildren, param?: IN): OUT;
  doWhileExpression(children: DoWhileExpressionCstChildren, param?: IN): OUT;
  forExpression(children: ForExpressionCstChildren, param?: IN): OUT;
  letInExpression(children: LetInExpressionCstChildren, param?: IN): OUT;
  caseExpression(children: CaseExpressionCstChildren, param?: IN): OUT;
  caseBranchPrefix(children: CaseBranchPrefixCstChildren, param?: IN): OUT;
  lazyExpression(children: LazyExpressionCstChildren, param?: IN): OUT;
  etaExpression(children: EtaExpressionCstChildren, param?: IN): OUT;
  syntaxExpression(children: SyntaxExpressionCstChildren, param?: IN): OUT;
  syntaxSeq(children: SyntaxSeqCstChildren, param?: IN): OUT;
  curlyScopeExpression(children: CurlyScopeExpressionCstChildren, param?: IN): OUT;
  syntaxBinding(children: SyntaxBindingCstChildren, param?: IN): OUT;
  syntaxPostfix(children: SyntaxPostfixCstChildren, param?: IN): OUT;
  syntaxPrimary(children: SyntaxPrimaryCstChildren, param?: IN): OUT;
  postfix(children: PostfixCstChildren, param?: IN): OUT;
  postfixCall(children: PostfixCallCstChildren, param?: IN): OUT;
  postfixIndex(children: PostfixIndexCstChildren, param?: IN): OUT;
  pattern(children: PatternCstChildren, param?: IN): OUT;
  simplePattern(children: SimplePatternCstChildren, param?: IN): OUT;
  sExprPattern(children: SExprPatternCstChildren, param?: IN): OUT;
  arrayPattern(children: ArrayPatternCstChildren, param?: IN): OUT;
  listPattern(children: ListPatternCstChildren, param?: IN): OUT;
  asPattern(children: AsPatternCstChildren, param?: IN): OUT;
}
