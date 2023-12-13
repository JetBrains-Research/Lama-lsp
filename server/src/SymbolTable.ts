import { CstNode, ILexingResult } from 'chevrotain'
import { DefaultScope as Scope} from './Scope';
import { IToken } from 'chevrotain';

export class SymbolTable {
  public imports: string[];
  public publicScope: Scope;

  constructor (publicScope: Scope) {
    this.imports = [];
    this.publicScope = publicScope;
  }

}

export class SymbolTables { 
  private readonly symbolTables: {
      [uri: string]: SymbolTable
  }

  private readonly parseTrees: {
      [uri: string]: CstNode
  }

  public importedBy: {
    [uri: string]: Set<string>
  }

  private readonly lexResult: {
    [uri: string]: ILexingResult;
  }

  constructor () {
    this.symbolTables = {}
    this.parseTrees = {}
    this.importedBy = {}
    this.lexResult = {}
  }

  public updateST (uri: string, symbolTable: SymbolTable): void {
    this.symbolTables[uri] = symbolTable
  }

  public getST (uri: string): SymbolTable | undefined {
    return this.symbolTables[uri]
  } 

  public updatePT (uri: string, parseTree: any): void {
    this.parseTrees[uri] = parseTree
  }

  public getPT (uri: string): CstNode | undefined {
    return this.parseTrees[uri]
  } 

  public deleteST (uri: string): void {
    if(this.symbolTables[uri]) {
      delete(this.symbolTables[uri]);
    }
  }

  public updateLexResult (uri: string, lexString: ILexingResult | undefined): void {
    if(lexString) this.lexResult[uri] = lexString;
  }

  public getLexResult (uri: string): ILexingResult | undefined {
    return this.lexResult[uri];
  }
  
}
