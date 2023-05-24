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
  Local?: IToken[];
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
  basicExpression: BasicExpressionCstNode[];
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
  Return?: IToken[];
  basicExpression?: BasicExpressionCstNode[];
  LCurly?: IToken[];
  listExpressionBody?: ListExpressionBodyCstNode[];
  scopeExpression?: ScopeExpressionCstNode[];
  RCurly?: IToken[];
  arrayExpression?: ArrayExpressionCstNode[];
  symbolExpression?: SymbolExpressionCstNode[];
  ifExpression?: IfExpressionCstNode[];
  whileExpression?: WhileExpressionCstNode[];
  repeatExpression?: RepeatExpressionCstNode[];
  forExpression?: ForExpressionCstNode[];
  caseExpression?: CaseExpressionCstNode[];
  lazyExpression?: LazyExpressionCstNode[];
  etaExpression?: EtaExpressionCstNode[];
  syntaxExpression?: SyntaxExpressionCstNode[];
  expression?: ExpressionCstNode[];
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
  expression: (ExpressionCstNode)[];
  Comma: (IToken)[];
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

export interface WhileExpressionCstNode extends CstNode {
  name: "whileExpression";
  children: WhileExpressionCstChildren;
}

export type WhileExpressionCstChildren = {
  While: IToken[];
  expression: ExpressionCstNode[];
  Do: IToken[];
  scopeExpression: ScopeExpressionCstNode[];
  Od: IToken[];
};

export interface RepeatExpressionCstNode extends CstNode {
  name: "repeatExpression";
  children: RepeatExpressionCstChildren;
}

export type RepeatExpressionCstChildren = {
  Repeat: IToken[];
  scopeExpression: ScopeExpressionCstNode[];
  Until: IToken[];
  basicExpression: BasicExpressionCstNode[];
};

export interface ForExpressionCstNode extends CstNode {
  name: "forExpression";
  children: ForExpressionCstChildren;
}

export type ForExpressionCstChildren = {
  For: IToken[];
  expression: (ExpressionCstNode)[];
  Comma: (IToken)[];
  Do: IToken[];
  scopeExpression: ScopeExpressionCstNode[];
  Od: IToken[];
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
  expression?: ExpressionCstNode[];
  RCurly?: IToken[];
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
  syntaxExpression?: SyntaxExpressionCstNode[];
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
  DecimalLiteral?: IToken[];
  StringLiteral?: IToken[];
  CharLiteral?: IToken[];
  BooleanLiteral?: IToken[];
  Hash?: IToken[];
  Shape?: IToken[];
  LRound?: IToken[];
  pattern?: PatternCstNode[];
  RRound?: IToken[];
  asPattern?: AsPatternCstNode[];
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
  whileExpression(children: WhileExpressionCstChildren, param?: IN): OUT;
  repeatExpression(children: RepeatExpressionCstChildren, param?: IN): OUT;
  forExpression(children: ForExpressionCstChildren, param?: IN): OUT;
  caseExpression(children: CaseExpressionCstChildren, param?: IN): OUT;
  caseBranchPrefix(children: CaseBranchPrefixCstChildren, param?: IN): OUT;
  lazyExpression(children: LazyExpressionCstChildren, param?: IN): OUT;
  etaExpression(children: EtaExpressionCstChildren, param?: IN): OUT;
  syntaxExpression(children: SyntaxExpressionCstChildren, param?: IN): OUT;
  syntaxSeq(children: SyntaxSeqCstChildren, param?: IN): OUT;
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
