import { CstNode } from 'chevrotain'
import { DefaultScope as Scope} from './Scope';

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

  constructor () {
    this.symbolTables = {}
    this.parseTrees = {}
    this.importedBy = {}
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
  
}
