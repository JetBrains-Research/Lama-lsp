import { Location } from 'vscode-languageserver'
import { IToken } from 'chevrotain'

export class AbstractScope<T> {
	private readonly definitions: {
	  [identifier: string]: T
	}
  
	private readonly referencesDict: {
	  [identifier: string]: [Location]
	}

	private readonly fArgs: {
		[identifier: string]: string
	}
  
	public parent: AbstractScope<T> | undefined
  
	constructor (parent?: AbstractScope<T>) {
	  this.definitions = parent === undefined ? {} : Object.create(parent)
	  this.referencesDict = {}
	  this.fArgs = {}
	  this.parent = parent
	}
  
	public get (identifier: string): T | undefined {
	  return this.definitions[identifier]
	}
  
	public has (identifier: string): boolean {
	  return this.definitions[identifier] !== undefined
	}
  
	public add (identifier: string, item: T): void {
	  this.definitions[identifier] = item
	}
  
	public addReference (identifier: string, location: Location): void {
	  if(this.referencesDict[identifier]) {
		this.referencesDict[identifier].push(location)
	  }
	  else {
		this.referencesDict[identifier] = [location]
	  }
	}
  
	public getReferences (identifier: string): [Location] | undefined {
	  return this.referencesDict[identifier]
	}

	public getRefNames (): string[] {
	  return Object.keys(this.referencesDict)
	}

	public addFArgs (identifier: string, names: string[]): void {
		this.fArgs[identifier] = names.join(', ');
	}

	public getFArgs (identifier: string): string {
		return this.fArgs[identifier];
	}
  }

export class DefaultScope extends AbstractScope< Location > {}