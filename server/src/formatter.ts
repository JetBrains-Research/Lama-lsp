import { IToken, CstNode } from 'chevrotain';
import { LamaParser } from './parser';
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
} from './lama_cst';
import { DocumentUri } from 'vscode-languageserver-textdocument';

export function formatTextDocument(initNode: CstNode, filePath: string, comments: IToken[] | undefined): string {
	const formatterVisitor = new FormatterVisitor(filePath, prepareComments(comments));
	return formatterVisitor.visit(initNode, "");
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

export class FormatterVisitor extends BaseLamaVisitor implements ICstNodeVisitor<string, string> {

  constructor(
    public documentUri: DocumentUri,
    public comments: [number, string][]
  ) {
    super();
    this.validateVisitor();
  }

  curIdx = 0;
  N = this.comments.length;

  visit(node: CstNode, indent: string): string {
    const oneline = (indent == 'oneline');
    const commentList: string[] = []; 
    if(node.location?.startLine && this.curIdx < this.N) {
      while(this.curIdx < this.N && node.location.startLine > this.comments[this.curIdx][0]) {
        commentList.push(this.comments[this.curIdx][1] + '\n' + indent);
        this.curIdx += 1;
      }
    }
    const nodeText = oneline ? super.visit(node, '') : super.visit(node, indent);
    if(oneline) {
      return commentList.join('') + (nodeText as string).replace(/\n/g, ''); 
    }
    else return commentList.join('') + nodeText;
  }

	compilationUnit(ctx: CompilationUnitCstChildren, indent: string) {
		let formattedText = "";
		if (ctx.UIdentifier) {
			for (let i = 0; i < ctx.UIdentifier.length; i++) {
				formattedText += `import ${ctx.UIdentifier[i].image};\n${indent}`;
			}
      formattedText += "\n" + indent;
		}
		return formattedText + this.visit(ctx.scopeExpression[0], indent);
	}

  scopeExpression(ctx: ScopeExpressionCstChildren, indent: string) {
    if (ctx.definition && ctx.expression) {
      const formattedText = ctx.definition.map(def => this.visit(def, indent)).join("\n\n"+indent);
      return formattedText + "\n\n" + indent + this.visit(ctx.expression[0], indent);
    }
    else if (ctx.expression) {
      return this.visit(ctx.expression[0], indent);
    }
    else if (ctx.definition) {
      return ctx.definition.map(def => this.visit(def, indent)).join("\n\n"+indent);
    }
    return "";
  }

  definition(ctx: DefinitionCstChildren, indent: string) {
    if (ctx.functionDefinition) {
      return this.visit(ctx.functionDefinition[0], indent);
    }
    else if (ctx.infixDefinition) {
      return this.visit(ctx.infixDefinition[0], indent);
    }
    else if (ctx.variableDefinition) {
      return this.visit(ctx.variableDefinition[0], indent);
    }
    return "";
  }

  functionDefinition(ctx: FunctionDefinitionCstChildren, indent: string) {
    let formattedText = "";
    if(ctx.Public) {
      formattedText += "public ";
    }
    const funName = ctx.LIdentifier[0].image;
    formattedText += `fun ${funName} (${this.visit(ctx.functionArguments[0], " ".repeat(6+funName.length))}) `;
    formattedText += "{\n" + indent+"\t" + this.visit(ctx.functionBody[0], indent+"\t") + "\n" + indent + "}";
    return formattedText;
  }

  functionArguments(ctx: FunctionArgumentsCstChildren, indent: string) {
    if(ctx.pattern) {
      return ctx.pattern.map(farg => this.visit(farg, indent)).join(", ");
    }
    return "";
  }

  functionBody(ctx: FunctionBodyCstChildren, indent: string) {
    return this.visit(ctx.scopeExpression[0], indent);
  }

  infixDefinition(ctx: InfixDefinitionCstChildren, indent: string) {
    let formattedText = indent;
    if(ctx.Public) {
      formattedText += "public ";
    }
    formattedText += `${ctx.Infixity[0].image} ${ctx.Operator[0].image} ${ctx.InfixLevel[0].image} ${ctx.Operator[1].image} `;
    formattedText += `(${this.visit(ctx.functionArguments[0], " ".repeat(1+formattedText.length))}) `;
    formattedText += "{\n" + indent+"\t" + this.visit(ctx.functionBody[0], indent+"\t") + "\n" + indent + "}";
    return formattedText;
  }

  variableDefinition(ctx: VariableDefinitionCstChildren, indent: string) {
    let formattedText = "";
    if (ctx.Var) {
      formattedText += "var ";
      indent += "    ";
    }
    else {
      formattedText += "public ";
      indent += "       ";
    }
    // formattedText += ctx.variableDefinitionItem.map(vdef => this.visit(vdef,indent)).join(",\n" + indent);
    const expVariables:string[] = [];
    const justVariables:string[] = [];
    const expressions:BasicExpressionCstNode[] = [];
    ctx.variableDefinitionItem.forEach(vdef => {
      if(vdef.children.basicExpression) {
        expVariables.push(vdef.children.LIdentifier[0].image);
        expressions.push(vdef.children.basicExpression[0]);
      }
      else {
        justVariables.push(vdef.children.LIdentifier[0].image);
      }
    });
    const max_len = Math.max(...expVariables.map(e => e.length));
    const expList: string[] = [];
    for(let i = 0; i < expressions.length; i++) {
      expList.push(expVariables[i].padEnd(max_len) + ` = ${this.visit(expressions[i], indent+' '.repeat(3 + max_len))}`);
    }
    if(justVariables.length > 0 && expressions.length > 0) {
      return formattedText + justVariables.join(', ') + ',\n' + indent + expList.join(`,\n${indent}`) + ';';
    }
    else if(justVariables.length > 0) {
      return formattedText + justVariables.join(', ') + ';';
    }
    else {
      return formattedText + expList.join(`,\n${indent}`) + ';';
    }
  }

  variableDefinitionItem(ctx: VariableDefinitionItemCstChildren, indent: string) {
    // return ctx.LIdentifier[0].image + (ctx.basicExpression ? " = " + this.visit(ctx.basicExpression[0], indent+" ".repeat(3+ctx.LIdentifier[0].image.length)) : "");
    return '';
  }

  expression(ctx: ExpressionCstChildren, indent: string) {
    if(ctx.letInExpression) {
      return this.visit(ctx.letInExpression[0], indent);
    }
    else if(ctx.basicExpression) {
      return this.visit(ctx.basicExpression[0], indent) + (ctx.expression ? ";\n" + indent + this.visit(ctx.expression[0], indent) : "");
    }
    return "";
  }

  basicExpression(ctx: BasicExpressionCstChildren, indent: string) {
    let formattedText = this.visit(ctx.postfixExpression[0], indent);
    if (ctx.Operator) {
      for (let i = 0; i < ctx.Operator.length; i++) {
        const opName = ctx.Operator[i].image;
        formattedText += " " + opName + " " + this.visit(ctx.postfixExpression[i+1], indent + " ".repeat(formattedText.length+2+opName.length));
      }
    }
    return formattedText;
  }

  postfixExpression(ctx: PostfixExpressionCstChildren, indent: string) {
    let formattedText = (ctx.Minus ? "-" : "") + this.visit(ctx.primary[0], indent);
    if (ctx.postfix) {
      for (let i = 0; i < ctx.postfix.length; i++) {
        formattedText += this.visit(ctx.postfix[i],indent + " ".repeat(formattedText.length));
      }
    }
    return formattedText;
  }

  primary(ctx: PrimaryCstChildren, indent: string) {
    if (ctx.DecimalLiteral) {
      return ctx.DecimalLiteral[0].image;
    }
    else if (ctx.StringLiteral) {
      return ctx.StringLiteral[0].image;
    }
    else if (ctx.CharLiteral) {
      return ctx.CharLiteral[0].image;
    }
    else if (ctx.BooleanLiteral) {
      return ctx.BooleanLiteral[0].image;
    }
    else if (ctx.Infix && ctx.Operator) {
      return `$infix ${ctx.Operator[0].image}`; 
    }
    else if (ctx.functionArguments && ctx.functionBody) {
      return `fun (${this.visit(ctx.functionArguments[0], indent+" ".repeat(5))}) {\n${indent+"\t"+this.visit(ctx.functionBody[0], indent+'\t')}\n${indent}}`;
    }
    else if (ctx.Skip) {
      return `skip`;
    }
    else if (ctx.listExpressionBody) {
      return `{${this.visit(ctx.listExpressionBody[0], "")}}`;
    }
    else if (ctx.arrayExpression) {
      return this.visit(ctx.arrayExpression[0], indent);
    }
    else if (ctx.symbolExpression) {
      return this.visit(ctx.symbolExpression[0], "");
    }
    else if (ctx.ifExpression) {
      return this.visit(ctx.ifExpression[0], indent);
    }
    else if (ctx.whileDoExpression) {
      return this.visit(ctx.whileDoExpression[0], indent);
    }
    else if (ctx.doWhileExpression) {
      return this.visit(ctx.doWhileExpression[0], indent);
    }
    else if (ctx.forExpression) {
      return this.visit(ctx.forExpression[0], indent);
    }
    else if (ctx.caseExpression) {
      return this.visit(ctx.caseExpression[0], indent);
    }
    else if (ctx.lazyExpression) {
      return this.visit(ctx.lazyExpression[0], indent);
    }
    else if (ctx.etaExpression) {
      return this.visit(ctx.etaExpression[0], indent);
    }
    else if (ctx.syntaxExpression) {
      return this.visit(ctx.syntaxExpression[0], indent);
    }
    else if (ctx.scopeExpression) {
      // return `${indent}(\n${this.visit(ctx.scopeExpression, indent)}\n${indent})`;
      return `(\n${indent+"\t"}${this.visit(ctx.scopeExpression[0], indent+"\t")}\n${indent})`;
    }
    else if (ctx.LIdentifier) {
      return ctx.LIdentifier[0].image;
    }
    return "";
  }

  arrayExpression(ctx: ArrayExpressionCstChildren, indent: string) {
    if(ctx.expression) {
      return `[${ctx.expression.map(exp => this.visit(exp,indent+" ")).join(", ")}]`;
    }
    else {
      return `[]`;
    }
  }

  listExpressionBody(ctx: ListExpressionBodyCstChildren) {
    if(ctx.expression) {
      return ctx.expression.map(e => this.visit(e,"")).join(", ");
    }
    return "";
  }

  symbolExpression(ctx: SymbolExpressionCstChildren) {
    let formattedText = `${ctx.UIdentifier[0].image}`;
    if(ctx.expression) {
      formattedText += `(${ctx.expression.map(e => this.visit(e,"")).join(", ")})`;
    }
    return formattedText;
  }

  ifExpression(ctx: IfExpressionCstChildren, indent: string) {
    return `if ${this.visit(ctx.expression[0], indent)} then\n${indent+'\t'}${this.visit(ctx.scopeExpression[0], indent+'\t')}` +
            (ctx.elsePart ? `\n${indent}${this.visit(ctx.elsePart[0], indent)}` : "") + `\n${indent}fi`;
  }

  elsePart(ctx: ElsePartCstChildren, indent: string) {
    if(ctx.expression && ctx.scopeExpression) {
      return `elif ${this.visit(ctx.expression[0], "")} then\n${indent+"\t"}${this.visit(ctx.scopeExpression[0], indent+'\t')}` +
              (ctx.elsePart ? `\n${indent}${this.visit(ctx.elsePart[0], indent)}` : "");
    }
    else if(ctx.Else && ctx.scopeExpression) {
      return `else\n${indent + "\t" + this.visit(ctx.scopeExpression[0], indent+"\t")}`;
    }
    return "";
  }

  whileDoExpression(ctx: WhileDoExpressionCstChildren, indent: string) {
    return `while ${this.visit(ctx.expression[0], "")} do\n${indent+"\t"+this.visit(ctx.scopeExpression[0], indent+'\t')}\n${indent}od`;
  }

  doWhileExpression(ctx: DoWhileExpressionCstChildren, indent: string) {
    return `do\n${indent+"\t"+this.visit(ctx.scopeExpression[0], indent+'\t')}\n${indent}while ${this.visit(ctx.expression[0], "")}\n${indent}od`;
  }

  forExpression(ctx: ForExpressionCstChildren, indent: string) {
    let formattedText = "";
    // formattedText += `for ${this.visit(ctx.scopeExpression[0], indent + " ".repeat(4))}, `;
    formattedText += `for ${this.visit(ctx.scopeExpression[0], 'oneline')}, `;
    formattedText += `${this.visit(ctx.expression[0], "")}, ${this.visit(ctx.expression[1], "")} do\n`;
    return formattedText + `${indent+"\t"+this.visit(ctx.scopeExpression[1], indent+'\t')}\n${indent}od`;
  }

  letInExpression(ctx: LetInExpressionCstChildren, indent: string) {
    return `let ${this.visit(ctx.pattern[0], "")} = ${this.visit(ctx.expression[0], "")} in\n${indent+'\t'}${this.visit(ctx.expression[1],indent+"\t")}`;
  }

  caseExpression(ctx: CaseExpressionCstChildren, indent: string) {
    let formattedText = `case ${this.visit(ctx.expression[0], indent + " ".repeat(5))} of\n${indent}  `;
    const patternList = [];
    patternList.push(this.visit(ctx.pattern[0], ""));
    ctx.caseBranchPrefix?.forEach(cb => patternList.push(this.visit(cb,"")));
    const max_len = Math.max(...patternList.map(p=>p.length));
    formattedText += `${patternList[0].padEnd(max_len)} -> ${this.visit(ctx.scopeExpression[0], indent+" ".repeat(6+max_len))}`;
    if(ctx.caseBranchPrefix) {
      for(let i = 0; i < ctx.caseBranchPrefix.length; i++) {
        formattedText += `\n${indent}| ${patternList[i+1].padEnd(max_len)} -> ${this.visit(ctx.scopeExpression[i+1],indent+" ".repeat(6+max_len))}`;
      }
    }
    return formattedText + `\n${indent}esac`;
  }

  caseBranchPrefix(ctx: CaseBranchPrefixCstChildren, indent: string) {
    return this.visit(ctx.pattern[0], indent);
  }

  lazyExpression(ctx: LazyExpressionCstChildren, indent: string) {
    return `lazy ${this.visit(ctx.basicExpression[0], indent)}`;
  }

  etaExpression(ctx: EtaExpressionCstChildren, indent: string) {
    return `eta ${this.visit(ctx.basicExpression[0], indent)}`;
  }

  syntaxExpression(ctx: SyntaxExpressionCstChildren, indent: string) {
    return `syntax (${ctx.syntaxSeq.map(s => this.visit(s, indent+" ".repeat(8))).join(' |\n'+indent+" ".repeat(8))})`;
  }

  syntaxSeq(ctx: SyntaxSeqCstChildren, indent: string) {
    let formattedText = `${ctx.syntaxBinding.map(b => this.visit(b, indent)).join(' ')}`;
    if(ctx.scopeExpression) {
      formattedText += ` {\n${indent+"\t"+this.visit(ctx.scopeExpression[0], indent+'\t')+"\n"+indent}}`;
    }
    return formattedText;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  curlyScopeExpression(ctx: CurlyScopeExpressionCstChildren) {
	return "";
  }

  syntaxBinding(ctx: SyntaxBindingCstChildren, indent: string) {
    let formattedText = "";
    if(ctx.Minus) formattedText += "-";
    if(ctx.pattern) formattedText += `${this.visit(ctx.pattern[0],indent)} = `;
    formattedText += this.visit(ctx.syntaxPostfix[0],indent);
    return formattedText;
  }

  syntaxPostfix(ctx: SyntaxPostfixCstChildren, indent: string) {
    let formattedText = this.visit(ctx.syntaxPrimary[0], indent);
    if(ctx.Plus) formattedText += "+";
    else if(ctx.Star) formattedText += "*";
    else if(ctx.Question) formattedText += "?";
    return formattedText;
  }

  syntaxPrimary(ctx: SyntaxPrimaryCstChildren, indent: string) {
    if(ctx.LIdentifier && ctx.expression) {
      //WARNING: only one []. doesn't work for [][][] 
      return `${ctx.LIdentifier[0].image}[${ctx.expression.map(e => this.visit(e, indent)).join(", ")}]`;
    }
    else if(ctx.LIdentifier) {
      return ctx.LIdentifier[0].image;
    }
    else if(ctx.syntaxSeq) {
      return `(${this.visit(ctx.syntaxSeq[0], indent)})`;
    }
    else if(ctx.Dollar && ctx.expression) {
      return `$(${this.visit(ctx.expression[0], indent)})`;
    }
    return "";
  }

  postfix(ctx: PostfixCstChildren, indent: string) {
    if(ctx.Length) {
      return ".length";
    }
    else if(ctx.String) {
      return ".string";
    }
    else if(ctx.postfixCall && !ctx.LIdentifier) {
      return this.visit(ctx.postfixCall[0], indent);
    }
    else if(ctx.postfixIndex) {
      return this.visit(ctx.postfixIndex[0],"");
    }
    else if(ctx.LIdentifier) {
      return `.${ctx.LIdentifier[0].image}` + (ctx.postfixCall ? this.visit(ctx.postfixCall[0],"") : "");
    }
    return "";
  }

  postfixCall(ctx: PostfixCallCstChildren, indent: string) {
    if(ctx.expression) {
      return `(${ctx.expression.map(exp => this.visit(exp,indent+" ")).join(", ")})`;
    }
    else {
      return "()";
    }
  }

  postfixIndex(ctx: PostfixIndexCstChildren) {
    return `[${this.visit(ctx.expression[0],"")}]`;
  }

  /// PATTERNS

  pattern(ctx: PatternCstChildren) {
    return this.visit(ctx.simplePattern[0],"") + (ctx.pattern ? `:${this.visit(ctx.pattern[0],"")}` : "");
  }

  simplePattern(ctx: SimplePatternCstChildren, indent: string) {
    if(ctx.Underscore) {
      return "_";
    }
    else if(ctx.sExprPattern) {
      return this.visit(ctx.sExprPattern[0], "");
    }
    else if(ctx.arrayPattern) {
      return this.visit(ctx.arrayPattern[0], "");
    }
    else if(ctx.listPattern) {
      return this.visit(ctx.listPattern[0], "");
    }
    else if(ctx.asPattern) {
      return this.visit(ctx.asPattern[0], "");
    }
    else if(ctx.DecimalLiteral) {
      return ctx.DecimalLiteral[0].image;
    }
    else if(ctx.StringLiteral) {
      return ctx.StringLiteral[0].image;
    }
    else if(ctx.CharLiteral) {
      return ctx.CharLiteral[0].image;
    }
    else if(ctx.BooleanLiteral) {
      return ctx.BooleanLiteral[0].image;
    }
    else if(ctx.Hash && ctx.Shape) {
      return `#${ctx.Shape[0].image}`;
    }
    else if(ctx.pattern) {
      return `(${this.visit(ctx.pattern[0],"")})`;
    }
    return "";
  }

  sExprPattern(ctx: SExprPatternCstChildren) {
    let formattedText = `${ctx.UIdentifier[0].image}`;
    if(ctx.pattern) {
      formattedText += `(${ctx.pattern.map(p => this.visit(p,"")).join(", ")})`;
    }
    return formattedText;
  }

  arrayPattern(ctx: ArrayPatternCstChildren) {
    if(ctx.pattern) {
      return `[${ctx.pattern.map(p => this.visit(p,"")).join(", ")}]`;
    }
    else {
      return "[]";
    }
  }

  listPattern(ctx: ListPatternCstChildren) {
    if(ctx.pattern) {
      return `{${ctx.pattern.map(p => this.visit(p,"")).join(", ")}}`;
    }
    else {
      return "{}";
    }
  }

  asPattern(ctx: AsPatternCstChildren) {
    let formattedText = ctx.LIdentifier[0].image;
    if(ctx.AtSign && ctx.pattern) {
      formattedText += `@${this.visit(ctx.pattern[0],"")}`;
    }
    else if(ctx.AtHash && ctx.Shape) {
      formattedText += `@#${ctx.Shape[0].image}`;
    }
    return formattedText;
  }
}
