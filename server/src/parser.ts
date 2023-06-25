import { EmbeddedActionsParser, CstParser, CstElement, CstNode, IToken, ILexingError, ILexingResult, Rule} from 'chevrotain'
import Tokens, { vocabulary, lexer } from './lexer'
import { Node, Data, Position, Point, Parent, Literal } from 'unist'
import * as node from 'unist-builder'

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

function getPosition (...args: IToken[]): Position {
  const first = args[0]
  const last = args[args.length - 1]
  return {
    start: getStartPoint(first),
    end: getEndPoint(last)
  }
}

const debug = process.env.NODE_ENV === 'development'

export class LamaParser extends CstParser {

  public lexingResult?: ILexingResult

  public static reset (parser: LamaParser): void {
    parser.reset()
  }

  constructor () {
    super(vocabulary, {
      traceInitPerf: debug, // false for production
      skipValidations: !debug, // true for production
      recoveryEnabled: true,
      nodeLocationTracking: 'full'
    })
    this.performSelfAnalysis()
  }

  public parse (text: string): CstNode {
    this.lexingResult = lexer.tokenize(text)
    this.input = this.lexingResult.tokens
    return this.compilationUnit()
  }

  public lex (text: string): any{
    console.log(lexer.tokenize(text).tokens)
  }

  private readonly compilationUnit = this.RULE('compilationUnit', () => {
    this.MANY(() => {
      this.CONSUME(Tokens.Import)
      this.CONSUME(Tokens.UIdentifier)
      this.CONSUME(Tokens.Semicolon)
    })
    this.SUBRULE(this.scopeExpression)
  }) 

  private readonly scopeExpression = this.RULE('scopeExpression', () => {
    this.MANY(() => {
      this.SUBRULE(this.definition)
    })
    this.OPTION(() => {
      this.SUBRULE(this.expression)
    })
  })

  private readonly definition = this.RULE('definition', () => {
    this.OR([
      {
        ALT: () => {
          this.SUBRULE(this.functionDefinition)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.infixDefinition)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.variableDefinition)
        }
      }
    ])
  })

  private readonly functionDefinition = this.RULE('functionDefinition', () => {
    this.OPTION(() => {
      this.CONSUME(Tokens.Public)
    })
    this.CONSUME(Tokens.Fun)
    this.CONSUME(Tokens.LIdentifier)
    this.CONSUME(Tokens.LRound)
    this.SUBRULE(this.functionArguments)
    this.CONSUME(Tokens.RRound)
    this.SUBRULE(this.functionBody)
  })

  private readonly functionArguments = this.RULE('functionArguments', () => {
    this.MANY_SEP({
      SEP: Tokens.Comma,
      DEF: () => {
        this.SUBRULE(this.pattern)
      }
    })
  })

  private readonly functionBody = this.RULE('functionBody', () => {
    this.CONSUME(Tokens.LCurly)
    this.SUBRULE(this.scopeExpression)
    this.CONSUME(Tokens.RCurly)
  })

  private readonly infixDefinition = this.RULE('infixDefinition', () => {
    this.OPTION(() => {
      this.CONSUME(Tokens.Public)
    })
    this.CONSUME(Tokens.Infixity)
    this.CONSUME1(Tokens.Operator)
    this.CONSUME(Tokens.InfixLevel)
    this.CONSUME2(Tokens.Operator)
    this.CONSUME(Tokens.LRound)
    this.SUBRULE(this.functionArguments)
    this.CONSUME(Tokens.RRound)
    this.SUBRULE(this.functionBody)
  })

  private readonly variableDefinition = this.RULE('variableDefinition', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Tokens.Var)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.Public)
        }
      }
    ])
    this.AT_LEAST_ONE_SEP({
      SEP: Tokens.Comma,
      DEF: () => {
        this.SUBRULE(this.variableDefinitionItem)
      }
    })
    this.CONSUME(Tokens.Semicolon)
  })

  private readonly variableDefinitionItem = this.RULE('variableDefinitionItem', () => {
    this.CONSUME(Tokens.LIdentifier)
    this.OPTION(() => {
      this.CONSUME(Tokens.Equal)
      this.SUBRULE(this.basicExpression)
    })
  })

  private readonly expression = this.RULE('expression', () => {
    this.SUBRULE(this.basicExpression)
    this.OPTION(() => {
      this.CONSUME(Tokens.Semicolon)
      this.SUBRULE(this.expression)
    })
  })

  private readonly basicExpression = this.RULE('basicExpression', () => { // FIXME, all above is correct
    this.SUBRULE1(this.postfixExpression)
    this.MANY({
      GATE: () => !this.BACKTRACK(this.caseBranchPrefix).apply(this),
      DEF: () => {
        this.CONSUME(Tokens.Operator)
        this.SUBRULE2(this.postfixExpression)
      }
    })
  })

/*   private readonly basicExpression = this.RULE('basicExpression', () => { // FIXME, all above is correct
    this.SUBRULE1(this.postfixExpression)
    this.MANY({
      GATE: () => !(
        this.LA(1).tokenType === Tokens.Bar &&
        this.caseBranch()
      ),
      DEF: () => {
        this.CONSUME(Tokens.Operator)
        this.SUBRULE2(this.postfixExpression)
      }
    })
  }) */

  private readonly postfixExpression = this.RULE('postfixExpression', () => {
    this.OPTION(() => {
      this.CONSUME(Tokens.Minus)
    })
    this.SUBRULE(this.primary)
    this.MANY(() => {
      this.SUBRULE(this.postfix)
    })
  })

  private readonly primary = this.RULE('primary', () => { // TODO: Apply
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Tokens.DecimalLiteral)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.StringLiteral)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.CharLiteral)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.BooleanLiteral)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.Infix)
          this.CONSUME(Tokens.Operator)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.Fun)
          this.CONSUME1(Tokens.LRound)
          this.SUBRULE(this.functionArguments)
          this.CONSUME1(Tokens.RRound)
          this.SUBRULE(this.functionBody)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.Skip)
        }
      },
/*       {
        ALT: () => {
          this.CONSUME(Tokens.Return)
          this.OPTION1(() => {
            this.SUBRULE(this.basicExpression)
          })
        }
      }, */
      /* {
        ALT: () => {
          this.CONSUME(Tokens.LCurly)
          this.OR2([
            {
              GATE: () => this.BACKTRACK(this.listExpressionBody).apply(this),
              ALT: () => {
                this.SUBRULE(this.listExpressionBody)
              }
            },
            {
              ALT: () => {
                this.SUBRULE(this.scopeExpression)
              }
            }
          ])
          this.CONSUME(Tokens.RCurly)
        }
      }, */
      {
        ALT: () => {
          this.CONSUME(Tokens.LCurly)
          this.SUBRULE(this.listExpressionBody)
          this.CONSUME(Tokens.RCurly)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.arrayExpression)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.symbolExpression)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.ifExpression)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.whileDoExpression)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.doWhileExpression)
        }
      },
/*       {
        ALT: () => {
          this.SUBRULE(this.repeatExpression)
        }
      }, */
      {
        ALT: () => {
          this.SUBRULE(this.forExpression)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.caseExpression)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.lazyExpression)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.etaExpression)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.syntaxExpression)
        }
      },
      {
        ALT: () => {
          this.CONSUME2(Tokens.LRound)
          this.SUBRULE(this.scopeExpression)
          this.CONSUME2(Tokens.RRound)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.LIdentifier)
        }
      }
    ])
  })

  private readonly arrayExpression = this.RULE('arrayExpression', () => {
    this.CONSUME(Tokens.LSquare)
    this.MANY_SEP({
      SEP: Tokens.Comma,
      DEF: () => {
        this.SUBRULE(this.expression)
      }
    })
    this.CONSUME(Tokens.RSquare)
  })

  private readonly listExpressionBody = this.RULE('listExpressionBody', () => {
    this.SUBRULE1(this.expression)
    this.CONSUME(Tokens.Comma)
    this.AT_LEAST_ONE_SEP({
      SEP: Tokens.Comma,
      DEF: () => {
        this.SUBRULE2(this.expression)
      }
    })
  })

  private readonly symbolExpression = this.RULE('symbolExpression', () => {
    this.CONSUME(Tokens.UIdentifier)
    this.OPTION(() => {
      this.CONSUME(Tokens.LRound)
      this.AT_LEAST_ONE_SEP({
        SEP: Tokens.Comma,
        DEF: () => {
          this.SUBRULE(this.expression)
        }
      })
      this.CONSUME(Tokens.RRound)
    })
  })

  private readonly ifExpression = this.RULE('ifExpression', () => {
    this.CONSUME(Tokens.If)
    this.SUBRULE(this.expression)
    this.CONSUME(Tokens.Then)
    this.SUBRULE(this.scopeExpression)
    this.OPTION(() => {
      this.SUBRULE(this.elsePart)
    })
    this.CONSUME(Tokens.Fi)
  })

  private readonly elsePart = this.RULE('elsePart', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Tokens.Elif)
          this.SUBRULE(this.expression)
          this.CONSUME(Tokens.Then)
          this.SUBRULE1(this.scopeExpression)
          this.OPTION(() => {
            this.SUBRULE(this.elsePart)
          })
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.Else)
          this.SUBRULE2(this.scopeExpression)
        }
      }
    ])
  })

  private readonly whileDoExpression = this.RULE('whileDoExpression', () => {
    this.CONSUME(Tokens.While)
    this.SUBRULE(this.expression)
    this.CONSUME(Tokens.Do)
    this.SUBRULE(this.scopeExpression)
    this.CONSUME(Tokens.Od)
  })

  private readonly doWhileExpression = this.RULE('doWhileExpression', () => {
    this.CONSUME(Tokens.Do)
    this.SUBRULE(this.scopeExpression)
    this.CONSUME(Tokens.While)
    this.SUBRULE(this.expression)
    this.CONSUME(Tokens.Od)
  })

/*   private readonly repeatExpression = this.RULE('repeatExpression', () => {
    this.CONSUME(Tokens.Repeat)
    this.SUBRULE(this.scopeExpression)
    this.CONSUME(Tokens.Until)
    this.SUBRULE(this.basicExpression)
  }) */

  private readonly forExpression = this.RULE('forExpression', () => {
    this.CONSUME(Tokens.For)
    this.SUBRULE1(this.scopeExpression)
    this.CONSUME1(Tokens.Comma)
    this.SUBRULE1(this.expression)
    this.CONSUME2(Tokens.Comma)
    this.SUBRULE2(this.expression)
    this.CONSUME(Tokens.Do)
    this.SUBRULE2(this.scopeExpression)
    this.CONSUME(Tokens.Od)
  })

  private readonly caseExpression = this.RULE('caseExpression', () => {
    this.CONSUME(Tokens.Case)
    this.SUBRULE(this.expression)
    this.CONSUME(Tokens.Of)
    this.SUBRULE(this.pattern)
    this.CONSUME(Tokens.Arrow)
    this.SUBRULE1(this.scopeExpression)
    this.MANY(() => {
      this.SUBRULE(this.caseBranchPrefix)
      this.SUBRULE2(this.scopeExpression)
    })
    this.CONSUME(Tokens.Esac)
  })

  private readonly caseBranchPrefix = this.RULE('caseBranchPrefix', () => {
    this.CONSUME(Tokens.Bar)
    this.SUBRULE(this.pattern)
    this.CONSUME(Tokens.Arrow)
  })

/*   private readonly caseExpression = this.RULE('caseExpression', () => {
    this.CONSUME(Tokens.Case)
    this.SUBRULE(this.expression)
    this.CONSUME(Tokens.Of)
    this.AT_LEAST_ONE_SEP({
      SEP: Tokens.Bar,
      DEF: () => {
        this.SUBRULE(this.caseBranch)
      }
    })
    this.CONSUME(Tokens.Esac)
  })

  private readonly caseBranch = this.RULE('caseBranch', () => {
    this.SUBRULE(this.pattern)
    this.CONSUME(Tokens.Arrow)
    this.SUBRULE(this.scopeExpression)
  }) */


  private readonly lazyExpression = this.RULE('lazyExpression', () => {
    this.CONSUME(Tokens.Lazy)
    this.SUBRULE(this.basicExpression)
  })

  private readonly etaExpression = this.RULE('etaExpression', () => {
    this.CONSUME(Tokens.Eta)
    this.SUBRULE(this.basicExpression)
  })

  private readonly syntaxExpression = this.RULE('syntaxExpression', () => {
    this.CONSUME(Tokens.Syntax)
    this.CONSUME(Tokens.LRound)
    this.AT_LEAST_ONE_SEP({
      SEP: Tokens.Bar,
      DEF: () => {
        this.SUBRULE(this.syntaxSeq)
      }
    })
    this.CONSUME(Tokens.RRound)
  })

  private readonly syntaxSeq = this.RULE('syntaxSeq', () => {
    this.AT_LEAST_ONE({
      DEF: () => {
        this.SUBRULE(this.syntaxBinding)
      }
    })
    this.OPTION(() => {
      this.CONSUME(Tokens.LCurly)
      this.SUBRULE(this.expression)
      this.CONSUME(Tokens.RCurly)
    })
  })

  private readonly syntaxBinding = this.RULE('syntaxBinding', () => {
    this.OPTION1(() => {
      this.CONSUME(Tokens.Minus)
    })
    this.OPTION2(() => {
      this.SUBRULE(this.pattern)
      this.CONSUME(Tokens.Equal)
    })
    this.SUBRULE(this.syntaxPostfix)
  })

  private readonly syntaxPostfix = this.RULE('syntaxPostfix', () => {
    this.SUBRULE(this.syntaxPrimary)
    this.OPTION(() => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(Tokens.Plus)
          }
        },
        {
          ALT: () => {
            this.CONSUME(Tokens.Question)
          }
        },
        {
          ALT: () => {
            this.CONSUME(Tokens.Star)
          }
        }
      ])
    })
  })

  private readonly syntaxPrimary = this.RULE('syntaxPrimary', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Tokens.LIdentifier)
          this.MANY(() => {
            this.CONSUME(Tokens.LSquare)
            this.AT_LEAST_ONE_SEP({
              SEP: Tokens.Comma,
              DEF: () => {
                this.SUBRULE1(this.expression)
              }
            })
            this.CONSUME(Tokens.RSquare)
          })
        }
      },
      {
        ALT: () => {
          this.CONSUME1(Tokens.LRound)
          this.SUBRULE(this.syntaxExpression)
          this.CONSUME1(Tokens.RRound)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.Dollar)
          this.CONSUME2(Tokens.LRound)
          this.SUBRULE2(this.expression)
          this.CONSUME2(Tokens.RRound)
        }
      }
    ])
  })

  private readonly postfix = this.RULE('postfix', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME1(Tokens.Dot)
          this.CONSUME(Tokens.Length)
        }
      },
      {
        ALT: () => {
          this.CONSUME2(Tokens.Dot)
          this.CONSUME(Tokens.String)
        }
      },
      {
        ALT: () => {
          this.SUBRULE1(this.postfixCall)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.postfixIndex)
        }
      },
      {
        ALT: () => {
          this.CONSUME3(Tokens.Dot)
          this.CONSUME(Tokens.LIdentifier)
          this.OPTION(() => {
            this.SUBRULE2(this.postfixCall)
          })
        }
      }
    ])
  })

  private readonly postfixCall = this.RULE('postfixCall', () => {
    this.CONSUME(Tokens.LRound)
    this.MANY_SEP({
      SEP: Tokens.Comma,
      DEF: () => {
        this.SUBRULE(this.expression)
      }
    })
    this.CONSUME(Tokens.RRound)
  })

  private readonly postfixIndex = this.RULE('postfixIndex', () => {
    this.CONSUME(Tokens.LSquare)
    this.SUBRULE(this.expression)
    this.CONSUME(Tokens.RSquare)
  })

  /// PATTERNS

  private readonly pattern = this.RULE('pattern', () => {
    this.SUBRULE(this.simplePattern)
    this.OPTION(() => {
      this.CONSUME(Tokens.Colon)
      this.SUBRULE(this.pattern)
    })
  })

  private readonly simplePattern = this.RULE('simplePattern', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Tokens.Underscore)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.sExprPattern)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.arrayPattern)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.listPattern)
        }
      },
      {
        ALT: () => {
          this.SUBRULE(this.asPattern)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.DecimalLiteral)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.StringLiteral)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.CharLiteral)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.BooleanLiteral)
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.Hash)
          this.CONSUME(Tokens.Shape) //not sure
        }
      },
      {
        ALT: () => {
          this.CONSUME(Tokens.LRound)
          this.SUBRULE(this.pattern)
          this.CONSUME(Tokens.RRound)
        }
      }
    ])
  })

  private readonly sExprPattern = this.RULE('sExprPattern', () => {
    this.CONSUME(Tokens.UIdentifier)
    this.OPTION(() => {
      this.CONSUME(Tokens.LRound)
      this.AT_LEAST_ONE_SEP({
        SEP: Tokens.Comma,
        DEF: () => {
          this.SUBRULE(this.pattern)
        }
      })
      this.CONSUME(Tokens.RRound)
    })
  })

  private readonly arrayPattern = this.RULE('arrayPattern', () => {
    this.CONSUME(Tokens.LSquare)
    this.MANY_SEP({
      SEP: Tokens.Comma,
      DEF: () => {
        this.SUBRULE(this.pattern)
      }
    })
    this.CONSUME(Tokens.RSquare)
  })

  private readonly listPattern = this.RULE('listPattern', () => {
    this.CONSUME(Tokens.LCurly)
    this.MANY_SEP({
      SEP: Tokens.Comma,
      DEF: () => {
        this.SUBRULE(this.pattern)
      }
    })
    this.CONSUME(Tokens.RCurly)
  })

  private readonly asPattern = this.RULE('asPattern', () => {
    this.CONSUME(Tokens.LIdentifier)
    this.OPTION(() => {
      this.CONSUME(Tokens.AtSign)
      this.SUBRULE(this.pattern)
    })
  })
}

const parser = new LamaParser()

export const productions: Record<string, Rule> = parser.getGAstProductions()
