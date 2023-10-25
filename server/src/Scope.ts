import { Location } from 'vscode-languageserver'

export class AbstractScope<T> {
	private readonly definitions: {
	  [identifier: string]: T
	}
  
	private readonly referencesDict: {
	  [identifier: string]: [Location]
	}
  
	public parent: AbstractScope<T> | undefined
  
	constructor (parent?: AbstractScope<T>) {
	  this.definitions = parent === undefined ? {} : Object.create(parent)
	  this.referencesDict = {}
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
  }

export class DefaultScope extends AbstractScope<Location> {}