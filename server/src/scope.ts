export class AbstractScope<T> { //compare with Lama scope
  private readonly scope: {
    [identifier: string]: T
  }

  public parent: AbstractScope<T> | undefined

  constructor (parent?: AbstractScope<T>) {
    this.scope = parent === undefined ? {} : Object.create(parent)
    this.parent = parent
  }

  public get (identifier: string): T | undefined {
    return this.scope[identifier]
  }

  public has (identifier: string): boolean {
    return this.scope[identifier] !== undefined
  }

  public add (identifier: string, item: T): void {
    this.scope[identifier] = item
  }
}
