import {AbstractScope as Scope} from './scope'
import {Position as UiPosition, Point as UiPoint} from 'unist'
import {Range as VsRange, Position as VsPosition} from 'vscode-languageserver'
import { CstNode, CstNodeLocation, IToken } from 'chevrotain';
import { InterfaceItem } from './interface';

export function findDefinition(name: string, scope: Scope<UiPosition> | undefined) { 
    while (scope !== undefined) {
        const value = scope.get(name);
        if(value !== undefined) {
            return value;
        }
        scope = scope.parent;
    }
    /*     if(scope === undefined) {
        return undefined;
    }
    else {
        return scope.get(name);  //not sure
    } */
}                                //COLLISIONS

export function PositionToRange (position: UiPosition) : VsRange {
    const range = VsRange.create(
        VsPosition.create(position.start.line - 1, position.start.column - 1),
        /* PointToPosition(position.start), */
        VsPosition.create(position.end.line - 1, position.end.column)
        /* PointToPosition(position.end) */
    );
    return range;
}

export function PointToPosition (point:UiPoint) : VsPosition {
    const position = VsPosition.create(
        point.line - 1,
        point.column - 1
    )
    return position;
}

/* export function getNode (parseTree: CstNode, position: VsPosition): CstNode {
    for(const key in parseTree.children) {
        const node = parseTree.children[key];
        for(let i = 0; i < node.length; i++) {
            if('location' in node[i]) {
                if(inside(position, node[i].location)) {
                    return getNode (node[i], position);
                }
            }
        }
    }
    return parseTree;
} */

export function computeToken(node: any /* CstNode */, offset: number): any /* IToken | undefined */ {
    for(const key in node.children) {
        const element = node.children[key];
        for(let i = 0; i < element.length; i++) {
            if(element[i].hasOwnProperty("location") && inside(offset, element[i].location)) {
                    return computeToken(element[i], offset);
            }
            else {
                if(inside(offset, element[i]) && element[i].scope) {
                    return element[i];
                }
            }
        }
    }
    return undefined;
}

function inside(offset: number, range: any/* CstNodeLocation | IToken */): Boolean {
    if(range.endOffset) {
        if(offset >= range.startOffset && offset <= range.endOffset + 1) {
            return true;
        }
    }
    return false;
}

export const fictiveRange : VsRange = VsRange.create(
    VsPosition.create(0,0),
    VsPosition.create(0,5)
)
