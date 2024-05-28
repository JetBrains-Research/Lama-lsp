import { CompletionItemKind, Location, Range, SymbolKind } from 'vscode-languageserver';
import { IToken } from 'chevrotain';

type ArgError = [Range, number, number];

type ArgResolve = [string, Range, number];

export class AbstractScope<T> {
	private readonly definitions: {
		[identifier: string]: T
	};
  
	private readonly referencesDict: {
		[identifier: string]: [Location]
	};

	private readonly fArgs: {
		[identifier: string]: string
	};

	private readonly NArgs: {
		[identifier: string]: number
	};
  
	public parent: AbstractScope<T> | undefined;

	private readonly argErrors: ArgError[];

	private readonly argResolves: ArgResolve[];
  
	constructor (parent?: AbstractScope<T>) {
		this.definitions = parent === undefined ? {} : Object.create(parent);
		this.referencesDict = {};
		this.fArgs = {};
		this.argErrors = [];
		this.argResolves = [];
		this.parent = parent;
		this.NArgs = {};
	}
  
	public get (identifier: string): T | undefined {
		return this.definitions[identifier];
	}
  
	public has (identifier: string): boolean {
		return this.definitions[identifier] !== undefined;
	}
  
	public add (identifier: string, item: T): void {
		this.definitions[identifier] = item;
	}

	public getNames (): {[identifier: string]: T} {
		return this.definitions;
		// return Object.keys(this.definitions)
	}
  
	public addReference (identifier: string, location: Location): void {
		if(this.referencesDict[identifier]) {
			this.referencesDict[identifier].push(location);
		}
		else {
			this.referencesDict[identifier] = [location];
		}
	}
  
	public getReferences (identifier: string): [Location] | undefined {
		return this.referencesDict[identifier];
	}

	public getRefNames (): string[] {
		return Object.keys(this.referencesDict);
	}

	public addFArgs (identifier: string, names: string): void {
		this.fArgs[identifier] = names;
	}

	public getFArgs (identifier: string): string | undefined {
		return this.fArgs[identifier];
	}

	public addNArgs (identifier: string, n: number): void {
		this.NArgs[identifier] = n;
	}

	public getNArgs (identifier: string): number | undefined {
		return this.NArgs[identifier];
	}

	public addArgError(range: Range, nArgs: number, expectedNArgs: number): void {
		this.argErrors.push([range, nArgs, expectedNArgs]);
	}

	public getArgErrors(): ArgError[] {
		return this.argErrors;
	}

	public addArgResolve(name: string, range: Range, nArgs: number): void {
		this.argResolves.push([name, range, nArgs]);
	}

	public getArgResolves(): ArgResolve[] {
		return this.argResolves;
	}
  }

export class SymbolClass {
	symboltype: CompletionItemKind;

	constructor(x: CompletionItemKind) {
		this.symboltype = x;
	}
}

export class DefaultScope extends AbstractScope< Location & SymbolClass > {}