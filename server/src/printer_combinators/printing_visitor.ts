import { IToken, CstNode } from 'chevrotain';
import * as F from './formatList';
import { LamaParser } from '../parser';
import type {
  ICstNodeVisitor, CompilationUnitCstChildren, ScopeExpressionCstChildren, DefinitionCstChildren,
  FunctionDefinitionCstChildren, FunctionArgumentsCstChildren, FunctionBodyCstChildren, InfixDefinitionCstChildren,
  VariableDefinitionCstChildren, VariableDefinitionItemCstChildren, ExpressionCstChildren, BasicExpressionCstNode,
  BasicExpressionCstChildren, PostfixCallCstChildren, PostfixExpressionCstChildren, PrimaryCstChildren, ArrayExpressionCstChildren,
  ListExpressionBodyCstChildren, SymbolExpressionCstChildren, IfExpressionCstChildren, ElsePartCstChildren, WhileDoExpressionCstChildren,
  DoWhileExpressionCstChildren, ForExpressionCstChildren, CaseExpressionCstChildren, LazyExpressionCstChildren, EtaExpressionCstChildren,
  SyntaxBindingCstChildren, SyntaxExpressionCstChildren, SyntaxSeqCstChildren, SyntaxPostfixCstChildren, SyntaxPrimaryCstChildren, PostfixCstChildren,
  PostfixIndexCstChildren, PatternCstChildren, SimplePatternCstChildren, SExprPatternCstChildren, ArrayPatternCstChildren, ListPatternCstChildren,
  AsPatternCstChildren, CaseBranchPrefixCstChildren, CurlyScopeExpressionCstChildren, LetInExpressionCstChildren
} from '../lama_cst';
import { DocumentUri } from 'vscode-languageserver-textdocument';

export function printTextDocument(initNode: CstNode, filePath: string, comments: IToken[] | undefined): string {
	const printingVisitor = new PrintingVisitor(filePath, prepareComments(comments));
  const formatList = printingVisitor.visit(initNode);
	return F.toString(formatList);
}

function chooseLineColumn(list_: F.T[]): F.T {
  if(list_.length == 0) return F.initial;
  else if(list_.length == 1) return list_[0];
  else {
    let lineVariant = list_[0];
    let columnVariant = list_[0];
    for (let i = 1; i < list_.length; i++) {
      lineVariant = F.bs(F.b(lineVariant, F.st(',')), list_[i]);
      columnVariant = F.ab(F.b(columnVariant, F.st(',')), list_[i]);
    }
    return F.choose(lineVariant, columnVariant);
  }
}

function returnLineColumn(list_: F.T[]): [F.T, F.T] {
  if(list_.length == 0) return [F.initial, F.initial];
  else if(list_.length == 1) return [list_[0], list_[0]];
  else {
    let lineVariant = list_[0];
    let columnVariant = list_[0];
    for (let i = 1; i < list_.length; i++) {
      lineVariant = F.bs(F.b(lineVariant, F.st(',')), list_[i]);
      columnVariant = F.ab(F.b(columnVariant, F.st(',')), list_[i]);
    }
    return [lineVariant, columnVariant];
  }
}

function prepareComments(rawComments: IToken[] | undefined): [number, string][] {
  const comments: [number, string][] = [];
  if(rawComments) {
    for(let i = 0; i < rawComments?.length; i++) {
      comments.push([rawComments[i].endLine ?? 0, rawComments[i].image]);
    }
  }
  return comments;
}

const parser = new LamaParser();
const BaseLamaVisitor = parser.getBaseCstVisitorConstructor();

export class PrintingVisitor extends BaseLamaVisitor implements ICstNodeVisitor<void, F.T> {

  constructor(
    public documentUri: DocumentUri,
    public comments: [number, string][]
  ) {
    super();
    this.validateVisitor();
  }

  curIdx = 0;
  N = this.comments.length;
  funNameLen = 0;
  fun1ArgLen = 0;

  visit(node: CstNode): F.T {
    const commentList: string[] = []; 
    if(node.location?.startLine && this.curIdx < this.N) {
      while(this.curIdx < this.N && node.location.startLine > this.comments[this.curIdx][0]) {
        commentList.push(this.comments[this.curIdx][1]);
        this.curIdx += 1;
      }
    }
    const nodeText = super.visit(node);
    return commentList.length ? F.ab(F.st(commentList.join('\n')), nodeText) : nodeText;
  }

  extractComments(node: CstNode): F.T | undefined {
    const commentList: string[] = []; 
    if(node.location?.startLine && this.curIdx < this.N) {
      while(this.curIdx < this.N && node.location.startLine > this.comments[this.curIdx][0]) {
        commentList.push(this.comments[this.curIdx][1]);
        this.curIdx += 1;
      }
    }
    return commentList.length ? F.st(commentList.join('\n')) : undefined;
  }

  cleanVisit(node: CstNode): F.T { 
    return super.visit(node);
  }

	compilationUnit(ctx: CompilationUnitCstChildren) {
		if (ctx.UIdentifier) {
      let formatList = F.b(F.bs(F.st('import'), 
                                F.st(ctx.UIdentifier[0].image)),
                           F.st(';'));
			for (let i = 1; i < ctx.UIdentifier.length; i++) {
        formatList = F.ab(formatList, F.b(F.bs(F.st('import'), 
                                               F.st(ctx.UIdentifier[i].image)),
                                          F.st(';')));
			}
      return F.abb(formatList, this.visit(ctx.scopeExpression[0]));
		} 
    else return this.visit(ctx.scopeExpression[0]);
	}

  scopeExpression(ctx: ScopeExpressionCstChildren) {
    let defFList = F.initial;
    let expFList = F.initial;
    if(ctx.definition) {
      defFList = this.visit(ctx.definition[0]);
      for(let i = 1; i < ctx.definition.length; i++) defFList = F.ab(defFList, this.visit(ctx.definition[i]));
    }
    if(ctx.expression) expFList = this.visit(ctx.expression[0]);
    if(ctx.definition && ctx.expression) {
      return F.choose(
        F.abb(defFList, expFList),
        F.bs(F.h(defFList, 1), F.h(expFList, 1))
      );
    }
    else if(ctx.definition) {
      return defFList;
    }
    else if(ctx.expression) {
      return expFList;
    }
    else return F.initial;
  }

  definition(ctx: DefinitionCstChildren) {
    if (ctx.functionDefinition) {
      return this.visit(ctx.functionDefinition[0]);
    }
    else if (ctx.infixDefinition) {
      return this.visit(ctx.infixDefinition[0]);
    }
    else if (ctx.variableDefinition) {
      return this.visit(ctx.variableDefinition[0]);
    }
    return F.initial;
  }

  functionDefinition(ctx: FunctionDefinitionCstChildren) {
    let funFList = F.initial;
    if(ctx.Public) {
      funFList = F.st('public ');
    }
    const funName = ctx.LIdentifier[0].image;
    funFList = F.bs(F.b(funFList, F.st('fun')), F.st(funName));
    const argFList = F.b(F.b(F.st('('), this.visit(ctx.functionArguments[0])), F.st(')'));
    funFList = F.bs(F.bs(funFList, argFList), F.st('{'));
    const scopeFList = this.visit(ctx.functionBody[0]);
    return F.ab(F.ab(funFList, F.sr(3, scopeFList)), F.st('}'));
  }

  functionArguments(ctx: FunctionArgumentsCstChildren) {
    if (ctx.pattern) {
      return chooseLineColumn(ctx.pattern.map(p => this.visit(p)));
    }
    else return F.initial;
  }

  functionBody(ctx: FunctionBodyCstChildren) {
    return this.visit(ctx.scopeExpression[0]);
  }

  infixDefinition(ctx: InfixDefinitionCstChildren) {
    let infFList = F.initial;
    if(ctx.Public) {
      infFList = F.st('public ');
    }
    infFList = F.bs(
                 F.bs(
                   F.bs(
                     F.b(infFList, F.st(ctx.Infixity[0].image)), 
                     F.st(ctx.Operator[0].image)), 
                   F.st(ctx.InfixLevel[0].image)),
                 F.st(ctx.Operator[1].image));
    const argFList = F.b(F.b(F.st('('), this.visit(ctx.functionArguments[0])), F.st(')'));
    infFList = F.bs(F.bs(infFList, argFList), F.st('{'));
    const scopeFList = this.visit(ctx.functionBody[0]);
    return F.choose(
      F.ab(F.ab(infFList, F.sr(3, scopeFList)), F.st('}')),
      F.b(F.b(infFList, F.h(scopeFList, 1)), F.st('}'))
    );
  }

  variableDefinition(ctx: VariableDefinitionCstChildren) {
    let varFList = F.initial;
    if (ctx.Var) {
      varFList = F.st('var ');
    }
    else {
      varFList = F.st('public ');
    }

    const expVariables:string[] = [];
    const justVList: F.T[] = [];
    const expressions:BasicExpressionCstNode[] = [];
    ctx.variableDefinitionItem.forEach(vdef => {
      if(vdef.children.basicExpression) {
        expVariables.push(vdef.children.LIdentifier[0].image);
        expressions.push(vdef.children.basicExpression[0]);
      }
      else {
        justVList.push(F.st(vdef.children.LIdentifier[0].image));
      }
    });
    const [justVLine, justVColumn] = returnLineColumn(justVList);
    if(expressions.length > 0) {
      let linePossible = true;
      let comment = this.extractComments(expressions[0]);
      this.funNameLen = 0;
      this.fun1ArgLen = 0;
      let exp = this.cleanVisit(expressions[0]);
      const max_len = Math.max(...expVariables.map(e => e.length));
      let shift; 
      if(this.funNameLen > 0) {
        shift = exp.lst[0].firstLineWidth - this.funNameLen - this.fun1ArgLen + max_len + 3;
      }
      else shift = 0;
      let expVColumn = F.initial;
      let expVLine = F.initial;
      if(comment != undefined) {
        const prefExpVColumn = F.cf(F.bs(F.ab(comment,F.st(expVariables[0].padEnd(max_len))), F.st('= ')), exp, shift);
        if(prefExpVColumn.lst.length == 0) {
          expVColumn = prefExpVColumn;
        }
        else {
          expVColumn = F.cf(F.bs(F.ab(comment,F.st(expVariables[0].padEnd(max_len))), F.st('= ')), exp, 0);
        }
        linePossible = false;
      }
      else {
        const prefExpVColumn = F.cf(F.bs(F.st(expVariables[0].padEnd(max_len)), F.st('= ')), exp, shift);
        if(prefExpVColumn.lst.length == 0) {
          expVColumn = F.cf(F.bs(F.st(expVariables[0].padEnd(max_len)), F.st('= ')), exp, 0);
        }
        else {
          expVColumn = prefExpVColumn;
        }
        expVLine = F.cf(F.bs(F.st(expVariables[0]), F.st('= ')), exp, shift);
      }
      for(let i = 1; i < expressions.length; i++) {
        comment = this.extractComments(expressions[i]);
        this.funNameLen = 0;
        this.fun1ArgLen = 0;
        exp = this.cleanVisit(expressions[i]);
        if(this.funNameLen > 0) {
          shift = exp.lst[0].firstLineWidth - this.funNameLen - this.fun1ArgLen + max_len + 3;
        }
        else {
          shift = 0;
        }
        if(comment != undefined) {
          const prefExpVColumn = F.ab(F.b(expVColumn, F.st(',')), 
                          F.cf(F.bs(F.ab(comment,F.st(expVariables[i].padEnd(max_len))),F.st('= ')), exp, shift)
                        );
          if(prefExpVColumn.lst.length == 0) {
            expVColumn = F.ab(F.b(expVColumn, F.st(',')), 
                          F.cf(F.bs(F.ab(comment,F.st(expVariables[i].padEnd(max_len))),F.st('= ')), exp, 0)
                        );
          }
          else {
            expVColumn = prefExpVColumn;
          }
          linePossible = false;
        }
        else {
          const prefExpVColumn = F.ab(F.b(expVColumn, F.st(',')), 
                        F.cf(F.bs(F.st(expVariables[i].padEnd(max_len)),F.st('= ')), exp, shift)
                      );
          if(prefExpVColumn.lst.length == 0) {
            expVColumn = F.ab(F.b(expVColumn, F.st(',')), 
                          F.cf(F.bs(F.st(expVariables[i].padEnd(max_len)),F.st('= ')), exp, 0)
                        );
          }
          else {
            expVColumn = prefExpVColumn;
          }
          expVLine = F.bs(F.b(F.h(expVLine, 1), F.st(',')), 
                          F.bs(F.bs(F.st(expVariables[i]),F.st('=')), exp)
                        );
        }
      }
      if(justVList.length > 0) {
        if(linePossible) {
          return F.b(F.b(varFList,
            F.choose(
              F.bs(F.b(justVLine, F.st(',')), F.h(expVLine, 1)),
              F.choose(
                F.ab(F.b(justVLine, F.st(',')), expVColumn),
                F.ab(F.b(justVColumn, F.st(',')), expVColumn)
              )
            ),
          ), F.st(';'));
        }
        else {
          return F.b(F.b(varFList, 
              F.choose(
                F.ab(F.b(justVLine, F.st(',')), expVColumn),
                F.ab(F.b(justVColumn, F.st(',')), expVColumn)
              ),
          ), F.st(';'));
        }
      }
      else {
        if(linePossible) return F.b(F.b(varFList, F.choose(expVLine, expVColumn)), F.st(';'));
        else return F.b(F.b(varFList, expVColumn), F.st(';'));
      }
    }
    else {
      return F.b(F.b(varFList, F.choose(justVLine, justVColumn)), F.st(';'));
    }
  }

  //never-called
  variableDefinitionItem(ctx: VariableDefinitionItemCstChildren) {
    let varFList = F.st(ctx.LIdentifier[0].image); 
    if(ctx.Equal && ctx.basicExpression) {
      const bExpFList = this.visit(ctx.basicExpression[0]);
      varFList = F.cf(F.bs(varFList, F.st('= ')), bExpFList, 0);
      const shift = 0;
      const prefOption = F.cf(F.bs(varFList, F.st('= ')), bExpFList, shift);
      return prefOption.lst.length > 0 ? prefOption : varFList;
    }
    return varFList;
  }

  expression(ctx: ExpressionCstChildren) {
    if(ctx.letInExpression) {
      return this.visit(ctx.letInExpression[0]);
    }
    else if(ctx.basicExpression) {
      const bexpFList = this.visit(ctx.basicExpression[0]);
      if(ctx.expression) {
        const expFList = this.visit(ctx.expression[0]);
        return F.ab(F.b(bexpFList, F.st(';')), expFList);
      }
      else return bexpFList;
    }
    return F.initial;
  }

  basicExpression(ctx: BasicExpressionCstChildren) {
    const bexpFList = this.visit(ctx.postfixExpression[0]);
    if (ctx.Operator) {
      let lineExpression = bexpFList;
      let columnExpression = bexpFList;
      for (let i = 0; i < ctx.Operator.length; i++) {
        const postFList = this.visit(ctx.postfixExpression[i+1]);
        lineExpression = F.cf(F.bs(lineExpression, F.st(ctx.Operator[i].image + ' ')), postFList, 0);
        columnExpression = F.ab(F.bs(columnExpression, F.st(ctx.Operator[i].image)), postFList);
      }
      return F.choose(lineExpression, columnExpression);
    }
    return bexpFList;
  }

  postfixExpression(ctx: PostfixExpressionCstChildren) {
    let postFList = this.visit(ctx.primary[0]);
    if(ctx.Minus) postFList = F.b(F.st('-'), postFList);
    if (ctx.postfix) {
      if(this.funNameLen == 0 && ctx.postfix[0].children.postfixCall && !ctx.postfix[0].children.LIdentifier) {
        this.funNameLen = postFList.lst[0].firstLineWidth+2;
      }
      let post = this.visit(ctx.postfix[0]);
      let linePostfix = post;
      let columnPostfix = post;
      if(ctx.postfix.length == 1) return F.cf(postFList, post, 0);
      for (let i = 1; i < ctx.postfix.length; i++) {
        post = this.visit(ctx.postfix[i]);
        linePostfix = F.b(linePostfix, post);
        columnPostfix = F.ab(columnPostfix, post);
      }
      return F.choose(F.h(F.b(postFList, linePostfix), 1), F.b(postFList, columnPostfix));
    }
    return postFList;
  }

  primary(ctx: PrimaryCstChildren) {
    if (ctx.DecimalLiteral) {
      return F.st(ctx.DecimalLiteral[0].image);
    }
    else if (ctx.StringLiteral) {
      return F.st(ctx.StringLiteral[0].image);
    }
    else if (ctx.CharLiteral) {
      return F.st(ctx.CharLiteral[0].image);
    }
    else if (ctx.BooleanLiteral) {
      return F.st(ctx.BooleanLiteral[0].image);
    }
    else if (ctx.Infix && ctx.Operator) {
      return F.st(`infix ${ctx.Operator[0].image}`); 
    }
    else if (ctx.functionArguments && ctx.functionBody) {
      let funFList = F.st('fun');
      const argFList = F.b(F.b(F.st('('), this.visit(ctx.functionArguments[0])), F.st(')'));
      funFList = F.bs(F.bs(funFList, argFList), F.st('{'));
      const scopeFList = this.visit(ctx.functionBody[0]);
      return F.choose(
        F.ab(F.ab(funFList, F.sr(3, scopeFList)), F.st('}')),
        F.b(F.b(funFList, F.h(scopeFList, 1)), F.st('}'))
      );
    }
    else if (ctx.Skip) {
      return F.st(`skip`);
    }
    else if (ctx.listExpressionBody) {
      return F.b(F.b(F.st('{'), this.visit(ctx.listExpressionBody[0])), F.st('}'));
    }
    else if (ctx.arrayExpression) {
      return this.visit(ctx.arrayExpression[0]);
    }
    else if (ctx.symbolExpression) {
      return this.visit(ctx.symbolExpression[0]);
    }
    else if (ctx.ifExpression) {
      return this.visit(ctx.ifExpression[0]);
    }
    else if (ctx.whileDoExpression) {
      return this.visit(ctx.whileDoExpression[0]);
    }
    else if (ctx.doWhileExpression) {
      return this.visit(ctx.doWhileExpression[0]);
    }
    else if (ctx.forExpression) {
      return this.visit(ctx.forExpression[0]);
    }
    else if (ctx.caseExpression) {
      return this.visit(ctx.caseExpression[0]);
    }
    else if (ctx.lazyExpression) {
      return this.visit(ctx.lazyExpression[0]);
    }
    else if (ctx.etaExpression) {
      return this.visit(ctx.etaExpression[0]);
    }
    else if (ctx.syntaxExpression) {
      return this.visit(ctx.syntaxExpression[0]);
    }
    else if (ctx.scopeExpression) {
      const scopeFList = this.visit(ctx.scopeExpression[0]);
      return F.choose(
        F.ab(F.ab(F.st('('), F.sr(3, scopeFList)), F.st(')')),
        F.b(F.b(F.st('('), F.h(scopeFList, 1)), F.st(')'))
      );
    }
    else if (ctx.LIdentifier) {
      return F.st(ctx.LIdentifier[0].image);
    }
    return F.initial;
  }

  arrayExpression(ctx: ArrayExpressionCstChildren) {
    if(ctx.expression) {
      return F.b(F.b(F.st('['), chooseLineColumn(ctx.expression.map(exp => this.visit(exp)))), F.st(']'));
    }
    else {
      return F.st('[]');
    }
  }

  listExpressionBody(ctx: ListExpressionBodyCstChildren) {
    if(ctx.expression) {
      return chooseLineColumn(ctx.expression.map(e => this.visit(e)));
    }
    return F.initial;
  }

  symbolExpression(ctx: SymbolExpressionCstChildren) {
    let sexpFList = F.st(ctx.UIdentifier[0].image);
    if(ctx.expression) {
      sexpFList = F.b(sexpFList, F.b(F.b(F.st('('),chooseLineColumn(ctx.expression.map(e => this.visit(e)))), F.st(')')));
    }
    return sexpFList;
  }

  ifExpression(ctx: IfExpressionCstChildren) {
    const ifPart = F.bs(F.st('if'), this.visit(ctx.expression[0]));
    const thenPart = F.bs(F.st('then'), this.visit(ctx.scopeExpression[0]));
    const firstPart = F.choose(
      F.ab(ifPart, thenPart),
      F.bs(F.h(ifPart, 1), F.h(thenPart, 1))
    );
    if (ctx.elsePart) {
      const elsePart = this.visit(ctx.elsePart[0]);
      return F.choose(
        F.ab(F.ab(firstPart, elsePart), F.st('fi')),
        F.bs(F.bs(F.h(firstPart, 1), F.h(elsePart, 1)), F.st('fi'))
      );
    }
    else {
      return F.choose(
        F.ab(firstPart, F.st('fi')),
        F.bs(F.h(firstPart, 1), F.st('fi'))
      );
    }
  }

  elsePart(ctx: ElsePartCstChildren) {
    if(ctx.expression && ctx.scopeExpression) {
      const elifPart = F.bs(F.st('elif'), this.visit(ctx.expression[0]));
      const thenPart = F.bs(F.st('then'), this.visit(ctx.scopeExpression[0]));
      const firstPart = F.choose(
        F.ab(elifPart, thenPart),
        F.bs(F.h(elifPart, 1), F.h(thenPart, 1))
      );
      if (ctx.elsePart) {
        const elsePart = this.visit(ctx.elsePart[0]);
        return F.choose(
          F.ab(firstPart, elsePart),
          F.bs(F.h(firstPart, 1), F.h(elsePart, 1))
        );
      }
      else {
        return firstPart;
      }
    }
    else if(ctx.Else && ctx.scopeExpression) {
      return F.bs(F.st('else'), this.visit(ctx.scopeExpression[0]));
    }
    return F.initial;
  }

  whileDoExpression(ctx: WhileDoExpressionCstChildren) {
    const whilePart = F.bs(F.bs(F.st('while'), this.visit(ctx.expression[0])), F.st('do'));
    const scopePart = this.visit(ctx.scopeExpression[0]);
    return F.choose(
      F.bs(F.bs(F.h(whilePart, 1), F.h(scopePart, 1)), F.st('od')),
      F.ab(F.ab(whilePart, F.sr(3, scopePart)), F.st('od'))
    );
  }

  doWhileExpression(ctx: DoWhileExpressionCstChildren) {
    const whilePart = F.bs(F.bs(F.st('while'), this.visit(ctx.expression[0])), F.st('od'));
    const scopePart = this.visit(ctx.scopeExpression[0]);
    return F.choose(
      F.bs(F.bs(F.st('do'), F.h(scopePart, 1)), F.h(whilePart, 1)),
      F.ab(F.ab(F.st('do'), F.sr(3, scopePart)), whilePart)
    );
  }

  forExpression(ctx: ForExpressionCstChildren) {
    const conditionPart = chooseLineColumn([this.visit(ctx.scopeExpression[0]), this.visit(ctx.expression[0]), this.visit(ctx.expression[1])]);
    const forPart = F.bs(F.bs(F.st('for'), conditionPart), F.st('do'));
    const scopePart = this.visit(ctx.scopeExpression[1]);
    return F.choose(
      F.bs(F.bs(F.h(forPart, 1), F.h(scopePart, 1)), F.st('od')),
      F.ab(F.ab(forPart, F.sr(3, scopePart)), F.st('od'))
    );
  }

  letInExpression(ctx: LetInExpressionCstChildren) {
    const expFList = F.bs(F.bs(this.visit(ctx.pattern[0]), F.st('=')), this.visit(ctx.expression[0]));
    const lexpFList = F.bs(F.bs(F.st('let'), expFList), F.st('in'));
    const exp2FList = this.visit(ctx.expression[1]);
    return F.choose(
      F.bs(lexpFList, F.h(exp2FList, 1)),
      F.ab(lexpFList, F.sr(3, exp2FList))
    );
  }

  caseExpression(ctx: CaseExpressionCstChildren) {
    let cexpFList = F.bs(F.bs(F.st('case'), this.visit(ctx.expression[0])), F.st('of'));
    const patternList = [];
    const commentList = [];
    commentList.push(this.extractComments(ctx.pattern[0]));
    patternList.push(this.cleanVisit(ctx.pattern[0]));
    ctx.caseBranchPrefix?.forEach(cb => {
      commentList.push(this.extractComments(cb));
      patternList.push(this.cleanVisit(cb));
      });
    const max_len = Math.max(...patternList.map(p => F.toString(p).length));
    let pattern: F.T = F.initial;
    const comment = commentList[0];
    if(comment != undefined) {
      pattern = F.sr(2, F.ab(comment, F.st(F.toString(patternList[0]).padEnd(max_len))));
    }
    else {
      pattern = F.sr(2, F.st(F.toString(patternList[0]).padEnd(max_len)));
    }
    cexpFList = F.bs(F.bs(F.ab(cexpFList, 
                               pattern),
                          F.st('->')),
                     this.visit(ctx.scopeExpression[0]));
    if(ctx.caseBranchPrefix) {
      for(let i = 0; i < ctx.caseBranchPrefix.length; i++) {
        const comment = commentList[i+1];
        if(comment != undefined) {
          pattern = F.bs(F.st('|'), F.ab(comment, F.st(F.toString(patternList[i+1]).padEnd(max_len))));
        }
        else {
          pattern = F.bs(F.st('|'), F.st(F.toString(patternList[i+1]).padEnd(max_len)));
        }
        cexpFList = F.bs(F.bs(F.ab(cexpFList, 
                                   pattern),
                              F.st('->')),
                         this.visit(ctx.scopeExpression[i+1]));
      }
    }
    return F.ab(cexpFList, F.st('esac'));
  }

  caseBranchPrefix(ctx: CaseBranchPrefixCstChildren) {
    return this.visit(ctx.pattern[0]);
  }

  lazyExpression(ctx: LazyExpressionCstChildren) {
    return F.cf(F.st('lazy '), this.visit(ctx.basicExpression[0]), 0);
  }

  etaExpression(ctx: EtaExpressionCstChildren) {
    return F.cf(F.st('eta '), this.visit(ctx.basicExpression[0]), 0);
  }

  syntaxExpression(ctx: SyntaxExpressionCstChildren) {
    const syntaxFList = F.bs(F.st('syntax'), F.st('('));
    let bodyFList = this.visit(ctx.syntaxSeq[0]);
    for (let i = 1; i < ctx.syntaxSeq.length; i++) {
      bodyFList = F.abb(F.bs(bodyFList, F.st('|')), this.visit(ctx.syntaxSeq[i]));
    }
    return F.choose(
      F.b(F.b(F.bs(F.st('syntax'), F.st('(')), F.h(bodyFList, 1)), F.st(')')),
      F.ab(F.ab(syntaxFList, F.sr(2, bodyFList)), F.st(')'))
    );
  }

  syntaxSeq(ctx: SyntaxSeqCstChildren) {
    let bindingPart = this.visit(ctx.syntaxBinding[0]);
    for(let i = 1; i < ctx.syntaxBinding.length; i++) {
      bindingPart = F.bs(bindingPart, this.visit(ctx.syntaxBinding[i]));
    }
    if(ctx.scopeExpression) {
      const scopePart = this.visit(ctx.scopeExpression[0]);
      return F.choose(
        F.b(F.bs(F.h(bindingPart, 1), F.b(F.st('{'), F.h(scopePart, 1))), F.st('}')),
        F.ab(F.ab(F.bs(bindingPart, F.st('{')), F.sr(3, scopePart)), F.st('}'))
      );
    }
    else return bindingPart;
  }

  curlyScopeExpression(ctx: CurlyScopeExpressionCstChildren) {
    return F.initial;
  }

  syntaxBinding(ctx: SyntaxBindingCstChildren) {
    let prePart = F.initial;
    if(ctx.Minus) prePart = F.st('-');
    if(ctx.pattern) prePart = F.b(F.b(prePart, this.visit(ctx.pattern[0])), F.st('='));
    return F.b(prePart, this.visit(ctx.syntaxPostfix[0]));
  }

  syntaxPostfix(ctx: SyntaxPostfixCstChildren) {
    const primaryPart = this.visit(ctx.syntaxPrimary[0]);
    if(ctx.Plus) return F.b(primaryPart, F.st('+'));
    else if(ctx.Star) return F.b(primaryPart, F.st('*'));
    else if(ctx.Question) return F.b(primaryPart, F.st('?'));
    else return primaryPart;
  }

  syntaxPrimary(ctx: SyntaxPrimaryCstChildren) {
    if(ctx.LIdentifier && ctx.expression) {
      //WARNING: only one []. doesn't work for [][][] 
      return F.b(F.b(F.b(F.st(ctx.LIdentifier[0].image), F.st('[')), chooseLineColumn(ctx.expression.map(e => this.visit(e)))), F.st(']'));
    }
    else if(ctx.LIdentifier) {
      return F.st(ctx.LIdentifier[0].image);
    }
    else if(ctx.syntaxSeq) {
      return F.b(F.b(F.st('('), this.visit(ctx.syntaxSeq[0])), F.st(')'));
    }
    else if(ctx.Dollar && ctx.expression) {
      return F.b(F.b(F.b(F.st('$'), F.st('(')), this.visit(ctx.expression[0])), F.st(')'));
    }
    return F.initial;
  }

  postfix(ctx: PostfixCstChildren) {
    if(ctx.Length) {
      return F.st('.length');
    }
    else if(ctx.String) {
      return F.st('.string');
    }
    else if(ctx.postfixCall && !ctx.LIdentifier) {
      return this.visit(ctx.postfixCall[0]);
    }
    else if(ctx.postfixIndex) {
      return this.visit(ctx.postfixIndex[0]);
    }
    else if(ctx.LIdentifier) {
      return F.b(F.st(`.${ctx.LIdentifier[0].image}`),(ctx.postfixCall ? this.visit(ctx.postfixCall[0]) : F.initial));
    }
    return F.initial;
  }

  postfixCall(ctx: PostfixCallCstChildren) {
    if(ctx.expression) {
      const exp0 = this.visit(ctx.expression[0]);
      if(this.fun1ArgLen == 0) {
        this.fun1ArgLen = exp0.lst[0].firstLineWidth;
      }
      return F.cf(F.st('('), F.b(chooseLineColumn(ctx.expression.map(exp => this.visit(exp))), F.st(')')), 2);
    }
    else {
      return F.st('()');
    }
  }

  postfixIndex(ctx: PostfixIndexCstChildren) {
    return F.b(F.b(F.st('['), this.visit(ctx.expression[0])), F.st(']'));
  }

  pattern(ctx: PatternCstChildren) {
    const pattern = this.visit(ctx.simplePattern[0]);
    if(ctx.pattern) {
      return F.bs(F.b(pattern, F.st(':')), this.visit(ctx.pattern[0]));
    }
    else return pattern;
  }

  simplePattern(ctx: SimplePatternCstChildren) {
    if(ctx.Underscore) {
      return F.st('_');
    }
    else if(ctx.sExprPattern) {
      return this.visit(ctx.sExprPattern[0]);
    }
    else if(ctx.arrayPattern) {
      return this.visit(ctx.arrayPattern[0]);
    }
    else if(ctx.listPattern) {
      return this.visit(ctx.listPattern[0]);
    }
    else if(ctx.asPattern) {
      return this.visit(ctx.asPattern[0]);
    }
    else if(ctx.DecimalLiteral) {
      return F.st(ctx.DecimalLiteral[0].image);
    }
    else if(ctx.StringLiteral) {
      return F.st(ctx.StringLiteral[0].image);
    }
    else if(ctx.CharLiteral) {
      return F.st(ctx.CharLiteral[0].image);
    }
    else if(ctx.BooleanLiteral) {
      return F.st(ctx.BooleanLiteral[0].image);
    }
    else if(ctx.Hash && ctx.Shape) {
      return F.st(`#${ctx.Shape[0].image}`);
    }
    else if(ctx.pattern) {
      return F.b(F.b(F.st('('), this.visit(ctx.pattern[0])), F.st(')'));
    }
    return F.initial;
  }

  sExprPattern(ctx: SExprPatternCstChildren) {
    const sexpFList = F.st(ctx.UIdentifier[0].image);
    if(ctx.pattern) {
      return F.b(F.b(F.b(sexpFList, F.st('(')), chooseLineColumn(ctx.pattern.map(p => this.visit(p)))), F.st(')'));
    } 
    else return sexpFList;
  }

  arrayPattern(ctx: ArrayPatternCstChildren) {
    if(ctx.pattern) {
      return F.b(F.b(F.st('['), chooseLineColumn(ctx.pattern.map(p => this.visit(p)))), F.st(']'));
    }
    else {
      return F.st('[]');
    }
  }

  listPattern(ctx: ListPatternCstChildren) {
    if(ctx.pattern) {
      return F.b(F.b(F.st('{'), chooseLineColumn(ctx.pattern.map(p => this.visit(p)))), F.st('}'));
    }
    else {
      return F.st('{}');
    }
  }

  asPattern(ctx: AsPatternCstChildren) {
    let apFList = F.st(ctx.LIdentifier[0].image);
    if(ctx.AtSign && ctx.pattern) {
      apFList = F.b(apFList, F.b(F.st('@'), this.visit(ctx.pattern[0])));
    }
    else if(ctx.AtHash && ctx.Shape) {
      apFList = F.b(apFList, F.st(`@#${ctx.Shape[0].image}`));
    }
    return apFList;
  }
}